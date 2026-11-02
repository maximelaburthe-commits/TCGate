'use strict';
// Real local HTTP, Room/SSE and WebRTC. Chromium supplies synthetic A/V devices.
// Viewports emulate layout sizes; they do not qualify physical phones or TURN.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.WORKSPACE_PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(process.env.SITE_UI_TEST_ROOT || process.cwd());
const { startBridgeFixture } = require(path.join(root, 'report-email-bridge-fixture.js'));
const viewports = [{ width: 1920, height: 1080 }, { width: 1366, height: 768 }, { width: 900, height: 900 }, { width: 560, height: 900 }, { width: 390, height: 844 }];
const screenshots = [], observations = { errors: [], requests: [], signals: [] };
let assertions = 0, phase = 'initialization';
function check(value, label) { assert(value, label); assertions++; }
function equal(value, expected, label) { assert.deepEqual(value, expected, label); assertions++; }
function step(label) { phase = label; console.log('SITE_UI_2_0_STEP ' + label); }
async function capture(page, name) {
  if (!process.env.WORKSPACE_SCREENSHOT_DIR) return;
  fs.mkdirSync(process.env.WORKSPACE_SCREENSHOT_DIR, { recursive: true });
  const target = path.join(process.env.WORKSPACE_SCREENSHOT_DIR, 'site-ui-2.0-' + name + '.png');
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].filter(image => image.getClientRects().length > 0).map(image => image.decode()));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  // Lobby has a fixed Ready footer: capture the actual viewport rather than
  // placing that footer midway down an artificially extended full-page PNG.
  await page.screenshot({ path: target, fullPage: name.startsWith('home-') }); screenshots.push(target);
}
function observe(page, label) {
  page.on('pageerror', error => observations.errors.push(label + ': ' + error.message));
  page.on('request', request => {
    const pathname = new URL(request.url()).pathname;
    observations.requests.push({ page: label, pathname, method: request.method() });
    if (pathname === '/api/signal' && request.method() === 'POST') observations.signals.push({ page: label, type: request.postDataJSON().type });
  });
}
async function context(browser) { return browser.newContext({ viewport: { width: 1366, height: 768 }, permissions: ['camera', 'microphone', 'clipboard-read', 'clipboard-write'], reducedMotion: 'reduce' }); }
async function pageOf(ctx, label, origin) { const page = await ctx.newPage(); observe(page, label); await page.goto(origin + '/'); return page; }
async function noOverflow(page, label) {
  const geometry = await page.evaluate(() => { const active = document.querySelector('.screen.active'); return { viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth, activeWidth: active?.clientWidth, activeScroll: active?.scrollWidth }; });
  check(geometry.document <= geometry.viewport + 1 && geometry.body <= geometry.viewport + 1, label + ' has no unintended horizontal scroll: ' + JSON.stringify(geometry));
  check(geometry.activeScroll <= geometry.activeWidth + 1, label + ' active screen has no hidden horizontal overflow: ' + JSON.stringify(geometry));
}
async function accessibleControl(page, selector, label, viewportRequired = false) {
  const control = page.locator(selector); check(await control.isVisible(), label + ' is visible');
  if (!viewportRequired) await control.scrollIntoViewIfNeeded();
  const geometry = await control.evaluate(element => {
    const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, viewportWidth: innerWidth, viewportHeight: innerHeight, clientWidth: element.clientWidth, scrollWidth: element.scrollWidth, overflowX: style.overflowX, textOverflow: style.textOverflow, whiteSpace: style.whiteSpace };
  });
  check(geometry.width > 0 && geometry.x >= -1 && geometry.x + geometry.width <= geometry.viewportWidth + 1, label + ' fits horizontally: ' + JSON.stringify(geometry));
  check(geometry.scrollWidth <= geometry.clientWidth + 2, label + ' has no clipped critical label: ' + JSON.stringify(geometry));
  if (viewportRequired) check(geometry.y >= -1 && geometry.y + geometry.height <= geometry.viewportHeight + 1, label + ' remains directly in the viewport: ' + JSON.stringify(geometry));
}
async function tab(page, type, name) {
  const control = page.locator('[data-' + type + '-page="' + name + '"]'); await control.click();
  check(await page.locator('#ui12-' + type + '-' + name).isVisible(), type + ' ' + name + ' panel opens');
  equal(await control.getAttribute('aria-selected'), 'true', type + ' selected state is accessible');
}
async function room(page) {
  await page.waitForFunction(() => document.querySelector('#screenLobby')?.classList.contains('active') && /^[A-Z0-9]{6}$/.test(document.querySelector('#lobbyCode')?.textContent.trim() || '') && state.roomCode === document.querySelector('#lobbyCode').textContent.trim(), {}, { timeout: 30000 });
  return (await page.locator('#lobbyCode').innerText()).trim();
}
async function create(page, { game = 'cyberpunk', timer = true, minutes = 37, gig = false, name = 'Host Site UI 2.0' } = {}) {
  const before = observations.requests.filter(request => request.pathname === '/api/rooms' && request.method === 'POST').length;
  await page.locator('#goCreate').click();
  await page.waitForFunction(() => document.querySelector('#screenLobby').classList.contains('hub-preconnect'));
  equal(observations.requests.filter(request => request.pathname === '/api/rooms' && request.method === 'POST').length, before, 'Create first presents configuration without creating a room');
  check(await page.evaluate(() => state.roomCode === null && state.peerId === null), 'Pre-create screen has no invented Room or peer identity');
  await page.locator('#playerName').fill(name); await page.locator('#gameSelect').selectOption(game);
  await page.locator('#siteCreateTimer').setChecked(timer);
  if (timer) await page.locator('#siteCreateMinutes').fill(String(minutes));
  if (game === 'cyberpunk') await page.locator('#siteCreateGig').setChecked(gig);
  await accessibleControl(page, '#setupContinue', 'Create configuration submit');
  await page.locator('#setupContinue').click(); const code = await room(page);
  await page.waitForFunction(({ timer, minutes, gig, game }) => state.roomSnapshot?.timer?.enabled === timer && (!timer || document.querySelector('#timerMinutes').value === String(minutes)) && state.roomSnapshot?.gigDiceEnabled === (game === 'cyberpunk' && gig), { timer, minutes, gig, game });
  check(await page.locator('#startGame').isDisabled(), 'Host cannot Ready without an opponent and camera');
  return code;
}
async function join(page, code) {
  await page.locator('#goJoin').click(); await page.locator('#playerName').fill('Guest Site UI 2.0');
  await page.locator('#roomCodeInput').fill(code); await page.locator('#setupContinue').click();
  equal(await room(page), code, 'Guest joins the actual Host room');
}
async function activateMedia(page) {
  await tab(page, 'lobby', 'installation'); await page.locator('#enableMedia').click();
  await page.waitForFunction(() => { const video = document.querySelector('#lobbyPreview'); return video.srcObject instanceof MediaStream && video.videoWidth > 0 && video.srcObject.getVideoTracks().some(track => track.readyState === 'live') && video.srcObject.getAudioTracks().some(track => track.readyState === 'live'); }, {}, { timeout: 30000 });
  await page.waitForFunction(() => document.querySelector('#cameraSelect').options.length && document.querySelector('#microSelect').options.length);
  await accessibleControl(page, '#cameraSelect', 'Existing camera selector'); await accessibleControl(page, '#microSelect', 'Existing microphone selector');
  check(await page.locator('#usePhoneCamera').isVisible(), 'Existing Phone Camera entry remains available');
  if (await page.evaluate(() => state.game === 'cyberpunk')) {
    check(await page.locator('#playerLocaleSelect').isVisible(), 'Player Locale is available in personal installation');
    check(await page.locator('#playerLocaleSelect').isEnabled(), 'Player Locale is personal for Host and Guest');
  } else check(!await page.locator('#playerLocaleField').isVisible(), 'Sans jeu hides Player Locale while preserving media');
}
async function responsiveLobby(page, role) {
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    for (const name of ['session', 'installation', 'players']) {
      await tab(page, 'lobby', name); await noOverflow(page, role + ' ' + name + ' at ' + viewport.width);
      await accessibleControl(page, '#startGame', role + ' Ready ' + name + ' at ' + viewport.width, true);
      await accessibleControl(page, '[data-lobby-page="' + name + '"]', role + ' selected navigation at ' + viewport.width);
      const last = { session: '#ui12VisionStatus', installation: '#lobbyToggleMic', players: '.ui12-player-card:last-child dd:last-child' }[name];
      const tail = page.locator(last);
      await tail.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
      const geometry = await tail.evaluate(element => { const rect = element.getBoundingClientRect(), footer = document.querySelector('#ui12LobbyReady').getBoundingClientRect(); return { top: rect.y, bottom: rect.bottom, footerTop: footer.y, hit: element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)) }; });
      check(geometry.top >= -1 && geometry.bottom <= geometry.footerTop - 4, role + ' final ' + name + ' content scrolls fully above Ready with clearance at ' + viewport.width + ': ' + JSON.stringify(geometry));
      check(geometry.hit, role + ' final ' + name + ' content remains accessible at ' + viewport.width);
    }
  }
}
(async () => {
  const started = Date.now(), fixture = await startBridgeFixture({ root }); let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-fake-device-for-media-stream=device-count=2,fps=30', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
    console.log('SITE_UI_2_0_BROWSER_VERSION ' + browser.version());
    step('Home layout, navigation and keyboard');
    const homeContext = await context(browser), home = await pageOf(homeContext, 'home', fixture.origin); let loads = 0; home.on('load', () => loads++);
    for (const viewport of viewports) {
      await home.setViewportSize(viewport);
      for (const name of ['accueil', 'fonctionnement', 'fonctions', 'jeux', 'alpha']) { await tab(home, 'home', name); await noOverflow(home, 'Home ' + name + ' at ' + viewport.width); }
      await tab(home, 'home', 'accueil');
      equal(await home.locator('#ui12-home-accueil h1').innerText(), 'Votre table, pas de frontière.', 'Approved headline at ' + viewport.width);
      for (const id of ['goCreate', 'goJoin']) await accessibleControl(home, '#' + id, id + ' at ' + viewport.width);
      equal(await home.locator('.tcgate-home-steps .tcgate-step-item').count(), 3, 'Three journey steps at ' + viewport.width);
      check(await home.locator('.site-games-available').innerText().then(text => text.includes('Cyberpunk Trading Card Game') && text.includes('Sans jeu')), 'Available games are explicit at ' + viewport.width);
      const preview = home.locator('.site-product-preview img');
      check(await preview.evaluate(img => img.complete && img.naturalWidth > 0), 'Real product visual loads at ' + viewport.width);
      const copyBox = await home.locator('.tcgate-home-copy').boundingBox(), visualBox = await home.locator('.site-product-preview').boundingBox();
      if (viewport.width >= 1366) check(visualBox.x >= copyBox.x + copyBox.width - 1, 'Hero has two real columns at ' + viewport.width);
      if (viewport.width === 390) check(visualBox.y >= copyBox.y + copyBox.height - 1, 'Hero stacks naturally on mobile');
      const header = await home.locator('.ui12-home-header').boundingBox();
      check(header.height <= (viewport.width <= 560 ? 210 : 150), 'Header stays compact at ' + viewport.width + ': ' + header.height);
      await home.evaluate(() => scrollTo(0, 0));
      if (viewport.width === 1920) await capture(home, 'home-desktop');
      if (viewport.width === 390) await capture(home, 'home-mobile');
    }
    await home.locator('[data-home-page="accueil"]').focus(); await home.keyboard.press('ArrowRight');
    equal(await home.locator('[data-home-page="fonctionnement"]').getAttribute('aria-selected'), 'true', 'Navigation supports arrow keys');
    check(await home.locator('[data-home-page="fonctionnement"]').evaluate(element => document.activeElement === element && getComputedStyle(element).outlineStyle !== 'none'), 'Keyboard focus is visible');
    await home.keyboard.press('Home'); equal(await home.locator('[data-home-page="accueil"]').getAttribute('aria-selected'), 'true', 'Home key returns to first navigation item');
    equal(loads, 0, 'Navigation causes no document reload');
    check(await home.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), 'Reduced motion emulation is active');
    step('Create / Join cancellation and validation');
    for (const action of ['goCreate', 'goJoin']) {
      await home.locator('#' + action).click(); await home.waitForFunction(() => document.querySelector('#screenLobby').classList.contains('active'));
      await home.keyboard.press('Escape'); await home.waitForFunction(() => document.querySelector('#screenHome').classList.contains('active'));
      await home.waitForFunction(id => document.activeElement?.id === id, action);
      check(true, action + ' closes on Escape and restores keyboard focus');
    }
    await home.locator('#goCreate').click();
    check(await home.locator('#siteCreateTimer').isChecked(), 'Create retains qualified Timer ON default');
    equal(await home.locator('#siteCreateMinutes').inputValue(), '50', 'Create retains qualified 50-minute default');
    check(await home.locator('#siteCreateGig').isChecked(), 'Create retains qualified Cyberpunk Gig ON default');
    const roomPostsBeforeInvalid = observations.requests.filter(request => request.pathname === '/api/rooms' && request.method === 'POST').length;
    await home.locator('#siteCreateMinutes').fill('0'); await home.locator('#setupContinue').click();
    await home.waitForFunction(() => !document.querySelector('#siteSetupFeedback').hidden && /1 à 180/.test(document.querySelector('#siteSetupFeedback').textContent));
    equal(observations.requests.filter(request => request.pathname === '/api/rooms' && request.method === 'POST').length, roomPostsBeforeInvalid, 'Invalid Create duration sends no Room POST');
    check(await home.locator('#siteCreateMinutes').evaluate(element => document.activeElement === element), 'Invalid Create duration receives focus');
    check(await home.evaluate(() => !state.roomCode && !state.peerId), 'Invalid Create duration invents no Room identity');
    await noOverflow(home, 'Create validation feedback at 390px');
    await home.locator('#siteCreateMinutes').fill('50');
    const createEndpoint = fixture.origin + '/api/rooms'; let simulatedCreateFailures = 0;
    const createUnavailable = async route => {
      if (route.request().method() !== 'POST') return route.continue();
      simulatedCreateFailures++;
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'Le salon est temporairement indisponible. Réessayez.' }) });
    };
    await home.route(createEndpoint, createUnavailable);
    const createRejected = home.waitForResponse(response => response.url() === createEndpoint && response.status() === 503);
    await home.locator('#setupContinue').click(); await createRejected;
    await home.waitForFunction(() => !document.querySelector('#siteSetupFeedback').hidden && /temporairement indisponible/.test(document.querySelector('#siteSetupFeedback').textContent));
    equal(simulatedCreateFailures, 1, 'Exactly one simulated Create 503 exercises retry feedback');
    check(await home.locator('#screenLobby').evaluate(element => element.classList.contains('hub-preconnect')), 'Create service error retains pre-connect configuration');
    check(await home.evaluate(() => !state.roomCode && !state.peerId), 'Create service error invents no Room identity');
    check(await home.locator('#setupContinue').isEnabled(), 'Create can be retried after a service error');
    equal(await home.locator('#siteCreateMinutes').inputValue(), '50', 'Create service error preserves the selected valid duration');
    await accessibleControl(home, '#setupContinue', 'Create retry at 390px'); await noOverflow(home, 'Create service error at 390px');
    await home.unroute(createEndpoint, createUnavailable);
    await home.locator('#leaveLobby').click(); await home.waitForFunction(() => document.querySelector('#screenHome').classList.contains('active'));
    await home.locator('#goJoin').click(); await home.locator('#setupContinue').click();
    await home.waitForFunction(() => !document.querySelector('#toast').classList.contains('hidden') && /code/i.test(document.querySelector('#toast').textContent));
    equal(await home.locator('#roomCodeInput').evaluate(element => document.activeElement === element), true, 'Missing code returns focus to the invalid field');
    await home.locator('#roomCodeInput').fill('ZZZZZZ');
    const denied = home.waitForResponse(response => /\/api\/rooms\/ZZZZZZ\/join$/.test(response.url()));
    await home.locator('#setupContinue').click(); equal((await denied).status(), 404, 'Unknown room reports the real server error');
    await home.waitForFunction(() => !document.querySelector('#toast').classList.contains('hidden') && document.querySelector('#toast').textContent.trim().length > 0);
    check(await home.locator('#screenLobby').evaluate(element => element.classList.contains('hub-preconnect')), 'Join error retains the editable form');
    await home.locator('#leaveLobby').click(); await home.waitForFunction(() => document.querySelector('#screenHome').classList.contains('active'));
    await homeContext.close();
    step('Cyberpunk Host / Guest, options and responsive Lobby');
    const hostContext = await context(browser), guestContext = await context(browser);
    const host = await pageOf(hostContext, 'cyberpunk-host', fixture.origin), guest = await pageOf(guestContext, 'cyberpunk-guest', fixture.origin);
    try {
      const code = await create(host, { timer: true, minutes: 37, gig: false }); await join(guest, code);
      await host.waitForFunction(() => document.querySelector('#lobbyOpponentName').textContent.includes('Guest Site UI'));
      for (const id of ['timerToggle', 'timerMinutes', 'gigDiceToggle']) { check(await host.locator('#' + id).isEnabled(), 'Host edits ' + id); check(await guest.locator('#' + id).isDisabled(), 'Guest reads ' + id + ' only'); }
      check(!await guest.locator('#gameSelect').isVisible(), 'Guest has no editable shared game selector');
      check(await guest.locator('#hubGameReadonlyValue').innerText().then(text => text.includes('Cyberpunk')), 'Guest reads the Host selected game');
      equal(await guest.locator('#timerMinutes').inputValue(), '37', 'Pre-create timer choice reaches the Guest');
      equal(await guest.locator('#gigDiceToggle').getAttribute('aria-pressed'), 'false', 'Pre-create Gig choice reaches the Guest');
      await host.locator('#timerMinutes').fill('42'); await host.locator('#timerMinutes').press('Tab');
      await guest.waitForFunction(() => document.querySelector('#timerMinutes').value === '42'); check(true, 'Existing shared metadata update synchronizes Host and Guest');
      await capture(host, 'lobby-host-desktop'); await capture(guest, 'lobby-guest-desktop');
      await responsiveLobby(host, 'Host'); await responsiveLobby(guest, 'Guest');
      await tab(host, 'lobby', 'players'); await host.evaluate(() => scrollTo(0, 0)); await capture(host, 'lobby-mobile');
      check(await host.locator('#ui12-lobby-players').innerText().then(text => text.includes('Moi') && text.includes('Adversaire')), 'Players identify Moi and Adversaire');
      await host.setViewportSize({ width: 1366, height: 768 }); await guest.setViewportSize({ width: 1366, height: 768 });
      await Promise.all([activateMedia(host), activateMedia(guest)]);
      await host.setViewportSize({ width: 390, height: 844 });
      const webcamBeforePairing = await host.evaluate(() => ({ video: document.querySelector('#lobbyPreview').srcObject.getVideoTracks()[0].id, audio: document.querySelector('#lobbyPreview').srcObject.getAudioTracks()[0].id }));
      await host.locator('#usePhoneCamera').click();
      await host.waitForFunction(() => !document.querySelector('#phoneCameraPanel').classList.contains('hidden') && Boolean(document.querySelector('#copyPhoneCameraLink').dataset.url));
      check(await host.locator('#phoneCameraQr').isVisible(), 'Existing Phone Camera overlay opens with a real pairing QR on 390px mobile layout');
      for (const id of ['copyPhoneCameraLink', 'cancelPhoneCamera']) await accessibleControl(host, '#' + id, 'Mobile pairing ' + id);
      await noOverflow(host, 'Phone Camera overlay at 390px');
      await host.locator('#cancelPhoneCamera').click(); await host.waitForFunction(() => document.querySelector('#phoneCameraPanel').classList.contains('hidden'));
      await host.waitForFunction(() => state.videoSource === 'webcam' && document.querySelector('#lobbyPreview').videoWidth > 0 && document.querySelector('#lobbyPreview').srcObject.getTracks().every(track => track.readyState === 'live'));
      equal(await host.evaluate(() => ({ video: document.querySelector('#lobbyPreview').srcObject.getVideoTracks()[0].id, audio: document.querySelector('#lobbyPreview').srcObject.getAudioTracks()[0].id })), webcamBeforePairing, 'Cancelling mobile pairing preserves the active PC webcam and audio');
    } finally { await Promise.all([hostContext.close(), guestContext.close()]); }
    step('Sans jeu, Ready and real webcam/audio game');
    const noHostContext = await context(browser), noGuestContext = await context(browser);
    const noHost = await pageOf(noHostContext, 'no-game-host', fixture.origin), noGuest = await pageOf(noGuestContext, 'no-game-guest', fixture.origin);
    try {
      const code = await create(noHost, { game: 'no-game', timer: false, gig: false }); await join(noGuest, code);
      for (const page of [noHost, noGuest]) {
        check(await page.locator('#gigDiceToggle').isDisabled(), 'Sans jeu offers no active Gig setting');
        equal(await page.locator('#gigDiceToggle').getAttribute('aria-pressed'), 'false', 'Sans jeu retains Gig disabled');
      }
      await Promise.all([activateMedia(noHost), activateMedia(noGuest)]);
      await noGuest.waitForFunction(() => !document.querySelector('#startGame').disabled); await noGuest.locator('#startGame').click();
      await noHost.waitForFunction(() => state.roomSnapshot.peers.some(peer => peer.role === 'guest' && peer.ready));
      check(await noHost.locator('#screenLobby').evaluate(element => element.classList.contains('active')), 'Guest Ready waits for Host Ready before game');
      await noHost.waitForFunction(() => !document.querySelector('#startGame').disabled); await noHost.locator('#startGame').click();
      for (const page of [noHost, noGuest]) {
        await page.waitForFunction(() => document.querySelector('#screenGame').classList.contains('active') && document.querySelector('#remoteVideo').videoWidth > 0 && document.querySelector('#remoteVideo').srcObject?.getAudioTracks().some(track => track.readyState === 'live'), {}, { timeout: 90000 });
        check(await page.locator('#remoteVideo').isVisible(), 'Real opponent video is displayed after Ready');
        check(await page.locator('#localVideo').isVisible(), 'Local webcam remains visible');
        check(!await page.locator('#gigDicePanel').isVisible(), 'Sans jeu hides Gig Dice');
        check(!await page.locator('#timerChip').isVisible(), 'Disabled Timer stays absent');
        check(await page.evaluate(() => !visionEnabledForCurrentGame() && !state.visionPrepared && !state.visionAssetsLoaded), 'Sans jeu does not initialize Vision');
        check(await page.evaluate(() => state.roomSnapshot.phase === 'game' && state.roomSnapshot.peers.every(peer => peer.ready)), 'Authoritative Room game phase retains both Ready states');
      }
      const noGameSignals = observations.signals.filter(signal => signal.page.startsWith('no-game-'));
      check(['offer', 'answer', 'candidate'].every(type => noGameSignals.some(signal => signal.type === type)), 'Sans jeu uses actual offer / answer / ICE signaling');
      check(noGameSignals.every(signal => signal.type !== 'gig-state'), 'Sans jeu emits no Gig state');
    } finally { await Promise.all([noHostContext.close(), noGuestContext.close()]); }
    equal(observations.errors, [], 'No uncaught browser errors'); equal(fixture.requests.length, 0, 'UI qualification sends no report email');
    console.log('SITE_UI_2_0_BROWSER_OK ' + JSON.stringify({ assertions, viewports: viewports.map(viewport => viewport.width + 'x' + viewport.height), browser: browser.version(), screenshots, realRoomSseWebRtc: true, syntheticCameraAudio: true, physicalDevicesQualified: false, playerLocale: 'PERSONAL (JALON 3)', visionLocale: 'NOT IMPLEMENTED', elapsedSeconds: Math.round((Date.now() - started) / 1000) }));
  } finally { await browser?.close(); await fixture.close(); }
})().catch(error => { console.error('SITE_UI_2_0_BROWSER_FAILURE phase=' + phase + '\n' + error.stack); process.exitCode = 1; });
