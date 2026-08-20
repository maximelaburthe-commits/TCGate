'use strict';

(() => {
  const lab = window.TCGDetectionLab;
  const bridge = window.TCGTableStateBridge;
  if (!lab || !bridge) return;

  const VERSION = '0.1.6-facewebcam-memory-hover';
  const SHADOW_MODE = false;
  const WORKER_URL = '/identification-worker.js?v=vision-state-memory-hover-v0.1.6';

  const ANALYZE_UNKNOWN_INTERVAL_MS = 620;
  const ANALYZE_KNOWN_INTERVAL_MS = 2300;
  const GLOBAL_MATCH_GAP_MS = 185;
  const MIN_TRACK_CONF = 0.44;
  const STABLE_MOTION_THRESHOLD = 0.17;
  const STABLE_AFTER_MS = 420;
  const REACQUIRE_WINDOW_MS = 2200;
  const RETAIN_REMOVED_MS = 7000;
  const IDENTITY_ASSIST_MAX_GEOMETRY = 1.80;
  const IDENTITY_ASSIST_ACCEPTED_MIN_SCORE = 0.44;
  const IDENTITY_ASSIST_ACCEPTED_MIN_MARGIN = 0.065;
  const REACQUIRE_SCORE_MAX = 0.72;
  const MAX_OBSERVATIONS = 10;
  const EVIDENCE_WINDOW_MS = 6500;
  const MAX_EVENTS = 8000;
  const MIN_VIDEO_PROGRESS_S = 0.06;
  // Precision-first policy: an identity stored in table memory is allowed to
  // drive an instant hover, so its admission threshold must be stricter than
  // a transient matcher suggestion.
  const VERY_STRONG_SINGLE_SCORE = 0.55;
  const VERY_STRONG_SINGLE_MARGIN = 0.16;
  const REPEATED_ACCEPTED_MIN_SCORE = 0.46;
  const REPEATED_ACCEPTED_MIN_MARGIN = 0.10;
  const REPLACEMENT_MIN_SCORE = 0.48;
  const REPLACEMENT_MIN_MARGIN = 0.12;
  const REACQUIRE_CONFIRM_SCORE = 0.42;
  const REACQUIRE_CONFIRM_MARGIN = 0.045;
  // A detector track can survive while the physical card occupying that area
  // changes. In that case the old table identity must be suspended before it
  // is allowed to drive instant hover again.
  const CONFLICT_SUSPEND_MIN_SCORE = 0.32;
  const CONFLICT_ACCEPTED_MIN_SCORE = 0.40;
  const CONFLICT_ACCEPTED_MIN_MARGIN = 0.08;
  const REPLACEMENT_FAST_MIN_SCORE = 0.50;
  const REPLACEMENT_FAST_MIN_MARGIN = 0.14;
  const IDENTITY_RECOVERY_MIN_SCORE = 0.40;
  const IDENTITY_RECOVERY_MIN_MARGIN = 0.04;

  function createStats() {
    return {
      cardsCreated: 0,
      cardsRemoved: 0,
      reacquisitions: 0,
      observations: 0,
      matches: 0,
      acceptedMatches: 0,
      rejectedMatches: 0,
      identitiesEstablished: 0,
      identitiesSwitched: 0,
      hoverMemoryHits: 0,
      hoverMemoryMisses: 0,
      glareSkipped: 0,
      lowQualitySkipped: 0,
      frozenFrameSkipped: 0,
      resets: 0,
      unsafeIdentityBlocked: 0,
      reacquireVerified: 0,
      reacquireHoverBlocked: 0,
      staleIdentitySuspended: 0,
      staleIdentityRecovered: 0,
      staleIdentityHoverBlocked: 0,
      baseConflictSuspended: 0,
      replacementsConfirmed: 0,
      identityAssistedReacquire: 0,
      identityAssistAmbiguousBlocked: 0,
      visibleMemoryRenders: 0,
      visibleHandoffClears: 0
    };
  }

  const state = {
    started: false,
    worker: null,
    workerReady: false,
    workerError: null,
    workerBusy: false,
    requestSeq: 0,
    generation: 0,
    currentRequest: null,
    cards: new Map(),
    uidToCardId: new Map(),
    nextCardId: 1,
    lastGlobalMatchAt: 0,
    schedulerTimer: null,
    lastTrackUpdateAt: 0,
    events: [],
    sessionEvents: [],
    segmentId: 1,
    stats: createStats(),
    sessionStats: createStats(),
    lastHover: null,
    sampleCanvas: null,
    sampleCtx: null
  };

  function now() { return performance.now(); }
  function iso() { return new Date().toISOString(); }
  function replayTime() {
    const source = document.getElementById('remoteVideo');
    return Number.isFinite(source?.currentTime) ? Number(source.currentTime) : null;
  }
  function replayPaused() {
    const source = document.getElementById('remoteVideo');
    return Boolean(!source || source.paused || source.readyState < 2);
  }
  function log(type, data = {}) {
    const event = { type, at: iso(), videoTime: replayTime(), segmentId: state.segmentId, ...data };
    state.events.push(event);
    state.sessionEvents.push({ ...event });
    if (state.events.length > MAX_EVENTS) state.events.splice(0, 500);
    if (state.sessionEvents.length > MAX_EVENTS * 2) state.sessionEvents.splice(0, 1000);
  }
  function bumpStat(key, amount = 1) {
    state.stats[key] = Number(state.stats[key] || 0) + amount;
    state.sessionStats[key] = Number(state.sessionStats[key] || 0) + amount;
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function angleDistance(a, b) {
    let d = Math.abs(Number(a || 0) - Number(b || 0)) % Math.PI;
    if (d > Math.PI / 2) d = Math.PI - d;
    return d / (Math.PI / 2);
  }
  function geometrySnapshot(track) {
    return {
      cx: Number(track.cx || 0), cy: Number(track.cy || 0),
      w: Number(track.w || 0), h: Number(track.h || 0),
      angle: Number(track.angle || 0), conf: Number(track.conf || 0)
    };
  }
  function geometryDistance(a, b) {
    if (!a || !b) return Infinity;
    const ref = Math.max(36, (Math.sqrt(Math.max(1, a.w * a.h)) + Math.sqrt(Math.max(1, b.w * b.h))) / 2);
    const pos = Math.hypot(a.cx - b.cx, a.cy - b.cy) / ref;
    const areaA = Math.max(1, a.w * a.h), areaB = Math.max(1, b.w * b.h);
    const scale = Math.abs(Math.log(areaA / areaB));
    const angle = angleDistance(a.angle, b.angle);
    return pos + scale * 0.55 + angle * 0.20;
  }
  function motionScore(previous, current) {
    return geometryDistance(previous, current);
  }
  function cardStateFor(entry) {
    if (!entry.activeUid) return entry.identity ? 'OCCLUDED' : 'ACQUIRING';
    // Geometry alone is not sufficient to restore a known identity. A card
    // reacquired near the same place must first visually agree with the stored
    // identity before it may serve instant hover again.
    if (entry.needsReacquireVerification) return 'REACQUIRING';
    if (entry.identitySuspended) return 'VERIFYING_IDENTITY';
    if (entry.reacquiredAt && now() - entry.reacquiredAt < STABLE_AFTER_MS) return 'REACQUIRING';
    if (entry.identity) return 'STABLE_KNOWN';
    if (entry.stableSince && now() - entry.stableSince >= STABLE_AFTER_MS) return 'STABLE_UNKNOWN';
    return 'ACQUIRING';
  }
  function setEntryState(entry, next, reason = null) {
    if (entry.state === next) return;
    const previous = entry.state;
    entry.state = next;
    entry.stateChangedAt = now();
    log('table-state-change', { tableId: entry.id, previous, next, reason, uid: entry.activeUid });
  }
  function emitUpdate(reason = 'update') {
    const detail = { reason, snapshot: getSnapshot() };
    window.dispatchEvent(new CustomEvent('tcg-table-state-updated', { detail }));
  }

  function newEntry(track) {
    const t = now();
    const entry = {
      id: `T${state.nextCardId++}`,
      activeUid: track.uid,
      detectorUids: [track.uid],
      createdAt: t,
      firstSeenAt: t,
      lastSeenAt: t,
      lostAt: null,
      reacquiredAt: null,
      needsReacquireVerification: false,
      identitySuspended: false,
      identitySuspendedAt: null,
      identitySuspendedReason: null,
      state: 'ACQUIRING',
      stateChangedAt: t,
      geometry: geometrySnapshot(track),
      previousGeometry: null,
      motion: Infinity,
      stableSince: null,
      lastAnalysisAt: 0,
      lastAnalyzedVideoTime: null,
      analysisInFlight: false,
      observations: [],
      identity: null,
      pendingSwitch: null,
      bestObservation: null
    };
    state.cards.set(entry.id, entry);
    state.uidToCardId.set(track.uid, entry.id);
    bumpStat('cardsCreated');
    log('table-card-created', { tableId: entry.id, uid: track.uid, geometry: entry.geometry });
    return entry;
  }

  function findReacquireCandidate(track, t) {
    const geo = geometrySnapshot(track);
    let best = null;
    for (const entry of state.cards.values()) {
      if (entry.activeUid != null || !entry.lostAt) continue;
      const age = t - entry.lostAt;
      if (age < 0 || age > REACQUIRE_WINDOW_MS) continue;
      const score = geometryDistance(entry.geometry, geo);
      if (score > REACQUIRE_SCORE_MAX) continue;
      if (!best || score < best.score) best = { entry, score };
    }
    return best;
  }

  function attachTrack(entry, track, reason, score = null) {
    const t = now();
    entry.activeUid = track.uid;
    if (!entry.detectorUids.includes(track.uid)) entry.detectorUids.push(track.uid);
    entry.previousGeometry = entry.geometry;
    entry.geometry = geometrySnapshot(track);
    entry.lastSeenAt = t;
    entry.lostAt = null;
    entry.reacquiredAt = reason === 'reacquired' ? t : entry.reacquiredAt;
    if (reason === 'reacquired' && entry.identity) entry.needsReacquireVerification = true;
    entry.motion = entry.previousGeometry ? motionScore(entry.previousGeometry, entry.geometry) : Infinity;
    entry.stableSince = null;
    state.uidToCardId.set(track.uid, entry.id);
    if (reason === 'reacquired') {
      bumpStat('reacquisitions');
      setEntryState(entry, 'REACQUIRING', 'geometry-reacquire');
      log('table-card-reacquired', { tableId: entry.id, uid: track.uid, score });
    }
  }

  function syncTracks() {
    if (!state.started) return;
    const t = now();
    state.lastTrackUpdateAt = t;
    const tracks = lab.activeTracks().filter(track => (track.misses || 0) === 0);
    const activeUids = new Set(tracks.map(track => track.uid));

    for (const track of tracks) {
      let entry = null;
      const cardId = state.uidToCardId.get(track.uid);
      if (cardId) entry = state.cards.get(cardId) || null;

      if (!entry) {
        const reacquire = findReacquireCandidate(track, t);
        if (reacquire) {
          entry = reacquire.entry;
          attachTrack(entry, track, 'reacquired', reacquire.score);
        } else {
          entry = newEntry(track);
        }
      } else {
        entry.previousGeometry = entry.geometry;
        entry.geometry = geometrySnapshot(track);
        entry.motion = entry.previousGeometry ? motionScore(entry.previousGeometry, entry.geometry) : Infinity;
        entry.lastSeenAt = t;
        entry.lostAt = null;
        if (entry.motion <= STABLE_MOTION_THRESHOLD) {
          if (!entry.stableSince) entry.stableSince = t;
        } else {
          entry.stableSince = null;
        }
        setEntryState(entry, cardStateFor(entry), 'track-update');
      }
    }

    for (const entry of state.cards.values()) {
      if (entry.activeUid == null) continue;
      if (activeUids.has(entry.activeUid)) continue;
      const oldUid = entry.activeUid;
      state.uidToCardId.delete(oldUid);
      entry.activeUid = null;
      entry.lostAt = t;
      entry.analysisInFlight = false;
      entry.stableSince = null;
      setEntryState(entry, entry.identity ? 'OCCLUDED' : 'ACQUIRING', 'detector-track-lost');
      log('table-card-lost', { tableId: entry.id, uid: oldUid, identity: entry.identity?.name || null });
    }

    for (const [id, entry] of [...state.cards.entries()]) {
      if (entry.activeUid != null || !entry.lostAt) continue;
      if (t - entry.lostAt <= RETAIN_REMOVED_MS) continue;
      state.cards.delete(id);
      bumpStat('cardsRemoved');
      log('table-card-removed', { tableId: id, identity: entry.identity?.name || null });
    }

    scheduleAnalysis();
    emitUpdate('tracks');
  }

  function ensureSampleCanvas() {
    if (state.sampleCanvas && state.sampleCtx) return;
    state.sampleCanvas = document.createElement('canvas');
    state.sampleCanvas.width = 72;
    state.sampleCanvas.height = 104;
    state.sampleCtx = state.sampleCanvas.getContext('2d', { willReadFrequently: true, alpha: false });
  }

  function analyzeCropQuality(canvas) {
    ensureSampleCanvas();
    const sample = state.sampleCanvas;
    const ctx = state.sampleCtx;
    ctx.drawImage(canvas, 0, 0, sample.width, sample.height);
    const px = ctx.getImageData(0, 0, sample.width, sample.height).data;
    const gray = new Float32Array(sample.width * sample.height);
    let n = 0, clipped = 0, bright = 0, detail = 0, detailN = 0;
    for (let y = 0; y < sample.height; y++) {
      for (let x = 0; x < sample.width; x++) {
        const i = (y * sample.width + x) * 4;
        const r = px[i] / 255, g = px[i + 1] / 255, b = px[i + 2] / 255;
        const lum = .299 * r + .587 * g + .114 * b;
        gray[y * sample.width + x] = lum;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        const sat = max > 1e-4 ? (max - min) / max : 0;
        clipped += Number(lum > .965 && sat < .14);
        bright += Number(lum > .91);
        n += 1;
        if (x > 0 && y > 0) {
          detail += Math.abs(lum - gray[y * sample.width + x - 1]);
          detail += Math.abs(lum - gray[(y - 1) * sample.width + x]);
          detailN += 2;
        }
      }
    }
    const clippedFraction = clipped / Math.max(1, n);
    const brightFraction = bright / Math.max(1, n);
    const meanDetail = detail / Math.max(1, detailN);
    let risk = 'normal';
    if (clippedFraction >= .16) risk = 'high';
    else if (clippedFraction >= .08) risk = 'moderate';
    return {
      risk,
      clippedFraction: Number(clippedFraction.toFixed(4)),
      brightFraction: Number(brightFraction.toFixed(4)),
      detail: Number(meanDetail.toFixed(4))
    };
  }

  function qualityAdjustedAccepted(result, quality) {
    if (!result?.accepted) return false;
    if (quality?.risk === 'high') return false;
    if (quality?.risk === 'moderate') {
      return Number(result.best?.score || 0) >= .28 && Number(result.margin || 0) >= .16;
    }
    return true;
  }

  function observationFromResult(entry, result, quality, track) {
    const best = result?.best?.ref ? {
      name: result.best.ref.name || null,
      type: result.best.ref.type || null,
      image: result.best.ref.image || null,
      score: Number(result.best.score || 0)
    } : null;
    const candidates = Array.isArray(result?.ranked) ? result.ranked.slice(0, 5).map((item, index) => ({
      rank: index + 1,
      name: item?.ref?.name || null,
      type: item?.ref?.type || null,
      image: item?.ref?.image || null,
      score: Number(item?.score || 0)
    })) : [];
    return {
      at: now(),
      videoTime: replayTime(),
      uid: track.uid,
      stable: Boolean(entry.stableSince && now() - entry.stableSince >= STABLE_AFTER_MS),
      motion: Number(entry.motion || 0),
      accepted: qualityAdjustedAccepted(result, quality),
      rawAccepted: Boolean(result?.accepted),
      best,
      margin: Number(result?.margin || 0),
      mode: result?.mode || 'normal',
      quality,
      candidates
    };
  }

  function identityKey(item) { return item?.image || item?.name || null; }

  function recentObservations(entry, t = now()) {
    return entry.observations.filter(obs => t - obs.at <= EVIDENCE_WINDOW_MS);
  }

  function suspendIdentity(entry, reason, observation = null, extra = {}) {
    if (!entry?.identity) return false;
    if (!entry.identitySuspended) {
      entry.identitySuspended = true;
      entry.identitySuspendedAt = now();
      entry.identitySuspendedReason = reason || 'visual-conflict';
      bumpStat('staleIdentitySuspended');
      log('table-identity-suspended', {
        tableId: entry.id,
        uid: entry.activeUid,
        name: entry.identity.name,
        reason: entry.identitySuspendedReason,
        observedBest: observation?.best?.name || extra.observedBest || null,
        score: Number(observation?.best?.score || extra.score || 0),
        margin: Number(observation?.margin || extra.margin || 0)
      });
      setEntryState(entry, 'VERIFYING_IDENTITY', entry.identitySuspendedReason);
      entry.lastAnalysisAt = 0;
      scheduleAnalysis();
      emitUpdate('identity-suspended');
      return true;
    }
    return false;
  }

  function recoverIdentity(entry, reason = 'stored-identity-reconfirmed', observation = null) {
    if (!entry?.identity || !entry.identitySuspended) return false;
    entry.identitySuspended = false;
    entry.identitySuspendedAt = null;
    entry.identitySuspendedReason = null;
    bumpStat('staleIdentityRecovered');
    log('table-identity-recovered', {
      tableId: entry.id,
      uid: entry.activeUid,
      name: entry.identity.name,
      reason,
      score: Number(observation?.best?.score || 0),
      margin: Number(observation?.margin || 0)
    });
    setEntryState(entry, 'STABLE_KNOWN', reason);
    return true;
  }

  function establishIdentity(entry, best, confidence, reason, evidence) {
    if (!best || !identityKey(best)) return;
    const previous = entry.identity;
    entry.identity = {
      name: best.name,
      type: best.type || '',
      image: best.image,
      establishedAt: now(),
      lastConfirmedAt: now(),
      confidence: Number(confidence || 0),
      reason,
      evidence: { ...evidence }
    };
    entry.pendingSwitch = null;
    entry.identitySuspended = false;
    entry.identitySuspendedAt = null;
    entry.identitySuspendedReason = null;
    if (previous && identityKey(previous) !== identityKey(entry.identity)) {
      bumpStat('identitiesSwitched');
      bumpStat('replacementsConfirmed');
      log('table-identity-switched', { tableId: entry.id, previous: previous.name, next: entry.identity.name, reason, evidence });
    } else if (!previous) {
      bumpStat('identitiesEstablished');
      log('table-identity-established', { tableId: entry.id, name: entry.identity.name, reason, evidence });
    }
    window.TCGIdentificationLab?.preloadImage?.(entry.identity.image);
    setEntryState(entry, 'STABLE_KNOWN', reason);
  }


  function findIdentityAssistCandidate(entry, observation) {
    if (!entry || entry.identity || !entry.activeUid || !observation?.accepted || !observation.best) return null;
    const key = identityKey(observation.best);
    if (!key) return null;
    if (Number(observation.best.score || 0) < IDENTITY_ASSIST_ACCEPTED_MIN_SCORE) return null;
    if (Number(observation.margin || 0) < IDENTITY_ASSIST_ACCEPTED_MIN_MARGIN) return null;

    // If another active copy of the same card already exists, identity alone
    // cannot tell us which physical copy this new track belongs to. Keep the
    // new entry independent rather than merging the wrong duplicate.
    const activeSameIdentity = [...state.cards.values()].some(other =>
      other !== entry &&
      other.activeUid != null &&
      other.identity &&
      !other.identitySuspended &&
      !other.needsReacquireVerification &&
      identityKey(other.identity) === key
    );
    if (activeSameIdentity) {
      if (entry.lastIdentityAssistAmbiguousKey !== key) {
        entry.lastIdentityAssistAmbiguousKey = key;
        bumpStat('identityAssistAmbiguousBlocked');
        log('table-identity-assisted-reacquire-blocked', {
          tableId: entry.id,
          uid: entry.activeUid,
          name: observation.best.name,
          reason: 'active-duplicate-identity'
        });
      }
      return null;
    }

    const t = now();
    const candidates = [...state.cards.values()].filter(other => {
      if (other === entry || other.activeUid != null || !other.lostAt || !other.identity) return false;
      if (other.identitySuspended || other.needsReacquireVerification) return false;
      if (identityKey(other.identity) !== key) return false;
      const age = t - other.lostAt;
      if (age < 0 || age > RETAIN_REMOVED_MS) return false;
      return geometryDistance(other.geometry, entry.geometry) <= IDENTITY_ASSIST_MAX_GEOMETRY;
    });

    if (candidates.length !== 1) {
      if (candidates.length > 1 && entry.lastIdentityAssistAmbiguousKey !== key) {
        entry.lastIdentityAssistAmbiguousKey = key;
        bumpStat('identityAssistAmbiguousBlocked');
        log('table-identity-assisted-reacquire-blocked', {
          tableId: entry.id,
          uid: entry.activeUid,
          name: observation.best.name,
          reason: 'multiple-retained-candidates',
          candidates: candidates.map(item => item.id)
        });
      }
      return null;
    }
    return candidates[0];
  }

  function mergeIntoRetainedIdentity(entry, retained, observation) {
    if (!entry || !retained || entry === retained) return retained || entry;
    const t = now();
    const uid = entry.activeUid;
    const oldEntryId = entry.id;

    state.cards.delete(oldEntryId);
    if (uid != null) state.uidToCardId.set(uid, retained.id);

    retained.activeUid = uid;
    for (const detectorUid of entry.detectorUids || []) {
      if (!retained.detectorUids.includes(detectorUid)) retained.detectorUids.push(detectorUid);
    }
    retained.previousGeometry = retained.geometry;
    retained.geometry = entry.geometry ? { ...entry.geometry } : retained.geometry;
    retained.motion = entry.motion;
    retained.lastSeenAt = t;
    retained.lostAt = null;
    retained.reacquiredAt = t;
    retained.needsReacquireVerification = false;
    retained.identitySuspended = false;
    retained.identitySuspendedAt = null;
    retained.identitySuspendedReason = null;
    retained.stableSince = entry.stableSince;
    retained.lastAnalysisAt = entry.lastAnalysisAt;
    retained.lastAnalyzedVideoTime = entry.lastAnalyzedVideoTime;
    retained.analysisInFlight = false;

    const combined = [...retained.observations, ...entry.observations]
      .sort((a, b) => a.at - b.at)
      .slice(-MAX_OBSERVATIONS);
    retained.observations = combined;
    retained.bestObservation = combined.reduce((best, item) => {
      if (!best) return item;
      return Number(item.best?.score || 0) > Number(best.best?.score || 0) ? item : best;
    }, retained.bestObservation || null);

    if (retained.identity) {
      retained.identity.lastConfirmedAt = t;
      retained.identity.confidence = Math.max(
        Number(retained.identity.confidence || 0),
        Number(observation.best?.score || 0)
      );
    }

    bumpStat('reacquisitions');
    bumpStat('identityAssistedReacquire');
    log('table-identity-assisted-reacquire', {
      tableId: retained.id,
      mergedTableId: oldEntryId,
      uid,
      name: retained.identity?.name || observation.best?.name || null,
      score: Number(observation.best?.score || 0),
      margin: Number(observation.margin || 0),
      geometryScore: geometryDistance(retained.previousGeometry, retained.geometry)
    });
    setEntryState(retained, 'STABLE_KNOWN', 'identity-assisted-reacquire');
    return retained;
  }

  function evaluateIdentity(entry, observation) {
    if (!observation.best) return;
    const t = now();
    const recent = recentObservations(entry, t);
    const key = identityKey(observation.best);
    const sameBest = recent.filter(obs => identityKey(obs.best) === key && Number(obs.best?.score || 0) >= .26);
    const sameAccepted = sameBest.filter(obs => obs.accepted);
    const stableSame = sameBest.filter(obs => obs.stable);
    const avgScore = sameBest.length ? sameBest.reduce((sum, obs) => sum + Number(obs.best?.score || 0), 0) / sameBest.length : 0;
    const avgMargin = sameBest.length ? sameBest.reduce((sum, obs) => sum + Number(obs.margin || 0), 0) / sameBest.length : 0;

    if (!entry.identity) {
      // Memory admission is deliberately stricter than V0.6.2's transient
      // matcher result. Repeated rejected guesses are NEVER enough to create a
      // stored identity. This prevents stable but visually ambiguous crops from
      // becoming confident simply because the same frame family repeats.
      const veryStrongSingle =
        observation.accepted && observation.stable &&
        Number(observation.best.score || 0) >= VERY_STRONG_SINGLE_SCORE &&
        Number(observation.margin || 0) >= VERY_STRONG_SINGLE_MARGIN;

      const repeatedAccepted =
        sameAccepted.length >= 2 &&
        stableSame.length >= 1 &&
        avgScore >= REPEATED_ACCEPTED_MIN_SCORE &&
        avgMargin >= REPEATED_ACCEPTED_MIN_MARGIN;

      if (veryStrongSingle) {
        establishIdentity(entry, observation.best, observation.best.score, 'very-strong-stable-observation', {
          sameBest: sameBest.length, accepted: sameAccepted.length, avgScore, avgMargin
        });
      } else if (repeatedAccepted) {
        establishIdentity(entry, observation.best, avgScore, 'precision-repeated-accepted', {
          sameBest: sameBest.length, accepted: sameAccepted.length, avgScore, avgMargin
        });
      } else {
        // Telemetry: flag cases that the previous V0.1.1 policy would have
        // promoted to memory, but which are now kept unknown.
        const legacyRepeatedAccepted = sameAccepted.length >= 2 && stableSame.length >= 1;
        const legacyRepeatedUncertain = sameBest.length >= 3 && stableSame.length >= 1 && avgScore >= .34 && avgMargin >= .032;
        if ((legacyRepeatedAccepted || legacyRepeatedUncertain) && entry.lastBlockedIdentityKey !== key) {
          entry.lastBlockedIdentityKey = key;
          bumpStat('unsafeIdentityBlocked');
          log('table-identity-candidate-blocked', {
            tableId: entry.id,
            name: observation.best.name,
            legacyReason: legacyRepeatedAccepted ? 'repeated-accepted' : 'temporal-consensus',
            evidence: { sameBest: sameBest.length, accepted: sameAccepted.length, avgScore, avgMargin }
          });
        }
      }
      return;
    }

    const currentKey = identityKey(entry.identity);
    if (key === currentKey) {
      entry.identity.lastConfirmedAt = t;
      entry.identity.confidence = Math.max(entry.identity.confidence || 0, avgScore || observation.best.score || 0);
      entry.pendingSwitch = null;

      const storedIdentityConfirmed =
        observation.accepted ||
        (observation.stable &&
         Number(observation.best?.score || 0) >= IDENTITY_RECOVERY_MIN_SCORE &&
         Number(observation.margin || 0) >= IDENTITY_RECOVERY_MIN_MARGIN);

      if (entry.identitySuspended && storedIdentityConfirmed) {
        recoverIdentity(entry, 'stored-identity-reconfirmed', observation);
      }

      if (entry.needsReacquireVerification) {
        const visuallyConfirmed =
          observation.accepted ||
          (observation.stable &&
           Number(observation.best?.score || 0) >= REACQUIRE_CONFIRM_SCORE &&
           Number(observation.margin || 0) >= REACQUIRE_CONFIRM_MARGIN);
        if (visuallyConfirmed) {
          entry.needsReacquireVerification = false;
          bumpStat('reacquireVerified');
          log('table-reacquire-identity-verified', {
            tableId: entry.id, uid: entry.activeUid, name: entry.identity.name,
            accepted: observation.accepted,
            score: Number(observation.best?.score || 0),
            margin: Number(observation.margin || 0)
          });
        }
      }
      return;
    }

    const currentStillVisible = Array.isArray(observation.candidates) &&
      observation.candidates.some(candidate => identityKey(candidate) === currentKey);
    const acceptedConflict =
      observation.accepted &&
      Number(observation.best?.score || 0) >= CONFLICT_ACCEPTED_MIN_SCORE &&
      Number(observation.margin || 0) >= CONFLICT_ACCEPTED_MIN_MARGIN;
    const appearanceConflict =
      observation.stable &&
      !currentStillVisible &&
      Number(observation.best?.score || 0) >= CONFLICT_SUSPEND_MIN_SCORE &&
      Number(observation.quality?.detail || 0) >= .0105;

    // Suspension is intentionally easier than replacement. If the stored card
    // no longer visually fits the track, the safe response is to stop serving
    // the old identity immediately and verify, not to guess a replacement.
    if (acceptedConflict) {
      suspendIdentity(entry, 'accepted-conflicting-identity', observation);
    } else if (appearanceConflict) {
      suspendIdentity(entry, 'stored-identity-absent-from-top5', observation);
    }

    // A known card is deliberately sticky as an internal memory, but while it
    // is suspended it cannot drive hover. A replacement needs clean accepted
    // evidence and is then promoted quickly so the card does not remain unknown
    // longer than necessary.
    const conflicting = recent.filter(obs =>
      identityKey(obs.best) === key &&
      obs.stable &&
      Number(obs.best?.score || 0) >= REPLACEMENT_MIN_SCORE &&
      Number(obs.margin || 0) >= REPLACEMENT_MIN_MARGIN
    );
    const conflictingAccepted = conflicting.filter(obs => obs.accepted);
    const conflictAvgScore = conflicting.length ? conflicting.reduce((sum, obs) => sum + Number(obs.best?.score || 0), 0) / conflicting.length : 0;
    const conflictAvgMargin = conflicting.length ? conflicting.reduce((sum, obs) => sum + Number(obs.margin || 0), 0) / conflicting.length : 0;

    entry.pendingSwitch = {
      name: observation.best.name,
      image: observation.best.image,
      count: conflicting.length,
      acceptedCount: conflictingAccepted.length,
      avgScore: conflictAvgScore,
      avgMargin: conflictAvgMargin,
      updatedAt: t
    };

    if (conflictingAccepted.length >= 2 &&
        conflictAvgScore >= REPLACEMENT_FAST_MIN_SCORE &&
        conflictAvgMargin >= REPLACEMENT_FAST_MIN_MARGIN) {
      establishIdentity(entry, observation.best, conflictAvgScore, 'precision-confirmed-card-replacement', {
        conflicting: conflicting.length,
        accepted: conflictingAccepted.length,
        avgScore: conflictAvgScore,
        avgMargin: conflictAvgMargin
      });
      entry.needsReacquireVerification = false;
    }
  }

  function chooseNextEntry() {
    const t = now();
    const entries = [...state.cards.values()].filter(entry => {
      if (entry.activeUid == null || entry.analysisInFlight) return false;
      const track = lab.activeTracks().find(item => item.uid === entry.activeUid && (item.misses || 0) === 0);
      if (!track || Number(track.conf || 0) < MIN_TRACK_CONF) return false;
      const interval = (entry.needsReacquireVerification || entry.identitySuspended) ? ANALYZE_UNKNOWN_INTERVAL_MS : (entry.identity ? ANALYZE_KNOWN_INTERVAL_MS : ANALYZE_UNKNOWN_INTERVAL_MS);
      return t - entry.lastAnalysisAt >= interval;
    });

    entries.sort((a, b) => {
      const aKnown = a.identity ? 1 : 0, bKnown = b.identity ? 1 : 0;
      if (aKnown !== bKnown) return aKnown - bKnown;
      const aStable = a.stableSince ? 1 : 0, bStable = b.stableSince ? 1 : 0;
      if (aStable !== bStable) return bStable - aStable;
      return a.lastAnalysisAt - b.lastAnalysisAt;
    });
    return entries[0] || null;
  }

  function scheduleAnalysis() {
    if (!state.started || !state.workerReady || state.workerBusy || replayPaused()) return;
    const wait = Math.max(0, GLOBAL_MATCH_GAP_MS - (now() - state.lastGlobalMatchAt));
    clearTimeout(state.schedulerTimer);
    state.schedulerTimer = setTimeout(runNextAnalysis, wait);
  }

  async function runNextAnalysis() {
    if (!state.started || !state.workerReady || state.workerBusy || replayPaused()) return;
    const entry = chooseNextEntry();
    if (!entry) return;
    const track = lab.activeTracks().find(item => item.uid === entry.activeUid && (item.misses || 0) === 0);
    if (!track) return;

    const currentVideoTime = replayTime();
    if (Number.isFinite(entry.lastAnalyzedVideoTime) && Number.isFinite(currentVideoTime) &&
        Math.abs(currentVideoTime - entry.lastAnalyzedVideoTime) < MIN_VIDEO_PROGRESS_S) {
      bumpStat('frozenFrameSkipped');
      entry.lastAnalysisAt = now();
      log('table-observation-skipped', { tableId: entry.id, uid: track.uid, reason: 'same-video-frame', videoTimeDelta: currentVideoTime - entry.lastAnalyzedVideoTime });
      return;
    }

    const canvas = lab.captureCanonicalTrackCanvas(track, 216, 312);
    if (!canvas) return;
    const quality = analyzeCropQuality(canvas);
    if (quality.risk === 'high') {
      bumpStat('glareSkipped');
      entry.lastAnalysisAt = now();
      log('table-observation-skipped', { tableId: entry.id, uid: track.uid, reason: 'glare-high', quality });
      scheduleAnalysis();
      return;
    }
    if (quality.detail < .0105 && !entry.identity) {
      bumpStat('lowQualitySkipped');
      entry.lastAnalysisAt = now();
      log('table-observation-skipped', { tableId: entry.id, uid: track.uid, reason: 'low-detail', quality });
      scheduleAnalysis();
      return;
    }

    let bitmap;
    try { bitmap = await createImageBitmap(canvas); }
    catch { return; }

    entry.analysisInFlight = true;
    entry.lastAnalysisAt = now();
    entry.lastAnalyzedVideoTime = currentVideoTime;
    state.workerBusy = true;
    state.lastGlobalMatchAt = now();
    const requestId = ++state.requestSeq;
    state.currentRequest = { requestId, generation: state.generation, tableId: entry.id, uid: track.uid, quality, startedAt: now() };
    try {
      state.worker.postMessage({ type: 'match', requestId, bitmap, context: { overlapping: false } }, [bitmap]);
    } catch (err) {
      try { bitmap.close?.(); } catch {}
      entry.analysisInFlight = false;
      state.workerBusy = false;
      state.currentRequest = null;
      state.workerError = String(err?.message || err);
      scheduleAnalysis();
    }
  }

  function onMatchResult(msg) {
    const request = state.currentRequest;
    if (!request || request.requestId !== msg.requestId) return;
    state.currentRequest = null;
    state.workerBusy = false;
    if (request.generation !== state.generation) {
      scheduleAnalysis();
      return;
    }
    const entry = state.cards.get(request.tableId);
    if (!entry) {
      scheduleAnalysis();
      return;
    }
    entry.analysisInFlight = false;

    const track = lab.activeTracks().find(item => item.uid === request.uid && (item.misses || 0) === 0);
    if (!track || entry.activeUid !== request.uid) {
      scheduleAnalysis();
      return;
    }

    if (msg.type === 'match-error') {
      state.workerError = msg.error || 'Erreur matcher Table State';
      log('table-match-error', { tableId: entry.id, uid: request.uid, error: state.workerError });
      scheduleAnalysis();
      return;
    }

    const result = msg.result || null;
    bumpStat('matches');
    const observation = observationFromResult(entry, result, request.quality, track);
    bumpStat('observations');
    if (observation.accepted) bumpStat('acceptedMatches');
    else bumpStat('rejectedMatches');
    entry.observations.push(observation);
    if (entry.observations.length > MAX_OBSERVATIONS) entry.observations.splice(0, entry.observations.length - MAX_OBSERVATIONS);

    if (!entry.bestObservation || Number(observation.best?.score || 0) > Number(entry.bestObservation.best?.score || 0)) {
      entry.bestObservation = observation;
    }

    const retainedIdentity = findIdentityAssistCandidate(entry, observation);
    if (retainedIdentity) {
      const merged = mergeIntoRetainedIdentity(entry, retainedIdentity, observation);
      log('table-background-match', {
        tableId: merged.id,
        uid: request.uid,
        accepted: observation.accepted,
        best: observation.best?.name || null,
        score: Number(observation.best?.score || 0),
        margin: observation.margin,
        stable: observation.stable,
        quality: observation.quality,
        identity: merged.identity?.name || null,
        identityAssistedReacquire: true
      });
      emitUpdate('identity-assisted-reacquire');
      scheduleAnalysis();
      return;
    }

    evaluateIdentity(entry, observation);
    setEntryState(entry, cardStateFor(entry), 'background-match');
    log('table-background-match', {
      tableId: entry.id,
      uid: request.uid,
      accepted: observation.accepted,
      best: observation.best?.name || null,
      score: Number(observation.best?.score || 0),
      margin: observation.margin,
      stable: observation.stable,
      quality: observation.quality,
      identity: entry.identity?.name || null
    });
    emitUpdate('background-match');
    scheduleAnalysis();
  }

  function initWorker(refs) {
    if (!Array.isArray(refs) || !refs.length) return false;
    try {
      const worker = bridge.createNativeWorker(WORKER_URL);
      state.worker = worker;
      state.workerReady = false;
      state.workerError = null;
      worker.onmessage = (event) => {
        const msg = event.data || {};
        if (msg.type === 'ready') {
          state.workerReady = true;
          log('table-worker-ready', { refs: Number(msg.count || 0) });
          bridge.releaseRefs();
          emitUpdate('worker-ready');
          scheduleAnalysis();
          return;
        }
        if (msg.type === 'match-result' || msg.type === 'match-error') onMatchResult(msg);
      };
      worker.onerror = (event) => {
        state.workerReady = false;
        state.workerError = event.message || 'Erreur worker Table State';
        log('table-worker-error', { error: state.workerError });
        emitUpdate('worker-error');
      };
      worker.postMessage({ type: 'init', refs });
      return true;
    } catch (err) {
      state.workerError = String(err?.message || err);
      return false;
    }
  }

  async function start() {
    if (state.started && state.workerReady) return getSnapshot();
    state.started = true;
    const refs = bridge.getRefs();
    if (refs?.length) initWorker(refs);
    else {
      const deadline = now() + 15000;
      while (!state.worker && !bridge.getRefs()?.length && now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      const captured = bridge.getRefs();
      if (!state.worker && captured?.length) initWorker(captured);
      if (!state.worker) state.workerError = 'Références visuelles non interceptées.';
    }
    emitUpdate('start');
    return getSnapshot();
  }

  function reset(reason = 'manual') {
    clearTimeout(state.schedulerTimer);
    state.schedulerTimer = null;
    state.generation += 1;
    const hardReset = reason === 'stop' || reason === 'restart' || String(reason).startsWith('replay-new-file');
    if (hardReset) {
      state.sessionEvents = [];
      state.sessionStats = createStats();
      state.segmentId = 1;
      state.nextCardId = 1;
    } else {
      state.segmentId += 1;
      bumpStat('resets');
    }
    state.cards.clear();
    state.uidToCardId.clear();
    // An in-flight worker request cannot be cancelled after its ImageBitmap was
    // transferred. Keep the busy flag until its stale response arrives; the
    // generation guard above will discard it safely.
    if (!state.currentRequest) state.workerBusy = false;
    state.lastGlobalMatchAt = 0;
    state.lastHover = null;
    state.events = [];
    state.stats = createStats();
    log('table-reset', { reason, hardReset });
    emitUpdate('reset');
  }

  function stop() {
    reset('stop');
    try { state.worker?.terminate?.(); } catch {}
    state.worker = null;
    state.workerReady = false;
    state.started = false;
  }

  function stagePoint(event) {
    const rect = lab.els.videoStage.getBoundingClientRect();
    const vw = lab.els.video.videoWidth || lab.els.overlay.width || 1;
    const vh = lab.els.video.videoHeight || lab.els.overlay.height || 1;
    const scale = Math.min(rect.width / vw, rect.height / vh);
    const dw = vw * scale, dh = vh * scale;
    const ox = (rect.width - dw) / 2, oy = (rect.height - dh) / 2;
    const lx = event.clientX - rect.left - ox;
    const ly = event.clientY - rect.top - oy;
    if (lx < 0 || ly < 0 || lx > dw || ly > dh) return null;
    return { x: lx / scale, y: ly / scale };
  }
  function contains(track, point) {
    const a = -(track.angle || 0), c = Math.cos(a), s = Math.sin(a);
    const dx = point.x - track.cx, dy = point.y - track.cy;
    const x = dx * c - dy * s, y = dx * s + dy * c;
    return Math.abs(x) <= track.w / 2 && Math.abs(y) <= track.h / 2;
  }
  function imageUrl(image) {
    const safe = encodeURIComponent(image || '').replace(/%2F/g, '/');
    return `https://cdn.jsdelivr.net/gh/maximelaburthe-commits/cyberpunk_cards@main/images/${safe}`;
  }
  function renderMemoryIdentity(entry) {
    const ident = entry?.identity;
    if (!ident || SHADOW_MODE) return false;
    const shown=window.TCGIdentificationLab?.showMemoryIdentity?.({
      name:ident.name,
      type:ident.type||'',
      image:ident.image,
      tableId:entry.id,
      trackUid:entry.activeUid,
      observations:entry.observations.length
    });
    if (shown) bumpStat('visibleMemoryRenders');
    return Boolean(shown);
  }

  function clearVisibleForHandoff(message='Analyse de la carte survolée…') {
    if (SHADOW_MODE) return;
    window.TCGIdentificationLab?.clearVisibleForHandoff?.(message);
    bumpStat('visibleHandoffClears');
  }

  function currentEntryUnderPointer(event) {
    const point = stagePoint(event);
    if (!point) return { track: null, entry: null };
    const tracks = lab.activeTracks().filter(track => (track.misses || 0) === 0).sort((a, b) => (b.conf || 0) - (a.conf || 0));
    const track = tracks.find(item => contains(item, point)) || null;
    if (!track) return { track: null, entry: null };
    const entry = state.cards.get(state.uidToCardId.get(track.uid)) || null;
    return { track, entry };
  }

  function onPointerMove(event) {
    const { track, entry } = currentEntryUnderPointer(event);
    if (!track) {
      state.lastHover = null;
      return;
    }
    const previousUid=state.lastHover?.uid ?? null;
    const targetChanged=previousUid==null || String(previousUid)!==String(track.uid);
    if (!entry?.identity || entry.needsReacquireVerification || entry.identitySuspended || entry.state !== 'STABLE_KNOWN') {
      if (targetChanged) clearVisibleForHandoff(entry?.identity ? 'Identité en vérification…' : 'Analyse de la carte survolée…');
      const firstBlockForTrack = state.lastHover?.uid !== track.uid || state.lastHover?.blocked !== true;
      if (entry?.identity && entry.needsReacquireVerification && firstBlockForTrack) {
        bumpStat('reacquireHoverBlocked');
        log('table-hover-memory-blocked', { tableId: entry.id, uid: track.uid, name: entry.identity.name, reason: 'reacquire-unverified' });
      } else if (entry?.identity && entry.identitySuspended && firstBlockForTrack) {
        bumpStat('staleIdentityHoverBlocked');
        log('table-hover-memory-blocked', { tableId: entry.id, uid: track.uid, name: entry.identity.name, reason: entry.identitySuspendedReason || 'identity-suspended' });
      } else if (!entry?.identity && (state.lastHover?.uid !== track.uid || state.lastHover?.known !== false)) {
        bumpStat('hoverMemoryMisses');
      }
      state.lastHover = {
        tableId: entry?.id || null, uid: track.uid,
        name: entry?.identity?.name || null,
        known: false,
        blocked: Boolean(entry?.identity && (entry.needsReacquireVerification || entry.identitySuspended)),
        blockReason: entry?.needsReacquireVerification ? 'reacquire-unverified' : (entry?.identitySuspendedReason || null),
        at: now()
      };
      return;
    }
    const previousId = state.lastHover?.tableId || null;
    state.lastHover = { tableId: entry.id, uid: entry.activeUid, name: entry.identity.name, known: true, at: now() };
    renderMemoryIdentity(entry);
    if (previousId !== entry.id) {
      bumpStat('hoverMemoryHits');
      log('table-hover-memory-hit', { tableId: entry.id, uid: entry.activeUid, name: entry.identity.name });
      window.dispatchEvent(new CustomEvent('tcg-table-hover-hit', { detail: { ...state.lastHover } }));
      emitUpdate('hover-memory-hit');
    }
  }

  function reassertKnownHover(eventDetail = null) {
    const hover = state.lastHover;
    if (!hover?.known) return;
    const entry = state.cards.get(hover.tableId);
    if (!entry?.identity || entry.activeUid !== hover.uid) return;

    const eventTrackUid = eventDetail?.trackUid ?? eventDetail?.uid ?? null;
    if (eventTrackUid != null && eventTrackUid !== hover.uid) return;

    const eventName = eventDetail?.name || null;
    if (eventDetail?.accepted && eventName === entry.identity.name) return;

    if (eventDetail?.accepted && eventName && eventName !== entry.identity.name) {
      const didSuspend = suspendIdentity(entry, 'foreground-accepted-conflict', null, {
        observedBest: eventName,
        score: Number(eventDetail?.matcherScore || eventDetail?.score || 0),
        margin: Number(eventDetail?.margin || 0)
      });
      if (didSuspend) bumpStat('baseConflictSuspended');
      state.lastHover = {
        tableId: entry.id, uid: entry.activeUid, name: entry.identity.name,
        known: false, blocked: true, blockReason: 'foreground-accepted-conflict', at: now()
      };
      // Crucial: keep the correct foreground result visible. Do not repaint the
      // stale table-memory identity over a newly accepted conflicting result.
      return;
    }

    if (!entry.identitySuspended && !entry.needsReacquireVerification) {
      setTimeout(() => renderMemoryIdentity(entry), 0);
    }
  }

  function serializeObservation(obs) {
    if (!obs) return null;
    return {
      atMs: Math.round(obs.at),
      videoTime: obs.videoTime,
      uid: obs.uid,
      stable: obs.stable,
      motion: Number(obs.motion || 0),
      accepted: obs.accepted,
      rawAccepted: obs.rawAccepted,
      best: obs.best ? { ...obs.best } : null,
      margin: obs.margin,
      mode: obs.mode,
      quality: obs.quality ? { ...obs.quality } : null,
      candidates: obs.candidates?.map(item => ({ ...item })) || []
    };
  }

  function serializeEntry(entry) {
    return {
      id: entry.id,
      state: entry.state,
      activeUid: entry.activeUid,
      detectorUids: [...entry.detectorUids],
      firstSeenAtMs: Math.round(entry.firstSeenAt),
      lastSeenAtMs: Math.round(entry.lastSeenAt),
      lostAtMs: entry.lostAt == null ? null : Math.round(entry.lostAt),
      motion: Number(entry.motion || 0),
      stableForMs: entry.stableSince ? Math.max(0, Math.round(now() - entry.stableSince)) : 0,
      geometry: entry.geometry ? { ...entry.geometry } : null,
      identity: entry.identity ? { ...entry.identity, evidence: { ...(entry.identity.evidence || {}) } } : null,
      pendingSwitch: entry.pendingSwitch ? { ...entry.pendingSwitch } : null,
      needsReacquireVerification: Boolean(entry.needsReacquireVerification),
      identitySuspended: Boolean(entry.identitySuspended),
      identitySuspendedAtMs: entry.identitySuspendedAt == null ? null : Math.round(entry.identitySuspendedAt),
      identitySuspendedReason: entry.identitySuspendedReason || null,
      observationCount: entry.observations.length,
      observations: entry.observations.map(serializeObservation),
      bestObservation: serializeObservation(entry.bestObservation)
    };
  }

  function getSnapshot() {
    const entries = [...state.cards.values()].map(serializeEntry);
    return {
      version: VERSION,
      shadowMode: SHADOW_MODE,
      segmentId: state.segmentId,
      started: state.started,
      workerReady: state.workerReady,
      workerBusy: state.workerBusy,
      workerError: state.workerError,
      activeTableCards: entries.filter(entry => entry.activeUid != null).length,
      retainedCards: entries.filter(entry => entry.activeUid == null).length,
      knownCards: entries.filter(entry => Boolean(entry.identity) && !entry.identitySuspended && !entry.needsReacquireVerification).length,
      suspendedKnownCards: entries.filter(entry => Boolean(entry.identity) && (entry.identitySuspended || entry.needsReacquireVerification)).length,
      unknownCards: entries.filter(entry => entry.activeUid != null && (!entry.identity || entry.identitySuspended || entry.needsReacquireVerification)).length,
      stats: { ...state.stats },
      sessionStats: { ...state.sessionStats },
      lastHover: state.lastHover ? { ...state.lastHover } : null,
      entries
    };
  }

  window.addEventListener('tcg-table-reference-library', () => {
    if (state.started && !state.workerReady && bridge.getRefs()?.length) initWorker(bridge.getRefs());
  });
  window.addEventListener('tcg-tracks-updated', syncTracks);
  window.addEventListener('tcg-identification-result', event => reassertKnownHover(event.detail || null));
  const replaySource = document.getElementById('remoteVideo');
  replaySource?.addEventListener('pause', () => {
    clearTimeout(state.schedulerTimer);
    state.schedulerTimer = null;
  });
  replaySource?.addEventListener('play', () => scheduleAnalysis());
  lab.els.videoStage?.addEventListener('pointermove', onPointerMove);
  lab.els.videoStage?.addEventListener('pointerleave', () => { state.lastHover = null; });

  window.TCGTableStateEngine = {
    version: VERSION,
    start,
    reset,
    stop,
    getSnapshot,
    getEvents() { return state.sessionEvents.map(event => ({ ...event })); },
    getCurrentSegmentEvents() { return state.events.map(event => ({ ...event })); }
  };
})();
