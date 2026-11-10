'use strict';
// Developer qualification only. This supplements the original 228-file manifest
// with three exact UI 2.1 presentations; it never changes the Vision baseline.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const QUALIFICATION_BASELINE = '7baeb9844ac8a2a68b2c5a38011003514bab5f98';
const PRODUCT_BASELINE = '6a5e15271d7339cb23167b93bc6e23c9c108404f';
const ISOLATED_BRANCH = 'feature/ui-2-1-community-alpha';
const PRESENTATION_PATHS = Object.freeze(['public/index.html', 'public/report-mail-ui.js', 'public/tcgate-ui-1.2.js']);
const MANIFEST_FILE = 'UI_2_1_PRESENTATION_PATCHES.json';
function exactKeys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join('|') !== [...expected].sort().join('|')) throw Error('Invalid ' + label + ' fields');
}
function assertQualificationMode(branch, template) {
  if (branch === 'update/next') return;
  if (branch === ISOLATED_BRANCH && template === true) return;
  throw Error('Use update/next, or the isolated UI 2.1 checkout for --template preparation only');
}
function assertPresentationFile(file, bytes) {
  const actual = crypto.createHash('sha256').update(Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n'))).digest('hex');
  if (actual !== file.presentationSha256) throw Error('UI 2.1 presentation changed outside its exact manifest: ' + file.path);
}
function verifyPresentationScope(root, manifest = JSON.parse(fs.readFileSync(path.join(root, MANIFEST_FILE), 'utf8'))) {
  exactKeys(manifest, ['schemaVersion', 'purpose', 'normalization', 'qualificationBaselineSha', 'productBaselineSha', 'files'], 'UI presentation manifest');
  if (manifest.schemaVersion !== '1.0' || manifest.purpose !== 'UI_2_1_PRESENTATION_ONLY' || manifest.normalization !== 'UTF8_LF' || manifest.qualificationBaselineSha !== QUALIFICATION_BASELINE || manifest.productBaselineSha !== PRODUCT_BASELINE) throw Error('Unexpected UI 2.1 presentation baselines or normalization');
  if (!Array.isArray(manifest.files) || manifest.files.length !== PRESENTATION_PATHS.length || manifest.files.some((file, index) => file?.path !== PRESENTATION_PATHS[index])) throw Error('UI 2.1 presentation scope must be the three exact authorized paths');
  const canonicalRoot = fs.realpathSync(root);
  const git = args => execFileSync('git', args, { cwd: canonicalRoot, encoding: 'utf8' }).trim();
  for (const file of manifest.files) {
    exactKeys(file, ['path', 'qualificationBaselineGitBlob', 'productBaselineGitBlob', 'presentationSha256'], 'UI presentation file');
    if (!/^[a-f0-9]{40}$/.test(file.qualificationBaselineGitBlob) || !/^[a-f0-9]{40}$/.test(file.productBaselineGitBlob) || !/^[a-f0-9]{64}$/.test(file.presentationSha256)) throw Error('Invalid UI 2.1 presentation fingerprint');
    if (git(['rev-parse', QUALIFICATION_BASELINE + ':' + file.path]) !== file.qualificationBaselineGitBlob || git(['rev-parse', PRODUCT_BASELINE + ':' + file.path]) !== file.productBaselineGitBlob) throw Error('UI 2.1 presentation baseline Git object mismatch: ' + file.path);
    const resolved = fs.realpathSync(path.join(canonicalRoot, file.path));
    if (!resolved.startsWith(canonicalRoot + path.sep)) throw Error('UI 2.1 presentation path escaped the checkout');
    assertPresentationFile(file, fs.readFileSync(resolved));
  }
  return new Set(PRESENTATION_PATHS);
}
module.exports = Object.freeze({ MANIFEST_FILE, PRESENTATION_PATHS, QUALIFICATION_BASELINE, PRODUCT_BASELINE, ISOLATED_BRANCH, assertQualificationMode, assertPresentationFile, verifyPresentationScope });