(function initVisionLocale(root, factory) {
  const core = root?.TCGateDatabaseLocaleCore || (typeof require === 'function' ? require('./database-locale-core.js') : null);
  const api = factory(root, core);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TCGateVisionLocale = api;
})(typeof window !== 'undefined' ? window : globalThis, function createVisionLocale(root, localeCore) {
  'use strict';

  const CACHE_PREFIX = 'tcgate-vision-locale-v1:';
  function createVisionLocales(dependencies = {}) {
    const core = dependencies.core || localeCore;
    const getDescriptor = dependencies.getDescriptor || (gameId => {
      const entry = Object.entries(root?.TCGateGameDatabases?.databases || {}).find(([key, descriptor]) => key === gameId || descriptor.gameId === gameId);
      return entry ? { key: entry[0], descriptor: entry[1] } : null;
    });
    const getSource = () => dependencies.source || root?.TCGateDatabaseSource;

    function context(input) {
      if (!input || input.gameId === 'no-game' || !input.gameId) return null;
      const entry = getDescriptor(input.gameId);
      if (!entry) throw new Error('Vision unavailable for game');
      const raw = entry.descriptor || entry;
      const descriptor = core.normalizeDescriptor(raw);
      // Locale normalization belongs to Player Locale. This boundary never picks
      // a default, broadens a language, or upgrades data readiness to Vision.
      const playerLocale = input.playerLocale;
      if (typeof playerLocale !== 'string' || !Object.prototype.hasOwnProperty.call(descriptor.locales, playerLocale) || descriptor.locales[playerLocale].dataReady !== true || descriptor.locales[playerLocale].visionReady !== true) {
        throw new Error('Vision unavailable for locale');
      }
      const sourceUrl = raw.manifestUrl;
      if (typeof sourceUrl !== 'string' || !sourceUrl) throw new Error('Vision source identity unavailable');
      const sourceIdentity = JSON.stringify([sourceUrl, descriptor.databaseVersion]);
      const visionIndexKey = CACHE_PREFIX + [descriptor.gameId, playerLocale, sourceIdentity].map(encodeURIComponent).join(':');
      return Object.freeze({ gameId: input.gameId, databaseGameId: descriptor.gameId, sourceGameId: entry.key || input.gameId, playerLocale, descriptor, sourceUrl, sourceIdentity, visionIndexKey });
    }

    function assertReferences(references, selected) {
      if (!selected || !Array.isArray(references) || !references.length) throw new Error('Vision locale corpus empty');
      const ids = new Set();
      for (const ref of references) {
        if (!ref || ref.locale !== selected.playerLocale) throw new Error('Vision cross-locale reference rejected');
        if (typeof ref.refId !== 'string' || !ref.refId || ids.has(ref.refId)) throw new Error('Vision reference identity invalid');
        if (typeof ref.cardId !== 'string' || !ref.cardId || typeof ref.referenceImageUrl !== 'string' || !ref.referenceImageUrl) throw new Error('Vision reference provenance invalid');
        ids.add(ref.refId);
      }
      return references;
    }

    async function prepare(input, options = {}) {
      const selected = context(input);
      if (!selected) return null; // Sans jeu causes no source, corpus or index work.
      const source = getSource();
      if (typeof source?.getVisionReferences !== 'function' || typeof source?.load !== 'function') throw new Error('Vision locale source unavailable');
      // The active candidates have one entry point: Locale Core's projection.
      const references = await source.getVisionReferences(selected.sourceGameId, selected.playerLocale, options);
      assertReferences(references, selected);
      // The cached DB provides canonical names and provenance/counts only. Its
      // unfiltered references are never read or used to construct candidates.
      const database = await source.load(selected.sourceGameId, { ...options, force: false });
      if (!database?.cardsById || !database?.manifest) throw new Error('Vision database metadata unavailable');
      const cards = references.map(reference => {
        const canonical = database.cardsById.get(reference.cardId);
        if (!canonical?.name) throw new Error('Vision canonical card unavailable');
        return Object.freeze({
          ...canonical,
          ...reference,
          locale: selected.playerLocale,
          recognitionMode:reference.recognitionMode||null,
          name: canonical.name,
          type: canonical.type || '',
          image: reference.refId,
          imageUrl: reference.displayImageUrl || reference.displayAssetPath || ''
        });
      });
      assertReferences(cards, selected);
      return Object.freeze({
        ...selected,
        cards: Object.freeze(cards),
        referenceCountBeforeLocale: Number(database.manifest.visionReferenceCount || 0),
        referenceCountAfterLocale: cards.length,
        source: 'TCGate public DB direct · Locale Core',
        sourceRef: database.manifest.sourceRef,
        sourceImmutable: /^[a-f0-9]{40}$/i.test(database.manifest.sourceCommit || ''),
        sourceAssetBase: null,
        sourceError: null,
        databaseInfo: { ...database.manifest, playerLocale: selected.playerLocale, visionReferenceCount: cards.length, loadMetrics: database.metrics || null }
      });
    }

    function referenceIdentity(ref) {
      return JSON.stringify([ref.refId, ref.cardId, ref.printingId ?? null, ref.referencePrintingId ?? null, ref.locale, ref.image, ref.referenceImageUrl, ref.imageUrl, ref.recognitionMode ?? null, ref.candidatePrintingIds || []]);
    }
    function fingerprint(cards, sourceRef) {
      return JSON.stringify(['template-v5-fast', sourceRef, cards.map(referenceIdentity)]);
    }
    function validateCache(cache, source) {
      if (!cache) return { status: 'miss', refs: null, sourceCount: null, librarySize: null };
      const failure = status => ({ status, refs: null, sourceCount: cache.sourceCount ?? null, librarySize: Array.isArray(cache.refs) ? cache.refs.length : null });
      if (cache.gameId !== source.databaseGameId || cache.playerLocale !== source.playerLocale || cache.sourceIdentity !== source.sourceIdentity) return failure('invalid-locale-context');
      if (cache.fingerprint !== fingerprint(source.cards, source.sourceRef) || cache.sourceRef !== source.sourceRef) return failure('invalid-source-ref');
      if (!Array.isArray(cache.refs) || cache.sourceCount !== source.cards.length || cache.refs.length !== source.cards.length) return failure('invalid-library-count');
      try { assertReferences(cache.refs, source); } catch { return failure('invalid-locale-references'); }
      const expected = new Map(source.cards.map(ref => [ref.refId, referenceIdentity(ref)]));
      if (cache.refs.some(ref => expected.get(ref.refId) !== referenceIdentity(ref) || !ref.descriptor)) return failure('invalid-reference-provenance');
      return { status: 'hit', refs: cache.refs, sourceCount: cache.sourceCount, librarySize: cache.refs.length };
    }
    function cacheRecord(source, refs) {
      assertReferences(refs, source);
      return { gameId: source.databaseGameId, playerLocale: source.playerLocale, sourceIdentity: source.sourceIdentity, sourceRef: source.sourceRef, fingerprint: fingerprint(source.cards, source.sourceRef), sourceCount: source.cards.length, refs };
    }
    return Object.freeze({ context, prepare, assertReferences, fingerprint, validateCache, cacheRecord });
  }
  return Object.freeze({ ...createVisionLocales(), createVisionLocales, cachePrefix: CACHE_PREFIX });
});
