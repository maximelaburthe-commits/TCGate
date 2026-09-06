(function initOfferDeliveryRetry(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TCGateOfferDeliveryRetry = api;
})(typeof window !== 'undefined' ? window : globalThis, function createOfferDeliveryRetryApi() {
  'use strict';

  function createController({ maxAttempts = 3, retryDelaysMs = [300, 900], setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
    let active = null;
    let timer = null;

    function cancel() {
      if (timer) clearTimer(timer);
      timer = null;
      active = null;
    }

    async function attempt(job) {
      if (active !== job || !job.isActive()) return;
      job.attempts += 1;
      let result = null;
      try {
        result = await job.send(job.description);
      } catch (error) {
        job.onError(error, job.attempts);
      }
      if (active !== job || !job.isActive()) return;
      if (Number(result?.delivered) > 0) {
        active = null;
        timer = null;
        job.onDelivered(result, job.attempts);
        return;
      }
      job.onFailed(result, job.attempts);
      if (job.attempts >= maxAttempts) {
        active = null;
        timer = null;
        job.onExhausted(job.attempts);
        return;
      }
      const delay = retryDelaysMs[Math.min(job.attempts - 1, retryDelaysMs.length - 1)] || 0;
      timer = setTimer(() => {
        timer = null;
        attempt(job).catch(job.onError);
      }, delay);
    }

    async function start(job) {
      cancel();
      active = { attempts: 0, onFailed: () => {}, onError: () => {}, ...job };
      const current = active;
      await attempt(current);
      return current;
    }

    return Object.freeze({ start, cancel, isActive: () => Boolean(active) });
  }

  return Object.freeze({ createController });
});
