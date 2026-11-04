'use strict';
// Reproducible receipt builder. All counts and trial summaries are read from the
// authentic canonical replay; the raw physical session is never rewritten.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const api = require('./public/vision-qualification-receipt.js');
const canonical = require('./public/vision-qualification-report.js');
const { normalizedBytes, proofRecord } = require('./vision-nominal-qualification-compatibility.js');
const sum = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function generateReceipt(options = {}) {
  const root = fs.realpathSync(options.root || __dirname);
  const sessionBytes = fs.readFileSync(options.sessionPath), reportBytes = fs.readFileSync(options.reportPath);
  assert.equal(sum(sessionBytes), api.SOURCE_HASHES.session, 'Use the immutable official physical session');
  assert.equal(sum(reportBytes), api.SOURCE_HASHES.report, 'Use the official 6C.1 canonical report');
  const session = JSON.parse(sessionBytes), official = JSON.parse(reportBytes);
  assert.equal(session.context.productSha, api.PHYSICAL_SHA);
  assert.equal(official.productSha, api.PHYSICAL_SHA, 'Do not claim a new physical run');
  assert.equal(session.environment.execution, 'RAILWAY_TEST');
  const gitBytes = (sha, file) => execFileSync('git', ['show', sha + ':' + file], { cwd: root, maxBuffer: 32 * 1024 * 1024 });
  const sampleBytes = fs.readFileSync(path.join(root, 'VISION_QUALIFICATION_SAMPLE.json'));
  const physicalSample = gitBytes(api.PHYSICAL_SHA, 'VISION_QUALIFICATION_SAMPLE.json');
  const semanticSample = gitBytes(api.SEMANTICS_SHA, 'VISION_QUALIFICATION_SAMPLE.json');
  assert.deepEqual(normalizedBytes('sample.json', sampleBytes), normalizedBytes('sample.json', physicalSample), 'Keep the exact physical protocol');
  assert.deepEqual(normalizedBytes('sample.json', semanticSample), normalizedBytes('sample.json', physicalSample));
  const sampleDocument = JSON.parse(sampleBytes);
  const sessionBefore = api.digest(session);
  const replay = canonical.generate({ productSha: api.PHYSICAL_SHA, sampleProductSha: api.PHYSICAL_SHA,
    references: session.context.references, sampleDocument, sessions: [session] });
  const replayBytes = Buffer.from(canonical.stableStringify(replay));
  assert.equal(sum(replayBytes), api.SOURCE_HASHES.report, 'Current canonical replay must reproduce the official report byte for byte');
  assert.deepEqual(replayBytes, reportBytes);
  assert.equal(api.digest(session), sessionBefore, 'Replay must not mutate the parsed physical session');
  const files = api.ENGINE_PATHS.map(file => {
    const physical = normalizedBytes(file, gitBytes(api.PHYSICAL_SHA, file));
    const semantics = normalizedBytes(file, gitBytes(api.SEMANTICS_SHA, file));
    const current = normalizedBytes(file, fs.readFileSync(path.join(root, file)));
    assert.deepEqual(semantics, physical, 'Engine did not change between the physical run and reporting fix: ' + file);
    assert.deepEqual(current, physical, 'Current engine/corpus mechanism must remain qualified: ' + file);
    return proofRecord(file, fs.readFileSync(path.join(root, file)));
  });
  const harnessPath = 'public/vision-qualification-harness.js';
  const physicalHarness = normalizedBytes(harnessPath, gitBytes(api.PHYSICAL_SHA, harnessPath)).toString('utf8');
  const semanticHarness = normalizedBytes(harnessPath, gitBytes(api.SEMANTICS_SHA, harnessPath));
  const beforeLine = "    const category = invalidReasons.length ? 'INVALID_TEST' : unstable ? 'UNSTABLE' : wrongCardEvents || wrongPrintingEvents ? 'WRONG_IDENTIFICATION' : stableAt !== null ? 'CORRECT' : !detected ? 'NO_DETECTION' : 'NOT_IDENTIFIED';";
  const afterLine = "    // NOMINAL certifies acquisition once the correct stable window completes.\n" +
    "    // Later losses stay in the counters; invalid evidence and any wrong result\n" +
    "    // still prevent success. Dedicated conditions retain their continuity rules.\n" +
    "    const nominalConfirmed = source.condition === 'NOMINAL' && stableAt !== null && !wrongCardEvents && !wrongPrintingEvents;\n" +
    "    const category = invalidReasons.length ? 'INVALID_TEST' : nominalConfirmed ? 'CORRECT' : unstable ? 'UNSTABLE' : wrongCardEvents || wrongPrintingEvents ? 'WRONG_IDENTIFICATION' : stableAt !== null ? 'CORRECT' : !detected ? 'NO_DETECTION' : 'NOT_IDENTIFIED';";
  assert.equal(physicalHarness.split(beforeLine).length, 2, 'Exact single historical classification site required');
  assert.equal(Buffer.from(physicalHarness.replace(beforeLine, afterLine)).equals(semanticHarness), true, 'Only the exact 6C.1 classification patch is permitted');
  const currentHarness = normalizedBytes(harnessPath, fs.readFileSync(path.join(root, harnessPath)));
  assert.deepEqual(currentHarness, semanticHarness, 'Classification semantics must remain exactly 6C.1');
  const gate = canonical.nominalGate(official), metrics = official.conditions.NOMINAL.physical;
  assert.equal(gate.ready, true); assert.equal(gate.valid, 45); assert.equal(gate.completedCards, 15);
  assert.equal(official.verdict, 'NOT YET QUALIFIED', 'Nominal PASS does not certify complementary conditions');
  assert.equal(official.physicalQualification, 'INCOMPLETE');
  assert.equal(session.trials.length, 45);
  assert(session.trials.every(trial => trial.condition === 'NOMINAL' && trial.provenance === 'physical' &&
    trial.physicalConfirmation === 'REAL_CARDS_OPERATOR_CONFIRMED' && trial.captureMethod === 'runtime-manual'));
  const summaries = official.trials.map(trial => ({
    trialId: trial.trialId, expectedCardId: trial.expectedCardId, expectedPrintingId: trial.expectedPrintingId,
    category: trial.category, correct: trial.correct, wrongCardEvents: trial.wrongCardEvents,
    wrongPrintingEvents: trial.wrongPrintingEvents, stableConfirmedAtMs: trial.stableConfirmedAtMs,
    printingAssessment: trial.printingAssessment
  }));
  const context = api.contextCompatibility(session.context, sampleDocument);
  const output = {
    schemaVersion: '1.0', receiptType: 'VISION_NOMINAL_QUALIFICATION',
    receiptId: 'vision-nominal-' + api.PHYSICAL_SHA.slice(0, 7) + '-' + api.SEMANTICS_SHA.slice(0, 7) + '-' + api.SOURCE_HASHES.report.slice(0, 12),
    status: 'PASS', sourcePhysicalProductSha: api.PHYSICAL_SHA, qualificationSemanticsSha: api.SEMANTICS_SHA,
    databaseSha: context.databaseSha, gameId: context.gameId, locale: context.locale, referenceCount: context.referenceCount,
    referencesSha256: context.referencesSha256, sampleSha256: context.sampleSha256,
    sourceSession: { name: 'vision-qualification-session.json', sha256: sum(sessionBytes), bytes: sessionBytes.length },
    sourceReport: { name: 'vision-qualification-1.0-recalculated-6c1-final.json', sha256: sum(reportBytes), bytes: reportBytes.length },
    provenance: 'physical', physicalEvidence: 'OPERATOR_DECLARED_REAL_CARDS',
    physicalSessionImmutable: true, noNewPhysicalTrials: true,
    engineCompatibility: { files, fingerprintSha256: api.digest(files), physicalAndSemanticsIdentical: true },
    qualificationSemantics: { harnessSha256: sum(currentHarness), previousHarnessSha256: sum(Buffer.from(physicalHarness)),
      change: 'EXACT_6C1_NOMINAL_CLASSIFICATION_ONLY' },
    validTrials: metrics.valid, correct: metrics.correct, correctIdentificationRate: metrics.correctIdentificationRate,
    wrongIdentification: metrics.wrongIdentification, wrongIdentificationRate: metrics.wrongIdentificationRate,
    nominalMetrics: metrics, actualSample: official.actualSample, coverage: gate.coverage,
    trials: summaries, variantCases: official.plan.protocolCoverage.variantCases,
    complementaryPhysicalQualification: 'PENDING', fullQualificationVerdict: official.verdict
  };
  // No timestamp, local path or current Git SHA: identical evidence yields an
  // identical receipt on every compatible UI/documentation/reporting build.
  const compatibility = { schemaVersion: '1.0', buildSha: api.SEMANTICS_SHA, ...context, files,
    fingerprintSha256: api.digest(files), semantics: { harnessSha256: sum(currentHarness) }, receiptSha256: api.digest(output) };
  assert.equal(api.validateReceipt(output, compatibility).ready, true);
  assert.equal(sum(fs.readFileSync(options.sessionPath)), api.SOURCE_HASHES.session, 'Physical export remains immutable');
  assert.equal(sum(fs.readFileSync(options.reportPath)), api.SOURCE_HASHES.report, 'Official report remains immutable');
  return output;
}
function main() {
  const args = {};
  for (let i = 2; i < process.argv.length; i++) {
    const flag = process.argv[i];
    if (!['--session', '--report', '--output'].includes(flag) || !process.argv[i + 1] || args[flag.slice(2)]) throw Error('Usage: node generate-vision-nominal-qualification-receipt.js --session ABSOLUTE_SESSION --report ABSOLUTE_OFFICIAL_REPORT --output ABSOLUTE_RECEIPT');
    args[flag.slice(2)] = process.argv[++i];
  }
  if (['session', 'report', 'output'].some(key => !path.isAbsolute(args[key] || ''))) throw Error('Absolute session/report/output paths required');
  if ([args.session, args.report].some(input => path.resolve(input).toLowerCase() === path.resolve(args.output).toLowerCase())) throw Error('Never overwrite physical evidence');
  const receipt = generateReceipt({ root: __dirname, sessionPath: args.session, reportPath: args.report });
  const bytes = canonical.stableStringify(receipt);
  if (fs.existsSync(args.output)) assert.equal(fs.readFileSync(args.output, 'utf8').replace(/\r\n/g, '\n'), bytes, 'Preserve an earlier receipt; existing output differs');
  else fs.writeFileSync(args.output, bytes, { flag: 'wx' });
  console.log(JSON.stringify({ status: 'PASS', receiptId: receipt.receiptId, output: args.output,
    sha256: sum(Buffer.from(bytes)), reproducible: true, valid: receipt.validTrials, correct: receipt.correct,
    wrongIdentification: receipt.wrongIdentification, engineFilesVerified: receipt.engineCompatibility.files.length,
    physicalSessionImmutable: true }));
}
if (require.main === module) { try { main(); } catch (error) { console.error(error.stack); process.exitCode = 1; } }
module.exports = { generateReceipt };
