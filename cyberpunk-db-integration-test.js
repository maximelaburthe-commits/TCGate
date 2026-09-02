'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { createDbGateway, GAME_DATABASES, TOKEN_ENV_NAME, safeRepoPath } = require('./db-gateway');
const gameDatabases = require('./public/game-databases.js');
const databaseSource = require('./public/database-source.js');

const EXPECTED_REF = '6816051a87ca97cf07096b1a7d98a24a058eeac7';
const DB_ROOT = process.env.TCGATE_DB_FIXTURE_ROOT || path.resolve(__dirname, '..', 'tcgate_db_cyberpunk');

function syntheticFixture() {
  const cards = Array.from({ length: 150 }, (_, index) => ({
    cardId: `card-${index}`,
    name: `Card ${index}`,
    type: 'Unit',
    rulesText: `Rules ${index}`
  }));
  const references = Array.from({ length: 444 }, (_, index) => ({
    refId: `ref-${index}`,
    printingId: `printing-${index}`,
    cardId: `card-${index % 150}`,
    variantKind: index === 1 ? 'iconic' : 'standard',
    recognition: { eligible: true, mode: 'exact' },
    visionAssetPath: `assets/vision/printing-${index}.webp`,
    displayAssetPath: `assets/display/printing-${index}.webp`
  }));
  return {
    'manifest.json': {
      game_id: 'cyberpunk-tcg', database_version: '1.0.0', database_manifest: 'db-manifest.json',
      entrypoint: 'runtime/cards.min.json', visionIndex: 'runtime/vision-index.json'
    },
    'db-manifest.json': { game: { id: 'cyberpunk-tcg' }, databaseVersion: '1.0.0', status: 'production-reviewed' },
    'runtime/cards.min.json': cards,
    'runtime/vision-index.json': references
  };
}

function diskFixtureOrSynthetic() {
  if (!fs.existsSync(path.join(DB_ROOT, 'manifest.json'))) return { data: syntheticFixture(), real: false };
  const read = relative => JSON.parse(fs.readFileSync(path.join(DB_ROOT, relative), 'utf8'));
  return {
    real: true,
    data: {
      'manifest.json': read('manifest.json'),
      'db-manifest.json': read('db-manifest.json'),
      'runtime/cards.min.json': read('runtime/cards.min.json'),
      'runtime/vision-index.json': read('runtime/vision-index.json')
    }
  };
}

function fixtureFetch(data, counters, behavior = {}) {
  return async (url, options = {}) => {
    counters.requests += 1;
    counters.authorization.push(options.headers?.Authorization || null);
    if (behavior.timeout) return new Promise((resolve, reject) => options.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
    if (behavior.status) return new Response('not found', { status: behavior.status });
    const marker = `/${EXPECTED_REF}/`;
    const relative = String(url).split(marker)[1];
    if (relative?.startsWith('assets/')) return new Response(Buffer.from('RIFFtestWEBP'), { status: 200, headers: { 'content-type': 'image/webp' } });
    const payload = data[relative];
    if (payload == null) return new Response('not found', { status: 404 });
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } });
  };
}

function mockResponse() {
  return {
    status: null, headers: null, body: null,
    writeHead(status, headers) { this.status = status; this.headers = headers; },
    end(body) { this.body = body ? Buffer.from(body) : Buffer.alloc(0); }
  };
}

async function run() {
  const fixture = diskFixtureOrSynthetic();
  const counters = { requests: 0, authorization: [] };
  const liveBehavior = {};
  const logs = [];
  const secret = 'test-secret-must-never-leak';
  const gateway = createDbGateway({
    env: { [TOKEN_ENV_NAME]: secret },
    fetchImpl: fixtureFetch(fixture.data, counters, liveBehavior),
    logger: { warn: message => logs.push(message) }
  });

  assert.strictEqual(GAME_DATABASES.cyberpunk.ref, EXPECTED_REF, 'validated DB commit must be pinned');
  assert.strictEqual(safeRepoPath('../secret'), null, 'traversal must be rejected');
  assert.strictEqual(safeRepoPath('https://evil.test/a'), null, 'arbitrary URL must be rejected');

  const database = await gateway.load('cyberpunk');
  assert.strictEqual(database.manifest.databaseVersion, '1.0.0');
  assert.strictEqual(database.manifest.databaseStatus, 'production-reviewed');
  assert.strictEqual(database.cards.length, 150, '150 canonical cards');
  assert.strictEqual(database.references.length, 444, '444 Vision references');
  assert.strictEqual(new Set(database.cards.map(card => card.cardId)).size, 150, 'unique cardIds');
  assert.strictEqual(new Set(database.references.map(reference => reference.printingId)).size, 444, 'unique printingIds');
  assert(database.references.every(reference => database.cardsById.has(reference.cardId)), 'no orphan reference');
  assert(database.references.every(reference => reference.imageUrl.startsWith('/api/db/cyberpunk/assets/')), 'Vision assets are same-origin');
  assert(database.references.every(reference => reference.displayImageUrl.startsWith('/api/db/cyberpunk/assets/')), 'display assets are same-origin');
  const referencesPerCard = new Map();
  for (const reference of database.references) referencesPerCard.set(reference.cardId, (referencesPerCard.get(reference.cardId) || 0) + 1);
  assert([...referencesPerCard.values()].some(count => count > 1), 'one canonical card retains multiple printings');
  if (fixture.real) {
    const rawReferences = fixture.data['runtime/vision-index.json'];
    assert(rawReferences.every(reference => fs.existsSync(path.join(DB_ROOT, reference.visionAssetPath))), 'all 444 Vision assets exist');
    assert(rawReferences.every(reference => fs.existsSync(path.join(DB_ROOT, reference.displayAssetPath))), 'all 444 display assets exist');
  }

  const iconic = database.references.find(reference => reference.variantKind === 'iconic');
  assert(iconic, 'Iconic fixture is present');
  assert.notStrictEqual(iconic.imageUrl, iconic.displayImageUrl, 'Iconic display route is distinct from descriptor route');
  assert(iconic.displayImageUrl.includes(iconic.printingId), 'Iconic display retains its printingId');

  const requestCount = counters.requests;
  assert.strictEqual(await gateway.load('cyberpunk'), database, 'session cache returns last-known-good object');
  assert.strictEqual(counters.requests, requestCount, 'session cache avoids GitHub refetch');
  liveBehavior.status = 404;
  assert.strictEqual(await gateway.load('cyberpunk', { force: true }), database, 'GitHub failure retains last-known-good');
  delete liveBehavior.status;
  await gateway.getAsset('cyberpunk', iconic.printingId, 'display');
  const afterFirstAsset = counters.requests;
  await gateway.getAsset('cyberpunk', iconic.printingId, 'display');
  assert.strictEqual(counters.requests, afterFirstAsset, 'asset cache avoids GitHub refetch');

  const manifestRes = mockResponse();
  await gateway.handle({ method: 'GET' }, manifestRes, '/api/db/cyberpunk/manifest');
  const manifestBody = manifestRes.body.toString('utf8');
  assert.strictEqual(manifestRes.status, 200);
  assert(!manifestBody.includes(secret), 'token absent from API response');
  assert(!logs.join('\n').includes(secret), 'token absent from logs');
  assert(counters.authorization.every(value => value === `Bearer ${secret}`), 'token used server-side only');

  const unknownGameRes = mockResponse();
  await gateway.handle({ method: 'GET' }, unknownGameRes, '/api/db/unknown/manifest');
  assert.strictEqual(unknownGameRes.status, 404, 'unknown game rejected');
  const unknownAssetRes = mockResponse();
  await gateway.handle({ method: 'GET' }, unknownAssetRes, '/api/db/cyberpunk/assets/not-known/display');
  assert.strictEqual(unknownAssetRes.status, 404, 'unknown asset rejected');

  for (const behavior of [{ status: 404 }, { timeout: true }]) {
    const failed = createDbGateway({
      env: { [TOKEN_ENV_NAME]: secret }, timeoutMs: 5,
      fetchImpl: fixtureFetch(fixture.data, { requests: 0, authorization: [] }, behavior),
      logger: { warn: message => logs.push(message) }
    });
    await assert.rejects(failed.load('cyberpunk'), 'GitHub failure must activate client fallback path');
  }

  const invalidData = syntheticFixture();
  invalidData['db-manifest.json'] = { ...invalidData['db-manifest.json'], status: 'draft' };
  const invalid = createDbGateway({ env: { [TOKEN_ENV_NAME]: secret }, fetchImpl: fixtureFetch(invalidData, { requests: 0, authorization: [] }), logger: { warn() {} } });
  await assert.rejects(invalid.load('cyberpunk'), /database-status-not-reviewed/, 'invalid manifest rejected');

  const missingToken = createDbGateway({ env: {}, fetchImpl: fixtureFetch(fixture.data, { requests: 0, authorization: [] }), logger: { warn() {} } });
  await assert.rejects(missingToken.load('cyberpunk'), /github-token-missing/, 'missing token activates fallback');

  databaseSource.clear();
  const browserPayloads = new Map([
    ['/api/db/cyberpunk/manifest', database.manifest],
    ['/api/db/cyberpunk/cards', database.cards],
    ['/api/db/cyberpunk/vision-index', database.references]
  ]);
  let browserRequests = 0;
  const browserFetch = async url => {
    browserRequests += 1;
    return new Response(JSON.stringify(browserPayloads.get(url)), { status: browserPayloads.has(url) ? 200 : 404 });
  };
  const browserDatabase = await databaseSource.load('cyberpunk', { fetchImpl: browserFetch });
  assert.strictEqual(browserDatabase.cardsById.size, 150);
  assert.strictEqual(browserDatabase.references.length, 444);
  await databaseSource.load('cyberpunk', { fetchImpl: browserFetch });
  assert.strictEqual(browserRequests, 3, 'browser session cache avoids API refetch');
  assert.strictEqual(gameDatabases.get('no-game'), null, 'no-game has no Cyberpunk DB source');

  const publicFiles = ['public/app.js', 'public/database-source.js', 'public/game-databases.js', 'public/index.html'];
  for (const file of publicFiles) {
    const content = fs.readFileSync(path.join(__dirname, file), 'utf8');
    assert(!content.includes(TOKEN_ENV_NAME), `${TOKEN_ENV_NAME} absent from ${file}`);
    assert(!content.includes(secret), `token value absent from ${file}`);
  }
  const appSource = fs.readFileSync(path.join(__dirname, 'public/app.js'), 'utf8');
  assert(appSource.indexOf("'/database-source.js'") < appSource.indexOf("'/identification.js'"), 'DB source loads before identification');
  assert(/function visionEnabledForCurrentGame\(\)\s*\{\s*return state\.game === 'cyberpunk';\s*\}/.test(appSource), 'no-game does not load Cyberpunk Vision');
  const serverSource = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
  assert(serverSource.includes("require('./db-gateway')"), 'server wires the private DB gateway');

  const criticalHashes = {
    'public/detection-worker.js': '19d0e72eeb620f23742a9b8fe321f700c45cbd29ad41b952d115bca5fd983227',
    'public/identification-worker.js': '306eafe4decdCCE26287683bc581cd8ca24a0c2f58cd299873b093942127a14a'.toLowerCase(),
    'models/card_detector_v53_512.onnx': '2db35aef3aceff955d7055180b3f21b33255920ab0a9a1fdcbb0e320a8276319'
  };
  for (const [file, expected] of Object.entries(criticalHashes)) {
    const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, file))).digest('hex');
    assert.strictEqual(actual, expected, `critical component changed: ${file}`);
  }

  console.log(`PASS cyberpunk-db-integration (${fixture.real ? 'real DB v1 fixture' : 'synthetic CI fixture'})`);
  console.log('150 canonical / 444 Vision refs / cache / fallback / security / Iconic display: OK');
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
