'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const corePath = path.join(__dirname, 'public/database-locale-core.js');
const core = require(corePath);
const PINNED = 'https://raw.githubusercontent.com/maximelaburthe-commits/tcgate_db_cyberpunk/56402636a77af9c8b5dc4e3b61c509a185f3c834/manifest.json';
let assertions = 0;
function equal(actual, expected, message) { assertions += 1; assert.strictEqual(actual, expected, message); }
function same(actual, expected, message) { assertions += 1; assert.deepStrictEqual(actual, expected, message); }
function check(value, message) { assertions += 1; assert(value, message); }
function rejects(callback, pattern, message) { assertions += 1; assert.throws(callback, pattern, message); }

function descriptor(frVisionReady = false) {
  return { gameId: 'cyberpunk-tcg', databaseVersion: '1.1.0', defaultLocale: 'en', locales: {
    en: { label: 'English', dataReady: true, visionReady: true },
    fr: { label: 'Français', dataReady: true, visionReady: frVisionReady }
  } };
}

function fixture(frVisionReady = false) {
  const cards = [{ cardId: 'cp-001', name: 'Canonical card', localized: { en: { name: 'Card' }, fr: { name: 'Carte' } } }];
  const printings = [
    { printingId: 'cp-001-en-standard', cardId: 'cp-001', locale: 'en', variantKind: 'standard', set: { code: 'BASE' } },
    { printingId: 'cp-001-fr-standard', cardId: 'cp-001', locale: 'fr', sourceLocale: 'fr', variantKind: 'standard' },
    { printingId: 'cp-001-en-iconic', cardId: 'cp-001', locale: 'en', variantKind: 'iconic' }
  ];
  const candidates = printings.map(printing => printing.printingId);
  const references = printings.map(printing => ({
    refId: `group-1:${printing.printingId}`, cardId: 'cp-001', referencePrintingId: printing.printingId,
    printingId: null, candidatePrintingIds: [...candidates], recognitionMode: 'shared',
    recognition: { mode: 'shared', eligible: true }, sourceLocale: printing.locale,
    referenceImageUrl: `https://example.test/vision/${printing.printingId}.png`
  }));
  return { descriptor: descriptor(frVisionReady), cards, printings, references };
}

const normalized = core.normalizeDescriptor(descriptor());
equal(normalized.gameId, 'cyberpunk-tcg', 'explicit game identity');
equal(normalized.databaseVersion, '1.1.0', 'explicit database version');
equal(normalized.defaultLocale, 'en', 'default is metadata only');
same(normalized.visionReadyLocales, ['en'], 'readiness is explicit');
same(normalized.locales.fr, { code: 'fr', label: 'Français', dataReady: true, visionReady: false }, 'data-ready does not imply vision-ready');
check(Object.isFrozen(normalized) && Object.isFrozen(normalized.locales) && Object.isFrozen(normalized.locales.en) && Object.isFrozen(normalized.visionReadyLocales), 'descriptor recursively frozen');
const textOnly = descriptor();
textOnly.locales.fr.visionAssets = 150;
textOnly.locales.fr.translations = { count: 150 };
delete textOnly.locales.fr.visionReady;
equal(core.normalizeDescriptor(textOnly).locales.fr.visionReady, false, 'neither text nor assets qualify Vision');
textOnly.locales.fr.visionReady = 'true';
equal(core.normalizeDescriptor(textOnly).locales.fr.visionReady, false, 'string readiness is not qualification');
const invalidReady = descriptor(); invalidReady.locales.fr.dataReady = false; invalidReady.locales.fr.visionReady = true;
rejects(() => core.normalizeDescriptor(invalidReady), /visionReady requires dataReady/, 'Vision requires data availability');
const nonBooleanData = descriptor(); nonBooleanData.locales.fr.dataReady = 'true';
equal(core.normalizeDescriptor(nonBooleanData).locales.fr.dataReady, false, 'data readiness also requires boolean true');
const casing = { ...descriptor(), locales: { EN: { label: 'English', dataReady: true, visionReady: true }, 'fr-fr': { label: 'Français France', dataReady: true, visionReady: false } }, defaultLocale: 'EN' };
const canonicalCodes = core.normalizeDescriptor(casing);
same(Object.keys(canonicalCodes.locales), ['en', 'fr-FR'], 'BCP 47 casing normalized without losing the region');
equal(canonicalCodes.defaultLocale, 'en', 'default casing normalized');
rejects(() => core.normalizeDescriptor({ ...descriptor(), defaultLocale: 'de' }), /Undeclared locale/, 'unknown default rejected');
rejects(() => core.normalizeDescriptor({ ...descriptor(), locales: { en: descriptor().locales.en, EN: descriptor().locales.en } }), /Duplicate normalized locale/, 'normalized duplicate rejected');
rejects(() => core.normalizeDescriptor({ ...descriptor(), locales: { fr_FR: descriptor().locales.fr } }), /invalid BCP 47/, 'non-BCP 47 locale rejected');
rejects(() => core.normalizeDescriptor({ ...descriptor(), locales: JSON.parse('{"__proto__":{"label":"Injected","dataReady":true,"visionReady":true}}') }), /prototype key/, 'prototype key rejected');
rejects(() => core.normalizeDescriptor({ ...descriptor(), locales: Object.create({ en: descriptor().locales.en }) }), /inherited prototype/, 'inherited locale map rejected');
rejects(() => core.normalizeDescriptor({ ...descriptor(), locales: { en: { ...descriptor().locales.en, code: 'fr' } } }), /code mismatch/, 'conflicting locale code rejected');
equal(core.normalizeDescriptor({ ...descriptor(), defaultLocale: undefined }).defaultLocale, null, 'no implicit default');
const ownReadiness = { ...descriptor(), locales: { en: { label: 'English' } } };
const previousReady = Object.getOwnPropertyDescriptors(Object.prototype);
try {
  Object.defineProperty(Object.prototype, 'dataReady', { value: true, configurable: true });
  Object.defineProperty(Object.prototype, 'visionReady', { value: true, configurable: true });
  equal(core.normalizeDescriptor(ownReadiness).locales.en.dataReady, false, 'inherited readiness cannot declare data availability');
  equal(core.normalizeDescriptor(ownReadiness).locales.en.visionReady, false, 'inherited readiness cannot qualify Vision');
} finally {
  for (const key of ['dataReady', 'visionReady']) {
    if (Object.prototype.hasOwnProperty.call(previousReady, key)) Object.defineProperty(Object.prototype, key, previousReady[key]);
    else delete Object.prototype[key];
  }
}

const input = fixture();
const before = JSON.stringify(input);
const view = core.createDatabaseView(input);
equal(JSON.stringify(input), before, 'construction does not mutate source');
equal(view.cards.length, 1, 'one canonical gameplay identity');
equal(view.printings.length, 3, 'language and artwork remain physical printings');
check(view.printings.every(printing => printing.cardId === 'cp-001'), 'cardId remains independent from language');
same(view.getPrintings('en').map(printing => printing.printingId), ['cp-001-en-standard', 'cp-001-en-iconic'], 'printings filtered by physical locale');
same(view.getPrintings('fr').map(printing => printing.printingId), ['cp-001-fr-standard'], 'FR printing has same canonical identity');
equal(view.getPrintings('EN'), view.getPrintings('en'), 'locale lookup canonicalized');
equal(view.getVisionReferences('en').length, 2, 'qualified EN corpus');
equal(view.getVisionReferences('fr').length, 0, 'FR text and physical metadata do not qualify Vision');
check(Object.isFrozen(view.getVisionReferences('fr')), 'unqualified corpus immutable');
rejects(() => view.getVisionReferences('de'), /Undeclared locale/, 'unknown Vision locale rejected');
rejects(() => view.getPrintings('de'), /Undeclared locale/, 'unknown printing locale rejected');
rejects(() => view.getVisionReferences(), /Locale/, 'Vision locale is mandatory despite defaultLocale');
rejects(() => view.getPrintings(), /Locale/, 'printing locale is mandatory');
rejects(() => view.getVisionReferences('fr-FR'), /Undeclared locale/, 'regional locale never falls back to language');
rejects(() => view.getVisionReferences('__proto__'), /prototype key/, 'prototype lookup rejected');

const qualified = core.createDatabaseView(fixture(true));
const french = qualified.getVisionReferences('fr');
equal(french.length, 1, 'explicitly qualified FR corpus available');
check(french.every(reference => reference.locale === 'fr' && reference.sourceLocale === 'fr'), 'only physical FR references enter FR corpus');
same(french[0].candidatePrintingIds, ['cp-001-fr-standard'], 'FR candidates cannot include EN');
equal(french[0].printingId, null, 'narrowing does not invent exact recognition');
equal(french[0].recognitionMode, 'shared', 'ambiguous recognition mode preserved');
equal(french[0].recognition.mode, 'shared', 'nested recognition mode preserved');
check(qualified.getVisionReferences('en').every(reference => reference.candidatePrintingIds.every(id => id.includes('-en-'))), 'EN candidates cannot include FR');
same(fixture(true).references[0].candidatePrintingIds, ['cp-001-en-standard', 'cp-001-fr-standard', 'cp-001-en-iconic'], 'source shared group remains intact');

const twoFaces = fixture(true);
twoFaces.references.push({ ...twoFaces.references[1], refId: 'group-1:cp-001-fr-standard:back', side: 'back', referenceImageUrl: 'https://example.test/vision/back.png' });
twoFaces.references[1].side = 'front';
same(core.createDatabaseView(twoFaces).getVisionReferences('fr').map(reference => reference.side), ['front', 'back'], 'multiple physical faces on one printing supported');

// SWU future compatibility fixture, extracted in read-only mode from
// tcgate_db_star_wars_unlimited main @ 7eaba0779e6542b9b9d44e8737d634389c708499.
// Only a local test adapter is exercised: no SWU registry entry, migration,
// reconstruction or activation. The EN/readiness declarations below are
// synthetic test inputs, never inferred from the URL or applied to SWU itself.
const swuLegacyFixture = {
  cards: [{ id: 'swu-luke-skywalker-i-can-save-him-leader-d2c9df126296', name: 'Luke Skywalker', subtitle: 'I Can Save Him', type: 'Leader' }],
  printings: [{
    id: 'swup-019e6d32-cd99-7768-9d34-75feb5d58bfe',
    cardId: 'swu-luke-skywalker-i-can-save-him-leader-d2c9df126296',
    set: 'ASH', variant: 'Standard',
    frontImageUrl: 'https://cdn.starwarsunlimited.com//card_08010005_EN_Luke_Skywalker_Leader_6431bba672.png',
    backImageUrl: 'https://cdn.starwarsunlimited.com//card_08010005_EN_Luke_Skywalker_Leader_Unit_4b37986e1c.png'
  }],
  references: [
    {
      id: 'swup-019e6d32-cd99-7768-9d34-75feb5d58bfe:front',
      cardId: 'swu-luke-skywalker-i-can-save-him-leader-d2c9df126296',
      printingId: 'swup-019e6d32-cd99-7768-9d34-75feb5d58bfe', side: 'front',
      imageUrl: 'https://cdn.starwarsunlimited.com//card_08010005_EN_Luke_Skywalker_Leader_6431bba672.png'
    },
    {
      id: 'swup-019e6d32-cd99-7768-9d34-75feb5d58bfe:back',
      cardId: 'swu-luke-skywalker-i-can-save-him-leader-d2c9df126296',
      printingId: 'swup-019e6d32-cd99-7768-9d34-75feb5d58bfe', side: 'back',
      imageUrl: 'https://cdn.starwarsunlimited.com//card_08010005_EN_Luke_Skywalker_Leader_Unit_4b37986e1c.png'
    }
  ]
};
const swuLegacyBefore = JSON.stringify(swuLegacyFixture);
const swuDescriptor = { gameId: 'star-wars-unlimited', databaseVersion: '0.2.1', defaultLocale: 'en', locales: {
  en: { label: 'English (synthetic contract fixture)', dataReady: true, visionReady: false }
} };
rejects(() => core.normalizeDescriptor({ ...swuDescriptor, locales: undefined }), /locales/, 'SWU future descriptor requires an explicit locale declaration');
const swuAdapted = {
  descriptor: swuDescriptor,
  cards: swuLegacyFixture.cards.map(({ id, ...card }) => ({ ...card, cardId: id })),
  printings: swuLegacyFixture.printings.map(({ id, ...printing }) => ({ ...printing, printingId: id })),
  references: swuLegacyFixture.references.map(({ id, imageUrl, ...reference }) => ({ ...reference, refId: id, referenceImageUrl: imageUrl }))
};
rejects(() => core.createDatabaseView(swuAdapted), /Printing locale required/, 'SWU historical URLs do not imply a printing locale');
rejects(() => core.createDatabaseView({ ...swuAdapted, legacyLocale: 'en', sourceManifestUrl: 'https://raw.githubusercontent.com/maximelaburthe-commits/tcgate_db_star_wars_unlimited/7eaba0779e6542b9b9d44e8737d634389c708499/manifest.json' }), /restricted to the pinned/, 'SWU cannot borrow the Cyberpunk legacy EN exception');
const swuExplicit = { ...swuAdapted, printings: swuAdapted.printings.map(printing => ({ ...printing, locale: 'en' })) };
const swuUnqualified = core.createDatabaseView(swuExplicit);
equal(swuUnqualified.cards.length, 1, 'SWU legacy card id maps to one canonical cardId');
equal(swuUnqualified.printings.length, 1, 'SWU front and back remain one physical printing');
equal(swuUnqualified.cards[0].cardId, swuLegacyFixture.cards[0].id, 'SWU canonical identity is preserved verbatim');
equal(swuUnqualified.printings[0].printingId, swuLegacyFixture.printings[0].id, 'SWU physical identity is preserved verbatim');
equal(swuUnqualified.printings[0].set, 'ASH', 'SWU set metadata survives explicit mapping');
equal(swuUnqualified.printings[0].variant, 'Standard', 'SWU variant metadata survives explicit mapping');
same(swuUnqualified.getVisionReferences('en'), [], 'SWU metadata and two image faces cannot imply Vision readiness');
same(swuUnqualified.descriptor.visionReadyLocales, [], 'SWU unqualified fixture declares no ready corpus');
const swuQualifiedFixture = core.createDatabaseView({ ...swuExplicit, descriptor: { ...swuDescriptor, locales: {
  en: { ...swuDescriptor.locales.en, visionReady: true }
} } });
const swuFaces = swuQualifiedFixture.getVisionReferences('en');
equal(swuFaces.length, 2, 'Synthetic readiness permits both SWU physical faces without deduping by printingId');
same(swuFaces.map(reference => reference.refId), swuLegacyFixture.references.map(reference => reference.id), 'SWU face reference IDs are preserved verbatim');
same(swuFaces.map(reference => reference.side), ['front', 'back'], 'SWU physical face sides are preserved');
same(swuFaces.map(reference => reference.printingId), swuLegacyFixture.references.map(reference => reference.printingId), 'Both SWU faces retain the same physical printing');
same(swuFaces.map(reference => reference.referenceImageUrl), swuLegacyFixture.references.map(reference => reference.imageUrl), 'SWU face image URLs are preserved without fetching or substitution');
check(swuFaces.every(reference => reference.cardId === swuLegacyFixture.cards[0].id && reference.locale === 'en'), 'SWU faces share one canonical identity and explicitly declared locale');
rejects(() => swuQualifiedFixture.getVisionReferences('fr'), /Undeclared locale/, 'SWU fixture cannot fall back from undeclared FR to EN');
equal(JSON.stringify(swuLegacyFixture), swuLegacyBefore, 'SWU legacy fixture remains unchanged by the local adapter and projections');

check(Object.isFrozen(view) && Object.isFrozen(view.cards) && Object.isFrozen(view.printings) && Object.isFrozen(view.cards[0].localized.fr), 'view recursively frozen');
check(Object.isFrozen(view.getPrintings('en')) && Object.isFrozen(view.getVisionReferences('en')[0].candidatePrintingIds) && Object.isFrozen(view.getVisionReferences('en')[0].recognition), 'filtered results recursively frozen');
rejects(() => { view.cards[0].localized.fr.name = 'Changed'; }, TypeError, 'nested card cannot be changed');
rejects(() => { view.printings[0].locale = 'fr'; }, TypeError, 'printing locale cannot be changed');
rejects(() => { view.getVisionReferences('en')[0].candidatePrintingIds.push('cp-001-fr-standard'); }, TypeError, 'candidate corpus cannot be changed');
input.cards[0].localized.fr.name = 'Changed source';
input.printings[0].set.code = 'Changed set';
input.printings[0].locale = 'fr';
input.references[0].recognition.mode = 'exact';
input.references[0].candidatePrintingIds.length = 0;
input.descriptor.locales.en.label = 'Changed label';
equal(view.cards[0].localized.fr.name, 'Carte', 'card snapshot independent of input mutation');
equal(view.printings[0].set.code, 'BASE', 'printing nested snapshot independent of input mutation');
equal(view.printings[0].locale, 'en', 'physical language snapshot stable');
equal(view.getVisionReferences('en')[0].recognition.mode, 'shared', 'recognition snapshot stable');
equal(view.getVisionReferences('en')[0].candidatePrintingIds.length, 2, 'candidates snapshot stable');
equal(view.descriptor.locales.en.label, 'English', 'descriptor snapshot stable');

function invalidFixture(change, pattern, message) { const value = fixture(true); change(value); rejects(() => core.createDatabaseView(value), pattern, message); }
invalidFixture(value => { value.printings[0].locale = 'de'; }, /Undeclared locale/, 'undeclared physical locale rejected');
invalidFixture(value => { value.printings[0].locale = null; }, /Locale/, 'null physical locale is not inferred');
invalidFixture(value => { delete value.printings[0].locale; }, /Printing locale required/, 'missing locale is not taken from default');
invalidFixture(value => { value.printings[0].sourceLocale = 'fr'; }, /Printing sourceLocale mismatch/, 'printing provenance language checked');
invalidFixture(value => { value.printings[0].cardId = 'cp-missing'; }, /Orphan printing/, 'orphan physical printing rejected');
invalidFixture(value => { value.cards.push(value.cards[0]); }, /Duplicate cardId/, 'duplicate canonical ID rejected');
invalidFixture(value => { value.printings.push(value.printings[0]); }, /Duplicate printingId/, 'duplicate physical ID rejected');
invalidFixture(value => { value.cards[0].mutableFunction = () => {}; }, /JSON data required/, 'non-JSON shared function state rejected');
invalidFixture(value => { value.references[0].locale = 'fr'; }, /Vision locale mismatch/, 'reference locale must match physical printing');
invalidFixture(value => { value.references[0].sourceLocale = 'fr'; }, /Vision sourceLocale mismatch/, 'reference provenance language must match physical printing');
invalidFixture(value => { value.references[0].cardId = 'cp-missing'; }, /Vision cardId mismatch/, 'reference canonical identity checked');
invalidFixture(value => { value.references[0].referencePrintingId = 'missing'; }, /Orphan Vision reference/, 'orphan visual reference rejected');
invalidFixture(value => { value.references[0].printingId = 'cp-001-fr-standard'; }, /Vision printingId mismatch/, 'recognized printing cannot contradict physical reference');
invalidFixture(value => { value.references[0].referencePrintingId = null; value.references[0].printingId = null; }, /Vision physical printingId/, 'cardId alone cannot identify reference language');
invalidFixture(value => { value.references[0].candidatePrintingIds = ['cp-001-fr-standard']; }, /Invalid Vision candidates/, 'physical printing must belong to its source candidate set');
invalidFixture(value => { value.references[0].candidatePrintingIds.push('missing'); }, /Orphan or unrelated Vision candidate/, 'unknown candidate rejected');
invalidFixture(value => { value.references[0].candidatePrintingIds.push(value.references[0].candidatePrintingIds[0]); }, /Invalid Vision candidates/, 'duplicate candidates rejected');

const legacy = { descriptor: { ...descriptor(), locales: { en: descriptor().locales.en } },
  cards: [{ cardId: 'legacy-card' }], printings: [{ printingId: 'legacy-print', cardId: 'legacy-card' }],
  references: [{ cardId: 'legacy-card', printingId: 'legacy-print', recognitionMode: 'exact', referenceImageUrl: 'https://example.test/legacy.png' }],
  sourceManifestUrl: PINNED, legacyLocale: 'en' };
const legacyView = core.createDatabaseView(legacy);
equal(legacyView.printings[0].locale, 'en', 'pinned production legacy printing normalized EN');
equal(legacyView.getVisionReferences('en')[0].locale, 'en', 'pinned production legacy reference normalized EN');
equal(legacyView.getVisionReferences('en')[0].printingId, 'legacy-print', 'legacy exact recognition preserved');
equal(legacy.printings[0].locale, undefined, 'legacy source not rewritten');
rejects(() => core.createDatabaseView({ ...legacy, legacyLocale: undefined }), /Printing locale required/, 'legacy normalization requires explicit authorization');
rejects(() => core.createDatabaseView({ ...legacy, sourceManifestUrl: PINNED.replace('56402636a77af9c8b5dc4e3b61c509a185f3c834', 'main') }), /restricted to the pinned/, 'mutable source cannot acquire implicit EN');
rejects(() => core.createDatabaseView({ ...legacy, sourceManifestUrl: 'https://example.test/manifest.json' }), /restricted to the pinned/, 'unknown source cannot acquire implicit EN');
rejects(() => core.createDatabaseView({ ...legacy, descriptor: { ...legacy.descriptor, gameId: 'other-tcg' } }), /restricted to the pinned/, 'legacy rule scoped to Cyberpunk');
rejects(() => core.createDatabaseView({ ...legacy, descriptor: { ...legacy.descriptor, databaseVersion: '1.2.0' } }), /restricted to the pinned/, 'legacy rule scoped to proven version');
rejects(() => core.createDatabaseView({ ...legacy, legacyLocale: 'fr' }), /restricted to the pinned/, 'legacy FR never invented');

const browser = { window: {} };
vm.createContext(browser);
vm.runInContext(fs.readFileSync(corePath, 'utf8'), browser, { filename: 'database-locale-core.js' });
equal(typeof browser.window.TCGateDatabaseLocaleCore.normalizeDescriptor, 'function', 'UMD browser API without require');
equal(typeof browser.window.TCGateDatabaseLocaleCore.createDatabaseView, 'function', 'UMD browser view API without require');
equal(vm.runInContext("window.TCGateDatabaseLocaleCore.normalizeDescriptor({gameId:'future-tcg',databaseVersion:'1',locales:{en:{label:'English',dataReady:true,visionReady:false}},defaultLocale:'en'}).locales.en.visionReady", browser), false, 'browser path respects explicit readiness');
check(Object.isFrozen(core), 'public API frozen');

async function integration() {
  const registry = require('./public/game-databases.js');
  const source = require('./public/database-source.js');
  const fixtureRoot = process.env.TCGATE_DB_FIXTURE_ROOT;
  const transport = fixtureRoot ? 'real immutable corpus / local fixture' : 'real immutable corpus / public GitHub';
  const rawResources = new Map();
  const prefix = PINNED.slice(0, PINNED.lastIndexOf('/') + 1);
  let requests = 0, publicDownloads = 0, generation = 0;
  let cardResource = null;

  async function fetchImpl(url, options) {
    requests += 1;
    equal(options.credentials, 'omit', 'database fetch remains public without credentials');
    equal(options.cache, 'force-cache', 'active loader cache policy preserved');
    check(String(url).startsWith(prefix), 'all seven resources stay pinned to immutable Cyberpunk source');
    if (!rawResources.has(url)) {
      let text;
      if (fixtureRoot) text = fs.readFileSync(path.join(fixtureRoot, String(url).slice(prefix.length)), 'utf8');
      else {
        const response = await fetch(url, { credentials: 'omit', cache: 'no-cache' });
        equal(response.status, 200, 'immutable public fixture available');
        publicDownloads += 1;
        text = await response.text();
      }
      rawResources.set(url, text);
      if (url === PINNED) {
        const manifest = JSON.parse(text);
        cardResource = new URL(manifest.entrypoint || manifest.runtime_cards, PINNED).href;
      }
    }
    let text = rawResources.get(url);
    // Later generations exercise cache invalidation against changed transport
    // content in memory. The downloaded/local immutable fixture stays untouched.
    if (generation > 0 && url === cardResource) {
      const cards = JSON.parse(text);
      cards[0].name += ` [cache fixture generation ${generation}]`;
      text = JSON.stringify(cards);
    }
    return new Response(text, { status: 200, headers: { 'content-type': 'application/json' } });
  }
  async function rejected(callback, pattern, message) { assertions += 1; await assert.rejects(callback, pattern, message); }
  const options = { fetchImpl };
  source.clear();
  const active = await source.load('cyberpunk', options);
  const activeBefore = JSON.stringify({ manifest: active.manifest, cards: active.cards, printings: active.printings, references: active.references, groups: active.recognitionGroups });
  const firstName = active.cards[0].name;
  equal(requests, 7, 'active loader still fetches exactly seven resources');
  equal(active.metrics.requests, 7, 'active metrics preserve seven requests');
  equal(active.cards.length, 150, 'real production canonical card count');
  equal(active.printings.length, 229, 'real production physical printing count');
  equal(active.references.length, 229, 'real active matcher still receives 229 references');
  check(active.printings.every(printing => !Object.prototype.hasOwnProperty.call(printing, 'locale')), 'production legacy printings remain unmodified');

  const localeView = await source.getLocaleDatabase('cyberpunk', options);
  equal(await source.getLocaleDatabase('cyberpunk-tcg', options), localeView, 'alias and canonical gameId share one locale view');
  equal(requests, 7, 'locale projection adds no fetch to active loader');
  const vision = await source.getVisionReferences('cyberpunk-tcg', 'en', options);
  equal(vision, localeView.getVisionReferences('en'), 'runtime locale helper exposes the isolated view');
  equal(vision.length, 229, 'all physical EN references retained');
  equal(vision.filter(reference => reference.recognitionMode === 'exact').length, 83, '83 exact references preserved');
  equal(vision.filter(reference => reference.recognitionMode === 'shared').length, 146, '146 shared references preserved');
  check(vision.every(reference => reference.locale === 'en'), 'legacy compatibility produces EN only');
  check(vision.filter(reference => reference.recognitionMode === 'shared').every(reference => reference.printingId === null && reference.candidatePrintingIds.length > 1), 'real shared ambiguity never promoted');
  same(vision.map(({ locale, ...reference }) => reference), active.references, 'legacy locale projection preserves every active reference field and order');
  same(localeView.printings.map(({ locale, ...printing }) => printing), active.printings, 'locale view copies rather than rewrites production printings');
  same(localeView.cards, active.cards, 'canonical records unchanged');
  check(localeView.cards !== active.cards && localeView.printings !== active.printings && vision !== active.references, 'projection owns independent immutable snapshots');
  equal(await source.load('cyberpunk', options), active, 'active session cache identity preserved');
  equal(JSON.stringify({ manifest: active.manifest, cards: active.cards, printings: active.printings, references: active.references, groups: active.recognitionGroups }), activeBefore, 'opt-in locale API changes no active corpus or manifest data');
  await rejected(() => source.getVisionReferences('cyberpunk', 'fr', options), /Undeclared locale/, 'production FR absent and never falls back to EN');
  await rejected(() => source.getVisionReferences('cyberpunk', 'en-US', options), /Undeclared locale/, 'production regional locale never falls back to EN');
  await rejected(() => source.getVisionReferences('cyberpunk', undefined, options), /Locale/, 'runtime API requires explicit locale');
  equal(registry.get('star-wars-unlimited'), null, 'SWU remains outside active database registry');
  equal(registry.get('swu'), null, 'no SWU activation alias');
  await rejected(() => source.getLocaleDatabase('star-wars-unlimited', options), /DB inconnue/, 'SWU locale helper cannot activate a database');
  equal(requests, 7, 'rejected locale/game requests add no network access');

  generation = 1;
  const forcedView = await source.getLocaleDatabase('cyberpunk-tcg', { ...options, force: true });
  check(forcedView !== localeView, 'force through new API discards the old locale view');
  equal(forcedView.cards[0].name, firstName + ' [cache fixture generation 1]', 'forced locale view uses new transport data');
  equal(requests, 14, 'force reload requests exactly seven resources');
  equal(await source.getLocaleDatabase('cyberpunk', options), forcedView, 'forced view cached for both game aliases');
  equal(localeView.cards[0].name, firstName, 'earlier snapshot survives a later force reload');

  generation = 2;
  const forcedActive = await source.load('cyberpunk', { ...options, force: true });
  const afterActiveForce = await source.getLocaleDatabase('cyberpunk-tcg', options);
  check(afterActiveForce !== forcedView, 'force through active API cannot reuse stale locale snapshot');
  equal(afterActiveForce.cards[0].name, firstName + ' [cache fixture generation 2]', 'active force propagated to opt-in view');
  equal(forcedActive.cards[0].name, afterActiveForce.cards[0].name, 'active corpus and locale snapshot agree after force');
  equal(requests, 21, 'active force adds exactly seven requests');

  generation = 3;
  source.clear('cyberpunk'); // Existing clear API uses registry keys, not canonical IDs.
  const afterClear = await source.getLocaleDatabase('cyberpunk-tcg', options);
  check(afterClear !== afterActiveForce, 'registry-key clear cannot leave stale locale snapshot');
  equal(afterClear.cards[0].name, firstName + ' [cache fixture generation 3]', 'clear reload obtains current data');
  equal(requests, 28, 'registry-key clear adds exactly seven requests');

  generation = 4;
  source.clear();
  const afterClearAll = await source.getLocaleDatabase('cyberpunk', options);
  check(afterClearAll !== afterClear, 'global clear cannot leave stale locale snapshot');
  equal(afterClearAll.cards[0].name, firstName + ' [cache fixture generation 4]', 'global clear reload obtains current data');
  equal(requests, 35, 'global clear adds exactly seven requests');
  equal(rawResources.size, 7, 'only the seven original fixture documents needed');
  equal(publicDownloads, fixtureRoot ? 0 : 7, 'public transport downloads immutable fixture only once');
  equal(localeView.cards[0].name, firstName, 'initial view intact after all cache changes');
  source.clear();
  console.log(`LOCALE_CORE_RUNTIME_INTEGRATION_OK · ${transport} · initial requests=7 · cache exercise requests=${requests} · public downloads=${publicDownloads} · 150 cards / 229 references / 83 exact / 146 shared`);
}

integration().then(() => {
  console.log(`DATABASE_LOCALE_CORE_OK · ${assertions} assertions · explicit readiness, physical locale isolation, canonical identity, immutable views, pinned legacy EN, browser UMD and cached runtime integration`);
}).catch(error => { console.error(error); process.exitCode = 1; });
