'use strict';
// Browser fixtures exercise the real Workspace and qualification observer through
// buttons. Synthetic identities and accelerated clocks are AUTOMATED evidence;
// they are never a physical-card qualification or a new Vision benchmark.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require(process.env.WORKSPACE_PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(process.env.WORKSPACE_VISION_QUALIFICATION_TEST_ROOT || process.cwd());
const { startBridgeFixture } = require(path.join(root, 'report-email-bridge-fixture.js'));
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const databaseSha = '56402636a77af9c8b5dc4e3b61c509a185f3c834';
const dbPrefix = 'https://raw.githubusercontent.com/maximelaburthe-commits/tcgate_db_cyberpunk/' + databaseSha + '/';
const sampleUrl = 'https://raw.githubusercontent.com/maximelaburthe-commits/TCGate/' + sha + '/VISION_QUALIFICATION_SAMPLE.json';
const sampleDocument = JSON.parse(fs.readFileSync(path.join(root, 'VISION_QUALIFICATION_SAMPLE.json'), 'utf8'));
let assertions = 0;
function check(value, message) { assert(value, message); assertions++; }
function equal(actual, expected, message) { assert.deepEqual(actual, expected, message); assertions++; }
function publicPath(relative) {
  for (const stage of [process.env.WORKSPACE_VISION_QUALIFICATION_UI_STAGE, process.env.WORKSPACE_VISION_QUALIFICATION_SHARED_STAGE]) {
    if (stage && fs.existsSync(path.join(stage, 'public', relative))) return path.join(stage, 'public', relative);
    if (stage && fs.existsSync(path.join(stage, relative))) return path.join(stage, relative);
  }
  return path.join(root, 'public', relative);
}
const automatedAdapter = `
// TEST ONLY: keep every observation honestly automated while exercising real UI.
(() => {
 const real = window.TCGVisionQualificationRuntime;
 window.__qualificationAttachments = 0;
 window.TCGVisionQualificationRuntime = Object.freeze({...real, attach: async options => {
   window.__qualificationAttachments++;
   const q = await real.attach({...options, environment:{execution:'AUTOMATED',browserFamily:'CHROMIUM'}});
   window.__qualificationObserver = q;
   const automated = spec => ({...spec, mode:'automated', provenance:'automated', physicalConfirmation:undefined});
   return Object.freeze({...q,startTrial:spec=>q.startTrial(automated(spec)),startScene:spec=>q.startScene(automated(spec)),switchTrial:spec=>q.switchTrial(automated(spec))});
 }});
})();`;
async function pinnedDocuments() {
  const documents = new Map();
  async function read(relative) {
    check(typeof relative === 'string' && relative && !relative.includes('\\') && !relative.split('/').some(part => !part || part === '.' || part === '..'), 'Pinned fixture path remains bounded');
    let bytes;
    if (process.env.TCGATE_DB_FIXTURE_ROOT) bytes = fs.readFileSync(path.join(process.env.TCGATE_DB_FIXTURE_ROOT, relative));
    else {
      const response = await fetch(dbPrefix + relative);
      equal(response.status, 200, 'Immutable source document exists');
      bytes = Buffer.from(await response.arrayBuffer());
    }
    documents.set(relative, bytes); return JSON.parse(bytes.toString('utf8'));
  }
  const manifest = await read('manifest.json');
  await Promise.all([manifest.database_manifest, manifest.entrypoint || manifest.runtime_cards, manifest.runtime_printings, manifest.canonical_vision_index, manifest.printing_recognition_index, manifest.recognition_groups].map(read));
  const rich = JSON.parse(documents.get(manifest.printing_recognition_index));
  const assets = new Set(rich.cards.flatMap(card => card.recognitionGroups.flatMap(group => group.references.map(reference => reference.visionAssetPath))));
  equal(documents.size, 7, 'Seven authentic runtime source documents');
  equal(assets.size, 229, 'Exactly 229 authentic EN asset paths');
  return { documents, assets };
}
async function installRoutes(context, fixture, pinned, controls) {
  await context.route(fixture.origin + '/**', async route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/api/health') {
      controls.healthRequests++;
      if (controls.healthStatus !== 200) return route.fulfill({ status: controls.healthStatus, json: { ok: false } });
      if (controls.healthOverride !== undefined) return route.fulfill({ status: 200, json: { ok: true, buildSha: controls.healthOverride } });
      return route.continue();
    }
    if (/^\/[a-z0-9-]+\.(js|css|html)$/i.test(pathname)) {
      const candidate = publicPath(pathname.slice(1));
      if (fs.existsSync(candidate)) {
        let body = fs.readFileSync(candidate);
        if (pathname === '/vision-qualification-runtime.js') body = Buffer.from(body.toString('utf8') + automatedAdapter);
        return route.fulfill({ status: 200, body, contentType: pathname.endsWith('.js') ? 'text/javascript; charset=utf-8' : pathname.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/html; charset=utf-8' });
      }
    }
    return route.continue();
  });
  await context.route('https://raw.githubusercontent.com/**', async route => {
    const url = route.request().url();
    if (url.includes('/workspace-state/')) return route.fulfill({ json: { meta: { workspaceVersion: '3.0' }, items: [], session: {} }, headers: { 'access-control-allow-origin': '*' } });
    if (url.endsWith('/VISION_QUALIFICATION_SAMPLE.json')) {
      controls.sampleRequests.push(url);
      if (controls.sampleStatus !== 200) return route.fulfill({ status: controls.sampleStatus, body: 'protocol absent', headers: { 'access-control-allow-origin': '*' } });
      return route.fulfill({ json: controls.sampleDocument || sampleDocument, headers: { 'access-control-allow-origin': '*' } });
    }
    if (url.startsWith(dbPrefix)) {
      const relative = decodeURIComponent(url.slice(dbPrefix.length));
      if (pinned.documents.has(relative)) return route.fulfill({ status: 200, contentType: 'application/json', body: pinned.documents.get(relative), headers: { 'access-control-allow-origin': '*' } });
      check(pinned.assets.has(relative), 'Only authentic immutable EN assets requested');
      if (process.env.TCGATE_DB_FIXTURE_ROOT) return route.fulfill({ status: 200, contentType: 'image/webp', body: fs.readFileSync(path.join(process.env.TCGATE_DB_FIXTURE_ROOT, relative)), headers: { 'access-control-allow-origin': '*' } });
      return route.continue();
    }
    return route.fulfill({ status: 404, body: 'Unspecified immutable fixture source', headers: { 'access-control-allow-origin': '*' } });
  });
}
function controls() { return { healthStatus: 200, healthRequests: 0, sampleStatus: 200, sampleRequests: [] }; }
async function status(page, pattern) {
  try { await page.waitForFunction(source => new RegExp(source, 'i').test([document.querySelector('#vqStatus')?.textContent, document.querySelector('#vqError')?.textContent].join(' ')), pattern, { timeout: 20000 }); }
  catch (error) {
    console.error('WORKSPACE_VISION_QUALIFICATION_STATUS_DIAGNOSTIC ' + JSON.stringify(await page.evaluate(() => {
      const state = window.TCGWorkspaceVisionQualification?.getState?.(), detector = window.TCGVisionEngine?.getSnapshot?.();
      return { status: document.querySelector('#vqStatus')?.textContent, error: document.querySelector('#vqError')?.textContent,
        prepared: state?.prepared, preparing: state?.preparing, gameId: state?.session?.context?.gameId, locale: state?.session?.context?.locale,
        references: state?.session?.context?.referenceCount, detectorActive: detector?.active, detectorReady: detector?.modelReady };
    })));
    throw error;
  }
}
async function state(page) { return page.evaluate(() => window.TCGWorkspaceVisionQualification.getState()); }
async function openLab(page, origin) {
  await page.goto(origin + '/workspace.html');
  await page.getByRole('tab', { name: 'Vision Lab', exact: true }).click();
  await page.waitForFunction(() => window.TCGWorkspaceVisionQualification && document.querySelector('#vqPrepare'));
}
async function readDownload(page, selector) {
  const pending = page.waitForEvent('download'); await page.click(selector); const download = await pending;
  const text = fs.readFileSync(await download.path(), 'utf8');
  return { name: download.suggestedFilename(), text, json: JSON.parse(text) };
}
async function realWorkspaceSmoke(browser, fixture, pinned) {
  const context = await browser.newContext({ permissions: ['camera'], viewport: { width: 1440, height: 1000 } });
  const control = controls(), errors = [];
  try {
    await installRoutes(context, fixture, pinned, control);
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    console.log('WORKSPACE_VISION_QUALIFICATION_STEP actual-lab');
    await openLab(page, fixture.origin);
    check(await page.locator('#visionQualificationPanel').isVisible(), 'Qualification lives inside existing Workspace Vision Lab');
    check(/Ne rechargez pas/i.test(await page.locator('#visionQualificationPanel').innerText()), 'Reload warning is visible before session start');
    check(!(await state(page)).prepared, 'Observer is not prepared before explicit action');
    await page.check('#vqPhysicalConfirm');
    control.healthOverride = null;
    await page.click('#vqPrepare'); await status(page, 'SHA|build|déploy');
    check(!(await state(page)).prepared, 'Missing deployed SHA blocks preparation');
    control.healthOverride = 'update/next';
    await page.click('#vqPrepare'); await status(page, 'SHA|build|déploy');
    check(!(await state(page)).prepared, 'A branch name cannot substitute for actual deployed SHA');
    control.healthOverride = undefined; control.healthStatus = 503;
    await page.click('#vqPrepare'); await status(page, 'indisponible|health|HTTP|préparation');
    check(!(await state(page)).prepared, 'Unavailable health blocks preparation');
    control.healthStatus = 200;
    await page.click('#vqPrepare'); await status(page, 'Vision|Lab|démarr|229|identification');
    check(!(await state(page)).prepared, 'Existing Vision runtime must already be ready');
    await page.waitForFunction(() => !document.querySelector('#visionCameraButton').disabled);
    await page.click('#visionCameraButton');
    await page.waitForFunction(() => document.querySelector('#remoteVideo').videoWidth > 0);
    console.log('WORKSPACE_VISION_QUALIFICATION_STEP actual-detector');
    await page.click('#visionDetectButton');
    await page.waitForFunction(() => window.TCGVisionEngine?.getSnapshot()?.modelReady && window.TCGDetectionLab?.state.detecting && window.TCGDetectionLab.state.stream?.getVideoTracks().some(track => track.readyState === 'live'), null, { timeout: 120000 });
    console.log('WORKSPACE_VISION_QUALIFICATION_STEP actual-identification');
    await page.selectOption('#labSource', 'production'); await page.click('#labInspect');
    await page.waitForFunction(() => !document.querySelector('#labStart').disabled, null, { timeout: 60000 });
    await page.click('#labStart');
    await page.waitForFunction(() => { const s = window.TCGIdentificationLab?.getSnapshot(); return s?.libraryReady && s.matcherWorker?.ready && s.librarySize === 229; }, null, { timeout: 120000 });
    equal(await page.evaluate(() => window.TCGTableStateBridge.getRefs().length), 229, 'Existing Worker bridge captured all 229 actual references');
    control.sampleStatus = 404;
    await page.click('#vqPrepare'); await status(page, 'protocole absent pour ce build');
    check(!(await state(page)).prepared, 'No same-build protocol blocks without fallback');
    equal(control.sampleRequests.at(-1), sampleUrl, 'Missing protocol request uses actual immutable deployed SHA');
    control.sampleStatus = 200;
    control.sampleDocument = { ...sampleDocument, locale: 'fr' };
    await page.click('#vqPrepare'); await status(page, 'locale|corpus|protocole|invalide');
    check(!(await state(page)).prepared, 'A French protocol is rejected for active EN corpus');
    control.sampleDocument = undefined;
    console.log('WORKSPACE_VISION_QUALIFICATION_STEP actual-prepare');
    await page.click('#vqPrepare'); await status(page, 'Qualification prête');
    const ready = await state(page);
    equal(ready.productSha, sha, 'Prepared build SHA is the actual /api/health SHA');
    equal(ready.sampleUrl, sampleUrl, 'Sample is fetched from exactly the same immutable build');
    equal(ready.session.context.references.length, 229, 'Observer attaches to actual existing Core references');
    equal(ready.session.context.locale, 'en', 'Prepared context is EN');
    equal(ready.session.context.gameId, 'cyberpunk', 'Prepared game is Cyberpunk');
    equal(await page.locator('#vqCardName').textContent(), sampleDocument.sample[0].name, 'First card name comes from the sample JSON');
    check((await page.locator('#vqBuildSha').textContent()).includes(sha), 'Build SHA is displayed');
    check(await page.locator('#vqPrepare').isDisabled(), 'A second simultaneous preparation is prevented');
    equal(await page.evaluate(() => window.__qualificationAttachments), 1, 'Exactly one observer was attached');
    check(control.sampleRequests.every(url => url === sampleUrl), 'No main/update-next/historical SHA sample fallback occurred');
    const actualContext = ready.session.context;
    await page.click('#visionDetectButton'); await page.click('#visionCameraButton');
    equal(errors, [], 'Real Workspace + existing camera/index + qualification panel produce no browser exception');
    console.log('WORKSPACE_VISION_QUALIFICATION_REAL_LAB_OK actual immutable EN 150/229/229, no recognition trial, no physical claim');
    return actualContext;
  } finally { await context.close(); }
}
async function installIdentityFixture(page, actualContext) {
  await page.evaluate(({ context, databaseSha }) => {
    const refs = context.references.map(ref => ({ ...ref, image: ref.refId }));
    window.__qualificationFixture = { refs, detector: { active: true, modelReady: true, activeCards: 0 }, snapshot: {
      gameId: 'cyberpunk', playerLocale: 'en', libraryReady: true, matcherWorker: { ready: true }, visionReferenceCount: 229,
      librarySize: 229, visionLocales: ['en'], visionIndexKey: 'automated-workspace-qualification-fixture', libraryIntegrity: { degraded: false },
      visibleIdentity: null, identification: null
    } };
    window.TCGateGameDatabases = { get: () => ({ manifestUrl: 'https://raw.githubusercontent.com/maximelaburthe-commits/tcgate_db_cyberpunk/' + databaseSha + '/manifest.json' }) };
    window.TCGTableStateBridge = { getRefs: () => refs };
    window.TCGateDatabaseSource = { getVisionReferences: async () => refs };
    window.TCGIdentificationLab = { getSnapshot: () => window.__qualificationFixture.snapshot, getAnalyzedCropDataUrl: () => null };
    window.TCGVisionEngine = { getSnapshot: () => window.__qualificationFixture.detector };
    window.TCGTableStateEngine = { getSnapshot: () => ({ entries: [] }) };
  }, { context: actualContext, databaseSha });
}
async function setIdentity(page, cardId) {
  await page.evaluate(id => {
    const fixture = window.__qualificationFixture;
    if (!id) { fixture.detector.activeCards = 0; fixture.snapshot.visibleIdentity = null; fixture.snapshot.identification = null; }
    else {
      const ref = fixture.refs.find(value => value.cardId === id);
      if (!ref) throw Error('Unknown automated fixture identity');
      fixture.detector.activeCards = 1;
      fixture.snapshot.visibleIdentity = { accepted: true, refId: ref.refId, cardId: ref.cardId, printingId: ref.printingId, image: ref.refId };
      fixture.snapshot.identification = { accepted: true, best: { ...ref, matcherScore: 0.9 }, candidates: [{ image: ref.refId }] };
    }
    window.dispatchEvent(new CustomEvent('tcg-identification-result', { detail: { accepted: Boolean(id) } }));
  }, cardId || null);
}
async function advance(page, durationMs) {
  // Clock jumps stay below the observer's 1,000 ms continuity guard. Firing
  // interval callbacks at each 500 ms boundary keeps a real monotonic trace
  // without waiting ten/thirty wall-clock seconds for every synthetic case.
  for (let remaining = durationMs; remaining > 0; remaining -= 500) await page.clock.fastForward(Math.min(500, remaining));
}
async function finishCardTrial(page, cardId, automatic = false) {
  await setIdentity(page, null); await page.click('#vqStart');
  await setIdentity(page, cardId); await advance(page, 10250);
  if (!automatic) await page.click('#vqEnd');
}
async function automatedGuidedWorkflow(browser, fixture, pinned, actualContext) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const control = controls(), errors = [], requests = [];
  try {
    await installRoutes(context, fixture, pinned, control);
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => requests.push({ url: request.url(), method: request.method() }));
    await page.clock.install({ time: new Date('2026-11-03T12:00:00Z') });
    await openLab(page, fixture.origin);
    // Opening the actual Lab lazily loads its engine. Wait until that load is
    // finished before installing explicitly automated event-fixture snapshots.
    await page.waitForFunction(() => !document.querySelector('#visionCameraButton').disabled);
    await installIdentityFixture(page, actualContext);
    await page.check('#vqPhysicalConfirm');
    console.log('WORKSPACE_VISION_QUALIFICATION_STEP automated-prepare');
    await page.click('#vqPrepare'); await status(page, 'Qualification prête');
    check(await page.locator('#vqPhysicalConfirm').isDisabled(), 'Confirmed session setup is locked after preparation');
    equal(await page.locator('#vqSampleList li').allTextContents(), sampleDocument.sample.map(card => card.name + ' · ' + card.profile.type + ' · ' + card.profile.color), 'All fifteen proposed cards are loaded from the JSON');
    await page.evaluate(() => { window.__qualificationFixture.snapshot.playerLocale = 'fr'; });
    await page.click('#vqStart');
    check(/LOCALE|context/i.test(await page.locator('#vqError').textContent()), 'A changed FR context blocks capture from the UI');
    equal((await state(page)).session.trials.length, 0, 'Cross-locale attempt does not create a trial');
    await page.evaluate(() => { window.__qualificationFixture.snapshot.playerLocale = 'en'; });
    // Substitution occurs before any observation; only JSON-authorized candidates.
    const original = sampleDocument.sample.find(card => card.substitution?.eligibleAlternatives?.length);
    await page.locator('details:has(> #vqSampleList) > summary').click();
    await page.selectOption('#vqSetupCard', original.sampleId);
    await page.click('#vqUnavailable');
    const options = await page.locator('#vqAlternative option').evaluateAll(nodes => nodes.filter(node => node.value).map(node => ({ value: node.value, label: node.textContent })));
    equal(options.length, original.substitution.eligibleAlternatives.length, 'Only JSON-authorized profile alternatives are displayed');
    check(options.every(option => original.substitution.eligibleAlternatives.some(candidate => option.label.includes(candidate.name))), 'Alternative labels originate in supplied JSON');
    await page.selectOption('#vqAlternative', options[0].value); await page.click('#vqApplySubstitution');
    let snapshot = await state(page);
    const substitution = snapshot.session.plan.substitutions[0];
    equal(substitution.originalCardId, original.cardId, 'Substitution records original card');
    equal(substitution.originalPrintingId, original.printingId, 'Substitution records original exact printing');
    equal(substitution.reason, 'PHYSICAL_CARD_UNAVAILABLE', 'Substitution has controlled availability reason');
    check(original.substitution.eligibleAlternatives.some(item => item.cardId === substitution.replacementCardId && item.printingId === substitution.replacementPrintingId), 'Replacement is an authorized exact pair');
    // All observation control is by visible buttons; fixtures only expose states.
    const firstJob = snapshot.currentJob;
    await finishCardTrial(page, actualContext.references.find(ref => ref.cardId !== firstJob.card.cardId).cardId);
    snapshot = await state(page);
    const firstTrial = snapshot.session.trials[0], firstTrialBytes = JSON.stringify(firstTrial);
    check(/Mauvaise identification|Instable/.test(await page.locator('#vqResult').innerText()), 'An incorrect runtime identity is plainly shown');
    await page.click('#vqNext');
    for (let count = 1; count < 3; count++) {
      const job = (await state(page)).currentJob;
      await finishCardTrial(page, job.card.cardId); await page.click('#vqNext');
    }
    snapshot = await state(page);
    equal(snapshot.session.trials.length, 3, 'Three button-driven nominal trials are appended');
    equal(JSON.stringify(snapshot.session.trials[0]), firstTrialBytes, 'A bad trial remains unchanged after next attempts');
    check((await page.locator('#vqProgress').innerText()).includes('3 / 45'), 'Global progress derives from three real observer trials');
    check(!(await page.locator('#vqCardName').textContent()).includes(sampleDocument.sample[0].name), 'Next card is guided after three nominal attempts');
    // Explicit invalidation keeps original raw bad record; it is never a retry.
    await finishCardTrial(page, actualContext.references.find(ref => ref.cardId !== snapshot.currentJob.card.cardId).cardId);
    const fourth = (await state(page)).session.trials.at(-1), fourthBytes = JSON.stringify(fourth);
    await page.click('#vqInvalidate'); snapshot = await state(page);
    equal(JSON.stringify(snapshot.session.trials.at(-1)), fourthBytes, 'Explicit invalidation preserves original observation record');
    check(snapshot.session.trialAnnotations?.some(item => item.trialId === fourth.trialId), 'Protocol invalidation is an appended separate event');
    await page.click('#vqNext');
    console.log('WORKSPACE_VISION_QUALIFICATION_STEP automated-nominal');
    let sharedArtUiChecked = false;
    for (let attempt = 0; attempt < 48; attempt++) {
      snapshot = await state(page);
      if (!snapshot.currentJob || snapshot.currentJob.condition !== 'NOMINAL') break;
      const ref = actualContext.references.find(value => value.cardId === snapshot.currentJob.card.cardId);
      await finishCardTrial(page, snapshot.currentJob.card.cardId);
      if (!sharedArtUiChecked && !ref.printingId && ref.recognitionMode === 'shared') {
        check(/impression exacte non résolue/i.test(await page.locator('#vqPrintingResult').textContent()), 'Shared art distinguishes correct card from unresolved exact printing');
        check(!(await page.locator('#vqResult').getAttribute('class')).includes('error'), 'Unresolved shared art is not shown as a red canonical identity error');
        sharedArtUiChecked = true;
      }
      await page.click('#vqNext');
    }
    snapshot = await state(page);
    check((await page.locator('#vqProgress').innerText()).includes('45 / 45'), 'Forty-five nominal protocol slots finish from actual session');
    check(await page.locator('#vqCondition').isEnabled(), 'Complementary conditions are unlocked after nominal');
    check(snapshot.session.trials.every(trial => trial.provenance === 'automated'), 'Automated UI fixtures cannot manufacture physical evidence');
    check(sharedArtUiChecked, 'A real shared-art corpus case was exercised through UI');
    const variant = sampleDocument.plan.variantCases.find(value => value.cardId !== substitution.originalCardId);
    const testedPrinting = variant.printings.find(printing => snapshot.session.trials.some(trial => trial.expectedPrintingId === printing.printingId));
    await page.selectOption('#vqCondition', 'SIMILAR_PRINTINGS');
    await page.locator('#vqVariantsSetup summary').click();
    const observedVariant = page.locator('#vqVariantAvailability select[data-case-id="' + variant.caseId + '"][data-printing-id="' + testedPrinting.printingId + '"]');
    check(await observedVariant.isDisabled(), 'Observed nominal printing availability is locked from contradictory declarations');
    equal(await observedVariant.inputValue(), 'AVAILABLE', 'A printing physically declared in nominal is displayed available for later variants');
    // Angle trial follows supplied degraded sample/matrix rather than copied IDs.
    console.log('WORKSPACE_VISION_QUALIFICATION_STEP automated-complementary');
    await page.selectOption('#vqCondition', 'ANGLE'); snapshot = await state(page);
    await finishCardTrial(page, snapshot.currentJob.card.cardId);
    check((await state(page)).session.trials.at(-1).notes.includes('ANGLE_SLIGHT'), 'Angle position is recorded with controlled code');
    // Stability holds for actual ten-second monotonic clock, automatic ending.
    await page.selectOption('#vqCondition', 'STABILITY'); snapshot = await state(page);
    await finishCardTrial(page, snapshot.currentJob.card.cardId, true);
    snapshot = await state(page);
    equal(snapshot.session.active, null, 'Stability is automatically stopped at ten seconds');
    const stability = snapshot.session.trials.at(-1);
    equal(stability.condition, 'STABILITY', 'Stability condition is recorded');
    check(stability.endMs - stability.t0Ms >= 10000, 'Stability observes a genuine monotonic ten-second interval');
    // Removal starts its marker from the UI only after actual identification.
    await page.selectOption('#vqCondition', 'REMOVAL'); snapshot = await state(page);
    await setIdentity(page, null); await page.click('#vqStart');
    await setIdentity(page, snapshot.currentJob.card.cardId); await advance(page, 1500);
    await page.click('#vqRemoval'); await setIdentity(page, null); await advance(page, 9000); await page.click('#vqEnd');
    check((await state(page)).session.trials.at(-1).removal?.clearAtMs != null, 'Removal marker and clearing time are measured through real observer');
    // A measured failure never disappears or requires a false protocol
    // invalidation to unlock B. Repeating A appends a fresh bounded attempt.
    await page.selectOption('#vqCondition', 'RAPID_SWITCH'); snapshot = await state(page);
    const firstPair = snapshot.currentJob.pairIndex;
    await setIdentity(page, null); await page.click('#vqStart'); await advance(page, 10250); await page.click('#vqEnd');
    snapshot = await state(page);
    const failedA = snapshot.session.trials.at(-1), failedABytes = JSON.stringify(failedA);
    const annotationsBeforeRetry = JSON.stringify(snapshot.session.trialAnnotations);
    check(/Non détectée/.test(await page.locator('#vqResult').textContent()), 'A valid no-detection A outcome remains visible');
    check(!snapshot.session.trialAnnotations.some(value => value.trialId === failedA.trialId), 'No-detection A is a measured failure, not an invalid protocol');
    await page.click('#vqNext'); snapshot = await state(page);
    equal(snapshot.currentJob.phase, 'B', 'The derived next rapid-switch job remains B after failed A');
    check(await page.locator('#vqRetrySwitch').isVisible(), 'Failed A exposes an explicit new-A attempt button');
    check(!(await page.locator('#vqStart').isVisible()) || await page.locator('#vqStart').isDisabled(), 'B cannot start without a cleared prior A');
    const beforeRetryCount = snapshot.session.trials.length;
    await page.click('#vqRetrySwitch'); snapshot = await state(page);
    equal(snapshot.currentJob.phase, 'A', 'Retry starts a fresh A rather than changing the expected B identity');
    equal(snapshot.currentJob.pairIndex, firstPair, 'Retry stays in the same actual switch pair');
    const retriedAId = snapshot.session.active.trialId;
    check(retriedAId !== failedA.trialId, 'Retried A has a distinct attempt ID');
    equal(snapshot.session.trials.length, beforeRetryCount, 'Starting new A never deletes or replaces a completed record');
    equal(JSON.stringify(snapshot.session.trials.find(trial => trial.trialId === failedA.trialId)), failedABytes, 'Failed A observations remain byte identical during retry');
    equal(JSON.stringify(snapshot.session.trialAnnotations), annotationsBeforeRetry, 'New A requires no false invalidation or annotation');
    // Successful A now supplies the actual removal marker for its own linked B.
    await setIdentity(page, snapshot.currentJob.card.cardId); await advance(page, 10000);
    await page.click('#vqRemoval'); await setIdentity(page, null); await advance(page, 500);
    await page.click('#vqSwitch'); snapshot = await state(page);
    await setIdentity(page, snapshot.currentJob.card.cardId); await advance(page, 10250); await page.click('#vqEnd');
    snapshot = await state(page);
    const switched = snapshot.session.trials.at(-1), prior = snapshot.session.trials.at(-2);
    equal(switched.previousTrialId, prior.trialId, 'Rapid switch preserves linked observer trial IDs');
    equal(switched.previousTrialId, retriedAId, 'B is linked to the new successful A, never the earlier failed A');
    check(prior.removal != null, 'Rapid switch retains previous actual removal marker');
    equal(JSON.stringify(snapshot.session.trials.find(trial => trial.trialId === failedA.trialId)), failedABytes, 'Original no-detection A remains intact after successful B');
    // The second planned pair is reachable. A detected identity which never
    // clears is also a retained measured failure with the same honest recovery.
    await page.click('#vqNext'); snapshot = await state(page);
    equal(snapshot.currentJob.pairIndex, firstPair + 1, 'Completing B unlocks the second planned rapid-switch pair');
    equal(snapshot.currentJob.phase, 'A', 'Second pair begins with its real A card');
    await setIdentity(page, null); await page.click('#vqStart');
    await setIdentity(page, snapshot.currentJob.card.cardId); await advance(page, 10000);
    await page.click('#vqRemoval'); await advance(page, 500); await page.click('#vqEnd');
    snapshot = await state(page);
    const unclearedA = snapshot.session.trials.at(-1), unclearedABytes = JSON.stringify(unclearedA);
    equal(unclearedA.removal.clearAtMs, null, 'The failed clearing observation is preserved as actually measured');
    await page.click('#vqNext');
    check(await page.locator('#vqRetrySwitch').isVisible(), 'An uncleared A exposes the same append-only recovery');
    await page.click('#vqRetrySwitch'); snapshot = await state(page);
    const retriedSecondA = snapshot.session.active.trialId;
    check(retriedSecondA !== unclearedA.trialId, 'An uncleared A retry is a new trial');
    await setIdentity(page, snapshot.currentJob.card.cardId); await advance(page, 10000);
    await page.click('#vqRemoval'); await setIdentity(page, null); await advance(page, 500); await page.click('#vqSwitch');
    snapshot = await state(page); await setIdentity(page, snapshot.currentJob.card.cardId); await advance(page, 10250); await page.click('#vqEnd');
    snapshot = await state(page);
    equal(snapshot.session.trials.at(-1).previousTrialId, retriedSecondA, 'Second B links to its successful retry A');
    equal(JSON.stringify(snapshot.session.trials.find(trial => trial.trialId === unclearedA.trialId)), unclearedABytes, 'Uncleared A observations stay byte identical');
    check(!snapshot.session.trialAnnotations.some(value => value.trialId === failedA.trialId || value.trialId === unclearedA.trialId), 'Both measured rapid-switch failures remain unannotated evidence');
    // All five no-target scenes: no early finish; countdown automatic at 30s.
    await page.selectOption('#vqCondition', 'NEGATIVE');
    for (const scene of sampleDocument.plan.requiredScenes) {
      await setIdentity(page, null); await page.click('#vqStart');
      check(/00:30/.test(await page.locator('#vqTimer').textContent()), 'Negative scene countdown starts at thirty seconds');
      await advance(page, 29250);
      check((await state(page)).session.active?.scene === scene.scene, 'Scene remains active before thirty seconds');
      await advance(page, 1000); snapshot = await state(page);
      equal(snapshot.session.active, null, 'No-target scene stops automatically');
      const recorded = snapshot.session.scenes.at(-1);
      equal(recorded.scene, scene.scene, 'The next planned negative scene is recorded');
      check(recorded.endMs - recorded.t0Ms >= 30000, 'Negative scene actually observes at least thirty seconds');
      if (scene !== sampleDocument.plan.requiredScenes.at(-1)) await page.click('#vqNext');
    }
    // Export the sanitized raw session and both reports through visible buttons.
    let unexpectedDownload = false;
    const observeDownload = () => { unexpectedDownload = true; };
    page.on('download', observeDownload);
    control.healthOverride = 'a'.repeat(40);
    await page.click('#vqCanonicalReport');
    await page.waitForFunction(() => /build.*chang|chang.*build/i.test(document.querySelector('#vqError').textContent));
    check(!unexpectedDownload, 'A changed deployed build blocks canonical download');
    page.off('download', observeDownload);
    control.healthOverride = undefined;
    const sessionExport = await readDownload(page, '#vqExportSession');
    const reading = await readDownload(page, '#vqReadingReport');
    const canonical = await readDownload(page, '#vqCanonicalReport');
    const canonicalAgain = await readDownload(page, '#vqCanonicalReport');
    equal(sessionExport.name, 'vision-qualification-session.json', 'Session uses canonical sanitized file name');
    equal(canonical.name, 'vision-qualification-1.0.json', 'Canonical export has required name');
    equal(canonical.text, canonicalAgain.text, 'Canonical report is byte deterministic');
    const reportModule = require(publicPath('vision-qualification-report.js'));
    const cliEquivalent = reportModule.generate({ productSha: sha, sampleProductSha: sha, references: actualContext.references, sampleDocument, sessions: [sessionExport.json], indexInputs: [] });
    equal(canonical.text, reportModule.stableStringify(cliEquivalent), 'Workspace canonical bytes equal the shared CLI report generator');
    equal(canonical.json.productSha, sha, 'Canonical report is bound to actual deployed SHA');
    equal(canonical.json.physicalQualification, 'NOT TESTED', 'Automated click fixtures do not qualify physical Vision');
    equal(canonical.json.falsePositiveScenes.physicalCount, 0, 'Accelerated fixture scenes contribute zero physical tests');
    for (const output of [sessionExport, reading, canonical]) {
      check(!/data:image|data:video|blob:|candidate:|"(?:sdp|deviceId|audio|video|imageUrl|referenceImageUrl|screenshot)"/i.test(output.text), 'Exports contain no media, signaling, raw device IDs or screenshot');
      check(!output.text.includes('REAL_CARDS_OPERATOR_CONFIRMED'), 'Automated fixture exports carry no physical-card confirmation');
    }
    check(!requests.some(request => request.method !== 'GET'), 'Qualification performs no server writes');
    equal(errors, [], 'Guided qualification clicks produce no browser exceptions');
    const artifactDir = path.resolve(process.env.WORKSPACE_VISION_QUALIFICATION_ARTIFACT_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'tcgate-workspace-qualification-ux-')));
    fs.mkdirSync(artifactDir, { recursive: true });
    fs.writeFileSync(path.join(artifactDir, 'automated-guided-session.json'), sessionExport.text, { flag: 'wx' });
    fs.writeFileSync(path.join(artifactDir, 'automated-guided-canonical-report.json'), canonical.text, { flag: 'wx' });
    console.log('WORKSPACE_VISION_QUALIFICATION_UX_ARTIFACT ' + artifactDir);
  } finally { await context.close(); }
}
async function main() {
  const previous = process.env.RAILWAY_GIT_COMMIT_SHA;
  process.env.RAILWAY_GIT_COMMIT_SHA = sha;
  const fixture = await startBridgeFixture({ root });
  if (previous === undefined) delete process.env.RAILWAY_GIT_COMMIT_SHA; else process.env.RAILWAY_GIT_COMMIT_SHA = previous;
  let browser;
  try {
    const pinned = await pinnedDocuments();
    browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
    const actualContext = await realWorkspaceSmoke(browser, fixture, pinned);
    await automatedGuidedWorkflow(browser, fixture, pinned, actualContext);
    console.log('WORKSPACE_VISION_QUALIFICATION_BROWSER_OK ' + assertions + ' assertions; actual Workspace/EN index, click-guided AUTOMATED observations, physical NOT TESTED');
  } finally { await browser?.close(); await fixture.close(); }
}
main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
