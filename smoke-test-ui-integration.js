'use strict';
const fs=require('fs');
const crypto=require('crypto');
const childProcess=require('child_process');

const html=fs.readFileSync('public/index.html','utf8');
const app=fs.readFileSync('public/app.js','utf8');
const css=fs.readFileSync('public/tcgate-alpha.css','utf8');

for(const token of [
  'tcgate-home-shell','home-portal-art-crop.png','tcgate-home-steps',
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
const hash=(f,want=null)=>{const digest=value=>crypto.createHash('sha256').update(value).digest('hex'),raw=digest(fs.readFileSync(f));return !want||raw===want?raw:digest(childProcess.execFileSync('git',['show',`HEAD:${f}`],{maxBuffer:64*1024*1024}));};
const expected={
  'models/card_detector_v53_512.onnx':'2db35aef3aceff955d7055180b3f21b33255920ab0a9a1fdcbb0e320a8276319',
  'public/detection-worker.js':'e749551f11065a03bd2cfc75577f23c4ece893a2c7d08bc82a341b2a35619b7a',
  'public/table-state-engine.js':'7ad3e427e2ba2181d5ab74e4ad8d68b855144e5d6901c6fdf58cdc36263cdd04',
  'public/vision-core.js':'520981919521befdf9b80e7432ca3ac885c846768a274d4a5456f771e63f68e6',
  'public/identification.js':'d5ec154d9f79aa346a036210b096b0b10b461aa5cfaf9410ddb27df7e8eb6ec4'
};
for(const [file,want] of Object.entries(expected)){
  const got=hash(file,want);
  if(got!==want) throw new Error(`Vision baseline changed: ${file}`);
}

console.log('SMOKE_OK_TCGATE_C9_UI_INTEGRATION_1');
