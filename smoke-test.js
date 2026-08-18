
'use strict';
const fs=require('fs');

for(const f of [
  'public/index.html',
  'public/styles.css',
  'public/app.js',
  'public/vision-core.js',
  'public/vision-calibration.js',
  'public/detection-worker.js',
  'public/identification.js',
  'public/identification-worker.js',
  'public/cards-fallback.json',
  'models/card_detector_v53_512.onnx',
  'server.js',
  'railway.json'
]){
  if(!fs.existsSync(f)) throw new Error(`Missing ${f}`);
}

const html=fs.readFileSync('public/index.html','utf8');
for(const id of [
  'remoteVideo','visionOverlay','opponentFeed',
  'identificationToggle','identEmpty','identResult','identImage',
  'fullscreenIdentImage','modalCardImage',
  'visionStatus','calibrationStatus'
]){
  if(!html.includes(`id="${id}"`)) throw new Error(`Missing DOM ${id}`);
}

const app=fs.readFileSync('public/app.js','utf8');
for(const token of [
  'attachVisionToRemoteStream',
  'TCGVisionEngine',
  'TCGVisionCalibration',
  'tcg-identification-result',
  "scope: 'opponent-stream-only'"
]){
  if(!app.includes(token)) throw new Error(`Missing product token ${token}`);
}

const core=fs.readFileSync('public/vision-core.js','utf8');
for(const token of [
  "videoStage: $('opponentFeed')",
  "video: $('remoteVideo')",
  "overlay: $('visionOverlay')",
  'attachExternalStream',
  'debugOverlay: false',
  'modelInputSize:512',
  'secondaryOverlapTracks',
  'OVERLAP_PROBE_ENABLED'
]){
  if(!core.includes(token)) throw new Error(`Missing core token ${token}`);
}

const ident=fs.readFileSync('public/identification.js','utf8');
for(const token of [
  'startProductIdentification',
  'object-fit: contain',
  'tcg-identification-result',
  'temporalIdentityGuard',
  'overlapProbeContext',
  'RISKY_ACQUISITION_CONFIRMATIONS',
  'IDENTITY_SWITCH_CONFIRMATIONS',
  'tcg-identification-stability'
]){
  if(!ident.includes(token)) throw new Error(`Missing identification token ${token}`);
}

const modelSize=fs.statSync('models/card_detector_v53_512.onnx').size;
if(modelSize<5_000_000) throw new Error(`Model too small ${modelSize}`);

for(const [file,tokens] of Object.entries({
  'public/vision-core.js':['tcg-vision-geometry','strictSoloWeakCandidate','spatialStats'],
  'public/identification.js':['analyzeCropQuality','glare-high','pointerMissHeatmap','choosePrimaryTrack','pointInProbeExposedStrip','pointerArbitration'],
  'public/vision-calibration.js':['consecutiveLightingOutliers','ignoredBlankMonitorFrames']
})){
  const text=fs.readFileSync(file,'utf8');
  for(const token of tokens){
    if(!text.includes(token)) throw new Error(`Missing ${token} in ${file}`);
  }
}
console.log('SMOKE_OK_V0.6.3.4');
