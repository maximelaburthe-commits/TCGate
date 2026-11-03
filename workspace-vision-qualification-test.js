'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const root = process.env.TCGATE_QUALIFICATION_WORKSPACE_TEST_ROOT || __dirname;
const hPath = process.env.TCGATE_VISION_QUALIFICATION_TEST_MODULE || path.join(root, 'public/vision-qualification-harness.js');
const reportPath = process.env.TCGATE_VISION_QUALIFICATION_REPORT_MODULE || path.join(root, 'public/vision-qualification-report.js');
const runtimePath = process.env.VISION_QUALIFICATION_RUNTIME_PATH || path.join(root, 'public/vision-qualification-runtime.js');
const h = require(hPath), report = require(reportPath);
const sample = JSON.parse(fs.readFileSync(path.join(root, 'VISION_QUALIFICATION_SAMPLE.json'), 'utf8'));
let assertions = 0;
function equal(actual, expected, message) { assertions++; assert.equal(actual, expected, message); }
function same(actual, expected, message) { assertions++; assert.deepEqual(actual, expected, message); }
function check(value, message) { assertions++; assert.ok(value, message); }
function throws(callback, pattern) { assertions++; assert.throws(callback, pattern); }
async function rejects(callback, pattern) { assertions++; await assert.rejects(callback, pattern); }
const copy = value => JSON.parse(JSON.stringify(value));
// Explicit synthetic identities exercise orchestration without downloading or
// altering a database. The browser suite separately loads the real pinned 229.
function syntheticReferences() {
  const printings = new Map();
  const add = (cardId, printingId) => { if (printings.has(printingId)) assert.equal(printings.get(printingId), cardId); printings.set(printingId, cardId); };
  for (const item of sample.sample) { add(item.cardId, item.printingId); for (const alternative of item.substitution.eligibleAlternatives) add(alternative.cardId, alternative.printingId); }
  for (const variant of sample.plan.variantCases) for (const printingId of variant.candidatePrintingIds) add(variant.cardId, printingId);
  for (const pair of sample.plan.similarPairs) pair.printingIds.forEach((printingId, index) => add(pair.cardIds[index], printingId));
  let n = 0;
  while (new Set(printings.values()).size < 150) add('fixture-card-' + n, 'fixture-printing-' + n++);
  while (printings.size < 229) add(sample.sample[0].cardId, 'fixture-extra-printing-' + n++);
  if (printings.size !== 229) throw Error('Synthetic fixture overflow');
  return [...printings].map(([printingId, cardId], index) => ({ refId: 'fixture-ref-' + index, cardId, printingId, referencePrintingId: printingId, candidatePrintingIds: [printingId], recognitionMode: 'exact', locale: 'en' }));
}
const references = syntheticReferences(), productSha = 'a'.repeat(40);
const context = report.canonicalContext(productSha, references);
const options = { productSha, sampleProductSha: productSha, references, sampleDocument: sample };
const selected = sample.sample[0];
const refFor = cardId => references.find(ref => ref.cardId === cardId);
function observation(atMs, cardId = selected.cardId, printingId = null) {
  const ref = cardId ? references.find(value => value.cardId === cardId && (!printingId || value.printingId === printingId)) : null;
  return { atMs, detected: Boolean(ref), identifiedCardId: ref?.cardId || null, identifiedPrintingId: printingId || ref?.printingId || null,
    referenceIds: ref ? [ref.refId] : [], candidateIds: ref ? [ref.refId] : [], candidatePrintingIds: ref ? [...ref.candidatePrintingIds] : [], locale: 'en' };
}
function trial(extra = {}) {
  return { trialId: 'fixture-trial-1', timestamp: '2026-11-03T10:00:00.000Z', provenance: 'automated', captureMethod: 'automated-runtime-events',
    condition: 'NOMINAL', expectedCardId: selected.cardId, expectedPrintingId: selected.printingId, t0Ms: 0, endMs: 1500,
    observations: [0, 500, 1000, 1500].map(time => observation(time, selected.cardId, selected.printingId)), notes: ['MANUAL_T0'], ...extra };
}
function session(extra = {}) { return { context, plan: { sample: sample.sample.map(item => ({ cardId: item.cardId, printingId: item.printingId })), substitutions: [], variantAvailability: [] },
  trials: [], scenes: [], indexMeasurements: [], environment: { execution: 'AUTOMATED' }, ...extra }; }
async function main() {
  check(h.validateContext(context).valid);
  equal(report.canonicalPlan(sample, context).sample.length, 15);
  const empty = report.generate(options);
  equal(empty.physicalQualification, 'NOT TESTED'); equal(empty.verdict, 'NOT YET QUALIFIED');
  equal(empty.actualSample.length, 15); equal(empty.plan.nominalRepetitions, 3);
  check(empty.plan.missing.includes('NOMINAL_THREE_TRIALS:' + selected.cardId));
  const snapshot = copy(options); report.generate(options); same(options, snapshot, 'Pure generator never mutates callers');
  for (const mutation of [{ productSha: '' }, { productSha: 'b'.repeat(40) }, { sampleProductSha: 'b'.repeat(40) }, { sampleProductSha: undefined },
    { references: references.slice(1) }, { references: references.map((ref, index) => index ? ref : { ...ref, locale: 'fr' }) }]) throws(() => report.generate({ ...options, ...mutation }));
  for (const field of ['databaseSha', 'locale', 'gameId', 'referenceCount', 'sampleCount', 'canonicalCardCount']) {
    const altered = copy(sample); altered[field] = field.endsWith('Count') ? 1 : 'wrong';
    throws(() => report.generate({ ...options, sampleDocument: altered }));
  }
  const altered = copy(sample); altered.plan.matrix.find(row => row.condition === 'NOMINAL').repetitions = 1;
  throws(() => report.generate({ ...options, sampleDocument: altered }), /45 trials/);
  const badRef = copy(references); badRef[0].cardId = 'replaced-canonical-card';
  throws(() => report.generate({ ...options, sessions: [session({ context: { ...context, references: badRef } })] }), /exact product\/corpus/);
  for (const mutation of [{ productSha: 'b'.repeat(40) }, { databaseSha: 'b'.repeat(40) }, { locale: 'fr' }, { gameId: 'swu' }, { referenceCount: 228 }])
    throws(() => report.generate({ ...options, sessions: [session({ context: { ...context, ...mutation } })] }));
  const fakePhysical = trial({ provenance: 'physical', captureMethod: 'runtime-manual', physicalConfirmation: 'REAL_CARDS_OPERATOR_CONFIRMED' });
  throws(() => report.generate({ ...options, sessions: [session({ trials: [fakePhysical] })] }), /automated/);
  const bad = trial({ observations: [0, 500, 1000, 1500].map(time => observation(time, sample.sample[1].cardId, sample.sample[1].printingId)) });
  const badSession = session({ trials: [bad] });
  const badReport = report.generate({ ...options, sessions: [badSession] });
  equal(badReport.trials[0].category, 'WRONG_IDENTIFICATION'); equal(badReport.metrics.automated.wrongIdentification, 1);
  const retry = trial({ trialId: 'fixture-trial-2' });
  const retryReport = report.generate({ ...options, sessions: [session({ trials: [bad, retry] })] });
  equal(retryReport.trials.length, 2); equal(retryReport.metrics.automated.wrongIdentification, 1); equal(retryReport.metrics.automated.correct, 1);
  const annotation = { trialId: bad.trialId, action: 'INVALIDATE', reason: 'OPERATOR_PROTOCOL_ERROR', sequence: 1 };
  const markedSession = session({ trials: [bad, retry], trialAnnotations: [annotation] });
  const marked = report.generate({ ...options, sessions: [markedSession] });
  equal(marked.trials[0].category, 'INVALID_TEST'); equal(marked.trials[0].originalOutcome.category, 'WRONG_IDENTIFICATION');
  same(marked.trials[0].observations, badReport.trials[0].observations, 'Invalidation retains original sanitized observations');
  equal(marked.trials[0].originalOutcome.wrongCardEvents, 4); equal(marked.trials.length, 2); equal(marked.metrics.automated.invalid, 1);
  same(markedSession.trials[0], bad, 'Annotation cannot modify a raw observation');
  for (const invalid of [{ ...annotation, reason: 'raw secret' }, { ...annotation, trialId: 'unknown' }, { ...annotation, action: 'DELETE' }, { ...annotation, sequence: 0 }])
    throws(() => report.generate({ ...options, sessions: [session({ trials: [bad], trialAnnotations: [invalid] })] }));
  throws(() => report.generate({ ...options, sessions: [session({ trials: [bad], trialAnnotations: [annotation, annotation] })] }));
  const alternative = selected.substitution.eligibleAlternatives.find(value => !sample.sample.some(item => item.cardId === value.cardId));
  check(alternative, 'Frozen sample offers a valid distinct alternative');
  const substitution = { originalCardId: selected.cardId, originalPrintingId: selected.printingId, replacementCardId: alternative.cardId,
    replacementPrintingId: alternative.printingId, reason: 'PHYSICAL_CARD_UNAVAILABLE' };
  const substituted = session(); substituted.plan.substitutions = [substitution];
  const subReport = report.generate({ ...options, sessions: [substituted] });
  same(subReport.substitutions, [substitution]); equal(subReport.actualSample[0].cardId, alternative.cardId);
  for (const mutation of [{ replacementPrintingId: 'unknown' }, { originalPrintingId: 'wrong' }, { reason: 'free text' }, { replacementCardId: sample.sample[1].cardId, replacementPrintingId: sample.sample[1].printingId }]) {
    const input = copy(substituted); input.plan.substitutions[0] = { ...substitution, ...mutation };
    throws(() => report.generate({ ...options, sessions: [input] }));
  }
  throws(() => report.generate({ ...options, sessions: [substituted, session()] }), /conflicting/);
  const alreadyTested = copy(substituted); alreadyTested.trials = [trial()];
  throws(() => report.generate({ ...options, sessions: [alreadyTested] }), /previously tested/);
  const skip = session(); skip.plan.sleeveAvailability = 'UNAVAILABLE'; skip.plan.sleeveSkipReason = 'NO_GAME_SLEEVE_AVAILABLE';
  equal(report.generate({ ...options, sessions: [skip] }).plan.sleeveGlare, 'NOT TESTED — NO_GAME_SLEEVE_AVAILABLE');
  skip.trials.push(trial({ condition: 'SLEEVE_GLARE' })); throws(() => report.generate({ ...options, sessions: [skip] }), /conflict/);
  const index = { context: { ...context, references: undefined }, indexMeasurements: [{ measurementId: 'index-' + '0'.repeat(64), kind: 'COLD', durationMs: 100, referenceCount: 229, provenance: 'AUTOMATED_BROWSER' }] };
  equal(report.generate({ ...options, indexInputs: [index] }).indexPerformance.cold.count, 1);
  for (const mutation of [{ productSha: 'b'.repeat(40) }, { databaseSha: 'b'.repeat(40) }, { locale: 'fr' }, { referenceCount: 228 }])
    throws(() => report.generate({ ...options, indexInputs: [{ ...index, context: { ...index.context, ...mutation } }] }));
  const secret = 'PRIVATE_MEDIA_OR_DEVICE_TOKEN';
  const privacy = session({ trials: [{ ...trial(), video: secret, notes: [secret, 'MANUAL_T0'], observations: trial().observations.map(value => ({ ...value, screenshot: secret, sdp: secret, deviceId: secret })) }], environment: { execution: 'AUTOMATED', deviceId: secret, sdp: secret }, media: secret });
  const privateJson = report.stableStringify(report.generate({ ...options, sessions: [privacy] }));
  check(!privateJson.includes(secret)); equal(JSON.parse(privateJson).privacy.mediaRecorded, false);
  const diagnosticPath = path.join(root, 'public/vision-qualification-diagnostics.js');
  const diagnosticRef = refFor(selected.cardId);
  const diagnosticRaw = trial({ neutralBoundary: { requiredMs: 750, confirmedForMs: 1000, deviceId: secret }, attemptDiagnostics: [{
    attemptId: 1, atMs: 1000, requestStartedAtMs: 500, trackUid: 100, expectedCardId: secret,
    candidates: [{ rank: 1, cardId: diagnosticRef.cardId, printingId: diagnosticRef.printingId, refId: diagnosticRef.refId, matcherScore: .78, imageUrl: secret }],
    bestScore: .78, secondScore: .64, margin: .14, matcherAccepted: true, finalAccepted: true,
    rejectionReason: null, mode: 'normal', quality: { risk: 'normal', clippedFraction: .01, image: secret },
    temporal: { action: 'render', stableCardId: selected.cardId, pendingCount: 0 }, video: secret, deviceId: secret
  }] });
  diagnosticRaw.observations[1].runtimeState = { pointerInsideStage: true, hoveredTrackUid: 42,
    activeTrackUids: [42], activeTrackCount: 1, matcherBusy: false, matcherQueued: false,
    temporalEventType: 'stable-established', visibleSource: 'VISIBLE', image: secret, pointer: { x: secret }, deviceId: secret };
  const diagnosticSession = session({ trials: [diagnosticRaw] });
  const diagnosticBytes = JSON.stringify(diagnosticSession);
  const diagnosticReport = report.generate({ ...options, sessions: [diagnosticSession] });
  equal(diagnosticReport.trials[0].identificationDiagnostics.recorded, 1);
  equal(diagnosticReport.trials[0].identificationDiagnostics.states.length, 1);
  same(diagnosticReport.trials[0].identificationDiagnostics.states[0], { atMs: diagnosticRaw.observations[1].atMs,
    pointerInsideStage: true, hoveredTrackUid: 42, activeTrackUids: [42], activeTrackCount: 1,
    matcherBusy: false, matcherQueued: false, temporalEventType: 'stable-established', visibleSource: 'VISIBLE' });
  equal(diagnosticReport.trials[0].identificationDiagnostics.attempts[0].expectedCardId, selected.cardId);
  equal(diagnosticReport.trials[0].identificationDiagnostics.attempts[0].expectedScore, .78);
  same(diagnosticReport.trials[0].neutralBoundary, { requiredMs: 750, confirmedForMs: 1000 });
  equal(diagnosticReport.trials[0].category, 'CORRECT', 'Diagnostics never change the original classifier');
  equal(diagnosticReport.physicalQualification, 'NOT TESTED');
  check(!report.stableStringify(diagnosticReport).includes(secret), 'Canonical report cannot export diagnostic media or device data');
  equal(JSON.stringify(diagnosticSession), diagnosticBytes, 'Reporting never rewrites the source session');
  const staleDiagnostic = copy(diagnosticRaw); staleDiagnostic.attemptDiagnostics[0].requestStartedAtMs = -1;
  const staleReport = report.generate({ ...options, sessions: [session({ trials: [staleDiagnostic] })] });
  equal(staleReport.trials[0].identificationDiagnostics.recorded, 0);
  equal(staleReport.trials[0].identificationDiagnostics.rejected, 1, 'A stale or invalid request is excluded from the next trial diagnostics');
  const browser = { window: {} }; vm.createContext(browser);
  vm.runInContext(fs.readFileSync(hPath, 'utf8'), browser);
  vm.runInContext(fs.readFileSync(diagnosticPath, 'utf8'), browser);
  browser.window.TCGVisionQualificationDiagnostics = browser.TCGVisionQualificationDiagnostics;
  vm.runInContext(fs.readFileSync(reportPath, 'utf8'), browser);
  browser.input = copy({ ...options, sessions: [markedSession] });
  const browserJson = vm.runInContext('window.TCGVisionQualificationReport.stableStringify(window.TCGVisionQualificationReport.generate(input))', browser);
  equal(browserJson, report.stableStringify(marked), 'Browser and Node invoke one pure generator with byte-identical output');
  browser.input = copy({ ...options, sessions: [diagnosticSession] });
  equal(vm.runInContext('window.TCGVisionQualificationReport.stableStringify(window.TCGVisionQualificationReport.generate(input))', browser),
    report.stableStringify(diagnosticReport), 'Diagnostic reports remain byte identical between browser and Node');
  await runtimeContract();
  console.log('WORKSPACE_VISION_QUALIFICATION_ASSERTIONS ' + assertions);
  console.log('WORKSPACE_VISION_QUALIFICATION_TEST PASS');
}
async function runtimeContract() {
  let clock = 0;
  const state = { gameId: 'cyberpunk', playerLocale: 'en', libraryReady: true, matcherWorker: { ready: true }, visionReferenceCount: 229, librarySize: 229,
    visionLocales: ['en'], libraryIntegrity: { degraded: false }, visionIndexKey: 'synthetic-index', identification: { accepted: false, candidates: [] } };
  const events = new Map(), intervals = new Set(), downloads = [];
  const window = { TCGateVisionQualification: h, TCGVisionQualificationReport: report,
    TCGIdentificationLab: { getSnapshot: () => copy(state) }, TCGVisionEngine: { getSnapshot: () => ({ active: true, modelReady: true, activeCards: 0 }) },
    TCGTableStateBridge: { getRefs: () => references.map(ref => ({ ...ref, image: ref.refId })) },
    TCGateDatabaseSource: { getVisionReferences: async () => copy(references) },
    TCGateGameDatabases: { get: () => ({ manifestUrl: 'https://raw.githubusercontent.com/maximelaburthe-commits/tcgate_db_cyberpunk/' + h.DATABASE_SHA + '/manifest.json' }) },
    performance: { now: () => clock, timeOrigin: 123 }, crypto: crypto.webcrypto,
    addEventListener: (name, handler) => events.set(name, handler), removeEventListener: name => events.delete(name),
    setInterval: callback => { intervals.add(callback); return callback; }, clearInterval: callback => intervals.delete(callback),
    queueMicrotask: callback => callback(), setTimeout: callback => callback(), Blob,
    URL: { createObjectURL: () => 'blob:synthetic-test', revokeObjectURL: () => {} },
    document: { createElement: () => ({ click() { downloads.push(this.download); } }) } };
  const sandbox = { window, console, TextEncoder }; vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(runtimePath, 'utf8'), sandbox);
  const runtime = window.TCGVisionQualificationRuntime;
  const q = await runtime.attach({ productSha, sampleDocument: sample, environment: { execution: 'AUTOMATED', deviceId: 'private-runtime-secret' } });
  equal(events.size, 10); equal(intervals.size, 1);
  await rejects(() => runtime.attach({ productSha, sampleDocument: sample }), /already attached/);
  let p = q.getProgress(); equal(p.active, null); equal(p.trials.length, 0); equal(p.plan.sample.length, 15);
  p.plan.sample[0].cardId = 'mutated'; equal(q.getProgress().plan.sample[0].cardId, selected.cardId);
  for (let n = 0; n < 3; n++) { clock += 250; for (const callback of intervals) callback(); }
  q.startTrial({ trialId: 'runtime-first', mode: 'automated', expectedCardId: selected.cardId, expectedPrintingId: selected.printingId });
  equal(q.getProgress().active.trialId, 'runtime-first'); throws(() => q.getSession(), /active/);
  const live = q.getActiveObservation(); equal(live.trialId, 'runtime-first');
  check(!('context' in live) && !('trials' in live), 'Live polling omits the immutable corpus and completed history');
  live.trialId = 'mutated'; equal(q.getActiveObservation().trialId, 'runtime-first', 'Live observation is an isolated copy');
  throws(() => q.setSubstitution(selected.cardId, alternativeFor(selected).cardId, alternativeFor(selected).printingId), /before either/);
  clock = 1200; q.sample(); clock = 1500; q.endTrial();
  equal(q.getSession().trials.length, 1); equal(q.exportReport().trials[0].category, 'NO_DETECTION');
  const second = sample.sample[1], alternative = alternativeFor(second);
  const substituted = q.setSubstitution(second.cardId, alternative.cardId, alternative.printingId);
  equal(substituted.originalPrintingId, second.printingId); equal(q.getSession().plan.substitutions.length, 1);
  throws(() => q.setSubstitution(second.cardId, alternative.cardId, alternative.printingId), /already/);
  throws(() => q.setSubstitution(selected.cardId, alternativeFor(selected).cardId, alternativeFor(selected).printingId), /before either/);
  throws(() => q.startTrial({ mode: 'automated', expectedCardId: second.cardId, expectedPrintingId: second.printingId }), /declared substitute/);
  const original = copy(q.getSession().trials[0]);
  q.invalidateTrial('runtime-first', 'OPERATOR_PROTOCOL_ERROR');
  same(copy(q.getSession().trials[0]), original); equal(q.getSession().trialAnnotations.length, 1);
  equal(q.exportReport().trials[0].category, 'INVALID_TEST'); equal(q.exportReport().trials[0].originalOutcome.category, 'NO_DETECTION');
  throws(() => q.invalidateTrial('runtime-first'), /already/); throws(() => q.invalidateTrial('unknown'), /completed/);
  q.setSleeveAvailability('UNAVAILABLE'); equal(q.getProgress().plan.sleeveSkipReason, 'NO_GAME_SLEEVE_AVAILABLE');
  throws(() => q.startTrial({ mode: 'automated', condition: 'SLEEVE_GLARE', expectedCardId: selected.cardId, expectedPrintingId: selected.printingId }), /unavailable/);
  const nominalVariant = sample.plan.variantCases.find(value => value.cardId === selected.cardId);
  q.setVariantAvailability(nominalVariant.caseId, selected.printingId, 'AVAILABLE');
  equal(q.getSession().plan.variantAvailability[0].availability, 'AVAILABLE', 'A nominal printing can honestly be declared available before variant trials');
  const variant = sample.plan.variantCases.find(value => value.cardId !== selected.cardId && value.cardId !== second.cardId);
  q.setVariantAvailability(variant.caseId, variant.candidatePrintingIds[0], 'UNAVAILABLE');
  equal(q.getSession().plan.variantAvailability.length, 2);
  throws(() => q.startTrial({ mode: 'automated', expectedCardId: variant.cardId, expectedPrintingId: variant.candidatePrintingIds[0] }), /unavailable/);
  q.saveSession(); q.downloadReport(); q.downloadReport('vision-qualification-reading.json');
  same(downloads, ['vision-qualification-session.json', 'vision-qualification-1.0.json', 'vision-qualification-reading.json']);
  throws(() => q.downloadReport('private-filename.json'), /controlled/);
  check(!JSON.stringify(q.getSession()).includes('private-runtime-secret'));
  q.detach(); equal(events.size, 0); equal(intervals.size, 0); throws(() => q.getProgress(), /detached/);
  const reopened = await runtime.attach({ productSha, sampleDocument: sample, environment: { execution: 'AUTOMATED' } });
  equal(reopened.getSession().trials.length, 0); reopened.detach();
  // An attach failure releases its reservation instead of permanently blocking
  // the UI. None of these fixtures is physical camera qualification.
  await rejects(() => runtime.attach({ productSha: '' }), /exact tested/);
  const afterFailure = await runtime.attach({ productSha, sampleDocument: sample }); afterFailure.detach();
  // Simulate the existing local webcam contract (externalAttached is false).
  // These are unit fixtures, never physical qualification evidence.
  const track = { readyState: 'live' };
  window.TCGVisionEngine.getSnapshot = () => ({ active: false, modelReady: true, activeCards: 0 });
  window.TCGDetectionLab = { state: { detecting: true, stream: { getVideoTracks: () => [track] } } };
  const local = await runtime.attach({ productSha, sampleDocument: sample, environment: { execution: 'RAILWAY_TEST' } });
  for (let n = 0; n < 3; n++) { clock += 250; for (const callback of intervals) callback(); }
  local.startTrial({ trialId: 'local-camera-contract', mode: 'physical', physicalConfirmation: runtime.physicalConfirmation, expectedCardId: selected.cardId, expectedPrintingId: selected.printingId });
  equal(local.getProgress().active.observations[0].validityErrors.length, 0, 'Live local webcam is accepted without an external attachment');
  track.readyState = 'ended'; clock += 500; local.sample(); clock += 500; local.endTrial();
  check(local.getSession().trials[0].observations.at(-1).validityErrors.includes('MISSING_RUNTIME_STATE'), 'A stopped local webcam invalidates the observation');
  equal(local.exportReport().trials[0].category, 'INVALID_TEST');
  throws(() => local.startTrial({ mode: 'physical', physicalConfirmation: runtime.physicalConfirmation, expectedCardId: selected.cardId, expectedPrintingId: selected.printingId }), /camera-fed/);
  local.detach();
}
function alternativeFor(item) {
  return item.substitution.eligibleAlternatives.find(value => !sample.sample.some(selected => selected.cardId === value.cardId));
}
main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
