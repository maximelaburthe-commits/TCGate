'use strict';

const { spawn } = require('child_process');
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
    const health = await waitForHealth();
    assert(health.version === 'tcgate-alpha-0.1-candidate-12', 'Wrong health version');

    const noRecovery = await fetch(`${BASE}/api/recovery-state`);
    assert(noRecovery.ok && (await noRecovery.json()).available === false, 'Recovery should be absent without cookie');

    const swuCreate = await post('/api/rooms', { name: 'SWU Host', game: 'star-wars-unlimited' });
    assert(swuCreate.status === 201, 'SWU must be accepted on the development branch');
    const swu = await swuCreate.json();
    assert(swu.room.game === 'star-wars-unlimited', 'SWU room game was not preserved');
    const swuGuestCreate = await post(`/api/rooms/${swu.code}/join`, { name: 'SWU Guest' });
    assert(swuGuestCreate.ok, 'SWU guest join failed');
    const swuGuest = await swuGuestCreate.json();
    assert(swuGuest.room.game === 'star-wars-unlimited', 'SWU guest did not receive the room game');
    const swuResume = await post('/api/resume', { room: swu.code, peerId: swu.peerId }, { token: swu.sessionToken });
    assert(swuResume.ok, 'SWU Core session resume failed');
    assert((await swuResume.json()).room.game === 'star-wars-unlimited', 'SWU game was not preserved on resume');
    const swuGigSignal = await post('/api/signal', { room: swu.code, from: swu.peerId, to: swuGuest.peerId, type: 'gig-state', payload: { dice: [] } }, { token: swu.sessionToken });
    assert(swuGigSignal.ok, 'Unexpected SWU gig-state must not crash the Core');

    const unknownGameCreate = await post('/api/rooms', { name: 'Fallback Host', game: 'unknown-game' });
    assert(unknownGameCreate.status === 201, 'Unknown game fallback room creation failed');
    assert((await unknownGameCreate.json()).room.game === 'cyberpunk', 'Unknown games must retain the Cyberpunk fallback');

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

    console.log('INTEGRATION_OK_TCGATE_ALPHA_0.1_CANDIDATE_12');
  } catch (err) {
    console.error(err.stack || err.message || err);
    process.exitCode = 1;
  } finally {
    server.kill('SIGTERM');
    setTimeout(() => server.kill('SIGKILL'), 1000).unref();
  }
})();
