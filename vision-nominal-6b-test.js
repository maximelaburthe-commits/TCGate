'use strict';
// Synthetic classified-report fixtures test the progression gate only.
// They are never saved or reported as physical-card qualification evidence.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = process.env.TCGATE_NOMINAL_6B_TEST_ROOT || __dirname;
const api = require(path.join(root, 'public/vision-qualification-report.js'));
const sample = JSON.parse(fs.readFileSync(path.join(root, 'VISION_QUALIFICATION_SAMPLE.json'), 'utf8')).sample;
let assertions = 0;
const equal = (a, b, why) => { assertions++; assert.deepEqual(a, b, why); };
const clone = value => JSON.parse(JSON.stringify(value));
function report() {
  const trials = sample.flatMap(card => Array.from({ length: 3 }, (_, repetition) => ({
    trialId: card.sampleId + '-' + repetition, condition: 'NOMINAL', provenance: 'physical',
    evidence: 'OPERATOR_DECLARED_REAL_CARDS', expectedCardId: card.cardId,
    expectedPrintingId: card.printingId, category: 'CORRECT'
  })));
  return { productSha: 'a'.repeat(40), verdict: 'NOT YET QUALIFIED', actualSample: sample.map(card => ({ cardId: card.cardId, printingId: card.printingId })), trials,
    conditions: { NOMINAL: { physical: { total: 45, valid: 45, invalid: 0, correct: 45, wrongIdentification: 0,
      correctIdentificationRate: 100, wrongIdentificationRate: 0 } } } };
}
const input = report(), bytes = JSON.stringify(input), gate = api.nominalGate(input);
equal(gate.ready, true); equal(gate.status, 'VISION NOMINAL READY FOR FULL QUALIFICATION');
equal(gate.valid, 45); equal(gate.completedCards, 15);
equal(gate.fullQualificationVerdict, 'NOT YET QUALIFIED', 'Nominal never promotes the full campaign verdict');
equal(JSON.stringify(input), bytes, 'Gate never mutates reports');
for (const mutation of [
  value => value.trials.pop(),
  value => value.trials.push({ ...value.trials[0], trialId: 'extra' }),
  value => { value.trials[0] = { ...value.trials[3], trialId: 'duplicate-slot' }; },
  value => { value.actualSample[0] = clone(value.actualSample[1]); },
  value => { value.actualSample.pop(); },
  value => { value.trials[0].expectedPrintingId = 'outside-sample'; },
  value => { value.trials[0].category = 'INVALID_TEST'; },
  value => { value.trials[0].condition = 'ANGLE'; },
  value => { value.trials[0].evidence = 'AUTOMATED_FIXTURE'; },
  value => { value.trials[0].provenance = 'automated'; },
  value => { value.conditions.NOMINAL.physical.valid = 44; },
  value => { value.conditions.NOMINAL.physical.correctIdentificationRate = 94.999; },
  value => { value.conditions.NOMINAL.physical.wrongIdentificationRate = 1.001; }
]) { const value = report(); mutation(value); equal(api.nominalGate(value).ready, false); }
const boundary = report(); boundary.conditions.NOMINAL.physical.correctIdentificationRate = 95;
boundary.conditions.NOMINAL.physical.wrongIdentificationRate = 1;
equal(api.nominalGate(boundary).ready, true, 'Inclusive owner-specified thresholds');
const empty = api.nominalGate({}); equal(empty.ready, false); equal(empty.status, 'PENDING');
equal(empty.correctIdentificationRate, null); equal(empty.wrongIdentificationRate, null);
equal(empty.baseline.productSha, '062d6089fdfe5d778d65014642d909e8273fcc9a');
equal(empty.baseline.categories, { CORRECT: 11, NOT_IDENTIFIED: 18, UNSTABLE: 10, WRONG_IDENTIFICATION: 4, INVALID_TEST: 2, NO_DETECTION: 0 });
equal(empty.baseline.valid, 43); equal(empty.baseline.correct, 11); equal(empty.baseline.wrong, 7);
equal(empty.baseline.correctIdentificationRate, 100 * 11 / 43);
equal(empty.baseline.wrongIdentificationRate, 100 * 7 / 43);
empty.baseline.categories.CORRECT = 999;
equal(api.nominalGate({}).baseline.categories.CORRECT, 11, 'Baseline exposed through independent copies');
const automated = report(); automated.trials.forEach(trial => { trial.provenance = 'automated'; trial.evidence = 'AUTOMATED_FIXTURE'; });
equal(api.nominalGate(automated).ready, false, 'Forty-five automated fixtures cannot unlock physical degraded tests');
console.log('VISION_NOMINAL_6B_GATE_PASS ' + assertions + ' assertions; synthetic gate fixtures only');
