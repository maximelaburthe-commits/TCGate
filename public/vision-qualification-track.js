(function initQualificationTracking(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TCGVisionQualificationTracking = api;
})(typeof window !== 'undefined' ? window : globalThis, function createQualificationTrackingModule() {
  'use strict';

  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const finite = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
  const uid = value => Number.isSafeInteger(value) && value > 0;
  const identifier = value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9:_./-]{0,179}$/.test(value) && !['constructor', 'prototype', '__proto__'].includes(value) ? value : null;
  const recognitionModes = ['exact', 'canonical', 'shared', 'shared_art', 'shared-art'];

  // A trial owns exactly one detector UID. It has no expected-card input and
  // owns no native matcher/temporal policy or normal pointer/hover behavior.
  function create(options) {
    if (!object(options) || typeof options.getTracks !== 'function' || typeof options.identify !== 'function') throw new TypeError('Track reader and native identifier required');
    const now = typeof options.now === 'function' ? options.now : () => performance.now();
    const schedule = options.setInterval || globalThis.setInterval;
    const cancel = options.clearInterval || globalThis.clearInterval;
    const target = typeof options.onTarget === 'function' ? options.onTarget : () => {};
    const pollMs = finite(options.pollMs) && options.pollMs > 0 ? options.pollMs : 250;
    const state = { active: true, lockedTrackUid: null, status: 'WAITING_FOR_SINGLE_TRACK', trackPresent: false, observedTrackCount: 0, identity: null, decisionAtMs: null, busy: false, errors: [] };
    let epoch = 0, inFlight = false, timer = null;

    function snapshot() {
      return { ...state, errors: [...state.errors], identity: state.identity ? { ...state.identity, candidatePrintingIds: [...state.identity.candidatePrintingIds] } : null };
    }
    function clearIdentity() { state.identity = null; state.decisionAtMs = null; }
    function fail(code) {
      if (!state.errors.includes(code)) state.errors.push(code);
      epoch += 1;
      clearIdentity();
      state.status = code;
      state.trackPresent = false;
      target(null);
    }
    function liveTracks() {
      try {
        const tracks = options.getTracks();
        return Array.isArray(tracks) ? tracks.filter(track => object(track) && track.misses === 0) : [];
      } catch { fail('TRACKING_ERROR'); return []; }
    }
    function refresh() {
      if (!state.active) return null;
      if (state.errors.length) { target(null); return null; }
      const tracks = liveTracks();
      if (state.errors.length) return null;
      const previousStatus = state.status;
      state.observedTrackCount = tracks.length;
      if (state.lockedTrackUid === null && tracks.length === 1 && uid(tracks[0].uid)) {
        state.lockedTrackUid = tracks[0].uid;
        epoch += 1;
      }
      const locked = state.lockedTrackUid === null ? null : tracks.find(track => track.uid === state.lockedTrackUid) || null;
      state.trackPresent = Boolean(locked);
      if (state.lockedTrackUid === null) state.status = 'WAITING_FOR_SINGLE_TRACK';
      else if (tracks.length > 1) state.status = 'MULTIPLE_TRACKS';
      else if (!locked) state.status = 'TRACK_LOST';
      else state.status = 'TRACKING';
      if (state.status !== previousStatus) epoch += 1;
      if (state.status !== 'TRACKING') clearIdentity();
      target(state.status === 'TRACKING' ? locked : null);
      return state.status === 'TRACKING' ? locked : null;
    }
    function sanitizeDecision(result) {
      if (!object(result) || (result.decision !== undefined && !['ACCEPTED', 'REJECTED', 'HELD'].includes(result.decision))) return null;
      const decision = ['ACCEPTED', 'REJECTED', 'HELD'].includes(result.decision) ? result.decision : result.accepted === true ? 'ACCEPTED' : 'REJECTED';
      const cardId = identifier(result.cardId), refId = identifier(result.refId);
      const printingId = result.printingId == null ? null : identifier(result.printingId);
      const candidates = result.candidatePrintingIds === undefined ? [] : result.candidatePrintingIds;
      const validCandidates = Array.isArray(candidates) && candidates.length <= 229 && candidates.every(value => identifier(value));
      if (result.accepted !== true || decision === 'REJECTED' || !cardId || !refId || (result.printingId != null && !printingId) || !validCandidates) return null;
      return { accepted: true, cardId, refId, printingId, candidatePrintingIds: [...new Set(candidates)], recognitionMode: recognitionModes.includes(result.recognitionMode) ? result.recognitionMode : null, score: finite(result.score) ? result.score : null, decision };
    }
    function sample() {
      const track = refresh();
      if (!track || inFlight) return snapshot();
      const requestEpoch = epoch, requestUid = state.lockedTrackUid;
      inFlight = true;
      state.busy = true;
      let pending;
      try { pending = options.identify(track); } catch {
        fail('MATCHER_ERROR');
        inFlight = false;
        state.busy = false;
        return snapshot();
      }
      Promise.resolve(pending).then(result => {
        if (!state.active || epoch !== requestEpoch) return;
        // Recheck detector ownership at completion, including a loss that
        // occurred while native matching was in flight.
        const current = refresh();
        if (!current || epoch !== requestEpoch || state.lockedTrackUid !== requestUid) return;
        if (object(result) && result.trackUid !== undefined && result.trackUid !== requestUid) { clearIdentity(); return; }
        state.identity = sanitizeDecision(result);
        const atMs = object(result) && finite(result.atMs) ? result.atMs : now();
        state.decisionAtMs = finite(atMs) ? atMs : null;
      }, () => {
        if (state.active && epoch === requestEpoch) fail('MATCHER_ERROR');
      }).finally(() => {
        inFlight = false;
        state.busy = false;
      });
      return snapshot();
    }
    function stop() {
      if (!state.active) return snapshot();
      state.active = false;
      epoch += 1;
      if (timer !== null) cancel(timer);
      timer = null;
      state.status = 'STOPPED';
      state.trackPresent = false;
      state.observedTrackCount = 0;
      state.busy = false;
      clearIdentity();
      target(null);
      return snapshot();
    }
    timer = schedule(sample, pollMs);
    if (options.deferFirstSample !== true) sample();
    return Object.freeze({ sample, getState: snapshot, stop });
  }
  return Object.freeze({ create });
});
