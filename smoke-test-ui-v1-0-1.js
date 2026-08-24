'use strict';
const fs = require('fs');
const path = require('path');
const root = __dirname;
const app = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public/tcgate-alpha.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
const requiredAssets = [4,6,8,10,12,20].flatMap(s => [
  `public/assets/dice/self/D${s}.svg`,
  `public/assets/dice/opponent/D${s}.svg`
]);
for (const file of requiredAssets) {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing ${file}`);
}
const requiredApp = [
  'tcgate-die-icon',
  "sendSignal('gig-state'",
  'gigDiceEnabledForCurrentGame',
  'beginDieDrag',
  'moveGigPanelForFullscreen'
];
for (const token of requiredApp) if (!app.includes(token)) throw new Error(`Missing app token: ${token}`);
const requiredCss = [
  'grid-template-columns:minmax(0,1fr) 214px',
  '.tcgate-die-icon',
  '#cardModal .modal-card-name { display:none !important; }',
  '.opponent-feed-card:fullscreen .tcgate-feed-actions',
  '.game-screen .tcgate-card-inspector'
];
for (const token of requiredCss) if (!css.includes(token)) throw new Error(`Missing CSS token: ${token}`);
for (const id of ['displayCardPanel','displayCardSlot','gigDicePanel','fullscreenMic','fullscreenCam','fullscreenOpponent']) {
  if (!html.includes(`id="${id}"`)) throw new Error(`Missing HTML id ${id}`);
}
console.log('SMOKE_OK_TCGATE_UI_1_0_1_CORRECTIVE');
