'use strict';
// Isolated-branch regression runner. Never deploys, pushes, changes refs, starts
// physical trials or converts synthetic observations into qualification results.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
const { execFileSync, spawnSync } = require('node:child_process');
const root = __dirname, baseSha = '6d08ad3fde309a6c38990ba82ef4e56aa2e21597';
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
function main() {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--output-dir' || !path.isAbsolute(args[1]))) throw Error('Usage: node validate-vision-real-game.js [--output-dir ABSOLUTE_PATH]');
  const output = args.length ? args[1] : fs.mkdtempSync(path.join(os.tmpdir(), 'tcgate-real-game-validation-'));
  const relative = path.relative(root, output);
  if (!relative || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative))) throw Error('Artifacts must stay outside the worktree');
  fs.mkdirSync(output, { recursive: true });
  const receiptPath = path.join(output, 'validation.json');
  if (fs.existsSync(receiptPath)) throw Error('Use a new output directory; previous evidence must not be replaced');
  const branch = git(['branch', '--show-current']), sha = git(['rev-parse', 'HEAD']);
  if (!branch.startsWith('feature/vision-real-game-')) throw Error('This workflow requires the isolated real-game feature branch');
  if (git(['status', '--porcelain=v1'])) throw Error('Freeze a clean commit before this validation');
  if (git(['diff', '--name-status', baseSha, 'HEAD']).split('\n').some(line => !line.startsWith('A\t'))) throw Error('Only new files are permitted; historical files must remain unchanged');
  git(['merge-base', '--is-ancestor', baseSha, 'HEAD']);
  const registry = fs.readFileSync(path.join(root, 'qualify-alpha.js'), 'utf8').match(/const suites = \[([\s\S]*?)\n\];/);
  if (!registry) throw Error('Historical suite registry is unavailable');
  const old = [...registry[1].matchAll(/\['([^']+)'(?:,\s*'([^']+)')?\]/g)].map(match => ({ file: match[1], args: match[2] ? [match[2], match[1]] : [match[1]] }));
  if (old.length !== 63) throw Error('Review a changed historical registry instead of silently skipping suites');
  const additions = ['vision-real-game-campaign-test.js', 'vision-real-game-observer-test.js', 'vision-real-game-baseline-test.js', 'vision-real-game-browser-test.js'].map(file => ({ file, args: [file] }));
  const manifest = [...old, ...additions].map(item => ({ ...item, sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(root, item.file))).digest('hex') }));
  const env = { ...process.env };
  for (const key of ['CLOUDFLARE_TURN_KEY_ID','CLOUDFLARE_TURN_KEY_API_TOKEN','CLOUDFLARE_TURN_API_TOKEN','RESEND_API_KEY','TCGATE_REPORT_TO_EMAIL','TCGATE_REPORT_FROM_EMAIL']) env[key] = '';
  for (const key of ['TCGATE_HYGIENE_SKIP_HTTP','REPORT_MAIL_TEST_SKIP_REMOVAL','REPORT_MAIL_BRIDGE_UNDER_TEST','PHONE_TEST_ROOT','TCGATE_PHONE_TEST_ROOT','TCGATE_UI12_SERVER','TCGATE_TEST_REPO','CANDIDATE_TEST_ROOT','TCGATE_TURN_SERVER_UNDER_TEST','REPORT_MAIL_TEST_ROOT','REPORT_MAIL_TEST_BRIDGE','TCGATE_PHONE_PAIRING_TTL_MS','PLAYER_LOCALE_TEST_ROOT','VISION_LOCALE_TEST_ROOT','TCGATE_VISION_LOCALE_TEST_ROOT','TCGATE_CYBERPUNK_QUALIFICATION_TEST_ROOT','TCGATE_VISION_QUALIFICATION_TEST_MODULE','TCGATE_VISION_QUALIFICATION_RUNTIME_SCRIPT','TCGATE_VISION_QUALIFICATION_HARNESS_SCRIPT','VISION_QUALIFICATION_TEST_ROOT','VISION_QUALIFICATION_HARNESS_PATH','VISION_QUALIFICATION_RUNTIME_PATH','WORKSPACE_VISION_QUALIFICATION_TEST_ROOT','WORKSPACE_VISION_QUALIFICATION_UI_STAGE','WORKSPACE_VISION_QUALIFICATION_SHARED_STAGE','TCGATE_QUALIFICATION_WORKSPACE_TEST_ROOT','TCGATE_VISION_QUALIFICATION_REPORT_MODULE','TCGATE_NOMINAL_6B_TEST_ROOT','VISION_QUALIFICATION_DIAGNOSTICS_PATH','TCGATE_6C1_TEST_ROOT','TCGATE_6C_TEST_ROOT','TCGATE_6C_PRODUCTION_ROOT','TCGATE_6C_CORPUS_PATH','TCGATE_6C_SAMPLE_PATH','TCGATE_6C_BASELINE_REPO','TCGATE_6C_ENGINE_TARGET_ROOT','TCGATE_6C_CANONICAL_TARGET_ROOT']) delete env[key];
  delete env.VISION_REAL_GAME_TEST_ROOT;
  env.TCGATE_ICE_TRANSPORT_POLICY = 'all';
  env.WORKSPACE_SCREENSHOT_DIR = path.join(output, 'screenshots'); fs.mkdirSync(env.WORKSPACE_SCREENSHOT_DIR);
  env.VISION_QUALIFICATION_ARTIFACT_DIR = output;
  env.WORKSPACE_VISION_QUALIFICATION_ARTIFACT_DIR = path.join(output, 'workspace-qualification-ux');
  env.CANDIDATE_GIG_AUDIT_PATH = path.join(output, 'gig-audit.json');
  env.VISION_REAL_GAME_ARTIFACT_DIR = path.join(output, 'real-game'); fs.mkdirSync(env.VISION_REAL_GAME_ARTIFACT_DIR);
  env.NODE_OPTIONS = '--require="' + path.join(root, 'qualification-assert-count.js').split(path.sep).join('/') + '"';
  const receipt = { scope: 'REAL_GAME_INSTRUMENTATION_AUTOMATED_REGRESSION', provenance: 'AUTOMATED', branch, sha,
    baseSha, sourceTree: git(['rev-parse', 'HEAD^{tree}']), startedAt: new Date().toISOString(), node: process.version,
    manifest, suites: [], checks: [], status: 'RUNNING', physicalQualification: 'NOT_PERFORMED',
    limits: ['Browser videos, pointers and recognition outcomes are synthetic; no physical PASS.', 'No live TURN relay or real email delivery is certified.', 'No deployment, push or branch promotion is performed.'] };
  const save = () => fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
  function run(name, command, commandArgs, instrument) {
    const directory = path.join(output, 'assertions-' + (receipt.suites.length + receipt.checks.length)); fs.mkdirSync(directory);
    console.log('RUN ' + name); const started = Date.now();
    const result = spawnSync(command, commandArgs, { cwd: root, env: { ...env, TCGATE_QUALIFICATION_ASSERT_DIR: instrument ? directory : '' }, encoding: 'utf8', timeout: 300000, maxBuffer: 16 * 1024 * 1024 });
    const log = name.replace(/[^\w.-]+/g, '_') + '.log';
    fs.writeFileSync(path.join(output, log), (result.stdout || '') + (result.stderr ? '\nSTDERR\n' + result.stderr : ''));
    const assertions = fs.readdirSync(directory).filter(file => file.endsWith('.json')).reduce((sum, file) => sum + JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8')).nodeAssertionCalls, 0);
    (instrument ? receipt.suites : receipt.checks).push({ name, command: [command, ...commandArgs], exit: result.status, signal: result.signal, error: result.error?.message || null, seconds: Number(((Date.now() - started) / 1000).toFixed(2)), nodeAssertionCalls: assertions, log });
    save(); console.log('EXIT ' + result.status + ' | assertions ' + assertions);
    if (result.status !== 0) { console.log((result.stdout || '').slice(-5000)); console.error((result.stderr || '').slice(-5000)); throw Error(name + ' failed; evidence preserved'); }
  }
  console.log('FROZEN_SHA ' + sha + '\nARTIFACTS ' + output); save();
  try {
    for (const suite of manifest) run(suite.file, process.execPath, suite.args, true);
    run('JavaScript syntax (check.js)', process.execPath, ['check.js'], false);
    run('git diff --check', 'git', ['diff', '--check', baseSha, 'HEAD'], false);
    if (git(['rev-parse', 'HEAD']) !== sha || git(['status', '--porcelain=v1'])) throw Error('Sources changed during validation');
    receipt.status = 'PASS';
  } catch (error) { receipt.status = 'FAIL'; receipt.error = error.message; process.exitCode = 1; }
  finally { receipt.finishedAt = new Date().toISOString(); receipt.nodeAssertionCalls = receipt.suites.reduce((sum, item) => sum + item.nodeAssertionCalls, 0); save(); console.log('REAL_GAME_VALIDATION_' + receipt.status + ' | ' + receipt.suites.filter(item => item.exit === 0).length + '/' + manifest.length + ' | ' + receipt.nodeAssertionCalls + ' Node assert calls\nRECEIPT ' + receiptPath); }
}
try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
