(function initVisionLibraryIntegrity(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TCGateVisionLibraryIntegrity = api;
})(typeof window !== 'undefined' ? window : globalThis, function createVisionLibraryIntegrity() {
  'use strict';

  function validateCache(cache, { fingerprint, sourceCount, sourceRef }) {
    if (!cache) return { status: 'miss', refs: null, sourceCount: null, librarySize: null };
    const cacheSourceReferences = Number.isInteger(cache.sourceCount) ? cache.sourceCount : null;
    const cacheLibrarySize = Array.isArray(cache.refs) ? cache.refs.length : null;
    if (cache.fingerprint !== fingerprint) return { status: 'invalid-fingerprint', refs: null, sourceCount: cacheSourceReferences, librarySize: cacheLibrarySize };
    if (cache.sourceRef !== sourceRef) return { status: 'invalid-source-ref', refs: null, sourceCount: cacheSourceReferences, librarySize: cacheLibrarySize };
    if (cacheSourceReferences !== sourceCount) return { status: 'invalid-source-count', refs: null, sourceCount: cacheSourceReferences, librarySize: cacheLibrarySize };
    if (cacheLibrarySize !== sourceCount) return { status: 'invalid-library-count', refs: null, sourceCount: cacheSourceReferences, librarySize: cacheLibrarySize };
    return { status: 'hit', refs: cache.refs, sourceCount: cacheSourceReferences, librarySize: cacheLibrarySize };
  }

  function assess({ sourceReferences = 0, loadedReferences = 0, failedReferences = 0, cacheStatus = 'miss', cacheSourceReferences = null, cacheLibrarySize = null, baselineMinimum = 0, source = null, sourceUrl = null, sourceRef = null, sourceImmutable = false, sourceError = null, failed = [] } = {}) {
    let reason = null;
    if (sourceReferences < baselineMinimum) reason = 'source-below-validated-alpha-baseline';
    else if (loadedReferences !== sourceReferences || failedReferences > 0) reason = 'reference-assets-incomplete';
    else if (sourceError) reason = 'source-fallback-active';
    else if (!sourceImmutable) reason = 'source-not-immutable';
    return Object.freeze({ sourceReferences, loadedReferences, failedReferences, cacheStatus, cacheSourceReferences, cacheLibrarySize, degraded: Boolean(reason), reason, baselineMinimum, source, sourceUrl, sourceRef, sourceImmutable, sourceError, failed: failed.slice(0, 25) });
  }

  function averageMs(totalSeconds, frames) {
    const total = Number(totalSeconds), count = Number(frames);
    return Number.isFinite(total) && Number.isFinite(count) && total >= 0 && count > 0 ? total * 1000 / count : null;
  }

  function isReady(integrity) { return Boolean(integrity && !integrity.degraded && integrity.loadedReferences > 0); }

  return Object.freeze({ validateCache, assess, averageMs, isReady });
});
