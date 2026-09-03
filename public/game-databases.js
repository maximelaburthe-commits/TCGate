(function initGameDatabases(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TCGateGameDatabases = api;
})(typeof window !== 'undefined' ? window : globalThis, function createGameDatabases() {
  'use strict';

  const databases = Object.freeze({
    cyberpunk: Object.freeze({
      manifestUrl: 'https://raw.githubusercontent.com/maximelaburthe-commits/tcgate_db_cyberpunk/main/manifest.json',
      expectedGame: 'cyberpunk-tcg',
      expectedVersion: '1.0.0',
      expectedStatus: 'production-reviewed',
      expectedCanonicalCards: 150,
      expectedOfficialPrintings: 444
    })
  });

  function get(game) {
    return databases[String(game || '')] || null;
  }

  return Object.freeze({ get, databases });
});
