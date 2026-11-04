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
// Jalon 6C.2 adds one read-only evidence route. Reverse only its exact bytes
// at the exact health -> phone site; the complete remaining server stays frozen.
const qualifiedReceiptEndpoint =
  "    // Read-only attestation of the code serving this exact deployed build.\n" +
  "    // No database, model inference or qualification session is mutated here.\n" +
  "    if (req.method === 'GET' && pathname === '/api/vision-qualification-compatibility') {\n" +
  "      const buildSha = process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA || null;\n" +
  "      if (!/^[a-f0-9]{40}$/.test(buildSha || '')) {\n" +
  "        return sendJson(res, 503, { ok: false, error: 'Build SHA unavailable for qualification evidence' });\n" +
  "      }\n" +
  "      const { getCompatibility } = require('./vision-nominal-qualification-compatibility.js');\n" +
  "      res.setHeader('Cache-Control', 'no-store');\n" +
  "      return sendJson(res, 200, getCompatibility({ root: __dirname, buildSha }));\n" +
  "    }\n\n";
const precedingHealth =
  "    if (req.method === 'GET' && pathname === '/api/health') {\n" +
  "      return sendJson(res, 200, {\n" +
  "        ok: true,\n" +
  "        version: VERSION,\n" +
  "        buildSha: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA || null,\n" +
  "        environment: process.env.RAILWAY_ENVIRONMENT_NAME || process.env.NODE_ENV || 'local'\n" +
  "      });\n" +
  "    }\n\n";
const followingPhone =
  "    if (req.method === 'GET' && pathname === '/phone') {\n" +
  "      return staticFile(req, res, '/phone.html');\n" +
  "    }";
function stripQualifiedReceiptEndpoint(input) {
  const source = lf(input), first = source.indexOf(qualifiedReceiptEndpoint);
  if (first < 0) return source;
  if (source.indexOf(qualifiedReceiptEndpoint, first + qualifiedReceiptEndpoint.length) >= 0) throw Error('Duplicate qualification compatibility route');
  if (!source.slice(0, first).endsWith(precedingHealth) ||
      !source.slice(first + qualifiedReceiptEndpoint.length).startsWith(followingPhone)) throw Error('Qualification compatibility route moved from its audited site');
  return source.slice(0, first) + source.slice(first + qualifiedReceiptEndpoint.length);
}
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
  'public/vision-core.js', 'public/vision-frame-gate.js', 'report-mail-server.js', 'public/report-mail-ui.js'
]) {
  if (!fs.existsSync(path.join(root, file))) throw Error('Protected source is missing: ' + file);
  equal(hash(file === 'server.js' ? stripQualifiedReceiptEndpoint(read(file)) : lf(read(file))), hash(lf(original(file))), 'Protected source remains unchanged: ' + file);
}
const originalServer = lf(original('server.js')), deployedServer = lf(read('server.js'));
const originalServerHash = '6a41bec80f6a4e8dfa802d02c320bcdf0a7eadbb711c74ccc62bc3c6038e4b5c';
equal(hash(originalServer), originalServerHash, 'The complete historical server source remains authenticated');
equal(stripQualifiedReceiptEndpoint(originalServer), originalServer, 'An original server without the qualification route is unchanged');
equal(stripQualifiedReceiptEndpoint(deployedServer), originalServer, 'The sole exact 6C.2 route accounts for every changed server byte');
function serverStillFrozen(source) {
  try { return hash(stripQualifiedReceiptEndpoint(source)) === originalServerHash; } catch { return false; }
}
const endpointMutations = [
  ['method', text => text.replace("req.method === 'GET'", "req.method === 'POST'")],
  ['path', text => text.replace('/api/vision-qualification-compatibility', '/api/other-qualification-route')],
  ['build guard', text => text.replace('{40}', '{41}')],
  ['status', text => text.replace('sendJson(res, 503', 'sendJson(res, 200')],
  ['body', text => text.replace('Cache-Control', 'X-Changed-Header')],
  ['helper argument', text => text.replace('root: __dirname', "root: '/unqualified-root'")]
];
for (const [label, mutate] of endpointMutations) {
  const changed = mutate(qualifiedReceiptEndpoint);
  check(changed !== qualifiedReceiptEndpoint, 'The negative fixture changes the endpoint ' + label);
  equal(serverStillFrozen(deployedServer.replace(qualifiedReceiptEndpoint, changed)), false, 'A changed endpoint ' + label + ' cannot bypass the frozen full-server hash');
}
equal(serverStillFrozen(originalServer + '\n' + qualifiedReceiptEndpoint), false, 'An exact endpoint moved away from the health/phone site is refused');
equal(serverStillFrozen(deployedServer + '\n' + qualifiedReceiptEndpoint), false, 'An exact duplicate endpoint is refused');
equal(serverStillFrozen(deployedServer.replace(followingPhone, "    // moved phone route\n" + followingPhone)), false, 'A changed endpoint boundary is refused');
for (const [label, before, after] of [
  ['old model path', "'card_detector_v53_512.onnx'", "'unqualified-model.onnx'"],
  ['old stream body', 'fs.createReadStream(MODEL_FILE).pipe(res);', 'fs.createReadStream(MODEL_FILE, { start: 1 }).pipe(res);'],
  ['old phone route', "pathname === '/phone'", "pathname === '/different-phone-route'"]
]) {
  const changed = deployedServer.replace(before, after);
  check(changed !== deployedServer, 'The negative fixture changes ' + label);
  equal(serverStillFrozen(changed), false, 'A change outside the 6C.2 endpoint remains protected: ' + label);
}
equal(hash(require('./workspace-production-contract.js').productionIdentification(Buffer.from(read('public/identification.js')))), 'e5593e42a8dfd60a4d81850fb76c518c4212302906a1cd655fb3901cf9e18071', 'All recognition functions/constants stay unchanged while Jalon 4 scopes the corpus');
function functionBody(source, name) {
  source = lf(source);
  const match = new RegExp('^(?:async )?function ' + name + '\\(', 'm').exec(source);
  check(Boolean(match), 'Function exists: ' + name);
  const tail = source.slice(match.index), next = /\n(?:async )?function \w+\(/.exec(tail);
  return lf(next ? tail.slice(0, next.index) : tail);
}
const baselineApp = original('public/app.js');
for (const name of ['api', 'enterLobby', 'setReady', 'enterNetworkGame', 'applyRoomState', 'connectEventStream', 'loadRtcConfig', 'startLocalMedia', 'pairPhoneCamera', 'sendTimerAction', 'applySharedTimer', 'applyRemoteGigState', 'changeDieValue']) equal(functionBody(app, name), functionBody(baselineApp, name), 'Existing ' + name + ' mechanism is unchanged');
const readyHandler = source => lf(source.slice(source.indexOf("$('startGame').addEventListener"), source.indexOf("$('leaveLobby').addEventListener")));
equal(readyHandler(app), readyHandler(baselineApp), 'Ready/Start listener remains unchanged');
console.log('SITE_UI_2_0_CONTRACT_OK ' + JSON.stringify({ assertions, baseline, protectedProductMechanisms: true, playerLocale: 'PERSONAL (JALON 3)', visionLocale: 'PERSONAL CORPUS (JALON 4)' }));
