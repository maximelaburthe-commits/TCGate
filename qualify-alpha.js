'use strict';
// A single frozen-SHA qualification workflow. Artifacts live outside the worktree.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFileSync, spawnSync } = require('node:child_process');
const root = __dirname;
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const suites = [
  ['smoke-test.js'], ['smoke-test-c11.js'], ['integration-test-c11.js'], ['offer-delivery-retry-test.js'],
  ['turn-cache-test.js'], ['report-schema-v2-test.js'], ['report-email-bridge-test.js'],
  ['tcgate-ui-1.2-test.js'], ['tcgate-ui-1.2-client-test.js'], ['tcgate-ui-1.2-room-test.js'],
  ['site-ui-2.0-test.js'],
  ['player-locale-test.js'],
  ['vision-locale-test.js'],
  ['cyberpunk-languages-qualification-test.js'],
  ['vision-qualification-1.0-test.js'], ['workspace-vision-qualification-test.js'], ['vision-qualification-neutral-test.js'], ['vision-nominal-6b-test.js'],
  ['future-ux-v3.7-test.js'], ['future-ux-room-metadata-test.js'], ['smoke-test-ui-integration.js'],
  ['phone-camera-test.js'], ['phone-camera-diagnostics-test.js'], ['phone-consolidation-1.2c-test.js'],
  ['vision-integrity-test.js'], ['vision-source-provenance-test.js'], ['vision-backpressure-test.js'],
  ['vision-analysis-resolution-test.js'], ['vision-appearance-batch-test.js'],
  ['cyberpunk-db-integration-test.js'], ['cyberpunk-db-performance-test.js', '--expose-gc'],
  ['database-locale-core-test.js'],
  ['workspace-test.js'], ['workspace-camera-test.js'], ['workspace-cockpit-test.js'],
  ['workspace-journal-test.js'], ['workspace-database-maintenance-test.js'], ['project-hygiene-1.2d-test.js'],
  ['tcgate-ui-1.2-browser-test.js'], ['candidate-15-browser-test.js'],
  ['report-email-browser-test.js'], ['phone-consolidation-1.2c-browser-test.js'],
  ['workspace-browser-test.js'], ['workspace-camera-browser-test.js'],
  ['workspace-cockpit-browser-test.js'], ['workspace-maintenance-journal-browser-test.js'],
  ['database-locale-core-browser-test.js'], ['site-ui-2.0-browser-test.js'], ['player-locale-browser-test.js'], ['vision-locale-browser-test.js'], ['vision-qualification-1.0-browser-test.js'], ['workspace-vision-qualification-browser-test.js'], ['workspace-vision-nominal-browser-test.js']
];

function main() {
  const args = process.argv.slice(2);
  let output;
  if (args.length) {
    if (args.length !== 2 || args[0] !== '--output-dir') throw Error('Usage: npm run qualify:alpha -- [--output-dir ABSOLUTE_PATH]');
    output = path.resolve(args[1]);
  } else output = fs.mkdtempSync(path.join(os.tmpdir(), 'tcgate-candidate-15-qualification-'));
  const relative = path.relative(root, output);
  if (!relative || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative))) throw Error('Qualification artifacts must stay outside the Git worktree');
  fs.mkdirSync(output, { recursive: true });
  if (fs.existsSync(path.join(output, 'qualification.json'))) throw Error('Use a new output directory to preserve earlier evidence');
  if (git(['branch', '--show-current']) !== 'update/next') throw Error('Qualification requires update/next');
  if (git(['status', '--porcelain=v1'])) throw Error('Freeze a clean commit before qualification');
  const sha = git(['rev-parse', 'HEAD']);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  const metadata = require('./candidate-metadata-test-utils.js').assertCandidateMetadata();
  if (metadata.candidate !== '15' || lock.version !== pkg.version || lock.packages[''].version !== pkg.version) throw Error('Candidate 15 metadata must agree across package, lock, frontend and server');
  let playwright;
  try { playwright = require.resolve(process.env.WORKSPACE_PLAYWRIGHT_PATH || 'playwright'); }
  catch { throw Error('Set WORKSPACE_PLAYWRIGHT_PATH to an installed Playwright module; no browser suite is optional'); }
  const manifest = suites.map(([file, flag]) => ({ file, args: flag ? [flag, file] : [file], sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex') }));
  const receipt = { candidate: 15, sha, sourceTree: git(['rev-parse', 'HEAD^{tree}']), startedAt: new Date().toISOString(), node: process.version, playwright, databaseFixture: process.env.TCGATE_DB_FIXTURE_ROOT || 'default sibling directory when present; otherwise the suite explicitly uses its synthetic fixture plus immutable public runtime checks', manifest, suites: [], checks: [], status: 'RUNNING', limits: ['Browser media are synthetic.', 'Remote TURN relay, real Resend delivery and physical Cyberpunk cards are not certified by this workflow.', 'Phone physical PASS is a separate owner declaration.'] };
  const save = () => fs.writeFileSync(path.join(output, 'qualification.json'), JSON.stringify(receipt, null, 2) + '\n');
  const env = { ...process.env };
  // Prevent an inherited provider credential from causing unintended live TURN/email calls.
  for (const key of ['CLOUDFLARE_TURN_KEY_ID', 'CLOUDFLARE_TURN_KEY_API_TOKEN', 'CLOUDFLARE_TURN_API_TOKEN', 'RESEND_API_KEY', 'TCGATE_REPORT_TO_EMAIL', 'TCGATE_REPORT_FROM_EMAIL']) env[key] = '';
  delete env.TCGATE_HYGIENE_SKIP_HTTP;
  delete env.REPORT_MAIL_TEST_SKIP_REMOVAL;
  delete env.REPORT_MAIL_BRIDGE_UNDER_TEST;
  for (const key of ['PHONE_TEST_ROOT', 'TCGATE_PHONE_TEST_ROOT', 'TCGATE_UI12_SERVER', 'TCGATE_TEST_REPO', 'CANDIDATE_TEST_ROOT', 'TCGATE_TURN_SERVER_UNDER_TEST', 'REPORT_MAIL_TEST_ROOT', 'REPORT_MAIL_TEST_BRIDGE', 'TCGATE_PHONE_PAIRING_TTL_MS', 'PLAYER_LOCALE_TEST_ROOT', 'VISION_LOCALE_TEST_ROOT', 'TCGATE_VISION_LOCALE_TEST_ROOT', 'TCGATE_CYBERPUNK_QUALIFICATION_TEST_ROOT']) delete env[key];
  env.TCGATE_ICE_TRANSPORT_POLICY = 'all';
  env.WORKSPACE_SCREENSHOT_DIR = path.join(output, 'screenshots');
  fs.mkdirSync(env.WORKSPACE_SCREENSHOT_DIR);
  env.VISION_QUALIFICATION_ARTIFACT_DIR = output;
  delete env.TCGATE_VISION_QUALIFICATION_TEST_MODULE;
  delete env.TCGATE_VISION_QUALIFICATION_RUNTIME_SCRIPT;
  delete env.TCGATE_VISION_QUALIFICATION_HARNESS_SCRIPT;
  delete env.VISION_QUALIFICATION_TEST_ROOT;
  delete env.VISION_QUALIFICATION_HARNESS_PATH;
  delete env.VISION_QUALIFICATION_RUNTIME_PATH;
  for (const key of ['WORKSPACE_VISION_QUALIFICATION_TEST_ROOT', 'WORKSPACE_VISION_QUALIFICATION_UI_STAGE', 'WORKSPACE_VISION_QUALIFICATION_SHARED_STAGE', 'TCGATE_QUALIFICATION_WORKSPACE_TEST_ROOT', 'TCGATE_VISION_QUALIFICATION_REPORT_MODULE', 'TCGATE_NOMINAL_6B_TEST_ROOT', 'VISION_QUALIFICATION_DIAGNOSTICS_PATH']) delete env[key];
  env.WORKSPACE_VISION_QUALIFICATION_ARTIFACT_DIR = path.join(output, 'workspace-qualification-ux');
  env.CANDIDATE_GIG_AUDIT_PATH = path.join(output, 'gig-audit.json');
  const preload = path.join(root, 'qualification-assert-count.js').split(path.sep).join('/');
  env.NODE_OPTIONS = '--require="' + preload + '"';
  console.log('CANDIDATE_15_FROZEN_SHA ' + sha);
  console.log('ARTIFACTS ' + output);
  save();
  function run(name, executable, commandArgs, instrument) {
    const index = receipt.suites.length + receipt.checks.length;
    const countDirectory = path.join(output, 'assertions-' + index);
    fs.mkdirSync(countDirectory);
    const started = Date.now();
    console.log('RUN ' + name);
    const result = spawnSync(executable, commandArgs, { cwd: root, env: { ...env, TCGATE_QUALIFICATION_ASSERT_DIR: instrument ? countDirectory : '' }, encoding: 'utf8', timeout: 300000, maxBuffer: 16 * 1024 * 1024 });
    const stdout = result.stdout || '', stderr = result.stderr || '';
    const log = name.replace(/[^\w.-]+/g, '_') + '.log';
    fs.writeFileSync(path.join(output, log), stdout + (stderr ? '\nSTDERR\n' + stderr : ''));
    const nodeAssertionCalls = fs.readdirSync(countDirectory).filter(file => file.endsWith('.json')).reduce((sum, file) => sum + JSON.parse(fs.readFileSync(path.join(countDirectory, file), 'utf8')).nodeAssertionCalls, 0);
    const item = { command: [executable, ...commandArgs], name, exit: result.status, signal: result.signal, error: result.error?.message || null, seconds: Number(((Date.now() - started) / 1000).toFixed(2)), nodeAssertionCalls, log };
    (instrument ? receipt.suites : receipt.checks).push(item);
    console.log(stdout.trim());
    if (stderr) process.stderr.write(stderr);
    console.log('EXIT ' + result.status + ' · Node assertions ' + nodeAssertionCalls);
    save();
    if (result.status !== 0) throw Error(name + ' failed; evidence retained at ' + output);
  }
  try {
    for (const suite of manifest) run(suite.file, process.execPath, suite.args, true);
    run('npm run check (node check.js)', process.execPath, ['check.js'], false);
    run('Vision Qualification pending report', process.execPath, ['qualify-vision-1.0.js', '--template', '--validation-receipt', path.join(output, 'qualification.json'), '--index-input', path.join(output, 'vision-qualification-index-measurements.json'), '--output', path.join(output, 'vision-qualification-1.0.json')], false);
    run('git diff --check HEAD^ HEAD', 'git', ['diff', '--check', 'HEAD^', 'HEAD'], false);
    if (git(['rev-parse', 'HEAD']) !== sha || git(['status', '--porcelain=v1'])) throw Error('Source changed during qualification');
    receipt.status = 'PASS';
  } catch (error) {
    receipt.status = 'FAIL';
    receipt.error = error.message;
    process.exitCode = 1;
  } finally {
    receipt.finishedAt = new Date().toISOString();
    receipt.nodeAssertionCalls = receipt.suites.reduce((sum, suite) => sum + suite.nodeAssertionCalls, 0);
    receipt.assertionCounting = 'Node assert calls in instrumented test processes, including expected negative cases; custom throw-only checks are additional and are not counted.';
    save();
    console.log('CANDIDATE_15_QUALIFICATION_' + receipt.status + ' · ' + receipt.suites.filter(s => s.exit === 0).length + '/' + manifest.length + ' suites · ' + receipt.nodeAssertionCalls + ' Node assert calls · SHA ' + sha);
    console.log('RECEIPT ' + path.join(output, 'qualification.json'));
  }
}
try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
