'use strict';

// Real Chrome import boundary. Browser DB requests are always intercepted.
// Supply TCGATE_DB_FIXTURE_ROOT for a fully local run; otherwise Node preloads
// the seven pinned public runtime documents before starting the browser.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.WORKSPACE_PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(process.env.TCGATE_TEST_REPO || __dirname);
const fixtureRoot = process.env.TCGATE_DB_FIXTURE_ROOT ? path.resolve(process.env.TCGATE_DB_FIXTURE_ROOT) : null;
const manifestUrl = 'https://raw.githubusercontent.com/maximelaburthe-commits/tcgate_db_cyberpunk/56402636a77af9c8b5dc4e3b61c509a185f3c834/manifest.json';
const fixturePrefix = manifestUrl.slice(0, manifestUrl.lastIndexOf('/') + 1);
const scriptFiles = new Set(['/game-databases.js', '/database-source.js', '/database-locale-core.js']);
const withoutLocale = input => input.map(({ locale, ...rest }) => rest);

async function preloadFixture() {
  const documents = new Map();
  async function read(relative) {
    assert.equal(typeof relative, 'string', 'Declared runtime fixture path is a string');
    assert(relative && !relative.includes('\\') && !relative.split('/').some(part => !part || part === '.' || part === '..'), 'Runtime fixture path stays inside the pinned DB');
    let body;
    if (fixtureRoot) body = fs.readFileSync(path.join(fixtureRoot, relative));
    else {
      const response = await fetch(fixturePrefix + relative, { cache: 'no-cache', credentials: 'omit' });
      assert.equal(response.status, 200, 'Public pinned DB HTTP 200: ' + relative);
      body = Buffer.from(await response.arrayBuffer());
    }
    const json = JSON.parse(body.toString('utf8'));
    documents.set(relative, body);
    return json;
  }
  const manifest = await read('manifest.json');
  await Promise.all([manifest.database_manifest, manifest.entrypoint || manifest.runtime_cards, manifest.runtime_printings, manifest.canonical_vision_index, manifest.printing_recognition_index, manifest.recognition_groups].map(read));
  assert.equal(documents.size, 7, 'Seven production runtime documents preloaded');
  return { documents, manifest };
}

async function main() {
  const { documents, manifest: fixtureManifest } = await preloadFixture();
  assert.equal(fixtureManifest.database_version, '1.1.0', 'Use the production runtime fixture');
  const served = [];
  const server = http.createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    served.push(pathname);
    if (pathname === '/') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      response.end('<!doctype html><html><head><meta charset="utf-8"><title>Locale Core import boundary</title></head><body><script src="/game-databases.js"></script><script src="/database-source.js"></script></body></html>');
      return;
    }
    if (!scriptFiles.has(pathname)) { response.writeHead(404); response.end('Not found'); return; }
    try {
      const source = fs.readFileSync(path.join(root, 'public', pathname.slice(1)));
      response.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' });
      response.end(source);
    } catch (error) { response.writeHead(500); response.end(error.message); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const origin = 'http://127.0.0.1:' + server.address().port;
  let browser;
  const requests = [], rawRequests = [], blocked = [], errors = [];
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const context = await browser.newContext();
    await context.route('**/*', async route => {
      const request = route.request(), url = request.url();
      requests.push({ url, method: request.method(), resourceType: request.resourceType() });
      if (url.startsWith(origin + '/')) return route.continue();
      if (url.startsWith(fixturePrefix)) {
        rawRequests.push(url);
        const relative = decodeURIComponent(url.slice(fixturePrefix.length));
        assert.equal(request.method(), 'GET', 'DB accesses are read-only');
        assert(documents.has(relative), 'Intercepted DB request matches a declared fixture document: ' + relative);
        return route.fulfill({ status: 200, body: documents.get(relative), contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } });
      }
      blocked.push(url);
      return route.abort('blockedbyclient');
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin + '/', { waitUntil: 'load' });
    assert.equal(await page.evaluate(() => typeof window.TCGateDatabaseLocaleCore), 'undefined', 'Core is absent before active DB load');
    assert.equal(served.filter(file => file === '/database-locale-core.js').length, 0, 'Page loads only the two pre-existing dependencies');
    const active = await page.evaluate(async () => {
      window.__activeLocaleTest = await window.TCGateDatabaseSource.load('cyberpunk');
      const db = window.__activeLocaleTest;
      window.__activeLocaleBefore = JSON.stringify({ manifest: db.manifest, cards: db.cards, printings: db.printings, references: db.references, recognitionGroups: db.recognitionGroups });
      return { cards: db.cards, printings: db.printings, references: db.references, groups: db.recognitionGroups.length, frozen: Object.isFrozen(db) && Object.isFrozen(db.references), core: typeof window.TCGateDatabaseLocaleCore };
    });
    assert.equal(active.cards.length, 150, 'Active canonical count');
    assert.equal(active.printings.length, 229, 'Active printing count');
    assert.equal(active.references.length, 229, 'Active matcher reference count');
    assert.equal(active.groups, 150, 'Active recognition group count');
    assert.equal(active.references.filter(reference => reference.recognitionMode === 'exact').length, 83, 'Active exact references');
    assert.equal(active.references.filter(reference => reference.recognitionMode === 'shared').length, 146, 'Active shared references');
    assert(active.references.filter(reference => reference.recognitionMode === 'shared').every(reference => reference.printingId === null), 'Shared recognition keeps its nullable printing identity');
    assert.equal(active.frozen, true, 'Active view remains frozen');
    assert.equal(active.core, 'undefined', 'Active DB load does not import Locale Core');
    assert.equal(rawRequests.length, 7, 'Active load uses exactly the historical seven DB requests');
    assert.equal(served.filter(file => file === '/database-locale-core.js').length, 0, 'Active matcher does not import Locale Core');
    const view = await page.evaluate(async () => {
      window.__localeViewTest = await window.TCGateDatabaseSource.getLocaleDatabase('cyberpunk');
      const db = window.__localeViewTest;
      return { descriptor: db.descriptor, cards: db.cards, printings: db.printings, references: db.getVisionReferences('en'), core: typeof window.TCGateDatabaseLocaleCore, frozen: Object.isFrozen(db) && Object.isFrozen(db.descriptor) && Object.isFrozen(db.printings) && db.printings.every(Object.isFrozen), copied: db.printings !== window.__activeLocaleTest.printings && db.printings.every((printing, index) => printing !== window.__activeLocaleTest.printings[index]) };
    });
    assert.equal(view.core, 'object', 'Opt-in locale API imports the real Core script');
    assert.equal(served.filter(file => file === '/database-locale-core.js').length, 1, 'Core imported exactly once on first locale request');
    assert.equal(view.descriptor.gameId, 'cyberpunk-tcg', 'Descriptor exposes canonical gameId');
    assert.equal(view.descriptor.databaseVersion, '1.1.0', 'Descriptor preserves production database version');
    assert.deepEqual(Object.keys(view.descriptor.locales), ['en'], 'Only historical EN is declared active');
    assert.deepEqual(view.descriptor.visionReadyLocales, ['en'], 'Only EN is Vision ready');
    assert.equal(view.descriptor.defaultLocale, 'en', 'EN is compatibility metadata');
    assert.equal(view.descriptor.locales.en.dataReady, true, 'Historical EN data readiness');
    assert.equal(view.descriptor.locales.en.visionReady, true, 'Qualified historical EN corpus readiness');
    assert.equal(view.frozen, true, 'Locale projections are frozen');
    assert.equal(view.copied, true, 'Locale normalization owns copies of active printings');
    assert(view.printings.every(printing => printing.locale === 'en'), 'Normalized printings are all EN');
    assert(view.references.every(reference => reference.locale === 'en'), 'EN corpus references are explicitly localized');
    assert.deepEqual(view.cards, active.cards, 'Canonical cards remain language independent');
    assert.deepEqual(withoutLocale(view.printings), withoutLocale(active.printings), 'Printing identities and source metadata are unchanged');
    assert.deepEqual(withoutLocale(view.references), withoutLocale(active.references), 'The EN projection preserves the complete active Vision corpus');
    const en = await page.evaluate(() => window.TCGateDatabaseSource.getVisionReferences('cyberpunk', 'en'));
    assert.equal(en.length, 229, 'Public runtime API returns 229 EN references');
    assert.deepEqual(en, view.references, 'Public runtime API and view return the same corpus');
    const aliases = await page.evaluate(async () => ({ same: (await window.TCGateDatabaseSource.getLocaleDatabase('cyberpunk-tcg')) === window.__localeViewTest, references: await window.TCGateDatabaseSource.getVisionReferences('cyberpunk-tcg', 'en') }));
    assert.equal(aliases.same, true, 'Canonical gameId and runtime alias share the cached locale view');
    assert.deepEqual(aliases.references, en, 'Canonical gameId exposes the same EN references');
    for (const locale of ['fr', '', 'toString', '__proto__', 'constructor']) {
      const outcome = await page.evaluate(async locale => {
        try { await window.TCGateDatabaseSource.getVisionReferences('cyberpunk', locale); return { rejected: false }; }
        catch (error) { return { rejected: true, message: error.message }; }
      }, locale);
      assert.equal(outcome.rejected, true, 'Unknown/empty/prototype locale is rejected: ' + JSON.stringify(locale));
      assert.equal(typeof outcome.message, 'string', 'Locale rejection explains the error');
    }
    const unchanged = await page.evaluate(async () => {
      const db = await window.TCGateDatabaseSource.load('cyberpunk');
      return { cached: db === window.__activeLocaleTest, sameSnapshot: JSON.stringify({ manifest: db.manifest, cards: db.cards, printings: db.printings, references: db.references, recognitionGroups: db.recognitionGroups }) === window.__activeLocaleBefore, legacyLocaleKeys: db.printings.map(printing => Object.prototype.hasOwnProperty.call(printing, 'locale')) };
    });
    assert.equal(unchanged.cached, true, 'Legacy active DB retains the same cached object');
    assert.equal(unchanged.sameSnapshot, true, 'Every active DB value is unchanged after locale queries');
    assert.deepEqual(unchanged.legacyLocaleKeys, active.printings.map(printing => Object.prototype.hasOwnProperty.call(printing, 'locale')), 'New locale properties never leak into active printings');
    assert.equal(rawRequests.length, 7, 'Views, aliases, invalid locales and cache reload issue no additional data fetch');
    assert.equal(new Set(rawRequests).size, 7, 'Each runtime document is requested exactly once');
    assert.equal(served.filter(file => file === '/database-locale-core.js').length, 1, 'Repeated views and invalid locales do not reload Core');
    assert(requests.every(request => request.method === 'GET'), 'The test and runtime issue GET requests only');
    assert.deepEqual(blocked, [], 'No unexpected remote service is contacted');
    assert.deepEqual(errors, [], 'No browser JavaScript error');
    console.log('DATABASE_LOCALE_CORE_BROWSER_OK · real Chrome lazy import · 150 canonical / 229 EN / 83 exact / 146 shared · 7 fixture data requests · active corpus unchanged');
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
