'use strict';
// Real local HTTP/Room/SSE/WebRTC and normal app/Vision modules. Chromium A/V,
// controlled track/crop inputs and scalar memory events below are AUTOMATED
// fixtures. They provide no physical qualification and never rewrite evidence.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { chromium } = require(process.env.WORKSPACE_PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(process.env.VISION_REAL_GAME_TEST_ROOT || process.cwd());
const { startBridgeFixture } = require(path.join(root, 'report-email-bridge-fixture.js'));
const historicalSha = '6d08ad3fde309a6c38990ba82ef4e56aa2e21597';
const buildSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const dbPrefix = 'https://raw.githubusercontent.com/maximelaburthe-commits/tcgate_db_cyberpunk/56402636a77af9c8b5dc4e3b61c509a185f3c834/';
const historicalPrefix = 'https://raw.githubusercontent.com/maximelaburthe-commits/TCGate/' + historicalSha + '/';
const results = { mode: 'AUTOMATED', physicalQualification: 'NOT_PERFORMED', errors: [], requests: [], screenshots: [], downloads: [], downloadedProofs: [], timings: [], cases: [] };
let assertions = 0, phase = 'initialization';
function check(value, label) { assert(value, label); assertions++; }
function equal(actual, expected, label) { assert.deepEqual(actual, expected, label); assertions++; }
function step(label) { phase = label; console.log('VISION_REAL_GAME_BROWSER_STEP ' + label); }
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
async function documents() {
  const all = new Map();
  async function read(relative) {
    const local = process.env.TCGATE_DB_FIXTURE_ROOT && path.join(process.env.TCGATE_DB_FIXTURE_ROOT, relative);
    const bytes = local && fs.existsSync(local) ? fs.readFileSync(local) : Buffer.from(await (await fetch(dbPrefix + relative)).arrayBuffer());
    all.set(relative, bytes); return JSON.parse(bytes);
  }
  const manifest = await read('manifest.json');
  await Promise.all([manifest.database_manifest, manifest.entrypoint || manifest.runtime_cards, manifest.runtime_printings, manifest.canonical_vision_index, manifest.printing_recognition_index, manifest.recognition_groups].map(read));
  const rich = JSON.parse(all.get(manifest.printing_recognition_index));
  const assets = [...new Set(rich.cards.flatMap(card => card.recognitionGroups.flatMap(group => group.references.map(reference => reference.visionAssetPath))))];
  equal(assets.length, 229, '229 authentic pinned EN reference assets'); return { all, assets };
}
async function makeContext(browser, origin, pinned, entry) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, permissions: ['camera', 'microphone'], acceptDownloads: true, reducedMotion: 'reduce' });
  await context.route(dbPrefix + '**', async route => {
    const relative = decodeURIComponent(route.request().url().slice(dbPrefix.length));
    const local = process.env.TCGATE_DB_FIXTURE_ROOT && path.join(process.env.TCGATE_DB_FIXTURE_ROOT, relative);
    if (pinned.all.has(relative)) return route.fulfill({ status: 200, body: pinned.all.get(relative), contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } });
    if (local && fs.existsSync(local)) return route.fulfill({ status: 200, body: fs.readFileSync(local), contentType: 'image/webp', headers: { 'access-control-allow-origin': '*' } });
    return route.continue();
  });
  await context.route(historicalPrefix + '**', route => {
    const relative = route.request().url().slice(historicalPrefix.length);
    if (['VISION_NOMINAL_QUALIFICATION_RECEIPT.json', 'VISION_QUALIFICATION_SAMPLE.json'].includes(relative)) return route.fulfill({ status: 200, body: execFileSync('git', ['show', historicalSha + ':' + relative], { cwd: root }), contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } });
    return route.abort();
  });
  const page = await context.newPage();
  page.on('pageerror', error => results.errors.push(error.message));
  page.on('request', request => results.requests.push({ path: new URL(request.url()).pathname, method: request.method() }));
  await page.goto(origin + entry); await page.waitForFunction(() => window.TCGateSiteUi20);
  return { context, page };
}
async function create(page) {
  await page.locator('#goCreate').click(); await page.locator('#playerName').fill('AUTOMATED Host'); await page.locator('#gameSelect').selectOption('cyberpunk');
  await page.locator('#siteCreateTimer').uncheck(); await page.locator('#siteCreateGig').uncheck(); await page.locator('#setupContinue').click();
  await page.waitForFunction(() => state.roomCode && document.querySelector('#screenLobby').classList.contains('active'));
  return page.locator('#lobbyCode').innerText().then(value => value.trim());
}
async function join(page, code) {
  await page.locator('#goJoin').click(); await page.locator('#playerName').fill('AUTOMATED Guest'); await page.locator('#roomCodeInput').fill(code); await page.locator('#setupContinue').click();
  await page.waitForFunction(() => state.roomCode && document.querySelector('#screenLobby').classList.contains('active'));
}
async function media(page) {
  await page.locator('[data-lobby-page="installation"]').click(); await page.locator('#enableMedia').click();
  await page.waitForFunction(() => document.querySelector('#lobbyPreview').videoWidth > 0 && document.querySelector('#mediaStatus').classList.contains('ready') && !state.rtcPrewarmPending, {}, { timeout: 40000 });
}
async function normalReady(host, guest) {
  for (const page of [host, guest]) await page.waitForFunction(() => { const s = window.TCGIdentificationLab?.getSnapshot(); return s?.libraryReady && s.librarySize === 229 && s.matcherWorker.ready; }, {}, { timeout: 120000 });
  await Promise.all([media(host), media(guest)]);
  await guest.waitForFunction(() => !document.querySelector('#startGame').disabled); await guest.locator('#startGame').click();
  await host.waitForFunction(() => !document.querySelector('#startGame').disabled); await host.locator('#startGame').click();
  for (const page of [host, guest]) await page.waitForFunction(() => document.querySelector('#screenGame').classList.contains('active') && document.querySelector('#remoteVideo').videoWidth > 0 && window.TCGVisionEngine?.getSnapshot()?.active && window.TCGVisionEngine?.getSnapshot()?.modelReady, {}, { timeout: 120000 });
}
async function exportReport(page) {
  const download = page.waitForEvent('download'); await page.locator('#vrg-export').click(); const artifact = await download;
  const report = JSON.parse(fs.readFileSync(await artifact.path(), 'utf8'));
  check(artifact.suggestedFilename().includes(report.clockId), 'Export filename identifies its unique local campaign clock');
  check(!results.downloads.includes(artifact.suggestedFilename()), 'Each export has a distinct filename preserving previous exports'); results.downloads.push(artifact.suggestedFilename()); results.downloadedProofs.push({ file: await artifact.path(), sha256: digest(fs.readFileSync(await artifact.path())) });
  if (process.env.WORKSPACE_SCREENSHOT_DIR) { const target = path.join(process.env.WORKSPACE_SCREENSHOT_DIR, 'vision-real-game-browser-export-' + results.cases.length + '.json'); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, JSON.stringify(report, null, 2)); }
  return report;
}
async function screenshot(page, name) {
  if (!process.env.WORKSPACE_SCREENSHOT_DIR) return;
  const filename = path.join(process.env.WORKSPACE_SCREENSHOT_DIR, 'vision-real-game-' + name + '.png'); fs.mkdirSync(path.dirname(filename), { recursive: true }); await page.screenshot({ path: filename }); results.screenshots.push(filename);
}
async function hover(page, inside) {
  const point = await page.evaluate(inside => {
    if (!inside) return { x: 10, y: 10 };
    const stage = TCGDetectionLab.els.videoStage, video = TCGDetectionLab.els.video, rect = stage.getBoundingClientRect(), t = window.__realGameTrack;
    const scale = Math.min(rect.width / video.videoWidth, rect.height / video.videoHeight);
    return { x: rect.left + (rect.width - video.videoWidth * scale) / 2 + t.cx * scale, y: rect.top + (rect.height - video.videoHeight * scale) / 2 + t.cy * scale };
  }, inside);
  await page.mouse.move(point.x, point.y, { steps: 4 });
}
async function run() {
  const nativeEntry = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
  const entry = fs.readFileSync(path.join(root, 'public/vision-real-game.html'), 'utf8');
  const removed = entry.replace('  <link rel="stylesheet" href="/vision-real-game.css">\n', '').replace(/  <script src="\/(?:vision-qualification-receipt|vision-real-game-baseline|vision-real-game-campaign|vision-real-game-observer|vision-real-game-ui)\.js"><\/script>\n/g, '');
  equal(digest(removed), digest(nativeEntry), 'Separate entry is exactly the normal product plus isolated campaign tags');
  const uiSource = fs.readFileSync(path.join(root, 'public/vision-real-game-ui.js'), 'utf8');
  check(!/beginQualificationTracking|captureCanonicalTrackCanvas|\.identifyTrack|\.reset\(|\.setContext\(|\.preload\(|\.startProductIdentification|TCGVisionEngine\s*\./.test(uiSource), 'Campaign UI cannot trigger or alter the engine');
  process.env.GIT_COMMIT_SHA = buildSha; process.env.RAILWAY_GIT_COMMIT_SHA = buildSha;
  const pinned = await documents(), fixture = await startBridgeFixture({ root }); let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-fake-device-for-media-stream=device-count=2,fps=30', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
    console.log('VISION_REAL_GAME_BROWSER_VERSION ' + browser.version());
    const h = await makeContext(browser, fixture.origin, pinned, '/vision-real-game.html'), g = await makeContext(browser, fixture.origin, pinned, '/'); const host = h.page, guest = g.page;
    step('Normal Room, Ready and WebRTC with unchanged Vision and 229 authentic assets');
    const code = await create(host); await join(guest, code); await normalReady(host, guest);
    check(await host.evaluate(() => state.gameActive && state.roomSnapshot.phase === 'game' && document.querySelector('#remoteVideo').srcObject instanceof MediaStream), 'Normal real Room game and received WebRTC media are active');
    check(await host.evaluate(() => !TCGIdentificationLab.getSnapshot().qualificationTracking?.active), 'Nominal automatic harness remains inactive');
    equal(await guest.locator('#vrg-panel').count(), 0, 'Ordinary product entry has no campaign UI');
    await host.locator('#vrg-open > summary').click(); await host.locator('#vrg-prepare').click();
    check((await host.locator('#vrg-status').innerText()).includes('Confirmez'), 'Physical setup and printing confirmation required');
    await host.locator('#vrg-framing').check(); await host.locator('#vrg-corpus').check(); await host.locator('#vrg-provenance').selectOption('automated'); await host.locator('#vrg-prepare').click();
    await host.waitForFunction(() => document.querySelector('#vrg-cards').children.length === 10);
    check(!await host.evaluate(() => TCGVisionRealGameUi.getState().prepared), 'Roster is fixed before a session is created');
    equal(await host.locator('#vrg-cards select').count(), 10, 'Ten predeclared slots with active corpus alternatives');
    await host.locator('#vrg-prepare').click();
    await host.waitForFunction(() => window.TCGVisionRealGameUi?.getState()?.prepared || document.querySelector('#vrg-status').classList.contains('vrg-error'), {}, { timeout: 30000 });
    check(await host.evaluate(() => TCGVisionRealGameUi.getState().prepared), 'Real normal context and historical receipt prepare the independent profile: ' + await host.locator('#vrg-status').innerText() + ' / ' + await host.locator('#vrg-nominal').innerText());
    equal(await host.locator('#vrg-phase option').count(), 7, 'Seven phases, not a rewritten nominal matrix');
    check((await host.locator('#vrg-nominal').innerText()).includes('43/45'), 'Historical 43/45 is visible and separate');
    await screenshot(host, 'prepared-desktop');
    const initial = await exportReport(host); equal(initial.provenance, 'automated', 'Synthetic sessions explicitly remain automated');
    equal(initial.observations.length, 0, 'Preparing does not create fake physical observations');
    check(initial.nominalBaseline?.includedInCurrentDenominators === false, 'Historical 45 trials never enter current denominators');
    step('Real pointer motion uses normal foreground and Table State on authentic track/crop fixture');
    await host.evaluate(async () => {
      const refs = await TCGateDatabaseSource.getVisionReferences('cyberpunk', 'en');
      const ref = refs.find(r => r.cardId === 'cp-mantis-blades' && (r.printingId === 'cpp-03290e8752e5e383' || r.referencePrintingId === 'cpp-03290e8752e5e383'));
      window.__realGameReference = ref;
      // The normal engines remain loaded and run unchanged. Only their physical
      // input boundary is synthetic in this explicitly automated test.
      window.__realGameOriginalTracks = TCGDetectionLab.activeTracks;
      window.__realGameOriginalCapture = TCGDetectionLab.captureCanonicalTrackCanvas;
      const video = TCGDetectionLab.els.video;
      window.__realGameTrack = { uid: 7001, displayId: 1, conf: .99, cx: video.videoWidth * .35, cy: video.videoHeight * .45, w: 150, h: 216, angle: 0, misses: 0 };
      TCGDetectionLab.activeTracks = () => window.__realGameTrack ? [window.__realGameTrack] : [];
      const src = ref.visionAssetUrl || ref.visionAssetPath || ref.imageUrl || ref.image;
      const image = new Image(); image.crossOrigin = 'anonymous'; image.src = src; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = 216; canvas.height = 312; canvas.getContext('2d').drawImage(image, 0, 0, 216, 312);
      window.__realGameCropCalls = 0;
      TCGDetectionLab.captureCanonicalTrackCanvas = () => { window.__realGameCropCalls++; return canvas; };
      window.dispatchEvent(new CustomEvent('tcg-tracks-updated', { detail: {} }));
    });
    await host.locator('#vrg-start').click(); await host.locator('#vrg-present').click(); await host.locator('#vrg-open > summary').click();
    await hover(host, false); const beforeHover = await host.evaluate(() => TCGIdentificationLab.getSnapshot().scheduling.visionFramesRequested); await host.waitForTimeout(600);
    equal(await host.evaluate(() => TCGIdentificationLab.getSnapshot().scheduling.visionFramesRequested), beforeHover, 'Passive observer adds no foreground recognition while pointer is outside');
    await host.waitForFunction(() => TCGTableStateEngine.getSnapshot().entries.some(entry => entry.activeUid === 7001 && entry.identity && !entry.identitySuspended && !entry.needsReacquireVerification), {}, { timeout: 20000 });
    await hover(host, true);
    await host.waitForFunction(() => TCGIdentificationLab.getSnapshot().visibleIdentity?.accepted, {}, { timeout: 20000 });
    check(await host.evaluate(() => window.__realGameCropCalls > 0), 'Normal unchanged Vision engines consumed the authentic synthetic crop');
    await host.waitForFunction(() => TCGVisionRealGameUi.getState().campaign.activeObservation?.firstCorrectDisplayAtMs !== null, {}, { timeout: 20000 }).catch(async error => { console.error('DISPLAY_DEBUG ' + JSON.stringify(await host.evaluate(() => {const i=document.getElementById('identImage');return {snapshot:TCGIdentificationLab.getSnapshot(),image:{src:i.src,currentSrc:i.currentSrc,complete:i.complete,naturalWidth:i.naturalWidth,url:i.dataset.cardUrl,pending:i.dataset.swapPending,rect:i.getBoundingClientRect().toJSON()},active:TCGVisionRealGameUi.getState()};}))); throw error; }); await host.waitForTimeout(100); await hover(host, false);
    await host.locator('#vrg-open > summary').click(); await host.locator('#vrg-end').click();
    const foreground = await exportReport(host); results.cases.push('normal-product-display'); results.timings.push(...foreground.consultations.map(c => ({ source: c.source, firstResultSource: c.firstResultSource, responseMs: c.responseMs, preexistingIdentity: c.preexistingIdentity })));
    check(foreground.consultations.length >= 1, 'Genuine hover creates a consultation');
    check(foreground.consultations.some(c => c.requestOrigin === 'HUMAN_POINTER'), 'Request origin is actual human pointer API simulation');
    check(foreground.consultations.some(c => c.status === 'SUCCESS' || c.outcome === 'CORRECT' || c.correct === true), 'Correct displayed normal product response is measured');
    check(foreground.consultations.some(c => typeof c.responseMs === 'number' && c.responseMs >= 0), 'Demand to displayed result latency measured on one monotonic clock');
    step('Second hover, retained preview and native memory are distinct');
    await host.locator('#vrg-job').selectOption('0');
    await host.locator('#vrg-start').click(); await host.locator('#vrg-present').click(); await host.locator('#vrg-open > summary').click();
    await hover(host, true); await host.waitForTimeout(300); await hover(host, false); await host.waitForTimeout(100);
    await host.locator('#vrg-open > summary').click(); await host.locator('#vrg-end').click(); const cached = await exportReport(host); results.cases.push('cache');
    check(cached.consultations.length > foreground.consultations.length, 'Second actual hover retained as a distinct consultation');
    check(cached.consultations.some(c => c.source === 'HOVER_CACHE' || c.source === 'PREEXISTING' || c.preexistingIdentity === true), 'Cache or preexisting identity is not called first recognition');
    step('Observer off/on preserves the normal foreground request and native result');
    const parity = [];
    for (const [enabled, targetUid] of [[false, 8101], [true, 8102]]) {
      await host.locator('#vrg-pause').click();
      equal(await host.evaluate(() => TCGVisionRealGameUi.getState().observer.running), enabled, 'Passive observation lifecycle matches parity condition');
      await host.locator('#vrg-open > summary').click(); await hover(host, false);
      const before = await host.evaluate(uid => { window.__realGameTrack = { ...window.__realGameTrack, uid }; window.dispatchEvent(new CustomEvent('tcg-tracks-updated')); return TCGIdentificationLab.getSnapshot().scheduling.visionFramesRequested; }, targetUid);
      await hover(host, true);
      await host.waitForFunction(({ uid, before }) => { const s = TCGIdentificationLab.getSnapshot(); return s.hoveredTrack?.uid === uid && s.identification?.accepted && s.scheduling.visionFramesProcessed > before; }, { uid: targetUid, before }, { timeout: 20000 });
      parity.push(await host.evaluate(before => { const s = TCGIdentificationLab.getSnapshot(); return { framesRequested: s.scheduling.visionFramesRequested - before, cardId: s.identification.best.cardId, librarySize: s.librarySize, qualificationActive: Boolean(s.qualificationTracking?.active) }; }, before));
      await hover(host, false); await host.locator('#vrg-open > summary').click();
    }
    equal(parity[1], parity[0], 'Same genuine pointer/input sequence causes the same native requests and identity with observer off/on');
    equal(parity[0].cardId, 'cp-mantis-blades', 'Off/on comparison uses a real normal matcher result');
    check(parity[0].framesRequested > 0, 'Off/on comparison actually exercised normal foreground matching');
    results.cases.push('observer-off-on-parity');
    step('Scalar memory fixtures keep wrong accepted identities visible in reporting');
    await host.locator('#vrg-job').selectOption('0'); await host.locator('#vrg-start').click(); await host.locator('#vrg-present').click(); await host.locator('#vrg-open > summary').click();
    await hover(host, true);
    const memoryShown = await host.evaluate(() => TCGIdentificationLab.showMemoryIdentity({ name: 'Mantis Blades', image: window.__realGameReference.refId, trackUid: window.__realGameTrack.uid, tableId: 'automated-memory-A', observations: 2 }));
    check(memoryShown, 'Normal memory presentation API accepted an authentic reference scalar fixture');
    await host.waitForTimeout(100);
    const wrongShown = await host.evaluate(async () => { const refs = await TCGateDatabaseSource.getVisionReferences('cyberpunk', 'en'); const other = refs.find(ref => ref.cardId === 'cp-arasaka-emergency-radioport'); return TCGIdentificationLab.showMemoryIdentity({ name: 'Arasaka Emergency Radioport', image: other.refId, trackUid: window.__realGameTrack.uid, tableId: 'automated-memory-WRONG', observations: 1 }); });
    check(wrongShown, 'Explicitly synthetic wrong-memory presentation is exercised without changing matcher');
    await host.waitForTimeout(150); await hover(host, false); await host.locator('#vrg-open > summary').click(); await host.locator('#vrg-end').click();
    const wrong = await exportReport(host); results.cases.push('table-memory-and-wrong');
    check(wrong.events.some(event => event.kind === 'RESULT' && event.source === 'TABLE_MEMORY' && event.cardId === 'cp-mantis-blades'), 'Actual product memory image key resolves to canonical identity');
    check(wrong.consultations.some(consultation => consultation.wrongAccepted > 0 && consultation.outcome === 'WRONG'), 'A wrong accepted identity after a correct result is never hidden');
    step('Cancellation, partial export, pause and end never create a physical PASS');
    await host.locator('#vrg-start').click(); await host.locator('#vrg-present').click(); await host.locator('#vrg-open > summary').click();
    await host.evaluate(() => { window.__realGameTrack = { ...window.__realGameTrack, uid: 7002 }; TCGDetectionLab.captureCanonicalTrackCanvas = () => null; window.dispatchEvent(new CustomEvent('tcg-tracks-updated')); });
    await hover(host, true); await host.waitForTimeout(10); await hover(host, false); await host.waitForTimeout(100);
    await host.locator('#vrg-open > summary').click(); await host.locator('#vrg-pause').click();
    check(await host.evaluate(() => TCGVisionRealGameUi.getState().paused), 'Pause detaches observer and interrupts active window');
    const partial = await exportReport(host); results.cases.push('cancel-partial');
    check(partial.observations.some(o => o.endReason === 'INTERRUPTED'), 'Interrupted duration is preserved and not joined to resumed windows');
    check(partial.consultations.some(c => c.status === 'CANCELLED' || c.outcome === 'CANCELLED' || c.cancellationReason), 'Abandoned real hover remains an exported consultation');
    await host.locator('#vrg-pause').click();
    step('No response retains a real pending hover and an explicit unknown latency');
    await host.locator('#vrg-start').click(); await host.locator('#vrg-present').click(); await host.locator('#vrg-open > summary').click();
    await host.evaluate(() => { window.__realGameTrack = { ...window.__realGameTrack, uid: 9003, cx: TCGDetectionLab.els.video.videoWidth * .70 }; window.dispatchEvent(new CustomEvent('tcg-tracks-updated')); });
    await hover(host, true); await host.waitForTimeout(10500); await host.locator('#vrg-open > summary').click(); await host.locator('#vrg-end').click();
    const noResponse = await exportReport(host); results.cases.push('no-response');
    check(noResponse.consultations.some(c => c.outcome === 'NO_RESPONSE' && c.responseMs === null && c.timedOutAtMs !== null), 'No displayed result is kept as NO_RESPONSE with null latency, never zero');
    await host.locator('#vrg-incident').selectOption('NOTICEABLE_DELAY'); await host.locator('#vrg-add-incident').click();
    await host.locator('#vrg-finish').click(); check(await host.locator('#vrg-new-segment').isDisabled(), 'A completed segment must be exported before it can be replaced'); const final = await exportReport(host);
    check(final.qualification === 'NOT_EVALUATED' || final.qualification?.status === 'NOT_EVALUATED' || final.verdict === 'NOT_EVALUATED', 'No automated physical qualification verdict');
    check(final.observations.length < 45, 'Historical 45 observations never duplicated');
    check(!/data:image|data:video|data:audio|blob:|AUTOMATED Host|AUTOMATED Guest|roomCode|deviceId|sdp|iceCandidate|imageUrl|visionAsset|"videoFrames?"\s*:|cropData/i.test(JSON.stringify(final)), 'Export has no media, URLs, player names, device IDs, Room or WebRTC secrets');
    check(final.incidents.some(i => i.code === 'NOTICEABLE_DELAY'), 'Controlled user discomfort annotation is preserved');
    equal(results.requests.filter(r => r.method === 'POST' && /report.*send|resend|mail/i.test(r.path)), [], 'Local export sends no report email');
    check(await host.evaluate(() => document.querySelector('#remoteVideo').videoWidth > 0 && !document.querySelector('#remoteVideo').paused), 'Received video still plays after observer lifecycle and exports');
    equal(await host.evaluate(() => TCGIdentificationLab.getSnapshot().librarySize), 229, 'Normal corpus remains unchanged');
    check(await host.evaluate(() => !TCGIdentificationLab.getSnapshot().qualificationTracking?.active), 'Nominal harness never armed');
    await screenshot(host, 'completed-desktop');
    await host.setViewportSize({ width: 390, height: 844 });
    const geometry = await host.locator('#vrg-panel').evaluate(element => { const r = element.getBoundingClientRect(); return { left: r.left, right: r.right, width: innerWidth }; });
    check(geometry.left >= 0 && geometry.right <= geometry.width, 'Campaign controls fit mobile viewport');
    check(await host.locator('#vrg-export').isVisible(), 'Local export remains accessible on mobile'); await screenshot(host, 'completed-mobile');
    step('A new segment preserves the live Room, remote MediaStream and previous downloaded proofs');
    await host.evaluate(() => { window.__realGamePreviousRemote = document.querySelector('#remoteVideo').srcObject; window.__realGamePreviousRoom = state.roomCode; window.__realGamePreviousPeer = state.peerId; window.__realGamePreviousIndex = TCGIdentificationLab.getSnapshot().visionIndexKey; });
    await host.locator('#vrg-new-segment').click();
    check(await host.evaluate(() => !TCGVisionRealGameUi.getState().prepared && document.querySelector('#remoteVideo').srcObject === window.__realGamePreviousRemote && state.roomCode === window.__realGamePreviousRoom && state.peerId === window.__realGamePreviousPeer), 'New segment changes neither normal Room/peer nor the actual received MediaStream object');
    check(await host.evaluate(() => document.querySelector('#remoteVideo').videoWidth > 0 && !document.querySelector('#remoteVideo').paused && document.querySelector('#remoteVideo').srcObject.getVideoTracks().some(track => track.readyState === 'live')), 'The same live received video continues playing');
    equal(await host.evaluate(() => TCGIdentificationLab.getSnapshot().visionIndexKey), await host.evaluate(() => window.__realGamePreviousIndex), 'New segment preserves the loaded normal Vision index');
    check(!await host.locator('#vrg-framing').isChecked() && !await host.locator('#vrg-corpus').isChecked(), 'Installation and physical printing confirmations must be renewed');
    equal(await host.locator('#vrg-cards select').count(), 10, 'Previous predeclared selection remains available for review');
    check(await host.locator('#vrg-export').isDisabled(), 'A new empty segment cannot masquerade as the old export');
    for (const proof of results.downloadedProofs) equal(digest(fs.readFileSync(proof.file)), proof.sha256, 'All previous locally downloaded evidence bytes remain unchanged');
    await host.locator('#vrg-framing').check(); await host.locator('#vrg-corpus').check(); await host.locator('#vrg-prepare').click();
    await host.waitForFunction(() => TCGVisionRealGameUi.getState().prepared, {}, { timeout: 30000 });
    const newSegment = await exportReport(host); equal(newSegment.observations.length, 0, 'New segment starts with zero observations and does not copy previous trials');
    check(newSegment.clockId !== final.clockId, 'New segment owns a new monotonic clock identity');
    check(await host.evaluate(() => document.querySelector('#remoteVideo').srcObject === window.__realGamePreviousRemote && state.roomCode === window.__realGamePreviousRoom), 'Repreparation also leaves normal live media and Room intact');
    results.cases.push('new-segment-without-media-interruption');
    equal(results.errors, [], 'No uncaught browser errors');
    await h.context.close(); await g.context.close();
    console.log('VISION_REAL_GAME_BROWSER_PASS ' + JSON.stringify({ assertions, cases: results.cases, productSha: buildSha, historicalSha, measuredSources: results.timings, physicalQualification: 'NOT_PERFORMED', screenshots: results.screenshots }));
  } catch (error) { console.error('VISION_REAL_GAME_BROWSER_FAIL ' + phase + ': ' + error.stack); throw error; }
  finally { await browser?.close(); await fixture.close(); }
}
run().catch(() => { process.exitCode = 1; });
