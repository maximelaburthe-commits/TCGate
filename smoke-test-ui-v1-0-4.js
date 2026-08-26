'use strict';
const fs = require('fs');
const app = fs.readFileSync('public/app.js','utf8');
const css = fs.readFileSync('public/tcgate-alpha.css','utf8');

for (const token of [
  "TCGate Alpha 0.1 Candidate 11 · UI 1.0.4",
  "tcgate.alpha.gig-panel-position.v3",
  "scheduleGigPanelSafePlacement('render')",
  "defaultSafeGigPanelPosition",
  "gigPanelHasLayout",
  "clearSavedGigPanelPosition",
  "visual-viewport-resize"
]) {
  if (!app.includes(token)) throw new Error(`Missing UI 1.0.4 app token: ${token}`);
}
for (const token of [
  'Candidate 11 · UI 1.0.4 corrective',
  'height:100dvh',
  '@media (min-width:901px) and (max-height:710px)',
  '.tcgate-gig-drag-handle::before',
  '.tcgate-gig-drag-handle span { display:none !important; }',
  'box-shadow:none !important;',
  '.opponent-feed-card:fullscreen::backdrop'
]) {
  if (!css.includes(token)) throw new Error(`Missing UI 1.0.4 CSS token: ${token}`);
}

// Guard against the C11 regression: layout validation must not accept a zero-sized hidden panel.
const applyStart = app.indexOf('function applySavedGigPanelPosition');
const layoutCheck = app.indexOf('if (!gigPanelHasLayout(panel)) return false;', applyStart);
const overlapCheck = app.indexOf('gigPanelWouldOverlapLocalPip', applyStart);
if (!(layoutCheck > applyStart && overlapCheck > layoutCheck)) {
  throw new Error('Saved Gig position must wait for real layout before overlap validation');
}

// The old v2 session-storage key must not be reused; stale C10/C11 positions are intentionally discarded.
if (app.includes("const GIG_PANEL_POSITION_KEY = 'tcgate.alpha.gig-panel-position.v2'")) {
  throw new Error('Old Gig position key still active');
}

// Expanded fullscreen card must explicitly cancel the inherited !important shadow.
if (!/fullscreen-card-preview\.tcgate-fullscreen-card\.expanded[\s\S]{0,260}box-shadow:none !important/.test(css)) {
  throw new Error('Expanded fullscreen card shadow not explicitly removed');
}
console.log('SMOKE_OK_TCGATE_UI_1_0_4_CORRECTIVE');
