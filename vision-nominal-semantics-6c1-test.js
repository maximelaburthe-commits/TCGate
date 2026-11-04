'use strict';
// Entirely synthetic scalar unit vectors. This file records no media, creates no
// qualification export and supplies no new physical evidence. The authentic
// ce5be2a physical session is replayed separately by the delivery verification.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = process.env.TCGATE_6C1_TEST_ROOT || __dirname;
const BASELINE_SHA = 'ce5be2ad9aeaa27df4c217dec99df7f6c7e47c94';
const h = require(path.join(root, 'public/vision-qualification-harness.js'));
const reportApi = require(path.join(root, 'public/vision-qualification-report.js'));
const corpusFile = path.join(root, 'fixtures/vision-canonical-corpus-229.json');
const corpusBytes = fs.readFileSync(corpusFile);
const refs = JSON.parse(corpusBytes).references;
const sampleDocument = JSON.parse(fs.readFileSync(path.join(root, 'VISION_QUALIFICATION_SAMPLE.json'), 'utf8'));
const copy = value => JSON.parse(JSON.stringify(value));
let assertions = 0;
const equal = (actual, expected, why) => { assertions++; assert.deepEqual(copy(actual), copy(expected), why); };
const check = (value, why) => { assertions++; assert.ok(value, why); };
const throws = (callback, pattern, why) => { assertions++; assert.throws(callback, pattern, why); };
const baselineSource = execFileSync('git', ['-C', root, 'show', BASELINE_SHA + ':public/vision-qualification-harness.js'], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
const baselineSandbox = { module: { exports: {} } };
vm.createContext(baselineSandbox);
vm.runInContext(baselineSource, baselineSandbox, { filename: 'ce5be2a-vision-qualification-harness.js' });
const baseline = baselineSandbox.module.exports;
const context = reportApi.canonicalContext(BASELINE_SHA, refs);
const plan = reportApi.canonicalPlan(sampleDocument, context);
const exact = refs.find(ref => ref.printingId);
const other = refs.find(ref => ref.cardId !== exact.cardId && ref.printingId);
const shared = refs.find(ref => ref.printingId === null && ref.candidatePrintingIds.length > 1);
check(exact && other && shared, 'Authentic immutable corpus supplies exact, other-card and shared-art cases');
equal(refs.length, 229);
equal(new Set(refs.map(ref => ref.cardId)).size, 150);
equal(h.validateContext(context), { valid: true, errors: [] });

// Actual accepted identity is an explicit argument, independent of expectedCardId.
function obs(atMs, actualRef = exact, extra = {}) {
  const accepted = Boolean(actualRef);
  return {
    atMs, locale: 'en', detected: accepted,
    identifiedCardId: actualRef?.cardId || null,
    identifiedPrintingId: actualRef?.printingId || null,
    referenceIds: actualRef ? [actualRef.refId] : [],
    candidateIds: actualRef ? [actualRef.refId] : [],
    candidatePrintingIds: actualRef ? [...actualRef.candidatePrintingIds] : [],
    ...(actualRef ? { recognitionMode: actualRef.recognitionMode } : {}),
    qualificationTracking: { mode: 'PINNED_CANONICAL_TRACK', status: accepted ? 'TRACKING' : 'TRACK_LOST',
      lockedTrackUid: 73, trackPresent: accepted, observedTrackCount: accepted ? 1 : 0,
      accepted, decisionAtMs: accepted ? atMs : null, errors: [] },
    ...extra
  };
}
function makeTrial(observations, extra = {}) {
  return { trialId: 'synthetic-6c1-trial', timestamp: '2026-11-04T10:00:00.000Z', provenance: 'automated',
    condition: 'NOMINAL', expectedCardId: exact.cardId, expectedPrintingId: exact.referencePrintingId,
    identityMeasurement: 'PINNED_CANONICAL_TRACK', t0Ms: 0, endMs: observations.at(-1).atMs,
    observations: copy(observations), ...extra };
}
function stableObservations(actualRef = exact) {
  return [0, 250, 500, 750, 1000, 1250].map(atMs => obs(atMs, actualRef));
}
const stableThenRemoved = [...stableObservations(), obs(1500, null), obs(1750, null), obs(2000, null), obs(2250, null)];
const nominalInput = makeTrial(stableThenRemoved);
const nominalBytes = JSON.stringify(nominalInput);
const before = baseline.classifyTrial(nominalInput, context);
const after = h.classifyTrial(nominalInput, context);
equal(before.category, 'UNSTABLE', 'Baseline reproduces the nominal post-T2 removal defect');
equal(before.stableConfirmedAtMs, 1000);
equal(after.category, 'CORRECT', 'NOMINAL retains its confirmed canonical success after physical withdrawal');
equal(after.correct, true);
equal(after.stableConfirmedAtMs, 1000);
equal(after.disappearances, 1, 'Observed disappearance remains in the report');
equal(after.wrongCardEvents, 0);
equal(after.wrongPrintingEvents, 0);
equal(after.identificationLatency, before.identificationLatency);
equal(after.detectionLatency, before.detectionLatency);
const beforeFields = copy(before), afterFields = copy(after);
for (const object of [beforeFields, afterFields]) { delete object.category; delete object.correct; }
equal(afterFields, beforeFields, 'Only category and correct change, not observations, counters, latencies or evidence');
equal(JSON.stringify(nominalInput), nominalBytes, 'Classifier never mutates the captured trial');

const lateWrong = makeTrial([...stableObservations(), obs(1500, other)]);
const wrongAfterT2 = h.classifyTrial(lateWrong, context);
equal(wrongAfterT2.stableConfirmedAtMs, 1000);
equal(wrongAfterT2.category, 'WRONG_IDENTIFICATION', 'A wrong accepted card after T2 vetoes nominal success');
equal(wrongAfterT2.wrongCardEvents, 1);
equal(wrongAfterT2.correct, false);
const wrongThenRemoved = makeTrial([...stableObservations(), obs(1500, other), obs(1750, null), obs(2000, null)]);
check(h.classifyTrial(wrongThenRemoved, context).category !== 'CORRECT', 'Subsequent loss cannot hide an accepted wrong card');
equal(h.classifyTrial(wrongThenRemoved, context).wrongCardEvents, 1);

const requestedPrinting = shared.candidatePrintingIds[0], definiteOtherPrinting = shared.candidatePrintingIds[1];
const knownExactObs = atMs => obs(atMs, shared, { identifiedPrintingId: requestedPrinting });
const wrongPrintingInput = makeTrial([0, 250, 500, 750, 1000, 1250].map(knownExactObs).concat(
  obs(1500, shared, { identifiedPrintingId: definiteOtherPrinting })),
  { expectedCardId: shared.cardId, expectedPrintingId: requestedPrinting });
const wrongPrinting = h.classifyTrial(wrongPrintingInput, context);
equal(wrongPrinting.stableConfirmedAtMs, 1000);
equal(wrongPrinting.wrongCardEvents, 0);
equal(wrongPrinting.wrongPrintingEvents, 1);
equal(wrongPrinting.category, 'WRONG_IDENTIFICATION', 'A definite wrong printing after T2 vetoes nominal success');
equal(wrongPrinting.printingAssessment, 'WRONG_PRINTING');

const removedTooSoon = makeTrial([0, 250, 500, 750].map(atMs => obs(atMs)).concat(
  [1000, 1250, 1500, 1750].map(atMs => obs(atMs, null))), { stableConfirmedAtMs: 1 });
const tooSoon = h.classifyTrial(removedTooSoon, context);
equal(tooSoon.stableConfirmedAtMs, null, 'T2 is computed from observations, never trusted from imported fields');
equal(tooSoon.category, 'NOT_IDENTIFIED', 'Withdrawal before the full 1000 ms window cannot pass');
equal(tooSoon.correct, false);
const acceptedOnlyInShortlist = makeTrial([0, 250, 500, 750, 1000, 1250].map(atMs => obs(atMs, null,
  { detected: true, candidateIds: [exact.refId], candidatePrintingIds: [...exact.candidatePrintingIds],
    qualificationTracking: { mode: 'PINNED_CANONICAL_TRACK', status: 'TRACKING', lockedTrackUid: 73,
      trackPresent: true, observedTrackCount: 1, accepted: false, decisionAtMs: null, errors: [] } })));
const shortlist = h.classifyTrial(acceptedOnlyInShortlist, context);
equal(shortlist.category, 'NOT_IDENTIFIED', 'Expected card in a shortlist is not an accepted identity');
equal(shortlist.stableConfirmedAtMs, null);

const sharedAfterLoss = h.classifyTrial(makeTrial(stableObservations(shared).concat(obs(1500, null), obs(1750, null)),
  { expectedCardId: shared.cardId, expectedPrintingId: requestedPrinting }), context);
equal(sharedAfterLoss.category, 'CORRECT');
equal(sharedAfterLoss.identifiedPrintingId, null, 'Nominal success never invents an exact printing');
equal(sharedAfterLoss.printingAssessment, 'UNRESOLVED_SHARED_ART');
equal(sharedAfterLoss.wrongPrintingEvents, 0);

const invalidAfterStable = makeTrial(stableThenRemoved, { validityErrors: ['INTERRUPTED'] });
equal(h.classifyTrial(invalidAfterStable, context).category, 'INVALID_TEST', 'Validity remains above confirmed nominal success');
const badTrace = copy(nominalInput);
badTrace.observations.at(-1).qualificationTracking.errors = ['TRACKING_ERROR'];
equal(h.classifyTrial(badTrace, context).category, 'INVALID_TEST', 'A later runtime error still invalidates the trial');
const changedUid = copy(nominalInput);
changedUid.observations.at(-1).qualificationTracking.lockedTrackUid = 74;
equal(h.classifyTrial(changedUid, context).category, 'INVALID_TEST', 'Nominal success cannot hide track replacement');
const incorrectExpected = makeTrial(stableThenRemoved, { expectedCardId: other.cardId, expectedPrintingId: other.referencePrintingId });
const wrongExpected = h.classifyTrial(incorrectExpected, context);
check(wrongExpected.category !== 'CORRECT', 'Changing the expected identity never relabels actual native decisions');
check(wrongExpected.wrongCardEvents > 0);
equal(wrongExpected.stableConfirmedAtMs, null);

const scenarios = [nominalInput, lateWrong, wrongThenRemoved, wrongPrintingInput, removedTooSoon, acceptedOnlyInShortlist,
  invalidAfterStable, badTrace, changedUid, incorrectExpected,
  makeTrial(stableObservations()),
  makeTrial(stableObservations().concat(obs(1500, null), obs(1750), obs(2000, null), obs(2250))),
  makeTrial(stableThenRemoved, { removal: { t0Ms: 1500 } })];
let nonNominalComparisons = 0;
for (const condition of h.CONDITIONS.filter(value => value !== 'NOMINAL')) {
  for (const scenario of scenarios) {
    const input = { ...copy(scenario), condition };
    equal(h.classifyTrial(input, context), baseline.classifyTrial(input, context), condition + ': whole classified trial matches ce5be2a');
    const reportInput = { context, plan, environment: { execution: 'AUTOMATED' }, trials: [input] };
    equal(h.buildReport(reportInput), baseline.buildReport(reportInput), condition + ': whole report matches ce5be2a');
    nonNominalComparisons++;
  }
}
equal(nonNominalComparisons, 117);
equal(h.classifyTrial({ ...copy(nominalInput), condition: 'STABILITY' }, context).category, 'UNSTABLE', 'STABILITY still measures loss after T2');
equal(h.classifyTrial({ ...copy(nominalInput), condition: 'REMOVAL' }, context).category, 'UNSTABLE', 'Unmarked REMOVAL loss remains evaluated as before');
equal(h.classifyTrial({ ...copy(nominalInput), condition: 'RAPID_SWITCH' }, context).category, 'UNSTABLE', 'RAPID_SWITCH is never given nominal success semantics');

// Canonical shared reporting on 45 AUTOMATED observations is a test of the pure
// orchestration. These vectors never become physical evidence or open its gate.
const sampleRef = item => refs.find(ref => ref.cardId === item.cardId &&
  (ref.referencePrintingId === item.printingId || ref.candidatePrintingIds.includes(item.printingId)));
const syntheticTrials = [];
let deliberateMisses = 0, withdrawals = 0;
for (const item of plan.sample) {
  const actualRef = sampleRef(item);
  check(actualRef, 'Every synthetic vector refers to an authentic known corpus card');
  for (let repetition = 0; repetition < 3; repetition++) {
    const miss = item.cardId === 'cp-alt-cunningham-soulkiller-architect' && repetition < 2;
    let observations;
    if (miss) {
      deliberateMisses++;
      observations = [0, 250, 500, 750, 1000, 1250].map(atMs => obs(atMs, null,
        { detected: true, qualificationTracking: { mode: 'PINNED_CANONICAL_TRACK', status: 'TRACKING', lockedTrackUid: 73,
          trackPresent: true, observedTrackCount: 1, accepted: false, decisionAtMs: null, errors: [] } }));
    } else {
      observations = stableObservations(actualRef);
      if (withdrawals < 2) { observations.push(obs(1500, null), obs(1750, null)); withdrawals++; }
    }
    syntheticTrials.push(makeTrial(observations, { trialId: 'automated-6c1-' + item.sampleId + '-' + repetition,
      expectedCardId: item.cardId, expectedPrintingId: item.printingId }));
  }
}
equal(deliberateMisses, 2);
equal(withdrawals, 2);
equal(syntheticTrials.length, 45);
const session = { context, plan, environment: { execution: 'AUTOMATED' }, trials: syntheticTrials, scenes: [], indexMeasurements: [] };
const sessionBytes = JSON.stringify(session);
const generated = reportApi.generate({ productSha: BASELINE_SHA, sampleProductSha: BASELINE_SHA, references: refs, sampleDocument, sessions: [session] });
equal(generated.metrics.automated.valid, 45);
equal(generated.metrics.automated.categories.CORRECT, 43);
equal(generated.metrics.automated.categories.NOT_IDENTIFIED, 2);
equal(generated.metrics.automated.categories.UNSTABLE, 0);
equal(generated.metrics.automated.wrongIdentification, 0);
equal(generated.metrics.automated.correctIdentificationRate, 43 / 45 * 100);
equal(generated.trials.filter(trial => trial.category === 'NOT_IDENTIFIED').map(trial => trial.expectedCardId),
  ['cp-alt-cunningham-soulkiller-architect', 'cp-alt-cunningham-soulkiller-architect']);
equal(generated.metrics.physical.valid, 0, 'Automatic vectors never contribute physical metrics');
equal(generated.gates.nominalCorrectIdentification.status, 'NOT TESTED');
equal(generated.gates.nominalWrongIdentification.status, 'NOT TESTED');
equal(generated.nominalQualification.ready, false);
equal(generated.nominalQualification.status, 'PENDING');
equal(generated.verdict, 'NOT YET QUALIFIED', 'Nominal reporting does not certify the full campaign');
equal(JSON.stringify(session), sessionBytes, 'Shared canonical reporting preserves all input session bytes');
equal(reportApi.generate({ productSha: BASELINE_SHA, sampleProductSha: BASELINE_SHA, references: refs, sampleDocument, sessions: [session] }), generated,
  'Identical inputs replay deterministically');
const mislabeled = copy(session);
mislabeled.trials.forEach(trial => { trial.provenance = 'physical'; trial.physicalConfirmation = 'REAL_CARDS_OPERATOR_CONFIRMED'; trial.captureMethod = 'runtime-manual'; });
throws(() => reportApi.generate({ productSha: BASELINE_SHA, sampleProductSha: BASELINE_SHA, references: refs, sampleDocument, sessions: [mislabeled] }),
  /automated session cannot supply physical evidence/i, 'Synthetic vectors cannot be relabeled as physical evidence');

// Abstract pure-function gate inputs below test its arithmetic and coverage only.
// They are not sessions, are never exported and make no physical campaign claim.
const gateVector = copy(generated);
gateVector.conditions.NOMINAL.physical = copy(generated.metrics.automated);
gateVector.trials = gateVector.trials.map(trial => ({ ...trial, provenance: 'physical', evidence: 'OPERATOR_DECLARED_REAL_CARDS' }));
let gate = reportApi.nominalGate(gateVector);
equal(gate.ready, true, 'Pure nominal gate accepts 43/45 and zero wrong with complete declared coverage');
equal(gate.correctIdentificationRate, 43 / 45 * 100);
equal(gate.wrongIdentificationRate, 0);
equal(gate.completedCards, 15);
equal(gate.fullQualificationVerdict, 'NOT YET QUALIFIED');
const belowThreshold = copy(gateVector);
belowThreshold.conditions.NOMINAL.physical.correct = 42;
belowThreshold.conditions.NOMINAL.physical.correctIdentificationRate = 42 / 45 * 100;
equal(reportApi.nominalGate(belowThreshold).ready, false, '42/45 does not pass the unchanged 95 percent target');
const wrongThreshold = copy(gateVector);
wrongThreshold.conditions.NOMINAL.physical.wrongIdentification = 1;
wrongThreshold.conditions.NOMINAL.physical.wrongIdentificationRate = 1 / 45 * 100;
equal(reportApi.nominalGate(wrongThreshold).ready, false, 'One wrong out of 45 exceeds the unchanged 1 percent maximum');
const incomplete = copy(gateVector);
incomplete.trials.pop(); incomplete.conditions.NOMINAL.physical.valid = 44;
equal(reportApi.nominalGate(incomplete).ready, false, '44 observations cannot complete the nominal gate');
equal(reportApi.nominalGate(incomplete).status, 'PENDING');
equal(crypto.createHash('sha256').update(fs.readFileSync(corpusFile)).digest('hex'), crypto.createHash('sha256').update(corpusBytes).digest('hex'), 'Authentic corpus file remains byte-identical');
console.log('VISION_NOMINAL_SEMANTICS_6C1_PASS ' + assertions + ' assertions; ' + nonNominalComparisons + ' non-nominal baseline scenarios; all vectors AUTOMATED, no physical evidence generated');
