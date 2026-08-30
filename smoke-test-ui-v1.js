'use strict';
const fs=require('fs');
const crypto=require('crypto');
const childProcess=require('child_process');

const html=fs.readFileSync('public/index.html','utf8');
const app=fs.readFileSync('public/app.js','utf8');
const css=fs.readFileSync('public/tcgate-alpha.css','utf8');
const server=fs.readFileSync('server.js','utf8');

for(const token of [
  'gigDicePanel','gigDiceDragHandle','gigSelfDice','gigOpponentDice','gigSelfCred','gigOpponentCred',
  'toggleLocalPreview','restoreLocalFeed','local-feed-visibility','game-specific-cyberpunk'
]) if(!html.includes(token)) throw new Error(`Missing UI 1.0 HTML token: ${token}`);

for(const token of [
  'gigDiceEnabledForCurrentGame','createGigDiceState','renderGigDicePanel','changeDieValue','transferDie',
  'beginDieDrag','updateDieDrag','finishDieDrag','moveGigPanelForFullscreen','setupDraggableGigPanel',
  "sendSignal('gig-state'", "signal.type === 'gig-state'", 'localPreviewVisible', 'preview-hidden',
  "TCGateGameRegistry.supports(state.game, 'gigDice')"
]) if(!app.includes(token)) throw new Error(`Missing UI 1.0 behavior: ${token}`);

for(const token of [
  '.tcgate-gig-panel','.tcgate-gig-side-self','.tcgate-gig-side-opp','.tcgate-die-shape',
  '.tcgate-die-drag-ghost','.local-feed-visibility','.tcgate-local-pip.preview-hidden',
  '.opponent-feed-card:fullscreen .tcgate-feed-actions',
  '.opponent-feed-card:fullscreen .tcgate-fullscreen-card.expanded'
]) if(!css.includes(token)) throw new Error(`Missing UI 1.0 CSS token: ${token}`);

for(const side of [4,6,8,10,12,20]) {
  const path=`public/assets/dice/D${side}.svg`;
  if(!fs.existsSync(path)) throw new Error(`Missing real dice asset: ${path}`);
  const svg=fs.readFileSync(path,'utf8');
  if(!svg.includes('<svg')) throw new Error(`Invalid dice SVG: ${path}`);
}

if(!server.includes("'gig-state'")) throw new Error('Server gig-state signal not enabled');
if(!server.includes("if (type === 'gig-state')")) throw new Error('Server gig-state validation missing');

// Real media/Vision elements must remain unique.
for(const id of ['remoteVideo','localVideo','visionOverlay']) {
  const count=(html.match(new RegExp(`id="${id}"`,'g'))||[]).length;
  if(count!==1) throw new Error(`Expected exactly one ${id}, found ${count}`);
}

// Vision baseline must remain byte-identical to Candidate 9.
const hash=(f,want=null)=>{const digest=value=>crypto.createHash('sha256').update(value).digest('hex'),raw=digest(fs.readFileSync(f));return !want||raw===want?raw:digest(childProcess.execFileSync('git',['show',`HEAD:${f}`],{maxBuffer:64*1024*1024}));};
const expected={
  'models/card_detector_v53_512.onnx':'2db35aef3aceff955d7055180b3f21b33255920ab0a9a1fdcbb0e320a8276319',
  'public/detection-worker.js':'e749551f11065a03bd2cfc75577f23c4ece893a2c7d08bc82a341b2a35619b7a',
  'public/table-state-engine.js':'7ad3e427e2ba2181d5ab74e4ad8d68b855144e5d6901c6fdf58cdc36263cdd04',
  'public/vision-core.js':'520981919521befdf9b80e7432ca3ac885c846768a274d4a5456f771e63f68e6',
  'public/identification.js':'d5ec154d9f79aa346a036210b096b0b10b461aa5cfaf9410ddb27df7e8eb6ec4'
};
for(const [file,want] of Object.entries(expected)) {
  const got=hash(file,want);
  if(got!==want) throw new Error(`Vision baseline changed: ${file}`);
}

console.log('SMOKE_OK_TCGATE_UI_1_0_PLATFORM');
