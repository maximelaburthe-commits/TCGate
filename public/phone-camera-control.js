'use strict';

(() => {
  class PhoneCameraControlWaiter {
    constructor(timeoutMs = 8000) {
      this.timeoutMs = timeoutMs;
      this.pending = new Map();
    }

    wait(requestId) {
      if (!requestId || this.pending.has(requestId)) throw new Error('requestId de contrôle invalide');
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          this.pending.delete(requestId);
          const error = new Error('Délai de réponse du téléphone dépassé');
          error.name = 'TimeoutError';
          reject(error);
        }, this.timeoutMs);
        this.pending.set(requestId, { resolve, reject, timer });
      });
    }

    settle(payload = {}) {
      const requestId = String(payload.requestId || '');
      const pending = this.pending.get(requestId);
      if (!pending) return false;
      clearTimeout(pending.timer);
      this.pending.delete(requestId);
      if (payload.ok) pending.resolve(payload);
      else {
        const error = new Error(payload.error || 'Commande refusée');
        error.name = payload.errorName || 'PhoneCameraControlError';
        error.rollbackRestored = payload.rollbackRestored ?? null;
        pending.reject(error);
      }
      return true;
    }

    cancel(requestId, message = 'Commande annulée') {
      const pending = this.pending.get(requestId);
      if (!pending) return false;
      clearTimeout(pending.timer);
      this.pending.delete(requestId);
      pending.reject(new Error(message));
      return true;
    }

    cancelAll(message = 'Téléphone dissocié') {
      for (const requestId of [...this.pending.keys()]) this.cancel(requestId, message);
    }
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { PhoneCameraControlWaiter };
  if (typeof window !== 'undefined') window.TCGatePhoneCameraControl = { PhoneCameraControlWaiter };
})();
