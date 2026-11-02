(function initDatabaseLocaleCore(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TCGateDatabaseLocaleCore = api;
})(typeof window !== 'undefined' ? window : globalThis, function createDatabaseLocaleCore() {
  'use strict';

  const LEGACY_CYBERPUNK_MANIFEST = 'https://raw.githubusercontent.com/maximelaburthe-commits/tcgate_db_cyberpunk/56402636a77af9c8b5dc4e3b61c509a185f3c834/manifest.json';
  const EMPTY = Object.freeze([]);
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

  function plainObject(value, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label}: object required`);
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw new Error(`${label}: inherited prototype rejected`);
    return value;
  }

  function identifier(value, label) {
    if (typeof value !== 'string' || !value.trim() || value !== value.trim()) throw new Error(`${label}: non-empty string required`);
    return value;
  }

  function localeCode(value) {
    identifier(value, 'Locale');
    if (['__proto__', 'constructor', 'prototype'].includes(value.toLowerCase())) throw new Error('Locale: prototype key rejected');
    try {
      const normalized = Intl.getCanonicalLocales(value);
      if (normalized.length !== 1) throw new Error('Locale required');
      return normalized[0];
    } catch {
      throw new Error(`Locale: invalid BCP 47 code ${value}`);
    }
  }

  function declaredLocale(descriptor, value) {
    const code = localeCode(value);
    if (!own(descriptor.locales, code)) throw new Error(`Undeclared locale: ${code}`);
    return code;
  }

  // All values originate in JSON contracts. Copy before freezing so callers retain
  // ownership of their inputs, and later input mutations cannot change the view.
  function snapshot(value, ancestors = new Set()) {
    if (typeof value === 'function' || typeof value === 'symbol') throw new Error('Database value: JSON data required');
    if (value === null || typeof value !== 'object') return value;
    if (ancestors.has(value)) throw new Error('Database value: cyclic input rejected');
    ancestors.add(value);
    let copied;
    if (Array.isArray(value)) copied = value.map(item => snapshot(item, ancestors));
    else {
      plainObject(value, 'Database value');
      copied = {};
      for (const key of Object.keys(value)) {
        Object.defineProperty(copied, key, { value: snapshot(value[key], ancestors), enumerable: true, configurable: true, writable: true });
      }
    }
    ancestors.delete(value);
    return Object.freeze(copied);
  }

  function normalizeDescriptor(input) {
    plainObject(input, 'Database descriptor');
    const gameId = identifier(input.gameId, 'gameId');
    const databaseVersion = identifier(input.databaseVersion, 'databaseVersion');
    plainObject(input.locales, 'locales');
    const locales = {};
    for (const rawCode of Object.keys(input.locales)) {
      const code = localeCode(rawCode);
      if (own(locales, code)) throw new Error(`Duplicate normalized locale: ${code}`);
      const source = plainObject(input.locales[rawCode], `Locale ${code}`);
      if (source.code !== undefined && localeCode(source.code) !== code) throw new Error(`Locale code mismatch: ${code}`);
      const label = identifier(source.label, `Locale ${code} label`);
      const dataReady = own(source, 'dataReady') && source.dataReady === true;
      const visionReady = own(source, 'visionReady') && source.visionReady === true;
      if (visionReady && !dataReady) throw new Error(`Locale ${code}: visionReady requires dataReady`);
      locales[code] = Object.freeze({ code, label, dataReady, visionReady });
    }
    if (!Object.keys(locales).length) throw new Error('At least one declared locale required');
    Object.freeze(locales);
    const descriptor = { gameId, databaseVersion, locales };
    const defaultLocale = input.defaultLocale == null ? null : declaredLocale(descriptor, input.defaultLocale);
    const visionReadyLocales = Object.freeze(Object.keys(locales).filter(code => locales[code].visionReady));
    return Object.freeze({ ...descriptor, defaultLocale, visionReadyLocales });
  }

  function createDatabaseView(input) {
    plainObject(input, 'Database view');
    const descriptor = normalizeDescriptor(input.descriptor);
    for (const key of ['cards', 'printings', 'references']) if (!Array.isArray(input[key])) throw new Error(`${key}: array required`);

    let legacyLocale = null;
    if (input.legacyLocale !== undefined && input.legacyLocale !== null) {
      legacyLocale = localeCode(input.legacyLocale);
      if (legacyLocale !== 'en' || input.sourceManifestUrl !== LEGACY_CYBERPUNK_MANIFEST || descriptor.gameId !== 'cyberpunk-tcg' || descriptor.databaseVersion !== '1.1.0') {
        throw new Error('Legacy locale normalization is restricted to the pinned Cyberpunk 1.1.0 EN source');
      }
      declaredLocale(descriptor, legacyLocale);
    }

    const cardsById = new Map();
    const cards = Object.freeze(input.cards.map(source => {
      plainObject(source, 'Canonical card');
      const cardId = identifier(source.cardId, 'cardId');
      if (cardsById.has(cardId)) throw new Error(`Duplicate cardId: ${cardId}`);
      const card = snapshot(source);
      cardsById.set(cardId, card);
      return card;
    }));

    const printingsById = new Map();
    const printings = Object.freeze(input.printings.map(source => {
      plainObject(source, 'Printing');
      const printingId = identifier(source.printingId, 'printingId');
      const cardId = identifier(source.cardId, 'Printing cardId');
      if (printingsById.has(printingId)) throw new Error(`Duplicate printingId: ${printingId}`);
      if (!cardsById.has(cardId)) throw new Error(`Orphan printing: ${printingId}`);
      const missingLocale = !own(source, 'locale') || source.locale === undefined;
      if (missingLocale && !legacyLocale) throw new Error(`Printing locale required: ${printingId}`);
      const locale = declaredLocale(descriptor, missingLocale ? legacyLocale : source.locale);
      if (source.sourceLocale !== undefined && localeCode(source.sourceLocale) !== locale) throw new Error(`Printing sourceLocale mismatch: ${printingId}`);
      const printing = snapshot({ ...source, locale });
      printingsById.set(printingId, printing);
      return printing;
    }));

    const referencesByLocale = new Map(Object.keys(descriptor.locales).map(code => [code, []]));
    for (const source of input.references) {
      plainObject(source, 'Vision reference');
      const physicalPrintingId = identifier(source.referencePrintingId || source.printingId, 'Vision physical printingId');
      const printing = printingsById.get(physicalPrintingId);
      if (!printing) throw new Error(`Orphan Vision reference: ${physicalPrintingId}`);
      if (source.cardId !== printing.cardId) throw new Error(`Vision cardId mismatch: ${physicalPrintingId}`);
      if (source.printingId != null && source.printingId !== physicalPrintingId) throw new Error(`Vision printingId mismatch: ${physicalPrintingId}`);
      const locale = printing.locale;
      if (source.locale !== undefined && localeCode(source.locale) !== locale) throw new Error(`Vision locale mismatch: ${physicalPrintingId}`);
      if (source.sourceLocale !== undefined && localeCode(source.sourceLocale) !== locale) throw new Error(`Vision sourceLocale mismatch: ${physicalPrintingId}`);
      const normalized = { ...source, locale };
      if (source.candidatePrintingIds !== undefined) {
        if (!Array.isArray(source.candidatePrintingIds)) throw new Error('Vision candidatePrintingIds: array required');
        const candidates = source.candidatePrintingIds.map(id => {
          const candidate = printingsById.get(identifier(id, 'Vision candidate printingId'));
          if (!candidate || candidate.cardId !== printing.cardId) throw new Error(`Orphan or unrelated Vision candidate: ${id}`);
          return candidate;
        });
        if (new Set(source.candidatePrintingIds).size !== source.candidatePrintingIds.length || !source.candidatePrintingIds.includes(physicalPrintingId)) throw new Error(`Invalid Vision candidates: ${physicalPrintingId}`);
        normalized.candidatePrintingIds = candidates.filter(candidate => candidate.locale === locale).map(candidate => candidate.printingId);
      }
      // Multiple faces/references may legitimately share one physical printing.
      // Projection never upgrades an ambiguous/shared mode or picks a printing.
      referencesByLocale.get(locale).push(snapshot(normalized));
    }

    const printingsByLocale = new Map(Object.keys(descriptor.locales).map(code => [code, Object.freeze(printings.filter(printing => printing.locale === code))]));
    for (const [code, references] of referencesByLocale) referencesByLocale.set(code, Object.freeze(references));
    function getPrintings(locale) { return printingsByLocale.get(declaredLocale(descriptor, locale)); }
    function getVisionReferences(locale) {
      const code = declaredLocale(descriptor, locale);
      return descriptor.locales[code].visionReady ? referencesByLocale.get(code) : EMPTY;
    }
    return Object.freeze({ descriptor, cards, printings, getPrintings, getVisionReferences });
  }

  return Object.freeze({ normalizeDescriptor, createDatabaseView });
});
