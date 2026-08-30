(function initGameRegistry(global) {
  'use strict';

  const games = Object.freeze({
    cyberpunk: Object.freeze({
      id: 'cyberpunk',
      label: 'Cyberpunk Trading Card Game · Vision',
      shortLabel: 'Cyberpunk TCG',
      capabilities: Object.freeze({ vision: true, gigDice: true }),
      runtimes: Object.freeze({ vision: 'cyberpunk' }),
      exposed: true,
      database: 'tcgate_db_cyberpunk',
      databaseRef: 'main'
    }),
    'star-wars-unlimited': Object.freeze({
      id: 'star-wars-unlimited',
      label: 'Star Wars Unlimited · Vision',
      shortLabel: 'Star Wars Unlimited',
      capabilities: Object.freeze({ vision: true, gigDice: false }),
      runtimes: Object.freeze({ vision: 'swu-r14' }),
      exposed: true,
      database: 'tcgate_db_star_wars_unlimited',
      databaseRef: 'develop-swu-db-v0.3'
    }),
    'no-game': Object.freeze({
      id: 'no-game',
      label: 'Sans jeu · webcam uniquement',
      shortLabel: 'Sans jeu',
      capabilities: Object.freeze({ vision: false, gigDice: false }),
      runtimes: Object.freeze({ vision: null }),
      exposed: true,
      database: null,
      databaseRef: null
    })
  });

  function get(gameId) {
    return games[String(gameId || '')] || null;
  }

  const registry = Object.freeze({
    get,
    supports(gameId, capability) {
      return get(gameId)?.capabilities?.[capability] === true;
    },
    runtimeReady(gameId, runtime) {
      return Boolean(get(gameId)?.runtimes?.[runtime]);
    },
    runtime(gameId, runtime) {
      return get(gameId)?.runtimes?.[runtime] || null;
    },
    label(gameId, { short = false } = {}) {
      const game = get(gameId);
      return game ? (short ? game.shortLabel : game.label) : 'TCG';
    },
    exposed() {
      return Object.values(games).filter(game => game.exposed);
    }
  });

  Object.defineProperty(global, 'TCGateGameRegistry', {
    value: registry,
    configurable: false,
    enumerable: true,
    writable: false
  });
})(window);
