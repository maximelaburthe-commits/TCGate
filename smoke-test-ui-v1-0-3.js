'use strict';
const fs = require('fs');
const app = fs.readFileSync('public/app.js','utf8');
const css = fs.readFileSync('public/tcgate-alpha.css','utf8');
for (const token of [
  'gigPanelWouldOverlapLocalPip'
]) if (!app.includes(token)) throw new Error(`Missing UI 1.0.3 app token: ${token}`);
if (!app.includes("tcgate.alpha.gig-panel-position.v2") && !app.includes("tcgate.alpha.gig-panel-position.v3")) {
  throw new Error('Missing Gig panel persistence key compatible with UI 1.0.3+');
}
for (const token of [
  'Candidate 11 · UI 1.0.3 corrective',
  '#screenHome { overflow-y:auto; }',
  '.tcgate-gig-drag-handle:hover',
  'width:100vw !important',
  'height:100vh !important'
]) if (!css.includes(token)) throw new Error(`Missing UI 1.0.3 CSS token: ${token}`);
console.log('SMOKE_OK_TCGATE_UI_1_0_3_CORRECTIVE');
