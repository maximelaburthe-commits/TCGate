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
const normalizeGigPanelMarkup = source => {
  const start = source.indexOf('<div id="gigDiceMount"');
  const end = source.indexOf('<div class="game-hint', start);
  return start >= 0 && end >= 0 ? `${source.slice(0, start)}<div id="gigDiceMount"></div>\n          ${source.slice(end)}` : source;
};
const normalizeTimerMarkup = source => {
  let value = source.replace(/\s*<div id="timerHubConfig">[\s\S]*?<div class="summary-line"><span>Minuteur<\/span><strong id="sumTimer">[\s\S]*?<\/strong><\/div>\s*<\/div>/, '');
  const hudStart = value.indexOf('<div class="hud-top"');
  const hudEnd = value.indexOf('<main class="game-layout', hudStart);
  if (hudStart >= 0 && hudEnd >= 0) value = `${value.slice(0, hudStart)}${value.slice(hudEnd)}`;
  return value;
};
const normalizeTableChrome = source => {
  let value = source;
  const actionsStart = Math.max(value.indexOf('<div class="game-actions'), value.indexOf('<div class="controls'));
  const actionsEnd = value.indexOf('</div>', actionsStart);
  if (actionsStart >= 0 && actionsEnd >= 0) value = `${value.slice(0, actionsStart)}<div id="tableControls"></div>${value.slice(actionsEnd + 6)}`;
  const menuStart = value.indexOf('<div class="more-menu');
  const deviceMenuStart = value.indexOf('<div id="gameDeviceMenu"', menuStart);
  if (menuStart >= 0 && deviceMenuStart >= 0) value = `${value.slice(0, menuStart)}${value.slice(deviceMenuStart)}`;
  return value;
};
const withoutCheckpointEStyles = source => source.replace(/\/\* Checkpoint E[\s\S]*?\/\* End Checkpoint E \*\//, '');
const normalizeGigCandidateImplementation = source => source
  .replace(/function getGigDice\(uiOwner\)[\s\S]*?(?=function serializeGigState\(\))/, '/* GIG RENDER */\n\n')
  .replace(/function clearDieDropTargets\(\)[\s\S]*?(?=const GIG_PANEL_POSITION_KEY)/, '/* GIG DRAG PRESENTATION */\n\n')
  .replace(/\$\('gigDicePanel'\)\?\.addEventListener\('pointerdown'[\s\S]*?(?=\$\('toggleLocalPreview'\))/, '/* GIG BINDINGS */\n');

const html = read('public/index.html');
const app = read('public/app.js');
const serverSource = read('server.js');
const reportMailUi = read('public/report-mail-ui.js');
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
  normalize(between(app, 'function applyRoomState(', 'async function prewarmRtcInLobby(').replace(/\s*if \(snapshot\.timer\) applySharedTimer\(snapshot\.timer\);/, '')) === normalize(between(baseApp, 'function applyRoomState(', 'async function prewarmRtcInLobby(')),
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
assert(app.includes('function transferDie(') && app.includes('function applyRemoteGigState('), 'Checkpoint D Gig mechanics are missing');
assert(
  normalize(normalizeTimerMarkup(html.slice(0, html.indexOf('<!-- GAME -->')))) === normalize(normalizeTimerMarkup(checkpointHtml.slice(0, checkpointHtml.indexOf('<!-- GAME -->')))),
  'Checkpoint G changed Candidate Home or Hub DOM outside the Timer placement'
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
assert(ux.includes("game.addEventListener('mousemove', showMediaDock"), 'Pointer movement anywhere on the Table does not reveal the dock');
assert(ux.includes("if (game.classList.contains('active')) showMediaDock()"), 'Media dock is not shown immediately on Table entry');
assert(ux.includes('}, 2600)'), 'Media dock inactivity delay is not exactly 2600 ms');
assert(!/cloneNode|replaceWith|insertAdjacentHTML|\.innerHTML\s*=/.test(ux), 'Future Table rebuilds Candidate controls destructively');
assert(css.includes('#screenGame.future-table-v37 .tcgate-game-layout'), 'Immersive Table layout is missing');
assert(css.includes('#screenGame.future-table-v37 .tcgate-card-rail'), 'Candidate card preview is not retained as a contextual element');
assert(css.includes('#screenGame.future-table-v37 .controls') && css.includes('.controls.hidden-ui'), 'Prototype media dock presentation is missing');
assert(!html.includes('tcgate-game-actions') && !html.includes('tcgate-media-button'), 'Candidate classes contaminate the prototype media dock');
const gameMarkup = between(html, '<section id="screenGame"', '</section>');
const topbarMarkup = between(gameMarkup, '<header class="game-topbar tcgate-game-topbar">', '</header>');
assert(gameMarkup.includes('id="controls"'), 'Prototype controls are not inside screenGame');
assert(!topbarMarkup.includes('id="controls"'), 'Prototype controls remain trapped inside the zero-height Candidate topbar');
assert(/#screenGame\.future-table-v37 \.tcgate-feed-head\s*\{\s*display:none;\s*\}/.test(css), 'Candidate feed header is not hidden in Future Table');
assert(css.includes('grid-template-rows:minmax(0,1fr);'), 'Opponent video still reserves a Candidate header row');
const hudMarkup = between(gameMarkup, '<div class="hud-top">', '<div class="popover');
assert(hudMarkup.includes('id="timerChip"'), 'Timer chip moved outside the prototype hud-top');
assert(!css.slice(0, css.indexOf('/* Checkpoint D')).includes('.future-gig-'), 'Checkpoint A-C unexpectedly contain the horizontal Gig UI');

assert(ux.includes("root.TCGTableStateEngine?.getSnapshot?.()?.lastHover?.known"), 'Vision UX does not use Table State as its hit-test source');
assert(ux.includes("visionStage.addEventListener('pointermove', updatePhysicalCardHover)"), 'Physical-card hover is not wired');
assert(ux.includes("visionStage.addEventListener('pointerleave', clearPhysicalCardHover)"), 'Physical-card leave is not wired');
assert(ux.includes("visionStage.addEventListener('click', openPhysicalCardZoom)"), 'Physical-card click is not wired');
assert(ux.includes('visionPreviewButton.click()'), 'Physical-card click does not reuse the Candidate zoom action');
assert(ux.includes('Math.min(230, Math.max(170, root.innerWidth * .17))'), 'Vision hover preview does not exceed the former 190px maximum');
assert(css.includes('width:clamp(170px,17vw,230px);'), 'Vision hover preview CSS is not aligned with its larger runtime width');
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

assert(html.includes('id="gigTotem"') && html.includes('class="gig-trigger2"') && html.includes('aria-expanded="false"'), 'Prototype Gig trigger is missing');
for (const className of ['gig-totem', 'gig-shell', 'gig-scrim', 'gig-side2', 'dice-line2', 'gig-core', 'street-core', 'gig-trigger2']) {
  assert(html.includes(className), `Prototype Gig structure missing: ${className}`);
}
assert(!html.includes('future-gig-totem') && !html.includes('future-gig-mark'), 'Rejected D.1 totem remains in the DOM');
assert(ux.includes("gigTotem.addEventListener('click'"), 'Gig open/close control is missing');
assert(!ux.slice(ux.indexOf('/* Checkpoint D')).includes("document.addEventListener('click'"), 'Gig closes on an outside click');
const moreMenuMarkup = between(html, '<div class="more-menu hidden" id="moreMenu">', '</div>');
const expectedMenuOrder = ['generateReportGame', 'infoMenu', 'diagMenu', 'gigDiceReset', 'finishMenu'];
assert(expectedMenuOrder.every((id, index) => index === 0 || moreMenuMarkup.indexOf(`id="${expectedMenuOrder[index - 1]}"`) < moreMenuMarkup.indexOf(`id="${id}"`)), 'Prototype secondary-menu order changed');
assert(moreMenuMarkup.includes('Réinitialiser Gig Dice'), 'Gig Reset is not in the prototype secondary menu');
assert(!ux.includes('deviceMenu.append(gigReset)'), 'Gig Reset is still moved into the Candidate device menu');
assert(app.includes("$('gigDiceReset')?.classList.toggle('hidden', !visible)"), 'Gig Reset applicability is not synchronized with the Cyberpunk Gig module');

for (const id of ['reportOverlay', 'reportText', 'sendReport', 'closeReport', 'quitOverlay', 'confirmQuit', 'cancelQuit', 'endOverlay', 'endReport', 'endHub', 'endQuit']) {
  assert(html.includes(`id="${id}"`), `Checkpoint F overlay control missing: ${id}`);
}
for (const text of ['Rapport de session', 'Quitter la partie ?', 'Session terminée', 'Retour au Hub', 'Quitter la session']) {
  assert(html.includes(text), `Checkpoint F prototype copy missing: ${text}`);
}
assert(css.includes('.flow-overlay{') && css.includes('.flow-overlay.show{display:flex}') && css.includes('.flow-card{width:min(460px,90vw)'), 'Prototype flow-overlay presentation is missing');
assert(reportMailUi.includes("document.getElementById('reportOverlay')") && reportMailUi.includes("modal.querySelector('#sendReport')"), 'Candidate report delivery is not connected to the prototype overlay');
assert(app.includes("$('leaveGame').addEventListener('click', () => $('quitOverlay')?.classList.add('show'))"), 'Dock Quit does not open the confirmation overlay');
assert(app.includes("$('confirmQuit')?.addEventListener('click', leaveCurrentGameSession)") && app.includes("$('endQuit')?.addEventListener('click', leaveCurrentGameSession)"), 'Confirmed session exit does not reuse Candidate leaveRoom');
assert(app.includes("$('endHub')?.addEventListener('click', async () =>") && app.includes('await openCreateHub()'), 'Return to Hub is not connected to the Candidate room lifecycle');
assert(ux.includes("document.getElementById('finishMenu')?.addEventListener('click', () => document.getElementById('endOverlay')?.classList.add('show'))"), 'Finish menu does not open the prototype end overlay');
assert(!ux.includes('gigTrack.append') && !ux.includes('MutationObserver(labelGigDiceTooltips)'), 'Rejected D.1 DOM reconstruction remains');
assert(css.includes('.die-slot2:hover .die-control2') && css.includes('.plus2{grid-row:1}') && css.includes('.minus2{grid-row:3}'), 'Prototype contextual controls are missing');
assert(css.includes('.gig-totem.open .gig-side2') && css.includes('max-width:760px'), 'Prototype open/closed behavior is missing');
assert(html.includes('viewBox="0 0 1000 1000" class="die-svg"') && html.includes('id="XMLID_29_"'), 'Prototype D20 SVG is not embedded in the trigger');
assert(app.includes('opponent: [20, 12, 10, 8, 6, 4]') && app.includes('self: [4, 6, 8, 10, 12, 20]'), 'Prototype die order is missing');
assert(app.includes('ordered.push(...stolen)') && app.includes("die.origin === canonicalOwner"), 'Prototype homologous/stolen die ordering is missing');
assert(app.includes('class="die-slot2') && app.includes('class="die-token2') && app.includes('GIG_DICE_ICONS[`D${die.sides}`]'), 'Prototype die markup is not rendered by Candidate');
assert(app.includes('ghost-slot') && app.includes("drag.ghost.classList.add('drag-proxy2')"), 'Prototype drag presentation is missing');
const gigMarkup = between(html, '<section id="gigDicePanel"', '</section>');
assert(!/tcgate-gig-(?:side|dice-lane|score)/.test(gigMarkup), 'Legacy Candidate Gig classes contaminate the prototype markup');
for (const selector of ['.tcgate-gig-side-self', '.tcgate-gig-side-opp', "querySelectorAll('.tcgate-gig-side')", '.tcgate-die-wrap', '.tcgate-die-adjust', "querySelector('.tcgate-die')"]) {
  assert(!app.includes(selector), `Legacy Candidate Gig selector remains: ${selector}`);
}

const gigLogic = between(app, 'function createGigDiceState()', 'const GIG_PANEL_POSITION_KEY');
for (const token of ['value: 0', "origin: 'host'", "origin: 'guest'", 'die.owner = targetOwner', "sendGigState('die-transfer')", "sendGigState('manual-reset')"]) {
  assert(gigLogic.includes(token), `Candidate Gig invariant missing: ${token}`);
}

for (const id of ['timerToggle', 'timerMinutes', 'sumTimer', 'timerChip', 'timerPop', 'timerText', 'timerBig', 'timerStart', 'timerReset']) {
  assert(html.includes(`id="${id}"`), `Prototype Timer markup missing: ${id}`);
}
for (const className of ['toggle-row', 'toggle on', 'knob', 'hud-top', 'tools', 'toolchip', 'popover', 'pop-title', 'big-number', 'pop-actions']) {
  assert(html.includes(className), `Prototype Timer class missing: ${className}`);
}
assert(app.includes("state.role !== 'host'") && app.includes('durationMinutes: minutes'), 'Host-only Timer configuration is missing');
assert(serverSource.includes("pathname === '/api/timer'") && serverSource.includes('endsAt'), 'Authoritative server Timer is missing');
assert(app.includes("timerPop')?.classList.toggle('hidden')") && ux.includes("timerPop')?.classList.add('hidden')"), 'Timer popover interaction is missing');

const timerRender = between(app, 'function renderSharedTimer()', 'function applySharedTimer(');
assert(timerRender.includes("!state.timer.enabled || !state.gameActive"), 'Disabled or pre-game Timer visibility guard changed');
const gameEntry = between(app, 'async function enterNetworkGame(', 'async function applyVideoSenderEncoding(');
assert(
  /state\.gameActive = true;\s*renderSharedTimer\(\);/.test(gameEntry),
  'Shared Timer is not rendered immediately when Host or Guest enters the Table'
);
assert(!gameEntry.includes("state.role === 'host' ? renderSharedTimer"), 'Guest Timer rendering is incorrectly role-gated');
assert(!gameEntry.includes('state.timer.running && renderSharedTimer'), 'Stopped Timer rendering incorrectly requires Start');

const setupFormMarkup = between(html, '<div class="form-card">', '<button id="setupContinue"');
assert(setupFormMarkup.includes('id="timerHubConfig"'), 'Hub Timer is not inside the Session form');
assert(setupFormMarkup.indexOf('id="timerHubConfig"') > setupFormMarkup.indexOf('id="gameField"'), 'Hub Timer is not positioned below the TCG choice');
const lobbyMarkup = between(html, '<!-- LOBBY -->', '<!-- GAME -->');
assert(!lobbyMarkup.includes('id="timerHubConfig"'), 'Legacy full-width Hub Timer placement remains');
assert(html.includes('class="center-state hidden" id="centerState"'), 'Prototype technical-state surface is missing');
assert(app.includes("markup = '<h3>Reconnexion en cours…</h3>"), 'Network recovery is not represented by the prototype state');
assert(app.includes("markup = '<h3>Caméra locale indisponible</h3>") && app.includes("markup = '<h3>Micro indisponible</h3>"), 'Unavailable local media states are missing');
assert(app.includes('cameraAvailable: Boolean(videoTrack)') && app.includes('microphoneAvailable: Boolean(audioTrack)'), 'Media availability is not independent from voluntary enabled state');
assert(app.includes("remoteStatus.textContent = 'Caméra adverse coupée'") && app.includes("remoteStatus.textContent = 'Caméra adverse indisponible'"), 'Remote voluntary-off and unavailable states are not distinguished');
const localTrackEnded = between(app, 'async function handleLocalTrackEnded(', 'async function replaceMediaKind(');
assert(!localTrackEnded.includes("showScreen('lobby')"), 'A local media failure incorrectly returns the user to the Hub');

console.log('FUTURE_UX_V3_7_HUB_OK');
