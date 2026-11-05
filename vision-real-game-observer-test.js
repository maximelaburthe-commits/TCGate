'use strict';
// Browser-only scalar fixture. Native-looking callbacks below model normal
// pointer ordering; every observation is synthetic, never physical evidence.
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.env.WORKSPACE_PLAYWRIGHT_PATH || 'playwright');
const references = require('./fixtures/vision-canonical-corpus-229.json').references;
const observerPath = path.join(__dirname, 'public/vision-real-game-observer.js');
const sha = '6d08ad3fde309a6c38990ba82ef4e56aa2e21597';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jKGkAAAAASUVORK5CYII=', 'base64');
let assertions = 0, scenarios = 0;
const check = (value, message) => { assertions++; assert.ok(value, message); };
const equal = (actual, expected, message) => { assertions++; assert.deepEqual(actual, expected, message); };
async function fixture(browser, run) {
  scenarios++;
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.route('https://cards.test/**', route => route.fulfill({ status: 200, contentType: 'image/png', body: png }));
  await page.setContent("<style>body{margin:0}#opponentFeed{position:absolute;left:0;top:0;width:640px;height:480px;background:#222}#identResult{position:absolute;left:700px;top:0}.hidden{display:none}#identImage{width:120px;height:160px}.fullscreen-card-preview{position:absolute;left:200px;top:150px;width:80px;height:80px}</style><select id=\"labSource\" hidden><option value=\"production\">Cyberpunk</option></select><button id=\"labStart\" hidden></button><button id=\"visionCameraButton\" hidden></button><div id=\"opponentFeed\"><video id=\"remoteVideo\"></video><canvas id=\"visionOverlay\" width=\"640\" height=\"480\"></canvas></div><div id=\"identResult\" class=\"hidden\"><img id=\"identImage\"></div>");
  await page.evaluate(({ references, sha }) => {
    const stage = document.getElementById('opponentFeed'), video = document.getElementById('remoteVideo');
    const image = document.getElementById('identImage'), panel = document.getElementById('identResult');
    Object.defineProperty(video, 'videoWidth', { get: () => 640 });
    Object.defineProperty(video, 'videoHeight', { get: () => 480, configurable: true });
    const nativeNow = performance.now.bind(performance);
    let offset = 0;
    Object.defineProperty(performance, 'now', { value: () => nativeNow() + offset });
    const state = window.fixtureState = { tracks: [{ uid: 1, cx: 140, cy: 200, w: 120, h: 180, conf: .95, misses: 0 }],
      table: { entries: [] }, mode: 'normal', callbacks: 0, nativePointerAt: [], nativeTimers: [], events: [], buildSha: sha,
      snapshot: { gameId: 'cyberpunk', playerLocale: 'en', visionReferenceCount: 229, librarySize: 229, libraryReady: true,
        matcherWorker: { ready: true }, visionLocales: ['en'], libraryIntegrity: { degraded: false, sourceRef: 'fixture-immutable' },
        enabled: true, qualificationTracking: null, visionIndexKey: 'cyberpunk-en-229', visibleIdentity: null,
        hoveredTrack: null, identification: null } };
    window.TCGateGameDatabases = { get: () => ({ manifestUrl: 'https://raw.githubusercontent.com/maximelaburthe-commits/tcgate_db_cyberpunk/56402636a77af9c8b5dc4e3b61c509a185f3c834/manifest.json' }) };
    window.TCGateDatabaseSource = { getVisionReferences: async () => references.map(({ name, ...ref }) => ref), load: async () => ({ manifest: { sourceCommit: '56402636a77af9c8b5dc4e3b61c509a185f3c834' }, cardsById: new Map(references.map(ref => [ref.cardId, { name: ref.name }])) }) };
    window.TCGTableStateBridge = { getSnapshot: () => ({ captureCount: 1 }), getRefs: () => fixtureState.capturedRefs === undefined ? references : fixtureState.capturedRefs };
    window.TCGDetectionLab = { state: { detecting: true, externalAttached: false, stream: { getVideoTracks: () => [{ readyState: 'live' }] } }, els: { videoStage: stage, video, overlay: document.getElementById('visionOverlay') }, activeTracks: () => state.tracks };
    window.TCGIdentificationLab = { getSnapshot: () => state.snapshot };
    window.TCGVisionEngine = { getSnapshot: () => ({ active: false, modelReady: true, tracking: { activeTracks: state.tracks }, inference: { detectionFps: 3, videoFps: 30 }, mainThread: { longTaskCount: 0 } }) };
    const underPointer = event => state.tracks.find(track => Math.abs(event.clientX - track.cx) <= track.w / 2 && Math.abs(event.clientY - track.cy) <= track.h / 2 && !track.misses);
    function resultFor(track, which = 0, mode = 'normal') {
      const ref = references[which], url = 'https://cards.test/' + which + '.png';
      const detail = { accepted: true, ...ref, source: mode === 'memory-hover' ? 'vision-state-memory' : mode.startsWith('cached-') ? 'hover-cache' : 'foreground',
        mode, trackUid: track.uid, at: performance.now(), matcherMs: 12, imageUrl: url };
      if (mode === 'memory-hover') { delete detail.cardId; delete detail.printingId; delete detail.refId; }
      state.snapshot.visibleIdentity = detail;
      state.snapshot.hoveredTrack = track;
      state.snapshot.identification = { accepted: true, best: ref };
      image.dataset.swapPending = '0'; image.dataset.cardUrl = url; image.src = url; image.style.visibility = 'visible'; panel.classList.remove('hidden');
      window.dispatchEvent(new CustomEvent(mode === 'memory-hover' ? 'tcg-identification-visible' : 'tcg-identification-result', { detail }));
    }
    stage.addEventListener('pointermove', event => {
      if (event.target.closest('.fullscreen-card-preview')) return;
      state.callbacks++; state.nativePointerAt.push(performance.now());
      const track = underPointer(event);
      state.snapshot.hoveredTrack = track || null;
      if (!track || state.mode === 'none') return;
      if (state.mode === 'memory') return resultFor(track, 0, 'memory-hover');
      if (state.mode === 'cache') return resultFor(track, 0, 'cached-normal');
      if (state.mode === 'reject') return window.dispatchEvent(new CustomEvent('tcg-identification-result', { detail: { accepted: false, reason: 'uncertain', trackUid: track.uid, at: performance.now(), mode: 'normal' } }));
      state.nativeTimers.push(setTimeout(() => resultFor(track, track.uid === 2 ? 2 : 0), 45));
    });
    stage.addEventListener('pointerleave', () => { state.snapshot.hoveredTrack = null; state.snapshot.identification = null; });
    window.addEventListener('tcg-tracks-updated', () => {
      // Normal stationary hover may serve memory synchronously for a new track.
      if (state.stationaryMemory && state.tracks[0]) resultFor(state.tracks[0], 2, 'memory-hover');
    });
    window.fixture = { resultFor, advance: ms => { offset += ms; },
      updateTracks: tracks => { state.tracks = tracks; window.dispatchEvent(new Event('tcg-tracks-updated')); }, references };
  }, { references, sha });
  await page.addScriptTag({ path: observerPath });
  await page.evaluate(async sha => {
    const context = await TCGVisionRealGameObserver.readContext({ targetWindow: window, productSha: sha });
    fixtureState.context = context;
    window.observer = TCGVisionRealGameObserver.create({ targetWindow: window, context, clockId: 'synthetic-page-clock',
      onEvent: event => fixtureState.events.push(event), getContext: () => ({ ...context, productSha: fixtureState.buildSha }) });
    observer.start();
  }, sha);
  try { await run(page); equal(errors, [], 'No browser error'); }
  finally { await page.close(); }
}
const events = page => page.evaluate(() => fixtureState.events);
const waitDisplay = async page => { try { await page.waitForFunction(() => fixtureState.events.some(event => event.kind === 'DISPLAY'), null, { timeout: 5000 }); } catch (error) { console.error(await page.evaluate(() => ({ events: fixtureState.events, diagnostics: observer.getDiagnostics(), image: { complete: document.getElementById('identImage').complete, naturalWidth: document.getElementById('identImage').naturalWidth, src: document.getElementById('identImage').currentSrc, visible: document.getElementById('identImage').style.visibility }, snapshot: fixtureState.snapshot }))); throw error; } };
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    await fixture(browser, async page => {
      await page.mouse.move(140, 200); await waitDisplay(page);
      let output = await events(page);
      const request = output.find(event => event.kind === 'REQUEST'), display = output.find(event => event.kind === 'DISPLAY');
      equal(request.requestOrigin, 'HUMAN_POINTER', 'Real mouse action is a human-origin request');
      equal(await page.evaluate(() => fixtureState.context.cards[0].name), references[0].name, 'Non-developer card labels come from cached canonical metadata, not opaque IDs');
      equal(request.genuineHover, true, 'Trusted DOM hover recorded');
      const nativeTimes = await page.evaluate(() => fixtureState.nativePointerAt);
      check(request.atMs <= nativeTimes[0], 'Request timestamp precedes normal product handler');
      check(display.atMs > request.atMs + 40, 'Demand-to-display includes normal deferred callback');
      equal(display.source, 'NEW_ANALYSIS', 'Normal matcher source retained');
      equal(display.cardId, references[0].cardId, 'Canonical identity comes from native scalar result');
      equal(display.displayConfirmed, true, 'Display requires real loaded visible image');
      equal(display.definitivePrinting, true, 'Single exact native reference can establish definitive printing');
      equal(await page.locator('#identResult').isVisible(), true, 'Native Lab HD inspector establishes the actual tester-visible display');
      equal(await page.evaluate(() => fixtureState.context.scope), 'SOLO_LAB_NORMAL_HOVER', 'Prepared scope is autonomous Lab normal hover');
      equal(await page.evaluate(() => fixtureState.context.capabilities.localCamera), true, 'Prepared context attests the local camera path');
      equal(await page.evaluate(() => fixtureState.context.capabilities.normalHover), true, 'Prepared context attests the unchanged hover path');
      equal(await page.evaluate(() => fixtureState.context.capabilities.tableStateMemory), false, 'No Table State background engine is required or added');
      equal(await page.evaluate(() => TCGVisionEngine.getSnapshot().active), false, 'Local Lab observation does not require external stream active flag');
      await page.mouse.move(150, 200); await page.waitForTimeout(100);
      output = await events(page);
      equal(output.filter(event => event.kind === 'REQUEST').length, 1, 'Motion within same target does not manufacture requests');
      check(output.filter(event => event.kind === 'RESULT').length >= 2, 'Subsequent native decisions remain observations');
      check(output.every(event => event.clockId === 'synthetic-page-clock'), 'Single shared monotonic clock for all events');
      const text = JSON.stringify(output);
      check(!/https:|data:image|imageUrl|videoData|audio|password|@/.test(text), 'Observer emits no media URLs or sensitive payload');
      await page.evaluate(() => observer.dispose());
      equal(await page.evaluate(() => observer.getDiagnostics().activeTimers), 0, 'Dispose clears every timer');
      const count = (await events(page)).length;
      await page.mouse.move(140, 190); await page.waitForTimeout(300);
      equal((await events(page)).length, count, 'Disposed observer has no active listeners or heartbeat');
    });
    for (const mode of ['cache', 'memory']) await fixture(browser, async page => {
      await page.evaluate(mode => { fixtureState.mode = mode; }, mode);
      await page.mouse.move(140, 200); await waitDisplay(page);
      const output = await events(page), request = output.find(event => event.kind === 'REQUEST'), display = output.find(event => event.kind === 'DISPLAY');
      equal(display.source, mode === 'cache' ? 'HOVER_CACHE' : 'TABLE_MEMORY', 'Native cache/memory provenance is explicit');
      check(display.atMs > request.atMs, 'Synchronous native response still waits for real display opportunity');
      equal(display.decisionFresh, false, 'Serving memory/cache is not a fresh recognition');
    });
    await fixture(browser, async page => {
      await page.evaluate(() => { fixtureState.mode = 'none'; fixture.resultFor(fixtureState.tracks[0], 0, 'normal'); });
      await page.waitForFunction(() => document.getElementById('identImage').complete && document.getElementById('identImage').naturalWidth > 0);
      await page.mouse.move(140, 200); await page.waitForTimeout(180);
      const output = await events(page), request = output.find(event => event.kind === 'REQUEST');
      equal(request.alreadyVisibleAtRequest, true, 'Held preview at request is marked preexisting');
      equal(output.filter(event => event.kind === 'DISPLAY').length, 0, 'Old image alone never fabricates an instant response');
      await page.evaluate(() => { fixture.advance(10001); observer.sample(); });
      equal((await events(page)).filter(event => event.kind === 'TIMEOUT').length, 1, 'No-response observation is retained separately');
      await page.evaluate(() => fixture.resultFor(fixtureState.tracks[0], 0, 'cached-normal'));
      await waitDisplay(page);
      equal((await events(page)).filter(event => event.kind === 'TIMEOUT').length, 1, 'Late response does not erase timeout');
    });
    await fixture(browser, async page => {
      await page.evaluate(() => { fixtureState.mode = 'reject'; });
      await page.mouse.move(140, 200); await page.waitForTimeout(70);
      await page.mouse.move(800, 400); await page.waitForTimeout(30);
      const output = await events(page), rejection = output.find(event => event.kind === 'RESULT' && !event.accepted);
      check(Boolean(rejection.consultationId), 'Rejected result remains linked to its demand');
      equal(rejection.reason, 'uncertain', 'Native rejection reason preserved as controlled scalar');
      equal(output.filter(event => event.kind === 'DISPLAY').length, 0, 'Refusal does not become successful display');
      equal(output.find(event => event.kind === 'CANCEL').reason, 'POINTER_LEFT_VIDEO', 'Unanswered consultation cancellation recorded');
    });
    await fixture(browser, async page => {
      await page.evaluate(() => { fixtureState.mode = 'none'; fixtureState.tracks.push({ uid: 2, cx: 380, cy: 200, w: 120, h: 180, conf: .9, misses: 0 }); });
      await page.mouse.move(140, 200); await page.mouse.move(380, 200);
      await page.evaluate(() => fixture.resultFor({ uid: 1 }, 0));
      await page.waitForTimeout(120);
      let output = await events(page);
      equal(output.filter(event => event.kind === 'REQUEST').length, 2, 'A then B produce two causally distinct requests');
      equal(output.find(event => event.kind === 'RESULT' && event.trackUid === 1).consultationId, output.find(event => event.kind === 'REQUEST').consultationId, 'Late A result remains attached to original A request');
      equal(output.filter(event => event.kind === 'DISPLAY').length, 0, 'Late A image is not a response for B');
      await page.evaluate(() => fixture.resultFor({ uid: 2 }, 2)); await waitDisplay(page);
      output = await events(page);
      equal(output.find(event => event.kind === 'DISPLAY').trackUid, 2, 'Actual B display keeps B track');
      equal(output.find(event => event.kind === 'DISPLAY').definitivePrinting, false, 'Shared artwork cannot falsely resolve an exact printing');
      equal(output.find(event => event.kind === 'DISPLAY').consultationId, output.filter(event => event.kind === 'REQUEST')[1].consultationId, 'Actual B display links B demand');
    });
    await fixture(browser, async page => {
      await page.evaluate(() => { fixtureState.mode = 'none'; });
      await page.mouse.move(140, 200);
      await page.evaluate(() => { fixtureState.stationaryMemory = true; fixture.updateTracks([{ uid: 2, cx: 140, cy: 200, w: 120, h: 180, conf: .9, misses: 0 }]); });
      await waitDisplay(page);
      const output = await events(page), requests = output.filter(event => event.kind === 'REQUEST');
      equal(requests.length, 2, 'Stationary replacement keeps a distinct normal retarget');
      equal(requests[1].requestOrigin, 'STATIONARY_POINTER', 'Stationary retarget never called fresh human gesture');
      equal(requests[1].genuineHover, false, 'Stationary normal response cannot fabricate human demand');
      equal(output.find(event => event.kind === 'DISPLAY').consultationId, requests[1].consultationId, 'Synchronous stationary memory response attaches to its actual target');
    });
    await fixture(browser, async page => {
      await page.mouse.move(140, 200); await waitDisplay(page);
      await page.evaluate(() => { window.dispatchEvent(new CustomEvent('tcg-identification-stability', { detail: { type: 'stable-held', trackUid: 1, stableKey: 'card:' + fixture.references[0].cardId, at: performance.now() } })); observer.sample(); });
      let output = await events(page), native = output.filter(event => event.kind === 'TRACK_STATE').at(-1);
      equal(native.source, 'IDENTITY_MEMORY', 'Native temporal grace memory is distinct from absent Table State memory');
      equal(native.identityCurrent, true, 'Explicit native hold keeps identity under the engine policy');
      equal(native.decisionFresh, false, 'Native hold is never fresh matcher acceptance');
      equal(native.nativeIdentityAtMs, null, 'Hold timestamp is not fabricated as an identity decision timestamp');
      await page.evaluate(() => { window.dispatchEvent(new CustomEvent('tcg-identification-stability', { detail: { type: 'hold-expired', trackUid: 1, stableKey: 'card:' + fixture.references[0].cardId, at: performance.now() } })); observer.sample(); });
      native = (await events(page)).filter(event => event.kind === 'TRACK_STATE').at(-1);
      equal(native.identityCurrent, false, 'Expired native hold does not confirm retained HD preview');
      equal(native.identityObservationAvailable, true, 'Observed native expiry remains measurable identity unavailability');
      equal(native.retainedPreview, true, 'Expired hold may retain the old HD image without current identity');
      await page.mouse.move(800, 400); await page.evaluate(() => observer.sample());
      native = (await events(page)).filter(event => event.kind === 'TRACK_STATE').at(-1);
      equal(native.nativeStatus, 'UNKNOWN', 'Pointer exit does not fabricate a detector loss while card track persists');
      equal(native.identityObservationAvailable, false, 'Private per-track memory is unobservable after pointer exit');
      await page.evaluate(() => fixture.updateTracks([])); await page.waitForTimeout(40);
      equal((await events(page)).filter(event => event.kind === 'TRACK_STATE').at(-1).nativeStatus, 'LOST', 'Actual track loss remains measured');
    });
    await fixture(browser, async page => {
      await page.evaluate(() => { fixtureState.mode = 'none'; document.getElementById('opponentFeed').insertAdjacentHTML('beforeend', '<div class="fullscreen-card-preview"></div>'); });
      await page.mouse.move(230, 180); await page.waitForTimeout(60);
      equal((await events(page)).filter(event => event.kind === 'REQUEST').length, 0, 'Fullscreen HD interaction does not trigger a demand');
      await page.evaluate(() => document.getElementById('opponentFeed').dispatchEvent(new PointerEvent('pointermove', { clientX: 140, clientY: 200, bubbles: true })));
      equal((await events(page)).filter(event => event.kind === 'REQUEST').length, 0, 'Untrusted synthetic event is not human evidence');
    });
    await fixture(browser, async page => {
      await page.evaluate(() => { fixtureState.mode = 'none'; });
      await page.mouse.move(140, 200); await page.mouse.move(800, 400);
      const first = (await events(page)).find(event => event.kind === 'REQUEST');
      await page.evaluate(() => fixture.resultFor({ uid: 1 }, 0)); await page.waitForTimeout(60);
      const result = (await events(page)).filter(event => event.kind === 'RESULT').at(-1);
      equal(result.consultationId, first.consultationId, 'Late A after pointer leave retains closed A consultation even before any B hover');
      equal((await events(page)).filter(event => event.kind === 'REQUEST').length, 1, 'Late A cannot invent a B request');
    });
    await fixture(browser, async page => {
      await page.evaluate(() => { fixtureState.mode = 'memory'; fixtureState.context.references.forEach(ref => { ref.image = 'https://cdn.test/' + ref.refId; }); });
      // Core may expose full image URLs while the normal memory payload exposes
      // only its immutable refId in image, without canonical fields.
      await page.evaluate(() => {
        observer.dispose(); const context = fixtureState.context;
        window.observer = TCGVisionRealGameObserver.create({ targetWindow: window, context, clockId: 'synthetic-page-clock', onEvent: event => fixtureState.events.push(event) }); observer.start();
      });
      await page.mouse.move(140, 200); await waitDisplay(page);
      equal((await events(page)).filter(event => event.kind === 'DISPLAY').at(-1).cardId, references[0].cardId, 'Memory refId image key resolves against canonical refs despite different Core URL');
    });
    await fixture(browser, async page => {
      await page.evaluate(() => { fixtureState.mode = 'none'; Object.defineProperty(document.getElementById('remoteVideo'), 'videoHeight', { get: () => 360, configurable: true }); });
      // The normal product uses object-fit:contain: black bands are not video.
      await page.mouse.move(140, 20); await page.waitForTimeout(30);
      equal((await events(page)).filter(event => event.kind === 'REQUEST').length, 0, 'Letterbox black band cannot create a card demand');
      await page.mouse.move(140, 260); await page.waitForTimeout(30);
      equal((await events(page)).filter(event => event.kind === 'REQUEST').length, 1, 'Object-fit contain coordinates agree with actual video target');
    });
    await fixture(browser, async page => {
      await page.mouse.move(140, 200); await waitDisplay(page);
      await page.mouse.move(800, 400);
      await page.evaluate(() => fixture.updateTracks([])); await page.waitForTimeout(60);
      const last = (await events(page)).filter(event => event.kind === 'TRACK_STATE').at(-1);
      equal(last.nativeStatus, 'LOST', 'Removing card records actual native loss despite kept HD image');
      equal(last.identityCurrent, false, 'Kept HD preview cannot sustain current native identity');
      equal(last.retainedPreview, true, 'Voluntarily kept preview is explicitly distinguished');
    });
    await fixture(browser, async page => {
      await page.evaluate(() => { fixtureState.mode = 'none'; fixture.advance(1800); observer.sample(); });
      let output = await events(page);
      const gap = output.find(event => event.kind === 'OBSERVATION_GAP');
      equal(gap.reason, 'CALLBACK_GAP', 'Observation pause is distinct from track loss');
      check(gap.durationMs >= 1800, 'Actual unobservable callback duration retained');
      const gapIndex = output.indexOf(gap), stateIndex = output.findIndex((event, index) => index > gapIndex && event.kind === 'TRACK_STATE');
      check(stateIndex > gapIndex, 'Observability gap precedes resumed native-state observation');
      const before = output.length;
      for (let index = 0; index < 20; index++) await page.mouse.move(140 + index % 3, 200);
      output = await events(page);
      equal(output.filter(event => event.kind === 'REQUEST').length, 1, 'Burst of same-target mouse events has one consultation');
      check(output.length - before < 8, 'Passive observer coalesces unchanged pointer motion instead of high-cadence logging');
    });
    await fixture(browser, async page => {
      await page.evaluate(async sha => {
        fixtureState.capturedRefs = fixture.references.map(ref => ({ ...ref, candidatePrintingIds: [...ref.candidatePrintingIds] }));
        window.dispatchEvent(new Event('tcg-table-reference-library'));
        fixtureState.capturedRefs = null;
        const context = await TCGVisionRealGameObserver.readContext({ targetWindow: window, productSha: sha });
        fixtureState.witnessProof = context.referenceCount;
      }, sha);
      equal(await page.evaluate(() => fixtureState.witnessProof), 229, 'Scalar worker witness survives native bridge reference release');
      const mismatch = await page.evaluate(async sha => {
        fixtureState.capturedRefs = fixture.references.map(ref => ({ ...ref, candidatePrintingIds: [...ref.candidatePrintingIds] }));
        fixtureState.capturedRefs[0].cardId = fixture.references[2].cardId;
        window.dispatchEvent(new Event('tcg-table-reference-library')); fixtureState.capturedRefs = null;
        try { await TCGVisionRealGameObserver.readContext({ targetWindow: window, productSha: sha }); return null; }
        catch (error) { return error.message; }
      }, sha);
      equal(mismatch, 'LOADED_WORKER_CORPUS_MISMATCH_OR_UNOBSERVED', 'Equal-sized stale worker corpus is rejected after release');
    });
    await fixture(browser, async page => {
      await page.evaluate(() => { fixtureState.mode = 'none'; observer.sample({ force: true }); });
      const count = (await events(page)).filter(event => event.kind === 'TRACK_STATE').length;
      await page.evaluate(() => observer.sample({ force: true }));
      equal((await events(page)).filter(event => event.kind === 'TRACK_STATE').length, count + 1, 'New observation can sample an unchanged native track without any recognition');
    });
    await fixture(browser, async page => {
      await page.evaluate(() => {
        document.body.insertAdjacentHTML('beforeend', '<div id="opaque-overlay" style="position:fixed;left:680px;top:0;width:200px;height:240px;z-index:99999;background:black"></div>');
      });
      await page.mouse.move(140, 200);
      await page.waitForFunction(() => document.getElementById('identImage').complete && document.getElementById('identImage').naturalWidth > 0);
      await page.waitForTimeout(150);
      equal((await events(page)).filter(event => event.kind === 'DISPLAY').length, 0, 'Loaded CSS-visible image under opaque overlay is not declared displayed');
      await page.evaluate(() => document.getElementById('opaque-overlay').remove());
      await waitDisplay(page);
      equal((await events(page)).filter(event => event.kind === 'DISPLAY').length, 1, 'Removing opaque overlay makes actual player image presentable');
    });
    await fixture(browser, async page => {
      await page.evaluate(() => { document.getElementById('identImage').style.pointerEvents = 'none'; });
      await page.mouse.move(140, 200); await waitDisplay(page);
      equal((await events(page)).filter(event => event.kind === 'DISPLAY').length, 1, 'Normal owning button hit remains valid when image has pointer-events:none');
    });
    await fixture(browser, async page => {
      await page.evaluate(() => { fixtureState.mode = 'none'; });
      await page.mouse.move(140, 200);
      const firstRequest = (await events(page)).find(event => event.kind === 'REQUEST');
      await page.evaluate(() => fixture.updateTracks([])); await page.waitForTimeout(50);
      let output = await events(page);
      equal(output.find(event => event.kind === 'CANCEL').consultationId, firstRequest.consultationId, 'A demand closes when actual scene becomes empty');
      equal(output.filter(event => event.kind === 'TRACK_STATE').at(-1).nativeStatus, 'LOST', 'Empty scene records physical native A track loss');
      await page.mouse.move(800, 400);
      await page.evaluate(() => fixture.updateTracks([{ uid: 2, cx: 140, cy: 200, w: 120, h: 180, conf: .95, misses: 0 }]));
      await page.mouse.move(140, 200);
      const secondRequest = (await events(page)).filter(event => event.kind === 'REQUEST').at(-1);
      equal(secondRequest.trackUid, 2, 'A to empty to B starts an independent native B demand');
      equal(secondRequest.requestOrigin, 'HUMAN_POINTER', 'Actual second mouse entry provides B human demand');
      await page.evaluate(() => fixture.resultFor({ uid: 1 }, 0)); await page.waitForTimeout(80);
      output = await events(page);
      equal(output.filter(event => event.kind === 'RESULT').at(-1).consultationId, firstRequest.consultationId, 'Late A after empty remains attached only to A');
      equal(output.filter(event => event.kind === 'DISPLAY').length, 0, 'Late A image cannot qualify B after the empty interval');
      await page.evaluate(() => fixture.resultFor({ uid: 2 }, 2)); await waitDisplay(page);
      equal((await events(page)).find(event => event.kind === 'DISPLAY').consultationId, secondRequest.consultationId, 'Only real B result can complete B consultation');
    });
    await fixture(browser, async page => {
      await page.mouse.move(140, 200); await waitDisplay(page);
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('tcg-identification-stability', { detail: { type: 'hold-expired', trackUid: 1, stableKey: 'card:' + fixture.references[0].cardId, at: performance.now() } }));
        observer.sample(); observer.stop('OPERATOR_STOPPED');
        fixture.resultFor({ uid: 1 }, 0);
        observer.start(); observer.sample({ force: true });
      });
      const native = (await events(page)).filter(event => event.kind === 'TRACK_STATE').at(-1);
      equal(native.identityCurrent, true, 'Resume cannot retain an expired hold superseded during observation pause');
      equal(native.decisionFresh, null, 'Unobserved pause decision cannot manufacture fresh recognition');
    });
    for (const mutation of ['build', 'index', 'qualification', 'database', 'camera', 'detection', 'external', 'test-provider', 'source']) await fixture(browser, async page => {
      await page.mouse.move(140, 200); await page.waitForTimeout(70);
      await page.evaluate(mutation => {
        if (mutation === 'camera') TCGDetectionLab.state.stream = null;
        if (mutation === 'detection') TCGDetectionLab.state.detecting = false;
        if (mutation === 'external') TCGDetectionLab.state.externalAttached = true;
        if (mutation === 'test-provider') window.TCGWorkspaceLabProviderInstance = {};
        if (mutation === 'source') { const option = document.createElement('option'); option.value='test'; document.getElementById('labSource').append(option); document.getElementById('labSource').value='test'; }
        if (mutation === 'build') fixtureState.buildSha = 'f'.repeat(40);
        if (mutation === 'index') fixtureState.snapshot.visionIndexKey = 'changed';
        if (mutation === 'qualification') fixtureState.snapshot.qualificationTracking = { active: true };
        if (mutation === 'database') TCGateGameDatabases.get = () => ({ manifestUrl: 'https://changed.test/manifest.json' });
        observer.sample();
      }, mutation);
      const output = await events(page);
      equal(output.filter(event => event.kind === 'CONTEXT_INVALIDATED').length, 1, 'Changed ' + mutation + ' invalidates observation');
      equal(await page.evaluate(() => observer.getDiagnostics().running), false, 'Changed context stops observer fail closed');
      equal(await page.evaluate(() => observer.getDiagnostics().activeTimers), 0, 'Invalidation detaches timers');
    });
    console.log('vision-real-game-observer-test: PASS (' + assertions + ' assertions, ' + scenarios + ' browser scenarios; synthetic only)');
  } finally { await browser.close(); }
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
