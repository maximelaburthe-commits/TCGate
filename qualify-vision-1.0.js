'use strict';
// Developer CLI only. Never loaded by a normal player page.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

async function main() {
  const root = __dirname;
  const harness = require('./public/vision-qualification-harness.js');
  const source = require('./public/database-source.js');
  const registry = require('./public/game-databases.js').get('cyberpunk');
  const baseline = JSON.parse(fs.readFileSync(path.join(root, 'VISION_QUALIFICATION_ENGINE_BASELINE.json'), 'utf8'));
  const sample = JSON.parse(fs.readFileSync(path.join(root, 'VISION_QUALIFICATION_SAMPLE.json'), 'utf8'));
  const args = { inputs: [], indexes: [] };
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg === '--template') { if (args.template) throw Error('Duplicate --template'); args.template = true; }
    else if (['--input', '--output', '--fixture-root', '--index-input', '--validation-receipt'].includes(arg) && process.argv[i + 1]) {
      const key = arg.slice(2), value = process.argv[++i];
      if (key === 'input') args.inputs.push(value);
      else if (key === 'index-input') args.indexes.push(value);
      else { if (args[key]) throw Error('Duplicate ' + arg); args[key] = value; }
    } else throw Error('Usage: npm run qualify:vision -- --template|--input SESSION.json --output ABSOLUTE_REPORT.json [--fixture-root PINNED_DB_SNAPSHOT]');
  }
  if (!args.output || (!!args.inputs.length === !!args.template)) throw Error('Select exactly --template or --input, and an absolute --output');
  if (!path.isAbsolute(args.output)) throw Error('Output must be absolute');
  const real = value => {
    let probe = path.resolve(value), tails = [];
    while (!fs.existsSync(probe)) { tails.unshift(path.basename(probe)); const parent = path.dirname(probe); if (parent === probe) throw Error('Unresolvable output'); probe = parent; }
    return path.join(fs.realpathSync(probe), ...tails).toLowerCase();
  };
  const within = (parent, target) => target === parent || target.startsWith(parent + path.sep);
  const output = path.resolve(args.output), canonicalOutput = real(output);
  const fixtureRoot = args['fixture-root'] || process.env.TCGATE_DB_FIXTURE_ROOT;
  if (within(real(root), canonicalOutput) || (fixtureRoot && within(real(fixtureRoot), canonicalOutput))) throw Error('Keep reports outside product and database sources');
  if (fs.existsSync(output)) throw Error('Preserve earlier evidence; output already exists');
  const git = values => execFileSync('git', values, { cwd: root, encoding: 'utf8' }).trim();
  const productSha = git(['rev-parse', 'HEAD']);
  if (git(['branch', '--show-current']) !== 'update/next') throw Error('Use the qualified update/next checkout');
  if (git(['status', '--porcelain=v1'])) throw Error('Freeze a clean product commit before generating evidence');
  if (baseline.productSha !== '7baeb9844ac8a2a68b2c5a38011003514bab5f98' || baseline.files.length !== 228) throw Error('Unexpected engine baseline');
  const baselineTree = new Map(git(['ls-tree', '-r', baseline.productSha]).split('\n').map(line => {
    const match = line.match(/^\d+ blob ([0-9a-f]{40})\t(.+)$/); return match ? [match[2], match[1]] : ['', ''];
  }));
  const frozenPaths = baseline.files.map(file => file.path);
  const expectedPaths = [...baselineTree.keys()].filter(value => /^(public|models)\//.test(value));
  if (new Set(frozenPaths).size !== 228 || expectedPaths.length !== 228 || expectedPaths.some(value => !frozenPaths.includes(value))) throw Error('Frozen source manifest must cover the complete original engine');
  for (const file of baseline.files) {
    if (!/^(public|models)\//.test(file.path) || !/^[0-9a-f]{40}$/.test(file.gitBlob)) throw Error('Invalid frozen source manifest');
    if (baselineTree.get(file.path) !== file.gitBlob) throw Error('Frozen Git object mismatch');
  }
  // Git applies its normal text filters, so Windows CRLF checkout conversion
  // cannot masquerade as an engine change or require rewriting source files.
  execFileSync('git', ['diff', '--quiet', baseline.productSha, '--', ...baseline.files.map(file => file.path)], { cwd: root, stdio: 'ignore' });
  let fetchImpl = globalThis.fetch;
  if (fixtureRoot) {
    const dbRoot = fs.realpathSync(fixtureRoot), prefix = registry.manifestUrl.slice(0, registry.manifestUrl.lastIndexOf('/') + 1);
    fetchImpl = async url => {
      if (!String(url).startsWith(prefix)) throw Error('Unexpected immutable database URL');
      const relative = decodeURIComponent(String(url).slice(prefix.length));
      const file = path.resolve(dbRoot, relative);
      if (!within(real(dbRoot), real(file))) throw Error('Database path escaped its snapshot');
      const bytes = fs.readFileSync(file);
      return { ok: true, status: 200, text: async () => bytes.toString('utf8') };
    };
  }
  source.clear();
  const references = await source.getVisionReferences('cyberpunk', 'en', { fetchImpl });
  const context = { productSha, databaseSha: '56402636a77af9c8b5dc4e3b61c509a185f3c834', gameId: 'cyberpunk-tcg', locale: 'en', referenceCount: 229, references };
  const checked = harness.validateContext(context);
  if (!checked.valid) throw Error('Invalid authentic corpus: ' + checked.errors.join(', '));
  const plan = { ...sample.plan, sample: sample.sample };
  let session = { context, plan, trials: [], scenes: [], indexMeasurements: [], environment: { execution: 'LOCAL_TEST' } };
  let declarationKey = null;
  for (const inputFile of args.inputs) {
    const captured = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
    if (captured.context?.productSha !== productSha || captured.context?.databaseSha !== context.databaseSha || captured.context?.locale !== 'en' || captured.context?.referenceCount !== 229 || !['cyberpunk', 'cyberpunk-tcg'].includes(captured.context?.gameId)) throw Error('Session does not match this exact product/corpus');
    if (captured.environment?.execution === 'AUTOMATED' && [...(captured.trials || []), ...(captured.scenes || [])].some(value => value?.provenance === 'physical')) throw Error('An automated session cannot supply physical evidence');
    const declarations = { substitutions: captured.plan?.substitutions || [], variantAvailability: captured.plan?.variantAvailability || [],
      sleeveAvailability: captured.plan?.sleeveAvailability || null, sleeveSkipReason: captured.plan?.sleeveSkipReason || null };
    const nextKey = harness.stableStringify(declarations);
    if (declarationKey !== null && nextKey !== declarationKey) throw Error('Sessions have conflicting predeclared availability/substitutions');
    declarationKey = nextKey;
    // The caller cannot replace the reference corpus or weaken the trial plan.
    session = { context, plan: { ...plan, ...declarations }, environment: captured.environment || {},
      trials: [...session.trials, ...(captured.trials || [])], scenes: [...session.scenes, ...(captured.scenes || [])],
      indexMeasurements: [...session.indexMeasurements, ...(captured.indexMeasurements || [])] };
  }
  for (const inputFile of args.indexes) {
    const measurements = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
    if (!Array.isArray(measurements.indexMeasurements)) throw Error('Index measurement array required');
    const measuredContext = measurements.context || measurements;
    if (measuredContext.productSha !== productSha || measuredContext.databaseSha !== context.databaseSha || measuredContext.referenceCount !== 229 || measuredContext.locale !== 'en' || !['cyberpunk', 'cyberpunk-tcg'].includes(measuredContext.gameId)) throw Error('Index measurements do not match this exact product/corpus');
    session.indexMeasurements = [...(session.indexMeasurements || []), ...measurements.indexMeasurements];
  }
  if (args['validation-receipt']) {
    const receipt = JSON.parse(fs.readFileSync(args['validation-receipt'], 'utf8'));
    if (receipt.sha !== productSha || !['RUNNING', 'PASS'].includes(receipt.status)) throw Error('Wrong automated validation receipt');
    for (const file of ['vision-qualification-1.0-test.js', 'vision-qualification-1.0-browser-test.js']) {
      const suite = receipt.suites.find(value => value.name === file);
      const manifest = receipt.manifest.find(value => value.file === file);
      const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
      if (!suite || suite.exit !== 0 || suite.error || suite.signal || manifest?.sha256 !== hash) throw Error('Harness validation not completed for frozen source');
    }
    session.automatedHarnessValidation = 'PASS';
  }
  const report = harness.buildReport(session);
  const bytes = harness.stableStringify(report);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, bytes, { flag: 'wx' });
  console.log(JSON.stringify({ output, productSha, json: 'VALID', sha256: crypto.createHash('sha256').update(bytes).digest('hex'), engine: 'UNCHANGED', trialCount: report.trials?.length || 0, verdict: report.verdict, physicalQualification: report.physicalQualification }, null, 2));
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { main };
