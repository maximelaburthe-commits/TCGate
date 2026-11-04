'use strict';
// Source contracts and local HTTP only: no Railway access or outgoing email.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { builtinModules } = require('node:module');
const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const local = file => require(path.join(root, file));
let assertions = 0;
function check(value, label) { assert(value, label); assertions++; }
function equal(actual, expected, label) { assert.deepEqual(actual, expected, label); assertions++; }

function runtimeProblems(source, file) {
  const problems = [];
  const forbidden = ['CONTROL_CENTER_URL', 'CONTROL_CENTER_INGEST_KEY', 'TCGATE_CC_SYNC_TOKEN', 'TCGATE_REPORT_INBOX_DIR'];
  for (const token of forbidden) if (source.includes(token)) problems.push('retired environment name: ' + token);
  if (/\/api\/control-center(?:[/'"`?\s]|$)/i.test(source)) problems.push('retired Control Center route');
  if (/(?:require\s*\(\s*|from\s*|import\s*\(\s*|import\s*)['"][^'"]*(?:control[-_]center|controlCenter)[^'"]*['"]/i.test(source)) problems.push('Control Center import');
  if (/control-center-forwarder|persistInboxReport|ensureInbox|handleControlCenter/.test(source)) problems.push('retired forwarder/inbox');
  if (/TCGate-camera-phone|TCGate-Phone-Camera-Lab|Phone Camera Lab/i.test(source)) problems.push('Phone standalone dependency');
  if (/report-schema-v2-qualification|TCGate-report-schema-v2/i.test(source)) problems.push('legacy report qualification dependency');
  // A slash followed by "database" is not the /data mount; remote relative data/ is also valid.
  if (/(?:^|[\s'"`(=:,[{])\/data(?:[\\/]|(?=[\s'"`),;}?#\]]|$))/m.test(source)) problems.push('absolute /data mount');
  if (/\bRAILWAY_VOLUME\w*\b/.test(source)) problems.push('Railway volume variable');
  const fsImport = /(?:require\s*\(\s*['"](?:node:)?fs(?:\/promises)?['"]\s*\)|from\s*['"](?:node:)?fs(?:\/promises)?['"]|import\s*['"](?:node:)?fs(?:\/promises)?['"]|getBuiltinModule\s*\(\s*['"](?:node:)?fs)/g;
  if (file === 'server.js') {
    let remaining = source.replace(/const fs = require\('fs'\);/, '');
    if (remaining === source || fsImport.test(remaining)) problems.push('unexpected filesystem import or alias');
    for (const method of ['readFile', 'stat', 'createReadStream']) {
      const calls = new RegExp('\\bfs\\.' + method + '\\s*\\(', 'g');
      if ([...remaining.matchAll(calls)].length !== 1) problems.push('filesystem inventory changed: ' + method);
      remaining = remaining.replace(calls, 'READ_ONLY_FS_CALL(');
    }
    if (/\bfs\b/.test(remaining)) problems.push('filesystem operation/alias outside audited read-only calls');
  } else if (file === 'vision-nominal-qualification-compatibility.js') {
    // Only fixed, read-only deployment fingerprints are allowed in this helper.
    // The HTTP caller supplies __dirname; no request path or mutation is accepted.
    let remaining = source.replace(/const fs = require\('node:fs'\);/, '');
    if (remaining === source || fsImport.test(remaining)) problems.push('unexpected compatibility filesystem import or alias');
    for (const [method, count] of [['realpathSync', 2], ['readFileSync', 2], ['existsSync', 1]]) {
      const calls = new RegExp('\\bfs\\.' + method + '\\s*\\(', 'g');
      if ([...remaining.matchAll(calls)].length !== count) problems.push('compatibility read inventory changed: ' + method);
      remaining = remaining.replace(calls, 'AUDITED_READ_ONLY_CALL(');
    }
    if (/\bfs\b/.test(remaining)) problems.push('filesystem operation/alias outside compatibility reads');
  } else if (fsImport.test(source) || /\bfs\s*(?:\.|\[)/.test(source)) {
    problems.push('filesystem access outside audited server');
  }
  return problems;
}
function assertClean(source, file) {
  const problems = runtimeProblems(source, file);
  check(problems.length === 0, file + ': ' + problems.join('; '));
}
function negativeFixtures() {
  const cases = [
    "process.env.CONTROL_CENTER_URL",
    "process.env['CONTROL_CENTER_INGEST_KEY']",
    'const {TCGATE_CC_SYNC_TOKEN}=process.env;',
    'const {TCGATE_REPORT_INBOX_DIR: inbox}=process.env;',
    "require('./control-center-forwarder.js')",
    "import forwarder from './control-center.js';",
    "const route='/api/control-center/reports';",
    "const mount='/data/reports';",
    "const mount='/data';",
    'process.env.RAILWAY_VOLUME_MOUNT_PATH',
    "const disk=require('node:fs/promises'); disk.writeFile('/tmp/file','x');",
    "fs.appendFile('/tmp/file', 'x', () => {});",
    "fs.createWriteStream('/tmp/file');",
    "const phone='https://TCGate-camera-phone.example/phone';",
    "const report='https://example/report-schema-v2-qualification';"
  ];
  for (const source of cases) {
    assert.throws(() => assertClean(source, 'negative-fixture.js'), assert.AssertionError, source);
    assertions++;
  }
  const auditedServer = "const fs = require('fs'); fs.readFile(a,b); fs.stat(a,b); fs.createReadStream(a);";
  assertClean(auditedServer, 'server.js');
  for (const extra of ["fs.writeFile('/tmp/x','x');", 'const alias=fs;', "const disk=require('fs');", 'fs.promises.readFile(a);']) {
    assert.throws(() => assertClean(auditedServer + extra, 'server.js'), assert.AssertionError, extra);
    assertions++;
  }
  const proofHelper = read('vision-nominal-qualification-compatibility.js');
  assertClean(proofHelper, 'vision-nominal-qualification-compatibility.js');
  for (const extra of ["fs.writeFileSync('/tmp/x','x');", 'const alias=fs;', "require('node:fs/promises');", 'fs.promises.readFile(a);', 'fs.readFileSync(a);']) {
    assert.throws(() => assertClean(proofHelper + extra, 'vision-nominal-qualification-compatibility.js'), assert.AssertionError, extra);
    assertions++;
  }
  assertClean("const p='data/control-center-update-candidate.json'; const script='/database-source.js';", 'artifact-fixture.js');
}
function nodeRuntimeFiles(entry) {
  const files = new Map();
  const builtins = new Set(builtinModules.map(name => name.replace(/^node:/, '')));
  function visit(file) {
    const absolute = require.resolve(path.join(root, file));
    const relative = path.relative(root, absolute).split(path.sep).join('/');
    check(!relative.startsWith('../') && !path.isAbsolute(relative), 'Node import stays inside repository: ' + relative);
    if (files.has(relative)) return;
    check(relative.endsWith('.js'), 'Audited Node module is JavaScript: ' + relative);
    const source = fs.readFileSync(absolute, 'utf8');
    files.set(relative, source);
    const requireCalls = [...source.matchAll(/\brequire\s*\(\s*(['"])([^'"]+)\1\s*\)/g)];
    equal(requireCalls.length, [...source.matchAll(/\brequire\s*\(/g)].length, relative + ': no dynamic require outside audit');
    // This runtime is CommonJS. Refuse newly introduced module-loading forms until audited.
    check(!/\bimport\s*(?:\(|['"{*])|\bimport\s+[\w$]|\bexport\s+[^;]*\bfrom\s*['"]|\brequire\s*\.|\bgetBuiltinModule\s*\(/.test(source), relative + ': no unaudited import mechanism');
    for (const match of requireCalls) {
      const specifier = match[2];
      if (specifier.startsWith('.')) visit(path.join(path.dirname(relative), specifier));
      else check(builtins.has(specifier.replace(/^node:/, '')), relative + ': no unaudited external dependency ' + specifier);
    }
  }
  visit(entry);
  return files;
}
function publicFiles(directory = 'public') {
  return fs.readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    check(!entry.isSymbolicLink(), 'No unaudited runtime symlink: ' + file);
    return entry.isDirectory() ? publicFiles(file) : /\.(?:js|html)$/.test(entry.name) ? [file.split(path.sep).join('/')] : [];
  });
}
async function contracts() {
  negativeFixtures();
  const pkg = JSON.parse(read('package.json'));
  equal(pkg.scripts.start, 'node report-mail-server.js', 'Production entrypoint remains the email bridge');
  equal(Object.keys(pkg.dependencies || {}), [], 'No unaudited runtime npm dependency');
  equal(JSON.parse(read('railway.json')).deploy.startCommand, 'npm start', 'Railway uses audited entrypoint');
  const runtime = nodeRuntimeFiles('report-mail-server.js');
  for (const [file, source] of runtime) assertClean(source, file);
  const browser = publicFiles();
  for (const file of browser) assertClean(read(file), file);
  for (const file of ['START_WINDOWS.bat', 'START_WINDOWS_LOCAL.bat']) assertClean(read(file), file);
  const server = read('server.js'), bridge = read('report-mail-server.js');
  check(server.includes("path.join(__dirname, 'public')") && server.includes("path.join(__dirname, 'models', 'card_detector_v53_512.onnx')"), 'Filesystem reads target delivered public/model assets');
  check(bridge.includes("'https://api.resend.com/emails'") && bridge.includes('RESEND_API_KEY') && bridge.includes('TCGATE_REPORT_TO_EMAIL') && bridge.includes('TCGATE_REPORT_FROM_EMAIL'), 'Resend remains the report transport');
  for (const file of ['REPORT_SCHEMA_V2.md', 'report-schema-v2-test.js', 'fixtures/report-v2-redacted.json', 'public/report-diagnostics-v2.js', 'public/report-mail-ui.js', 'public/phone.html', 'public/phone-camera.js', 'public/phone-camera-client.js', 'public/phone-camera-privacy.js', 'public/phone-camera-control.js']) check(read(file).length > 0, file + ' preserved');
  equal(JSON.parse(read('fixtures/report-v2-redacted.json')).reportSchemaVersion, 2, 'Redacted Report V2 fixture');
  const report = await local('public/report-diagnostics-v2.js').build({ session: { game: 'none' }, environment: {} });
  equal(report.reportSchemaVersion, 2, 'Report Schema V2 build remains operational');
  equal(report.privacy.userJourneyCollected, false, 'Report privacy contract remains present');
  const html = read('public/index.html'), phone = read('public/phone.html'), ux = read('public/future-ux-v3.7.js');
  check(html.includes('/report-diagnostics-v2.js') && html.indexOf('/report-diagnostics-v2.js') < html.indexOf('/app.js'), 'Report diagnostics loaded before app');
  check(html.includes('/report-mail-ui.js') && html.includes('/phone-camera.js') && phone.includes('/phone-camera-client.js'), 'Integrated Phone and mail frontend loaded');
  check(server.includes("pathname === '/phone'") && server.includes("pathname === '/api/phone/pairs'"), 'Integrated Phone routes retained');
  const registry = local('public/game-databases.js');
  equal(Object.keys(registry.databases), ['cyberpunk'], 'Only Cyberpunk configured for production');
  check(registry.get('cyberpunk').manifestUrl.includes('/tcgate_db_cyberpunk/56402636a77af9c8b5dc4e3b61c509a185f3c834/manifest.json'), 'Cyberpunk qualified immutable source retained');
  equal(registry.get('cyberpunk').expectedVersion, '1.1.0', 'Cyberpunk qualified version retained');
  equal(registry.get('swu'), null, 'SWU is not enabled in production');
  equal(registry.get('star-wars-unlimited'), null, 'No alternate SWU production key');
  const games = /const ALLOWED_GAMES = new Set\((\[[^\]]+\])\)/.exec(server);
  check(Boolean(games), 'Server allowed game inventory found');
  equal(JSON.parse(games[1].replace(/'/g, '"')), ['cyberpunk', 'no-game'], 'No production SWU room');
  const ui = local('tcgate-ui-1.2-contract.js');
  ui.assertHome(html); assertions++;
  ui.assertGame(html, ux); assertions++;
  const lobby = ui.section(html, 'screenLobby');
  for (const page of ['session', 'installation', 'players']) check(lobby.includes('data-lobby-page="' + page + '"'), 'UI 1.2 Lobby tab ' + page);
  return { nodeModules: runtime.size, browserFiles: browser.length };
}
async function localHttp() {
  const fixture = await local('report-email-bridge-fixture.js').startBridgeFixture({ root });
  try {
    for (const route of ['/api/control-center/status', '/api/control-center/reports', '/api/control-center/reports/' + 'a'.repeat(40), '/api/control-center/unknown']) {
      const response = await fetch(fixture.origin + route);
      equal(response.status, 404, route + ' unavailable');
      await response.arrayBuffer();
    }
    let response = await fetch(fixture.origin + '/phone');
    equal(response.status, 200, 'Integrated Phone HTTP page');
    check((await response.text()).includes('/phone-camera-client.js'), 'Phone page loads integrated client');
    response = await fetch(fixture.origin + '/api/health');
    equal(response.status, 200, 'Health HTTP route');
    equal((await response.json()).ok, true, 'Healthy local runtime');
    response = await fetch(fixture.origin + '/api/report-email/status');
    equal(response.status, 200, 'Report email HTTP status');
    equal(await response.json(), { ok: true, configured: true }, 'Fixture Resend configuration');
    equal(fixture.requests.length, 0, 'No email sent even to the local Resend mock');
  } finally { await fixture.close(); }
}
(async () => {
  const inventory = await contracts();
  const http = process.env.TCGATE_HYGIENE_SKIP_HTTP !== '1';
  if (http) await localHttp();
  console.log('PROJECT_HYGIENE_1_2D_OK · ' + assertions + ' assertions · ' + inventory.nodeModules + ' Node modules · ' + inventory.browserFiles + ' public JS/HTML files · local HTTP ' + (http ? 'PASS' : 'SKIPPED'));
  console.log('TCGate persistent volume requirement: NONE (audited runtime source; no Railway resource inspected)');
})().catch(error => { console.error(error); process.exitCode = 1; });
