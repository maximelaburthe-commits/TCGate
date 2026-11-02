'use strict';
// Real existing application + immutable EN images for initialization timings.
// Event fixtures below validate this observer only. They are NEVER physical evidence.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require(process.env.WORKSPACE_PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(process.env.VISION_QUALIFICATION_TEST_ROOT || process.cwd());
const { startBridgeFixture } = require(path.join(root, 'report-email-bridge-fixture.js'));
const harnessPath = process.env.VISION_QUALIFICATION_HARNESS_PATH || path.join(root, 'public/vision-qualification-harness.js');
const runtimePath = process.env.VISION_QUALIFICATION_RUNTIME_PATH || path.join(root, 'public/vision-qualification-runtime.js');
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const databaseSha = '56402636a77af9c8b5dc4e3b61c509a185f3c834';
const prefix = 'https://raw.githubusercontent.com/maximelaburthe-commits/tcgate_db_cyberpunk/' + databaseSha + '/';
const measurements = [], errors = [];
let assertions = 0;
function check(value, message) { assert(value, message); assertions++; }
function equal(actual, expected, message) { assert.deepEqual(actual, expected, message); assertions++; }
async function pinnedDocuments() {
  const documents = new Map();
  async function read(relative) {
    check(typeof relative === 'string' && relative && !relative.includes('\\') && !relative.split('/').some(part => !part || part === '.' || part === '..'), 'Pinned fixture path stays bounded');
    let bytes;
    if (process.env.TCGATE_DB_FIXTURE_ROOT) bytes = fs.readFileSync(path.join(process.env.TCGATE_DB_FIXTURE_ROOT, relative));
    else {
      const response = await fetch(prefix + relative);
      equal(response.status, 200, 'Pinned runtime document is available');
      bytes = Buffer.from(await response.arrayBuffer());
    }
    documents.set(relative, bytes); return JSON.parse(bytes.toString('utf8'));
  }
  const manifest = await read('manifest.json');
  await Promise.all([manifest.database_manifest, manifest.entrypoint || manifest.runtime_cards, manifest.runtime_printings,
    manifest.canonical_vision_index, manifest.printing_recognition_index, manifest.recognition_groups].map(read));
  const rich = JSON.parse(documents.get(manifest.printing_recognition_index));
  const assets = new Set(rich.cards.flatMap(card => card.recognitionGroups.flatMap(group => group.references.map(reference => reference.visionAssetPath))));
  equal(documents.size, 7, 'Seven authentic immutable runtime documents');
  equal(assets.size, 229, '229 authentic EN reference assets');
  return { documents, assets };
}
async function ready(page) {
  await page.locator('[data-lobby-page="installation"]').click();
  // The ordinary app lazily prepares Vision when an opponent joins. For these
  // isolated index timings, invoke that same existing routine explicitly; do
  // not create two simultaneous indexes or acquire synthetic camera streams.
  await page.evaluate(() => { prepareVision().catch(() => {}); });
  try { await page.waitForFunction(() => {
    const s = window.TCGIdentificationLab?.getSnapshot();
    return s?.gameId === 'cyberpunk' && s.playerLocale === 'en' && s.libraryReady &&
      s.librarySize === 229 && s.visionReferenceCount === 229 && s.matcherWorker?.ready;
  }, null, { timeout: 120000 }); }
  catch (error) {
    console.error('VISION_QUALIFICATION_READY_DIAGNOSTIC ' + JSON.stringify(await page.evaluate(() => {
      const s = window.TCGIdentificationLab?.getSnapshot();
      return { gameId: s?.gameId, locale: s?.playerLocale, ready: s?.libraryReady, size: s?.librarySize,
        referenceCount: s?.visionReferenceCount, localeError: s?.localeError, workerReady: s?.matcherWorker?.ready,
        workerError: s?.matcherWorker?.error, appGame: typeof state !== 'undefined' ? state.game : null, assetsLoaded: typeof state !== 'undefined' ? state.visionAssetsLoaded : null, assetsError: typeof state !== 'undefined' ? state.visionAssetsError?.message : null, scripts: [...document.querySelectorAll('script')].map(s => s.getAttribute('src')), status: document.querySelector('#remoteVisionLibraryStatus')?.textContent };
    })));
    throw error;
  }
}
async function loadObserver(page) {
  if (/^https?:/.test(page.url())) {
    await page.addScriptTag({ url: new URL('/vision-qualification-harness.js', page.url()).href });
    await page.addScriptTag({ url: new URL('/vision-qualification-runtime.js', page.url()).href });
  } else {
    await page.addScriptTag({ path: harnessPath });
    await page.addScriptTag({ path: runtimePath });
  }
  await page.evaluate(async productSha => {
    window.__observerOriginals = {
      worker: window.Worker, labStart: TCGIdentificationLab.start,
      detectionStart: TCGVisionEngine.attachRemoteStream,
      throttle: TCGVisionEngine.setPerformanceThrottle,
      snapshots: [TCGIdentificationLab.getSnapshot, TCGVisionEngine.getSnapshot]
    };
    window.__q = await TCGVisionQualificationRuntime.attach({
      productSha, environment: { execution: 'AUTOMATED', browserFamily: 'CHROMIUM' }
    });
  }, sha);
}
async function initializationSeries(browser, fixture, pinned) {
  let actualContext;
  for (let run = 0; run < 3; run++) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    try {
      await context.route('**/vision-qualification-harness.js', route => route.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(harnessPath) }));
      await context.route('**/vision-qualification-runtime.js', route => route.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(runtimePath) }));
      await context.route(prefix + '**', async route => {
        const relative = decodeURIComponent(route.request().url().slice(prefix.length));
        if (pinned.documents.has(relative)) return route.fulfill({ status: 200, contentType: 'application/json', body: pinned.documents.get(relative), headers: { 'access-control-allow-origin': '*' } });
        check(pinned.assets.has(relative), 'Only pinned EN asset paths are requested');
        if (process.env.TCGATE_DB_FIXTURE_ROOT) return route.fulfill({ status: 200, contentType: 'image/webp',
          body: fs.readFileSync(path.join(process.env.TCGATE_DB_FIXTURE_ROOT, relative)), headers: { 'access-control-allow-origin': '*' } });
        return route.continue();
      });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(fixture.origin);
      check(await page.evaluate(() => !window.TCGVisionQualificationRuntime && !window.TCGateVisionQualification), 'Qualification is absent from the normal application UI and script graph');
      await page.locator('#goCreate').click();
      await page.locator('#playerName').fill('Automated Qualification');
      await page.locator('#gameSelect').selectOption('cyberpunk');
      await page.locator('#siteCreateTimer').uncheck();
      await page.locator('#siteCreateGig').uncheck();
      await page.locator('#setupContinue').click();
      console.log('VISION_QUALIFICATION_BROWSER_STEP cold-' + (run + 1));
      await ready(page); await loadObserver(page);
      const cold = await page.evaluate(() => __q.recordIndexMeasurement('COLD'));
      measurements.push({ ...cold, run: run + 1 });
      check(/^index-[a-f0-9]{64}$/.test(cold.measurementId), 'An opaque ID identifies this actual initialization');
      const duplicateRejected = await page.evaluate(async () => { try { await __q.recordIndexMeasurement('COLD'); return false; } catch { return true; } });
      check(duplicateRejected, 'Reading the same initialized index twice cannot create another measurement');
      equal(cold.referenceCount, 229, 'Cold initialization retains exactly 229 references');
      check(Number.isFinite(cold.durationMs) && cold.durationMs >= 0, 'Cold descriptor construction duration comes from existing metadata');
      check(cold.totalReadyMs >= cold.durationMs, 'Cold ready duration includes descriptor construction');
      const state = await page.evaluate(() => {
        const s = __q.context(), original = window.__observerOriginals;
        return { context: s, unchanged: original.worker === window.Worker &&
          original.labStart === TCGIdentificationLab.start &&
          original.detectionStart === TCGVisionEngine.attachRemoteStream &&
          original.throttle === TCGVisionEngine.setPerformanceThrottle &&
          original.snapshots[0] === TCGIdentificationLab.getSnapshot &&
          original.snapshots[1] === TCGVisionEngine.getSnapshot,
          stream: Boolean(document.querySelector('#lobbyPreview').srcObject),
          physical: __q.exportReport().physicalQualification };
      });
      actualContext = state.context;
      equal(state.context.references.length, 229, 'Observer exports the actual reference IDs');
      equal(new Set(state.context.references.map(ref => ref.cardId)).size, 150, 'Observer is bound to 150 canonical cards');
      check(state.context.references.every(ref => ref.locale === 'en'), 'All observed candidates carry EN explicitly');
      check(state.unchanged, 'Observer does not wrap Worker, engines, matching, throttling or snapshot APIs');
      equal(state.stream, false, 'Observer never acquires a camera or microphone');
      await page.evaluate(() => __q.detach());
      await page.reload(); console.log('VISION_QUALIFICATION_BROWSER_STEP reload-' + (run + 1)); await ready(page); await loadObserver(page);
      const reload = await page.evaluate(() => __q.recordIndexMeasurement('WARM_RELOAD'));
      measurements.push({ ...reload, run: run + 1 });
      equal(reload.referenceCount, 229, 'Reload initialization retains exactly 229 references');
      check(Number.isFinite(reload.durationMs) && reload.durationMs >= 0, 'Reload construction duration comes from existing metadata');
      check(reload.totalReadyMs >= reload.durationMs, 'Reload ready duration includes descriptor construction');
      equal(await page.evaluate(() => __q.exportReport().trials.length), 0, 'Index measurements never invent a recognition trial');
      await page.evaluate(() => __q.detach());
      console.log('VISION_QUALIFICATION_INDEX_AUTOMATED ' + JSON.stringify({ run: run + 1, cold, reload }));
    } finally { await context.close(); }
  }
  return actualContext;
}
async function fixtureObserver(browser, actualContext) {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.setContent('<!doctype html><html><body>Automated observer fixture only</body></html>');
    await page.evaluate(({ context, databaseSha }) => {
      window.__fixtureTime = 100;
      Object.defineProperty(window.performance, 'now', { configurable: true, value: () => window.__fixtureTime });
      const refs = context.references.map(ref => ({ ...ref, image: ref.refId, recognitionMode: ref.printingId ? 'exact' : 'shared' }));
      window.__fixture = {
        refs, snapshot: {
          gameId: 'cyberpunk', playerLocale: 'en', libraryReady: true,
          matcherWorker: { ready: true, initPostMs: 2 },
          visionReferenceCount: 229, librarySize: 229, visionLocales: ['en'],
          visionIndexKey: 'fixture-' + databaseSha, libraryIntegrity: { degraded: false },
          libraryPerformance: { descriptorBuildMs: 20, totalReadyMs: 25, databaseLoadMs: 3, cacheStatus: 'miss' },
          visibleIdentity: null, identification: null
        }, activeCards: 0, entries: []
      };
      window.TCGateGameDatabases = { get: () => ({ manifestUrl: 'https://raw.githubusercontent.com/maximelaburthe-commits/tcgate_db_cyberpunk/' + databaseSha + '/manifest.json' }) };
      window.TCGTableStateBridge = { getRefs: () => window.__fixture.refs };
      window.TCGateDatabaseSource = { getVisionReferences: async () => refs };
      window.TCGIdentificationLab = { getSnapshot: () => window.__fixture.snapshot };
      window.TCGVisionEngine = { getSnapshot: () => ({ activeCards: window.__fixture.activeCards }) };
      window.TCGTableStateEngine = { getSnapshot: () => ({ entries: window.__fixture.entries }) };
    }, { context: actualContext, databaseSha });
    await loadObserver(page);
    const outcome = await page.evaluate(async () => {
      const expected = __fixture.refs.find(ref => ref.printingId);
      let confirmationRejected = false;
      try { __q.startTrial({ mode: 'physical', expectedCardId: expected.cardId }); } catch { confirmationRejected = true; }
      let automatedPhysicalRejected = false, freeTextRejected = false;
      try { __q.startTrial({ mode: 'physical', physicalConfirmation: 'REAL_CARDS_OPERATOR_CONFIRMED', expectedCardId: expected.cardId }); } catch { automatedPhysicalRejected = true; }
      try { __q.startTrial({ mode: 'automated', expectedCardId: expected.cardId, notes: ['private arbitrary free text'] }); } catch { freeTextRejected = true; }
      __q.startTrial({ mode: 'automated', expectedCardId: expected.cardId, expectedPrintingId: expected.printingId, stableWindowMs: 1000, maxObservationGapMs: 1000 });
      __fixtureTime = 200; __fixture.activeCards = 1; __q.sample();
      __fixtureTime = 300;
      __fixture.snapshot.visibleIdentity = { accepted: true, refId: expected.refId, cardId: expected.cardId, printingId: expected.printingId, image: expected.image };
      __fixture.snapshot.identification = { accepted: true, best: { ...expected, matcherScore: 0.78 }, candidates: [{ image: expected.image }] };
      __q.sample();
      __fixtureTime = 800; __q.sample();
      __fixtureTime = 1300; __q.sample();
      __fixtureTime = 1400; __q.markRemoval();
      __fixtureTime = 1500; __fixture.activeCards = 0; __q.sample();
      __fixtureTime = 1700; __fixture.snapshot.visibleIdentity = null; __fixture.snapshot.identification = null; __q.sample();
      __fixtureTime = 1800; __q.endTrial();
      const raw = __q.getSession();
      const report = __q.exportReport();
      const json1 = __q.exportJson(), json2 = __q.exportJson();
      __fixtureTime = 1900;
      __q.startTrial({ mode: 'automated', expectedCardId: expected.cardId });
      __fixtureTime = 2000; __fixture.refs[0] = { ...__fixture.refs[0], locale: 'fr' }; __q.sample();
      __fixtureTime = 2100; __q.endTrial();
      const contaminated = __q.getSession().trials.at(-1);
      let nextRejected = false; try { __q.startTrial({ mode: 'automated', expectedCardId: expected.cardId }); } catch { nextRejected = true; }
      __q.detach();
      __fixture.refs[0] = { ...__fixture.refs[0], locale: 'en' };
      __q = await TCGVisionQualificationRuntime.attach({ productSha: raw.context.productSha,
        environment: { execution: 'AUTOMATED', browserFamily: 'CHROMIUM', deviceId: 'private-raw-device', sdp: 'private-signaling', video: 'data:image/private' },
        plan: { sample: [], privateInfo: 'private-plan-data' }
      });
      __fixtureTime = 2200;
      __q.startScene({ mode: 'automated', scene: 'EMPTY_TABLE' });
      const other = __fixture.refs.find(ref => ref.cardId !== expected.cardId && ref.printingId);
      __fixture.snapshot.visibleIdentity = { accepted: true, image: expected.refId };
      __fixture.entries = [{ activeUid: 1, identity: { image: other.refId }, observations: [] }];
      __fixtureTime = 2300; __q.sample();
      __fixtureTime = 2400; __q.endScene();
      const multiScene = __q.getSession(), sceneReport = __q.exportReport();
      __q.detach();
      return { confirmationRejected, automatedPhysicalRejected, freeTextRejected, raw, report, sameJson: json1 === json2, contaminated, nextRejected, multiScene, sceneReport };
    });
    check(outcome.confirmationRejected, 'Physical capture needs explicit operator confirmation');
    check(outcome.automatedPhysicalRejected, 'An automated browser cannot relabel fixture observations as physical evidence');
    check(outcome.freeTextRejected, 'Raw sessions reject arbitrary observation free text');
    equal(outcome.raw.trials.length, 1, 'Manual begin/end records one bounded trial');
    equal(outcome.raw.trials[0].provenance, 'automated', 'Synthetic event fixtures are explicitly automated');
    check(outcome.raw.trials[0].observations.some(item => item.detected), 'Read-only detector state is observed');
    check(outcome.raw.trials[0].observations.some(item => item.identifiedCardId && item.score === 0.78 && item.scoreKind === 'matcherScore'), 'Existing matcher score is preserved without inventing a probability');
    equal(outcome.raw.trials[0].removal, { t0Ms: 1400, clearAtMs: 1700 }, 'Removal timing includes persisted identity until the exposed result clears');
    check(outcome.sameJson, 'Unchanged sessions export deterministic report bytes');
    check(outcome.contaminated.observations.some(item => item.validityErrors.includes('LOCALE_CONTAMINATION')), 'An observed FR candidate invalidates the trial');
    check(outcome.nextRejected, 'A contaminated corpus blocks further capture');
    const serialized = JSON.stringify(outcome.raw);
    check(!/data:image|blob:|candidate:|sdp|deviceId|audio|video|imageUrl|referenceImageUrl/.test(serialized), 'Raw session contains no images, media, signaling or raw device identifiers');
    check(!JSON.stringify(outcome.report).includes('REAL_CARDS_OPERATOR_CONFIRMED'), 'Automated output contains no operator physical confirmation');
    check(outcome.multiScene.scenes[0].observations.some(item => item.identifiedCandidates.length === 2 && !item.validityErrors.includes('MULTIPLE_IDENTITIES')), 'No-target scenes retain every actual identified candidate without suppressing multiple false IDs');
    equal(outcome.sceneReport.scenes[0].falseIdentifications, 2, 'Both exposed identities are counted as automated false-identification events');
    equal(outcome.sceneReport.falsePositiveScenes.physicalCount, 0, 'Synthetic no-target scene contributes no physical evidence');
    check(!JSON.stringify(outcome.multiScene).includes('private-'), 'Raw session export strips device, signaling and arbitrary plan metadata');
  } finally { await context.close(); }
}
async function main() {
  const fixture = await startBridgeFixture({ root }); let browser;
  try {
    const pinned = await pinnedDocuments();
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    console.log('VISION_QUALIFICATION_BROWSER_VERSION ' + browser.version());
    const actualContext = await initializationSeries(browser, fixture, pinned);
    await fixtureObserver(browser, actualContext);
    equal(new Set(measurements.map(item => item.measurementId)).size, 6, 'Six distinct initialization IDs prove that measurements were not repeated snapshot reads');
    equal(measurements.filter(item => item.kind === 'COLD').length, 3, 'Three independent cold contexts were measured');
    equal(measurements.filter(item => item.kind === 'WARM_RELOAD').length, 3, 'Three warm/reload contexts were measured');
    equal(errors, [], 'Existing application and opt-in observer produce no browser error');
    const artifactDir = path.resolve(process.env.VISION_QUALIFICATION_ARTIFACT_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'tcgate-vision-qualification-index-')));
    fs.mkdirSync(artifactDir, { recursive: true });
    const output = path.join(artifactDir, 'vision-qualification-index-measurements.json');
    const artifact = { schemaVersion: '1.0', evidence: 'AUTOMATED INDEX INITIALIZATION ONLY', physicalQualification: 'NOT TESTED',
      productSha: sha, databaseSha, gameId: 'cyberpunk', locale: 'en', referenceCount: 229, environment: { execution: 'AUTOMATED', browserFamily: 'CHROMIUM' },
      indexMeasurements: measurements };
    fs.writeFileSync(output, JSON.stringify(artifact, null, 2) + '\n', { flag: 'wx' });
    console.log('VISION_QUALIFICATION_INDEX_ARTIFACT ' + output);
    console.log('VISION_QUALIFICATION_1_0_BROWSER_OK ' + assertions + ' assertions; 3 cold / 3 reload; AUTOMATED ONLY; PHYSICAL NOT TESTED');
  } finally { await browser?.close(); await fixture.close(); }
}
main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
