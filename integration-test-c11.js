'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = 4322;
const BASE = `http://127.0.0.1:${PORT}`;
const server = spawn(process.execPath, ['server.js'], {
  cwd: __dirname,
  env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1' },
  stdio: ['ignore', 'pipe', 'pipe']
});

let serverLog = '';
server.stdout.on('data', d => { serverLog += d.toString(); });
server.stderr.on('data', d => { serverLog += d.toString(); });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForHealth() {
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(`${BASE}/api/health`, { cache: 'no-store' });
      if (r.ok) return await r.json();
    } catch {}
    await new Promise(r => setTimeout(r, 50));
  }
  throw new Error(`Server did not start. Log: ${serverLog}`);
}

function cookieFrom(response) {
  const raw = response.headers.get('set-cookie') || '';
  return { raw, cookie: raw.split(';')[0] || '' };
}

async function post(pathname, body, { token = null, cookie = null, forwardedHttps = false } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  if (cookie) headers.Cookie = cookie;
  if (forwardedHttps) headers['X-Forwarded-Proto'] = 'https';
  return fetch(`${BASE}${pathname}`, {
    method: 'POST',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

(async () => {
  try {
    const appSource = fs.readFileSync(path.join(__dirname, 'public', 'app.js'), 'utf8');
    const readyOptimisticAt = appSource.indexOf('state.readyRequestPending = true;');
    const readyRenderAt = appSource.indexOf('if (state.roomSnapshot) applyRoomState(state.roomSnapshot);', readyOptimisticAt);
    const readyPostAt = appSource.indexOf("const result = await api('/api/ready'", readyOptimisticAt);
    assert(readyOptimisticAt >= 0 && readyRenderAt > readyOptimisticAt && readyPostAt > readyRenderAt,
      'Ready UI is not updated locally before the network request');
    assert(appSource.includes("'Attente de l’adversaire…'"), 'Ready waiting label is missing');
    const gigFactoryStart = appSource.indexOf('function createGigDiceState()');
    const gigFactoryEnd = appSource.indexOf('function validGigDiceState', gigFactoryStart);
    const createTestGigDiceState = new Function(`${appSource.slice(gigFactoryStart, gigFactoryEnd)}; return createGigDiceState;`)();
    const freshGigDice = createTestGigDiceState();
    assert(freshGigDice.length === 12 && freshGigDice.every(die => die.value === 0),
      'A fresh Cyberpunk Gig state does not start with all dice at zero');
    assert(appSource.includes("saved.gigDice.map(die => ({ ...die }))"), 'F5 recovery no longer restores saved Gig state');
    assert(appSource.includes("state.gigDice = ensureGigDiceState().map(die => ({ ...die, value: 0 }))"),
      'Gig reset does not preserve dice properties while zeroing values');
    assert(appSource.includes("sendGigState('manual-reset')"), 'Gig reset is not synchronized through gig-state');

    const health = await waitForHealth();
    assert(health.version === 'tcgate-alpha-0.1-candidate-11', 'Wrong health version');

    const noRecovery = await fetch(`${BASE}/api/recovery-state`);
    assert(noRecovery.ok && (await noRecovery.json()).available === false, 'Recovery should be absent without cookie');

    const hostCreate = await post('/api/rooms', { name: 'Host', game: 'no-game' }, { forwardedHttps: true });
    assert(hostCreate.status === 201, 'Host create failed');
    const hostCookie = cookieFrom(hostCreate);
    assert(hostCookie.cookie.startsWith('tcgate_recovery='), 'Recovery cookie missing');
    assert(/HttpOnly/i.test(hostCookie.raw), 'HttpOnly missing');
    assert(/SameSite=Strict/i.test(hostCookie.raw), 'SameSite=Strict missing');
    assert(/Secure/i.test(hostCookie.raw), 'Secure missing behind HTTPS proxy');
    const host = await hostCreate.json();

    const recoveryState = await fetch(`${BASE}/api/recovery-state`, { headers: { Cookie: hostCookie.cookie } });
    const recoveryPayload = await recoveryState.json();
    assert(recoveryPayload.available === true && recoveryPayload.code === host.code, 'Recovery state does not match host room');

    const guestCreate = await post(`/api/rooms/${host.code}/join`, { name: 'Guest' });
    assert(guestCreate.ok, 'Guest join failed');
    const guest = await guestCreate.json();

    let r = await post('/api/ready', { room: host.code, peerId: host.peerId, ready: true }, { token: host.sessionToken });
    assert(r.ok, 'Host ready failed');
    const hostReadyState = await r.json();
    assert(hostReadyState.room.phase === 'lobby', 'Game started before both players were ready');
    assert(hostReadyState.room.peers.find(p => p.id === host.peerId)?.ready === true, 'Host ready state was not recorded');
    assert(hostReadyState.room.peers.find(p => p.id === guest.peerId)?.ready === false, 'Guest became ready without action');
    r = await post('/api/ready', { room: guest.code, peerId: guest.peerId, ready: true }, { token: guest.sessionToken });
    const gameState = await r.json();
    assert(gameState.room.phase === 'game', 'Room did not enter game phase');
    assert(gameState.room.peers.every(p => p.ready), 'Ready state not preserved at game start');

    const f5Resume = await post('/api/resume', { room: guest.code, peerId: guest.peerId }, { token: guest.sessionToken });
    assert(f5Resume.ok, 'SessionStorage/F5 resume failed');
    const f5State = await f5Resume.json();
    assert(f5State.room.phase === 'game', 'F5 resume lost game phase');
    assert(f5State.room.peers.every(p => p.ready), 'F5 resume reset ready state during game');

    const recover = await post('/api/recover', undefined, { cookie: hostCookie.cookie });
    assert(recover.ok, 'Persistent recovery failed');
    const rotatedCookie = cookieFrom(recover);
    const recovered = await recover.json();
    assert(recovered.sessionToken && recovered.sessionToken !== host.sessionToken, 'Session token did not rotate');
    assert(rotatedCookie.cookie && rotatedCookie.cookie !== hostCookie.cookie, 'Recovery cookie did not rotate');
    const staleCookieState = await fetch(`${BASE}/api/recovery-state`, { headers: { Cookie: hostCookie.cookie } });
    assert((await staleCookieState.json()).available === false, 'Old recovery cookie still works after rotation');
    assert(recovered.room.phase === 'game', 'Game phase was not preserved on recovery');
    assert(recovered.room.peers.every(p => p.ready), 'Ready state was reset during game recovery');

    const oldBearer = await post('/api/ready', { room: host.code, peerId: host.peerId, ready: true }, { token: host.sessionToken });
    assert(oldBearer.status === 401, 'Old Bearer still works after recovery');

    const newBearer = await post('/api/ready', { room: host.code, peerId: host.peerId, ready: true }, { token: recovered.sessionToken });
    assert(newBearer.ok, 'New Bearer does not work after recovery');

    const leave = await post('/api/leave', { room: host.code, peerId: host.peerId }, {
      token: recovered.sessionToken,
      cookie: rotatedCookie.cookie
    });
    assert(leave.ok, 'Leave failed');
    const cleared = cookieFrom(leave).raw;
    assert(/Max-Age=0/i.test(cleared), 'Recovery cookie was not cleared on explicit leave');

    const staleRecovery = await fetch(`${BASE}/api/recovery-state`, { headers: { Cookie: rotatedCookie.cookie } });
    assert((await staleRecovery.json()).available === false, 'Recovery remains available after leave');

    const missingCookieRecover = await post('/api/recover');
    assert(missingCookieRecover.status === 401, 'Recover without cookie should fail');

    const gigHostCreate = await post('/api/rooms', { name: 'Gig Host', game: 'cyberpunk' });
    assert(gigHostCreate.status === 201, 'Cyberpunk Gig host create failed');
    const gigHost = await gigHostCreate.json();
    const gigGuestCreate = await post(`/api/rooms/${gigHost.code}/join`, { name: 'Gig Guest' });
    assert(gigGuestCreate.ok, 'Cyberpunk Gig guest join failed');
    const gigGuest = await gigGuestCreate.json();
    const gigDice = [4, 6, 8, 10, 12, 20].flatMap(sides => [
      { id: `host-d${sides}`, origin: 'host', owner: 'host', sides, value: 0 },
      { id: `guest-d${sides}`, origin: 'guest', owner: 'guest', sides, value: 0 }
    ]);
    const zeroGigSignal = await post('/api/signal', {
      room: gigHost.code,
      from: gigHost.peerId,
      to: gigGuest.peerId,
      type: 'gig-state',
      payload: { dice: gigDice, source: 'manual-reset' }
    }, { token: gigHost.sessionToken });
    assert(zeroGigSignal.ok, 'Server rejected synchronized zero Gig state');

    console.log('INTEGRATION_OK_TCGATE_ALPHA_0.1_CANDIDATE_11');
  } catch (err) {
    console.error(err.stack || err.message || err);
    process.exitCode = 1;
  } finally {
    server.kill('SIGTERM');
    setTimeout(() => server.kill('SIGKILL'), 1000).unref();
  }
})();
