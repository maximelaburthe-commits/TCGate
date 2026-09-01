'use strict';

(() => {
  function productDisplayUrl(url) {
    const value = String(url || '');
    if (!value) return value;
    try {
      const parsed = new URL(value, typeof location !== 'undefined' ? location.href : 'https://tcgate.invalid/');
      if (parsed.protocol === 'https:' && parsed.hostname === 'cdn.starwarsunlimited.com') {
        return `/api/image-proxy?url=${encodeURIComponent(parsed.href)}`;
      }
    } catch {}
    return value;
  }
  const api = { productDisplayUrl };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.TCGateSwuProductDisplay = api;
})();
