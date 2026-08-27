'use strict';

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const window = {};
const context = vm.createContext({ window });
for (const file of ['public/game-registry.js', 'public/database-adapter.js']) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
}

const registry = window.TCGateGameRegistry;
assert.strictEqual(registry.supports('cyberpunk', 'vision'), true);
assert.strictEqual(registry.runtimeReady('cyberpunk', 'vision'), true);
assert.strictEqual(registry.runtime('cyberpunk', 'vision'), 'cyberpunk');
assert.strictEqual(registry.supports('cyberpunk', 'gigDice'), true);
assert.strictEqual(registry.supports('star-wars-unlimited', 'vision'), true);
assert.strictEqual(registry.runtimeReady('star-wars-unlimited', 'vision'), false);
assert.strictEqual(registry.runtime('star-wars-unlimited', 'vision'), null);
assert.strictEqual(registry.supports('star-wars-unlimited', 'gigDice'), false);
assert.strictEqual(registry.get('star-wars-unlimited').exposed, false);
assert.strictEqual(registry.supports('no-game', 'vision'), false);
assert.strictEqual(registry.runtimeReady('no-game', 'vision'), false);
assert.strictEqual(registry.supports('no-game', 'gigDice'), false);
assert.deepStrictEqual(Array.from(registry.exposed(), game => game.id), ['cyberpunk', 'no-game']);

const html = fs.readFileSync('public/index.html', 'utf8');
assert(!html.includes('<option value="star-wars-unlimited"'), 'SWU must remain hidden from the UI');
assert(html.indexOf('/game-registry.js') < html.indexOf('/app.js'), 'Registry must load before the Core');
assert(html.indexOf('/database-adapter.js') < html.indexOf('/app.js'), 'Adapter must load before the Core');

const app = fs.readFileSync('public/app.js', 'utf8');
const visionGuard = app.match(/function visionEnabledForCurrentGame\(\)\s*\{([\s\S]*?)\n\}/)?.[1] || '';
assert(visionGuard.includes("supports(state.game, 'vision')"), 'Vision support capability guard missing');
assert(visionGuard.includes("runtimeReady(state.game, 'vision')"), 'Vision runtime readiness guard missing');
const roomVisionInit = app.match(/function applyRoomState\(snapshot\)\s*\{([\s\S]*?)\n\}/)?.[1] || '';
assert(roomVisionInit.includes('if(opponent && visionEnabledForCurrentGame())'), 'Room Vision initialization must use the runtime guard');

const cyberpunkManifest = {
  manifest_version: '1.0.0', game_id: 'cyberpunk-tcg', database_version: '0.4.0',
  database_manifest: 'db-manifest.json', runtime_cards: 'runtime/cards.min.json',
  vision_index: 'runtime/vision-index.json', coverage: 'data/coverage.json'
};
const swuManifest = {
  schemaVersion: 1, game: 'star-wars-unlimited', name: 'Star Wars: Unlimited',
  databaseVersion: '0.2.1', status: 'build-from-complete-source',
  entrypoint: 'runtime/cards.min.json', visionIndex: 'runtime/vision-index.json', source: 'SWU API full export'
};
const fixtures = new Map([
  ['https://example.test/cyberpunk/manifest.json', cyberpunkManifest],
  ['https://example.test/cyberpunk/runtime/cards.min.json', [{
    id: 'cp-adam-smasher-ender-of-legends', name: 'Adam Smasher — Ender of Legends', type: 'Legend',
    catalog_number: 'WNTC-001', primary_printing_key: 'wtnc-retail:001'
  }]],
  ['https://example.test/cyberpunk/runtime/vision-index.json', [{
    printing_id: 'cpp-fedb842e7045d811', card_id: 'cp-yorinobu-arasaka-embracing-destruction',
    set_id: 'embracing-power-retail', number: '001', image_url: 'https://punksim.net/images/EP-001.png'
  }]],
  ['https://example.test/swu/manifest.json', swuManifest],
  ['https://example.test/swu/runtime/cards.min.json', [{
    id: 'swu-0-0-0-translation-and-torture-unit-3b9c98097088', name: '0-0-0',
    subtitle: 'Translation and Torture', type: 'Unit'
  }]],
  ['https://example.test/swu/runtime/vision-index.json', [{
    id: 'swup-019e6d32-cd99-7768-9d34-75feb5d58bfe:front',
    cardId: 'swu-luke-skywalker-i-can-save-him-leader-d2c9df126296',
    printingId: 'swup-019e6d32-cd99-7768-9d34-75feb5d58bfe', side: 'front',
    imageUrl: 'https://cdn.starwarsunlimited.com/card_08010005_EN_Luke_Skywalker_Leader_6431bba672.png'
  }]]
]);
const requested = [];
const fetch = async url => {
  requested.push(url);
  const body = fixtures.get(url);
  return body ? { ok: true, json: async () => body } : { ok: false, status: 404 };
};

(async () => {
  const cyberpunk = await window.TCGateDatabaseAdapter.load('cyberpunk', {
    fetch, baseUrl: 'https://example.test/cyberpunk'
  });
  assert.deepStrictEqual(requested.slice(0, 3), [
    'https://example.test/cyberpunk/manifest.json',
    'https://example.test/cyberpunk/runtime/cards.min.json',
    'https://example.test/cyberpunk/runtime/vision-index.json'
  ]);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(cyberpunk.cards[0])), {
    id: 'cp-adam-smasher-ender-of-legends', name: 'Adam Smasher — Ender of Legends', subtitle: '',
    type: 'Legend', set: 'WNTC', number: '001', catalogNumber: 'WNTC-001'
  });
  assert.strictEqual(cyberpunk.visionIndex[0].refId, 'cpp-fedb842e7045d811');
  assert.strictEqual(cyberpunk.visionIndex[0].printingId, 'cpp-fedb842e7045d811');

  const swu = await window.TCGateDatabaseAdapter.load('star-wars-unlimited', {
    fetch, baseUrl: 'https://example.test/swu'
  });
  assert.deepStrictEqual(requested.slice(3, 6), [
    'https://example.test/swu/manifest.json',
    'https://example.test/swu/runtime/cards.min.json',
    'https://example.test/swu/runtime/vision-index.json'
  ]);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(swu.cards[0])), {
    id: 'swu-0-0-0-translation-and-torture-unit-3b9c98097088', name: '0-0-0',
    subtitle: 'Translation and Torture', type: 'Unit', set: '', number: '', catalogNumber: ''
  });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(swu.visionIndex[0])), {
    refId: 'swup-019e6d32-cd99-7768-9d34-75feb5d58bfe:front',
    cardId: 'swu-luke-skywalker-i-can-save-him-leader-d2c9df126296',
    printingId: 'swup-019e6d32-cd99-7768-9d34-75feb5d58bfe', side: 'front',
    imageUrl: 'https://cdn.starwarsunlimited.com/card_08010005_EN_Luke_Skywalker_Leader_6431bba672.png'
  });

  const noGame = await window.TCGateDatabaseAdapter.load('no-game', { fetch });
  assert.strictEqual(noGame.database, null);
  assert.strictEqual(requested.length, 6, 'no-game must not load a database');

  const server = fs.readFileSync('server.js', 'utf8');
  const mailServer = fs.readFileSync('report-mail-server.js', 'utf8');
  assert(server.includes("new Set(['cyberpunk', 'star-wars-unlimited', 'no-game'])"));
  for (const source of [server, mailServer]) {
    const real = source.indexOf("headers['x-real-ip']");
    const forwarded = source.indexOf("headers['x-forwarded-for']", real);
    const fallback = source.indexOf('realIp || forwarded || remote', forwarded);
    assert(real >= 0 && forwarded > real && fallback > forwarded, 'IP fingerprint priority is incorrect');
  }
  console.log('MULTITCG_FOUNDATION_OK');
})().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
