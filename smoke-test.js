'use strict';
const fs=require('fs');
for(const f of [
  'public/index.html','public/styles.css','public/app.js','public/vision-core.js',
  'public/vision-calibration.js','public/detection-worker.js','public/identification.js',
  'public/identification-worker.js','public/cards-fallback.json',
  'models/card_detector_v53_512.onnx','server.js','railway.json'
]) if(!fs.existsSync(f)) throw new Error(`Missing ${f}`);

const core=fs.readFileSync('public/vision-core.js','utf8');
const worker=fs.readFileSync('public/detection-worker.js','utf8');
const ident=fs.readFileSync('public/identification.js','utf8');
const app=fs.readFileSync('public/app.js','utf8');
const server=fs.readFileSync('server.js','utf8');
for(const forbidden of ['OVERLAP_PROBE_ENABLED','secondaryOverlapTracks','overlapProbeCanonicalCanvas','pointInProbeExposedStrip','choosePrimaryTrack']){
  if(core.includes(forbidden) || ident.includes(forbidden)) throw new Error(`0.6.3.x residue: ${forbidden}`);
}
for(const forbidden of ['FORCED_PROVIDER','IS_CHROMIUM','visionProvider=webgpu','WebGPU · balanced']){
  if(worker.includes(forbidden)) throw new Error(`GPU recovery residue: ${forbidden}`);
}
if(!ident.includes('glare-decisive') || !ident.includes('decisiveHighOverrides')) throw new Error('Decisive glare fix missing');
if(!app.includes("version: '0.6.4.0'")) throw new Error('Report version missing');
if(!server.includes("version: '0.6.4.0'")) throw new Error('Server version missing');
if(fs.statSync('models/card_detector_v53_512.onnx').size<5_000_000) throw new Error('Model too small');
console.log('SMOKE_OK_V0.6.4.0_CLEAN_BASELINE');
