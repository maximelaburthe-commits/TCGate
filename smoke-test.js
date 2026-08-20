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
  'PLAN_TEST_ALPHA_0.1_CANDIDATE_1.md','CHANGELOG_TCGATE_ALPHA_0.1_CANDIDATE_1.md'
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
for(const token of ['TCGate','tcgate-logo-final.png','table-state-bridge.js','table-state-engine.js','tcgate-alpha.css']){
  if(!html.includes(token)) throw new Error(`Missing HTML token ${token}`);
}

const app=fs.readFileSync('public/app.js','utf8');
for(const token of [
  'attachVisionToRemoteStream','TCGVisionEngine','TCGVisionCalibration','TCGTableStateEngine',
  'tcg-identification-visible','tcg-identification-visible-cleared','tcg-table-hover-hit',
  "scope: 'opponent-stream-only'",'TCGate Alpha 0.1 Candidate 1','captureTesterVisionFeedback'
]){
  if(!app.includes(token)) throw new Error(`Missing app token ${token}`);
}

const core=fs.readFileSync('public/vision-core.js','utf8');
for(const token of [
  "videoStage: $('opponentFeed')","video: $('remoteVideo')","overlay: $('visionOverlay')",
  'attachExternalStream','debugOverlay: false','modelInputSize:512'
]){
  if(!core.includes(token)) throw new Error(`Missing core token ${token}`);
}

const ident=fs.readFileSync('public/identification.js','utf8');
for(const token of [
  'HOVER_CACHE_MAX_INSTANT_AGE_MS','HOVER_CACHE_INSTANT_APPEARANCE_MIN','HOVER_CACHE_VERIFY_DELAY_MS',
  '-glare-rescued-strict','showMemoryIdentity','clearVisibleForHandoff','setHdImageAtomic',
  'tcg-identification-visible-cleared'
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

const modelSize=fs.statSync('models/card_detector_v53_512.onnx').size;
if(modelSize<5_000_000) throw new Error(`Model too small ${modelSize}`);

const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
console.log('SMOKE_OK_TCGATE_ALPHA_0.1_CANDIDATE_1');
console.log('MODEL_SHA256='+hash('models/card_detector_v53_512.onnx'));
console.log('VISION_CORE_SHA256='+hash('public/vision-core.js'));
console.log('DETECTION_WORKER_SHA256='+hash('public/detection-worker.js'));
