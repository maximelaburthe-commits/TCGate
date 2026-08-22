'use strict';
const fs=require('fs');
const crypto=require('crypto');

const required=[
  'public/index.html','public/styles.css','public/tcgate-alpha.css','public/app.js',
  'public/assets/tcgate-logo-final.png','public/assets/tcgate-mark.svg',
  'public/vision-core.js','public/vision-calibration.js','public/detection-worker.js',
  'public/table-state-bridge.js','public/table-state-engine.js',
  'public/identification.js','public/identification-worker.js','public/cards-fallback.json',
  'models/card_detector_v53_512.onnx','server.js','railway.json',
  'PLAN_TEST_ALPHA_0.1_CANDIDATE_8.md','CHANGELOG_TCGATE_ALPHA_0.1_CANDIDATE_8.md'
];
for(const f of required){ if(!fs.existsSync(f)) throw new Error(`Missing ${f}`); }

const html=fs.readFileSync('public/index.html','utf8');
for(const id of [
  'remoteVideo','visionOverlay','opponentFeed','identificationToggle','identEmpty','identResult','identImage',
  'fullscreenIdentImage','modalCardImage','visionStatus','calibrationStatus','visionStateStatus',
  'generateReportLobby','generateReportGame','feedbackMissedCard','feedbackWrongCard'
]){
  if(!html.includes(`id="${id}"`)) throw new Error(`Missing DOM ${id}`);
}
for(const token of ['TCGate','tcgate-logo-final.png','Sans jeu · webcam uniquement','tcgate-alpha.css']){
  if(!html.includes(token)) throw new Error(`Missing HTML token ${token}`);
}

if(!html.includes('id="roomCodeInput" maxlength="12" placeholder="Ex. R9K2MX" autocomplete="off"')) throw new Error('Room code autocomplete protection missing');

const app=fs.readFileSync('public/app.js','utf8');
for(const token of [
  'attachVisionToRemoteStream','TCGVisionEngine','TCGVisionCalibration','TCGTableStateEngine',
  'tcg-identification-visible','tcg-identification-visible-cleared','tcg-table-hover-hit',
  "scope: 'opponent-stream-only'",'TCGate Alpha 0.1 Candidate 8','captureTesterVisionFeedback',
  "degradationPreference = 'maintain-resolution'",'updateRtcCpuQualityControl',
  'setVisionCpuThrottle','qualityLimitationDurations','audio-only-recovery',
  'recovered-audio-video-','qualityControl: rtcQualitySummary()',
  'sendCurrentMediaState','applyRemoteMediaState',"signal.type === 'media-state'",'remoteMediaState',
  'adaptLocalCaptureForCpu','capture720Constraints','applyConstraints','acquireReplacement720Track','replaceLocalVideoTrack','captureAdaptiveMode','captureAdaptationAttempts','rtc-local-capture-adaptation','rtc-cpu-protect-video',
  'prewarmRtcInLobby','readyRequestPending','readyRequestedValue','ready-click','ready-ack','rtc-prewarm-start','rtc-prewarm-end','Attente de l’adversaire…',
  'ready-state-poll-start','pollRoomStateOnce','/state?peer=','waiting-state','visionEnabledForCurrentGame','ensureVisionAssets','VISION_ASSETS','no-game','assetsLoaded','disabledReason',
  'loadRtcConfig','/api/rtc-config?room=','rtcConfiguration','bitrateKbps','resetReportSession','rtc-config-loaded'
]){
  if(!app.includes(token)) throw new Error(`Missing Candidate 6 app token ${token}`);
}
if(app.includes("const PRODUCT_VERSION = 'TCGate Alpha 0.1 Candidate 1'")) throw new Error('Candidate 1 product version still active');


for(const src of ['/vision-core.js','/vision-calibration.js','/table-state-bridge.js','/identification.js','/table-state-engine.js']){
  if(html.includes(`<script src="${src}"></script>`)) throw new Error(`Vision script must not be statically loaded: ${src}`);
}
if(!app.includes("'/vision-core.js'") || !app.includes("'/identification.js'")) throw new Error('Dynamic Vision asset list missing');

const core=fs.readFileSync('public/vision-core.js','utf8');
for(const token of [
  "videoStage: $('opponentFeed')","video: $('remoteVideo')","overlay: $('visionOverlay')",
  'attachExternalStream','debugOverlay: false','modelInputSize:512',
  'productThrottleMs','effectiveInferenceDelay','setPerformanceThrottle','setInputPaused','inputPaused','inputPauseReason',
  "version:'0.6.1-product-bridge-alpha21-media-aware-cpu-budget'"
]){
  if(!core.includes(token)) throw new Error(`Missing core token ${token}`);
}

const ident=fs.readFileSync('public/identification.js','utf8');
for(const token of [
  'HOVER_CACHE_MAX_INSTANT_AGE_MS','HOVER_CACHE_INSTANT_APPEARANCE_MIN','HOVER_CACHE_VERIFY_DELAY_MS',
  '-glare-rescued-strict','showMemoryIdentity','clearVisibleForHandoff','setHdImageAtomic',
  'tcg-identification-visible-cleared','clearDeduplicated','clearCommitted','handoffCommitted','handoffDeduplicated',
  "version: '0.2.4-alpha21-full-handoff-dedup-memory-api'"
]){
  if(!ident.includes(token)) throw new Error(`Missing identification token ${token}`);
}

const table=fs.readFileSync('public/table-state-engine.js','utf8');
for(const token of [
  "VERSION = '0.1.6-facewebcam-memory-hover'",'SHADOW_MODE = false','hoverMemoryHits',
  'visibleMemoryRenders','visibleHandoffClears','identityAssistedReacquire','replacementsConfirmed'
]){
  if(!table.includes(token)) throw new Error(`Missing table-state token ${token}`);
}

const server=fs.readFileSync('server.js','utf8');
for(const token of [
  "version: 'tcgate-alpha-0.1-candidate-8'",
  "identification: '0.2.4-alpha21-full-handoff-dedup-memory-api'",
  'TCGate Alpha 0.1 Candidate 8',
  "ALLOWED_GAMES = new Set(['cyberpunk', 'no-game'])",
  '/state$',
  'roomSnapshot(room)',
  '/api/rtc-config',
  'CLOUDFLARE_TURN_KEY_ID',
  'CLOUDFLARE_TURN_KEY_API_TOKEN',
  'generateCloudflareTurnIceServers',
  'cloudflare-realtime-turn',
  'TCGATE_ICE_TRANSPORT_POLICY'
]){
  if(!server.includes(token)) throw new Error(`Missing server token ${token}`);
}

const modelSize=fs.statSync('models/card_detector_v53_512.onnx').size;
if(modelSize<5_000_000) throw new Error(`Model too small ${modelSize}`);

const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const expectedModel='2db35aef3aceff955d7055180b3f21b33255920ab0a9a1fdcbb0e320a8276319';
const expectedWorker='e749551f11065a03bd2cfc75577f23c4ece893a2c7d08bc82a341b2a35619b7a';
const expectedTable='7ad3e427e2ba2181d5ab74e4ad8d68b855144e5d6901c6fdf58cdc36263cdd04';
const expectedCore='520981919521befdf9b80e7432ca3ac885c846768a274d4a5456f771e63f68e6';
const expectedIdentification='92c8f946c4429c5979f0374f14c837436cb46cf6baf8c564d961589fbd844f35';
if(hash('models/card_detector_v53_512.onnx')!==expectedModel) throw new Error('Detector model changed');
if(hash('public/detection-worker.js')!==expectedWorker) throw new Error('Detection worker changed');
if(hash('public/table-state-engine.js')!==expectedTable) throw new Error('Vision State engine changed');
if(hash('public/vision-core.js')!==expectedCore) throw new Error('Vision core changed');
if(hash('public/identification.js')!==expectedIdentification) throw new Error('Identification changed');

console.log('SMOKE_OK_TCGATE_ALPHA_0.1_CANDIDATE_8');
console.log('MODEL_SHA256='+hash('models/card_detector_v53_512.onnx'));
console.log('DETECTION_WORKER_SHA256='+hash('public/detection-worker.js'));
console.log('TABLE_STATE_SHA256='+hash('public/table-state-engine.js'));
console.log('VISION_CORE_SHA256='+hash('public/vision-core.js'));
console.log('IDENTIFICATION_SHA256='+hash('public/identification.js'));
