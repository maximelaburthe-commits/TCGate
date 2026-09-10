'use strict';

const fs = require('fs');
const { execFileSync } = require('child_process');

const BASE = '9422b052d34a999e1aec4a0f6be6124a86ad5f31';
const read = file => fs.readFileSync(file, 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const normalize = value => value.replace(/\r\n/g, '\n');
const normalizeSpacing = value => normalize(value).replace(/\n{3,}/g, '\n\n').trimEnd();
const homeSlice = html => html
  .slice(html.indexOf('<!-- HOME -->'), html.indexOf('<!-- SETUP CREATE/JOIN -->'))
  .replace(/\r\n/g, '\n');
const between = (source, start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const normalizeGigPanelMarkup = source => source.replace(
  /<section id="gigDicePanel"[\s\S]*?<\/section>/,
  '<section id="gigDicePanel"></section>'
);

const html = read('public/index.html');
const app = read('public/app.js');
const ux = read('public/future-ux-v3.7.js');
const css = read('public/future-ux-v3.7.css');
const baseHtml = execFileSync('git', ['show', `${BASE}:public/index.html`], { encoding: 'utf8' });
const baseApp = execFileSync('git', ['show', `${BASE}:public/app.js`], { encoding: 'utf8' });
const checkpointApp = execFileSync('git', ['show', 'HEAD:public/app.js'], { encoding: 'utf8' });
const checkpointHtml = execFileSync('git', ['show', 'HEAD:public/index.html'], { encoding: 'utf8' });
const checkpointUx = execFileSync('git', ['show', 'HEAD:public/future-ux-v3.7.js'], { encoding: 'utf8' });
const checkpointCss = execFileSync('git', ['show', 'HEAD:public/future-ux-v3.7.css'], { encoding: 'utf8' });

assert(homeSlice(html) === homeSlice(baseHtml), 'Candidate Home changed');
assert(html.includes('href="/future-ux-v3.7.css"') && html.includes('src="/future-ux-v3.7.js"'), 'Hub assets are not loaded');
assert(ux.includes('function mountUnifiedHub()'), 'Unified Hub mount is missing');
assert(ux.includes('cameraZone.append(preview)'), 'Candidate camera preview is not mounted in the Hub');
assert(ux.includes('sessionZone.append(form, invite)'), 'Candidate Session elements are not mounted in the Hub');
assert(ux.includes('installationZone.append(equipment)'), 'Candidate media controls are not mounted in the Hub');
assert(ux.includes('playersZone.append(players, ready)'), 'Candidate players and Ready are not mounted in the Hub');
assert(!/cloneNode|replaceWith|insertAdjacentHTML|\.innerHTML\s*=/.test(ux), 'Hub rebuilds Candidate controls destructively');
assert(!app.includes("showScreen('setup')"), 'Legacy Setup remains in the visible navigation path');
assert(app.includes("$('goCreate').addEventListener('click', openCreateHub)"), 'Create does not use immediate room creation');
assert(app.includes('await enterLobby({ provisional: true })'), 'Host room is not created immediately');
assert(!app.includes("'Créer le salon'"), 'Legacy create-room action remains');
assert(app.includes("$('copyCode').addEventListener('click'"), 'Candidate copy-code action is missing');
assert(app.includes("$('copyLink').addEventListener('click'"), 'Candidate copy-link action is missing');

const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
assert(duplicates.length === 0, `Duplicate IDs: ${[...new Set(duplicates)].join(', ')}`);

assert(
  normalize(between(app, 'function applyRoomState(', 'async function prewarmRtcInLobby(')) === normalize(between(baseApp, 'function applyRoomState(', 'async function prewarmRtcInLobby(')),
  'Candidate applyRoomState/Ready eligibility changed'
);
assert(
  normalize(between(app, 'async function setReady(', 'async function enterNetworkGame(')) === normalize(between(baseApp, 'async function setReady(', 'async function enterNetworkGame(')),
  'Candidate setReady changed'
);
assert(
  normalize(between(app, "$('startGame').addEventListener", "$('leaveLobby').addEventListener")) === normalize(between(baseApp, "$('startGame').addEventListener", "$('leaveLobby').addEventListener")),
  'Candidate startGame handler changed'
);
assert(css.includes('#screenLobby.future-hub-mounted'), 'Hub CSS is not scoped to the Lobby');
assert(!css.includes('.tcgate-home-'), 'Future UX CSS touches the Candidate Home');
assert(normalize(app) === normalize(checkpointApp), 'Checkpoint B changed app.js or a functional contract');
assert(
  normalize(normalizeGigPanelMarkup(html.slice(0, html.indexOf('<!-- CARD MODAL -->')))) === normalize(normalizeGigPanelMarkup(checkpointHtml.slice(0, checkpointHtml.indexOf('<!-- CARD MODAL -->')))),
  'Checkpoint C changed Home, Hub or the immersive Table DOM'
);
assert(
  normalize(ux.slice(0, ux.indexOf('  const game ='))).trimEnd() === normalize(checkpointUx.slice(0, checkpointUx.indexOf('  const game ='))).trimEnd(),
  'Checkpoint B changed the Checkpoint A Hub behavior'
);
assert(
  normalize(css.slice(0, css.indexOf('/* Checkpoint B'))).trimEnd() === normalize(checkpointCss.slice(0, checkpointCss.indexOf('/* Checkpoint B'))).trimEnd(),
  'Checkpoint B changed the Checkpoint A Hub styles'
);
assert(ux.includes('function mountFutureTable()'), 'Future Table mount is missing');
assert(ux.includes("game.classList.add('future-table-v37')"), 'Future Table scope is not activated');
assert(ux.includes("document.getElementById('gameDeviceMenu')"), 'Candidate device menu is not reused');
assert(ux.includes("gameActions.addEventListener('pointerenter', showMediaDock)"), 'Contextual media dock is missing');
assert(ux.includes('2600'), 'Media dock inactivity delay is not in the expected 2-3 second range');
assert(!/cloneNode|replaceWith|insertAdjacentHTML|\.innerHTML\s*=/.test(ux), 'Future Table rebuilds Candidate controls destructively');
assert(css.includes('#screenGame.future-table-v37 .tcgate-game-layout'), 'Immersive Table layout is missing');
assert(css.includes('#screenGame.future-table-v37 .tcgate-card-rail'), 'Candidate card preview is not retained as a contextual element');
assert(css.includes('#screenGame.future-table-v37 .tcgate-game-actions'), 'Candidate media actions are not presented as a dock');
assert(!css.slice(0, css.indexOf('/* Checkpoint D')).includes('.future-gig-'), 'Checkpoint A-C unexpectedly contain the horizontal Gig UI');

assert(
  normalize(ux.slice(0, ux.indexOf('  /* Checkpoint C'))).trimEnd() === normalize(checkpointUx.slice(0, checkpointUx.indexOf('  /* Checkpoint C'))).trimEnd(),
  'Checkpoint C changed Checkpoint A/B behavior'
);
assert(
  normalizeSpacing(css.slice(0, css.indexOf('/* Checkpoint D'))) === normalizeSpacing(checkpointCss.slice(0, checkpointCss.indexOf('/* Checkpoint D'))),
  'Checkpoint C changed Checkpoint A/B styles'
);
assert(ux.includes("root.TCGTableStateEngine?.getSnapshot?.()?.lastHover?.known"), 'Vision UX does not use Table State as its hit-test source');
assert(ux.includes("visionStage.addEventListener('pointermove', updatePhysicalCardHover)"), 'Physical-card hover is not wired');
assert(ux.includes("visionStage.addEventListener('pointerleave', clearPhysicalCardHover)"), 'Physical-card leave is not wired');
assert(ux.includes("visionStage.addEventListener('click', openPhysicalCardZoom)"), 'Physical-card click is not wired');
assert(ux.includes('visionPreviewButton.click()'), 'Physical-card click does not reuse the Candidate zoom action');
assert(ux.includes('left + previewWidth > root.innerWidth') && ux.includes('top + previewHeight > root.innerHeight'), 'Preview viewport-edge handling is missing');
assert(css.includes('pointer-events:none;') && css.includes('#opponentFeed.future-vision-hit'), 'Informational preview or recognized-card cursor is missing');
assert(css.includes('#cardModal .modal-close') && css.includes('#cardModal .modal-card-name'), 'Card-only zoom presentation is incomplete');
assert(app.includes("$('closeCardModal').addEventListener('click'"), 'Candidate close-button behavior is missing');
assert(app.includes("if (e.target === $('cardModal'))"), 'Candidate outside-click close behavior is missing');
assert(app.includes("if (e.key === 'Escape')"), 'Candidate Escape close behavior is missing');

const visionFiles = [
  'public/detection-worker.js',
  'public/vision-engine.js',
  'public/identification.js',
  'public/table-state-engine.js'
];
const changedVisionFiles = execFileSync('git', ['diff', '--name-only', 'HEAD', '--', ...visionFiles], { encoding: 'utf8' }).trim();
assert(!changedVisionFiles, `Vision engine files changed: ${changedVisionFiles}`);

assert(
  normalize(ux.slice(0, ux.indexOf('  /* Checkpoint D'))).trimEnd() === normalize(checkpointUx.slice(0, checkpointUx.indexOf('  /* Checkpoint D'))).trimEnd(),
  'Checkpoint D changed Checkpoint A-C behavior'
);
assert(
  normalizeSpacing(css.slice(css.indexOf('@media (max-width:600px)'))) === normalizeSpacing(checkpointCss.slice(checkpointCss.indexOf('@media (max-width:600px)'))),
  'Checkpoint D changed Checkpoint A-C styles'
);
assert(html.includes('id="gigTotem"') && html.includes('aria-expanded="true"'), 'Gig totem is missing');
assert(ux.includes('gigTrack.append(gigOpponentSide)') && ux.includes('gigTrack.append(gigSelfSide)'), 'Gig sides are not retained around the center');
assert(ux.includes('gigTrack.append(gigOpponentScore)') && ux.includes('gigTrack.append(gigSelfScore)'), 'Street Cred is not arranged around the totem');
assert(html.includes('future-gig-totem-frame') && html.includes('future-gig-totem-core'), 'The central Gig totem artwork is missing');
assert(ux.includes("gigTotem.addEventListener('click'"), 'Gig open/close control is missing');
assert(!ux.slice(ux.indexOf('/* Checkpoint D')).includes("document.addEventListener('click'"), 'Gig closes on an outside click');
assert(ux.includes('deviceMenu.append(gigReset)'), 'Candidate Reset is not moved to the secondary menu');
assert(ux.includes('wrap.title = `d${match[1]}`'), 'Die type tooltip is missing');
assert(css.includes('.tcgate-die-wrap:hover .tcgate-die-adjust'), 'Contextual +/- controls are missing');
assert(css.includes('.tcgate-gig-side-opp .tcgate-gig-dice-lane') && css.includes('flex-direction:row-reverse'), 'Mirrored die order is missing');
assert(css.includes('.future-gig-collapsed .tcgate-gig-side'), 'Collapsed Gig sides are not hidden');

const gigLogic = between(app, 'function createGigDiceState()', 'const GIG_PANEL_POSITION_KEY');
for (const token of ['value: 0', "origin: 'host'", "origin: 'guest'", 'die.owner = targetOwner', "sendGigState('die-transfer')", "sendGigState('manual-reset')"]) {
  assert(gigLogic.includes(token), `Candidate Gig invariant missing: ${token}`);
}

console.log('FUTURE_UX_V3_7_HUB_OK');
