'use strict';
const fs = require('fs');
const crypto = require('crypto');

const app = fs.readFileSync('public/app.js','utf8');
const css = fs.readFileSync('public/tcgate-alpha.css','utf8');
const server = fs.readFileSync('server.js','utf8');

for (const token of [
  "TCGate Alpha 0.1 Candidate 11 · UI 1.0.4",
  'rtcPeerCreatePromise',
  'rtcCreateEpoch',
  'rtcPeerGeneration',
  'candidateMatchesRemoteDescription',
  'rtc-candidate-buffered',
  'rtc-candidate-stale-ignored',
  'rtc-stale-track-ignored',
  'playRemoteVideoForPeer',
  'waitForFreshRemoteVideoFrames',
  'vision-resume-start',
  'vision-resume-success',
  'remote-camera-recovering',
  "tcgate.alpha.gig-panel-position.v3",
  'gigPanelWouldOverlapLocalPip'
]) {
  if (!app.includes(token)) throw new Error(`Missing Candidate 11 app token: ${token}`);
}

for (const token of [
  'Candidate 11 · UI 1.0.4 corrective',
  '@media (min-width:901px) and (max-height:760px)',
  '.tcgate-gig-drag-handle:hover',
  'border-radius:0 !important',
  '.opponent-feed-card:fullscreen .tcgate-gig-panel.is-fullscreen'
]) {
  if (!css.includes(token)) throw new Error(`Missing Candidate 11 CSS token: ${token}`);
}


const ensureStart = app.indexOf('async function ensurePeerConnection()');
const promiseCheck = app.indexOf('if (state.rtcPeerCreatePromise)', ensureStart);
const pcCheck = app.indexOf('if (state.pc) return state.pc;', ensureStart);
if (!(ensureStart >= 0 && promiseCheck > ensureStart && pcCheck > promiseCheck)) {
  throw new Error('RTC creation lock must be checked before returning a partially-created PeerConnection');
}
const handleStart = app.indexOf('async function handleSignal(signal)');
const candidateBranch = app.indexOf("if (signal.type === 'candidate')", handleStart);
const ensureInHandle = app.indexOf('const pc = await ensurePeerConnection();', candidateBranch);
if (!(candidateBranch > handleStart && ensureInHandle > candidateBranch)) {
  throw new Error('ICE candidates must be buffered before ensurePeerConnection can be invoked');
}

if (!server.includes("const VERSION = 'tcgate-alpha-0.1-candidate-11'")) {
  throw new Error('Candidate 11 server version missing');
}

// Candidate 11 may orchestrate Vision, but the frozen Vision files themselves must remain byte-identical.
const expected = {
  'models/card_detector_v53_512.onnx':'2db35aef3aceff955d7055180b3f21b33255920ab0a9a1fdcbb0e320a8276319',
  'public/detection-worker.js':'e749551f11065a03bd2cfc75577f23c4ece893a2c7d08bc82a341b2a35619b7a',
  'public/table-state-engine.js':'7ad3e427e2ba2181d5ab74e4ad8d68b855144e5d6901c6fdf58cdc36263cdd04',
  'public/vision-core.js':'520981919521befdf9b80e7432ca3ac885c846768a274d4a5456f771e63f68e6',
  'public/identification.js':'92c8f946c4429c5979f0374f14c837436cb46cf6baf8c564d961589fbd844f35'
};
for (const [file,want] of Object.entries(expected)) {
  const got = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  if (got !== want) throw new Error(`Frozen Vision changed: ${file}`);
}
console.log('SMOKE_OK_TCGATE_ALPHA_0.1_CANDIDATE_11');
