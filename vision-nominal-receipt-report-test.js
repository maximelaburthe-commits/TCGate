'use strict';
// Unit scenarios below are scalar test vectors only. They are not captured
// physical sessions and are never saved as qualification exports. The versioned
// receipt carries the genuine ce5be2a physical evidence independently.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const root = __dirname;
const reportApi = require('./public/vision-qualification-report.js');
const receiptApi = require('./public/vision-qualification-receipt.js');
const harness = require('./public/vision-qualification-harness.js');
const diagnostics = require('./public/vision-qualification-diagnostics.js');
const baselineSha = 'f6225e1d64b4fce633e5353afb9f716ece1c00eb';
const currentSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const receipt = JSON.parse(fs.readFileSync(path.join(root, receiptApi.RECEIPT_FILE), 'utf8'));
const sampleDocument = JSON.parse(fs.readFileSync(path.join(root, 'VISION_QUALIFICATION_SAMPLE.json'), 'utf8'));
const references = JSON.parse(fs.readFileSync(path.join(root, 'fixtures/vision-canonical-corpus-229.json'), 'utf8')).references;
const context = reportApi.canonicalContext(currentSha, references);
const plan = reportApi.canonicalPlan(sampleDocument, context);
const copy = value => JSON.parse(JSON.stringify(value));
let assertions = 0;
const equal = (actual, expected, why) => { assertions++; assert.deepEqual(actual, expected, why); };
const check = (value, why) => { assertions++; assert.ok(value, why); };
const throws = (callback, pattern, why) => { assertions++; assert.throws(callback, pattern, why); };
const compatibility = { ...copy(receipt.engineCompatibility), schemaVersion: '1.0', buildSha: currentSha,
  ...receiptApi.contextCompatibility(context, sampleDocument), receiptSha256: receiptApi.digest(receipt),
  semantics: { harnessSha256: receipt.qualificationSemantics.harnessSha256 } };
const options = { productSha: currentSha, sampleProductSha: currentSha, references, sampleDocument };
const qualifiedOptions = { ...options, qualifiedNominalReceipt: receipt, qualifiedBuildCompatibility: compatibility };
const baselineSandbox = { module: { exports: {} }, require: name => {
  if (name === './vision-qualification-harness.js') return harness;
  if (name === './vision-qualification-diagnostics.js') return diagnostics;
  throw Error('Unexpected historical report dependency: ' + name);
} };
vm.createContext(baselineSandbox);
vm.runInContext(execFileSync('git', ['show', baselineSha + ':public/vision-qualification-report.js'],
  { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }), baselineSandbox);
const baseline = baselineSandbox.module.exports;
const unqualified = reportApi.generate(options);
equal(reportApi.stableStringify(unqualified), baseline.stableStringify(baseline.generate(options)),
  'Without receipt options, the whole canonical output remains byte-identical to f6225e1');
check(!('nominalEvidence' in unqualified));
check(!('sessionNominalGate' in unqualified));
check(!('qualifiedNominalGate' in unqualified));
equal(receiptApi.validateReceipt(receipt, compatibility).ready, true, 'Actual versioned physical receipt is compatible');
const optionsBefore = JSON.stringify(qualifiedOptions);
const combined = reportApi.generate(qualifiedOptions);
equal(combined.trials, [], 'Historical nominal trials are not inserted into the current trial list');
equal(combined.metrics.physical.valid, 0, 'The current session has no physical trials');
equal(combined.conditions.NOMINAL.physical.valid, 0);
equal(combined.conditions.NOMINAL.qualifiedPhysical.valid, 45);
equal(combined.conditions.NOMINAL.qualifiedPhysical.correct, 43);
equal(combined.conditions.NOMINAL.qualifiedPhysical.wrongIdentification, 0);
equal(combined.sessionNominalGate.ready, false);
equal(combined.qualifiedNominalGate.ready, true);
equal(combined.nominalQualification.ready, true);
equal(combined.nominalEvidence.source, 'QUALIFICATION_RECEIPT');
equal(combined.nominalEvidence.sourcePhysicalProductSha, 'ce5be2ad9aeaa27df4c217dec99df7f6c7e47c94');
equal(combined.nominalEvidence.qualificationSemanticsSha, baselineSha);
equal(combined.nominalEvidence.sourceSession.sha256, receiptApi.SOURCE_HASHES.session);
equal(combined.nominalEvidence.sourceReport.sha256, receiptApi.SOURCE_HASHES.report);
equal(combined.nominalEvidence.physicalTrialsReplayedOnCurrentBuild, false);
equal(combined.nominalEvidence.appliedToProductSha, currentSha);
equal(combined.nominalEvidence.trials.length, 45, 'Trial summaries retain their historical provenance only');
equal(combined.nominalEvidence.trials.filter(trial => trial.category === 'NOT_IDENTIFIED').map(trial => trial.expectedCardId),
  ['cp-alt-cunningham-soulkiller-architect', 'cp-alt-cunningham-soulkiller-architect'], 'The two authentic Alt failures stay recorded');
equal(combined.gates.nominalCorrectIdentification.status, 'PASS');
equal(combined.gates.nominalWrongIdentification.status, 'PASS');
equal(combined.gates.falsePositive.status, 'NOT TESTED');
equal(combined.verdict, 'NOT YET QUALIFIED');
equal(combined.physicalQualification, 'INCOMPLETE');
equal(combined.plan.complete, false);
check(!combined.plan.missing.some(reason => reason.startsWith('NOMINAL_THREE_TRIALS:') ||
  reason.startsWith('MATRIX:NOMINAL:') || reason === 'CONDITION:NOMINAL'));
const isNominalMissing = reason => reason.startsWith('NOMINAL_THREE_TRIALS:') || reason.startsWith('MATRIX:NOMINAL:') || reason === 'CONDITION:NOMINAL';
equal(combined.plan.missing, unqualified.plan.missing.filter(reason => !isNominalMissing(reason)),
  'Only missing nominal coverage is supplied by the genuine historical receipt');
equal(combined.plan.protocolCoverage.matrix.filter(row => row.condition !== 'NOMINAL'),
  unqualified.plan.protocolCoverage.matrix.filter(row => row.condition !== 'NOMINAL'));
equal(combined.plan.protocolCoverage.variantCases, unqualified.plan.protocolCoverage.variantCases,
  'No printing coverage or exact printing is fabricated from the nominal receipt');
equal(combined.plan.protocolCoverage.similarPairs, unqualified.plan.protocolCoverage.similarPairs);
equal(combined.plan.protocolCoverage.rapidSwitchPairs, unqualified.plan.protocolCoverage.rapidSwitchPairs);
equal(combined.scenes, unqualified.scenes);
equal(combined.indexPerformance, unqualified.indexPerformance);
equal(combined.defects, unqualified.defects);
for (const row of combined.plan.protocolCoverage.matrix.filter(row => row.condition === 'NOMINAL')) {
  equal(row.source, 'QUALIFICATION_RECEIPT'); equal(row.observed, 3); equal(row.currentSessionObserved, 0);
  equal(row.qualifiedObserved, 3); equal(row.complete, true);
}
equal(JSON.stringify(qualifiedOptions), optionsBefore, 'Receipt composition never mutates caller input');
equal(reportApi.stableStringify(reportApi.generate(qualifiedOptions)), reportApi.stableStringify(combined), 'Composition is deterministic');
function session(trials = [], additions = {}) {
  return { context, plan, environment: { execution: 'LOCAL_TEST' }, trials, scenes: [], indexMeasurements: [], ...additions };
}
const selected = plan.sample[0];
const referenceFor = item => references.find(ref => ref.cardId === item.cardId &&
  [ref.printingId, ref.referencePrintingId, ...ref.candidatePrintingIds].includes(item.printingId));
const selectedRef = referenceFor(selected);
const otherRef = referenceFor(plan.sample[1]);
function scalarTrial(extra = {}, actual = selectedRef) {
  return { trialId: 'synthetic-receipt-report-angle', timestamp: '2026-11-04T10:00:00.000Z',
    provenance: 'physical', captureMethod: 'runtime-manual', physicalConfirmation: 'REAL_CARDS_OPERATOR_CONFIRMED',
    condition: 'ANGLE', expectedCardId: selected.cardId, expectedPrintingId: selected.printingId,
    t0Ms: 0, endMs: 1500, notes: ['ANGLE_SLIGHT'], observations: [0, 500, 1000, 1500].map(atMs => ({
      atMs, detected: Boolean(actual), identifiedCardId: actual?.cardId || null,
      identifiedPrintingId: actual?.printingId || null, referenceIds: actual ? [actual.refId] : [],
      candidateIds: actual ? [actual.refId] : [], candidatePrintingIds: actual ? [...actual.candidatePrintingIds] : [],
      recognitionMode: actual?.recognitionMode || null, locale: 'en' })), ...extra };
}
const angleSession = session([scalarTrial()]);
const angleSessionBefore = JSON.stringify(angleSession);
const oneAngle = reportApi.generate({ ...qualifiedOptions, sessions: [angleSession] });
equal(oneAngle.trials.length, 1, 'One new complementary trial remains exactly one current trial');
equal(oneAngle.metrics.physical.valid, 1, 'The 45 historical trials are never added to current physical totals');
equal(oneAngle.conditions.ANGLE.physical.valid, 1);
equal(oneAngle.conditions.NOMINAL.physical.valid, 0);
equal(oneAngle.conditions.NOMINAL.qualifiedPhysical.valid, 45);
equal(oneAngle.nominalEvidence.trials.length, 45);
equal(oneAngle.trials[0].condition, 'ANGLE');
equal(oneAngle.trials[0].category, 'CORRECT');
equal(oneAngle.verdict, 'NOT YET QUALIFIED');
equal(JSON.stringify(angleSession), angleSessionBefore, 'The test input is not rewritten');
const angleWithoutReceipt = reportApi.generate({ ...options, sessions: [angleSession] });
equal(reportApi.stableStringify(angleWithoutReceipt), baseline.stableStringify(baseline.generate({ ...options, sessions: [angleSession] })),
  'An ordinary complementary session without a receipt remains byte-identical to the old reporting implementation');
for (const condition of ['ANGLE', 'STABILITY', 'REMOVAL', 'RAPID_SWITCH']) {
  throws(() => reportApi.generate({ ...qualifiedOptions,
    sessions: [session([scalarTrial({ condition, trialId: receipt.trials[0].trialId })])] }), /cannot be counted again/,
  condition + ': source trial IDs cannot be counted again under another condition');
}
const wrongNow = reportApi.generate({ ...qualifiedOptions, sessions: [session([
  scalarTrial({ condition: 'NOMINAL', trialId: 'synthetic-new-nominal-wrong' }, otherRef)])] });
equal(wrongNow.metrics.physical.wrongIdentification, 1, 'New observations retain their own wrong-card counter');
equal(wrongNow.defects.some(defect => defect.code === 'WRONG_CARD'), true);
equal(wrongNow.gates.currentNominalEvidence.status, 'FAIL', 'An official historical PASS cannot mask a new wrong nominal identity');
check(wrongNow.plan.missing.includes('CURRENT_NOMINAL_FAILURE_REQUIRES_REVIEW'));
check(wrongNow.verdict !== 'PASS');
const notIdentifiedNow = reportApi.generate({ ...qualifiedOptions, sessions: [session([
  scalarTrial({ condition: 'NOMINAL', trialId: 'synthetic-new-nominal-not-identified' }, null)])] });
equal(notIdentifiedNow.metrics.physical.categories.NO_DETECTION, 1);
equal(notIdentifiedNow.gates.currentNominalEvidence.status, 'FAIL');
check(notIdentifiedNow.verdict !== 'PASS');
for (const mutate of [
  value => { value.databaseSha = '0'.repeat(40); },
  value => { value.referenceCount = 228; },
  value => { value.locale = 'fr'; },
  value => { value.status = 'FAIL'; },
  value => { value.engineCompatibility.files[0].sha256 = '0'.repeat(64); },
  value => { value.nominalMetrics.correct = 42; value.nominalMetrics.correctIdentificationRate = 42 / 45 * 100;
    value.correct = 42; value.correctIdentificationRate = 42 / 45 * 100; },
  value => { value.coverage[0].valid = 2; },
  value => { value.sourceSession.sha256 = '0'.repeat(64); }
]) {
  const invalid = copy(receipt); mutate(invalid);
  const invalidReport = reportApi.generate({ ...options, qualifiedNominalReceipt: invalid,
    qualifiedBuildCompatibility: { ...compatibility, receiptSha256: receiptApi.digest(invalid) } });
  equal(invalidReport.qualifiedNominalGate.ready, false);
  equal(invalidReport.sessionNominalGate.ready, false);
  equal(invalidReport.nominalQualification.ready, false);
  check(!('nominalEvidence' in invalidReport));
  equal(invalidReport.plan, unqualified.plan, 'An invalid receipt cannot satisfy any protocol coverage');
}
const absent = reportApi.generate({ ...qualifiedOptions, qualifiedNominalReceipt: null });
equal(absent.qualifiedNominalGate.ready, false);
equal(absent.plan, unqualified.plan);
const unavailable = reportApi.generate({ ...options, qualifiedNominalReceipt: null, qualifiedBuildCompatibility: null });
equal(unavailable.qualifiedNominalGate.ready, false, 'An unavailable endpoint or receipt does not prevent exporting the ordinary current-session report');
equal(unavailable.plan, unqualified.plan);
equal(unavailable.metrics, unqualified.metrics);
const changedRefs = copy(references);
changedRefs[0].refId += '-changed';
const incompatibleContext = reportApi.generate({ ...qualifiedOptions, references: changedRefs });
equal(incompatibleContext.qualifiedNominalGate.ready, false, 'Receipt must match the report references, not only the passed compatibility object');
check(incompatibleContext.qualifiedNominalGate.reasons.includes('REPORT_CONTEXT_MISMATCH'));
const changedSample = copy(sampleDocument);
changedSample.plan.matrix.find(row => row.condition === 'NOMINAL').durationMs = 10000;
const incompatibleSample = reportApi.generate({ ...qualifiedOptions, sampleDocument: changedSample });
equal(incompatibleSample.qualifiedNominalGate.ready, false, 'A changed qualification protocol cannot reuse coverage from another sample document');
const replacement = selected.substitution.eligibleAlternatives.find(item => !plan.sample.some(card => card.cardId === item.cardId));
check(replacement);
const replacedSession = session([], { plan: { ...plan, substitutions: [{ originalCardId: selected.cardId,
  originalPrintingId: selected.printingId, replacementCardId: replacement.cardId, replacementPrintingId: replacement.printingId,
  reason: 'PHYSICAL_CARD_UNAVAILABLE' }] } });
const replacedReport = reportApi.generate({ ...qualifiedOptions, sessions: [replacedSession] });
equal(replacedReport.qualifiedNominalGate.ready, false, 'Nominal coverage does not transfer to an untested substitute');
check(replacedReport.qualifiedNominalGate.reasons.includes('QUALIFIED_NOMINAL_SAMPLE_MISMATCH'));
throws(() => reportApi.generate({ ...qualifiedOptions,
  qualifiedBuildCompatibility: { ...compatibility, buildSha: '0'.repeat(40) } }), /exact report build/);
console.log('VISION_NOMINAL_RECEIPT_REPORT_PASS ' + assertions + ' assertions; unchanged legacy output, separate historical nominal evidence, no duplicated source trials');