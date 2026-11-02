'use strict';
// Product UI contract. Browser coverage exercises the real Room and media paths.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.resolve(process.env.SITE_UI_TEST_ROOT || process.cwd());
const baseline = '0844876eb75a6bcac80fe75f605811f5dee1e9a0';
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const lf = source => source.replace(/\r\n/g, '\n');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const original = file => execFileSync('git', ['show', baseline + ':' + file], { cwd: root, encoding: 'utf8' });
let assertions = 0;
function check(value, label) { assert(value, label); assertions++; }
function equal(value, expected, label) { assert.deepEqual(value, expected, label); assertions++; }
const html = read('public/index.html'), css = read('public/tcgate-ui-1.2.css'), app = read('public/app.js');
const contract = require(path.join(root, 'tcgate-ui-1.2-contract.js'));
const home = contract.section(html, 'screenHome'), lobby = contract.section(html, 'screenLobby');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
equal(ids.length, new Set(ids).size, 'Each real UI control has exactly one ID');
for (const id of ['goCreate', 'goJoin', 'resumeSessionCard', 'resumeSessionButton']) check(home.includes('id="' + id + '"'), 'Home retains ' + id);
check(/<h1[^>]*>Votre table, pas de frontière\.<\/h1>/.test(home), 'Approved Home headline');
check(/id="goCreate"[^>]*class="[^"]*primary/.test(home), 'Create is the primary Home CTA');
check(/id="goJoin"[^>]*class="[^"]*secondary/.test(home), 'Join is the secondary Home CTA');
check(home.includes('site-product-preview') && home.includes('/assets/tcgate-product-preview.png'), 'Home has the real product reference visual');
check(!home.includes('home-alpha-orbit-hero-approved.webp'), 'Orbit is absent from the hero');
const steps = [...home.matchAll(/class="tcgate-step-item"[\s\S]*?<strong>([^<]+)<\/strong>/g)].map(match => match[1]);
equal(steps, ['Créer', 'Inviter', 'Jouer'], 'Journey has precisely three ordered steps');
check(home.includes('Cyberpunk Trading Card Game') && home.includes('Sans jeu'), 'Both current game modes are represented');
check(!/Star Wars Unlimited|Neuroscape|Hellbreak|Riftbound|\bSWU\b/.test(home), 'Home offers no future game as currently available');
const options = [...html.matchAll(/<option\b([^>]*)value="([^"]+)"([^>]*)>([^<]*)<\/option>/g)]
  .filter(match => ['cyberpunk', 'no-game', 'other'].includes(match[2]));
equal(options.filter(match => !/\bdisabled\b/.test(match[1] + match[3])).map(match => match[2]), ['cyberpunk', 'no-game'], 'Only the two active games are selectable');
for (const name of ['session', 'installation', 'players']) {
  check(lobby.includes('data-lobby-page="' + name + '"'), 'Lobby retains accessible ' + name + ' navigation');
  check(!contract.section(html, 'ui12-lobby-' + name).includes('id="startGame"'), 'Ready remains outside ' + name + ' panel');
}
for (const id of ['startGame', 'enableMedia', 'cameraSelect', 'microSelect', 'usePhoneCamera', 'phoneCameraPanel', 'timerToggle', 'timerMinutes', 'gigDiceToggle', 'gameSelect', 'setupContinue']) equal(ids.filter(value => value === id).length, 1, 'Single existing functional control ' + id);
check(lobby.includes('Moi') && lobby.includes('Adversaire'), 'Players distinguish local and opposing player');
check(contract.section(html, 'ui12-lobby-installation').includes('id="playerLocaleSelect"'), 'Player Locale is a personal installation control');
check(!contract.section(html, 'ui12-lobby-session').includes('id="playerLocaleSelect"'), 'Player Locale never becomes a shared Session control');
for (const color of ['#070b13', '#0d1420', '#111a29', '#27324a', '#1b2436', '#f4f6fb', '#8f9bb0', '#7c5cff', '#9b86ff', '#67d9a2', '#f06a75']) check(css.includes(color), 'Approved token ' + color);
check(css.includes('prefers-reduced-motion'), 'Design system respects reduced motion');
check(css.includes(':focus-visible'), 'Keyboard focus has a visible treatment');
check(!/(?:future-ux-v4-test|site-ui-final-final)\.css/.test(html), 'Existing design stylesheet is consolidated');
check(!css.includes('#screenGame'), 'Site stylesheet does not rebuild the Game Table');
const logo = fs.readFileSync(path.join(root, 'public/assets/tcgate-logo-final.png'));
equal(hash(logo), '56660fac88d53f7fc9e6056725a4067f89f5cc0079f70407cb79180bb7d92515', 'Approved logo is byte-identical');
equal([logo.readUInt32BE(16), logo.readUInt32BE(20), logo[25]], [2048, 682, 6], 'Logo retains PNG RGBA dimensions');
equal(lf(contract.section(html, 'screenGame')), lf(contract.section(original('public/index.html'), 'screenGame')), 'Full Game Table markup remains identical to qualified baseline');
for (const file of [
  'server.js', 'public/media-recovery.js', 'public/database-locale-core.js', 'public/database-source.js', 'public/game-databases.js',
  'public/phone-camera.js', 'public/phone-camera-settings.js', 'public/phone-camera-settings.css',
  'public/vision-core.js', 'public/identification.js', 'public/vision-frame-gate.js', 'report-mail-server.js', 'public/report-mail-ui.js'
]) {
  if (!fs.existsSync(path.join(root, file))) throw Error('Protected source is missing: ' + file);
  equal(hash(lf(read(file))), hash(lf(original(file))), 'Protected source remains unchanged: ' + file);
}
function functionBody(source, name) {
  source = lf(source);
  const match = new RegExp('^(?:async )?function ' + name + '\\(', 'm').exec(source);
  check(Boolean(match), 'Function exists: ' + name);
  const tail = source.slice(match.index), next = /\n(?:async )?function \w+\(/.exec(tail);
  return lf(next ? tail.slice(0, next.index) : tail);
}
const baselineApp = original('public/app.js');
for (const name of ['api', 'enterLobby', 'setReady', 'enterNetworkGame', 'applyRoomState', 'connectEventStream', 'loadRtcConfig', 'startLocalMedia', 'pairPhoneCamera', 'sendTimerAction', 'applySharedTimer', 'applyRemoteGigState', 'changeDieValue', 'prepareVision', 'attachVisionToRemoteStream']) equal(functionBody(app, name), functionBody(baselineApp, name), 'Existing ' + name + ' mechanism is unchanged');
const readyHandler = source => lf(source.slice(source.indexOf("$('startGame').addEventListener"), source.indexOf("$('leaveLobby').addEventListener")));
equal(readyHandler(app), readyHandler(baselineApp), 'Ready/Start listener remains unchanged');
console.log('SITE_UI_2_0_CONTRACT_OK ' + JSON.stringify({ assertions, baseline, protectedProductMechanisms: true, playerLocale: 'PERSONAL (JALON 3)', visionLocale: 'NOT IMPLEMENTED' }));
