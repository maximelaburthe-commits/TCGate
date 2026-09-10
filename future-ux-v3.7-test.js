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
assert(!css.includes('#screenGame') && !css.includes('.tcgate-home-'), 'Hub checkpoint CSS touches Home or Table');

console.log('FUTURE_UX_V3_7_HUB_OK');
