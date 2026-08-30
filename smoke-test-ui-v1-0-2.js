'use strict';
const fs = require('fs');
const path = require('path');
const root = __dirname;
const app = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public/tcgate-alpha.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
for (const token of [
  'GIG_PANEL_POSITION_KEY',
  'saveGigPanelPosition',
  'applySavedGigPanelPosition',
  'setFullscreenCardZoom',
  'fullscreenZoomClose'
]) if (!app.includes(token)) throw new Error(`Missing app token: ${token}`);
for (const token of [
  '.game-screen .tcgate-gig-panel {',
  '.opponent-feed-card:fullscreen .tcgate-fullscreen-card.expanded'
]) if (!css.includes(token)) throw new Error(`Missing CSS token: ${token}`);
if (!html.includes('id="fullscreenZoomClose" class="tcgate-fullscreen-zoom-close"')) throw new Error('Missing fullscreenZoomClose');
console.log('SMOKE_OK_TCGATE_UI_1_0_2_CORRECTIVE');
