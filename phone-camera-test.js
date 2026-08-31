'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = 4331;
const BASE = `http://127.0.0.1:${PORT}`;
const child = spawn(process.execPath, ['server.js'], {
  cwd: __dirname,
  env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', TCGATE_PHONE_PAIRING_TTL_MS: '120' },
  stdio: ['ignore', 'pipe', 'pipe']
});
let log = '';
child.stdout.on('data', chunk => { log += chunk; });
child.stderr.on('data', chunk => { log += chunk; });

function assert(value, message) { if (!value) throw new Error(message); }
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function wait() {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`${BASE}/api/health`)).ok) return; } catch {}
    await sleep(40);
  }
  throw new Error(`server unavailable: ${log}`);
}
async function request(pathname, { method = 'GET', token = null, body, origin } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (origin) headers.Origin = origin;
  const response = await fetch(`${BASE}${pathname}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { response, json: await response.json().catch(() => ({})) };
}

(async () => {
  try {
    await wait();
    const phonePage = await fetch(`${BASE}/phone`);
    assert(phonePage.status === 200 && (await phonePage.text()).includes('/phone-camera-client.js'), 'phone page unavailable');
    let result = await request('/api/rooms', { method: 'POST', body: { name: 'Phone owner', game: 'cyberpunk' } });
    assert(result.response.status === 201, 'room creation failed');
    const owner = result.json;
    const pcAuth = { token: owner.sessionToken };

    result = await request('/api/phone/pairs', { method: 'POST', ...pcAuth, body: { room: owner.code, peerId: owner.peerId } });
    assert(result.response.status === 201, 'pair creation failed');
    const pair = result.json;
    const parsed = new URL(pair.phoneUrl);
    const oneTimeToken = parsed.searchParams.get('token');
    assert(pair.pairId && pair.qrSvg.includes('<svg'), 'pair response incomplete');
    assert(oneTimeToken && oneTimeToken.length >= 40, 'pair token too short');
    assert(!pair.qrSvg.includes(owner.sessionToken), 'PC bearer leaked in QR');
    assert(!pair.phoneUrl.includes(owner.sessionToken), 'PC bearer leaked in phone URL');

    let other = await request('/api/rooms', { method: 'POST', body: { name: 'Other', game: 'no-game' } });
    const otherOwner = other.json;
    other = await request('/api/phone/pairs', { method: 'POST', token: otherOwner.sessionToken, body: { room: otherOwner.code, peerId: otherOwner.peerId } });
    const otherPair = other.json;
    result = await request(`/api/phone/pairs/${otherPair.pairId}/join`, { method: 'POST', token: oneTimeToken });
    assert(result.response.status === 401, 'token was usable for another peer');

    result = await request(`/api/phone/pairs/${pair.pairId}/join`, { method: 'POST', token: 'invalid' });
    assert(result.response.status === 401, 'invalid pairing token accepted');
    result = await request(`/api/phone/pairs/${pair.pairId}/join`, { method: 'POST', token: oneTimeToken });
    assert(result.response.ok && result.json.phoneToken, 'valid pairing token refused');
    const phoneToken = result.json.phoneToken;
    assert(phoneToken !== oneTimeToken, 'pair token reused as session token');
    result = await request(`/api/phone/pairs/${pair.pairId}/join`, { method: 'POST', token: oneTimeToken });
    assert(result.response.status === 409, 'one-time pairing token was reusable');

    result = await request('/api/ready', { method: 'POST', token: phoneToken, body: { room: owner.code, peerId: owner.peerId, ready: true } });
    assert(result.response.status === 401, 'phone token gained PC privileges');
    result = await request(`/api/phone/pairs/${pair.pairId}/signal`, { method: 'POST', token: phoneToken, body: { role: 'phone', type: 'offer', payload: { description: { type: 'offer', sdp: 42 } } } });
    assert(result.response.status === 400, 'invalid phone signal accepted');
    result = await request(`/api/phone/pairs/${pair.pairId}/state`, { method: 'POST', token: phoneToken, body: { state: { cameraActive: true, candidate: 'private', image: 'data:image/png;base64,abc', fps: 30 } } });
    assert(result.response.ok, 'phone state rejected');
    result = await request(`/api/phone/pairs/${pair.pairId}/state`, { token: owner.sessionToken });
    assert(result.json.state.fps === 30 && !('candidate' in result.json.state) && !('image' in result.json.state), 'diagnostic sanitizer failed');
    result = await request(`/api/phone/pairs/${pair.pairId}`, { method: 'DELETE', token: owner.sessionToken });
    assert(result.response.ok, 'dissociation failed');

    result = await request('/api/phone/pairs', { method: 'POST', token: owner.sessionToken, body: { room: owner.code, peerId: owner.peerId } });
    const expiring = result.json;
    const expiringToken = new URL(expiring.phoneUrl).searchParams.get('token');
    await sleep(160);
    result = await request(`/api/phone/pairs/${expiring.pairId}/join`, { method: 'POST', token: expiringToken });
    assert([404, 410].includes(result.response.status), 'expired pairing token accepted');

    result = await request('/api/phone/pairs', { method: 'POST', token: owner.sessionToken, origin: 'https://evil.invalid', body: { room: owner.code, peerId: owner.peerId } });
    assert(result.response.status === 403, 'cross-origin pairing accepted');

    let limited = await request('/api/rooms', { method: 'POST', body: { name: 'Limited', game: 'no-game' } });
    const limitedOwner = limited.json;
    for (let i = 0; i < 7; i++) {
      limited = await request('/api/phone/pairs', { method: 'POST', token: limitedOwner.sessionToken, body: { room: limitedOwner.code, peerId: limitedOwner.peerId } });
    }
    assert(limited.response.status === 429, 'phone pairing rate limit missing');

    const sources = ['server.js', 'public/phone-camera.js', 'public/phone-camera-client.js'].map(file => fs.readFileSync(path.join(__dirname, file), 'utf8')).join('\n');
    assert(!/MediaRecorder/.test(sources), 'MediaRecorder introduced');
    assert(!/api\/phone\/(upload|image|frame)/.test(sources), 'media upload route introduced');
    const appSource = fs.readFileSync(path.join(__dirname, 'public', 'app.js'), 'utf8');
    const phoneSource = fs.readFileSync(path.join(__dirname, 'public', 'phone-camera-client.js'), 'utf8');
    assert(/sender\.replaceTrack\(track\)/.test(appSource), 'phone track does not replace the player video sender');
    assert(/new MediaStream\(\[track, \.\.\.\(audio/.test(appSource), 'PC microphone is not preserved with phone video');
    assert(/audio:\s*false/.test(phoneSource), 'phone microphone may be captured');
    assert(/autoProfile:\s*'1280x720'/.test(phoneSource) && /frameRate:\s*\{ ideal:\s*30, max:\s*30 \}/.test(phoneSource), '720p30 default profile missing');
    assert(/Content-Security-Policy/.test(fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8')), 'security headers missing');
    assert(fs.existsSync(path.join(__dirname, 'report-mail-server.js')), 'email report server missing');
    assert(fs.existsSync(path.join(__dirname, 'public', 'identification.js')), 'Vision baseline missing');
    assert(!log.includes(oneTimeToken) && !log.includes(phoneToken) && !log.includes(owner.sessionToken), 'secret appeared in server logs');
    console.log('PHONE_CAMERA_INTEGRATION_OK');
  } finally {
    child.kill('SIGTERM');
  }
})().catch(error => {
  console.error(error.stack || error);
  console.error(log);
  child.kill('SIGTERM');
  process.exitCode = 1;
});
