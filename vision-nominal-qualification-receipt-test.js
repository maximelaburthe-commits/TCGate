'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const api = require('./public/vision-qualification-receipt.js');
const { getCompatibility } = require('./vision-nominal-qualification-compatibility.js');
const { generateReceipt } = require('./generate-vision-nominal-qualification-receipt.js');
const receipt = require('./VISION_NOMINAL_QUALIFICATION_RECEIPT.json');
const sample = require('./VISION_QUALIFICATION_SAMPLE.json');
const fixture = require('./fixtures/vision-canonical-corpus-229.json');
const root = __dirname;
const productSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const context = { productSha, databaseSha: fixture.databaseSha, gameId: 'cyberpunk', locale: 'en', referenceCount: 229, references: fixture.references };
const clone = value => JSON.parse(JSON.stringify(value));
let assertions = 0;
const check = (value, message) => { assertions++; assert(value, message); };
const equal = (value, expected, message) => { assertions++; assert.deepEqual(value, expected, message); };
function bound(r = receipt) {
  return { ...getCompatibility({ root, buildSha: productSha, context, sampleDocument: sample }), receiptSha256: api.digest(r) };
}
function denied(mutator, reason) {
  const changed = clone(receipt); mutator(changed); const result = api.validateReceipt(changed, bound(changed));
  equal(result.ready, false); equal(result.reasons, [reason]);
}
async function main() {
  for (const input of ['', 'abc', 'épreuve physique 🃏', 'a'.repeat(100000)]) equal(api.sha256(input), crypto.createHash('sha256').update(input).digest('hex'));
  for (const size of [1,55,56,63,64,65,127,128,129,4097]) {
    const data = Uint8Array.from({ length: size }, (_, i) => i % 256);
    equal(api.sha256(data), crypto.createHash('sha256').update(data).digest('hex'));
  }
  equal(api.digest({ b: 2, a: 1 }), api.digest({ a: 1, b: 2 }));
  equal(api.digest([1,2]), crypto.createHash('sha256').update('[1,2]\n').digest('hex'));
  const compatibility = bound(), valid = api.validateReceipt(receipt, compatibility);
  equal(valid.ready, true); equal(valid.valid, 45); equal(valid.correct, 43); equal(valid.wrong, 0);
  equal(valid.correctIdentificationRate, 43 / 45 * 100); equal(valid.wrongIdentificationRate, 0);
  equal(valid.evidence.source, 'QUALIFICATION_RECEIPT'); equal(valid.evidence.trials.length, 45);
  equal(valid.evidence.coverage.length, 15); check(valid.evidence.coverage.every(item => item.valid === 3));
  equal(valid.evidence.sourcePhysicalProductSha, api.PHYSICAL_SHA); equal(valid.evidence.qualificationSemanticsSha, api.SEMANTICS_SHA);
  equal(valid.evidence.trials.filter(trial => trial.category === 'NOT_IDENTIFIED').map(trial => trial.expectedCardId), ['cp-alt-cunningham-soulkiller-architect','cp-alt-cunningham-soulkiller-architect']);
  const independent = api.validateReceipt(receipt, compatibility); independent.evidence.trials.length = 0;
  equal(api.validateReceipt(receipt, compatibility).evidence.trials.length, 45, 'A report cannot mutate the receipt');
  const tampered = clone(receipt); tampered.correct = 44;
  equal(api.validateReceipt(tampered, compatibility).reasons, ['RECEIPT_INTEGRITY_MISMATCH']);
  denied(r => { r.schemaVersion = '2.0'; }, 'RECEIPT_SCHEMA_OR_STATUS');
  denied(r => { r.status = 'FAIL'; }, 'RECEIPT_SCHEMA_OR_STATUS');
  denied(r => { r.databaseSha = 'a'.repeat(40); }, 'CORPUS_CONTEXT_MISMATCH');
  denied(r => { r.locale = 'fr'; }, 'CORPUS_CONTEXT_MISMATCH');
  denied(r => { r.gameId = 'other-game'; }, 'CORPUS_CONTEXT_MISMATCH');
  denied(r => { r.referenceCount = 228; }, 'CORPUS_CONTEXT_MISMATCH');
  denied(r => { r.referencesSha256 = 'a'.repeat(64); }, 'REFERENCES_OR_SAMPLE_MISMATCH');
  denied(r => { r.sampleSha256 = 'a'.repeat(64); }, 'REFERENCES_OR_SAMPLE_MISMATCH');
  denied(r => { r.engineCompatibility.files[0].sha256 = 'a'.repeat(64); }, 'ENGINE_INCOMPATIBLE');
  denied(r => { r.engineCompatibility.files.pop(); }, 'ENGINE_INCOMPATIBLE');
  denied(r => { r.engineCompatibility.files.reverse(); }, 'ENGINE_INCOMPATIBLE');
  denied(r => { r.engineCompatibility.files[0].path = '../arbitrary-file'; }, 'ENGINE_INCOMPATIBLE');
  denied(r => { r.engineCompatibility.fingerprintSha256 = 'a'.repeat(64); }, 'ENGINE_INCOMPATIBLE');
  denied(r => { r.qualificationSemantics.harnessSha256 = 'a'.repeat(64); }, 'SEMANTICS_INCOMPATIBLE');
  denied(r => { r.qualificationSemantics.change = 'UNPROVED_CHANGE'; }, 'SEMANTICS_INCOMPATIBLE');
  denied(r => { r.sourceSession.sha256 = 'a'.repeat(64); }, 'PHYSICAL_PROVENANCE_MISMATCH');
  denied(r => { r.sourceReport.sha256 = 'a'.repeat(64); }, 'PHYSICAL_PROVENANCE_MISMATCH');
  denied(r => { r.sourcePhysicalProductSha = productSha; }, 'PHYSICAL_PROVENANCE_MISMATCH');
  denied(r => { r.qualificationSemanticsSha = api.PHYSICAL_SHA; }, 'PHYSICAL_PROVENANCE_MISMATCH');
  denied(r => { r.sourceSession.bytes++; }, 'PHYSICAL_PROVENANCE_MISMATCH');
  denied(r => { r.physicalSessionImmutable = false; }, 'PHYSICAL_PROVENANCE_MISMATCH');
  denied(r => { r.noNewPhysicalTrials = false; }, 'PHYSICAL_PROVENANCE_MISMATCH');
  denied(r => { r.provenance = 'automated'; }, 'PHYSICAL_PROVENANCE_MISMATCH');
  denied(r => { r.correct = r.nominalMetrics.correct = 42; r.correctIdentificationRate = r.nominalMetrics.correctIdentificationRate = 42 / 45 * 100; }, 'NOMINAL_THRESHOLD_OR_METRICS');
  denied(r => { r.wrongIdentification = r.nominalMetrics.wrongIdentification = 1; r.wrongIdentificationRate = r.nominalMetrics.wrongIdentificationRate = 1 / 45 * 100; }, 'NOMINAL_THRESHOLD_OR_METRICS');
  denied(r => { r.nominalMetrics.valid = 44; }, 'NOMINAL_THRESHOLD_OR_METRICS');
  denied(r => { r.correctIdentificationRate = 100; }, 'NOMINAL_THRESHOLD_OR_METRICS');
  denied(r => { r.coverage[0].valid = 2; }, 'NOMINAL_COVERAGE_INCOMPLETE');
  denied(r => { r.coverage.pop(); }, 'NOMINAL_COVERAGE_INCOMPLETE');
  denied(r => { r.trials[0].trialId = r.trials[1].trialId; }, 'NOMINAL_COVERAGE_INCOMPLETE');
  denied(r => { r.trials[0].category = 'NOT_IDENTIFIED'; }, 'TRIAL_SUMMARY_MISMATCH');
  denied(r => { r.trials[0].stableConfirmedAtMs = null; }, 'TRIAL_SUMMARY_MISMATCH');
  denied(r => { r.trials[0].wrongCardEvents = 1; }, 'TRIAL_SUMMARY_MISMATCH');
  denied(r => { r.trials[0].wrongPrintingEvents = 1; }, 'TRIAL_SUMMARY_MISMATCH');
  for (const attach of [
    r => { r.image = 'private-media'; }, r => { r.sourceSession.path = 'private-path'; },
    r => { r.nominalMetrics.crop = 'private-crop'; }, r => { r.trials[0].observation = 'private-raw'; },
    r => { r.engineCompatibility.files[0].bytes = 'private-bytes'; }, r => { r.variantCases[0].printings[0].url = 'private-url'; }
  ]) denied(attach, 'RECEIPT_SCHEMA_OR_STATUS');
  for (const malformed of [null, undefined, [], {}, { status: 'PASS' }, 3, 'PASS']) equal(api.validateReceipt(malformed, compatibility).ready, false);
  const changedContext = clone(context); changedContext.references[0].referencePrintingId = 'different-printing';
  equal(api.validateReceipt(receipt, { ...compatibility, ...api.contextCompatibility(changedContext, sample) }).reasons, ['REFERENCES_OR_SAMPLE_MISMATCH']);
  const changedSample = clone(sample); changedSample.plan.matrix[0].repetitions++;
  equal(api.validateReceipt(receipt, { ...compatibility, ...api.contextCompatibility(context, changedSample) }).reasons, ['REFERENCES_OR_SAMPLE_MISMATCH']);
  const newUiBuild = { ...compatibility, buildSha: 'b'.repeat(40) };
  equal(api.validateReceipt(receipt, newUiBuild).ready, true, 'Compatible UI builds retain the physical proof without a global SHA equality');
  const requests = [];
  function fetchFor(options = {}) {
    return async (url, fetchOptions) => {
      requests.push({ url, options: fetchOptions });
      if (url === api.RAW_ROOT + productSha + '/' + api.RECEIPT_FILE) return { ok: !options.absent, text: async () => options.text || JSON.stringify(options.receipt || receipt) };
      if (url === '/api/vision-qualification-compatibility') return { ok: !options.noEndpoint, json: async () => options.compatibility || getCompatibility({ root, buildSha: productSha }) };
      throw Error('No branch fallback or alternate resource is permitted: ' + url);
    };
  }
  const loaded = await api.load({ productSha, context, sampleDocument: sample, fetchImpl: fetchFor() });
  equal(loaded.ready, true); equal(loaded.receipt.receiptId, receipt.receiptId); equal(loaded.compatibility.buildSha, productSha);
  equal(requests.length, 2); check(requests.every(request => request.options.cache === 'no-store' && request.options.redirect === 'error'));
  equal((await api.load({ productSha, context, sampleDocument: sample, fetchImpl: fetchFor({ absent: true }) })).reasons, ['RECEIPT_ABSENT']);
  equal((await api.load({ productSha, context, sampleDocument: sample, fetchImpl: fetchFor({ noEndpoint: true }) })).reasons, ['DEPLOYED_COMPATIBILITY_UNAVAILABLE']);
  equal((await api.load({ productSha, context, sampleDocument: sample, fetchImpl: fetchFor({ text: '{invalid' }) })).ready, false);
  equal((await api.load({ productSha, context, sampleDocument: sample, fetchImpl: fetchFor({ text: ' '.repeat(262145) }) })).reasons, ['RECEIPT_TOO_LARGE']);
  equal((await api.load({ productSha, context, sampleDocument: sample, fetchImpl: fetchFor({ compatibility: { ...compatibility, buildSha: 'a'.repeat(40) } }) })).reasons, ['DEPLOYED_BUILD_CHANGED']);
  equal((await api.load({ productSha: 'update/next', context, sampleDocument: sample, fetchImpl: fetchFor() })).reasons, ['EXACT_BUILD_REQUIRED']);
  equal((await api.load({ productSha, context, sampleDocument: sample, fetchImpl: async () => { throw Error('offline'); } })).ready, false);
  // Mutate copies of the real deployed files, never the product worktree.
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'tcgate-nominal-receipt-contract-'));
  for (const file of [...api.ENGINE_PATHS,'public/vision-qualification-harness.js',api.RECEIPT_FILE]) {
    fs.mkdirSync(path.dirname(path.join(temp, file)), { recursive: true }); fs.copyFileSync(path.join(root, file), path.join(temp, file));
  }
  const temporaryCompatibility = () => getCompatibility({ root: temp, buildSha: productSha, context, sampleDocument: sample });
  equal(api.validateReceipt(receipt, temporaryCompatibility()).ready, true);
  for (const file of api.ENGINE_PATHS.filter(file => file !== 'server.js')) {
    const target = path.join(temp, file), original = fs.readFileSync(target);
    if (file.endsWith('.onnx')) { const changed = Buffer.from(original); changed[changed.length - 1] ^= 1; fs.writeFileSync(target, changed); }
    else fs.appendFileSync(target, '\n// incompatible future change\n');
    equal(api.validateReceipt(receipt, temporaryCompatibility()).ready, false, 'Actual disk change invalidates ' + file);
    fs.writeFileSync(target, original);
    equal(api.validateReceipt(receipt, temporaryCompatibility()).ready, true, 'Restoring the real mechanism restores compatibility');
  }
  // The unchanged bytes on disk must also be the bytes the server actually
  // serves, and Workspace must keep loading the qualified engine scripts.
  const copiedServer = path.join(temp, 'server.js'), serverOriginal = fs.readFileSync(copiedServer, 'utf8');
  const changedServerCases = [
    text => text.replace("const ROOT = path.join(__dirname, 'public');", "const ROOT = path.join(__dirname, 'other-public');"),
    text => text.replace("'card_detector_v53_512.onnx'", "'other-detector.onnx'"),
    text => text.replace("'/api/model/card-detector-v53-512-alpha9p1.onnx'", "'/api/model/unqualified.onnx'"),
    text => text.replace('fs.createReadStream(MODEL_FILE).pipe(res);', 'fs.createReadStream(MODEL_FILE, { start: 1 }).pipe(res);'),
    text => text.replace('fs.stat(MODEL_FILE,', "fs.stat(MODEL_FILE + '.other',"),
    text => text.replace('pathname === MODEL_ROUTE)', "pathname === MODEL_ROUTE + '/other')"),
    text => text.replace('const MODEL_FILE =', 'const OTHER_MODEL_FILE ='),
    text => text + "\nconst MODEL_ROUTE = '/api/model/ambiguous';\n",
    text => text.replace("    if (req.method === 'GET' && pathname === MODEL_ROUTE) {",
      "    if (req.method === 'GET' && pathname === MODEL_ROUTE) { return; }\n    if (req.method === 'GET' && pathname === MODEL_ROUTE) {")
  ];
  for (const mutate of changedServerCases) {
    const changed = mutate(serverOriginal); check(changed !== serverOriginal, 'Mutant actually changes the model serving contract');
    fs.writeFileSync(copiedServer, changed);
    let accepted = false;
    try { accepted = api.validateReceipt(receipt, temporaryCompatibility()).ready; } catch { /* Fail closed on ambiguous contracts. */ }
    equal(accepted, false, 'Server model URL/path/stream/route changes cannot retain the nominal proof');
    fs.writeFileSync(copiedServer, serverOriginal);
    equal(api.validateReceipt(receipt, temporaryCompatibility()).ready, true);
  }
  fs.appendFileSync(copiedServer, '\n// An unrelated qualification endpoint or documentation comment is compatible.\n');
  equal(api.validateReceipt(receipt, temporaryCompatibility()).ready, true, 'Only the explicit model-serving scope is hashed');
  fs.writeFileSync(copiedServer, serverOriginal);
  const copiedLoader = path.join(temp, 'public/workspace.js'), loaderOriginal = fs.readFileSync(copiedLoader, 'utf8');
  const unqualifiedLoader = loaderOriginal.replace("'/vision-core.js'", "'/unqualified-core.js'");
  check(unqualifiedLoader !== loaderOriginal, 'Loader mutant changes the actual script selection');
  fs.writeFileSync(copiedLoader, unqualifiedLoader);
  equal(api.validateReceipt(receipt, temporaryCompatibility()).ready, false, 'Workspace cannot select an unqualified engine while keeping the same receipt');
  fs.writeFileSync(copiedLoader, loaderOriginal);
  equal(api.validateReceipt(receipt, temporaryCompatibility()).ready, true);
  const target = path.join(temp, 'public/vision-qualification-harness.js'), original = fs.readFileSync(target);
  fs.appendFileSync(target, '\n// incompatible classification\n');
  equal(api.validateReceipt(receipt, temporaryCompatibility()).reasons, ['SEMANTICS_INCOMPATIBLE']);
  fs.writeFileSync(target, original);
  fs.writeFileSync(path.join(temp, 'public/workspace.html'), '<h1>UI-only change</h1>');
  fs.writeFileSync(path.join(temp, 'README.md'), 'Documentation-only change\n');
  equal(api.validateReceipt(receipt, temporaryCompatibility()).ready, true);
  equal(api.validateReceipt(receipt, { ...temporaryCompatibility(), referenceCount: 228 }).ready, false);
  equal(api.validateReceipt(receipt, { ...temporaryCompatibility(), locale: 'fr' }).ready, false);
  equal(api.validateReceipt(receipt, { ...temporaryCompatibility(), databaseSha: 'c'.repeat(40) }).ready, false);
  // Optional real-source replay is explicit, not a simulated physical campaign.
  const options = {};
  for (let i = 2; i < process.argv.length; i += 2) {
    if (!['--session','--report'].includes(process.argv[i]) || !process.argv[i + 1]) throw Error('Optional real replay needs --session PATH --report PATH');
    options[process.argv[i].slice(2)] = process.argv[i + 1];
  }
  if (options.session || options.report) {
    check(Boolean(options.session && options.report));
    const beforeSession = fs.readFileSync(options.session), beforeReport = fs.readFileSync(options.report);
    const rebuilt = generateReceipt({ root, sessionPath: options.session, reportPath: options.report });
    const rebuiltAgain = generateReceipt({ root, sessionPath: options.session, reportPath: options.report });
    equal(rebuilt, receipt); equal(rebuiltAgain, receipt);
    equal(fs.readFileSync(options.session), beforeSession); equal(fs.readFileSync(options.report), beforeReport);
    console.log('AUTHENTIC_PHYSICAL_REPLAY_AND_RECEIPT_REPRODUCTION PASS');
  }
  console.log('VISION_NOMINAL_QUALIFICATION_RECEIPT_PASS ' + assertions + ' assertions; 23 complete engine files plus the scoped model-serving contract, exact-build-only receipt, immutable physical provenance, fail-closed invalidation');
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
