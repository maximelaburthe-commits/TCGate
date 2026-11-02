'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = process.env.TCGATE_VISION_LOCALE_TEST_ROOT || __dirname;
const core = require(path.join(root, 'public/database-locale-core.js'));
const vision = require(path.join(root, 'public/vision-locale.js'));
const registry = require(path.join(root, 'public/game-databases.js'));
const databaseSource = require(path.join(root, 'public/database-source.js'));
const integrity = require(path.join(root, 'public/vision-library-integrity.js'));
let assertions = 0;
function equal(actual, expected, message) { assertions += 1; assert.strictEqual(actual, expected, message); }
function same(actual, expected, message) { assertions += 1; assert.deepStrictEqual(actual, expected, message); }
function check(value, message) { assertions += 1; assert(value, message); }
function throws(callback, pattern, message) { assertions += 1; assert.throws(callback, pattern, message); }
async function rejects(callback, pattern, message) { assertions += 1; await assert.rejects(callback, pattern, message); }

function fixture() {
  const descriptor = { gameId: 'fixture-cyberpunk', databaseVersion: 'locale-fixture-1', manifestUrl: 'https://example.test/fixture/abc/manifest.json', defaultLocale: 'en', locales: {
    en: { label: 'English', dataReady: true, visionReady: true },
    fr: { label: 'Français', dataReady: true, visionReady: true },
    de: { label: 'Deutsch', dataReady: true, visionReady: false },
    it: { label: 'Italiano', dataReady: true, visionReady: true }
  } };
  const cards = [{ cardId: 'same-card', name: 'Canonical card', type: 'Unit' }];
  const printings = [
    { cardId: 'same-card', printingId: 'same-card-en', locale: 'en' },
    { cardId: 'same-card', printingId: 'same-card-en-iconic', locale: 'en' },
    { cardId: 'same-card', printingId: 'same-card-fr', locale: 'fr' }
  ];
  const references = printings.map(printing => ({ ...printing, refId: 'ref:' + printing.printingId, referencePrintingId: printing.printingId, referenceImageUrl: 'https://example.test/vision/' + printing.printingId + '.png', displayImageUrl: 'https://example.test/display/' + printing.printingId + '.png', recognitionMode: 'exact', candidatePrintingIds: [printing.printingId] }));
  const view = core.createDatabaseView({ descriptor, cards, printings, references });
  const counts = { references: 0, metadata: 0, arguments: [] };
  let hold = null;
  const source = {
    async getVisionReferences(gameId, locale, options) {
      counts.references += 1; counts.arguments.push({ gameId, locale, options });
      if (hold) await hold;
      return view.getVisionReferences(locale);
    },
    async load(gameId, options) {
      counts.metadata += 1;
      return { cardsById: new Map(cards.map(card => [card.cardId, card])), manifest: { game: gameId, sourceRef: 'fixture-1', sourceCommit: 'a'.repeat(40), databaseVersion: descriptor.databaseVersion, visionReferenceCount: references.length }, metrics: { requests: 0, totalMs: 0 } };
    }
  };
  const api = vision.createVisionLocales({ core, source, getDescriptor(gameId) {
    if (gameId === 'fixture' || gameId === 'fixture-cyberpunk') return { key: 'fixture', descriptor };
    if (gameId === 'other') return { key: 'other', descriptor: { ...descriptor, gameId: 'other-game', manifestUrl: 'https://example.test/other/abc/manifest.json' } };
    return null;
  } });
  return { api, counts, descriptor, view, source, hold(promise) { hold = promise; } };
}

function element() {
  const classes = new Set();
  return { checked: true, style: {}, dataset: {}, textContent: '', classList: { add(...names) { names.forEach(name => classes.add(name)); }, remove(...names) { names.forEach(name => classes.delete(name)); }, contains(name) { return classes.has(name); } }, addEventListener() {}, removeAttribute(key) { delete this[key]; } };
}

function runtime(api, cache = new Map(), { delayWorkers = false, labProvider = null } = {}) {
  const elements = new Map();
  const events = [];
  const workers = [];
  class Worker {
    constructor() { this.terminated = false; workers.push(this); }
    postMessage(message) { this.message = message; if (message.type === 'init' && !delayWorkers) queueMicrotask(() => this.onmessage?.({ data: { type: 'ready', count: message.refs.length } })); }
    terminate() { this.terminated = true; }
  }
  const window = {
    TCGDetectionLab: { els: { videoStage: element(), video: { videoWidth: 1280, videoHeight: 720 }, overlay: { width: 1280, height: 720 } }, activeTracks: () => [] },
    TCGWorkspaceLabProviderInstance: labProvider,
    TCGateVisionLocale: api, TCGateVisionLibraryIntegrity: integrity,
    Worker, OffscreenCanvas: function() {}, createImageBitmap: async () => ({ close() {} }),
    addEventListener() {}, dispatchEvent(event) { events.push(event); }
  };
  const context = vm.createContext({ window, document: { getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); } },
    localStorage: { getItem: key => cache.get(key) ?? null, setItem: (key, value) => cache.set(key, value), removeItem: key => cache.delete(key) },
    Worker, createImageBitmap: window.createImageBitmap, performance, setTimeout, clearTimeout,
    CustomEvent: class CustomEvent { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    Image: class Image {}, requestAnimationFrame: callback => callback(), console
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'public/identification.js'), 'utf8'), context);
  return { api: window.TCGIdentificationLab, elements, events, workers, cache };
}

async function seed(api, gameId, playerLocale, cache) {
  const source = await api.prepare({ gameId, playerLocale });
  const refs = source.cards.map(card => ({ ...card, descriptor: { full: [1], art: [1], gradient: [1], chroma: [1], coarse: [1] } }));
  cache.set(source.visionIndexKey, JSON.stringify(api.cacheRecord(source, refs)));
  return source;
}

async function testTableLocaleLifecycle(sourceRoot) {
  const assert=Object.assign(value=>check(value),{equal,throws});
  const workers = [], timers = new Map();
  let timerSeq = 0;
  class WorkerFixture {
    constructor(url) { this.url = url; this.messages = []; this.terminated = false; workers.push(this); }
    postMessage(message) { this.messages.push(message); }
    terminate() { this.terminated = true; }
  }
  const page = new EventTarget();
  page.Worker = WorkerFixture;
  page.TCGDetectionLab = { state: {}, activeTracks: () => [], els: { videoStage: { addEventListener() {} } } };
  const video = { paused: true, readyState: 0, currentTime: 0, addEventListener() {} };
  const context = vm.createContext({
    window: page, document: { getElementById: id => id === 'remoteVideo' ? video : null },
    performance: { now: () => 1000 }, Date, CustomEvent, Map, Set, console,
    setTimeout(fn) { const id = ++timerSeq; timers.set(id, fn); return id; },
    clearTimeout(id) { timers.delete(id); }
  });
  vm.runInContext(fs.readFileSync(path.join(sourceRoot, 'public/table-state-bridge.js'), 'utf8'), context);
  const engineSource = fs.readFileSync(path.join(sourceRoot, 'public/table-state-engine.js'), 'utf8');
  assert.equal(engineSource.split('  window.TCGTableStateEngine = {').length, 2);
  vm.runInContext(engineSource.replace('  window.TCGTableStateEngine = {', '  window.__fixtureState = state;\n  window.TCGTableStateEngine = {'), context);
  const engine = page.TCGTableStateEngine, bridge = page.TCGTableStateBridge;
  const identWorker = new page.Worker('/identification-worker.js');
  const en = [{ image: 'same-card-en', locale: 'en' }];
  const fr = [{ image: 'same-card-fr', locale: 'fr' }];
  identWorker.postMessage({ type: 'init', refs: en, visionIndexKey: 'fixture/en', playerLocale: 'en' });
  assert.equal(bridge.getRefs(), en);
  assert.equal(bridge.getSnapshot().visionIndexKey, 'fixture/en');
  assert.equal(bridge.getSnapshot().playerLocale, 'en');
  await engine.start();
  const first = workers.find(worker => worker !== identWorker);
  assert(first);
  assert.equal(first.messages[0].refs, en);
  await engine.start();
  assert.equal(workers.length, 2, 'Concurrent start must reuse the initializing worker');
  const staleReady = first.onmessage, staleError = first.onerror;
  first.onmessage({ data: { type: 'ready', count: 1 } });
  assert.equal(engine.getSnapshot().workerReady, true);
  assert.equal(bridge.getRefs(), null, 'Worker consumption releases the captured corpus');
  const privateState = page.__fixtureState;
  privateState.workerBusy = true;
  privateState.currentRequest = { requestId: 9, generation: privateState.generation };
  engine.stop();
  assert.equal(first.terminated, true);
  assert.equal(engine.getSnapshot().started, false);
  assert.equal(engine.getSnapshot().workerReady, false);
  assert.equal(engine.getSnapshot().workerBusy, false);
  assert.equal(privateState.currentRequest, null);
  assert.equal(bridge.getSnapshot().visionIndexKey, null);
  staleReady({ data: { type: 'ready', count: 1 } });
  staleError({ message: 'late old-locale worker error' });
  assert.equal(engine.getSnapshot().workerReady, false, 'Queued old worker readiness is ignored after stop');
  assert.equal(engine.getSnapshot().workerError, null, 'Queued old worker failure cannot poison the new scope');
  const oldStart = engine.start();
  assert.equal(timers.size, 1, 'Waiting for the old corpus is asynchronous');
  engine.stop();
  identWorker.postMessage({ type: 'init', refs: fr, visionIndexKey: 'fixture/fr', playerLocale: 'fr' });
  for (const [id, fn] of [...timers]) { timers.delete(id); fn(); }
  await oldStart;
  assert.equal(workers.length, 2, 'Stopped asynchronous start cannot consume the next-locale corpus');
  assert.equal(engine.getSnapshot().started, false);
  assert.equal(bridge.getRefs(), fr);
  await engine.start();
  const next = workers[2];
  assert(next && next !== first);
  assert.equal(next.messages[0].refs, fr, 'The next native worker receives only FR references');
  const postedBefore = identWorker.messages.length;
  assert.throws(() => identWorker.postMessage({ type: 'init', refs: en, visionIndexKey: 'fixture/fr', playerLocale: 'fr' }), /locale/);
  assert.equal(identWorker.messages.length, postedBefore, 'Mixed-language init is rejected before postMessage');
  assert.equal(bridge.getRefs(), null, 'Rejected mixed-language init cannot retain an earlier corpus');
  engine.stop();
  identWorker.postMessage({ type: 'init', refs: [{ image: 'test-manifest' }] });
  assert.equal(bridge.getRefs().length, 1, 'The separate unqualified Lab provider remains compatible');
  assert.equal(bridge.getSnapshot().visionIndexKey, null);
  assert.equal(bridge.getSnapshot().playerLocale, null);
  bridge.releaseRefs();
  assert.equal(bridge.getSnapshot().sourceUrl, null);
  assert.equal(bridge.getSnapshot().capturedAt, null);
  return { lifecycle: 'PASS', bridgeIsolation: 'PASS', obsoleteStart: 'PASS', oldCallbacks: 'PASS', labCompatibility: 'PASS' };
}

async function testAppLocaleLifecycle(sourceRoot) {
  const app = fs.readFileSync(path.join(sourceRoot, 'public/app.js'), 'utf8');
  const start = app.indexOf('async function attachVisionToRemoteStream(');
  const end = app.indexOf('\nfunction detachVision(', start);
  check(start >= 0 && end > start, 'actual App attachment lifecycle is exercised');
  const source = app.slice(start, end);
  const stream = { id: 'remote-stream', getVideoTracks: () => [{ id: 'remote-video' }] };
  function harness(stage) {
    const trace = [];
    let release, reject, entered;
    const pending = new Promise((resolve, fail) => { release = resolve; reject = fail; });
    const reached = new Promise(resolve => { entered = resolve; });
    const pause = name => { trace.push(name); if (name === stage) { entered(); return pending; } return Promise.resolve(name === 'table' ? { workerReady: true } : true); };
    const state = { visionPreparationId: 7, visionContextKey: 'en-scope', visionPrepared: true, visionAttachedStreamId: null, remoteMediaState: {}, visionStateReady: false };
    const context = {
      state, visionEnabledForCurrentGame: () => true,
      currentVisionContext: () => ({ gameId: 'cyberpunk', playerLocale: 'en' }),
      visionPairKey: () => 'en-scope', prepareVision: () => pause('preparation'),
      $: () => ({}), setVisionStatus: () => trace.push('status'),
      setVisionStateStatus: () => trace.push('table-status'),
      logEvent: () => trace.push('log'), startVisionMetricsSampler: () => trace.push('metrics'),
      window: {
        TCGVisionEngine: { attachRemoteStream: () => pause('engine'), detachRemoteStream: () => trace.push('detach') },
        TCGTableStateEngine: { getSnapshot: () => ({ started: false }), start: () => pause('table') },
        TCGVisionCalibration: { start: () => { trace.push('calibration'); return Promise.resolve(); } }
      }
    };
    vm.runInNewContext(source + '\nglobalThis.attach = attachVisionToRemoteStream;', context);
    return { ...context, trace, reached, release, reject };
  }
  for (const stage of ['preparation', 'engine', 'table']) for (const fail of [false, true]) {
    const live = harness(stage), flight = live.attach(stream);
    await live.reached;
    // An EN -> FR -> EN transition restores the same key but owns a new epoch.
    live.state.visionPreparationId += 2;
    live.state.visionStateReady = 'new-scope-state';
    live.state.visionAttachedStreamId = 'new-scope-stream';
    live.trace.length = 0;
    if (fail) live.reject(new Error('stale scope failure'));
    else live.release(stage === 'table' ? { workerReady: true } : true);
    await flight;
    same(live.trace, [], 'stale ' + stage + ' ' + (fail ? 'failure' : 'completion') + ' cannot start/reset memory, calibration, status or sampling after ABA');
    equal(live.state.visionStateReady, 'new-scope-state', 'stale scope cannot overwrite the current Table State');
    equal(live.state.visionAttachedStreamId, 'new-scope-stream', 'stale scope cannot overwrite the current attached stream');
  }
  const current = harness('none');
  await current.attach(stream);
  check(current.trace.includes('table') && current.state.visionStateReady === true, 'current locale attachment starts its actual Table State cycle');
  check(current.trace.includes('calibration') && current.trace.includes('metrics'), 'current locale attachment retains calibration and metrics');
}

async function run() {
  const f = fixture();
  equal(await f.api.prepare(null), null, 'null context is inactive');
  equal(await f.api.prepare({ gameId: 'no-game', playerLocale: 'en' }), null, 'Sans jeu ignores stale locale without source work');
  equal(f.counts.references + f.counts.metadata, 0, 'Sans jeu does not initialize corpus or database');
  for (const locale of [null, undefined, 'FR', 'en-US', 'unknown', 'de', '__proto__']) {
    throws(() => f.api.context({ gameId: 'fixture', playerLocale: locale }), /unavailable for locale/, 'strict invalid/non-ready locale never defaults');
  }
  throws(() => f.api.context({ gameId: 'unknown', playerLocale: 'en' }), /unavailable for game/, 'unknown game fails before source work');
  equal(f.counts.references + f.counts.metadata, 0, 'invalid contexts cause no source requests');
  const en = await f.api.prepare({ gameId: 'fixture', playerLocale: 'en' });
  const fr = await f.api.prepare({ gameId: 'fixture', playerLocale: 'fr' });
  equal(en.cards.length, 2, 'EN contains both actual EN printings');
  equal(fr.cards.length, 1, 'FR contains its own printing only');
  check(en.cards.every(ref => ref.locale === 'en'), 'EN corpus contains zero FR references');
  check(fr.cards.every(ref => ref.locale === 'fr'), 'FR corpus contains zero EN references');
  same(en.cards.map(ref => ref.printingId), ['same-card-en', 'same-card-en-iconic'], 'same canonical card chooses real EN printings');
  same(fr.cards.map(ref => ref.printingId), ['same-card-fr'], 'same canonical card chooses real FR printing');
  equal(en.cards[0].cardId, fr.cards[0].cardId, 'canonical identity remains shared across languages');
  equal(en.referenceCountBeforeLocale, 3, 'unfiltered reference count measured from DB manifest');
  equal(en.referenceCountAfterLocale, 2, 'filtered EN reference count');
  equal(fr.referenceCountAfterLocale, 1, 'filtered FR reference count');
  check(en.visionIndexKey !== fr.visionIndexKey, 'EN and FR occupy distinct persistent cache namespaces');
  equal(en.visionIndexKey, f.api.context({ gameId: 'fixture-cyberpunk', playerLocale: 'en' }).visionIndexKey, 'aliases use canonical game cache identity');
  const other = await f.api.prepare({ gameId: 'other', playerLocale: 'en' });
  check(other.visionIndexKey !== en.visionIndexKey, 'different games cannot reuse one index');
  const updatedDescriptor = { ...f.descriptor, databaseVersion: 'fixture-2' };
  const updated = vision.createVisionLocales({ getDescriptor: () => updatedDescriptor });
  check(updated.context({ gameId: 'fixture', playerLocale: 'en' }).visionIndexKey !== en.visionIndexKey, 'database version participates in cache namespace');
  const moved = vision.createVisionLocales({ getDescriptor: () => ({ ...f.descriptor, manifestUrl: 'https://example.test/fixture/def/manifest.json' }) });
  check(moved.context({ gameId: 'fixture', playerLocale: 'en' }).visionIndexKey !== en.visionIndexKey, 'source commit/URL participates in cache namespace');
  check(f.counts.arguments.every(call => call.locale && call.gameId), 'every candidate request carries explicit game and locale');
  await rejects(() => f.api.prepare({ gameId: 'fixture', playerLocale: 'it' }), /corpus empty/, 'empty locale is a controlled failure, never global');

  const poisoned = vision.createVisionLocales({ core, getDescriptor: () => f.descriptor, source: { ...f.source, getVisionReferences: async () => [...en.cards, ...fr.cards] } });
  await rejects(() => poisoned.prepare({ gameId: 'fixture', playerLocale: 'en' }), /cross-locale/, 'contaminated source fails immediately');
  throws(() => f.api.assertReferences([{ ...en.cards[0], locale: undefined }], en), /cross-locale/, 'missing locale cannot bypass integrity guard');
  throws(() => f.api.assertReferences([en.cards[0], en.cards[0]], en), /identity invalid/, 'duplicate physical reference rejected');
  throws(() => f.api.assertReferences([{ ...en.cards[0], refId: '' }], en), /identity invalid/, 'missing physical identity rejected');
  const offline = vision.createVisionLocales({ core, getDescriptor: () => f.descriptor, source: { ...f.source, getVisionReferences: async () => { throw new Error('DB offline'); } } });
  await rejects(() => offline.prepare({ gameId: 'fixture', playerLocale: 'en' }), /DB offline/, 'database failure never opens legacy/global fallback');
  const refs = en.cards.map(card => ({ ...card, descriptor: { full: [1] } }));
  const record = f.api.cacheRecord(en, refs);
  equal(f.api.validateCache(record, en).status, 'hit', 'exact locale/source cache can be reused');
  equal(f.api.validateCache(record, fr).refs, null, 'EN cache cannot satisfy FR request');
  equal(f.api.validateCache(record, other).refs, null, 'EN cache cannot satisfy another game');
  equal(f.api.validateCache({ ...record, refs: [{ ...refs[0], locale: 'fr' }, refs[1]] }, en).status, 'invalid-locale-references', 'cached foreign locale rejected even with matching fingerprint/count');
  equal(f.api.validateCache({ ...record, refs: [{ ...refs[0], referencePrintingId: 'same-card-fr' }, refs[1]] }, en).status, 'invalid-reference-provenance', 'cached physical artwork identity checked individually');
  equal(f.api.validateCache({ ...record, refs: [refs[0], refs[0]] }, en).refs, null, 'duplicate cached references rejected');
  equal(f.api.validateCache({ ...record, fingerprint: 'old' }, en).refs, null, 'old fingerprint rejected');
  equal(f.api.validateCache({ ...record, sourceRef: 'old' }, en).refs, null, 'old DB revision rejected');
  equal(f.api.validateCache({ ...record, sourceIdentity: 'different URL' }, en).refs, null, 'different source identity rejected');
  equal(f.api.validateCache({ ...record, refs: refs.slice(1) }, en).refs, null, 'partial cache rejected');
  equal(f.api.validateCache({ ...record, refs: refs.map(({ descriptor, ...ref }) => ref) }, en).refs, null, 'metadata alone cannot masquerade as an index');
  const reorder = f.api.validateCache({ ...record, refs: [...refs].reverse() }, en);
  equal(reorder.status, 'hit', 'cache reference order is irrelevant when every physical reference matches');

  const cache = new Map();
  await seed(f.api, 'fixture', 'en', cache); await seed(f.api, 'fixture', 'fr', cache); await seed(f.api, 'other', 'en', cache);
  const live = runtime(f.api, cache);
  const inactive = await live.api.start();
  equal(inactive.ready, false, 'product start requires an explicit context');
  equal(live.workers.length, 0, 'missing context initializes no worker');
  const started = await live.api.start({ gameId: 'fixture', playerLocale: 'en' });
  equal(started.ready, true, 'locale index activates with complete own references');
  equal(started.cards, 2, 'worker receives EN count only');
  equal(live.api.getSnapshot().playerLocale, 'en', 'diagnostics expose selected locale');
  same(Array.from(live.api.getSnapshot().visionLocales), ['en'], 'diagnostics prove actual active EN-only index');
  equal(live.api.getSnapshot().visionIndexKey, en.visionIndexKey, 'diagnostics expose exact scoped cache key');
  equal(live.workers[0].message.playerLocale, 'en', 'table bridge receives explicit source locale');
  check(live.workers[0].message.refs.every(ref => ref.locale === 'en'), 'worker candidate metadata preserves locale integrity');
  equal(live.api.getSnapshot().libraryPerformance.referenceCountBeforeLocale, 3, 'runtime records unfiltered count');
  equal(live.api.getSnapshot().libraryPerformance.referenceCountAfterLocale, 2, 'runtime records filtered count');
  check(live.api.setContext({ gameId: 'fixture', playerLocale: 'en' }).changed === false, 'same context leaves valid active index intact');
  live.elements.get('identImage').dataset.cardUrl = 'https://example.test/en.png';
  live.elements.get('identImage').src = 'https://example.test/en.png';
  const changed = live.api.setContext({ gameId: 'fixture', playerLocale: 'fr' });
  equal(changed.changed, true, 'locale transition is explicit');
  equal(live.api.getSnapshot().visionReferenceCount, 0, 'previous corpus removed synchronously before next load');
  equal(live.api.getSnapshot().libraryReady, false, 'old index cannot remain ready during transition');
  equal(live.workers[0].terminated, true, 'old worker terminated before FR activation');
  equal(live.api.getSnapshot().hoverCache.size, 0, 'hover cache purged');
  equal(live.api.getSnapshot().identityStability.activeTracks, 0, 'identity cache purged');
  equal(live.api.getSnapshot().visibleIdentity, null, 'visible identity purged');
  equal(live.elements.get('identImage').src, undefined, 'previous HD source removed');
  equal(live.api.showMemoryIdentity({ name: 'EN old card', image: 'ref:same-card-en' }), false, 'stale cross-locale memory identity cannot restore old HD');
  equal((await live.api.start()).cards, 1, 'FR activates only its own one-reference index');
  same(Array.from(live.api.getSnapshot().visionLocales), ['fr'], 'FR runtime index contains no EN reference');
  check(live.api.getSnapshot().visionIndexKey !== en.visionIndexKey, 'FR cannot reuse EN cache key');
  const frenchWorker = live.workers[1];
  live.api.setContext({ gameId: 'other', playerLocale: 'en' });
  equal(frenchWorker.terminated, true, 'TCG transition terminates previous worker');
  equal(live.api.getSnapshot().visionReferenceCount, 0, 'TCG transition purges previous corpus');
  equal((await live.api.start()).cards, 2, 'new game starts from its own context');
  live.api.setContext({ gameId: 'no-game', playerLocale: null });
  equal(live.api.getSnapshot().visionIndexKey, null, 'Sans jeu has no index namespace');
  equal(live.api.getSnapshot().visionReferenceCount, 0, 'Sans jeu has no corpus');
  equal((await live.api.start()).ready, false, 'Sans jeu never initializes identification');
  const workersBeforeInvalid = live.workers.length;
  const invalidContext = await live.api.start({ gameId: 'fixture', playerLocale: 'de' });
  equal(invalidContext.ready, false, 'technical non-ready locale fails safely');
  check(/unavailable for locale/.test(invalidContext.error), 'non-ready failure is explicit');
  equal(live.workers.length, workersBeforeInvalid, 'invalid locale creates no worker/global fallback');

  // A completion from an earlier locale cannot repopulate state after invalidation.
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  f.hold(pending);
  const stale = runtime(f.api, cache);
  const oldStart = stale.api.start({ gameId: 'fixture', playerLocale: 'en' });
  stale.api.setContext({ gameId: 'fixture', playerLocale: 'fr' });
  f.hold(null);
  equal((await stale.api.start()).cards, 1, 'new locale can activate while former source is pending');
  release();
  equal((await oldStart).cancelled, true, 'late old source completion is cancelled');
  equal(stale.api.getSnapshot().playerLocale, 'fr', 'late completion cannot replace new selected locale');
  same(Array.from(stale.api.getSnapshot().visionLocales), ['fr'], 'late completion cannot merge old references');
  equal(stale.workers.length, 1, 'late completion never starts an old worker');

  const delayed = runtime(f.api, cache, { delayWorkers: true });
  const delayedStart = delayed.api.start({ gameId: 'fixture', playerLocale: 'en' });
  for (let i = 0; i < 12 && !delayed.workers.length; i += 1) await Promise.resolve();
  equal(delayed.workers.length, 1, 'old worker initialization is genuinely pending');
  delayed.api.setContext({ gameId: 'no-game', playerLocale: null });
  equal((await delayedStart).cancelled, true, 'context invalidation settles old init without waiting for timeout');
  delayed.workers[0].onmessage({ data: { type: 'ready', count: 2 } });
  equal(delayed.api.getSnapshot().matcherWorker.ready, false, 'late old worker ready event cannot activate new context');
  equal(delayed.api.getSnapshot().visionReferenceCount, 0, 'late old worker event cannot restore corpus');
  check(live.events.some(event => event.type === 'tcg-identification-context'), 'product lifecycle receives local invalidation event');

  await testTableLocaleLifecycle(root);
  await testAppLocaleLifecycle(root);
  await realCyberpunk();
  console.log(`VISION_LOCALE_OK · ${assertions} assertions · actual Locale Core source, EN/FR physical isolation, strict failures, scoped cache integrity, lifecycle invalidation and stale async protection`);
}

async function realCyberpunk() {
  const config = registry.get('cyberpunk');
  const fixtureRoot = process.env.TCGATE_DB_FIXTURE_ROOT;
  let requests = 0;
  const fetchImpl = async url => {
    requests += 1;
    if (!fixtureRoot) return fetch(url);
    const relative = new URL(String(url)).pathname.split('/56402636a77af9c8b5dc4e3b61c509a185f3c834/')[1];
    check(Boolean(relative) && !relative.includes('..'), 'real fixture path remains pinned');
    return new Response(fs.readFileSync(path.join(fixtureRoot, relative)), { status: 200 });
  };
  databaseSource.clear();
  const calls = [];
  const source = { load: databaseSource.load, async getVisionReferences(gameId, locale, options) { calls.push({ gameId, locale }); return databaseSource.getVisionReferences(gameId, locale, options); } };
  const api = vision.createVisionLocales({ source, getDescriptor(gameId) { return gameId === 'cyberpunk' || gameId === config.gameId ? { key: 'cyberpunk', descriptor: config } : null; } });
  const cyberpunk = await api.prepare({ gameId: 'cyberpunk', playerLocale: 'en' }, { fetchImpl });
  equal(cyberpunk.cards.length, 229, 'actual pinned Cyberpunk EN contains 229 references through locale filter');
  equal(cyberpunk.referenceCountBeforeLocale, 229, 'actual pre-filter source reference count');
  equal(cyberpunk.referenceCountAfterLocale, 229, 'actual post-filter count');
  same(calls, [{ gameId: 'cyberpunk', locale: 'en' }], 'actual candidate corpus enters exclusively through getVisionReferences(gameId, locale)');
  for (const ref of cyberpunk.cards) equal(ref.locale, 'en', 'each actual reference proves selected locale');
  equal(cyberpunk.cards.filter(ref => ref.recognitionMode === 'exact').length, 83, 'actual singleton recognition stays exact');
  const shared = cyberpunk.cards.filter(ref => ref.recognitionMode === 'shared');
  equal(shared.length, 146, 'actual shared artwork corpus retained');
  check(shared.every(ref => ref.printingId === null && ref.candidatePrintingIds.length > 1), 'locale projection never invents exact printing identity');
  equal(cyberpunk.sourceImmutable, true, 'real pinned source remains immutable');
  equal(requests, 7, 'filtered corpus plus canonical metadata uses seven cached manifest resources once');
  await rejects(() => api.prepare({ gameId: 'cyberpunk', playerLocale: 'fr' }, { fetchImpl }), /unavailable for locale/, 'actual production FR never activated or loaded');
  equal(calls.length, 1, 'invalid production FR rejected before source access');
  equal(requests, 7, 'production FR refusal adds no requests');
  databaseSource.clear();
}

run().catch(error => { console.error(error); process.exitCode = 1; });
