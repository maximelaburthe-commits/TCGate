(function initIdentificationSource(global) {
  'use strict';

  const runtimes = Object.freeze({
    cyberpunk: Object.freeze({
      runtimeId: 'cyberpunk',
      cardsUrl: 'https://raw.githubusercontent.com/maximelaburthe-commits/cyberpunk_cards/main/cards.json',
      imageBaseUrl: 'https://raw.githubusercontent.com/maximelaburthe-commits/cyberpunk_cards/main/images/',
      fallbackUrl: '/cards-fallback.json',
      cacheNamespace: 'tcgate-ident:cyberpunk:template-v5-fast'
    })
  });

  function runtime(runtimeId) {
    return runtimes[String(runtimeId || '')] || null;
  }

  function absoluteImageUrl(config, image) {
    const value = String(image || '');
    if (/^https?:\/\//i.test(value)) return value;
    return config.imageBaseUrl + encodeURIComponent(value).replace(/%2F/g, '/');
  }

  function normalizeCards(config, cards) {
    if (!Array.isArray(cards)) return [];
    return cards.map(card => ({
      ...card,
      imageUrl: absoluteImageUrl(config, card?.image)
    }));
  }

  async function fetchCards(fetchImpl, url) {
    const response = await fetchImpl(url, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const cards = await response.json();
    if (!Array.isArray(cards) || !cards.length) throw new Error('Liste vide');
    return cards;
  }

  async function load(runtimeId, options = {}) {
    const config = runtime(runtimeId);
    if (!config) throw new Error(`Runtime d'identification inconnu : ${runtimeId || 'null'}`);
    const fetchImpl = options.fetch || global.fetch?.bind(global);
    if (!fetchImpl) throw new Error('Fetch API indisponible');

    let cards;
    let source;
    try {
      cards = await fetchCards(fetchImpl, config.cardsUrl);
      source = 'GitHub';
    } catch (remoteError) {
      try {
        cards = await fetchCards(fetchImpl, config.fallbackUrl);
        source = 'fallback local';
      } catch {
        throw remoteError;
      }
    }

    return Object.freeze({
      runtimeId: config.runtimeId,
      cacheNamespace: config.cacheNamespace,
      source,
      cards: normalizeCards(config, cards)
    });
  }

  global.TCGateIdentificationSource = Object.freeze({ load, runtime });
})(window);
