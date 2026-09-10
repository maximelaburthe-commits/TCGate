'use strict';

const fs = require('fs');
const { execFileSync } = require('child_process');

const BASE = '9422b052d34a999e1aec4a0f6be6124a86ad5f31';
const read = file => fs.readFileSync(file, 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const normalize = value => value.replace(/\r\n/g, '\n');
const homeSlice = html => html
  .slice(html.indexOf('<!-- HOME -->'), html.indexOf('<!-- SETUP CREATE/JOIN -->'))
  .replace(/\r\n/g, '\n');
const between = (source, start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));

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
assert(normalize(html) === normalize(checkpointHtml), 'Checkpoint B changed the Candidate HTML');
assert(
  normalize(ux.slice(0, ux.indexOf('  const game ='))).trimEnd() === normalize(checkpointUx.slice(0, checkpointUx.indexOf('  root.TCGateFutureUx'))).trimEnd(),
  'Checkpoint B changed the Checkpoint A Hub behavior'
);
assert(
  normalize(css.slice(0, css.indexOf('/* Checkpoint B'))).trimEnd() === normalize(checkpointCss).trimEnd(),
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
assert(!css.includes('.tcgate-gig-'), 'Checkpoint B changes Gig Dice presentation');

console.log('FUTURE_UX_V3_7_HUB_OK');
