'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { TextDecoder } = require('util');
const cameraDevices = require('./public/phone-camera-devices.js');
const { PhoneCameraControlWaiter } = require('./public/phone-camera-control.js');

const PORT = 4331;
const BASE = `http://127.0.0.1:${PORT}`;
const child = spawn(process.execPath, ['server.js'], {
  cwd: __dirname,
  env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', TCGATE_PHONE_PAIRING_TTL_MS: '500' },
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
async function request(pathname, { method = 'GET', token = null, cookie = null, body, origin } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (cookie) headers.Cookie = cookie;
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
    const ownerCookie = String(result.response.headers.get('set-cookie') || '').split(';')[0];
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
    result = await request(`/api/phone/pairs/${pair.pairId}/state`, { method: 'POST', token: phoneToken, body: { state: { cameraActive: true, candidate: 'private', image: 'data:image/png;base64,abc', deviceId: 'raw-device-id', fps: 30 } } });
    assert(result.response.ok, 'phone state rejected');
    result = await request(`/api/phone/pairs/${pair.pairId}/state`, { token: owner.sessionToken });
    assert(result.json.state.fps === 30 && !('candidate' in result.json.state) && !('image' in result.json.state) && !('deviceId' in result.json.state), 'diagnostic sanitizer failed');
    result = await request(`/api/phone/pairs/${pair.pairId}/signal`, {
      method: 'POST',
      token: owner.sessionToken,
      body: { role: 'pc', type: 'control', payload: { requestId: 'camera-test-1', action: 'select-camera', args: { cameraId: 'camera-1' } } }
    });
    assert(result.response.ok, 'valid select-camera command rejected');
    result = await request(`/api/phone/pairs/${pair.pairId}/signal`, {
      method: 'POST',
      token: owner.sessionToken,
      body: { role: 'pc', type: 'control', payload: { requestId: 'camera-test-2', action: 'select-camera', args: { cameraId: 'raw-device-id' } } }
    });
    assert(result.response.status === 400, 'raw device id accepted by signaling');

    const recoveredResult = await request('/api/recover', { method: 'POST', cookie: ownerCookie });
    assert(recoveredResult.response.ok && recoveredResult.json.sessionToken !== owner.sessionToken, 'Candidate 11 recovery did not rotate PC bearer');
    const recoveredToken = recoveredResult.json.sessionToken;
    result = await request(`/api/phone/pairs/current?room=${owner.code}&peer=${owner.peerId}`, { token: recoveredToken });
    assert(result.response.ok && result.json.available && result.json.pairId === pair.pairId, 'same peer could not recover phone pair');
    assert(!JSON.stringify(result.json).includes(phoneToken) && !('phoneToken' in result.json), 'phone token exposed by recovery lookup');
    result = await request(`/api/phone/pairs/current?room=${owner.code}&peer=${owner.peerId}`, { token: otherOwner.sessionToken });
    assert(result.response.status === 401, 'another peer recovered phone pair');

    result = await request(`/api/phone/pairs/${pair.pairId}`, { method: 'DELETE', token: recoveredToken });
    assert(result.response.ok, 'dissociation failed');

    result = await request('/api/phone/pairs', { method: 'POST', token: recoveredToken, body: { room: owner.code, peerId: owner.peerId } });
    const expiring = result.json;
    const expiringToken = new URL(expiring.phoneUrl).searchParams.get('token');
    await sleep(550);
    result = await request(`/api/phone/pairs/${expiring.pairId}/join`, { method: 'POST', token: expiringToken });
    assert([404, 410].includes(result.response.status), 'expired pairing token accepted');

    result = await request('/api/phone/pairs', { method: 'POST', token: recoveredToken, origin: 'https://evil.invalid', body: { room: owner.code, peerId: owner.peerId } });
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

    const phoneFiles = [
      'public/phone.html',
  'public/phone-camera-client.js',
  'public/phone-camera.js',
  'public/phone-camera-control.js',
  'public/phone-camera.css',
      'public/phone-camera-devices.js'
    ];
    for (const file of phoneFiles) {
      const bytes = fs.readFileSync(path.join(__dirname, file));
      const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      assert(!/[\uFFFD]|Ã|Â|â€|ðŸ/.test(text), `mojibake detected in ${file}`);
    }

    const mockCameras = [
      { kind: 'videoinput', deviceId: 'front-secret', label: 'Front Camera' },
      { kind: 'videoinput', deviceId: 'wide-secret', label: 'Back Camera' },
      { kind: 'videoinput', deviceId: 'ultra-secret', label: 'Ultra Wide Camera' },
      { kind: 'audioinput', deviceId: 'audio-secret', label: 'Microphone' }
    ];
    const publicList = cameraDevices.publicCameraList(mockCameras, 'wide-secret');
    assert(publicList.length === 2, 'front camera was not filtered when rear cameras exist');
    assert(publicList[0].id === 'camera-1' && publicList[0].active, 'active opaque camera id missing');
    assert(publicList[1].label === 'Ultra grand-angle', 'reliable ultra-wide label not exposed');
    assert(!JSON.stringify(publicList).includes('secret'), 'raw deviceId leaked in public camera list');
    const oneCamera = cameraDevices.publicCameraList([{ kind: 'videoinput', deviceId: 'only-secret', label: '' }], 'only-secret');
    assert(oneCamera.length === 1 && oneCamera[0].label === 'Caméra principale', 'single camera fallback label invalid');
    const unknownCameras = cameraDevices.publicCameraList([
      { kind: 'videoinput', deviceId: 'a-secret', label: '' },
      { kind: 'videoinput', deviceId: 'b-secret', label: '' }
    ]);
    assert(unknownCameras.map(camera => camera.label).join('|') === 'Caméra arrière 1|Caméra arrière 2', 'neutral fallback labels invalid');
    assert(cameraDevices.resolveOpaqueCamera(mockCameras.slice(1, 3), 'camera-2')?.deviceId === 'ultra-secret', 'known opaque camera id rejected');
    assert(cameraDevices.resolveOpaqueCamera(mockCameras.slice(1, 3), 'camera-9') === null, 'unknown opaque camera id accepted');

    const order = [];
    const oldTrack = { stop: () => order.push('stop-old') };
    const newTrack = {};
    const sender = { replaceTrack: async track => { assert(track === newTrack, 'wrong replacement track'); order.push('replace'); } };
    await cameraDevices.replaceTrackSafely(sender, oldTrack, newTrack);
    assert(order.join('|') === 'replace|stop-old', 'old track stopped before successful replaceTrack');
    let stoppedAfterFailure = false;
    await cameraDevices.replaceTrackSafely({ replaceTrack: async () => { throw new Error('replace failed'); } }, { stop: () => { stoppedAfterFailure = true; } }, {}).catch(() => {});
    assert(!stoppedAfterFailure, 'old track stopped after failed replaceTrack');

    const seamlessOrder = [];
    const seamless = await cameraDevices.runCameraSwitch({
      acquireTarget: async () => ({ stream: {}, track: {} }),
      activateTarget: async target => { seamlessOrder.push('activate-new'); assert(target.track, 'target track missing'); },
      stopCurrent: () => seamlessOrder.push('stop-current'),
      acquirePrevious: async () => ({}),
      activatePrevious: async () => {},
    });
    assert(seamless.strategy === 'seamless' && seamlessOrder.join('|') === 'activate-new', 'seamless camera strategy failed');

    const fallbackOrder = [];
    let fallbackAttempts = 0;
    const fallback = await cameraDevices.runCameraSwitch({
      acquireTarget: async () => {
        fallbackAttempts += 1;
        if (fallbackAttempts === 1) throw Object.assign(new Error('camera occupied'), { name: 'NotReadableError' });
        fallbackOrder.push('acquire-after-stop');
        return { stream: {}, track: {} };
      },
      activateTarget: async () => fallbackOrder.push('activate-new'),
      stopCurrent: () => fallbackOrder.push('stop-old'),
      acquirePrevious: async () => ({}),
      activatePrevious: async () => {},
    });
    assert(fallback.strategy === 'controlled-handoff' && fallbackOrder.join('|') === 'stop-old|acquire-after-stop|activate-new', 'controlled mobile fallback failed');

    const rollbackOrder = [];
    let rollbackAttempts = 0;
    const rollbackError = await cameraDevices.runCameraSwitch({
      acquireTarget: async () => {
        rollbackAttempts += 1;
        throw Object.assign(new Error(rollbackAttempts === 1 ? 'occupied' : 'new unavailable'), { name: rollbackAttempts === 1 ? 'AbortError' : 'NotFoundError' });
      },
      activateTarget: async () => {},
      stopCurrent: () => rollbackOrder.push('stop-old'),
      acquirePrevious: async () => { rollbackOrder.push('reopen-old'); return { stream: {}, track: {} }; },
      activatePrevious: async () => rollbackOrder.push('restore-old'),
    }).catch(error => error);
    assert(rollbackError.rollbackRestored === true && rollbackOrder.join('|') === 'stop-old|reopen-old|restore-old', 'camera rollback failed');

    const controls = new PhoneCameraControlWaiter(25);
    const confirmed = controls.wait('success-1');
    controls.settle({ requestId: 'success-1', ok: true, state: { selectedCameraId: 'camera-2' } });
    assert((await confirmed).state.selectedCameraId === 'camera-2', 'PC did not wait for successful control-result');
    const rejected = controls.wait('failure-1');
    controls.settle({ requestId: 'failure-1', ok: false, error: 'NotReadableError', errorName: 'NotReadableError' });
    assert((await rejected.catch(error => error)).name === 'NotReadableError', 'phone control error not propagated');
    const timedOut = await controls.wait('timeout-1').catch(error => error);
    assert(timedOut.name === 'TimeoutError', 'phone control timeout missing');
    const pcPhoneSource = fs.readFileSync(path.join(__dirname, 'public', 'phone-camera.js'), 'utf8');
    assert(/restoreCurrent/.test(pcPhoneSource) && /restart-request/.test(pcPhoneSource) && /connectEvents/.test(pcPhoneSource), 'PC phone receiver/SSE recovery missing');
    assert((appSource.match(/restorePhoneCameraAfterRecovery\(\)/g) || []).length >= 3, 'Phone Camera recovery is not used by both Candidate 11 recovery paths');
    const webcamReturn = appSource.slice(appSource.indexOf('async function returnToPcWebcam'), appSource.indexOf('function updateGameDeviceStatus'));
    assert(!/\.disconnect\?\./.test(webcamReturn) && /videoSource = 'webcam'/.test(webcamReturn), 'returning to PC webcam dissociates the phone');
    assert(/preservePhoneTrack/.test(appSource) && /!preservePhoneTrack/.test(appSource), 'phone receiver track is stopped when switching to PC webcam');
    assert(/usePhoneSource/.test(pcPhoneSource) && /reusePhoneCamera/.test(appSource), 'switching back to the paired phone source is missing');
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
