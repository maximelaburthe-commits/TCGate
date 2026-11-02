(function initPlayerLocale(root, factory) {
  const databases = root && root.TCGateGameDatabases || (typeof require === 'function' ? require('./game-databases.js') : null);
  const localeCore = root && root.TCGateDatabaseLocaleCore || (typeof require === 'function' ? require('./database-locale-core.js') : null);
  const api = factory(root, databases, localeCore);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TCGatePlayerLocale = api;
  // The metadata script has already completed before app.js may resume a Room.
  // Let its existing script loader reuse that successful load, without reloading
  // the registry or marking a failed metadata request as ready.
  try {
    if (root && root.TCGateGameDatabases && root.document && typeof root.document.querySelector === 'function') {
      const registryScript = root.document.querySelector('script[src="/game-databases.js"]');
      if (registryScript && registryScript.dataset) {
        registryScript.dataset.tcgateDynamic = '/game-databases.js';
        registryScript.dataset.loaded = '1';
      }
    }
  } catch { /* Metadata reuse is optional outside a browser document. */ }
})(typeof window !== 'undefined' ? window : globalThis, function createPlayerLocaleModule(root, databases, localeCore) {
  'use strict';

  const STORAGE_KEY_PREFIX = 'tcgate-player-locale-v1:';
  const EMPTY = Object.freeze([]);
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const validGame = value => typeof value === 'string' && value.length > 0 && value === value.trim() && !['__proto__', 'prototype', 'constructor', 'toString'].includes(value);

  function registeredDescriptor(gameId) {
    const currentDatabases = root && root.TCGateGameDatabases || databases;
    if (!validGame(gameId) || !currentDatabases) return null;
    const registry = currentDatabases.databases;
    if (!registry || typeof registry !== 'object') return null;
    if (own(registry, gameId)) return registry[gameId];
    // Public room ids and the canonical database id identify one personal preference.
    return Object.keys(registry).map(key => registry[key]).find(descriptor => descriptor && descriptor.gameId === gameId) || null;
  }

  function createPlayerLocales(options = {}) {
    const getDescriptor = typeof options.getDescriptor === 'function' ? options.getDescriptor : registeredDescriptor;
    const storageSource = own(options, 'storage') ? options.storage : () => root && root.localStorage;
    // Failed persistence still leaves a usable personal preference for this page.
    const unsaved = new Map();

    function context(gameId) {
      if (!validGame(gameId) || !localeCore || typeof localeCore.normalizeDescriptor !== 'function') return null;
      try {
        const source = getDescriptor(gameId);
        if (!source || typeof source !== 'object' || Array.isArray(source)) return null;
        const prototype = Object.getPrototypeOf(source);
        if (prototype !== Object.prototype && prototype !== null) return null;
        if (!validGame(source.gameId)) return null;
        // A stale/invalid default must not hide otherwise valid declared languages.
        let descriptor = localeCore.normalizeDescriptor({ ...source, defaultLocale: null });
        try { descriptor = localeCore.normalizeDescriptor(source); } catch { /* Use the valid declarations without a default. */ }
        const available = Object.freeze(Object.values(descriptor.locales).filter(locale => locale.dataReady === true && locale.visionReady === true));
        return { descriptor, available, key: STORAGE_KEY_PREFIX + encodeURIComponent(descriptor.gameId) };
      } catch {
        // Unknown games, incomplete future descriptors and unavailable dependencies
        // do not create a new Room/Ready gate.
        return null;
      }
    }

    function normalize(current, value) {
      if (!current || !current.available.length) return null;
      let candidate = null;
      if (typeof value === 'string') {
        try { candidate = localeCore.normalizeDescriptor({ ...current.descriptor, defaultLocale: value }).defaultLocale; } catch { /* Unknown or malformed saved value. */ }
      }
      if (current.available.some(locale => locale.code === candidate)) return candidate;
      if (current.available.some(locale => locale.code === current.descriptor.defaultLocale)) return current.descriptor.defaultLocale;
      return current.available[0].code;
    }

    function storage() {
      return typeof storageSource === 'function' ? storageSource() : storageSource;
    }

    function read(key) {
      if (unsaved.has(key)) return unsaved.get(key);
      try {
        const target = storage();
        return target && typeof target.getItem === 'function' ? target.getItem(key) : null;
      } catch { return null; }
    }

    function write(key, value) {
      try {
        const target = storage();
        if (!target || typeof target.setItem !== 'function') throw new Error('Personal storage unavailable');
        target.setItem(key, value);
        unsaved.delete(key);
      } catch { unsaved.set(key, value); }
    }

    function getAvailablePlayerLocales(gameId) { return context(gameId)?.available || EMPTY; }
    function normalizePlayerLocale(gameId, value) { return normalize(context(gameId), value); }
    function getStorageKey(gameId) { return context(gameId)?.key || null; }

    function getPlayerLocale(gameId) {
      const current = context(gameId);
      if (!current || !current.available.length) return null;
      const saved = read(current.key);
      const normalized = normalize(current, saved);
      // Persist the first valid default and repair obsolete preferences independently
      // of other TCGs; later descriptor defaults must not replace a personal choice.
      if (saved !== normalized) write(current.key, normalized);
      return normalized;
    }

    function setPlayerLocale(gameId, value) {
      const current = context(gameId);
      const normalized = normalize(current, value);
      if (normalized !== null) write(current.key, normalized);
      return normalized;
    }

    return Object.freeze({ getAvailablePlayerLocales, getPlayerLocale, setPlayerLocale, normalizePlayerLocale, getStorageKey });
  }

  return Object.freeze({ ...createPlayerLocales(), createPlayerLocales, storageKeyPrefix: STORAGE_KEY_PREFIX });
});
