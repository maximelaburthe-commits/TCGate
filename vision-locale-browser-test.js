'use strict';
// Real local Room/SSE/WebRTC, synthetic Chromium A/V, the pinned 229 authentic
// EN assets, and an explicitly test-only bilingual database. No FR qualification.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.WORKSPACE_PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(process.env.VISION_LOCALE_TEST_ROOT || process.cwd());
const { startBridgeFixture } = require(path.join(root, 'report-email-bridge-fixture.js'));
const prefix = 'https://raw.githubusercontent.com/maximelaburthe-commits/tcgate_db_cyberpunk/56402636a77af9c8b5dc4e3b61c509a185f3c834/';
const storageKey = 'tcgate-player-locale-v1:cyberpunk-tcg';
const observations = { errors: [], requests: [], metrics: [] };
let assertions = 0, phase = 'initialization';
function check(value, label) { assert(value, label); assertions++; }
function equal(value, expected, label) { assert.deepEqual(value, expected, label); assertions++; }
function step(label) { phase = label; console.log('VISION_LOCALE_BROWSER_STEP ' + label); }
function personalLocaleKeys(value, at = '') {
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) => [
    ...(/^(?:(?:player|host|room|session|shared)?locale|locales|playerLocales)$/i.test(key) ? [at + key] : []),
    ...personalLocaleKeys(child, at + key + '.')
  ]);
}
async function pinnedDocuments() {
  const documents = new Map();
  async function read(relative) {
    check(typeof relative === 'string' && relative && !relative.includes('\\') && !relative.split('/').some(part => !part || part === '.' || part === '..'), 'Immutable fixture path is bounded');
    let bytes;
    if (process.env.TCGATE_DB_FIXTURE_ROOT) bytes = fs.readFileSync(path.join(process.env.TCGATE_DB_FIXTURE_ROOT, relative));
    else { const response = await fetch(prefix + relative); equal(response.status, 200, 'Pinned public fixture HTTP 200'); bytes = Buffer.from(await response.arrayBuffer()); }
    documents.set(relative, bytes); return JSON.parse(bytes.toString('utf8'));
  }
  const manifest = await read('manifest.json');
  await Promise.all([manifest.database_manifest, manifest.entrypoint || manifest.runtime_cards, manifest.runtime_printings, manifest.canonical_vision_index, manifest.printing_recognition_index, manifest.recognition_groups].map(read));
  equal(documents.size, 7, 'Seven immutable production runtime documents');
  const rich = JSON.parse(documents.get(manifest.printing_recognition_index)), assets = [...new Set(rich.cards.flatMap(card => card.recognitionGroups.flatMap(group => group.references.map(reference => reference.visionAssetPath))))];
  equal(assets.length, 229, 'Pinned runtime exposes 229 authentic Vision asset paths');
  return { documents, manifest, assets };
}
function bilingualDocuments(pinned) {
  const documents = new Map(pinned.documents), manifest = pinned.manifest;
  const canonical = JSON.parse(documents.get(manifest.entrypoint || manifest.runtime_cards))[0];
  const cardId = canonical.cardId, groupId = 'vision-locale-browser-fixture-shared';
  const printings = ['en', 'fr'].map((locale, index) => ({ cardId, printingId: 'vision-locale-fixture-' + locale, locale, variantKind: 'standard', displayAssetPath: pinned.assets[index], visionAssetPath: pinned.assets[index] }));
  const ids = printings.map(printing => printing.printingId), group = { recognitionGroupId: groupId, cardId, mode: 'shared', printingIds: ids, candidatePrintingIds: ids };
  const replacements = {
    [manifest.entrypoint || manifest.runtime_cards]: [{ ...canonical, primaryPrintingId: ids[0] }],
    [manifest.runtime_printings]: printings,
    [manifest.canonical_vision_index]: { references: [{ cardId, visionAssetPath: pinned.assets[0] }] },
    [manifest.printing_recognition_index]: { cards: [{ cardId, recognitionGroups: [{ ...group, references: printings.map(printing => ({ printingId: printing.printingId, visionAssetPath: printing.visionAssetPath })) }] }] },
    [manifest.recognition_groups]: { recognitionGroups: [group] }
  };
  for (const [key, value] of Object.entries(replacements)) documents.set(key, Buffer.from(JSON.stringify(value)));
  return documents;
}
function observe(page, name) {
  page.on('pageerror', error => observations.errors.push(name + ': ' + error.message));
  page.on('request', request => {
    let body = null; try { body = request.postDataJSON(); } catch {}
    observations.requests.push({ name, url: request.url(), method: request.method(), body });
  });
}
async function makeContext(browser, origin, pinned, { bilingual = false, locale = 'en', name = 'production' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, permissions: ['camera', 'microphone'], reducedMotion: 'reduce' });
  const documents = bilingual ? bilingualDocuments(pinned) : pinned.documents;
  await ctx.addInitScript(({ key, locale }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, locale);
    window.__visionLocaleCalls = []; window.__visionLocaleWorkers = []; window.__visionLocaleSse = []; window.__visionLocaleData = [];
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor(url, options) {
        super(url, options);
        if (String(url).includes('identification-worker.js')) { this.__record = { init: [], terminated: false }; window.__visionLocaleWorkers.push(this); }
      }
      postMessage(message, ...transfer) {
        if (this.__record && message?.type === 'init') this.__record.init.push(message.refs.map(ref => ({ image: ref.image, name: ref.name, locale: ref.locale, refId: ref.refId })));
        return super.postMessage(message, ...transfer);
      }
      terminate() { if (this.__record) this.__record.terminated = true; return super.terminate(); }
    };
    const NativeSource = window.EventSource;
    window.EventSource = class extends NativeSource {
      constructor(...args) { super(...args); for (const type of ['room-state', 'room-recovery', 'peer-joined', 'peer-left', 'signal']) super.addEventListener(type, event => { try { window.__visionLocaleSse.push({ type, payload: JSON.parse(event.data) }); } catch {} }); }
    };
    if (window.RTCDataChannel) {
      const send = RTCDataChannel.prototype.send;
      RTCDataChannel.prototype.send = function (payload) { try { window.__visionLocaleData.push(JSON.parse(payload)); } catch {} return send.call(this, payload); };
    }
  }, { key: storageKey, locale });
  await ctx.route('**/game-databases.js', async route => {
    let source = fs.readFileSync(path.join(root, 'public/game-databases.js'), 'utf8');
    if (bilingual) {
      const en = "en: Object.freeze({ code: 'en', label: 'English', dataReady: true, visionReady: true })";
      check(source.includes(en), 'Test-only bilingual descriptor is applied to the existing entry');
      source = source.replace(en, en + ",\n        fr: Object.freeze({ code: 'fr', label: 'French (test fixture)', dataReady: true, visionReady: true })")
        .replace("visionReadyLocales: Object.freeze(['en'])", "visionReadyLocales: Object.freeze(['en', 'fr'])")
        .replace('expectedCanonicalCards: 150', 'expectedCanonicalCards: 1').replace('expectedRuntimePrintings: 229', 'expectedRuntimePrintings: 2')
        .replace('expectedRecognitionGroups: 150', 'expectedRecognitionGroups: 1').replace('expectedMatcherReferences: 229', 'expectedMatcherReferences: 2');
    }
    await route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: source });
  });
  await ctx.route('**/database-source.js', async route => {
    // Spy on the real Locale Core API, without substituting its return values.
    const source = fs.readFileSync(path.join(root, 'public/database-source.js'), 'utf8') + `\n;(() => { const source = window.TCGateDatabaseSource; window.TCGateDatabaseSource = Object.freeze({ ...source, async getVisionReferences(gameId, locale, options) { const refs = await source.getVisionReferences(gameId, locale, options); if (refs.some(ref => ref.locale !== locale)) throw Error('Cross-locale contamination at Core API'); window.__visionLocaleCalls.push({ gameId, locale, refs: refs.map(ref => ({ refId: ref.refId, cardId: ref.cardId, printingId: ref.printingId, referencePrintingId: ref.referencePrintingId, locale: ref.locale, candidatePrintingIds: ref.candidatePrintingIds })) }); return refs; } }); })();`;
    await route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: source });
  });
  await ctx.route(prefix + '**', async route => {
    const relative = decodeURIComponent(route.request().url().slice(prefix.length));
    if (documents.has(relative)) return route.fulfill({ status: 200, body: documents.get(relative), contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } });
    check(pinned.assets.includes(relative), 'Browser requests only an authentic pinned Vision fixture asset');
    const local = process.env.TCGATE_DB_FIXTURE_ROOT && path.join(process.env.TCGATE_DB_FIXTURE_ROOT, relative);
    if (local && fs.existsSync(local)) return route.fulfill({ status: 200, body: fs.readFileSync(local), contentType: 'image/webp', headers: { 'access-control-allow-origin': '*' } });
    return route.continue();
  });
  const page = await ctx.newPage(); observe(page, name); await page.goto(origin + '/');
  await page.waitForFunction(() => window.TCGatePlayerLocale && window.TCGateSiteUi20);
  return { ctx, page, name };
}
async function tab(page, name) { await page.locator('[data-lobby-page="' + name + '"]').click(); }
async function room(page) {
  await page.waitForFunction(() => document.querySelector('#screenLobby')?.classList.contains('active') && /^[A-Z0-9]{6}$/.test(document.querySelector('#lobbyCode')?.textContent.trim() || '') && state.roomCode === document.querySelector('#lobbyCode').textContent.trim(), {}, { timeout: 30000 });
  return page.locator('#lobbyCode').innerText().then(text => text.trim());
}
async function create(page, game = 'cyberpunk') {
  await page.locator('#goCreate').click(); await page.locator('#playerName').fill('Host Vision Locale');
  await page.locator('#gameSelect').selectOption(game); await page.locator('#siteCreateTimer').uncheck();
  if (game === 'cyberpunk') await page.locator('#siteCreateGig').uncheck();
  await page.locator('#setupContinue').click(); return room(page);
}
async function join(page, code) {
  await page.locator('#goJoin').click(); await page.locator('#playerName').fill('Guest Vision Locale');
  await page.locator('#roomCodeInput').fill(code); await page.locator('#setupContinue').click(); equal(await room(page), code, 'Guest joins the actual shared Room');
}
async function localeControl(page, locale, options) {
  await tab(page, 'installation'); equal(await page.locator('#playerLocaleSelect').inputValue(), locale, 'Personal language matches the current browser');
  equal(await page.locator('#playerLocaleSelect option').evaluateAll(nodes => nodes.map(node => node.value)), options, 'Only the declared qualified locales are offered');
}
async function readyIndex(page, locale, count, expectedIds) {
  await page.waitForFunction(({ locale, count }) => {
    const snapshot = window.TCGIdentificationLab?.getSnapshot?.();
    return snapshot?.libraryReady && snapshot.playerLocale === locale && snapshot.visionReferenceCount === count && snapshot.librarySize === count && snapshot.matcherWorker.ready;
  }, { locale, count }, { timeout: 120000 });
  const actual = await page.evaluate(() => ({ snapshot: TCGIdentificationLab.getSnapshot(), calls: window.__visionLocaleCalls, workers: window.__visionLocaleWorkers.map(worker => worker.__record) }));
  equal(actual.snapshot.gameId, 'cyberpunk', 'Diagnostic game is the active shared game');
  equal(actual.snapshot.playerLocale, locale, 'Diagnostic locale is the personal preference');
  equal(actual.snapshot.visionReferenceCount, count, 'Diagnostic count matches the actual locale index');
  check(typeof actual.snapshot.visionIndexKey === 'string' && actual.snapshot.visionIndexKey.includes('cyberpunk') && actual.snapshot.visionIndexKey.includes(locale), 'Index diagnostics expose a corpus-scoped game/locale key');
  const call = actual.calls.filter(entry => entry.locale === locale).at(-1);
  check(call && call.refs.length === count, 'The real Core getVisionReferences API supplied the expected corpus');
  check(call.refs.every(ref => ref.locale === locale), 'Every Core reference strictly matches the selected language');
  const worker = actual.workers.filter(record => !record.terminated).at(-1);
  check(worker && worker.init.length === 1, 'The live real Worker received one complete fresh index');
  check(worker.init[0].every(ref => ref.locale === locale), 'Every actual Worker candidate carries the selected locale');
  equal(actual.snapshot.visionLocales, [locale], 'Index integrity reports exactly one active language');
  equal(worker.init[0].map(ref => ref.image).sort(), call.refs.map(ref => ref.refId).sort(), 'Actual Worker candidates are exactly the filtered Core references');
  if (expectedIds) {
    equal(call.refs.map(ref => ref.referencePrintingId), expectedIds, 'The same conceptual card uses the language-specific physical printing');
    check(call.refs.every(ref => ref.candidatePrintingIds.every(id => expectedIds.includes(id))), 'Ambiguous candidates contain no other language printing');
  }
  check(actual.snapshot.libraryIntegrity && !actual.snapshot.libraryIntegrity.degraded, 'Locale index has fully loaded reference assets and passes integrity');
  const performance = actual.snapshot.libraryPerformance;
  check(performance && Number.isFinite(performance.descriptorBuildMs) && performance.descriptorBuildMs >= 0, 'Existing descriptor build timing is measured');
  equal(performance.referenceCountAfterLocale, count, 'Measured post-filter cardinality equals the actual Worker index');
  equal(performance.referenceCountBeforeLocale, count === 229 ? 229 : 2, 'Measured pre-filter cardinality comes from the real source manifest');
  observations.metrics.push({ locale, referenceCount: count, visionIndexKey: actual.snapshot.visionIndexKey, libraryPerformance: performance });
  return actual;
}
async function media(page) {
  await tab(page, 'installation'); await page.locator('#enableMedia').click();
  await page.waitForFunction(() => document.querySelector('#lobbyPreview').srcObject?.getVideoTracks().some(track => track.readyState === 'live') && document.querySelector('#lobbyPreview').srcObject?.getAudioTracks().some(track => track.readyState === 'live') && document.querySelector('#mediaStatus').classList.contains('ready') && !state.rtcPrewarmPending, {}, { timeout: 30000 });
}
async function startGame(host, guest) {
  await Promise.all([media(host), media(guest)]);
  await guest.waitForFunction(() => !document.querySelector('#startGame').disabled); await guest.locator('#startGame').click();
  await host.waitForFunction(() => state.roomSnapshot.peers.some(peer => peer.role === 'guest' && peer.ready));
  await host.waitForFunction(() => !document.querySelector('#startGame').disabled); await host.locator('#startGame').click();
  for (const page of [host, guest]) await page.waitForFunction(() => document.querySelector('#screenGame').classList.contains('active') && document.querySelector('#remoteVideo').videoWidth > 0, {}, { timeout: 90000 });
}
async function noSharedLocale(pages) {
  const writes = observations.requests.filter(request => request.method !== 'GET');
  check(writes.length > 0, 'Real Room and signaling HTTP writes were observed');
  equal(writes.flatMap(request => personalLocaleKeys(request.body)), [], 'No personal language is sent in HTTP payloads');
  for (const page of pages) {
    const messages = await page.evaluate(() => ({ sse: window.__visionLocaleSse, data: window.__visionLocaleData, room: state.roomSnapshot }));
    check(messages.sse.some(message => message.type === 'room-state'), 'Authoritative SSE states were observed');
    equal(personalLocaleKeys(messages), [], 'SSE, WebRTC data and shared Room state contain no player locale');
  }
}
async function main() {
  const started = Date.now(), pinned = await pinnedDocuments(), fixture = await startBridgeFixture({ root }); let browser;
  const contexts = [];
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-fake-device-for-media-stream=device-count=2,fps=30', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
    console.log('VISION_LOCALE_BROWSER_VERSION ' + browser.version());
    step('Production Cyberpunk EN uses the real filtered Core API and authentic 229 assets');
    const prodHost = await makeContext(browser, fixture.origin, pinned, { name: 'production-host' }), prodGuest = await makeContext(browser, fixture.origin, pinned, { name: 'production-guest' }); contexts.push(prodHost.ctx, prodGuest.ctx);
    const code = await create(prodHost.page); await localeControl(prodHost.page, 'en', ['en']); await join(prodGuest.page, code); await localeControl(prodGuest.page, 'en', ['en']);
    const production = await readyIndex(prodHost.page, 'en', 229); await readyIndex(prodGuest.page, 'en', 229);
    equal(new Set(production.calls.at(-1).refs.map(ref => ref.locale)).size, 1, 'Production index contains EN only');
    check(!production.calls.some(call => call.locale === 'fr'), 'Unqualified production FR is never requested');
    step('F5 preserves personal EN and reconstructs or safely resumes its exact scoped index');
    await prodHost.page.reload(); equal(await room(prodHost.page), code, 'F5 restores the same shared Room'); await localeControl(prodHost.page, 'en', ['en']); await readyIndex(prodHost.page, 'en', 229);
    equal(await prodHost.page.evaluate(key => localStorage.getItem(key), storageKey), 'en', 'Personal EN persists through refresh');
    await startGame(prodHost.page, prodGuest.page);
    for (const page of [prodHost.page, prodGuest.page]) check(await page.evaluate(() => state.visionPrepared && state.roomSnapshot.phase === 'game' && state.roomSnapshot.peers.every(peer => peer.ready)), 'Existing Ready/media flow starts the real shared game with prepared locale Vision');
    await noSharedLocale([prodHost.page, prodGuest.page]);
    await Promise.all([prodHost.ctx.close(), prodGuest.ctx.close()]);
    step('Explicit bilingual fixture: Host FR, Guest EN, same cardId and distinct printings');
    const host = await makeContext(browser, fixture.origin, pinned, { bilingual: true, locale: 'fr', name: 'fixture-host' }), guest = await makeContext(browser, fixture.origin, pinned, { bilingual: true, locale: 'en', name: 'fixture-guest' }); contexts.push(host.ctx, guest.ctx);
    const fixtureCode = await create(host.page); await localeControl(host.page, 'fr', ['en', 'fr']); await join(guest.page, fixtureCode); await localeControl(guest.page, 'en', ['en', 'fr']);
    const fr = await readyIndex(host.page, 'fr', 1, ['vision-locale-fixture-fr']), en = await readyIndex(guest.page, 'en', 1, ['vision-locale-fixture-en']);
    equal(fr.calls.at(-1).refs[0].cardId, en.calls.at(-1).refs[0].cardId, 'Both languages share the same conceptual card');
    check(fr.snapshot.visionIndexKey !== en.snapshot.visionIndexKey, 'Host FR and Guest EN use different corpus/cache keys');
    step('Live locale changes unload old Worker/corpus, rebuild independently, reject stale messages');
    await host.page.evaluate(() => { const worker = window.__visionLocaleWorkers.at(-1); window.__oldLocaleWorker = worker; window.__oldLocaleHandler = worker.onmessage; });
    await host.page.locator('#playerLocaleSelect').selectOption('en');
    check(await host.page.evaluate(() => window.__oldLocaleWorker.__record.terminated), 'Changing the preference terminates the previous locale Worker');
    await readyIndex(host.page, 'en', 1, ['vision-locale-fixture-en']);
    equal(await guest.page.locator('#playerLocaleSelect').inputValue(), 'en', 'Host changes never overwrite Guest personal EN');
    const beforeStale = await host.page.evaluate(() => TCGIdentificationLab.getSnapshot());
    await host.page.evaluate(() => { window.__oldLocaleHandler?.({ data: { type: 'ready', count: 999 } }); window.__oldLocaleHandler?.({ data: { type: 'match-result', requestId: 1, result: { accepted: true, best: { ref: { image: 'vision-locale-fixture-fr', name: 'Stale FR result' }, score: 1 }, ranked: [] } } }); });
    const afterStale = await host.page.evaluate(() => TCGIdentificationLab.getSnapshot());
    equal({ locale: afterStale.playerLocale, size: afterStale.librarySize, key: afterStale.visionIndexKey, identity: afterStale.visibleIdentity, identification: afterStale.identification }, { locale: beforeStale.playerLocale, size: beforeStale.librarySize, key: beforeStale.visionIndexKey, identity: beforeStale.visibleIdentity, identification: beforeStale.identification }, 'Late old-locale ready/match messages cannot contaminate the new visible/index state');
    await host.page.locator('#playerLocaleSelect').selectOption('fr'); await readyIndex(host.page, 'fr', 1, ['vision-locale-fixture-fr']);
    const cacheKeys = await host.page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('tcgate-vision-locale-v1:')));
    check(cacheKeys.some(key => key.includes(':en:')) && cacheKeys.some(key => key.includes(':fr:')), 'EN and FR descriptor caches occupy separate browser storage namespaces');
    await noSharedLocale([host.page, guest.page]);
    step('Changing the shared game to Sans jeu discards the current active corpus');
    await tab(host.page, 'session'); await host.page.locator('#gameSelect').selectOption('no-game'); await host.page.waitForFunction(() => state.game === 'no-game');
    await guest.page.waitForFunction(() => state.game === 'no-game');
    for (const page of [host.page, guest.page]) {
      await tab(page, 'installation'); check(!await page.locator('#playerLocaleField').isVisible(), 'Sans jeu hides personal locale');
      const empty = await page.evaluate(() => TCGIdentificationLab.getSnapshot());
      check(!empty.libraryReady && empty.librarySize === 0 && empty.visionReferenceCount === 0 && !empty.matcherWorker.ready, 'Switching game unloads every old index before Sans jeu');
      equal(empty.playerLocale, null, 'Sans jeu has no personal Vision locale');
    }
    await tab(host.page, 'session'); await host.page.locator('#gameSelect').selectOption('cyberpunk'); await host.page.waitForFunction(() => state.game === 'cyberpunk'); await guest.page.waitForFunction(() => state.game === 'cyberpunk');
    await localeControl(host.page, 'fr', ['en', 'fr']); await readyIndex(host.page, 'fr', 1, ['vision-locale-fixture-fr']); await readyIndex(guest.page, 'en', 1, ['vision-locale-fixture-en']);
    await Promise.all([host.ctx.close(), guest.ctx.close()]);
    step('Fresh Sans jeu initializes no Vision module, corpus or index through real Ready');
    const noHost = await makeContext(browser, fixture.origin, pinned, { name: 'sans-jeu-host' }), noGuest = await makeContext(browser, fixture.origin, pinned, { name: 'sans-jeu-guest' }); contexts.push(noHost.ctx, noGuest.ctx);
    const noCode = await create(noHost.page, 'no-game'); await join(noGuest.page, noCode); await startGame(noHost.page, noGuest.page);
    for (const page of [noHost.page, noGuest.page]) {
      check(await page.evaluate(() => !window.TCGIdentificationLab && !window.TCGateVisionLocale && !state.visionPrepared && !state.visionAssetsLoaded && window.__visionLocaleCalls.length === 0 && window.__visionLocaleWorkers.length === 0), 'Fresh Sans jeu never initializes Vision or any candidate index');
    }
    const noRequests = observations.requests.filter(request => request.name.startsWith('sans-jeu-')).map(request => request.url);
    check(!noRequests.some(url => /\/(?:identification(?:-worker)?|vision-core|vision-locale|database-source|detection-worker)\.js/.test(url) || url.startsWith(prefix)), 'Sans jeu requests no Vision engine, locale corpus adapter, raw database or index');
    await noSharedLocale([noHost.page, noGuest.page]);
    equal(observations.errors, [], 'No uncaught browser error'); equal(fixture.requests.length, 0, 'No report email is sent');
    console.log('VISION_LOCALE_BROWSER_OK ' + JSON.stringify({ assertions, browser: browser.version(), production: 'Cyberpunk / EN / 229 authentic filtered references', bilingualDatabase: 'TEST FIXTURE ONLY', isolation: 'EN ONLY / FR ONLY / NO CROSS-LOCALE FALLBACK', personalPreference: 'Host and Guest independent; no network sharing', refresh: 'PASS', liveLocaleSwitch: 'PASS', gameSwitch: 'PASS', staleWorkerResult: 'REJECTED', sansJeu: 'Vision not initialized', metrics: observations.metrics, physicalFrQualified: false, elapsedSeconds: Math.round((Date.now() - started) / 1000) }));
  } finally { await Promise.allSettled(contexts.map(ctx => ctx.close())); await browser?.close(); await fixture.close(); }
}
main().catch(error => { console.error('VISION_LOCALE_BROWSER_FAILURE phase=' + phase + '\n' + error.stack); process.exitCode = 1; });
