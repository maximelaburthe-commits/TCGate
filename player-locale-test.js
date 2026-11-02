'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const api = require('./public/player-locale.js');
const registry = require('./public/game-databases.js');
let assertions = 0;
function equal(actual, expected, message) { assertions++; assert.strictEqual(actual, expected, message); }
function same(actual, expected, message) { assertions++; assert.deepStrictEqual(actual, expected, message); }
function check(value, message) { assertions++; assert(value, message); }

function memoryStorage() {
  const values = new Map();
  return { values, getItem: key => values.has(key) ? values.get(key) : null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
}
function descriptor(gameId = 'fixture-alpha', defaultLocale = 'de') {
  return { gameId, databaseVersion: 'fixture-only', defaultLocale, locales: {
    de: { label: 'Deutsch', dataReady: true, visionReady: true },
    es: { label: 'Espa\u00f1ol', dataReady: true, visionReady: true },
    fr: { label: 'Fran\u00e7ais', dataReady: true, visionReady: false }
  } };
}
const declarations = { alpha: descriptor(), beta: descriptor('fixture-beta', 'es') };
const sourceBefore = JSON.stringify(declarations);
const storage = memoryStorage();
const player = api.createPlayerLocales({ getDescriptor: game => Object.prototype.hasOwnProperty.call(declarations, game) ? declarations[game] : null, storage });

same(player.getAvailablePlayerLocales('alpha').map(locale => [locale.code, locale.label]), [['de', 'Deutsch'], ['es', 'Espa\u00f1ol']], 'options and labels originate exclusively in declared readiness');
equal(player.getPlayerLocale('alpha'), 'de', 'selectable declared default');
equal(player.getPlayerLocale('beta'), 'es', 'each TCG has its declared default');
equal(storage.getItem(player.getStorageKey('alpha')), 'de', 'first valid default becomes the personal stored preference');
const entriesBeforeNormalization = storage.values.size;
equal(player.normalizePlayerLocale('alpha', 'ES'), 'es', 'locale spelling is normalized by Locale Core');
equal(player.normalizePlayerLocale('alpha', 'fr'), 'de', 'unqualified locale normalizes to valid default');
equal(player.normalizePlayerLocale('alpha', 'es-MX'), 'de', 'no implicit regional fallback');
equal(player.normalizePlayerLocale('alpha', 'unknown'), 'de', 'unknown preference normalizes');
equal(player.normalizePlayerLocale('alpha', null), 'de', 'missing preference uses declared default');
equal(storage.values.size, entriesBeforeNormalization, 'pure normalization does not persist');
equal(player.setPlayerLocale('alpha', 'es'), 'es', 'personal selection accepted');
equal(player.getPlayerLocale('alpha'), 'es', 'personal selection survives another read');
equal(player.getPlayerLocale('beta'), 'es', 'another TCG remains unchanged');
equal(player.setPlayerLocale('beta', 'de'), 'de', 'second TCG can have another preference');
equal(player.getPlayerLocale('alpha'), 'es', 'changing TCG does not overwrite the first preference');
equal(player.getPlayerLocale('beta'), 'de', 'second preference is independently stored');
check(player.getStorageKey('alpha') !== player.getStorageKey('beta'), 'storage is indexed by canonical game id');
const reopened = api.createPlayerLocales({ getDescriptor: game => declarations[game] || null, storage });
equal(reopened.getPlayerLocale('alpha'), 'es', 'preference survives factory/page reconstruction');
equal(reopened.getPlayerLocale('beta'), 'de', 'other TCG preference survives reconstruction');
equal(JSON.stringify(declarations), sourceBefore, 'helpers never mutate descriptor inputs');
const options = player.getAvailablePlayerLocales('alpha');
check(Object.isFrozen(options) && options.every(Object.isFrozen), 'returned option snapshots are immutable');
check(Object.isFrozen(player) && Object.isFrozen(api), 'helper API is immutable');
assertions++; assert.throws(() => options.push({ code: 'xx' }), TypeError, 'callers cannot append undeclared options');
assertions++; assert.throws(() => { options[0].label = 'Changed'; }, TypeError, 'callers cannot mutate option labels');
equal(player.getAvailablePlayerLocales('alpha')[0].label, 'Deutsch', 'labels remain unchanged');

const changingDefaultDescriptor = { gameId: 'fixture-first-default', databaseVersion: 'fixture-only', defaultLocale: 'en', locales: {
  en: { label: 'English', dataReady: true, visionReady: true },
  fr: { label: 'Fran\u00e7ais', dataReady: true, visionReady: true }
} };
const changingDefaultStorage = memoryStorage();
const firstUse = api.createPlayerLocales({ getDescriptor: () => changingDefaultDescriptor, storage: changingDefaultStorage });
equal(firstUse.getPlayerLocale('fixture'), 'en', 'first visit uses the declared qualified default');
equal(changingDefaultStorage.getItem(firstUse.getStorageKey('fixture')), 'en', 'first visit persists that default');
changingDefaultDescriptor.defaultLocale = 'fr';
equal(firstUse.getPlayerLocale('fixture'), 'en', 'a later descriptor default cannot replace the personal preference');
const nextRoom = api.createPlayerLocales({ getDescriptor: () => changingDefaultDescriptor, storage: changingDefaultStorage });
equal(nextRoom.getPlayerLocale('fixture'), 'en', 'another Room still uses the persisted first preference');
changingDefaultDescriptor.locales.en.visionReady = false;
changingDefaultDescriptor.locales.fr.visionReady = false;
equal(firstUse.getPlayerLocale('fixture'), null, 'no qualified locale returns null without a new Ready rule');
equal(changingDefaultStorage.getItem(firstUse.getStorageKey('fixture')), 'en', 'temporary lack of selectable locales does not erase the personal preference');
changingDefaultDescriptor.locales.en.visionReady = true;
equal(firstUse.getPlayerLocale('fixture'), 'en', 'the saved preference returns when it becomes selectable again');

// Availability is reread from the current descriptor, not cached as readiness.
declarations.alpha.locales.es.visionReady = false;
equal(player.getPlayerLocale('alpha'), 'de', 'obsolete saved preference automatically returns to valid default');
equal(storage.getItem(player.getStorageKey('alpha')), 'de', 'obsolete personal value is repaired');
equal(player.getPlayerLocale('beta'), 'de', 'normalization preserves other TCG preferences');
same(player.getAvailablePlayerLocales('alpha').map(locale => locale.code), ['de'], 'new availability is reflected');
declarations.alpha.locales.es.visionReady = true;
declarations.alpha.defaultLocale = 'fr';
equal(player.normalizePlayerLocale('alpha', null), 'de', 'unqualified default uses first selectable locale');
declarations.alpha.defaultLocale = 'it';
equal(player.normalizePlayerLocale('alpha', null), 'de', 'undeclared stale default uses first declared selectable locale');
declarations.alpha.defaultLocale = '__proto__';
equal(player.normalizePlayerLocale('alpha', null), 'de', 'prototype default is invalid and cannot break declared options');
delete declarations.alpha.defaultLocale;
equal(player.normalizePlayerLocale('alpha', null), 'de', 'absent default uses first selectable declaration');
declarations.alpha.defaultLocale = 'es';
equal(player.normalizePlayerLocale('alpha', null), 'es', 'valid default need not be the first declaration');

const hostStorage = memoryStorage();
const guestStorage = memoryStorage();
const fixtureDescriptor = descriptor();
const host = api.createPlayerLocales({ getDescriptor: () => fixtureDescriptor, storage: hostStorage });
const guest = api.createPlayerLocales({ getDescriptor: () => fixtureDescriptor, storage: guestStorage });
equal(host.setPlayerLocale('alpha', 'de'), 'de', 'Host fixture chooses X');
equal(guest.setPlayerLocale('alpha', 'es'), 'es', 'Guest fixture chooses Y');
equal(host.getPlayerLocale('alpha'), 'de', 'Guest never overwrites Host local preference');
equal(guest.getPlayerLocale('alpha'), 'es', 'Host never overwrites Guest local preference');
const otherTab = api.createPlayerLocales({ getDescriptor: () => fixtureDescriptor, storage: guestStorage });
equal(otherTab.setPlayerLocale('alpha', 'de'), 'de', 'another tab updates the same personal browser storage');
equal(guest.getPlayerLocale('alpha'), 'de', 'reads observe personal storage changes without any Room synchronization');
equal(host.getPlayerLocale('alpha'), 'de', 'another browser still has its own preference');

const productionStorage = memoryStorage();
const production = api.createPlayerLocales({ storage: productionStorage });
same(production.getAvailablePlayerLocales('cyberpunk'), [{ code: 'en', label: 'English', dataReady: true, visionReady: true }], 'current qualified Cyberpunk EN is the only active option');
equal(production.getPlayerLocale('cyberpunk'), 'en', 'current Cyberpunk defaults to EN');
equal(production.getPlayerLocale('cyberpunk-tcg'), 'en', 'canonical id resolves the existing registry entry');
equal(production.getStorageKey('cyberpunk'), production.getStorageKey('cyberpunk-tcg'), 'room and canonical aliases use one personal key');
equal(production.setPlayerLocale('cyberpunk-tcg', 'fr'), 'en', 'production FR is never made selectable');
equal(productionStorage.getItem(production.getStorageKey('cyberpunk')), 'en', 'only a currently selectable production locale is stored');
same(Object.keys(registry.databases), ['cyberpunk'], 'no future TCG is activated');
const declaredFR = descriptor('fixture-cyberpunk', 'fr');
declaredFR.locales = { en: { label: 'English', dataReady: true, visionReady: true }, fr: { label: 'Fran\u00e7ais', dataReady: true, visionReady: false } };
const candidate = api.createPlayerLocales({ getDescriptor: () => declaredFR, storage: memoryStorage() });
same(candidate.getAvailablePlayerLocales('fixture').map(locale => locale.code), ['en'], 'FR dataReady alone is insufficient');
equal(candidate.setPlayerLocale('fixture', 'fr'), 'en', 'an explicitly unqualified FR locale normalizes to EN');
equal(declaredFR.locales.fr.visionReady, false, 'personal helpers cannot manufacture FR qualification');

for (const gameId of [null, undefined, '', 'none', 'sans-jeu', 'swu', '__proto__', 'constructor', 'prototype', 'toString', ' cyberpunk ']) {
  same(production.getAvailablePlayerLocales(gameId), [], `no available locales for ${String(gameId)}`);
  equal(production.getPlayerLocale(gameId), null, `no personal locale for ${String(gameId)}`);
  equal(production.normalizePlayerLocale(gameId, 'en'), null, `no invented default for ${String(gameId)}`);
  equal(production.setPlayerLocale(gameId, 'en'), null, `no preference stored for ${String(gameId)}`);
  equal(production.getStorageKey(gameId), null, `no storage key for ${String(gameId)}`);
}
for (const invalid of ['__proto__', 'constructor', 'prototype', 'toString', 'null', '{}', '[]', 'fr', 1, true, { code: 'es' }, ['es']]) {
  equal(player.setPlayerLocale('alpha', invalid), 'es', `invalid preference ${String(invalid)} normalizes safely`);
}
const key = player.getStorageKey('alpha');
for (const corrupt of ['{not-json', '{"alpha":"es"}', 'null', '__proto__', 'fr', '', ' de ']) {
  storage.setItem(key, corrupt);
  equal(player.getPlayerLocale('alpha'), 'es', `corrupt storage ${corrupt} normalizes to valid default`);
  equal(storage.getItem(key), 'es', 'corrupt storage is repaired only for its own TCG');
  equal(player.getPlayerLocale('beta'), 'de', 'corruption cannot erase another TCG');
}

const unavailableStorage = { getItem() { throw new Error('Storage blocked'); }, setItem() { throw new Error('Storage blocked'); } };
const blocked = api.createPlayerLocales({ getDescriptor: () => descriptor(), storage: unavailableStorage });
equal(blocked.getPlayerLocale('fixture'), 'de', 'unavailable storage has a usable default');
equal(blocked.setPlayerLocale('fixture', 'es'), 'es', 'unavailable persistence does not break the personal control');
equal(blocked.getPlayerLocale('fixture'), 'es', 'failed persistence retains a personal preference for the current page');
const quotaStorage = memoryStorage();
quotaStorage.setItem = () => { throw new Error('Quota exceeded'); };
const quota = api.createPlayerLocales({ getDescriptor: () => descriptor(), storage: quotaStorage });
equal(quota.setPlayerLocale('fixture', 'es'), 'es', 'write failure is safe even when reads work');
equal(quota.getPlayerLocale('fixture'), 'es', 'failed write does not silently revert the current selection');
const missingStorage = api.createPlayerLocales({ getDescriptor: () => descriptor(), storage: null });
equal(missingStorage.setPlayerLocale('fixture', 'es'), 'es', 'absent storage remains usable');
equal(missingStorage.getPlayerLocale('fixture'), 'es', 'absent storage retains a current-page value');

for (const invalidDescriptor of [null, {}, { ...descriptor(), locales: {} }, { ...descriptor(), locales: { de: { label: 'Deutsch', dataReady: false, visionReady: false } } }, { ...descriptor(), locales: { de: { label: 'Deutsch', dataReady: 'true', visionReady: 'true' } } }, { ...descriptor(), locales: { de: { label: 'Deutsch', dataReady: false, visionReady: true } } }, Object.create(descriptor())]) {
  const future = api.createPlayerLocales({ getDescriptor: () => invalidDescriptor, storage });
  same(future.getAvailablePlayerLocales('future'), [], 'empty/incomplete/non-ready future descriptor produces no selectable locale');
  equal(future.getPlayerLocale('future'), null, 'future descriptor has no invented locale');
  equal(future.setPlayerLocale('future', 'de'), null, 'future descriptor does not throw or add Ready logic');
}
const throwingDescriptor = api.createPlayerLocales({ getDescriptor() { throw new Error('Descriptor unavailable'); }, storage });
same(throwingDescriptor.getAvailablePlayerLocales('fixture'), [], 'unavailable descriptor is safe');
equal(throwingDescriptor.getPlayerLocale('fixture'), null, 'unavailable descriptor does not crash');

// The browser build loads synchronously from local metadata. Evaluation only
// marks the successful metadata script for reuse; no storage, media, data fetch
// or Vision operation runs before app.js.
const browser = {};
const loadedRegistryScript = { dataset: {} };
browser.document = { querySelector(selector) { equal(selector, 'script[src="/game-databases.js"]', 'reuse marker selects only the preloaded registry script'); return loadedRegistryScript; } };
let storageReads = 0;
Object.defineProperty(browser, 'localStorage', { get() { storageReads++; throw new Error('SecurityError'); } });
const sandbox = { window: browser, console };
for (const file of ['game-databases.js', 'database-locale-core.js']) {
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'public', file), 'utf8'), sandbox, { filename: file });
}
vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'public/player-locale.js'), 'utf8'), sandbox, { filename: 'player-locale.js' });
equal(storageReads, 0, 'loading the module does not touch localStorage');
same(loadedRegistryScript.dataset, { tcgateDynamic: '/game-databases.js', loaded: '1' }, 'successful metadata is marked before app.js can resume a Room');
check(typeof browser.TCGatePlayerLocale.getPlayerLocale === 'function', 'UMD exposes its synchronous browser API');
equal(browser.TCGatePlayerLocale.getPlayerLocale('cyberpunk'), 'en', 'browser localStorage getter failure is safe');
equal(browser.TCGatePlayerLocale.setPlayerLocale('cyberpunk', 'en'), 'en', 'browser selection survives storage getter failure');
check(storageReads > 0, 'personal operations attempt the browser storage only when needed');
vm.runInNewContext("window.TCGateGameDatabases = { databases: { cyberpunk: { gameId: 'cyberpunk-tcg', databaseVersion: 'fixture-only', defaultLocale: 'es', locales: { es: { label: 'Espa\\u00f1ol', dataReady: true, visionReady: true } } } } };", sandbox);
equal(browser.TCGatePlayerLocale.getPlayerLocale('cyberpunk'), 'es', 'browser registry metadata is reread after a successful replacement');
equal(browser.TCGatePlayerLocale.getAvailablePlayerLocales('cyberpunk')[0].label, 'Espa\u00f1ol', 'replacement labels come from the current registry');
const failedRegistryScript = { dataset: {} };
let failedRegistryQueries = 0;
const failedMetadataBrowser = { document: { querySelector() { failedRegistryQueries++; return failedRegistryScript; } } };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'public/player-locale.js'), 'utf8'), { window: failedMetadataBrowser }, { filename: 'player-locale.js' });
equal(failedRegistryQueries, 0, 'failed metadata is not treated as a successful load');
same(failedRegistryScript.dataset, {}, 'failed metadata keeps its script unmarked');
check(typeof failedMetadataBrowser.TCGatePlayerLocale.getPlayerLocale === 'function', 'module remains available when browser metadata failed');
equal(failedMetadataBrowser.TCGatePlayerLocale.getPlayerLocale('cyberpunk'), null, 'missing metadata does not invent locales or crash');

console.log(`Player Locale 1.0: PASS (${assertions} assertions; personal metadata and storage only, no Vision filtering).`);
