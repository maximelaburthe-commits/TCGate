'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const contract = require('./ui-2.1-qualification-contract.js');
const receiptApi = require('./public/vision-qualification-receipt.js');
const manifest = JSON.parse(fs.readFileSync(contract.MANIFEST_FILE, 'utf8'));
const clone = value => JSON.parse(JSON.stringify(value));
let assertions = 0;
const equal = (actual, expected, label) => { assert.deepEqual(actual, expected, label); assertions++; };
const rejects = (callback, pattern) => { assert.throws(callback, pattern); assertions++; };
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const normalize = value => value.replace(/\r\n/g, '\n');
const verified = contract.verifyPresentationScope(__dirname);
equal([...verified], contract.PRESENTATION_PATHS, 'Exactly the three real presentation files authenticate to both baselines and current bytes');
equal(contract.PRESENTATION_PATHS.some(file => receiptApi.ENGINE_PATHS.includes(file)), false, 'UI exceptions never cover any of the 24 qualified engine paths');
for (const [branch, template] of [['update/next', true], ['update/next', false], [contract.ISOLATED_BRANCH, true]]) {
  equal(contract.assertQualificationMode(branch, template), undefined, 'Existing mode or isolated template remains available');
}
for (const [branch, template] of [[contract.ISOLATED_BRANCH, false], [contract.ISOLATED_BRANCH, undefined], ['main', true], ['workspace-state', true], ['feature/other', true], ['', true]]) rejects(() => contract.assertQualificationMode(branch, template), /Use update\/next/);
for (const file of manifest.files) {
  const bytes = fs.readFileSync(file.path);
  equal(contract.assertPresentationFile(file, bytes), undefined, 'Current presentation accepted');
  const crlf = Buffer.from(normalize(bytes.toString('utf8')).replace(/\n/g, '\r\n'));
  equal(contract.assertPresentationFile(file, crlf), undefined, 'Only checkout newline normalization is accepted');
  rejects(() => contract.assertPresentationFile(file, Buffer.concat([bytes, Buffer.from(' ')])), /presentation changed/);
}
for (const field of ['schemaVersion', 'purpose', 'normalization', 'qualificationBaselineSha', 'productBaselineSha']) {
  const bad = clone(manifest); bad[field] = 'unexpected';
  rejects(() => contract.verifyPresentationScope(__dirname, bad), /Unexpected UI 2.1/);
}
const extra = clone(manifest); extra.engineException = 'public/app.js';
rejects(() => contract.verifyPresentationScope(__dirname, extra), /manifest fields/);
for (const files of [[], manifest.files.slice(0, 2), [...manifest.files, manifest.files[0]], [...manifest.files].reverse(), [manifest.files[0], manifest.files[0], manifest.files[2]], [{ ...manifest.files[0], path: 'public/app.js' }, ...manifest.files.slice(1)], [{ ...manifest.files[0], path: '../public/index.html' }, ...manifest.files.slice(1)]]) {
  const bad = clone(manifest); bad.files = files;
  rejects(() => contract.verifyPresentationScope(__dirname, bad), /three exact authorized paths/);
}
for (const [field, value, pattern] of [['presentationSha256', 'x'.repeat(64), /fingerprint/], ['presentationSha256', '0'.repeat(64), /presentation changed/], ['qualificationBaselineGitBlob', '0'.repeat(40), /baseline Git object/], ['productBaselineGitBlob', '0'.repeat(40), /baseline Git object/]]) {
  const bad = clone(manifest); bad.files[0][field] = value;
  rejects(() => contract.verifyPresentationScope(__dirname, bad), pattern);
}
const extraFileField = clone(manifest); extraFileField.files[0].allowAnyBytes = true;
rejects(() => contract.verifyPresentationScope(__dirname, extraFileField), /file fields/);
const baseline = JSON.parse(fs.readFileSync('VISION_QUALIFICATION_ENGINE_BASELINE.json', 'utf8'));
const historicalExceptions = new Set(['public/workspace.html', 'public/workspace.js', 'public/workspace.css', 'public/identification.js', 'public/identification-worker.js']);
const strict = baseline.files.filter(file => !historicalExceptions.has(file.path) && !verified.has(file.path));
equal(baseline.files.length, 228, 'The original source manifest is not rewritten');
equal(strict.length, 220, 'All other original public/model sources remain strict');
execFileSync('git', ['diff', '--quiet', contract.QUALIFICATION_BASELINE, '--', ...strict.map(file => file.path)], { stdio: 'ignore' });
assertions++;
// Reverse only the approved CLI additions and authenticate every remaining byte.
function restoreOriginalCli(value) {
  let text = normalize(value);
  function reverse(current, original) {
    equal(text.split(current).length - 1, 1, 'Exact authorized CLI change occurs once');
    text = text.replace(current, original);
  }
  reverse("const { assertQualificationMode, verifyPresentationScope } = require('./ui-2.1-qualification-contract.js');\n", '');
  reverse("  assertQualificationMode(git(['branch', '--show-current']), args.template);", "  if (git(['branch', '--show-current']) !== 'update/next') throw Error('Use the qualified update/next checkout');");
  reverse(`  // Authenticate every original 228-file manifest entry above. Three Workspace
  // presentation files and the two exact matcher patches remain the historical
  // exceptions. UI 2.1 separately authenticates its three presentation files to
  // both historical Git baselines and their exact current LF fingerprints.
  // The other 220 original public/model files remain strict Git comparisons.
  // Every matcher byte is still compared to the original after exact anchored
  // 6C hunk reversal and the existing exact-site 6B observation tap removal.`, `  // Authenticate every original 228-file manifest entry above. Only the three
  // Workspace presentation files and the two explicitly patched matchers are
  // exceptions: 223 original public/model files remain strict Git comparisons.
  // Every matcher byte is still compared to the original after exact anchored
  // 6C hunk reversal and the existing exact-site 6B observation tap removal.`);
  reverse(`  const uiPresentationExceptions = verifyPresentationScope(root);
  const strictlyFrozenPaths = baseline.files.filter(file => !workspaceUxExceptions.has(file.path) && !engineExceptions.has(file.path) && !uiPresentationExceptions.has(file.path)).map(file => file.path);
  if (strictlyFrozenPaths.length !== 220) throw Error('Unexpected strict engine source count');`, `  const strictlyFrozenPaths = baseline.files.filter(file => !workspaceUxExceptions.has(file.path) && !engineExceptions.has(file.path)).map(file => file.path);
  if (strictlyFrozenPaths.length !== 223) throw Error('Unexpected strict engine source count');`);
  return text;
}
const cli = fs.readFileSync('qualify-vision-1.0.js', 'utf8');
const originalCli = normalize(execFileSync('git', ['show', contract.PRODUCT_BASELINE + ':qualify-vision-1.0.js'], { encoding: 'utf8' }));
equal(sha(restoreOriginalCli(cli)), sha(originalCli), 'No collector, physical classification, matcher normalization or receipt logic changes beyond exact approved UI CLI additions');
const weakenedBaseline = cli.replace("if (baseline.productSha !==", "if (false && baseline.productSha !==");
equal(sha(restoreOriginalCli(weakenedBaseline)) === sha(originalCli), false, 'Removing an original baseline guard is still detected');
console.log('UI21_QUALIFICATION_CONTRACT_OK ' + assertions + ' assertions; three exact presentation hashes, two immutable Git baselines, 220 strict originals, no physical campaign on isolated branch');