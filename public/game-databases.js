(function initGameDatabases(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TCGateGameDatabases = api;
})(typeof window !== 'undefined' ? window : globalThis, function createGameDatabases() {
  'use strict';

  const databases = Object.freeze({
    cyberpunk: Object.freeze({
      manifestUrl: 'https://raw.githubusercontent.com/maximelaburthe-commits/tcgate_db_cyberpunk/56402636a77af9c8b5dc4e3b61c509a185f3c834/manifest.json',
      expectedGame: 'cyberpunk-tcg',
      expectedVersion: '1.1.0',
      expectedStatus: 'candidate-qualified',
      expectedRuntimeScope: 'cyberpunk-beta-2026',
      expectedRuntimeReady: true,
      expectedCanonicalCards: 150,
      expectedRuntimePrintings: 229,
      expectedRecognitionGroups: 150,
      expectedMatcherReferences: 229,
      knownCanonicalCards: 151,
      knownOfficialPrintings: 460
    })
  });

  function get(game) {
    return databases[String(game || '')] || null;
  }

  return Object.freeze({ get, databases });
});
