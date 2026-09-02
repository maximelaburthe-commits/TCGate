(function initDatabaseSource(root, factory) {
  const configApi = root?.TCGateGameDatabases || (typeof require === 'function' ? require('./game-databases.js') : null);
  const api = factory(configApi);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TCGateDatabaseSource = api;
})(typeof window !== 'undefined' ? window : globalThis, function createDatabaseSource(configApi) {
  'use strict';

  const sessionCache = new Map();

  async function fetchJson(fetchImpl, path) {
    if (typeof path !== 'string' || !path.startsWith('/api/db/') || path.includes('..') || path.includes('\\')) throw new Error('Chemin DB non autorisé');
    const response = await fetchImpl(path, { cache: 'no-cache', credentials: 'same-origin' });
    if (!response.ok) throw new Error(`DB HTTP ${response.status}`);
    return response.json();
  }

  function validate(config, manifest, cards, references) {
    if (!manifest || manifest.game !== config.expectedGame) throw new Error('Manifest DB : jeu invalide');
    if (manifest.databaseVersion !== config.expectedVersion) throw new Error('Manifest DB : version incompatible');
    if (manifest.databaseStatus !== config.expectedStatus) throw new Error('Manifest DB : statut invalide');
    if (!manifest.entrypoint || !manifest.visionIndex) throw new Error('Manifest DB : runtime absent');
    if (!Array.isArray(cards) || cards.length !== config.expectedCanonicalCards) throw new Error('Runtime DB : cardinalité canonique invalide');
    if (!Array.isArray(references) || references.length !== config.expectedVisionReferences) throw new Error('Runtime DB : cardinalité Vision invalide');

    const cardsById = new Map();
    for (const card of cards) {
      if (!card || typeof card.cardId !== 'string' || !card.cardId || cardsById.has(card.cardId)) throw new Error('Runtime DB : cardId invalide ou dupliqué');
      cardsById.set(card.cardId, Object.freeze({ ...card }));
    }
    const printingIds = new Set();
    const normalizedReferences = references.map(reference => {
      if (!reference || typeof reference.refId !== 'string' || typeof reference.printingId !== 'string' || !cardsById.has(reference.cardId)) throw new Error('Runtime DB : référence Vision orpheline');
      if (printingIds.has(reference.printingId)) throw new Error('Runtime DB : printingId dupliqué');
      if (!String(reference.imageUrl || '').startsWith('/api/db/') || !String(reference.displayImageUrl || reference.displayAssetPath || '').startsWith('/api/db/')) throw new Error('Runtime DB : asset non same-origin');
      printingIds.add(reference.printingId);
      return Object.freeze({ ...reference });
    });
    return Object.freeze({
      manifest: Object.freeze({ ...manifest }),
      cards: Object.freeze([...cardsById.values()]),
      cardsById,
      references: Object.freeze(normalizedReferences),
      printingIds
    });
  }

  async function loadUncached(game, fetchImpl) {
    const config = configApi?.get?.(game);
    if (!config) throw new Error(`DB inconnue : ${game}`);
    const manifest = await fetchJson(fetchImpl, config.manifestUrl);
    const [cards, references] = await Promise.all([
      fetchJson(fetchImpl, manifest.entrypoint),
      fetchJson(fetchImpl, manifest.visionIndex)
    ]);
    return validate(config, manifest, cards, references);
  }

  function load(game, options = {}) {
    const key = String(game || '');
    const fetchImpl = options.fetchImpl || globalThis.fetch;
    if (typeof fetchImpl !== 'function') return Promise.reject(new Error('Fetch indisponible'));
    if (options.force) sessionCache.delete(key);
    if (!sessionCache.has(key)) {
      const promise = loadUncached(key, fetchImpl).catch(error => {
        sessionCache.delete(key);
        throw error;
      });
      sessionCache.set(key, promise);
    }
    return sessionCache.get(key);
  }

  function clear(game) {
    if (game == null) sessionCache.clear();
    else sessionCache.delete(String(game));
  }

  return Object.freeze({ load, clear, validate, fetchJson });
});
