'use strict';

(() => {
  function createLatestOnlySingleFlight(run) {
    if (typeof run !== 'function') throw new TypeError('run must be a function');
    let busy = false, pending = null, concurrent = 0;
    const idleWaiters = [];
    const stats = { requested: 0, started: 0, completed: 0, coalesced: 0, staleDropped: 0, errors: 0, maxConcurrent: 0, lastStartedAt: null, lastCompletedAt: null, lastError: null };

    const settleIdle = () => {
      if (busy || pending) return;
      while (idleWaiters.length) idleWaiters.shift()();
    };
    const drain = async payload => {
      busy = true; concurrent += 1;
      stats.started += 1; stats.maxConcurrent = Math.max(stats.maxConcurrent, concurrent); stats.lastStartedAt = Date.now();
      try {
        const result = await run(payload);
        if (result?.stale) stats.staleDropped += 1;
      } catch (error) {
        stats.errors += 1;
        stats.lastError = { name: error?.name || 'Error', message: error?.message || String(error) };
      } finally {
        concurrent -= 1; stats.completed += 1; stats.lastCompletedAt = Date.now();
        const next = pending; pending = null;
        if (next) await drain(next);
        else { busy = false; settleIdle(); }
      }
    };
    return Object.freeze({
      request(payload) {
        stats.requested += 1;
        if (busy) {
          if (pending) stats.coalesced += 1;
          pending = payload;
          return;
        }
        void drain(payload);
      },
      clear() {
        if (pending) stats.staleDropped += 1;
        pending = null;
        settleIdle();
      },
      whenIdle() { return busy || pending ? new Promise(resolve => idleWaiters.push(resolve)) : Promise.resolve(); },
      getSnapshot() { return { busy, ...stats }; }
    });
  }
  const api = { createLatestOnlySingleFlight };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.TCGateLatestOnlySingleFlight = api;
})();
