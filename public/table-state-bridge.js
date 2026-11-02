'use strict';

(() => {
  if (!window.Worker || window.TCGTableStateBridge) return;

  const NativeWorker = window.Worker;
  const bridgeState = {
    refs: null,
    capturedAt: null,
    captureCount: 0,
    sourceUrl: null,
    visionIndexKey: null,
    playerLocale: null
  };

  function releaseRefs() {
    bridgeState.refs = null;
    bridgeState.capturedAt = null;
    bridgeState.sourceUrl = null;
    bridgeState.visionIndexKey = null;
    bridgeState.playerLocale = null;
  }

  function isIdentificationWorker(url) {
    return String(url || '').includes('identification-worker.js');
  }

  function emitLibraryCaptured() {
    window.dispatchEvent(new CustomEvent('tcg-table-reference-library', {
      detail: {
        count: Array.isArray(bridgeState.refs) ? bridgeState.refs.length : 0,
        capturedAt: bridgeState.capturedAt,
        captureCount: bridgeState.captureCount,
        sourceUrl: bridgeState.sourceUrl,
        visionIndexKey: bridgeState.visionIndexKey,
        playerLocale: bridgeState.playerLocale
      }
    }));
  }

  function WrappedWorker(url, options) {
    const worker = new NativeWorker(url, options);

    if (isIdentificationWorker(url)) {
      const nativePostMessage = worker.postMessage.bind(worker);
      worker.postMessage = function(message, transferOrOptions) {
        if (message?.type === 'init' && Array.isArray(message.refs)) {
          const scoped = message.visionIndexKey != null || message.playerLocale != null;
          releaseRefs();
          if (scoped && (typeof message.visionIndexKey !== 'string' || !message.visionIndexKey ||
              typeof message.playerLocale !== 'string' || !message.playerLocale ||
              message.refs.some(ref => ref?.locale !== message.playerLocale))) {
            throw new Error('Vision reference locale does not match the selected corpus');
          }
          bridgeState.refs = message.refs;
          bridgeState.visionIndexKey = scoped ? message.visionIndexKey : null;
          bridgeState.playerLocale = scoped ? message.playerLocale : null;
          bridgeState.capturedAt = new Date().toISOString();
          bridgeState.captureCount += 1;
          bridgeState.sourceUrl = String(url || '');
          emitLibraryCaptured();
        }

        if (arguments.length >= 2) return nativePostMessage(message, transferOrOptions);
        return nativePostMessage(message);
      };
    }

    return worker;
  }

  try { Object.setPrototypeOf(WrappedWorker, NativeWorker); } catch {}
  WrappedWorker.prototype = NativeWorker.prototype;
  window.Worker = WrappedWorker;

  window.TCGTableStateBridge = {
    version: '0.1.0-reference-tap',
    getRefs() {
      return bridgeState.refs;
    },
    getSnapshot() {
      return {
        version: this.version,
        refsCaptured: Array.isArray(bridgeState.refs) ? bridgeState.refs.length : 0,
        capturedAt: bridgeState.capturedAt,
        captureCount: bridgeState.captureCount,
        sourceUrl: bridgeState.sourceUrl,
        visionIndexKey: bridgeState.visionIndexKey,
        playerLocale: bridgeState.playerLocale
      };
    },
    createNativeWorker(url, options) {
      return new NativeWorker(url, options);
    },
    releaseRefs
  };
})();
