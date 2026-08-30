(function initDatabaseAdapter(global) {
  'use strict';

  const DEFAULT_REPOSITORY_OWNER = 'maximelaburthe-commits';
  const DEFAULT_BRANCH = 'main';

  function values(payload, preferredKeys) {
    if (Array.isArray(payload)) return payload;
    for (const key of preferredKeys) {
      if (Array.isArray(payload?.[key])) return payload[key];
    }
    if (payload && typeof payload === 'object') return Object.values(payload);
    return [];
  }

  function first(source, paths, fallback = null) {
    for (const path of paths) {
      let value = source;
      for (const part of path.split('.')) value = value?.[part];
      if (value !== undefined && value !== null && value !== '') return value;
    }
    return fallback;
  }

  function normalizeCard(card, fallbackId) {
    const id = first(card, ['id', 'cardId', 'card_id', 'canonicalId', 'canonical_id'], fallbackId);
    const catalogNumber = String(first(card, ['catalogNumber', 'catalog_number'], ''));
    const catalogParts = catalogNumber.match(/^(.+)-(\d+)$/);
    return {
      id: id == null ? null : String(id),
      name: String(first(card, ['name', 'title'], '')),
      subtitle: String(first(card, ['subtitle', 'subTitle', 'subname'], '')),
      type: String(first(card, ['type', 'cardType', 'card_type'], '')),
      set: String(first(card, ['set', 'setId', 'set.id', 'setCode', 'set_code'], catalogParts?.[1] || '')),
      number: String(first(card, ['number', 'collectorNumber', 'collector_number', 'setNumber'], catalogParts?.[2] || '')),
      catalogNumber
    };
  }

  function normalizeVisionRef(ref, fallbackRefId) {
    const printingId = first(ref, ['printingId', 'printing_id', 'id'], fallbackRefId);
    const cardId = first(ref, ['cardId', 'card_id', 'canonicalId', 'canonical_id'], printingId);
    return {
      refId: String(first(ref, ['refId', 'ref_id', 'visionId', 'vision_id', 'id', 'printingId', 'printing_id'], fallbackRefId ?? cardId ?? '')),
      cardId: cardId == null ? null : String(cardId),
      printingId: printingId == null ? null : String(printingId),
      side: String(first(ref, ['side', 'face', 'faceName', 'face_name'], 'front')),
      imageUrl: String(first(ref, ['imageUrl', 'image_url', 'image', 'images.large', 'images.front'], ''))
    };
  }

  function runtimePath(manifest, kind, fallback) {
    const publishedPaths = kind === 'cards'
      ? ['runtime_cards', 'entrypoint']
      : ['vision_index', 'visionIndex'];
    return first(manifest, publishedPaths.concat([
      `runtime.${kind}`,
      `runtime.${kind}Path`,
      `files.${kind}`,
      `paths.${kind}`
    ]), fallback);
  }

  function joinUrl(baseUrl, relativePath) {
    if (/^https?:\/\//i.test(String(relativePath))) return String(relativePath);
    return `${String(baseUrl).replace(/\/$/, '')}/${String(relativePath).replace(/^\//, '')}`;
  }

  async function fetchJson(fetchImpl, url) {
    const response = await fetchImpl(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Database request failed (${response.status}): ${url}`);
    return response.json();
  }

  async function load(gameId, options = {}) {
    const game = global.TCGateGameRegistry?.get(gameId);
    if (!game) throw new Error(`Unknown game: ${gameId}`);
    if (!game.database) return { gameId: game.id, database: null, manifest: null, cards: [], visionIndex: [] };

    const fetchImpl = options.fetch || global.fetch?.bind(global);
    if (!fetchImpl) throw new Error('Fetch API unavailable');
    const baseUrl = options.baseUrl ||
      `https://raw.githubusercontent.com/${DEFAULT_REPOSITORY_OWNER}/${game.database}/${game.databaseRef || DEFAULT_BRANCH}`;
    const manifest = await fetchJson(fetchImpl, joinUrl(baseUrl, 'manifest.json'));
    const cardsPayload = await fetchJson(fetchImpl, joinUrl(baseUrl, runtimePath(manifest, 'cards', 'runtime/cards.min.json')));
    const visionPayload = await fetchJson(fetchImpl, joinUrl(baseUrl, runtimePath(manifest, 'visionIndex', 'runtime/vision-index.json')));

    const cards = values(cardsPayload, ['cards', 'items']).map((card, index) =>
      normalizeCard(card, card?.id ?? card?.cardId ?? index)
    );
    const visionIndex = values(visionPayload, ['visionIndex', 'references', 'prints', 'items']).map((ref, index) =>
      normalizeVisionRef(ref, ref?.refId ?? ref?.id ?? index)
    );

    return { gameId: game.id, database: game.database, manifest, cards, visionIndex };
  }

  global.TCGateDatabaseAdapter = Object.freeze({ load, normalizeCard, normalizeVisionRef, repositoryUrl(gameId) {
    const game=global.TCGateGameRegistry?.get(gameId);if(!game?.database)return null;
    return `https://raw.githubusercontent.com/${DEFAULT_REPOSITORY_OWNER}/${game.database}/${game.databaseRef || DEFAULT_BRANCH}`;
  } });
})(window);
