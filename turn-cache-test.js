'use strict';
// Run production server source with a fixed clock and a local Cloudflare fetch mock.
// No server socket, credentials, provider request or Railway access is involved.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const root = process.cwd();
const serverFile = process.env.TCGATE_TURN_SERVER_UNDER_TEST || path.join(root, 'server.js');
const source = fs.readFileSync(serverFile, 'utf8');
const requireRuntime = createRequire(path.join(root, 'server.js'));
let assertions = 0;
function check(value, label) { assert(value, label); assertions++; }
function equal(actual, expected, label) { assert.deepEqual(actual, expected, label); assertions++; }
const plain = value => JSON.parse(JSON.stringify(value));

function fixture({ configured = true, policy = 'all', ttl = '3600' } = {}) {
  const clock = { now: 10_000 }, calls = [], timers = new Set(), intervals = [], logs = [];
  let mode = 'success';
  class ClockDate extends Date { static now() { return clock.now; } }
  const server = { listen() {}, close() {} };
  const context = vm.createContext({
    require: name => name === 'http' ? { createServer: () => server } : name === 'os' ? { networkInterfaces: () => ({}) } : requireRuntime(name),
    __dirname: root, Buffer, URL, AbortController, Date: ClockDate,
    process: { env: {
      PORT: '0', HOST: '127.0.0.1', TCGATE_ICE_TRANSPORT_POLICY: policy, TCGATE_TURN_TTL_SECONDS: ttl,
      ...(configured ? { CLOUDFLARE_TURN_KEY_ID: 'fixture-key/id', CLOUDFLARE_TURN_KEY_API_TOKEN: 'fixture-turn-api-token' } : {})
    }, on() {} },
    console: { log() {}, error: (...args) => logs.push(args.join(' ')) },
    setTimeout: (callback, delay) => { const timer = { callback, delay }; timers.add(timer); return timer; },
    clearTimeout: timer => timers.delete(timer),
    setInterval: (callback, delay) => { intervals.push({ callback, delay }); return { unref() {} }; },
    fetch: async (url, options) => {
      check(url === 'https://rtc.live.cloudflare.com/v1/turn/keys/fixture-key%2Fid/credentials/generate-ice-servers', 'Only the mocked Cloudflare endpoint may be called');
      calls.push({ url, options, body: JSON.parse(options.body) });
      if (mode === 'network-error') throw Error('Mock Cloudflare network failure');
      return { ok: mode !== 'http-error', status: mode === 'http-error' ? 503 : 200, json: async () => {
        if (mode === 'invalid-json') throw SyntaxError('Mock invalid JSON');
        return { iceServers: mode === 'bad-payload' ? [] : [
          { urls: ['stun:stun.fixture.invalid:3478'] },
          { urls: ['turn:relay.fixture.invalid:3478'], username: 'fixture-user-' + calls.length, credential: 'fixture-credential-' + calls.length }
        ] };
      } };
    }
  });
  vm.runInContext(source + '\n;globalThis.turnFixture = { purgeTurnCredentialCache, generateCloudflareTurnIceServers, rtcConfigForPeer, turnCredentialCache, rooms, recoveryIndex, ROOM_TTL_MS, DISCONNECTED_PEER_GRACE_MS };', context, { filename: serverFile });
  equal(intervals.length, 1, 'Production maintenance timer installed once');
  equal(intervals[0].delay, 15000, 'Production maintenance timer cadence unchanged');
  return { api: context.turnFixture, clock, calls, timers, logs, sweep: intervals[0].callback, mode: value => { mode = value; } };
}

function purgeContract() {
  const f = fixture(), now = f.clock.now;
  const cache = new Map([
    ['active', { expiresAtMs: now + 60_000 }], ['expired', { expiresAtMs: now - 1 }],
    ['boundary', { expiresAtMs: now }], ['room-peer', { expiresAtMs: now + 60_000 }],
    ['null', null], ['missing', {}], ['infinite', { expiresAtMs: Infinity }], ['nan', { expiresAtMs: NaN }]
  ]);
  equal(f.api.purgeTurnCredentialCache(cache, now), 6, 'Expired, boundary and malformed cache records removed');
  equal([...cache.keys()], ['active', 'room-peer'], 'Unrelated active credentials preserved');
  equal(f.api.purgeTurnCredentialCache(cache, now, ['room-peer', 'room-peer', 'absent']), 1, 'Explicit room peer cleanup counts unique existing records');
  equal([...cache.keys()], ['active'], 'Active unrelated peer remains after room cleanup');
  equal(f.api.purgeTurnCredentialCache(cache, now), 0, 'Repeated purge is idempotent');
}

async function renewalContract() {
  const f = fixture(), api = f.api;
  const first = await api.generateCloudflareTurnIceServers('peer-a');
  equal(f.calls.length, 1, 'Initial credentials generated');
  equal(f.calls[0].options.method, 'POST', 'Cloudflare POST method');
  equal(f.calls[0].options.headers.Authorization, 'Bearer fixture-turn-api-token', 'Synthetic provider authorization');
  equal(f.calls[0].body.ttl, 3600, 'Configured credential lifetime requested');
  equal(first.issuedAtMs, f.clock.now, 'Issue time uses clock');
  equal(first.expiresAtMs, f.clock.now + 3_600_000, 'Credential expiry derives from requested TTL');
  check(api.turnCredentialCache.get('peer-a') === first, 'Generated record stored under its peer key');
  f.clock.now = first.expiresAtMs - 300_001;
  check(await api.generateCloudflareTurnIceServers('peer-a') === first, 'Credentials reused while more than five minutes remain');
  equal(f.calls.length, 1, 'Valid cache avoids provider request');
  f.clock.now = first.expiresAtMs - 300_000;
  const renewed = await api.generateCloudflareTurnIceServers('peer-a');
  equal(f.calls.length, 2, 'Exactly five minutes remaining triggers renewal');
  check(renewed !== first && renewed.expiresAtMs > first.expiresAtMs, 'Renewal replaces old cache with later expiry');
  f.clock.now = renewed.expiresAtMs;
  const afterExpiry = await api.generateCloudflareTurnIceServers('peer-a');
  equal(f.calls.length, 3, 'Expired credentials are never reused');
  check(afterExpiry !== renewed && afterExpiry.issuedAtMs === f.clock.now, 'Expiry issues a fresh record');
  for (const key of ['peer-b', 'phone:pair-a:pc', 'phone:pair-a:phone']) await api.generateCloudflareTurnIceServers(key);
  equal(f.calls.length, 6, 'Peer and both Phone roles have distinct credential caches');
  equal(api.turnCredentialCache.size, 4, 'Cache contains exactly the independent live keys');
  equal(f.timers.size, 0, 'Generation timeout always cleared after success');
  const config = await api.rtcConfigForPeer('peer-a');
  equal(config.turn.available, true, 'Valid config advertises TURN availability');
  equal(config.turn.provider, 'cloudflare-realtime-turn', 'TURN provider retained');
  equal(config.turn.expiresAt, new Date(afterExpiry.expiresAtMs).toISOString(), 'Config exports actual expiry');
}

async function failureContracts() {
  for (const policy of ['all', 'relay']) {
    for (const mode of ['http-error', 'network-error', 'invalid-json', 'bad-payload']) {
      const f = fixture({ policy });
      const stale = { iceServers: [{ urls: ['turn:old.fixture.invalid'], credential: 'expired-secret' }], expiresAtMs: f.clock.now - 1 };
      f.api.turnCredentialCache.set('peer', stale);
      f.mode(mode);
      const result = plain(await f.api.rtcConfigForPeer('peer'));
      equal(f.calls.length, 1, policy + '/' + mode + ': expired cache requires fresh generation');
      equal(result.turn.available, false, 'Provider failure never advertises TURN availability');
      equal(result.turn.reason, 'credential-generation-failed', 'Provider failure has explicit reason');
      equal(result.turn.expiresAt, null, 'Provider failure never advertises stale expiry');
      equal(result.iceTransportPolicy, policy, 'Configured transport policy preserved after failure');
      check(!JSON.stringify(result).includes('expired-secret'), 'Provider failure never returns expired credentials');
      if (policy === 'relay') equal(result.iceServers, [], 'Relay-only fails closed without STUN fallback');
      else check(result.iceServers.length > 0 && result.iceServers.every(item => item.urls.every(url => url.startsWith('stun:'))), 'All policy retains STUN-only fallback');
      await f.api.rtcConfigForPeer('peer');
      equal(f.calls.length, 2, 'Retry never falls back to stale cached credentials');
      equal(f.timers.size, 0, 'Generation timeout cleared after every failure');
      f.sweep();
      equal(f.api.turnCredentialCache.has('peer'), false, 'Scheduled sweep removes expired record after failure');
      f.mode('success');
      const recovered = await f.api.rtcConfigForPeer('peer');
      equal(recovered.turn.available, true, 'Provider recovery yields fresh usable credentials');
      equal(recovered.iceTransportPolicy, policy, 'Transport policy retained after provider recovery');
    }
  }
}

function cleanupContract() {
  const f = fixture(), api = f.api, now = f.clock.now;
  let closed = 0;
  api.turnCredentialCache.set('room-peer', { expiresAtMs: now + 60_000 });
  api.turnCredentialCache.set('unrelated', { expiresAtMs: now + 60_000 });
  api.turnCredentialCache.set('phone:expired:pc', { expiresAtMs: now });
  api.recoveryIndex.set('recovery-key', { fixture: true });
  api.rooms.set('EXPIRED', { code: 'EXPIRED', createdAt: now - api.ROOM_TTL_MS - 1, peers: new Map([
    ['room-peer', { id: 'room-peer', recoveryKey: 'recovery-key', sse: { end: () => { closed++; } } }]
  ]) });
  f.sweep();
  equal(closed, 1, 'Expired room SSE closed');
  equal(api.rooms.has('EXPIRED'), false, 'Expired room removed');
  equal(api.recoveryIndex.has('recovery-key'), false, 'Expired room recovery reference removed');
  equal(api.turnCredentialCache.has('room-peer'), false, 'Expired room removes its still-valid peer credentials');
  equal(api.turnCredentialCache.has('phone:expired:pc'), false, 'Periodic purge removes expired Phone credentials too');
  equal(api.turnCredentialCache.has('unrelated'), true, 'Room expiry preserves unrelated active cache');
  api.turnCredentialCache.set('disconnected', { expiresAtMs: now + 60_000 });
  api.rooms.set('DISCONNECTED', { code: 'DISCONNECTED', createdAt: now, peers: new Map([
    ['disconnected', { id: 'disconnected', sse: null, disconnectedAt: now - api.DISCONNECTED_PEER_GRACE_MS - 1 }]
  ]) });
  f.sweep();
  equal(api.turnCredentialCache.has('disconnected'), false, 'Existing disconnected-peer cleanup still removes credentials');
  equal(api.rooms.has('DISCONNECTED'), false, 'Existing disconnected-peer cleanup still removes empty room');
}

async function configContracts() {
  for (const policy of ['all', 'relay']) {
    const f = fixture({ configured: false, policy });
    equal(await f.api.generateCloudflareTurnIceServers('peer'), null, 'No provider request without configuration');
    const result = plain(await f.api.rtcConfigForPeer('peer'));
    equal(result.turn, { configured: false, available: false, provider: null, policy: 'all', expiresAt: null, reason: 'cloudflare-env-missing' }, 'Existing unconfigured STUN fallback remains explicit');
    equal(result.iceTransportPolicy, 'all', 'Missing TURN configuration retains existing all policy');
    equal(f.calls.length, 0, 'Unconfigured runtime never requests provider credentials');
  }
  for (const [ttl, expected] of [['1', 3600], ['999999', 86400], ['invalid', 21600]]) {
    const f = fixture({ ttl, policy: 'relay' });
    const result = await f.api.rtcConfigForPeer('peer');
    equal(f.calls[0].body.ttl, expected, 'Configured TTL is bounded: ' + ttl);
    equal(result.iceTransportPolicy, 'relay', 'Configured relay policy kept on success');
    equal(result.turn.policy, 'relay', 'Report metadata matches relay policy');
    check(result.iceServers.some(item => item.urls.some(url => url.startsWith('turn:'))), 'Relay config includes TURN server');
  }
}

(async () => {
  purgeContract();
  await renewalContract();
  await failureContracts();
  cleanupContract();
  await configContracts();
  console.log('TURN_CACHE_CLEANUP_OK · ' + assertions + ' assertions · production source + maintenance sweep · cache/renewal/expiry/room/disconnect/all/relay · mocked Cloudflare only');
})().catch(error => { console.error(error); process.exitCode = 1; });
