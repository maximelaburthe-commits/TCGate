'use strict';

const GAME_DATABASES = Object.freeze({
  cyberpunk: Object.freeze({
    owner: 'maximelaburthe-commits',
    repo: 'tcgate_db_cyberpunk',
    ref: '6816051a87ca97cf07096b1a7d98a24a058eeac7',
    gameId: 'cyberpunk-tcg',
    databaseVersion: '1.0.0',
    expectedCanonicalCards: 150,
    expectedVisionReferences: 444
  })
});

const TOKEN_ENV_NAME = 'TCGATE_DB_GITHUB_TOKEN';
const DEFAULT_TIMEOUT_MS = 12000;
const MAX_JSON_BYTES = 8 * 1024 * 1024;
const MAX_ASSET_BYTES = 12 * 1024 * 1024;
const MAX_ASSET_CACHE_ENTRIES = 96;

function safeRepoPath(value) {
  const candidate = String(value || '').trim();
  if (!candidate || candidate.startsWith('/') || candidate.includes('\\') || candidate.includes('\0')) return null;
  if (candidate.split('/').some(part => !part || part === '.' || part === '..')) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(candidate)) return null;
  return candidate;
}

function sendJson(res, status, body, cacheControl = 'no-store') {
  const payload = Buffer.from(JSON.stringify(body));
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': payload.length,
    'Cache-Control': cacheControl,
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(payload);
}

function createDbGateway(options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const env = options.env || process.env;
  const logger = options.logger || console;
  const timeoutMs = Number(options.timeoutMs || DEFAULT_TIMEOUT_MS);
  const now = options.now || Date.now;
  const states = new Map();

  function stateFor(game) {
    if (!states.has(game)) states.set(game, {
      active: null,
      loadPromise: null,
      assetCache: new Map(),
      lastError: null
    });
    return states.get(game);
  }

  function token() {
    return String(env[TOKEN_ENV_NAME] || '').trim();
  }

  async function githubFetch(config, repoPath, { binary = false } = {}) {
    const path = safeRepoPath(repoPath);
    if (!path) throw new Error('unsafe-database-path');
    const authToken = token();
    if (!authToken) throw new Error('github-token-missing');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const url = `https://raw.githubusercontent.com/${config.owner}/${config.repo}/${config.ref}/${path}`;
      const response = await fetchImpl(url, {
        headers: {
          Authorization: `Bearer ${authToken}`,
          Accept: binary ? 'application/octet-stream' : 'application/json',
          'User-Agent': 'TCGate-private-db-gateway'
        },
        signal: controller.signal,
        cache: 'no-store'
      });
      if (!response.ok) throw new Error(`github-http-${response.status}`);
      const declaredLength = Number(response.headers?.get?.('content-length') || 0);
      const maxBytes = binary ? MAX_ASSET_BYTES : MAX_JSON_BYTES;
      if (declaredLength > maxBytes) throw new Error('database-response-too-large');
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > maxBytes) throw new Error('database-response-too-large');
      return binary ? {
        bytes,
        contentType: String(response.headers?.get?.('content-type') || 'application/octet-stream').split(';')[0]
      } : JSON.parse(bytes.toString('utf8'));
    } finally {
      clearTimeout(timer);
    }
  }

  function validateManifest(config, manifest, databaseManifest) {
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new Error('invalid-root-manifest');
    if (!databaseManifest || typeof databaseManifest !== 'object' || Array.isArray(databaseManifest)) throw new Error('invalid-database-manifest');
    const gameId = manifest.game_id || manifest.game;
    const version = manifest.database_version || manifest.databaseVersion;
    if (gameId !== config.gameId || databaseManifest.game?.id !== config.gameId) throw new Error('database-game-mismatch');
    if (version !== config.databaseVersion || databaseManifest.databaseVersion !== config.databaseVersion) throw new Error('database-version-incompatible');
    if (databaseManifest.status !== 'production-reviewed') throw new Error('database-status-not-reviewed');
    const entrypoint = safeRepoPath(manifest.entrypoint || manifest.runtime_cards);
    const visionIndex = safeRepoPath(manifest.visionIndex || manifest.vision_index);
    if (!entrypoint || !visionIndex) throw new Error('database-runtime-path-missing');
    return { gameId, version, entrypoint, visionIndex };
  }

  function validateRuntime(config, cards, references) {
    if (!Array.isArray(cards) || cards.length !== config.expectedCanonicalCards) throw new Error('invalid-canonical-count');
    if (!Array.isArray(references) || references.length !== config.expectedVisionReferences) throw new Error('invalid-vision-reference-count');
    const cardsById = new Map();
    for (const card of cards) {
      if (!card || typeof card !== 'object' || Array.isArray(card) || typeof card.cardId !== 'string' || !card.cardId) throw new Error('invalid-canonical-card');
      if (cardsById.has(card.cardId)) throw new Error('duplicate-card-id');
      cardsById.set(card.cardId, card);
    }
    const printingIds = new Set();
    const assets = new Map();
    const rewrittenReferences = references.map(reference => {
      if (!reference || typeof reference !== 'object' || Array.isArray(reference)) throw new Error('invalid-vision-reference');
      const { cardId, printingId, refId } = reference;
      if (typeof refId !== 'string' || !refId || typeof printingId !== 'string' || !printingId || !cardsById.has(cardId)) throw new Error('invalid-vision-reference-link');
      if (printingIds.has(printingId)) throw new Error('duplicate-printing-id');
      printingIds.add(printingId);
      const visionPath = safeRepoPath(reference.visionAssetPath || reference.referenceImageUrl || reference.imageUrl);
      const displayPath = safeRepoPath(reference.displayAssetPath || reference.imageUrl);
      if (!visionPath?.startsWith('assets/vision/') || !displayPath?.startsWith('assets/display/') || !reference.recognition || reference.recognition.eligible !== true) throw new Error('invalid-vision-reference-assets');
      assets.set(`${printingId}:vision`, visionPath);
      assets.set(`${printingId}:display`, displayPath);
      const assetBase = `/api/db/cyberpunk/assets/${encodeURIComponent(printingId)}`;
      return Object.freeze({
        ...reference,
        imageUrl: `${assetBase}/vision`,
        referenceImageUrl: `${assetBase}/vision`,
        visionAssetPath: `${assetBase}/vision`,
        displayAssetPath: `${assetBase}/display`,
        displayImageUrl: `${assetBase}/display`
      });
    });
    return { cardsById, printingIds, assets, references: Object.freeze(rewrittenReferences) };
  }

  async function fetchAndValidate(game, config) {
    const manifest = await githubFetch(config, 'manifest.json');
    const databaseManifestPath = safeRepoPath(manifest.database_manifest);
    if (!databaseManifestPath) throw new Error('database-manifest-path-missing');
    const databaseManifest = await githubFetch(config, databaseManifestPath);
    const validatedManifest = validateManifest(config, manifest, databaseManifest);
    const [cards, references] = await Promise.all([
      githubFetch(config, validatedManifest.entrypoint),
      githubFetch(config, validatedManifest.visionIndex)
    ]);
    const runtime = validateRuntime(config, cards, references);
    return Object.freeze({
      game,
      config,
      loadedAt: now(),
      manifest: Object.freeze({
        game: game,
        gameId: validatedManifest.gameId,
        databaseVersion: validatedManifest.version,
        databaseStatus: databaseManifest.status,
        sourceRef: config.ref,
        entrypoint: `/api/db/${game}/cards`,
        visionIndex: `/api/db/${game}/vision-index`,
        canonicalCount: cards.length,
        visionReferenceCount: references.length,
        source: 'private-github-server-gateway',
        fallbackActive: false
      }),
      cards: Object.freeze(cards.map(card => Object.freeze({ ...card }))),
      references: runtime.references,
      cardsById: runtime.cardsById,
      assets: runtime.assets
    });
  }

  async function load(game, { force = false } = {}) {
    const config = GAME_DATABASES[game];
    if (!config) throw new Error('unknown-game');
    const state = stateFor(game);
    if (state.active && !force) return state.active;
    if (state.loadPromise) return state.loadPromise;
    state.loadPromise = fetchAndValidate(game, config)
      .then(database => {
        state.active = database;
        state.lastError = null;
        return database;
      })
      .catch(error => {
        state.lastError = { message: error?.message || String(error), at: now() };
        logger.warn?.(`[db-gateway] ${game}: ${state.lastError.message}; last-known-good retained`);
        if (state.active) return state.active;
        throw error;
      })
      .finally(() => { state.loadPromise = null; });
    return state.loadPromise;
  }

  function cacheAsset(state, key, asset) {
    state.assetCache.delete(key);
    state.assetCache.set(key, asset);
    while (state.assetCache.size > MAX_ASSET_CACHE_ENTRIES) state.assetCache.delete(state.assetCache.keys().next().value);
  }

  async function getAsset(game, printingId, kind) {
    const database = await load(game);
    const state = stateFor(game);
    const key = `${printingId}:${kind}`;
    if (!database.assets.has(key)) throw new Error('unknown-asset');
    if (state.assetCache.has(key)) {
      const cached = state.assetCache.get(key);
      cacheAsset(state, key, cached);
      return cached;
    }
    const asset = await githubFetch(database.config, database.assets.get(key), { binary: true });
    if (!/^image\/(webp|png|jpeg)$/.test(asset.contentType)) throw new Error('invalid-asset-content-type');
    cacheAsset(state, key, asset);
    return asset;
  }

  async function handle(req, res, pathname) {
    if (!pathname.startsWith('/api/db/')) return false;
    if (req.method !== 'GET') {
      sendJson(res, 405, { ok: false, error: 'Method not allowed' });
      return true;
    }
    const match = pathname.match(/^\/api\/db\/([a-z0-9-]+)\/(manifest|cards|vision-index)$/);
    const assetMatch = pathname.match(/^\/api\/db\/([a-z0-9-]+)\/assets\/([A-Za-z0-9_-]+)\/(vision|display)$/);
    const game = match?.[1] || assetMatch?.[1];
    if (!game || !GAME_DATABASES[game]) {
      sendJson(res, 404, { ok: false, error: 'Unknown database game' });
      return true;
    }
    try {
      if (assetMatch) {
        const asset = await getAsset(game, assetMatch[2], assetMatch[3]);
        res.writeHead(200, {
          'Content-Type': asset.contentType,
          'Content-Length': asset.bytes.length,
          'Cache-Control': 'private, max-age=86400, immutable',
          'X-Content-Type-Options': 'nosniff'
        });
        res.end(asset.bytes);
        return true;
      }
      const database = await load(game);
      if (match[2] === 'manifest') sendJson(res, 200, database.manifest, 'private, max-age=300');
      else if (match[2] === 'cards') sendJson(res, 200, database.cards, 'private, max-age=300');
      else sendJson(res, 200, database.references, 'private, max-age=300');
      return true;
    } catch (error) {
      const status = error?.message === 'unknown-asset' ? 404 : 503;
      sendJson(res, status, { ok: false, error: status === 404 ? 'Unknown database asset' : 'Database temporarily unavailable' });
      return true;
    }
  }

  function diagnostics(game) {
    const state = stateFor(game);
    return {
      configured: Boolean(GAME_DATABASES[game]),
      tokenConfigured: Boolean(token()),
      cacheReady: Boolean(state.active),
      assetCacheEntries: state.assetCache.size,
      databaseVersion: state.active?.manifest.databaseVersion || null,
      canonicalCount: state.active?.cards.length || 0,
      visionReferenceCount: state.active?.references.length || 0,
      lastError: state.lastError?.message || null
    };
  }

  return Object.freeze({ handle, load, getAsset, diagnostics, safeRepoPath });
}

module.exports = { createDbGateway, GAME_DATABASES, TOKEN_ENV_NAME, safeRepoPath };
