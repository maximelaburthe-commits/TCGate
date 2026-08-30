'use strict';
const fs = require('fs');
const app = fs.readFileSync('public/app.js','utf8');
const css = fs.readFileSync('public/tcgate-alpha.css','utf8');

for (const token of [
  "TCGate Alpha 0.1 Candidate 12",
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
  'height:calc(100dvh - 68px)',
  '@media (min-width:761px) and (max-height: 820px)',
  '.tcgate-gig-drag-handle {',
  '.tcgate-gig-drag-handle span',
  'box-shadow:none !important;',
  '.opponent-feed-card:fullscreen'
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

// Expanded fullscreen card must retain its dedicated full-screen overlay treatment.
if (!/tcgate-fullscreen-card\.expanded[\s\S]{0,420}background:rgba\(3,6,11,\.94\) !important/.test(css)) {
  throw new Error('Expanded fullscreen card overlay treatment missing');
}
console.log('SMOKE_OK_TCGATE_UI_1_0_4_CORRECTIVE');
