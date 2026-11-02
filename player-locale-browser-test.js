'use strict';
// Real local Room/SSE/WebRTC and synthetic Chromium A/V. The only bilingual
// descriptor is an intercepted, test-only declaration; production remains EN.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.WORKSPACE_PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(process.env.PLAYER_LOCALE_TEST_ROOT || process.cwd());
const { startBridgeFixture } = require(path.join(root, 'report-email-bridge-fixture.js'));
const prefix = 'https://raw.githubusercontent.com/maximelaburthe-commits/tcgate_db_cyberpunk/56402636a77af9c8b5dc4e3b61c509a185f3c834/';
const storageKey = 'tcgate-player-locale-v1:cyberpunk-tcg';
const observations = { errors: [], requests: [], database: [], screenshots: [] };
let assertions = 0, phase = 'initialization';
function check(value, label) { assert(value, label); assertions++; }
function equal(value, expected, label) { assert.deepEqual(value, expected, label); assertions++; }
function step(label) { phase = label; console.log('PLAYER_LOCALE_BROWSER_STEP ' + label); }
function localeKeys(value, at = '') {
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) => [
    ...(/^(?:(?:player|host|room|session|shared)?locale|locales|playerLocales)$/i.test(key) ? [at + key] : []),
    ...localeKeys(child, at + key + '.')
  ]);
}
async function fixtureDocuments() {
  const documents = new Map();
  async function read(relative) {
    check(typeof relative === 'string' && relative && !relative.includes('\\') && !relative.split('/').some(part => !part || part === '.' || part === '..'), 'Pinned fixture path is bounded');
    let bytes;
    if (process.env.TCGATE_DB_FIXTURE_ROOT) bytes = fs.readFileSync(path.join(process.env.TCGATE_DB_FIXTURE_ROOT, relative));
    else { const response = await fetch(prefix + relative); equal(response.status, 200, 'Pinned public fixture HTTP 200'); bytes = Buffer.from(await response.arrayBuffer()); }
    documents.set(relative, bytes); return JSON.parse(bytes.toString('utf8'));
  }
  const manifest = await read('manifest.json');
  await Promise.all([manifest.database_manifest, manifest.entrypoint || manifest.runtime_cards, manifest.runtime_printings, manifest.canonical_vision_index, manifest.printing_recognition_index, manifest.recognition_groups].map(read));
  equal(documents.size, 7, 'Seven immutable production fixture documents'); return documents;
}
function observe(page, name) {
  page.__playerLocaleObservationId = observations.requests.length + ':' + name;
  page.on('pageerror', error => observations.errors.push(name + ': ' + error.message));
  page.on('request', request => {
    const url = new URL(request.url()); let body = null;
    try { body = request.postDataJSON(); } catch {}
    observations.requests.push({ pageId: page.__playerLocaleObservationId, name, path: url.pathname, method: request.method(), body });
    if (request.url().startsWith(prefix)) observations.database.push({ name, url: request.url() });
  });
}
async function makeContext(browser, origin, documents, mode = { value: 'production' }) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, permissions: ['camera', 'microphone'], reducedMotion: 'reduce' });
  await ctx.addInitScript(() => {
    window.__playerLocaleSse = []; window.__playerLocaleData = [];
    const Native = window.EventSource;
    window.EventSource = class extends Native {
      constructor(...args) {
        super(...args);
        for (const type of ['room-state', 'room-recovery', 'peer-joined', 'peer-left', 'signal']) super.addEventListener(type, event => {
          try { window.__playerLocaleSse.push({ type, payload: JSON.parse(event.data) }); } catch {}
        });
      }
    };
    if (window.RTCDataChannel) {
      const send = RTCDataChannel.prototype.send;
      RTCDataChannel.prototype.send = function (payload) {
        try { window.__playerLocaleData.push(JSON.parse(payload)); } catch { window.__playerLocaleData.push(String(payload)); }
        return send.call(this, payload);
      };
    }
  });
  await ctx.route('**/game-databases.js', async route => {
    let source = fs.readFileSync(path.join(root, 'public/game-databases.js'), 'utf8');
    if (mode.value !== 'production') {
      const en = "en: Object.freeze({ code: 'en', label: 'English', dataReady: true, visionReady: true })";
      check(source.includes(en), 'Bilingual fixture changes only the declared descriptor metadata');
      source = source.replace(en, en + ",\n        fr: Object.freeze({ code: 'fr', label: 'Français', dataReady: true, visionReady: " + (mode.value === 'bilingual' ? 'true' : 'false') + ' })');
      if (mode.value === 'bilingual') source = source.replace("visionReadyLocales: Object.freeze(['en'])", "visionReadyLocales: Object.freeze(['en', 'fr'])");
      if (mode.value === 'empty') source = source.replace(en, en.replace('visionReady: true', 'visionReady: false')).replace("visionReadyLocales: Object.freeze(['en'])", 'visionReadyLocales: Object.freeze([])');
    }
    await route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: source });
  });
  await ctx.route('**/tcgate-ui-1.2.js', async route => {
    if (mode.uiDelay) await new Promise(resolve => setTimeout(resolve, mode.uiDelay));
    await route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: fs.readFileSync(path.join(root, 'public/tcgate-ui-1.2.js'), 'utf8') });
  });
  await ctx.route(prefix + '**', async route => {
    const relative = decodeURIComponent(route.request().url().slice(prefix.length));
    if (documents.has(relative)) return route.fulfill({ status: 200, body: documents.get(relative), contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } });
    // This test never qualifies Vision images. Keep immutable runtime JSON local;
    // any historical image loads retain their normal URL and runtime behavior.
    return route.continue();
  });
  const page = await ctx.newPage(); observe(page, mode.value); await page.goto(origin + '/');
  await page.waitForFunction(() => window.TCGatePlayerLocale && window.TCGateSiteUi20);
  return { ctx, page, mode };
}
async function tab(page, name) { await page.locator('[data-lobby-page="' + name + '"]').click(); check(await page.locator('#ui12-lobby-' + name).isVisible(), name + ' panel opens'); }
async function room(page) {
  await page.waitForFunction(() => document.querySelector('#screenLobby')?.classList.contains('active') && /^[A-Z0-9]{6}$/.test(document.querySelector('#lobbyCode')?.textContent.trim() || '') && state.roomCode === document.querySelector('#lobbyCode').textContent.trim(), {}, { timeout: 30000 });
  await page.waitForFunction(() => window.TCGateSiteUi20);
  return page.locator('#lobbyCode').innerText().then(text => text.trim());
}
async function create(page, game = 'cyberpunk') {
  await page.locator('#goCreate').click(); await page.locator('#playerName').fill('Host Player Locale');
  await page.locator('#gameSelect').selectOption(game); await page.locator('#siteCreateTimer').uncheck();
  if (game === 'cyberpunk') await page.locator('#siteCreateGig').uncheck();
  await page.locator('#setupContinue').click(); return room(page);
}
async function join(page, code) {
  await page.locator('#goJoin').click(); await page.locator('#playerName').fill('Guest Player Locale');
  await page.locator('#roomCodeInput').fill(code); await page.locator('#setupContinue').click(); equal(await room(page), code, 'Guest joins the actual Host room');
}
async function leave(page) { await page.locator('#leaveLobby').click(); await page.waitForFunction(() => document.querySelector('#screenHome').classList.contains('active')); }
async function localeControl(page, expected, codes) {
  await tab(page, 'installation');
  const control = page.locator('#playerLocaleSelect'); check(await control.isVisible(), 'Personal card language is visible'); check(await control.isEnabled(), 'Personal card language is enabled for this player');
  equal(await control.inputValue(), expected, 'Personal language selection is correct');
  equal(await control.locator('option:not([disabled])').evaluateAll(options => options.map(option => option.value)), codes, 'Options come from the currently qualified descriptor');
  check(await control.evaluate(element => [...element.labels].some(label => label.textContent.trim().startsWith('Langue de mes cartes'))), 'Native select has the real product label');
  check(await page.locator('#ui12-lobby-installation').evaluate(panel => panel.contains(document.querySelector('#playerLocaleSelect'))), 'Language belongs to Mon installation');
  check(!await page.locator('#ui12-lobby-session #playerLocaleSelect').count(), 'Session owns no personal language');
}
async function responsive(page, role) {
  for (const viewport of [{ width: 1366, height: 768 }, { width: 560, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport); await tab(page, 'installation');
    for (const selector of ['#playerLocaleSelect', '#cameraSelect', '#microSelect', '#usePhoneCamera']) {
      const node = page.locator(selector); await node.scrollIntoViewIfNeeded();
      const box = await node.evaluate(element => { const r = element.getBoundingClientRect(); return { x: r.x, right: r.right, width: r.width, viewport: innerWidth }; });
      check(box.x >= -1 && box.width > 0 && box.right <= box.viewport + 1, role + ' ' + selector + ' fits at ' + viewport.width);
    }
    const geometry = await page.evaluate(() => {
      const active = document.querySelector('.screen.active'), ready = document.querySelector('#startGame').getBoundingClientRect(), field = document.querySelector('#playerLocaleField');
      return { width: innerWidth, doc: document.documentElement.scrollWidth, active: active.clientWidth, scroll: active.scrollWidth, label: field.scrollWidth, labelWidth: field.clientWidth, top: ready.top, bottom: ready.bottom, height: innerHeight };
    });
    check(geometry.doc <= geometry.width + 1 && geometry.scroll <= geometry.active + 1 && geometry.label <= geometry.labelWidth + 2, role + ' label/select causes no horizontal overflow at ' + viewport.width + ': ' + JSON.stringify(geometry));
    check(geometry.top >= 0 && geometry.bottom <= geometry.height + 1, role + ' Ready stays in the actual viewport at ' + viewport.width);
    if (process.env.WORKSPACE_SCREENSHOT_DIR && viewport.width !== 560) {
      fs.mkdirSync(process.env.WORKSPACE_SCREENSHOT_DIR, { recursive: true });
      await page.locator('#playerLocaleSelect').scrollIntoViewIfNeeded();
      const target = path.join(process.env.WORKSPACE_SCREENSHOT_DIR, 'player-locale-' + role.toLowerCase() + '-' + viewport.width + '.png');
      await page.screenshot({ path: target }); observations.screenshots.push(target);
    }
  }
}
async function media(page) {
  await tab(page, 'installation'); await page.locator('#enableMedia').click();
  await page.waitForFunction(() => { const video = document.querySelector('#lobbyPreview'); return video.videoWidth > 0 && video.srcObject?.getVideoTracks().some(track => track.readyState === 'live') && video.srcObject?.getAudioTracks().some(track => track.readyState === 'live'); }, {}, { timeout: 30000 });
  // Metadata can precede the media-started continuation and RTC prewarm. Ready
  // assertions begin only after those existing asynchronous actions settle.
  await page.waitForFunction(() => document.querySelector('#mediaStatus').classList.contains('ready') && document.querySelector('#cameraSelect').options.length > 0 && document.querySelector('#microSelect').options.length > 0 && !state.rtcPrewarmPending);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function snapshot(page) { return page.evaluate(() => ({ game: state.game, phase: state.roomSnapshot.phase, gig: state.roomSnapshot.gigDiceEnabled, timer: state.roomSnapshot.timer, peers: state.roomSnapshot.peers.map(({ id, role, ready }) => ({ id, role, ready })) })); }
async function assertNoLocaleNetwork(pages) {
  const posts = observations.requests.filter(request => request.method !== 'GET');
  check(posts.length > 0, 'Real Room/signaling requests were observed'); equal(posts.flatMap(request => localeKeys(request.body)), [], 'Personal locale is absent from all HTTP mutation payloads');
  for (const page of pages) {
    const messages = await page.evaluate(() => ({ sse: window.__playerLocaleSse, data: window.__playerLocaleData, snapshot: state.roomSnapshot }));
    check(messages.sse.some(message => message.type === 'room-state'), 'Real authoritative SSE room states were observed');
    equal(localeKeys(messages), [], 'SSE, WebRTC data and shared Room state contain no personal locale');
  }
}
async function main() {
  const started = Date.now(), documents = await fixtureDocuments(), fixture = await startBridgeFixture({ root }); let browser;
  const contexts = [];
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-fake-device-for-media-stream=device-count=2,fps=30', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
    console.log('PLAYER_LOCALE_BROWSER_VERSION ' + browser.version());
    step('Production EN-only descriptor, stale FR and accessibility');
    const production = await makeContext(browser, fixture.origin, documents); contexts.push(production.ctx); const prod = production.page;
    await prod.evaluate(key => localStorage.setItem(key, 'fr'), storageKey); await prod.reload();
    const beforeData = observations.database.length; await create(prod); await localeControl(prod, 'en', ['en']);
    equal(await prod.evaluate(key => localStorage.getItem(key), storageKey), 'en', 'Stale unqualified FR preference is repaired to EN');
    equal(observations.database.length, beforeData, 'Choosing a player locale with no opponent loads no database or Vision corpus');
    equal(await prod.locator('#playerLocaleSelect option').allTextContents(), ['English'], 'Production does not offer unqualified FR');
    await prod.locator('#playerLocaleSelect').focus(); await prod.keyboard.press('Shift+Tab'); await prod.keyboard.press('Tab');
    check(await prod.locator('#playerLocaleSelect').evaluate(element => document.activeElement === element && getComputedStyle(element).outlineStyle !== 'none' && parseFloat(getComputedStyle(element).outlineWidth) > 0), 'Native language select supports keyboard navigation with a visible focus ring');
    await media(prod); await responsive(prod, 'Production'); await leave(prod);
    step('Explicit bilingual test fixture: independent Host / Guest and unchanged active corpus');
    const hostFixture = await makeContext(browser, fixture.origin, documents, { value: 'bilingual' }), guestFixture = await makeContext(browser, fixture.origin, documents, { value: 'bilingual' }); contexts.push(hostFixture.ctx, guestFixture.ctx);
    let host = hostFixture.page; const guest = guestFixture.page;
    const code = await create(host); await localeControl(host, 'en', ['en', 'fr']);
    await host.locator('#playerLocaleSelect').selectOption('fr'); equal(await host.evaluate(key => localStorage.getItem(key), storageKey), 'fr', 'A real select change persists the personal preference');
    await join(guest, code); await localeControl(guest, 'en', ['en', 'fr']); await localeControl(host, 'fr', ['en', 'fr']);
    await host.waitForFunction(() => state.roomSnapshot.peers.length === 2 && state.roomSnapshot.peers.every(peer => peer.connected));
    await host.waitForFunction(() => window.TCGateDatabaseSource);
    await host.evaluate(async () => { window.__localeActiveDatabase = await TCGateDatabaseSource.load('cyberpunk'); window.__localeActiveSnapshot = JSON.stringify(window.__localeActiveDatabase); });
    const corpusBefore = await host.evaluate(() => ({ cards: __localeActiveDatabase.cards.length, printings: __localeActiveDatabase.printings.length, references: __localeActiveDatabase.references.length, modes: __localeActiveDatabase.references.reduce((all, ref) => { all[ref.recognitionMode] = (all[ref.recognitionMode] || 0) + 1; return all; }, {}) }));
    equal(corpusBefore, { cards: 150, printings: 229, references: 229, modes: { shared: 146, exact: 83 } }, 'Bilingual UI fixture retains the historical production corpus');
    const roomBefore = await snapshot(host), postsBefore = observations.requests.filter(request => request.method !== 'GET').length;
    await guest.locator('#playerLocaleSelect').selectOption('fr'); await host.locator('#playerLocaleSelect').selectOption('en');
    equal(await guest.locator('#playerLocaleSelect').inputValue(), 'fr', 'Guest can independently select a personal language');
    equal(await host.locator('#playerLocaleSelect').inputValue(), 'en', 'Guest change does not overwrite Host');
    await guest.locator('#playerLocaleSelect').selectOption('en'); await host.locator('#playerLocaleSelect').selectOption('fr');
    equal(await snapshot(host), roomBefore, 'Locale changes do not mutate shared game, timer, Gig or Ready');
    equal(observations.requests.filter(request => request.method !== 'GET').length, postsBefore, 'Locale changes issue no HTTP mutation');
    check(await host.evaluate(async () => (await TCGateDatabaseSource.load('cyberpunk')) === window.__localeActiveDatabase && JSON.stringify(window.__localeActiveDatabase) === window.__localeActiveSnapshot), 'Selecting FR neither filters nor mutates the active EN Vision corpus');
    await Promise.all([media(host), media(guest)]);
    await responsive(host, 'Host'); await responsive(guest, 'Guest');
    step('Locale changes preserve live media and the opponent Ready state');
    for (const page of [host, guest]) await page.evaluate(() => { window.__localeMediaBefore = { stream: state.localStream, pc: state.pc, tracks: state.localStream.getTracks().map(track => track.id), camera: state.selectedCameraId, microphone: state.selectedMicrophoneId, videoSource: state.videoSource }; });
    await guest.waitForFunction(() => !document.querySelector('#startGame').disabled); await guest.locator('#startGame').click();
    await host.waitForFunction(() => state.roomSnapshot.peers.some(peer => peer.role === 'guest' && peer.ready));
    await guest.waitForFunction(() => state.ownReady && state.roomSnapshot.peers.some(peer => peer.id === state.peerId && peer.ready)).catch(async error => {
      console.error('PLAYER_LOCALE_READY_DIAGNOSTIC ' + JSON.stringify(await guest.evaluate(() => ({ peerId: state.peerId, ownReady: state.ownReady, pending: state.readyRequestPending, camera: state.cameraEnabled, gameActive: state.gameActive, snapshot: state.roomSnapshot }))));
      throw error;
    });
    await host.locator('#playerLocaleSelect').selectOption('en'); await host.locator('#playerLocaleSelect').selectOption('fr');
    check(await host.evaluate(() => state.roomSnapshot.peers.some(peer => peer.role === 'guest' && peer.ready)), 'Host locale change preserves the opponent Ready state');
    check(await guest.evaluate(() => state.ownReady && state.roomSnapshot.peers.some(peer => peer.id === state.peerId && peer.ready)), 'Guest remains Ready after the Host changes language');
    for (const page of [host, guest]) check(await page.evaluate(() => {
      const before = window.__localeMediaBefore;
      return before.stream === state.localStream && (!before.pc || before.pc === state.pc) && JSON.stringify(before.tracks) === JSON.stringify(state.localStream.getTracks().map(track => track.id)) && before.camera === state.selectedCameraId && before.microphone === state.selectedMicrophoneId && before.videoSource === state.videoSource && state.localStream.getTracks().every(track => track.readyState === 'live');
    }), 'Changing language keeps the existing camera, microphone, media tracks and connection');
    step('Personal preference survives F5, reopening and a new Room');
    const registryBeforeF5 = observations.requests.filter(request => request.pageId === host.__playerLocaleObservationId && request.path === '/game-databases.js').length;
    hostFixture.mode.uiDelay = 1000;
    await host.reload(); equal(await room(host), code, 'F5 resumes the same Room even when the UI bridge arrives late'); await localeControl(host, 'fr', ['en', 'fr']);
    equal(observations.requests.filter(request => request.pageId === host.__playerLocaleObservationId && request.path === '/game-databases.js').length - registryBeforeF5, 1, 'Delayed UI bridge does not duplicate the preloaded database registry on recovery');
    hostFixture.mode.uiDelay = 0;
    equal(await guest.locator('#playerLocaleSelect').inputValue(), 'en', 'Host F5 does not replace the Guest language');
    await leave(host); await create(host); await localeControl(host, 'fr', ['en', 'fr']);
    check((await room(host)) !== code, 'A new Room is created while the language stays personal');
    await leave(host); await host.close(); host = await hostFixture.ctx.newPage(); observe(host, 'bilingual-reopen'); await host.goto(fixture.origin + '/'); await create(host); await localeControl(host, 'fr', ['en', 'fr']);
    step('Shared game changes normalize the local view without discarding stored TCG preference');
    await tab(host, 'session'); await host.locator('#gameSelect').selectOption('no-game'); await host.waitForFunction(() => state.game === 'no-game');
    await tab(host, 'installation'); check(!await host.locator('#playerLocaleField').isVisible(), 'Sans jeu hides the personal language field');
    for (const id of ['cameraSelect', 'microSelect', 'usePhoneCamera']) equal(await host.locator('#' + id).count(), 1, 'Sans jeu retains the existing ' + id + ' control');
    check(await host.locator('#enableMedia').isVisible(), 'Sans jeu retains media activation');
    equal(await host.evaluate(key => localStorage.getItem(key), storageKey), 'fr', 'Sans jeu does not destroy the stored Cyberpunk preference');
    await tab(host, 'session'); await host.locator('#gameSelect').selectOption('cyberpunk'); await host.waitForFunction(() => state.game === 'cyberpunk'); await localeControl(host, 'fr', ['en', 'fr']);
    hostFixture.mode.value = 'fr-unqualified'; await host.reload(); await room(host); await localeControl(host, 'en', ['en']);
    equal(await host.evaluate(key => localStorage.getItem(key), storageKey), 'en', 'A subsequently unqualified preference recovers automatically without broken UI');
    hostFixture.mode.value = 'empty'; await host.reload(); await room(host); await tab(host, 'installation');
    equal(await host.evaluate(() => TCGatePlayerLocale.getAvailablePlayerLocales('cyberpunk')), [], 'An empty usable-locale contract returns no selectable language');
    equal(await host.evaluate(() => TCGatePlayerLocale.getPlayerLocale('cyberpunk')), null, 'An empty usable-locale contract does not invent a preference');
    check(await host.locator('#playerLocaleSelect').isDisabled(), 'No usable locale has a native accessible disabled state');
    check(await host.locator('#playerLocaleHelp').innerText().then(text => /aucune langue/i.test(text)), 'No usable locale has a readable explanation');
    for (const id of ['cameraSelect', 'microSelect', 'usePhoneCamera']) equal(await host.locator('#' + id).count(), 1, 'Empty locale contract preserves the existing ' + id + ' control');
    check(await host.locator('#enableMedia').isVisible(), 'Empty locale contract retains media activation');
    await assertNoLocaleNetwork([host, guest]); await leave(host); await leave(guest);
    step('Sans jeu preserves actual camera/audio, Ready and WebRTC');
    const noHostFixture = await makeContext(browser, fixture.origin, documents), noGuestFixture = await makeContext(browser, fixture.origin, documents); contexts.push(noHostFixture.ctx, noGuestFixture.ctx);
    const noHost = noHostFixture.page, noGuest = noGuestFixture.page, noCode = await create(noHost, 'no-game'); await join(noGuest, noCode);
    for (const page of [noHost, noGuest]) { await tab(page, 'installation'); check(!await page.locator('#playerLocaleField').isVisible(), 'Host and Guest hide card language in Sans jeu'); }
    await Promise.all([media(noHost), media(noGuest)]);
    await noGuest.waitForFunction(() => !document.querySelector('#startGame').disabled); await noGuest.locator('#startGame').click();
    await noHost.waitForFunction(() => state.roomSnapshot.peers.some(peer => peer.role === 'guest' && peer.ready));
    check(await noHost.locator('#screenLobby').evaluate(element => element.classList.contains('active')), 'Guest Ready keeps waiting for Host');
    await noHost.waitForFunction(() => !document.querySelector('#startGame').disabled); await noHost.locator('#startGame').click();
    for (const page of [noHost, noGuest]) {
      await page.waitForFunction(() => document.querySelector('#screenGame').classList.contains('active') && document.querySelector('#remoteVideo').videoWidth > 0 && document.querySelector('#remoteVideo').srcObject?.getAudioTracks().some(track => track.readyState === 'live'), {}, { timeout: 90000 });
      check(await page.evaluate(() => state.roomSnapshot.phase === 'game' && state.roomSnapshot.peers.every(peer => peer.ready) && !visionEnabledForCurrentGame() && !state.visionPrepared && !state.visionAssetsLoaded), 'Existing Ready/media flow reaches the real shared game without Vision');
    }
    await assertNoLocaleNetwork([noHost, noGuest]);
    const signals = observations.requests.filter(request => request.path === '/api/signal').map(request => request.body?.type);
    check(['offer', 'answer', 'candidate'].every(type => signals.includes(type)), 'Real WebRTC offer / answer / ICE crossed the server');
    equal(observations.errors, [], 'No uncaught browser error'); equal(fixture.requests.length, 0, 'No report email is sent');
    console.log('PLAYER_LOCALE_BROWSER_OK ' + JSON.stringify({ assertions, browser: browser.version(), production: 'EN ONLY', bilingualDescriptor: 'TEST FIXTURE ONLY', persisted: ['F5', 'Lobby reopen', 'new Room'], viewports: [1366, 560, 390], realRoomSseWebRtc: true, syntheticCameraAudio: true, physicalDevicesQualified: false, visionCorpus: '150 / 229 / 83 exact / 146 shared unchanged', visionFiltering: 'NOT IMPLEMENTED', screenshots: observations.screenshots, elapsedSeconds: Math.round((Date.now() - started) / 1000) }));
  } finally { await Promise.allSettled(contexts.map(ctx => ctx.close())); await browser?.close(); await fixture.close(); }
}
main().catch(error => { console.error('PLAYER_LOCALE_BROWSER_FAILURE phase=' + phase + '\n' + error.stack); process.exitCode = 1; });
