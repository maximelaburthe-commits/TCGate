'use strict';
const fs=require('fs');
const crypto=require('crypto');

const html=fs.readFileSync('public/index.html','utf8');
const app=fs.readFileSync('public/app.js','utf8');
require('./tcgate-ui-1.2-contract.js').assertHome(html);
require('./tcgate-ui-1.2-contract.js').assertGame(html,fs.readFileSync('public/future-ux-v3.7.js','utf8'));
const css=fs.readFileSync('public/tcgate-alpha.css','utf8');

for(const token of [
  'tcgate-home-shell','ui12-home-accueil','tcgate-home-steps',
  'tcgate-game-topbar','displayCardPanel','displayCardButton','displayCardImage',
  'tcgate-local-pip','fullscreenMic','fullscreenCam','fullscreenCardPreview',
  'remoteVideo','visionOverlay','localVideo'
]) if(!html.includes(token)) throw new Error(`Missing integrated UI token: ${token}`);

for(const token of [
  'CARD_DISPLAY_HIDE_DELAY_MS = 1200','scheduleVisibleCardClear','presentIdentifiedCard',
  "$('opponentFeed')?.addEventListener('pointerleave'",'toggleFullscreenCardZoom',
  "$('fullscreenMic')?.addEventListener", "$('displayCardButton')?.addEventListener"
]) if(!app.includes(token)) throw new Error(`Missing integrated UI behavior: ${token}`);

for(const token of [
  '.tcgate-home-hero','.tcgate-game-layout','.tcgate-local-pip','.tcgate-card-inspector',
  '.opponent-feed-card:fullscreen .tcgate-fullscreen-media',
  '.opponent-feed-card:fullscreen .tcgate-fullscreen-card.expanded'
]) if(!css.includes(token)) throw new Error(`Missing integrated UI CSS: ${token}`);

// There must be exactly one local video element: the same stream is reused in fullscreen.
const localVideoCount=(html.match(/id="localVideo"/g)||[]).length;
if(localVideoCount!==1) throw new Error(`Expected exactly one localVideo, found ${localVideoCount}`);

// Vision baseline must remain byte-identical to Candidate 9.
// Preserve the frozen no-provider production source hash; verify the explicit Lab-only hook separately.
const hash=f=>{const bytes=fs.readFileSync(f);return crypto.createHash('sha256').update(f==='public/identification.js'?require('./workspace-production-contract.js').productionIdentification(bytes):f==='public/table-state-engine.js'?require('./workspace-production-contract.js').productionTableState(bytes):bytes).digest('hex');};
const expected={
  'models/card_detector_v53_512.onnx':'2db35aef3aceff955d7055180b3f21b33255920ab0a9a1fdcbb0e320a8276319',
  'public/detection-worker.js':'19d0e72eeb620f23742a9b8fe321f700c45cbd29ad41b952d115bca5fd983227',
  'public/table-state-engine.js':'0b7c8c813bac73f528b9938a9cc2aae9c1bd2fcdc81dfc4748d940f2e795fcb3',
  'public/vision-core.js':'f3cbd789476c92f86dd25292a67a0d0e96eee9888584a867c841b3b61e8650d1',
  'public/identification.js':'e5593e42a8dfd60a4d81850fb76c518c4212302906a1cd655fb3901cf9e18071'
};
for(const [file,want] of Object.entries(expected)){
  const got=hash(file);
  if(got!==want) throw new Error(`Vision baseline changed: ${file}`);
}

console.log('SMOKE_OK_TCGATE_C9_UI_INTEGRATION_1');
