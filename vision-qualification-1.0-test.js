'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const h = require(process.env.TCGATE_VISION_QUALIFICATION_TEST_MODULE || path.join(__dirname, 'public/vision-qualification-harness.js'));
let assertions = 0;
function equal(actual, expected, message) { assertions += 1; assert.equal(actual, expected, message); }
function same(actual, expected, message) { assertions += 1; assert.deepEqual(actual, expected, message); }
function check(value, message) { assertions += 1; assert.ok(value, message); }
function throws(callback, pattern) { assertions += 1; assert.throws(callback, pattern); }
const clone = value => JSON.parse(JSON.stringify(value));
const indexId = value => 'index-' + value.toString(16).padStart(64, '0');

function context() {
  return { productSha: 'a'.repeat(40), databaseSha: h.DATABASE_SHA, gameId: 'cyberpunk-tcg', locale: 'en', referenceCount: 229, references: Array.from({ length: 229 }, (_, index) => ({ refId: `ref-${index}`, cardId: `card-${index % 150}`, printingId: `printing-${index}`, referencePrintingId: `printing-${index}`, candidatePrintingIds: [`printing-${index}`], recognitionMode: 'exact', locale: 'en' })) };
}
function observation(atMs, card = 0, printing = card, extra = {}) {
  return { atMs, detected: card !== null, identifiedCardId: card === null ? null : `card-${card}`, identifiedPrintingId: printing === null ? null : `printing-${printing}`, referenceIds: card === null ? [] : [`ref-${card}`], candidateIds: card === null ? [] : [`ref-${card}`], locale: 'en', ...extra };
}
function trial(extra = {}) {
  return { trialId: 'trial-001', timestamp: '2026-11-02T10:00:00.000Z', provenance: 'automated', condition: 'NOMINAL', expectedCardId: 'card-0', expectedPrintingId: 'printing-0', t0Ms: 0, endMs: 1500, observations: [observation(0), observation(500), observation(1000), observation(1500)], ...extra };
}
function physicalTrial(extra = {}) {
  return trial({ provenance: 'physical', physicalConfirmation: 'REAL_CARDS_OPERATOR_CONFIRMED', captureMethod: 'runtime-manual', ...extra });
}
function scene(extra = {}) {
  return { sceneId: 'scene-001', timestamp: '2026-11-02T10:00:00.000Z', scene: 'EMPTY_TABLE', provenance: 'automated', t0Ms: 0, endMs: 30000, observations: Array.from({ length: 61 }, (_, index) => observation(index * 500, null, null)), ...extra };
}
const c = context();
check(h.validateContext(c).valid);
same(h.validateContext({ ...c, gameId: 'cyberpunk' }), { valid: true, errors: [] });
for (const mutation of [null, {}, { ...c, productSha: '' }, { ...c, databaseSha: 'b'.repeat(40) }, { ...c, locale: 'fr' }, { ...c, playerLocale: 'fr' }, { ...c, gameId: 'swu' }, { ...c, referenceCount: 228 }, { ...c, references: c.references.slice(1) }]) check(!h.validateContext(mutation).valid);
for (const field of ['refId', 'cardId', 'printingId', 'referencePrintingId']) {
  const bad = clone(c); bad.references[0][field] = '<private-media>';
  check(!h.validateContext(bad).valid, field);
}
const wrongLocale = clone(c); wrongLocale.references[80].locale = 'fr';
check(!h.validateContext(wrongLocale).valid);
const duplicate = clone(c); duplicate.references[1].refId = duplicate.references[0].refId;
check(!h.validateContext(duplicate).valid);
const missingCard = clone(c); missingCard.references[149].cardId = 'card-1';
check(!h.validateContext(missingCard).valid);

const correct = h.classifyTrial(trial(), c);
equal(correct.category, 'CORRECT'); equal(correct.correct, true); equal(correct.detectionLatency, 0); equal(correct.identificationLatency, 1000); equal(correct.stableCorrectSinceMs, 0); equal(correct.stableConfirmedAtMs, 1000); equal(correct.printingAssessment, 'EXACT_PRINTING_OBSERVED');
equal(h.classifyTrial(trial({ observations: [observation(0, null, null), observation(1500, null, null)] }), c).category, 'NO_DETECTION');
equal(h.classifyTrial(trial({ observations: [observation(0, null, null, { detected: true }), observation(1500, null, null, { detected: true })] }), c).category, 'NOT_IDENTIFIED');
equal(h.classifyTrial(trial({ observations: [observation(0, 1), observation(500, 1), observation(1000, 1)] }), c).category, 'WRONG_IDENTIFICATION');
equal(h.classifyTrial(trial({ observations: [observation(0), observation(500, 1), observation(1000)] }), c).category, 'UNSTABLE');
equal(h.classifyTrial(trial({ observations: [observation(0), observation(1500)] }), c).category, 'NOT_IDENTIFIED');
equal(h.classifyTrial(trial({ observations: [observation(0), observation(500)] }), c).category, 'NOT_IDENTIFIED');
equal(h.classifyTrial(trial({ observations: [observation(0), observation(300, null, null), observation(500), observation(700, null, null), observation(1000)] }), c).category, 'UNSTABLE');

const wrongPrinting = h.classifyTrial(trial({ observations: [observation(0, 0, 150), observation(500, 0, 150), observation(1000, 0, 150)] }), c);
equal(wrongPrinting.category, 'WRONG_IDENTIFICATION'); equal(wrongPrinting.wrongCardEvents, 0); equal(wrongPrinting.wrongPrintingEvents, 3); equal(wrongPrinting.printingAssessment, 'WRONG_PRINTING');
const shared = clone(c); shared.references[0].printingId = null; shared.references[0].candidatePrintingIds = ['printing-0', 'printing-150']; shared.references[0].recognitionMode = 'shared';
const sharedResult = h.classifyTrial(trial({ observations: [observation(0, 0, null), observation(500, 0, null), observation(1000, 0, null)] }), shared);
equal(sharedResult.category, 'CORRECT'); equal(sharedResult.identifiedPrintingId, null); equal(sharedResult.printingAssessment, 'UNRESOLVED_SHARED_ART');
const unrequested = h.classifyTrial(trial({ expectedPrintingId: null }), c); equal(unrequested.printingAssessment, 'NOT_REQUESTED');

const invalidCases = [
  { trialId: '' }, { timestamp: 'sensitive device 123' }, { condition: 'UNKNOWN' }, { provenance: 'fixture' }, { provenance: 'physical' }, { expectedCardId: 'card-fr' }, { expectedPrintingId: 'printing-1' }, { t0Ms: -1 }, { endMs: 0 }, { stableWindowMs: 0 }, { maxObservationGapMs: 0 }, { observations: [] },
  { observations: [observation(0), observation(0)] }, { observations: [observation(1600)] }, { observations: [observation(-1)] },
  { observations: [observation(0, 0, 0, { locale: 'fr' })] }, { observations: [observation(0, 0, 0, { referenceIds: ['ref-FR'] })] }, { observations: [observation(0, 0, 0, { referenceIds: ['ref-1'] })] }, { observations: [observation(0, 0, 0, { candidateIds: ['ref-FR'] })] },
  { observations: [observation(0, 0, 0, { identifiedCardId: 'unknown' })] }, { observations: [observation(0, 0, 0, { identifiedPrintingId: 'printing-1' })] },
  { observations: [observation(0, 0, 0, { referenceIds: [] })] }, { observations: [observation(0, 0, 0, { validityErrors: ['CONTEXT_CHANGED'] })] }, { removal: { t0Ms: 3000 } }
];
for (const extra of invalidCases) {
  const result = h.classifyTrial(trial(extra), c);
  equal(result.category, 'INVALID_TEST', JSON.stringify(extra)); equal(result.detectionLatency, null); equal(result.identificationLatency, null);
}
equal(h.classifyTrial(trial(), wrongLocale).category, 'INVALID_TEST');
const removed = h.classifyTrial(trial({ endMs: 3000, observations: [observation(0), observation(500), observation(1000), observation(1500), observation(2000), observation(2200, null, null), observation(3000, null, null)], removal: { t0Ms: 1800, clearAtMs: 1801 } }), c);
equal(removed.category, 'CORRECT'); equal(removed.removal.clearAtMs, 2200); equal(removed.removal.latencyMs, 400);
const wrongAfterRemoval = h.classifyTrial(trial({ observations: [observation(0), observation(500), observation(1000), observation(1500, 1)], removal: { t0Ms: 1200 } }), c);
equal(wrongAfterRemoval.category, 'CORRECT'); equal(wrongAfterRemoval.wrongCardEvents, 0);
const wrongLast = h.classifyTrial(trial({ observations: [observation(0), observation(500), observation(1000), observation(1500, 1)] }), c);
equal(wrongLast.category, 'WRONG_IDENTIFICATION'); equal(wrongLast.identifiedCardId, 'card-1'); equal(wrongLast.identifiedPrintingId, 'printing-1'); equal(wrongLast.stableConfirmedAtMs, 1000);

same(h.stats([]), { count: 0, min: null, median: null, max: null, p95: null, p95MinimumSamples: 20, p95Method: 'nearest-rank' });
equal(h.stats([5, 1, 3]).median, 3); equal(h.stats([5, 1, 3, 7]).median, 4); equal(h.stats([null, -1, Infinity, 1]).count, 1);
for (let n = 1; n < 20; n += 1) equal(h.stats(Array.from({ length: n }, (_, index) => index)).p95, null);
equal(h.stats(Array.from({ length: 20 }, (_, index) => index + 1)).p95, 19); equal(h.stats(Array.from({ length: 40 }, (_, index) => index + 1)).p95, 38);

const mixed = h.buildReport({ context: c, trials: [trial(), trial({ trialId: 'trial-002', condition: 'ANGLE', observations: [observation(0, 1), observation(500, 1)] }), trial({ trialId: 'trial-003', expectedCardId: 'unknown' }), trial({ trialId: 'trial-004', observations: [observation(0, null, null), observation(1500, null, null)] })], scenes: [scene({ observations: [observation(0, 1), observation(500, 1), observation(1000, null, null), observation(1500, 1)] })] });
equal(mixed.metrics.physical.total, 0); equal(mixed.metrics.automated.total, 4); equal(mixed.metrics.automated.valid, 3); equal(mixed.metrics.automated.invalid, 1); equal(mixed.metrics.automated.detectionRate, 2 / 3 * 100); equal(mixed.metrics.automated.correctIdentificationRate, 1 / 3 * 100); equal(mixed.metrics.automated.wrongIdentificationRate, 1 / 3 * 100);
equal(mixed.conditions.NOMINAL.automated.total, 3); equal(mixed.conditions.ANGLE.automated.total, 1); equal(mixed.conditions.LOW_LIGHT.automated.total, 0); equal(mixed.falsePositiveScenes.automatedCount, 1); equal(mixed.physicalQualification, 'NOT TESTED'); equal(mixed.verdict, 'NOT YET QUALIFIED');
const uncertain = h.buildReport({ context: c, trials: [trial({ provenance: 'physical' })] });
equal(uncertain.metrics.physical.total, 0); equal(uncertain.metrics.invalidUnconfirmed, 1); equal(uncertain.physicalQualification, 'NOT TESTED');
const physicalSingle = h.buildReport({ context: c, trials: [physicalTrial()] });
equal(physicalSingle.physicalQualification, 'INCOMPLETE'); equal(physicalSingle.verdict, 'NOT YET QUALIFIED'); equal(physicalSingle.gates.nominalCorrectIdentification.status, 'INCOMPLETE');
const mislabeledAutomation = h.buildReport({ context: c, environment: { execution: 'AUTOMATED' }, trials: [physicalTrial()], scenes: [scene({ provenance: 'physical', physicalConfirmation: 'REAL_CARDS_OPERATOR_CONFIRMED', captureMethod: 'runtime-manual' })] });
equal(mislabeledAutomation.metrics.physical.total, 0); equal(mislabeledAutomation.metrics.automated.invalid, 1); equal(mislabeledAutomation.falsePositiveScenes.physicalCount, 0); equal(mislabeledAutomation.physicalQualification, 'NOT TESTED'); check(mislabeledAutomation.trials[0].invalidReasons.includes('AUTOMATED_ENVIRONMENT_CANNOT_BE_PHYSICAL'));

equal(h.classifyScene(scene(), c).falseIdentifications, 0);
const falseScene = h.classifyScene(scene({ observations: [observation(0, 1), observation(500, 1), observation(1000, null, null), observation(1500, 1)] }), c);
equal(falseScene.falseIdentifications, 2); equal(falseScene.identifiedObservationCount, 3); equal(falseScene.shapeDetections, 3);
equal(h.classifyScene(scene({ observations: [observation(0, null, null, { detected: true })] }), c).falseIdentifications, 0);
const staleScene = h.classifyScene(scene({ observations: [observation(0, 0, 0, { detected: false }), observation(500, 0, 0, { detected: false })] }), c);
equal(staleScene.valid, true); equal(staleScene.shapeDetections, 0); equal(staleScene.falseIdentifications, 1);
const staleCard = h.classifyTrial(trial({ observations: [observation(0, 0, 0, { detected: false }), observation(500, 0, 0, { detected: false }), observation(1000, 0, 0, { detected: false })] }), c);
equal(staleCard.category, 'NO_DETECTION'); equal(staleCard.identificationLatency, null); equal(staleCard.identified, true);
equal(h.classifyScene(scene({ observations: [observation(0, 0, 0, { locale: 'fr' })] }), c).valid, false);

const empty = h.buildReport({ context: c });
equal(empty.verdict, 'NOT YET QUALIFIED'); equal(empty.physicalQualification, 'NOT TESTED'); equal(empty.gates.falsePositive.status, 'NOT TESTED'); check(!empty.plan.complete);
same(empty.trials, []); same(empty.scenes, []); equal(empty.metrics.physical.correctIdentificationRate, null);
const sleeveSkipped = h.buildReport({ context: c, plan: { sleeveAvailability: 'UNAVAILABLE', sleeveSkipReason: 'NO_GAME_SLEEVE_AVAILABLE' } });
check(!sleeveSkipped.plan.requiredConditions.includes('SLEEVE_GLARE')); equal(sleeveSkipped.plan.sleeveGlare, 'NOT TESTED — NO_GAME_SLEEVE_AVAILABLE');
const sleeveNotSkipped = h.buildReport({ context: c, plan: { sleeveAvailability: 'UNAVAILABLE', sleeveSkipReason: 'arbitrary reason' } });
check(sleeveNotSkipped.plan.requiredConditions.includes('SLEEVE_GLARE'));

const plannedSample = Array.from({ length: 12 }, (_, index) => ({ cardId: `card-${index}`, printingId: `printing-${index}`, substitution: { eligibleAlternatives: [{ cardId: `card-${index + 20}`, printingId: `printing-${index + 20}` }] } }));
const substitution = { originalCardId: 'card-0', replacementCardId: 'card-20', replacementPrintingId: 'printing-20', reason: 'PHYSICAL_CARD_UNAVAILABLE' };
const substitutedReport = h.buildReport({ context: c, plan: { sample: plannedSample, substitutions: [substitution] } });
same(substitutedReport.substitutions, [substitution]); same(substitutedReport.sample[0], { cardId: 'card-0', printingId: 'printing-0' }); same(substitutedReport.actualSample[0], { cardId: 'card-20', printingId: 'printing-20' }); check(substitutedReport.plan.missing.includes('NOMINAL_THREE_TRIALS:card-20')); check(!substitutedReport.plan.missing.includes('NOMINAL_THREE_TRIALS:card-0'));
for (const badSubstitution of [{ ...substitution, reason: 'secret camera label' }, { ...substitution, replacementCardId: 'card-21', replacementPrintingId: 'printing-21' }, { ...substitution, originalCardId: 'card-199' }, { ...substitution, replacementPrintingId: 'printing-21' }]) {
  const report = h.buildReport({ context: c, plan: { sample: plannedSample, substitutions: [badSubstitution] } });
  equal(report.substitutions.length, 0); check(report.plan.missing.includes('INVALID_PROFILE_SUBSTITUTION'));
}
const duplicateSubstitution = h.buildReport({ context: c, plan: { sample: plannedSample, substitutions: [substitution, substitution] } });
equal(duplicateSubstitution.substitutions.length, 1); check(duplicateSubstitution.plan.missing.includes('INVALID_PROFILE_SUBSTITUTION'));
const physicalScene = scene({ provenance: 'physical', physicalConfirmation: 'REAL_CARDS_OPERATOR_CONFIRMED', captureMethod: 'runtime-manual' });
const sceneCovered = h.buildReport({ context: c, scenes: [physicalScene] });
check(!sceneCovered.plan.missing.includes('SCENE_30_SECONDS:EMPTY_TABLE')); equal(sceneCovered.gates.falsePositive.status, 'INCOMPLETE');
const sceneSparse = h.buildReport({ context: c, scenes: [{ ...physicalScene, observations: [observation(0, null, null), observation(30000, null, null)] }] });
check(sceneSparse.plan.missing.includes('SCENE_30_SECONDS:EMPTY_TABLE'));
const multiIdentityScene = h.classifyScene(scene({ observations: [observation(0, 0, 0, { identifiedCandidates: [{ cardId: 'card-0', printingId: 'printing-0', refId: 'ref-0' }, { cardId: 'card-1', printingId: 'printing-1', refId: 'ref-1' }] }), observation(500, 0, 0)] }), c);
equal(multiIdentityScene.valid, true); equal(multiIdentityScene.falseIdentifications, 2); equal(multiIdentityScene.observations[0].identifiedCandidates.length, 2);
equal(h.classifyScene(scene({ observations: [observation(0, 0, 0, { identifiedCandidates: [{ cardId: 'card-0', printingId: 'printing-0', refId: 'ref-FR' }] })] }), c).valid, false);
const indexProvenance = h.buildReport({ context: c, indexMeasurements: [{ measurementId: indexId(1), kind: 'COLD', durationMs: 8300, referenceCount: 229, provenance: 'AUTOMATED_BROWSER' }, { measurementId: indexId(2), kind: 'RELOAD', durationMs: 6600, referenceCount: 229, provenance: 'OPERATOR_RUNTIME' }] });
equal(indexProvenance.indexPerformance.measurements[0].provenance, 'AUTOMATED_BROWSER'); equal(indexProvenance.indexPerformance.measurements[1].provenance, 'OPERATOR_RUNTIME'); equal(indexProvenance.physicalQualification, 'NOT TESTED');
const allAutomatedTrials = [];
for (let card = 0; card < 12; card += 1) for (let rep = 0; rep < 3; rep += 1) allAutomatedTrials.push(trial({ trialId: `trial-${card}-${rep}`, expectedCardId: `card-${card}`, expectedPrintingId: `printing-${card}`, observations: [observation(0, card), observation(500, card), observation(1000, card)] }));
for (const condition of h.CONDITIONS) allAutomatedTrials.push(trial({ trialId: `trial-${condition}`, condition }));
const allAutomated = h.buildReport({ context: c, plan: { sample: plannedSample }, trials: allAutomatedTrials, scenes: h.SCENES.map((sceneName, index) => scene({ sceneId: `scene-${index}`, scene: sceneName })), indexMeasurements: Array.from({ length: 6 }, (_, index) => ({ measurementId: indexId(index + 1), kind: index < 3 ? 'COLD' : 'WARM_RELOAD', durationMs: 8300, referenceCount: 229, provenance: 'AUTOMATED_BROWSER' })) });
equal(allAutomated.metrics.automated.correctIdentificationRate, 100); equal(allAutomated.metrics.physical.total, 0); equal(allAutomated.physicalQualification, 'NOT TESTED'); equal(allAutomated.verdict, 'NOT YET QUALIFIED'); check(!allAutomated.plan.complete);

// Simulated operator declarations exercise coverage logic; these are never a
// receipt for physical cards. The suite's only result is harness validation.
const protocolSample = plannedSample.map((value, index) => ({ ...value, sampleId: `S${index}` }));
const protocol = { sample: protocolSample, matrix: [
  { condition: 'NOMINAL', sampleIds: ['S0'], repetitions: 3 },
  { condition: 'ANGLE', sampleIds: ['S0'], positions: ['SLIGHT', 'MODERATE'], repetitionsPerPosition: 1 },
  { condition: 'STABILITY', sampleIds: ['S0'], durationMs: 10000, repetitions: 1 },
  { condition: 'REMOVAL', sampleIds: ['S0'], repetitions: 1 }
], similarPairs: [{ pairId: 'SIM1', cardIds: ['card-0', 'card-1'], printingIds: ['printing-0', 'printing-1'] }], variantCases: [{ caseId: 'VAR1', cardId: 'card-0', candidatePrintingIds: ['printing-0', 'printing-150'] }], rapidSwitchPairs: [['S0', 'S1']] };
const unfulfilled = h.buildReport({ context: c, plan: protocol });
check(unfulfilled.plan.missing.includes('MATRIX:NOMINAL:S0:DEFAULT')); check(unfulfilled.plan.missing.includes('MATRIX:STABILITY:S0:DEFAULT')); check(unfulfilled.plan.missing.includes('SIMILAR_PAIR:SIM1')); check(unfulfilled.plan.missing.includes('VARIANT_PRINTING:VAR1:printing-150')); check(unfulfilled.plan.missing.includes('RAPID_SWITCH_PAIR:S0:S1'));
const slightOnly = h.buildReport({ context: c, plan: protocol, trials: [physicalTrial({ condition: 'ANGLE', notes: ['ANGLE_SLIGHT'] })] });
check(!slightOnly.plan.missing.includes('MATRIX:ANGLE:S0:ANGLE_SLIGHT')); check(slightOnly.plan.missing.includes('MATRIX:ANGLE:S0:ANGLE_MODERATE'));
const shortenedWindow = h.classifyTrial(physicalTrial({ stableWindowMs: 1, observations: [observation(0), observation(1)] }), c);
equal(shortenedWindow.category, 'INVALID_TEST'); check(shortenedWindow.invalidReasons.includes('PHYSICAL_MEASUREMENT_WINDOW_MISMATCH'));
const incompleteHold = h.buildReport({ context: c, plan: protocol, trials: [physicalTrial({ condition: 'STABILITY', endMs: 10000 })] });
equal(incompleteHold.trials[0].category, 'INVALID_TEST'); check(incompleteHold.trials[0].invalidReasons.includes('INCOMPLETE_CONTINUOUS_OBSERVATION')); check(incompleteHold.plan.missing.includes('MATRIX:STABILITY:S0:DEFAULT'));
const fullHold = h.buildReport({ context: c, plan: protocol, trials: [physicalTrial({ condition: 'STABILITY', endMs: 10000, observations: Array.from({ length: 21 }, (_, index) => observation(index * 500)) })] });
equal(fullHold.trials[0].category, 'CORRECT'); check(!fullHold.plan.missing.includes('MATRIX:STABILITY:S0:DEFAULT'));
const neverRecognizedRemoval = h.buildReport({ context: c, plan: protocol, trials: [physicalTrial({ condition: 'REMOVAL', removal: { t0Ms: 700 }, observations: [observation(0, null, null), observation(500, null, null), observation(1000, null, null), observation(1500, null, null)] })] });
equal(neverRecognizedRemoval.trials[0].category, 'INVALID_TEST'); check(neverRecognizedRemoval.trials[0].invalidReasons.includes('REMOVAL_NOT_PRERECOGNIZED'));
const removalObservation = physicalTrial({ trialId: 'trial-remove', condition: 'REMOVAL', endMs: 2000, removal: { t0Ms: 1200 }, observations: [observation(0), observation(500), observation(1000), observation(1500, null, null), observation(2000, null, null)] });
const removalCovered = h.buildReport({ context: c, plan: protocol, trials: [removalObservation] });
equal(removalCovered.trials[0].removal.assessment, 'CLEARED'); check(!removalCovered.plan.missing.includes('MATRIX:REMOVAL:S0:DEFAULT'));
const rapidA = { ...removalObservation, trialId: 'trial-rapid-A', condition: 'RAPID_SWITCH' };
const rapidB = physicalTrial({ trialId: 'trial-rapid-B', previousTrialId: 'trial-rapid-A', condition: 'RAPID_SWITCH', expectedCardId: 'card-1', expectedPrintingId: 'printing-1', t0Ms: 2000, endMs: 3500, observations: [observation(2000, 1), observation(2500, 1), observation(3000, 1), observation(3500, 1)] });
const rapidCovered = h.buildReport({ context: c, plan: protocol, trials: [rapidA, rapidB] });
check(!rapidCovered.plan.missing.includes('RAPID_SWITCH_PAIR:S0:S1')); equal(rapidCovered.plan.protocolCoverage.rapidSwitchPairs[0].observed[0].beforeTrialId, 'trial-rapid-A'); equal(rapidCovered.plan.protocolCoverage.rapidSwitchPairs[0].observed[0].afterTrialId, 'trial-rapid-B');
const rapidUnlinked = h.buildReport({ context: c, plan: protocol, trials: [rapidA, { ...rapidB, previousTrialId: null }] });
check(rapidUnlinked.plan.missing.includes('RAPID_SWITCH_PAIR:S0:S1'));
const similarTrials = [];
for (let card = 0; card < 2; card += 1) for (let rep = 0; rep < 3; rep += 1) similarTrials.push(physicalTrial({ trialId: `trial-sim-${card}-${rep}`, condition: 'SIMILAR_PRINTINGS', expectedCardId: `card-${card}`, expectedPrintingId: `printing-${card}`, observations: [observation(0, card), observation(500, card), observation(1000, card), observation(1500, card)] }));
const similarCovered = h.buildReport({ context: c, plan: protocol, trials: similarTrials });
check(!similarCovered.plan.missing.includes('SIMILAR_PAIR:SIM1')); same(similarCovered.plan.protocolCoverage.similarPairs[0].observed, [3, 3]);
const similarOneMissing = h.buildReport({ context: c, plan: protocol, trials: similarTrials.slice(1) });
check(similarOneMissing.plan.missing.includes('SIMILAR_PAIR:SIM1'));
const variantsUnavailable = h.buildReport({ context: c, plan: { ...protocol, variantAvailability: [{ caseId: 'VAR1', printingId: 'printing-0', availability: 'UNAVAILABLE', reason: 'PHYSICAL_VARIANT_UNAVAILABLE' }, { caseId: 'VAR1', printingId: 'printing-150', availability: 'UNAVAILABLE', reason: 'PHYSICAL_VARIANT_UNAVAILABLE' }] } });
check(!variantsUnavailable.plan.missing.includes('VARIANT_PRINTING:VAR1:printing-0')); check(!variantsUnavailable.plan.missing.includes('VARIANT_PRINTING:VAR1:printing-150')); check(variantsUnavailable.plan.protocolCoverage.variantCases[0].printings.every(value => value.status === 'NOT TESTED'));
const variantSharedTrials = Array.from({ length: 3 }, (_, index) => physicalTrial({ trialId: `trial-shared-${index}`, condition: 'SIMILAR_PRINTINGS', observations: [observation(0, 0, null), observation(500, 0, null), observation(1000, 0, null), observation(1500, 0, null)] }));
const variantsShared = h.buildReport({ context: shared, plan: protocol, trials: variantSharedTrials });
equal(variantsShared.plan.protocolCoverage.variantCases[0].printings.find(value => value.printingId === 'printing-0').status, 'UNRESOLVED_SHARED_ART'); equal(variantsShared.metrics.physical.printingAssessments.unresolvedSharedArt, 3); equal(variantsShared.metrics.physical.printingAssessments.exactPrintingObserved, 0);

const ghostObservations = [0, 500, 1000, 1500].map(atMs => observation(atMs, 0, 0, { validityErrors: ['MULTIPLE_IDENTITIES'], identifiedCandidates: [{ cardId: 'card-0', printingId: 'printing-0', refId: 'ref-0' }, { cardId: 'card-1', printingId: 'printing-1', refId: 'ref-1' }] }));
const ghostTrial = h.classifyTrial(trial({ observations: ghostObservations }), c);
equal(ghostTrial.category, 'WRONG_IDENTIFICATION'); equal(ghostTrial.wrongCardEvents, 4); equal(ghostTrial.identificationLatency, null); check(!ghostTrial.invalidReasons.includes('MULTIPLE_IDENTITIES'));
const ghostRate = h.buildReport({ context: c, trials: [trial({ observations: ghostObservations })] });
equal(ghostRate.metrics.automated.valid, 1); equal(ghostRate.metrics.automated.wrongIdentificationRate, 100); equal(ghostRate.metrics.automated.invalid, 0);
const shortlistOnly = h.classifyTrial(trial({ observations: [0, 500, 1000, 1500].map(atMs => observation(atMs, 0, 0, { candidateIds: ['ref-0', 'ref-1', 'ref-2', 'ref-3', 'ref-4'] })) }), c);
equal(shortlistOnly.category, 'CORRECT'); equal(shortlistOnly.wrongCardEvents, 0);
const oneInitialization = { measurementId: indexId(1), kind: 'COLD', durationMs: 8300, referenceCount: 229, provenance: 'AUTOMATED_BROWSER' };
const repeatedInitialization = h.buildReport({ context: c, indexMeasurements: [oneInitialization, clone(oneInitialization), clone(oneInitialization)] });
equal(repeatedInitialization.indexPerformance.cold.count, 1); equal(repeatedInitialization.indexPerformance.duplicateMeasurementsIgnored, 2); check(repeatedInitialization.plan.missing.includes('INDEX_THREE_MEASURES:COLD'));
const conflictingInitialization = h.buildReport({ context: c, indexMeasurements: [oneInitialization, { ...oneInitialization, kind: 'WARM_RELOAD' }] });
equal(conflictingInitialization.indexPerformance.cold.count, 0); equal(conflictingInitialization.indexPerformance.warmReload.count, 0); equal(conflictingInitialization.indexPerformance.invalidMeasurements, 1);
const unidentifiedInitialization = h.buildReport({ context: c, indexMeasurements: [{ ...oneInitialization, measurementId: null }, { ...oneInitialization, measurementId: 'raw-camera-device-ID' }] });
equal(unidentifiedInitialization.indexPerformance.measurements.length, 0); equal(unidentifiedInitialization.indexPerformance.invalidMeasurements, 2);
const threeRealInitializations = h.buildReport({ context: c, indexMeasurements: [oneInitialization, { ...oneInitialization, measurementId: indexId(2) }, { ...oneInitialization, measurementId: indexId(3) }] });
equal(threeRealInitializations.indexPerformance.cold.count, 3); check(!threeRealInitializations.plan.missing.includes('INDEX_THREE_MEASURES:COLD'));

const dupReport = h.buildReport({ context: c, trials: [physicalTrial(), physicalTrial()], scenes: [scene(), scene()] });
equal(dupReport.metrics.physical.valid, 0); equal(dupReport.metrics.physical.invalid, 2); check(dupReport.trials.every(value => value.invalidReasons.includes('DUPLICATE_TRIAL_ID'))); check(dupReport.scenes.every(value => !value.valid));
const unstableWrong = h.buildReport({ context: c, trials: [trial({ observations: [observation(0), observation(500, 1), observation(1000)] })] });
equal(unstableWrong.metrics.automated.categories.UNSTABLE, 1); equal(unstableWrong.metrics.automated.wrongIdentificationRate, 100);

const privateMarker = 'PRIVATE_MEDIA_DEVICE_SDP_ICE_123';
const privateInput = { context: { ...c, video: privateMarker, deviceId: privateMarker }, notes: privateMarker, defects: [{ details: privateMarker }], environment: { illumination: 'NORMAL', cameraLabel: privateMarker, deviceId: privateMarker, frameWidth: 1280, frameHeight: 720, background: privateMarker }, trials: [trial({ video: privateMarker, image: privateMarker, audio: privateMarker, deviceId: privateMarker, notes: [privateMarker, 'MANUAL_T0'], observations: [observation(0, 0, 0, { score: 82, scoreKind: 'visualIndex', confidence: .7, image: privateMarker, stream: privateMarker, sdp: privateMarker, iceCandidates: privateMarker }), observation(500), observation(1000)] })], indexMeasurements: [{ measurementId: indexId(1), kind: 'COLD', durationMs: 8300, totalReadyMs: 9000, descriptorBuildMs: 8300, referenceCount: 229, cacheStatus: 'miss', deviceId: privateMarker }, { measurementId: indexId(2), kind: 'WARM_RELOAD', durationMs: 6600, totalReadyMs: 7200, referenceCount: 229, cacheStatus: 'hit' }, { kind: 'COLD', durationMs: -1, referenceCount: 229 }, { kind: 'COLD', durationMs: 3, referenceCount: 1 }] };
const privateReport = h.buildReport(privateInput);
check(!h.stableStringify(privateReport).includes(privateMarker)); same(privateReport.trials[0].notes, ['MANUAL_T0']); same(privateReport.environment, { illumination: 'NORMAL', frameWidth: 1280, frameHeight: 720 }); equal(privateReport.trials[0].observations[0].score, 82); equal(privateReport.trials[0].observations[0].confidence, .7); equal(privateReport.indexPerformance.cold.median, 8300); equal(privateReport.indexPerformance.warmReload.median, 6600); equal(privateReport.indexPerformance.coldTotalReady.median, 9000); equal(privateReport.indexPerformance.measurements.length, 2);
const noScores = h.classifyTrial(trial(), c); check(!Object.hasOwn(noScores.observations[0], 'score')); check(!Object.hasOwn(noScores.observations[0], 'confidence'));

equal(h.stableStringify({ b: 1, a: { z: 2, a: 3 } }), '{\n  "a": {\n    "a": 3,\n    "z": 2\n  },\n  "b": 1\n}\n');
equal(h.stableStringify(h.buildReport(privateInput)), h.stableStringify(h.buildReport(clone(privateInput)))); same(privateInput.trials[0].notes, [privateMarker, 'MANUAL_T0']);
const cycle = {}; cycle.self = cycle; throws(() => h.stableStringify(cycle), /Cyclic/); throws(() => h.stableStringify({ n: Infinity }), /Non-finite/);
const source = fs.readFileSync(process.env.TCGATE_VISION_QUALIFICATION_TEST_MODULE || path.join(__dirname, 'public/vision-qualification-harness.js'), 'utf8');
const browser = { window: {} }; vm.createContext(browser); vm.runInContext(source, browser); check(typeof browser.window.TCGateVisionQualification.buildReport === 'function'); equal(browser.window.TCGateVisionQualification.stats([1, 2, 3]).median, 2);

console.log(`Vision Qualification 1.0 HARNESS: PASS — ${assertions} assertions; AUTOMATED HARNESS VALIDATION only; PHYSICAL QUALIFICATION NOT TESTED`);
