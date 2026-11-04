'use strict';
// This suite exercises receipt orchestration with authentic scalar corpus
// metadata. All newly observed identities remain explicitly AUTOMATED.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { chromium } = require(process.env.WORKSPACE_PLAYWRIGHT_PATH || 'playwright');
const helper = require('./workspace-vision-qualification-browser-test.js');
const { startBridgeFixture } = require(path.join(helper.root, 'report-email-bridge-fixture.js'));
const proof = require(path.join(helper.root, 'public/vision-qualification-receipt.js'));
const rawUrl = proof.RAW_ROOT + helper.sha + '/' + proof.RECEIPT_FILE;
const copy = value => JSON.parse(JSON.stringify(value));
const complementary = ['ANGLE', 'LOW_LIGHT', 'DISTANCE', 'ORIENTATION', 'SLEEVE_GLARE',
  'STABILITY', 'REMOVAL', 'RAPID_SWITCH', 'SIMILAR_PRINTINGS', 'NEGATIVE'];
let assertions = 0;
function check(value, message) { assert.ok(value, message); assertions++; }
function equal(actual, expected, message) { assert.deepEqual(actual, expected, message); assertions++; }
async function enabledConditions(page, enabled, message) {
  for (const condition of complementary) {
    equal(await page.locator('#vqCondition option[value="' + condition + '"]').evaluate(option => !option.disabled),
      enabled, message + ': ' + condition);
  }
}
async function installReceiptRoutes(context, fixture, receipt, options, requests) {
  await context.route('https://raw.githubusercontent.com/**/VISION_NOMINAL_QUALIFICATION_RECEIPT.json', async route => {
    requests.push({ url: route.request().url(), method: route.request().method() });
    if (options.absent || route.request().url() !== rawUrl) return route.fulfill({
      status: 404, body: 'No receipt for this exact build', headers: { 'access-control-allow-origin': '*' }
    });
    return route.fulfill({ status: 200, json: receipt, headers: { 'access-control-allow-origin': '*' } });
  });
  await context.route(fixture.origin + '/api/vision-qualification-compatibility', async route => {
    const response = await route.fetch();
    equal(response.status(), 200, 'Read-only deployed compatibility endpoint is available');
    const value = await response.json();
    if (!options.keepOriginalReceiptDigest) value.receiptSha256 = proof.digest(receipt);
    options.compatibility?.(value);
    await route.fulfill({ status: 200, json: value });
  });
}
async function prepare(page, fixture, actualContext, camera = false) {
  await helper.openLab(page, fixture.origin);
  await page.waitForFunction(() => !document.querySelector('#visionCameraButton').disabled);
  if (camera) {
    await page.click('#visionCameraButton');
    await page.waitForFunction(() => document.querySelector('#remoteVideo').videoWidth > 0);
  }
  await helper.installIdentityFixture(page, actualContext);
  await page.check('#vqPhysicalConfirm'); await page.click('#vqPrepare');
  await page.waitForFunction(() => window.TCGWorkspaceVisionQualification.getState().prepared, null, { timeout: 30000 });
  await helper.advance(page, 1250);
}
async function download(page, selector) {
  const event = page.waitForEvent('download');
  await page.click(selector);
  const file = await event;
  return JSON.parse(fs.readFileSync(await file.path(), 'utf8'));
}
async function screenshot(page, name) {
  if (!process.env.WORKSPACE_SCREENSHOT_DIR) return;
  fs.mkdirSync(process.env.WORKSPACE_SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(process.env.WORKSPACE_SCREENSHOT_DIR, name + '.png') });
}
async function scenario(browser, fixture, actualContext, official, name, options = {}) {
  const context = await browser.newContext({ permissions: ['camera'], viewport: { width: 1366, height: 768 } });
  const receipt = copy(official), controls = helper.controls(), requests = [], errors = [];
  options.receipt?.(receipt);
  try {
    await helper.installRoutes(context, fixture, { documents: new Map(), assets: new Set() }, controls);
    await installReceiptRoutes(context, fixture, receipt, options, requests);
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.install({ time: new Date('2026-11-04T09:00:00Z') });
    await prepare(page, fixture, actualContext, name === 'versioned-pass');
    let current = await helper.state(page);
    equal(current.session.trials.length, 0, name + ': new session contains no fabricated nominal observations');
    equal(current.session.scenes.length, 0, name + ': no fabricated physical scenes');
    check(!current.sessionNominalGate.ready, name + ': current empty session does not qualify nominal');
    equal(current.nominalReceiptUrl, rawUrl, name + ': receipt provenance uses the exact health build SHA');
    equal(requests.length, 1, name + ': exactly one immutable receipt request, without fallback');
    equal(requests[0], { url: rawUrl, method: 'GET' }, name + ': immutable receipt is read-only');
    if (options.ready) {
      check(current.qualifiedNominalGate.ready, name + ': authentic official receipt qualifies nominal');
      check(current.nominalGate.ready, name + ': official gate unlocks an empty current session');
      equal(current.nominalGate.source, 'QUALIFICATION_RECEIPT', name + ': official gate source is explicit');
      equal(current.sessionNominalGate.valid, 0, name + ': current-session numerator is still zero');
      equal(current.qualifiedNominalGate.correct, 43, name + ': physical correct count comes from the official receipt');
      equal(current.qualifiedNominalGate.valid, 45, name + ': physical denominator comes from the official receipt');
      await enabledConditions(page, true, name + ': every complementary condition is immediately enabled');
      equal(await page.locator('#vqCondition').inputValue(), 'ANGLE', name + ': no request to repeat forty-five nominal trials');
      const selectorGeometry = await page.locator('#vqCondition').evaluate(select => {
        const box = select.getBoundingClientRect();
        return { top: box.top, bottom: box.bottom, right: box.right, width: box.width, height: innerHeight, viewportWidth: innerWidth };
      });
      check(selectorGeometry.width > 0 && selectorGeometry.top >= 0 && selectorGeometry.bottom <= selectorGeometry.height &&
        selectorGeometry.right <= selectorGeometry.viewportWidth, name + ': complementary selector is immediately visible at 1366x768');
      const label = await page.locator('#vqNominalGate').innerText();
      check(/Nominal physique qualifié/.test(label), name + ': qualified nominal message is visible');
      check(/43 \/ 45/.test(label) && /95,56/.test(label), name + ': visible physical counts and rounded percentage');
      check(/Mauvaises identifications : 0 %/.test(label), name + ': zero wrong identifications is visible');
      check(/Conditions complémentaires débloquées/.test(label), name + ': unlocked complementary message is visible');
      equal(await page.locator('#vqNominalGate a').getAttribute('href'), rawUrl, name + ': visible provenance links to same-build receipt');
      equal(await page.locator('#vqImportInputs').inputValue(), '', name + ': no manual import is required');
      await screenshot(page, 'vision-6c2-qualified-fresh-1366x768');
      // A reload creates another empty observation session. The same immutable
      // receipt must restore the gate without local storage or imported input.
      const firstRun = current.currentJob.key;
      await page.reload(); await prepare(page, fixture, actualContext, true);
      current = await helper.state(page);
      check(current.currentJob.key !== firstRun, name + ': reload creates an independent new session');
      equal(current.session.trials.length, 0, name + ': reload does not duplicate the original 45 trials');
      check(!current.sessionNominalGate.ready && current.qualifiedNominalGate.ready, name + ': official gate survives reload independently of session');
      await enabledConditions(page, true, name + ': complementary conditions stay enabled after reload');
      equal(requests.length, 2, name + ': reload revalidates the same immutable receipt');
      check(requests.every(request => request.url === rawUrl), name + ': reload never falls back to a branch');
      await screenshot(page, 'vision-6c2-qualified-reload-1366x768');
      await page.setViewportSize({ width: 390, height: 844 });
      await screenshot(page, 'vision-6c2-qualified-mobile-390x844');
      await page.setViewportSize({ width: 1366, height: 768 });
      await page.click('#vqStart');
      current = await helper.state(page);
      equal(current.session.active.condition, 'ANGLE', name + ': complementary trial starts without nominal observations');
      const cardId = current.currentJob.card.cardId;
      await helper.setIdentity(page, cardId); await helper.advance(page, 10250);
      await page.click('#vqEnd');
      const sessionExport = await download(page, '#vqExportSession');
      const report = await download(page, '#vqCanonicalReport');
      equal(sessionExport.trials.length, 1, name + ': session export contains only the new complementary observation');
      equal(sessionExport.trials[0].condition, 'ANGLE', name + ': only the actual complementary condition is exported');
      equal(sessionExport.trials[0].provenance, 'automated', name + ': test-generated observation remains explicitly automated');
      equal(report.trials.length, 1, name + ': canonical report does not inject 45 old raw observations');
      equal(report.nominalEvidence.source, 'QUALIFICATION_RECEIPT', name + ': canonical report links official nominal evidence');
      equal(report.nominalEvidence.sourceSession.sha256, official.sourceSession.sha256, name + ': canonical report preserves original physical session provenance');
      equal(report.nominalEvidence.sourcePhysicalProductSha, official.sourcePhysicalProductSha, name + ': report does not claim nominal was replayed on this build');
      check(report.qualifiedNominalGate.ready, name + ': report validates nominal receipt independently');
      check(report.nominalEvidence.noNewPhysicalTrials, name + ': report explicitly disclaims a new physical nominal campaign');
      equal(report.conditions.NOMINAL.physical.valid, 0, name + ': current-build nominal observations remain empty');
      equal(report.conditions.NOMINAL.qualifiedPhysical.valid, 45, name + ': original nominal evidence is a separate physical projection');
      check(report.verdict !== 'QUALIFIED', name + ': nominal receipt alone never completes complementary physical qualification');
    } else {
      check(!current.qualifiedNominalGate.ready && !current.nominalGate.ready, name + ': invalid or absent receipt fails closed');
      if (options.reason) check(current.qualifiedNominalGate.reasons.includes(options.reason), name + ': rejection cause remains explicit');
      await enabledConditions(page, false, name + ': no incompatible complementary campaign can start');
      equal(await page.locator('#vqCondition').inputValue(), 'NOMINAL', name + ': invalid receipt does not move selection to complementary');
      if (options.sessionPass) {
        // TEST ONLY: exercise the established current-session gate route.
        // The pure report remains empty/NOT TESTED; no physical trials or
        // fabricated receipt are generated by this UI state fixture.
        await page.evaluate(() => {
          const real = window.TCGVisionQualificationReport;
          window.TCGVisionQualificationReport = Object.freeze({ ...real,
            nominalGate: report => ({ ...real.nominalGate(report), ready: true }) });
          document.querySelector('#vqCondition').dispatchEvent(new Event('change'));
        });
        current = await helper.state(page);
        check(current.sessionNominalGate.ready, name + ': established session PASS still unlocks the UI');
        check(!current.qualifiedNominalGate.ready, name + ': no official receipt is invented by a session PASS');
        check(current.nominalGate.ready, name + ': logical OR preserves current-session qualification');
        equal(current.nominalGate.source, 'CURRENT_SESSION', name + ': current-session provenance stays distinct');
        await enabledConditions(page, true, name + ': valid session route still enables all complementary conditions');
        equal(current.session.trials.length, 0, name + ': UI gate fixture never invents physical observations');
      }
    }
    equal(errors, [], name + ': no browser exception');
    console.log('WORKSPACE_VISION_NOMINAL_RECEIPT_CASE_OK ' + name);
  } finally { await context.close(); }
}
async function main() {
  const corpus = JSON.parse(fs.readFileSync(path.join(helper.root, 'fixtures/vision-canonical-corpus-229.json'), 'utf8'));
  const receipt = JSON.parse(fs.readFileSync(path.join(helper.root, proof.RECEIPT_FILE), 'utf8'));
  const actualContext = { productSha: helper.sha, databaseSha: corpus.databaseSha, gameId: 'cyberpunk', locale: 'en', referenceCount: 229, references: corpus.references };
  const previous = process.env.RAILWAY_GIT_COMMIT_SHA; process.env.RAILWAY_GIT_COMMIT_SHA = helper.sha;
  const fixture = await startBridgeFixture({ root: helper.root });
  if (previous === undefined) delete process.env.RAILWAY_GIT_COMMIT_SHA; else process.env.RAILWAY_GIT_COMMIT_SHA = previous;
  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
    console.log('WORKSPACE_VISION_NOMINAL_RECEIPT_BROWSER ' + browser.version());
    await scenario(browser, fixture, actualContext, receipt, 'versioned-pass', { ready: true });
    await scenario(browser, fixture, actualContext, receipt, 'receipt-absent', { absent: true, reason: 'RECEIPT_ABSENT' });
    await scenario(browser, fixture, actualContext, receipt, 'wrong-database', { receipt: value => { value.databaseSha = '0'.repeat(40); }, reason: 'CORPUS_CONTEXT_MISMATCH' });
    await scenario(browser, fixture, actualContext, receipt, 'wrong-reference-count', { receipt: value => { value.referenceCount = 228; }, reason: 'CORPUS_CONTEXT_MISMATCH' });
    await scenario(browser, fixture, actualContext, receipt, 'wrong-reference-fingerprint', { receipt: value => { value.referencesSha256 = '0'.repeat(64); }, reason: 'REFERENCES_OR_SAMPLE_MISMATCH' });
    await scenario(browser, fixture, actualContext, receipt, 'incompatible-engine', {
      compatibility: value => { value.files.find(file => file.path === 'public/identification-worker.js').sha256 = '0'.repeat(64); value.fingerprintSha256 = proof.digest(value.files); }, reason: 'ENGINE_INCOMPATIBLE' });
    await scenario(browser, fixture, actualContext, receipt, 'below-correct-threshold', {
      receipt: value => { value.nominalMetrics.correct = value.correct = 42; value.nominalMetrics.correctIdentificationRate = value.correctIdentificationRate = 42 / 45 * 100; }, reason: 'NOMINAL_THRESHOLD_OR_METRICS' });
    await scenario(browser, fixture, actualContext, receipt, 'above-wrong-threshold', {
      receipt: value => { value.nominalMetrics.wrongIdentification = value.wrongIdentification = 1; value.nominalMetrics.wrongIdentificationRate = value.wrongIdentificationRate = 1 / 45 * 100; }, reason: 'NOMINAL_THRESHOLD_OR_METRICS' });
    await scenario(browser, fixture, actualContext, receipt, 'different-deployed-build', { compatibility: value => { value.buildSha = '0'.repeat(40); }, reason: 'DEPLOYED_BUILD_CHANGED' });
    await scenario(browser, fixture, actualContext, receipt, 'receipt-integrity', {
      receipt: value => { value.correct = 44; }, keepOriginalReceiptDigest: true, reason: 'RECEIPT_INTEGRITY_MISMATCH' });
    await scenario(browser, fixture, actualContext, receipt, 'session-pass-without-receipt', { absent: true, sessionPass: true, reason: 'RECEIPT_ABSENT' });
    console.log('WORKSPACE_VISION_NOMINAL_RECEIPT_BROWSER_OK ' + assertions + ' assertions; 11 cases; authentic versioned physical proof reused; no new physical qualification');
  } finally { await browser?.close(); await fixture.close(); }
}
main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
