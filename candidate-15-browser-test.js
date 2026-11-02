'use strict';
// Complements the existing UI/mail/Phone browser suites; real local server and WebRTC.
// Browser devices are synthetic. No remote TURN, physical Vision or real email claim.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { chromium } = require(process.env.WORKSPACE_PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(process.env.CANDIDATE_TEST_ROOT || process.cwd());
const { startBridgeFixture } = require(path.join(root, 'report-email-bridge-fixture.js'));
let assertions = 0, phase = 'initialization';
const check = (value, label) => { assert(value, label); assertions++; };
const equal = (actual, expected, label) => { assert.deepEqual(actual, expected, label); assertions++; };
const step = value => { phase = value; console.log('C15_BROWSER_STEP ' + value); };
const sources = Object.fromEntries(['server.js', 'public/app.js', 'public/future-ux-v3.7.js', 'public/future-ux-v3.7.css', 'public/index.html'].map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex')]));
const session = page => page.evaluate(() => { const s = JSON.parse(sessionStorage.getItem('tcgate-alpha-room-session-v1')); return { room: s.roomCode, peer: s.peerId }; });
async function liveMedia(page, label) {
  await page.waitForFunction(() => {
    const local = document.querySelector('#localVideo'), remote = document.querySelector('#remoteVideo');
    return document.querySelector('#screenGame').classList.contains('active') && [local, remote].every(v => v.srcObject instanceof MediaStream && v.videoWidth > 0 && v.srcObject.getVideoTracks().some(t => t.readyState === 'live') && v.srcObject.getAudioTracks().some(t => t.readyState === 'live'));
  }, {}, { timeout: 90000 });
  for (const id of ['localVideo', 'remoteVideo']) {
    const fresh = await page.evaluate(id => new Promise(resolve => {
      const v = document.getElementById(id), deadline = setTimeout(() => resolve(false), 12000);
      v.requestVideoFrameCallback(() => { clearTimeout(deadline); resolve(v.videoWidth > 0); });
    }), id);
    check(fresh, label + ': fresh ' + id + ' decoded frame');
  }
  await page.waitForFunction(async () => {
    if (!state.pc || state.pc.connectionState !== 'connected') return false;
    const stats = [...(await state.pc.getStats()).values()];
    return ['audio', 'video'].every(kind => stats.some(s => s.type === 'inbound-rtp' && (s.kind || s.mediaType) === kind && s.packetsReceived > 0));
  }, {}, { timeout: 30000 });
  const media = await page.evaluate(async () => {
    const stats = [...(await state.pc.getStats()).values()];
    const selected = stats.find(s => s.type === 'transport' && s.selectedCandidatePairId);
    const pair = selected ? stats.find(s => s.id === selected.selectedCandidatePairId) : stats.find(s => s.type === 'candidate-pair' && s.nominated && s.state === 'succeeded');
    const local = stats.find(s => s.id === pair?.localCandidateId), remote = stats.find(s => s.id === pair?.remoteCandidateId);
    return { inbound: stats.filter(s => s.type === 'inbound-rtp').map(s => ({ kind: s.kind || s.mediaType, packets: s.packetsReceived, frames: s.framesDecoded ?? null })), localCandidateType: local?.candidateType ?? null, remoteCandidateType: remote?.candidateType ?? null };
  });
  console.log('C15_MEDIA ' + label + ' ' + JSON.stringify(media));
  check(media.inbound.some(s => s.kind === 'audio' && s.packets > 0), label + ': inbound RTP audio');
  check(media.inbound.some(s => s.kind === 'video' && s.frames > 0), label + ': inbound RTP decoded video');
}
async function createPair(browser, origin, name, game, observations) {
  const contexts = await Promise.all([0, 1].map(() => browser.newContext({ viewport: { width: 1366, height: 900 }, permissions: ['camera', 'microphone'] })));
  const [host, guest] = await Promise.all(contexts.map(c => c.newPage()));
  for (const [role, page] of [['host', host], ['guest', guest]]) {
    page.on('pageerror', e => observations.errors.push(name + '/' + role + ': ' + e.message));
    page.on('request', request => {
      const pathname = new URL(request.url()).pathname;
      observations.requests.push({ room: name, role, pathname });
      if (request.method() === 'POST' && pathname === '/api/signal') {
        const body = request.postDataJSON(); observations.signals.push({ room: name, role, type: body.type });
      }
    });
  }
  await host.goto(origin + '/'); await host.locator('#goCreate').click(); await host.locator('#setupContinue').click();
  await host.waitForFunction(() => /^[A-Z0-9]{6}$/.test(document.querySelector('#lobbyCode').textContent.trim()));
  const code = (await host.locator('#lobbyCode').innerText()).trim();
  if (game !== 'cyberpunk') await host.locator('#gameSelect').selectOption(game);
  await host.locator('#playerName').fill('Host ' + name); await host.locator('#playerName').press('Tab');
  await guest.goto(origin + '/'); await guest.locator('#goJoin').click();
  await guest.locator('#playerName').fill('Guest ' + name); await guest.locator('#roomCodeInput').fill(code); await guest.locator('#setupContinue').click();
  await guest.waitForFunction(expected => document.querySelector('#lobbyCode').textContent.trim() === expected, code);
  await host.waitForFunction(() => document.querySelector('#lobbyOpponentName').textContent.startsWith('Guest '));
  return { host, guest, pages: [host, guest], close: () => Promise.all(contexts.map(c => c.close())) };
}
async function start(pair) {
  for (const page of pair.pages) {
    await page.locator('[data-lobby-page="installation"]').click(); await page.locator('#enableMedia').click();
    await page.waitForFunction(() => document.querySelector('#lobbyPreview').videoWidth > 0 && document.querySelector('#lobbyPreview').srcObject?.getAudioTracks().some(t => t.readyState === 'live'));
    await page.waitForFunction(() => !document.querySelector('#startGame').disabled);
  }
  await pair.host.locator('#startGame').click(); await pair.guest.locator('#startGame').click();
  await Promise.all(pair.pages.map((p, i) => liveMedia(p, 'initial-' + (i ? 'guest' : 'host'))));
}
async function recovery(pair, name, reloadPages) {
  const before = await Promise.all(pair.pages.map(session));
  await Promise.all(reloadPages.map(p => p.reload()));
  await Promise.all(pair.pages.map((p, i) => liveMedia(p, name + '-' + (i ? 'guest' : 'host'))));
  equal(await Promise.all(pair.pages.map(session)), before, name + ': both room and peer identities preserved');
  for (const page of pair.pages) check(await page.evaluate(() => state.gameActive && state.roomSnapshot.phase === 'game' && state.roomSnapshot.peers.every(p => p.ready)), name + ': game and Ready retained');
  console.log('C15_RECOVERY_PASS ' + name);
}
async function noGame(browser, origin, observations) {
  step('no-game media, timer off, Host/Guest/double F5');
  const pair = await createPair(browser, origin, 'no-game', 'no-game', observations);
  try {
    await pair.host.locator('#timerToggle').click();
    await pair.guest.waitForFunction(() => document.querySelector('#timerToggle').getAttribute('aria-pressed') === 'false');
    await start(pair);
    await recovery(pair, 'F5 Host', [pair.host]);
    await recovery(pair, 'F5 Guest', [pair.guest]);
    await recovery(pair, 'Double F5', pair.pages);
    for (const page of pair.pages) {
      check(await page.locator('#screenGame').evaluate(e => e.classList.contains('no-vision-mode')), 'No-game Table suppresses Vision');
      check(!await page.locator('#gigDicePanel').isVisible(), 'No-game suppresses Gig panel');
      check(!await page.locator('#timerChip').isVisible(), 'Timer OFF suppresses Table chip, including recovery');
      check(await page.evaluate(() => !visionEnabledForCurrentGame() && !state.visionPrepared && !state.visionAssetsLoaded), 'No-game never initializes Vision');
    }
    const noGameSignals = observations.signals.filter(s => s.room === 'no-game');
    check(['offer', 'answer', 'candidate'].every(type => noGameSignals.some(s => s.type === type)), 'Real offer/answer/candidates observed during no-game');
    check(noGameSignals.every(s => s.type !== 'gig-state'), 'No-game never emits Gig state');
    check(!observations.requests.some(r => r.room === 'no-game' && (/card-detector|\.onnx$|\/vision-core\.js$|\/identification\.js$/.test(r.pathname))), 'No-game does not request detector or identification assets');
  } finally { await pair.close(); }
}
async function timer(pair) {
  step('Timer ON, start/pause/reset and cross-peer synchronization');
  for (const page of pair.pages) check(await page.locator('#timerChip').isVisible(), 'Timer ON Table chip visible');
  await pair.host.locator('#timerChip').click(); await pair.host.locator('#timerStart').click();
  for (const page of pair.pages) await page.waitForFunction(() => state.timer.running && timerRemainingSeconds() < 120);
  let values = await Promise.all(pair.pages.map(p => p.evaluate(() => ({ enabled: state.timer.enabled, running: state.timer.running, endsAt: state.timer.endsAt, revision: state.timer.revision }))));
  equal(values[0], values[1], 'Running Timer authority and deadline synchronized');
  const start = await pair.host.locator('#timerText').innerText();
  await pair.host.waitForFunction(previous => document.querySelector('#timerText').textContent !== previous, start);
  await pair.host.locator('#timerStart').click();
  for (const page of pair.pages) await page.waitForFunction(() => !state.timer.running && state.timer.remainingSeconds < 120);
  values = await Promise.all(pair.pages.map(p => p.evaluate(() => ({ running: state.timer.running, remaining: state.timer.remainingSeconds, revision: state.timer.revision }))));
  equal(values[0], values[1], 'Paused Timer remainder synchronized');
  await pair.host.locator('#timerReset').click();
  for (const page of pair.pages) await page.waitForFunction(() => !state.timer.running && state.timer.remainingSeconds === 120);
  equal(await pair.host.locator('#timerText').innerText(), await pair.guest.locator('#timerText').innerText(), 'Reset Timer text synchronized');
  await pair.host.locator('#timerChip').click();
}
async function gigAudit(pair) {
  step('Gig Dice real hit zones and centered zoom at desktop/narrow widths');
  const observations = [], problems = [];
  for (const viewport of [{ width: 1366, height: 900 }, { width: 900, height: 900 }, { width: 560, height: 900 }]) {
    await pair.host.setViewportSize(viewport);
    if (await pair.host.locator('#gigTotem').getAttribute('aria-expanded') !== 'true') await pair.host.locator('#gigTotem').click();
    await pair.host.waitForFunction(() => document.querySelector('#gigDicePanel').classList.contains('open'));
    await pair.host.waitForTimeout(350);
    const tokens = await pair.host.locator('.die-token2').evaluateAll(elements => elements.map(e => ({ id: e.closest('[data-die-id]').dataset.dieId, label: e.getAttribute('title') })));
    equal(tokens.length, 12, 'All twelve real Gig dice present at width ' + viewport.width);
    for (const token of tokens) {
      const locator = pair.host.locator('[data-die-id="' + token.id + '"] .die-token2');
      const box = await locator.boundingBox();
      for (const [probe, rx, ry] of [['center', .5, .5], ['left', .12, .5], ['right', .88, .5], ['top-inner', .5, .28], ['bottom-inner', .5, .72]]) {
        await pair.host.mouse.move(1, 1); await pair.host.waitForFunction(() => !document.querySelector('.die-zoom-layer'));
        const x = box.x + box.width * rx, y = box.y + box.height * ry;
        await pair.host.mouse.move(x, y); await pair.host.waitForTimeout(40);
        const hit = await pair.host.evaluate(({ x, y, id }) => {
          const target = document.elementFromPoint(x, y), source = [...document.querySelectorAll('.die-slot2')].find(s => s.dataset.dieId === id)?.querySelector('.die-token2'), layer = document.querySelector('.die-zoom-layer');
          const src = source?.getBoundingClientRect(), zoom = layer?.getBoundingClientRect();
          return { targetTag: target?.tagName, hitId: target?.closest('.die-slot2')?.dataset.dieId ?? null, hitToken: Boolean(target?.closest('.die-token2')), zoomPresent: Boolean(layer), correct: gigDieZoom.dieId === id, offsetX: zoom && src ? zoom.x + zoom.width / 2 - src.x - src.width / 2 : null, offsetY: zoom && src ? zoom.y + zoom.height / 2 - src.y - src.height / 2 : null, zoomRatio: zoom && src ? zoom.width / src.width : null };
        }, { x, y, id: token.id });
        const pass = hit.hitToken && hit.hitId === token.id && hit.zoomPresent && hit.correct && Math.abs(hit.offsetX) < 1 && Math.abs(hit.offsetY) < 1 && Math.abs(hit.zoomRatio - 2.6) < .03;
        observations.push({ width: viewport.width, die: token.id, probe, pass, ...hit });
        if (pass) assertions++; else problems.push(observations.at(-1));
      }
    }
    if (process.env.WORKSPACE_SCREENSHOT_DIR) { fs.mkdirSync(process.env.WORKSPACE_SCREENSHOT_DIR, { recursive: true }); await pair.host.screenshot({ path: path.join(process.env.WORKSPACE_SCREENSHOT_DIR, 'candidate15-gig-' + viewport.width + '.png') }); }
  }
  console.log('C15_GIG_AUDIT ' + JSON.stringify({ status: problems.length ? 'FOLLOW-UP INTERMEDIAIRE' : 'PASS AUTOMATED GEOMETRY', probes: observations.length, failed: problems.length, problems }));
  if (process.env.CANDIDATE_GIG_AUDIT_PATH) fs.writeFileSync(process.env.CANDIDATE_GIG_AUDIT_PATH, JSON.stringify({ observations, problems }, null, 2));
  return problems;
}
(async () => {
  const started = Date.now(), fixture = await startBridgeFixture({ root });
  const observations = { errors: [], requests: [], signals: [] }; let browser;
  try {
    console.log('C15_BROWSER_SOURCE_SHA256 ' + JSON.stringify(sources));
    browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-fake-device-for-media-stream=device-count=3,fps=30', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
    console.log('C15_BROWSER_VERSION ' + browser.version());
    await noGame(browser, fixture.origin, observations);
    step('Cyberpunk real media and Timer ON');
    const pair = await createPair(browser, fixture.origin, 'cyberpunk', 'cyberpunk', observations); let gigProblems;
    try {
      await pair.host.locator('#timerMinutes').fill('2'); await pair.host.locator('#timerMinutes').press('Tab');
      await pair.guest.waitForFunction(() => document.querySelector('#timerMinutes').value === '2');
      await start(pair); await timer(pair); gigProblems = await gigAudit(pair);
    } finally { await pair.close(); }
    equal(observations.errors, [], 'No uncaught browser errors');
    equal(fixture.requests.length, 0, 'Complement sends no email');
    check(gigProblems.length === 0, 'Gig hover/zoom issue requires separate follow-up; no product correction performed');
    console.log('CANDIDATE_15_BROWSER_RESULT ' + JSON.stringify({ assertions, noGameMedia: 'PASS', f5Host: 'PASS', f5Guest: 'PASS', doubleF5: 'PASS', timerOnOffSync: 'PASS', gigGeometry: 'PASS', syntheticHardware: true, physicalRelay: 'NOT TESTED', physicalVision: 'NOT TESTED', elapsedSeconds: Math.round((Date.now() - started) / 1000) }));
  } finally { await browser?.close(); await fixture.close(); }
})().catch(error => { console.error('C15_BROWSER_FAILURE phase=' + phase + '\n' + error.stack); process.exitCode = 1; });
