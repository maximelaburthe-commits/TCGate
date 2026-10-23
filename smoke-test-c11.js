'use strict';
const fs = require('fs');
const crypto = require('crypto');
const { assertCandidateMetadata } = require('./candidate-metadata-test-utils.js');
const metadata = assertCandidateMetadata();

const app = fs.readFileSync('public/app.js','utf8');
const css = [
  'public/tcgate-alpha.css',
  'public/tcgate-alpha-ui-1.0.5.css',
  'public/future-ux-v3.7.css'
].map(file => fs.readFileSync(file,'utf8')).join('\n');
const server = fs.readFileSync('server.js','utf8');

for (const token of [
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

// Candidate 11 may orchestrate Vision, but the frozen Vision files themselves must remain byte-identical.
const expected = {
  'models/card_detector_v53_512.onnx':'2db35aef3aceff955d7055180b3f21b33255920ab0a9a1fdcbb0e320a8276319',
  'public/detection-worker.js':'19d0e72eeb620f23742a9b8fe321f700c45cbd29ad41b952d115bca5fd983227',
  'public/table-state-engine.js':'59c7bf98827abb69eba68e685377dde0ef46bff8349d53238a14ba6ea7b4c1f3',
  'public/vision-core.js':'f3cbd789476c92f86dd25292a67a0d0e96eee9888584a867c841b3b61e8650d1',
  'public/identification.js':'fa3b700ffd19f9726e5fe1b24c6f1bc56fd30de7f9ff0a813fdf986920028b15'
};
for (const [file,want] of Object.entries(expected)) {
  const got = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  if (got !== want) throw new Error(`Frozen Vision changed: ${file}`);
}
console.log(`SMOKE_OK_TCGATE_ALPHA_0.1_CANDIDATE_${metadata.candidate}_UI_${metadata.ui}`);
