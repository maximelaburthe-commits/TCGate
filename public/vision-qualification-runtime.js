(function initQualificationRuntime(root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TCGVisionQualificationRuntime = api;
})(typeof window !== 'undefined' ? window : globalThis, function createQualificationRuntime(root) {
  'use strict';

  const DATABASE_SHA = '56402636a77af9c8b5dc4e3b61c509a185f3c834';
  const PHYSICAL_CONFIRMATION = 'REAL_CARDS_OPERATOR_CONFIRMED';
  // Qualification boundary only: never changes the detector's identity memory.
  const NEUTRAL_WINDOW_MS = 750;
  const NEUTRAL_MAX_GAP_MS = 750;
  const RESET_EVENTS = ['tcg-camera-state', 'tcg-vision-state', 'tcg-vision-input-state', 'tcg-vision-geometry'];
  const EVENTS = ['tcg-tracks-updated', 'tcg-identification-result', 'tcg-table-state-updated', 'tcg-identification-context', 'tcg-identification-visible', 'tcg-identification-attempt'];
  const MAX_ATTEMPT_DIAGNOSTICS = 2000;
  const TEMPORAL_EVENT_TYPES = ['stable-established', 'stable-held', 'hold-expired', 'switch-confirmed', 'switch-expired', 'switch-pending'];
  function copy(value) { return JSON.parse(JSON.stringify(value)); }
  function finite(value) { return typeof value === 'number' && Number.isFinite(value); }
  function trackUid(value) { return Number.isSafeInteger(value) && value >= 0 ? value : null; }
  function nullableBoolean(value) { return typeof value === 'boolean' ? value : null; }
  function runtimeState(snapshot, detection, chosen) {
    // Observation-only scalars. Never spread an engine snapshot into an export:
    // native snapshots can contain media, names, geometry and image locations.
    const tracks = Array.isArray(detection.tracking?.activeTracks) ? detection.tracking.activeTracks : null;
    return {
      pointerInsideStage: nullableBoolean(snapshot.pointerInsideStage),
      hoveredTrackUid: trackUid(snapshot.hoveredTrack?.uid),
      activeTrackUids: tracks ? [...new Set(tracks.map(track => trackUid(track?.uid)).filter(value => value !== null))].sort((a, b) => a - b).slice(0, 32) : null,
      activeTrackCount: Number.isSafeInteger(detection.activeCards) && detection.activeCards >= 0 ? detection.activeCards : null,
      matcherBusy: nullableBoolean(snapshot.matcherWorker?.busy), matcherQueued: nullableBoolean(snapshot.matcherWorker?.queued),
      temporalEventType: TEMPORAL_EVENT_TYPES.includes(snapshot.identityStability?.last?.type) ? snapshot.identityStability.last.type : null,
      visibleSource: ['VISIBLE', 'FOREGROUND', 'TABLE_MEMORY'].includes(chosen?.source) ? chosen.source : null
    };
  }
  function detectorRunning(snapshot) {
    if (!snapshot?.modelReady) return false;
    if (snapshot.active === true) return true;
    const local = root.TCGDetectionLab?.state;
    return local?.detecting === true && Boolean(local.stream?.getVideoTracks?.().some(track => track.readyState === 'live'));
  }
  function reference(ref) {
    return {
      refId: ref.refId, cardId: ref.cardId, printingId: ref.printingId || null,
      referencePrintingId: ref.referencePrintingId || null,
      candidatePrintingIds: Array.isArray(ref.candidatePrintingIds) ? [...ref.candidatePrintingIds] : [],
      recognitionMode: ref.recognitionMode || null, locale: ref.locale
    };
  }

  const observerKey = Symbol.for('tcgate.vision.qualification.observer');
  // Workspace orchestration only. This observer never starts cameras, workers,
  // engines, a Room, matching, or any media capture.
  async function attach(options = {}) {
    if (root[observerKey]) throw Error('A qualification observer is already attached or preparing');
    const reservation = {};
    root[observerKey] = reservation;
    try { return await attachObserver(options, reservation); }
    catch (error) { if (root[observerKey] === reservation) delete root[observerKey]; throw error; }
  }
  async function attachObserver(options, reservation) {
    const harness = root.TCGateVisionQualification;
    if (!harness?.buildReport || !harness?.validateContext) throw Error('Load vision-qualification-harness.js first');
    if (!/^[a-f0-9]{40}$/i.test(options.productSha || '')) throw Error('Supply the exact tested product SHA');
    if (!root.TCGIdentificationLab?.getSnapshot || !root.TCGVisionEngine?.getSnapshot || !root.TCGTableStateBridge?.getRefs) throw Error('Existing Vision runtime is unavailable');
    if (!root.TCGateDatabaseSource?.getVisionReferences) throw Error('Existing Locale Core reference API is unavailable');
    // The Worker tap deliberately omits canonical/printing IDs. Read the real
    // already-loaded Core projection, then correlate its IDs with every actual
    // Worker candidate. Names and display labels never establish identity.
    const refs = await root.TCGateDatabaseSource.getVisionReferences('cyberpunk', 'en');
    const initial = root.TCGIdentificationLab.getSnapshot();
    const capturedRefs = root.TCGTableStateBridge.getRefs();
    const descriptor = root.TCGateGameDatabases?.get?.('cyberpunk');
    if (descriptor?.manifestUrl !== 'https://raw.githubusercontent.com/maximelaburthe-commits/tcgate_db_cyberpunk/' + DATABASE_SHA + '/manifest.json') throw Error('The active database is not the qualified immutable source');
    if (initial.gameId !== 'cyberpunk' || initial.playerLocale !== 'en' || initial.libraryReady !== true ||
        initial.matcherWorker?.ready !== true || initial.visionReferenceCount !== 229 ||
        initial.librarySize !== 229 || initial.visionLocales?.length !== 1 || initial.visionLocales[0] !== 'en' ||
        initial.libraryIntegrity?.degraded !== false || !Array.isArray(refs) || refs.length !== 229 ||
        new Set(refs.map(ref => ref.cardId)).size !== 150 || refs.some(ref => ref.locale !== 'en') ||
        !Array.isArray(capturedRefs) || capturedRefs.length !== 229 ||
        new Set(capturedRefs.map(ref => ref.refId)).size !== 229 ||
        capturedRefs.some(ref => ref.locale !== 'en' || ref.image !== ref.refId || !refs.some(full => full.refId === ref.refId))) {
      throw Error('Prepare the real Cyberpunk EN 150-card / 229-reference index first');
    }
    const context = {
      productSha: options.productSha.toLowerCase(), databaseSha: DATABASE_SHA,
      gameId: 'cyberpunk', locale: 'en', referenceCount: 229, references: refs.map(reference)
    };
    const validation = harness.validateContext(context);
    if (validation === false || validation?.valid === false) throw Error('Qualification context rejected');
    const workerIdentity = ref => [ref.refId, ref.locale, ref.image];
    const signature = JSON.stringify(capturedRefs.map(workerIdentity));
    const indexKey = initial.visionIndexKey;
    const byRef = new Map(refs.map(ref => [ref.refId, ref]));
    const byImage = new Map();
    for (const ref of refs) {
      for (const image of [ref.refId, ref.image]) {
        if (typeof image !== 'string' || !image) continue;
        if (byImage.has(image) && byImage.get(image).refId !== ref.refId) throw Error('Ambiguous runtime reference image key');
        byImage.set(image, ref);
      }
    }
    const environment = harness.sanitizeEnvironment(options.environment || {});
    const shared = root.TCGVisionQualificationReport;
    const sampleDocument = options.sampleDocument ? copy(options.sampleDocument) : null;
    if (sampleDocument && !shared?.generate) throw Error('Load vision-qualification-report.js before guided qualification');
    const canonicalPlan = sampleDocument ? shared.canonicalPlan(sampleDocument, context) : null;
    const requestedPlan = canonicalPlan ? { ...canonicalPlan, ...shared.declarations(options.plan, canonicalPlan) } : options.plan;
    const plan = {
      sample: (requestedPlan?.sample || []).map(item => ({ cardId: item.cardId, printingId: item.printingId || null })),
      substitutions: (requestedPlan?.substitutions || []).map(item => ({ originalCardId: item.originalCardId, ...(item.originalPrintingId ? { originalPrintingId: item.originalPrintingId } : {}), replacementCardId: item.replacementCardId, replacementPrintingId: item.replacementPrintingId, reason: item.reason === 'PHYSICAL_CARD_UNAVAILABLE' ? item.reason : null })),
      variantAvailability: (requestedPlan?.variantAvailability || []).map(item => ({ caseId: item.caseId, printingId: item.printingId, availability: ['AVAILABLE', 'UNAVAILABLE'].includes(item.availability) ? item.availability : null, ...(item.reason === 'PHYSICAL_VARIANT_UNAVAILABLE' ? { reason: item.reason } : {}) })),
      ...(requestedPlan?.sleeveAvailability === 'AVAILABLE' ? { sleeveAvailability: 'AVAILABLE' } : {}),
      ...(requestedPlan?.sleeveAvailability === 'UNAVAILABLE' && requestedPlan?.sleeveSkipReason === 'NO_GAME_SLEEVE_AVAILABLE' ? { sleeveAvailability: 'UNAVAILABLE', sleeveSkipReason: 'NO_GAME_SLEEVE_AVAILABLE' } : {})
    };
    function knownCard(cardId) { return context.references.some(ref => ref.cardId === cardId); }
    function knownPrinting(cardId, printingId) { return context.references.some(ref => ref.cardId === cardId && (ref.printingId === printingId || ref.referencePrintingId === printingId || ref.candidatePrintingIds.includes(printingId))); }
    if (plan.sample.some(item => !knownCard(item.cardId) || (item.printingId && !knownPrinting(item.cardId, item.printingId))) ||
        plan.substitutions.some(item => !knownCard(item.originalCardId) || !knownCard(item.replacementCardId) || !knownPrinting(item.replacementCardId, item.replacementPrintingId) || !item.reason) ||
        plan.variantAvailability.some(item => !/^[a-zA-Z0-9][a-zA-Z0-9:_.-]{0,79}$/.test(item.caseId) || !context.references.some(ref => knownPrinting(ref.cardId, item.printingId)) || !item.availability)) throw Error('Plan fields must contain known corpus identities and controlled availability values');
    const trials = [], scenes = [], indexMeasurements = [], trialAnnotations = [], declarationEvents = [];
    const recordedIndexIds = new Set();
    const nonce = [...root.crypto.getRandomValues(new Uint32Array(2))].map(value => value.toString(16).padStart(8, '0')).join('');
    const sessionId = 'q6-' + Date.now().toString(36) + '-' + nonce;
    let active = null, disposed = false, queued = false, nextId = 1;
    let lastForegroundEvent = null, trialTracking = null;
    const pinnedQualification=options.trackSelection==='PINNED_CANONICAL_TRACK';
    if(pinnedQualification && !root.TCGIdentificationLab.beginQualificationTracking) throw Error('Pinned qualification API is unavailable');
    let neutralSince = null, neutralCheckedAt = null;
    let neutralSequence = null, neutralSequenceChangedAt = null, neutralSequenceAtStart = null;
    const retiredTrackUids = new Set();
    let boundaryTrackUids = new Set();
    const attachedLocalState = root.TCGDetectionLab?.state || null;
    const attachedStream = attachedLocalState?.stream || null;
    let trackingSequenceHighWater = finite(attachedLocalState?.analysisSeq) ? attachedLocalState.analysisSeq : null;
    let trackingReset = false;
    const now = () => root.performance.now();
    function requireOpen() { if (disposed) throw Error('Qualification observer is detached'); }
    function safeSession() { return copy({ context, trials, scenes, indexMeasurements, environment, plan, trialAnnotations, declarationEvents }); }
    function requireCanonicalPlan() {
      requireOpen();
      if (!canonicalPlan) throw Error('The canonical build sample is required for guided declarations');
    }
    function recordDeclaration(action, values) {
      declarationEvents.push({ sequence: declarationEvents.length + 1, action, ...values });
    }
    function setSubstitution(originalCardId, replacementCardId, replacementPrintingId) {
      requireCanonicalPlan();
      const original = canonicalPlan.sample.find(item => item.cardId === originalCardId);
      if (!original) throw Error('Unknown original canonical sample card');
      if (plan.substitutions.some(value => value.originalCardId === originalCardId)) throw Error('This sample slot already has an immutable substitution');
      const involved = new Set([originalCardId, replacementCardId]);
      if ([...trials, ...(active && !active.scene ? [active] : [])].some(value => involved.has(value.expectedCardId))) throw Error('Declare a substitution before either card has been tested');
      const value = { originalCardId, originalPrintingId: original.printingId, replacementCardId, replacementPrintingId, reason: 'PHYSICAL_CARD_UNAVAILABLE' };
      const checked = shared.declarations({ ...plan, substitutions: [...plan.substitutions, value] }, canonicalPlan);
      plan.substitutions = checked.substitutions;
      recordDeclaration('SUBSTITUTE', value);
      return copy(value);
    }
    function setSleeveAvailability(availability) {
      requireCanonicalPlan();
      if (!['AVAILABLE', 'UNAVAILABLE'].includes(availability)) throw Error('Choose controlled sleeve availability');
      if ([...trials, ...(active && !active.scene ? [active] : [])].some(value => value.condition === 'SLEEVE_GLARE')) throw Error('Declare sleeve availability before sleeve trials');
      if (plan.sleeveAvailability !== undefined) throw Error('Sleeve availability is already declared');
      plan.sleeveAvailability = availability;
      if (availability === 'UNAVAILABLE') plan.sleeveSkipReason = 'NO_GAME_SLEEVE_AVAILABLE';
      recordDeclaration('SLEEVE_AVAILABILITY', { availability });
      return copy({ sleeveAvailability: availability, ...(plan.sleeveSkipReason ? { sleeveSkipReason: plan.sleeveSkipReason } : {}) });
    }
    function setVariantAvailability(caseId, printingId, availability) {
      requireCanonicalPlan();
      if (plan.variantAvailability.some(value => value.caseId === caseId && value.printingId === printingId)) throw Error('Variant availability is already declared');
      const observed = [...trials, ...(active && !active.scene ? [active] : [])].filter(value => value.expectedPrintingId === printingId);
      if (observed.some(value => value.condition === 'SIMILAR_PRINTINGS') || (availability === 'UNAVAILABLE' && observed.length)) throw Error('Declare variant availability before variant trials; an observed printing cannot be unavailable');
      const value = { caseId, printingId, availability, ...(availability === 'UNAVAILABLE' ? { reason: 'PHYSICAL_VARIANT_UNAVAILABLE' } : {}) };
      const checked = shared.declarations({ ...plan, variantAvailability: [...plan.variantAvailability, value] }, canonicalPlan);
      plan.variantAvailability = checked.variantAvailability;
      recordDeclaration('VARIANT_AVAILABILITY', value);
      return copy(value);
    }
    function invalidateTrial(trialId, reason = 'OPERATOR_PROTOCOL_ERROR') {
      requireCanonicalPlan();
      if (!shared.INVALIDATION_REASONS.includes(reason)) throw Error('Use a controlled protocol invalidation reason');
      if (!trials.some(value => value.trialId === trialId)) throw Error('Only a completed trial can be annotated');
      if (trialAnnotations.some(value => value.trialId === trialId)) throw Error('This trial already has an append-only invalidation');
      const annotation = { trialId, action: 'INVALIDATE', reason, sequence: trialAnnotations.length + 1 };
      trialAnnotations.push(annotation);
      return copy(annotation);
    }
    function contextErrors(snapshot) {
      const current = root.TCGTableStateBridge.getRefs();
      if (snapshot?.playerLocale !== 'en' || snapshot?.visionLocales?.some(locale => locale !== 'en') ||
          current?.some(ref => ref.locale !== 'en')) return ['LOCALE_CONTAMINATION'];
      if (snapshot?.gameId !== 'cyberpunk' || snapshot?.visionIndexKey !== indexKey ||
          snapshot?.visionReferenceCount !== 229 || !Array.isArray(current) ||
          JSON.stringify(current.map(workerIdentity)) !== signature || !snapshot.libraryReady ||
          !snapshot.matcherWorker?.ready || snapshot.libraryIntegrity?.degraded !== false) return ['CONTEXT_CHANGED'];
      return [];
    }
    function checkTrackingContinuity() {
      const local = root.TCGDetectionLab?.state || null;
      if (attachedLocalState && (local !== attachedLocalState || (local?.stream || null) !== attachedStream)) trackingReset = true;
      if (finite(local?.analysisSeq)) {
        if (trackingSequenceHighWater !== null && local.analysisSeq < trackingSequenceHighWater) trackingReset = true;
        trackingSequenceHighWater = Math.max(trackingSequenceHighWater || 0, local.analysisSeq);
      }
      return !trackingReset;
    }
    function resolve(value, errors) {
      if (!value) return null;
      const key = value.refId || value.image;
      const found = byRef.get(key) || byImage.get(key);
      if (!found || found.locale !== 'en' || (value.cardId && value.cardId !== found.cardId) ||
          (value.printingId && value.printingId !== found.printingId)) {
        errors.push(found?.locale && found.locale !== 'en' ? 'LOCALE_CONTAMINATION' : 'UNKNOWN_REFERENCE');
        return null;
      }
      return found;
    }
    function getNeutralState() {
      requireOpen();
      const atMs = now(), blockers = [];
      const snapshot = root.TCGIdentificationLab.getSnapshot();
      const detector = root.TCGVisionEngine.getSnapshot();
      const local = root.TCGDetectionLab?.state;
      const table = root.TCGTableStateEngine?.getSnapshot?.();
      if (!checkTrackingContinuity()) blockers.push('TRACKING_RESET_NEW_SESSION_REQUIRED');
      if (contextErrors(snapshot).length) blockers.push('CONTEXT_CHANGED');
      if (!detectorRunning(detector)) blockers.push('DETECTOR_NOT_RUNNING');
      if (snapshot.enabled === false) blockers.push('IDENTIFICATION_DISABLED');
      if (detector.performanceBudget?.inputPaused) blockers.push('DETECTOR_PAUSED');
      if (snapshot.matcherWorker?.busy || snapshot.matcherWorker?.queued || table?.workerBusy) blockers.push('MATCHER_PENDING');
      const liveTracks = [...(Array.isArray(detector.tracking?.activeTracks) ? detector.tracking.activeTracks : []),
        ...(Array.isArray(local?.tracks) ? local.tracks : [])];
      for (const track of liveTracks) if (track?.uid != null) retiredTrackUids.add(String(track.uid));
      if (Number(detector.activeCards || 0) > 0 || Number(detector.rawDetections || 0) > 0 || liveTracks.length) blockers.push('CARD_PRESENT');
      const memoryMs = finite(local?.identityMemoryMs) ? local.identityMemoryMs : null;
      for (const track of Array.isArray(local?.lostTracks) ? local.lostTracks : []) {
        if (track?.uid != null) retiredTrackUids.add(String(track.uid));
        // A stale array entry is harmless only after the unchanged engine's own
        // expiry. Never delete it, reset tracking, or shorten that memory.
        if (memoryMs === null || !finite(track?.lostAtMs) || atMs - track.lostAtMs <= memoryMs) blockers.push('TRACK_MEMORY_RETAINED');
      }
      if (snapshot.hoveredTrack?.uid != null) {
        retiredTrackUids.add(String(snapshot.hoveredTrack.uid));
        blockers.push('FOREGROUND_TRACK_RETAINED');
      }
      if (snapshot.identification?.accepted) blockers.push('FOREGROUND_IDENTITY_RETAINED');
      if ((table?.entries || []).some(entry => entry.activeUid != null || entry.identity || entry.pendingSwitch)) blockers.push('TABLE_MEMORY_RETAINED');
      // The ordinary player UI deliberately keeps its last HD card on pointer
      // leave. Once real tracking/matcher memory is gone, clear that presentation
      // through its existing handoff API. This does not mutate engine memory.
      if (!blockers.length && snapshot.visibleIdentity && (!active || active.removal)) {
        root.TCGIdentificationLab.clearVisibleForHandoff?.('Retirez la carte precedente - attente de remise a zero de Vision');
      }
      if (root.TCGIdentificationLab.getSnapshot().visibleIdentity) blockers.push('VISIBLE_IDENTITY_RETAINED');
      const sequence = finite(local?.analysisSeq) ? local.analysisSeq : detector.scheduling?.visionFramesProcessed;
      if (finite(sequence)) {
        if (neutralSequence !== sequence) { neutralSequence = sequence; neutralSequenceChangedAt = atMs; }
        if (neutralSequenceChangedAt !== null && atMs - neutralSequenceChangedAt > 1000) blockers.push('DETECTOR_NOT_ADVANCING');
      }
      if (neutralCheckedAt !== null && (atMs < neutralCheckedAt || atMs - neutralCheckedAt > NEUTRAL_MAX_GAP_MS)) neutralSince = null;
      neutralCheckedAt = atMs;
      if (blockers.length) { neutralSince = null; neutralSequenceAtStart = null; }
      else if (neutralSince === null) { neutralSince = atMs; neutralSequenceAtStart = finite(sequence) ? sequence : null; }
      const neutralForMs = neutralSince === null ? 0 : Math.max(0, atMs - neutralSince);
      const freshFrames = neutralSequenceAtStart === null || sequence !== neutralSequenceAtStart;
      const ready = !blockers.length && neutralForMs >= NEUTRAL_WINDOW_MS && freshFrames;
      return { ready, reason: blockers[0] || (ready ? 'NEUTRAL_CONFIRMED' : freshFrames ? 'NEUTRAL_WINDOW_PENDING' : 'WAITING_FOR_FRESH_DETECTION'),
        blockers: [...new Set(blockers)], neutralForMs, requiredMs: NEUTRAL_WINDOW_MS,
        remainingMs: Math.max(0, NEUTRAL_WINDOW_MS - neutralForMs) };
    }
    function requireNeutral() {
      const state = getNeutralState();
      if (!state.ready) throw Error('Qualification requires confirmed neutral Vision before T0: ' + state.reason);
      // Neither an old foreground event nor an already queued callback may seed
      // the next observation. The first recorded state is read after this fence.
      lastForegroundEvent = null;
      boundaryTrackUids = new Set(retiredTrackUids);
      return { requiredMs: NEUTRAL_WINDOW_MS, confirmedForMs: state.neutralForMs };
    }
    function observation() {
      const snapshot = root.TCGIdentificationLab.getSnapshot();
      const detection = root.TCGVisionEngine.getSnapshot();
      const table = root.TCGTableStateEngine?.getSnapshot?.();
      const errors = contextErrors(snapshot);
      if (!checkTrackingContinuity()) errors.push('CONTEXT_CHANGED');
      if (active?.provenance === 'physical' && !detectorRunning(detection)) errors.push('MISSING_RUNTIME_STATE');
      const candidateRefs = [];
      for (const candidate of snapshot.identification?.candidates || []) {
        const ref = resolve(candidate, errors); if (ref) candidateRefs.push(ref);
      }
      for (const entry of table?.entries || []) {
        // Inspect every exposed candidate, including retained entries; do not
        // count a retained off-table identity as a current identification.
        for (const candidate of entry.observations?.at(-1)?.candidates || []) {
          const ref = resolve(candidate, errors); if (ref) candidateRefs.push(ref);
        }
      }
      const identities = [];
      const visible = snapshot.visibleIdentity;
      if (visible?.accepted && !boundaryTrackUids.has(String(visible.trackUid))) {
        const ref = resolve(visible, errors);
        if (ref) identities.push({ ref, source: 'VISIBLE', value: visible });
      } else if (snapshot.identification?.accepted && snapshot.identification.best && !boundaryTrackUids.has(String(snapshot.hoveredTrack?.uid))) {
        const ref = resolve(snapshot.identification.best, errors);
        if (ref) identities.push({ ref, source: 'FOREGROUND', value: snapshot.identification.best });
      }
      for (const entry of table?.entries || []) {
        if (entry.activeUid == null || !entry.identity || entry.identitySuspended || entry.needsReacquireVerification || boundaryTrackUids.has(String(entry.activeUid))) continue;
        const ref = resolve(entry.identity, errors);
        if (ref) identities.push({ ref, source: 'TABLE_MEMORY', value: entry.identity });
      }
      let chosen = identities[0] || null;
      let tracked=null;
      if(pinnedQualification && active && !active.scene) {
        tracked=trialTracking?.getState();
        if(!tracked?.active) errors.push('MISSING_RUNTIME_STATE');
        if(tracked?.status==='MULTIPLE_TRACKS') errors.push('MULTIPLE_IDENTITIES');
        if(tracked?.errors?.length) errors.push('CRASH');
        if(snapshot.enabled===false) errors.push('MISSING_RUNTIME_STATE');
        // The selected physical track's accepted engine decision is authoritative.
        // UI presentation and pointer leave cannot create or remove this identity.
        identities.length=0; chosen=null;
        const value=tracked?.trackPresent && tracked.status==='TRACKING' ? tracked.identity : null;
        if(value?.accepted) {
          const ref=resolve(value,errors);
          if(ref) { chosen={ref,source:'QUALIFICATION_TRACK',value}; identities.push(chosen); }
        }
      }
      const best = snapshot.identification?.best;
      const acceptedBest = snapshot.identification?.accepted && best && chosen && resolve(best, errors)?.refId === chosen.ref.refId;
      const out = {
        atMs: now(), detected: Number(detection.activeCards || 0) > 0,
        identifiedCardId: chosen?.ref.cardId || null,
        identifiedPrintingId: chosen?.ref.printingId || null,
        identifiedCandidates: [...new Map(identities.map(item => [item.ref.refId, { cardId: item.ref.cardId, printingId: item.ref.printingId || null, refId: item.ref.refId }])).values()],
        referenceIds: chosen ? [chosen.ref.refId] : [],
        candidateIds: [...new Set(candidateRefs.map(ref => ref.refId))].sort(),
        locale: 'en', candidatePrintingIds: chosen ? [...chosen.ref.candidatePrintingIds] : [],
        recognitionMode: chosen?.ref.recognitionMode || null,
        runtimeState: runtimeState(snapshot, detection, chosen),
        ...(tracked?{qualificationTracking:{mode:'PINNED_CANONICAL_TRACK',status:tracked.status,
          lockedTrackUid:tracked.lockedTrackUid,trackPresent:tracked.trackPresent,
          observedTrackCount:tracked.observedTrackCount,decisionAtMs:tracked.decisionAtMs,
          accepted:Boolean(tracked.identity?.accepted),errors:[...(tracked.errors||[])]}}:{}),
        validityErrors: [...new Set(errors)].sort()
      };
      if (acceptedBest && finite(best.matcherScore)) { out.score = best.matcherScore; out.scoreKind = 'matcherScore'; }
      else if (chosen?.source === 'QUALIFICATION_TRACK' && finite(chosen.value.score)) {
        out.score=chosen.value.score; out.scoreKind='matcherScore';
      } else if (chosen?.source === 'TABLE_MEMORY' && finite(chosen.value.confidence)) {
        // Existing memory confidence is a matcher score, never a probability.
        out.score = chosen.value.confidence; out.scoreKind = 'matcherScore';
      } else if (chosen && lastForegroundEvent?.accepted &&
          lastForegroundEvent.refId === chosen.ref.refId && finite(lastForegroundEvent.visualIndex)) {
        out.score = lastForegroundEvent.visualIndex; out.scoreKind = 'visualIndex';
      }
      return out;
    }
    function sample() {
      requireOpen();
      if (!active) return null;
      let value;
      try { value = observation(); }
      catch { value = { atMs: now(), detected: false, identifiedCardId: null, identifiedPrintingId: null, identifiedCandidates: [], referenceIds: [], candidateIds: [], locale: 'en', validityErrors: ['CRASH'] }; }
      if (active.observations.length && value.atMs <= active.observations.at(-1).atMs) return copy(active.observations.at(-1));
      active.observations.push(value);
      if (active.removal && active.removal.clearAtMs == null && value.atMs >= active.removal.t0Ms && !value.identifiedCardId) active.removal.clearAtMs = value.atMs;
      getNeutralState();
      return copy(value);
    }
    function provenance(spec) {
      const mode = spec.mode || spec.provenance;
      if (mode !== 'physical' && mode !== 'automated') throw Error('Explicit mode physical or automated is required');
      if (mode === 'physical' && environment.execution === 'AUTOMATED') throw Error('Automated execution cannot declare physical evidence');
      if (mode === 'physical' && spec.physicalConfirmation !== PHYSICAL_CONFIRMATION) throw Error('Physical capture requires explicit real-card operator confirmation');
      if (mode === 'physical') {
        const detector = root.TCGVisionEngine.getSnapshot();
        if (!detectorRunning(detector)) throw Error('Physical capture requires the existing camera-fed Vision detector to be running');
      }
      return {
        provenance: mode,
        captureMethod: mode === 'physical' ? 'runtime-manual' : 'automated-runtime-events',
        ...(mode === 'physical' ? { physicalConfirmation: PHYSICAL_CONFIRMATION } : {})
      };
    }
    function begin(spec, scene) {
      requireOpen();
      if (active) throw Error('End the current trial or scene first');
      const errors = contextErrors(root.TCGIdentificationLab.getSnapshot());
      if (errors.length) throw Error('Qualification context changed: ' + errors.join(','));
      const evidence = provenance(spec);
      if (!scene && canonicalPlan) {
        if (plan.substitutions.some(value => value.originalCardId === spec.expectedCardId)) throw Error('Use the declared substitute for this canonical slot');
        if (spec.condition === 'SLEEVE_GLARE' && plan.sleeveAvailability === 'UNAVAILABLE') throw Error('Sleeves are declared unavailable');
        if (plan.variantAvailability.some(value => value.availability === 'UNAVAILABLE' && value.printingId === spec.expectedPrintingId)) throw Error('This physical variant is declared unavailable');
      }
      if (scene && !harness.SCENES.includes(spec.scene)) throw Error('Unknown qualification scene');
      if (!scene && spec.condition !== undefined && !harness.CONDITIONS.includes(spec.condition)) throw Error('Unknown qualification condition');
      if (!Array.isArray(spec.notes || []) || (spec.notes || []).some(note => !harness.NOTE_CODES.includes(note))) throw Error('Use only controlled observation note codes');
      for (const key of ['trialId', 'sceneId']) if (spec[key] !== undefined && !/^[a-zA-Z0-9][a-zA-Z0-9:_.-]{0,79}$/.test(spec[key])) throw Error('Observation IDs must be short technical identifiers');
      if (!scene && !context.references.some(ref => ref.cardId === spec.expectedCardId)) throw Error('Expected card is outside the active EN corpus');
      if (!scene && spec.expectedPrintingId && !context.references.some(ref => ref.cardId === spec.expectedCardId && (ref.printingId === spec.expectedPrintingId || ref.referencePrintingId === spec.expectedPrintingId || ref.candidatePrintingIds.includes(spec.expectedPrintingId)))) throw Error('Expected printing is outside the active EN corpus');
      if (spec.previousTrialId !== undefined && !trials.some(trial => trial.trialId === spec.previousTrialId && trial.removal)) throw Error('A rapid-switch link requires a completed prior trial with an explicit removal marker');
      const neutralBoundary = requireNeutral();
      active = {
        ...(spec.previousTrialId ? { previousTrialId: spec.previousTrialId } : {}),
        trialId: typeof spec.trialId === 'string' ? spec.trialId : sessionId + '-trial-' + nextId++,
        timestamp: new Date().toISOString(), ...evidence,
        ...(scene ? { sceneId: typeof spec.sceneId === 'string' ? spec.sceneId : sessionId + '-scene-' + nextId++, scene: spec.scene } : {
          condition: spec.condition || 'NOMINAL', expectedCardId: spec.expectedCardId,
          expectedPrintingId: spec.expectedPrintingId || null,
          stableWindowMs: spec.stableWindowMs ?? 1000,
          maxObservationGapMs: spec.maxObservationGapMs ?? 1000
        }),
        t0Ms: now(), observations: [], neutralBoundary,
        ...(pinnedQualification&&!scene?{identityMeasurement:'PINNED_CANONICAL_TRACK'}:{}),
        ...(!scene ? { attemptDiagnostics: [], attemptDiagnosticsDropped: 0, attemptDiagnosticsTruncated: false } : {}),
        notes: ['MANUAL_T0', ...(spec.notes || [])]
      };
      neutralSince = null;
      if(pinnedQualification&&!scene) {
        try { trialTracking=root.TCGIdentificationLab.beginQualificationTracking(); }
        catch(error) { active=null; throw error; }
      }
      sample();
      active.t0Ms = active.observations[0].atMs;
      return copy(active);
    }
    function finish(scene) {
      requireOpen();
      if (!active || Boolean(active.scene) !== scene) throw Error(scene ? 'No active scene' : 'No active card trial');
      sample(); active.endMs = active.observations.at(-1).atMs;
      const result = active; active = null;
      trialTracking?.stop(); trialTracking=null;
      (scene ? scenes : trials).push(result);
      return copy(result);
    }
    function eventSample(event) {
      if (event?.type === 'tcg-identification-result' && (!active || !finite(event.detail?.at) || event.detail.at >= active.t0Ms)) lastForegroundEvent = event.detail || null;
      if (disposed) return;
      if (event?.type === 'tcg-identification-attempt' && active && !active.scene) {
        const input = event.detail;
        const sanitizer = root.TCGVisionQualificationDiagnostics?.sanitizeAttempt;
        // Completion time alone cannot associate a request with B. Reject an
        // A-origin request even when its asynchronous completion arrives later.
        const stale = !finite(input?.requestStartedAtMs) || input.requestStartedAtMs < active.t0Ms || boundaryTrackUids.has(String(input.trackUid));
        const value = !stale && sanitizer ? sanitizer(input, { expectedCardId: active.expectedCardId,
          references: context.references, t0Ms: active.t0Ms, endMs: now() }) : null;
        if (!value) active.attemptDiagnosticsDropped++;
        else if (active.attemptDiagnostics.length >= MAX_ATTEMPT_DIAGNOSTICS) {
          active.attemptDiagnosticsTruncated = true; active.attemptDiagnosticsDropped++;
        } else if (!active.attemptDiagnostics.some(previous => previous.attemptId === value.attemptId &&
            previous.requestStartedAtMs === value.requestStartedAtMs && previous.trackUid === value.trackUid)) {
          active.attemptDiagnostics.push(value);
        }
      }
      if (!active) { getNeutralState(); return; }
      if (queued) return;
      queued = true;
      root.queueMicrotask(() => { queued = false; if (active && !disposed) sample(); });
    }
    for (const event of EVENTS) root.addEventListener(event, eventSample);
    const resetNotice = () => { trackingReset = true; neutralSince = null; trialTracking?.stop(); };
    for (const event of RESET_EVENTS) root.addEventListener(event, resetNotice);
    const resetControls = [['visionResetTrackingButton', 'click'], ['visionTrackingToggle', 'change'],
      ['visionShapeFilterToggle', 'change'], ['visionVisualLockToggle', 'change'],
      ['visionResolutionSelect', 'change'], ['visionCameraSelect', 'change']].map(([id, event]) => ({ element: root.document?.getElementById?.(id), event })).filter(value => value.element?.addEventListener);
    for (const { element, event } of resetControls) element.addEventListener(event, resetNotice, true);
    // Observation cadence measures persistence of the exposed runtime state,
    // not a new matcher inference or any engine smoothing.
    const timer = root.setInterval(() => { if (!disposed) { if (active) sample(); else getNeutralState(); } }, 250);
    getNeutralState();
    async function recordIndexMeasurement(kind) {
      requireOpen();
      if (!['COLD', 'WARM_RELOAD'].includes(kind)) throw Error('Index kind must be COLD or WARM_RELOAD');
      const snapshot = root.TCGIdentificationLab.getSnapshot();
      if (contextErrors(snapshot).length) throw Error('Qualification index context changed');
      const p = snapshot.libraryPerformance;
      if (!p || !finite(p.descriptorBuildMs) || !finite(p.totalReadyMs)) throw Error('Existing index timing is unavailable');
      const capture = root.TCGTableStateBridge.getSnapshot?.();
      if (!capture?.capturedAt || !Number.isFinite(capture.captureCount) || !Number.isFinite(root.performance.timeOrigin)) throw Error('Index initialization identity is unavailable');
      const identity = JSON.stringify([root.performance.timeOrigin, capture.capturedAt, capture.captureCount, indexKey]);
      const digest = await root.crypto.subtle.digest('SHA-256', new TextEncoder().encode(identity));
      const measurementId = 'index-' + [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
      requireOpen();
      if (contextErrors(root.TCGIdentificationLab.getSnapshot()).length) throw Error('Qualification context changed while reading index metadata');
      if (recordedIndexIds.has(measurementId)) throw Error('This index initialization was already measured');
      recordedIndexIds.add(measurementId);
      const measurement = {
        measurementId, kind, durationMs: p.descriptorBuildMs, descriptorBuildMs: p.descriptorBuildMs,
        totalReadyMs: p.totalReadyMs, databaseLoadMs: p.databaseLoadMs,
        workerInitPostMs: snapshot.matcherWorker?.initPostMs,
        cacheStatus: p.cacheStatus, referenceCount: 229,
        referenceCountBeforeLocale: p.referenceCountBeforeLocale,
        referenceCountAfterLocale: p.referenceCountAfterLocale,
        networkRequests: p.networkRequests, networkBytes: p.networkBytes,
        provenance: environment.execution === 'AUTOMATED' ? 'AUTOMATED_BROWSER' : 'OPERATOR_RUNTIME'
      };
      indexMeasurements.push(measurement); return copy(measurement);
    }
    function exportReport() {
      requireOpen();
      if (active) throw Error('End the active observation before exporting');
      if (sampleDocument) return shared.generate({ productSha: context.productSha, sampleProductSha: context.productSha,
        references: context.references, sampleDocument, sessions: [safeSession()] });
      return harness.buildReport({ context: copy(context), trials: copy(trials), scenes: copy(scenes),
        indexMeasurements: copy(indexMeasurements), environment, plan });
    }
    return Object.freeze({
      version: '1.2.0-pinned-canonical-qualification',
      context: () => copy(context),
      getNeutralState,
      startTrial: spec => begin(spec || {}, false),
      endTrial: () => finish(false),
      switchTrial(spec) {
        if (!active || active.scene || !active.removal) throw Error('Rapid switch requires an active card trial with an explicit removal marker');
        // A failed readiness check must leave A active and intact. Only an
        // explicitly removed A followed by the same neutral boundary can link B.
        const current = active; active = null;
        let readiness;
        try { readiness = getNeutralState(); } finally { active = current; }
        if (!readiness.ready) throw Error('Rapid switch requires confirmed neutral Vision: ' + readiness.reason);
        const previous = finish(false);
        const next = begin({ ...spec, previousTrialId: previous.trialId, notes: ['RAPID_SWITCH', ...(spec?.notes || [])] }, false);
        return { previous, next };
      },
      startScene: spec => begin(spec || {}, true),
      endScene: () => finish(true),
      sample,
      markRemoval() {
        requireOpen();
        if (!active || active.scene || active.removal) throw Error('Card removal requires an active card trial and one marker');
        active.removal = { t0Ms: now(), clearAtMs: null };
        active.notes.push('CARD_REMOVED'); sample(); return copy(active.removal);
      },
      recordIndexMeasurement,
      setSubstitution, setSleeveAvailability, setVariantAvailability, invalidateTrial,
      getProgress() { requireOpen(); return { ...safeSession(), active: active ? copy(active) : null }; },
      // Live UI polling must not clone the immutable 229-reference context or
      // every completed trial. This copy contains controlled observer data only.
      getActiveObservation() { requireOpen(); return active ? copy({...active,
        ...(trialTracking?{qualificationTracking:trialTracking.getState()}: {})}) : null; },
      getSession() {
        requireOpen();
        if (active) throw Error('End the active observation before exporting');
        return safeSession();
      },
      getRawResults: () => copy({ context, trials, scenes, indexMeasurements }),
      saveSession() {
        requireOpen();
        if (active) throw Error('End the active observation before exporting');
        const session = safeSession();
        const json = harness.stableStringify(session);
        const url = root.URL.createObjectURL(new root.Blob([json], { type: 'application/json' }));
        const anchor = root.document.createElement('a');
        anchor.href = url; anchor.download = 'vision-qualification-session.json';
        anchor.click(); root.setTimeout(() => root.URL.revokeObjectURL(url), 0);
      },
      exportReport,
      exportJson() { return harness.stableStringify(exportReport()); },
      downloadReport(filename = 'vision-qualification-1.0.json') {
        if (!['vision-qualification-1.0.json', 'vision-qualification-reading.json'].includes(filename)) throw Error('Use a controlled qualification report filename');
        const json = harness.stableStringify(exportReport());
        const url = root.URL.createObjectURL(new root.Blob([json], { type: 'application/json' }));
        const anchor = root.document.createElement('a');
        anchor.href = url; anchor.download = filename;
        anchor.click(); root.setTimeout(() => root.URL.revokeObjectURL(url), 0);
      },
      detach() {
        if (disposed) return;
        if (active) throw Error('End the active observation before detaching');
        for (const event of EVENTS) root.removeEventListener(event, eventSample);
        for (const event of RESET_EVENTS) root.removeEventListener(event, resetNotice);
        for (const { element, event } of resetControls) element.removeEventListener(event, resetNotice, true);
        root.clearInterval(timer); disposed = true;
        if (root[observerKey] === reservation) delete root[observerKey];
      }
    });
  }
  return Object.freeze({ attach, databaseSha: DATABASE_SHA, physicalConfirmation: PHYSICAL_CONFIRMATION });
});
