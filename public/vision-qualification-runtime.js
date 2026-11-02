(function initQualificationRuntime(root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TCGVisionQualificationRuntime = api;
})(typeof window !== 'undefined' ? window : globalThis, function createQualificationRuntime(root) {
  'use strict';

  const DATABASE_SHA = '56402636a77af9c8b5dc4e3b61c509a185f3c834';
  const PHYSICAL_CONFIRMATION = 'REAL_CARDS_OPERATOR_CONFIRMED';
  const EVENTS = ['tcg-tracks-updated', 'tcg-identification-result', 'tcg-table-state-updated', 'tcg-identification-context', 'tcg-identification-visible'];
  function copy(value) { return JSON.parse(JSON.stringify(value)); }
  function finite(value) { return typeof value === 'number' && Number.isFinite(value); }
  function reference(ref) {
    return {
      refId: ref.refId, cardId: ref.cardId, printingId: ref.printingId || null,
      referencePrintingId: ref.referencePrintingId || null,
      candidatePrintingIds: Array.isArray(ref.candidatePrintingIds) ? [...ref.candidatePrintingIds] : [],
      recognitionMode: ref.recognitionMode || null, locale: ref.locale
    };
  }

  // Loaded explicitly from the developer console. This module never starts
  // cameras, workers, engines, a Room, matching, or a media capture.
  async function attach(options = {}) {
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
    const plan = {
      sample: (options.plan?.sample || []).map(item => ({ cardId: item.cardId, printingId: item.printingId || null })),
      substitutions: (options.plan?.substitutions || []).map(item => ({ originalCardId: item.originalCardId, replacementCardId: item.replacementCardId, replacementPrintingId: item.replacementPrintingId, reason: item.reason === 'PHYSICAL_CARD_UNAVAILABLE' ? item.reason : null })),
      variantAvailability: (options.plan?.variantAvailability || []).map(item => ({ caseId: item.caseId, printingId: item.printingId, availability: ['AVAILABLE', 'UNAVAILABLE'].includes(item.availability) ? item.availability : null, ...(item.reason === 'PHYSICAL_VARIANT_UNAVAILABLE' ? { reason: item.reason } : {}) })),
      ...(options.plan?.sleeveAvailability === 'UNAVAILABLE' && options.plan?.sleeveSkipReason === 'NO_GAME_SLEEVE_AVAILABLE' ? { sleeveAvailability: 'UNAVAILABLE', sleeveSkipReason: 'NO_GAME_SLEEVE_AVAILABLE' } : {})
    };
    function knownCard(cardId) { return context.references.some(ref => ref.cardId === cardId); }
    function knownPrinting(cardId, printingId) { return context.references.some(ref => ref.cardId === cardId && (ref.printingId === printingId || ref.referencePrintingId === printingId || ref.candidatePrintingIds.includes(printingId))); }
    if (plan.sample.some(item => !knownCard(item.cardId) || (item.printingId && !knownPrinting(item.cardId, item.printingId))) ||
        plan.substitutions.some(item => !knownCard(item.originalCardId) || !knownCard(item.replacementCardId) || !knownPrinting(item.replacementCardId, item.replacementPrintingId) || !item.reason) ||
        plan.variantAvailability.some(item => !/^[a-zA-Z0-9][a-zA-Z0-9:_.-]{0,79}$/.test(item.caseId) || !context.references.some(ref => knownPrinting(ref.cardId, item.printingId)) || !item.availability)) throw Error('Plan fields must contain known corpus identities and controlled availability values');
    const trials = [], scenes = [], indexMeasurements = [];
    const recordedIndexIds = new Set();
    const nonce = [...root.crypto.getRandomValues(new Uint32Array(2))].map(value => value.toString(16).padStart(8, '0')).join('');
    const sessionId = 'q6-' + Date.now().toString(36) + '-' + nonce;
    let active = null, disposed = false, queued = false, nextId = 1;
    let lastForegroundEvent = null;
    const now = () => root.performance.now();
    function requireOpen() { if (disposed) throw Error('Qualification observer is detached'); }
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
    function observation() {
      const snapshot = root.TCGIdentificationLab.getSnapshot();
      const detection = root.TCGVisionEngine.getSnapshot();
      const table = root.TCGTableStateEngine?.getSnapshot?.();
      const errors = contextErrors(snapshot);
      if (active?.provenance === 'physical' && (!detection.active || !detection.modelReady)) errors.push('MISSING_RUNTIME_STATE');
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
      if (visible?.accepted) {
        const ref = resolve(visible, errors);
        if (ref) identities.push({ ref, source: 'VISIBLE', value: visible });
      } else if (snapshot.identification?.accepted && snapshot.identification.best) {
        const ref = resolve(snapshot.identification.best, errors);
        if (ref) identities.push({ ref, source: 'FOREGROUND', value: snapshot.identification.best });
      }
      for (const entry of table?.entries || []) {
        if (entry.activeUid == null || !entry.identity || entry.identitySuspended || entry.needsReacquireVerification) continue;
        const ref = resolve(entry.identity, errors);
        if (ref) identities.push({ ref, source: 'TABLE_MEMORY', value: entry.identity });
      }
      const chosen = identities[0] || null;
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
        validityErrors: [...new Set(errors)].sort()
      };
      if (acceptedBest && finite(best.matcherScore)) { out.score = best.matcherScore; out.scoreKind = 'matcherScore'; }
      else if (chosen?.source === 'TABLE_MEMORY' && finite(chosen.value.confidence)) {
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
      return copy(value);
    }
    function provenance(spec) {
      const mode = spec.mode || spec.provenance;
      if (mode !== 'physical' && mode !== 'automated') throw Error('Explicit mode physical or automated is required');
      if (mode === 'physical' && environment.execution === 'AUTOMATED') throw Error('Automated execution cannot declare physical evidence');
      if (mode === 'physical' && spec.physicalConfirmation !== PHYSICAL_CONFIRMATION) throw Error('Physical capture requires explicit real-card operator confirmation');
      if (mode === 'physical') {
        const detector = root.TCGVisionEngine.getSnapshot();
        if (!detector.active || !detector.modelReady) throw Error('Physical capture requires the existing camera-fed Vision detector to be running');
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
      if (scene && !harness.SCENES.includes(spec.scene)) throw Error('Unknown qualification scene');
      if (!scene && spec.condition !== undefined && !harness.CONDITIONS.includes(spec.condition)) throw Error('Unknown qualification condition');
      if (!Array.isArray(spec.notes || []) || (spec.notes || []).some(note => !harness.NOTE_CODES.includes(note))) throw Error('Use only controlled observation note codes');
      for (const key of ['trialId', 'sceneId']) if (spec[key] !== undefined && !/^[a-zA-Z0-9][a-zA-Z0-9:_.-]{0,79}$/.test(spec[key])) throw Error('Observation IDs must be short technical identifiers');
      if (!scene && !context.references.some(ref => ref.cardId === spec.expectedCardId)) throw Error('Expected card is outside the active EN corpus');
      if (!scene && spec.expectedPrintingId && !context.references.some(ref => ref.cardId === spec.expectedCardId && (ref.printingId === spec.expectedPrintingId || ref.referencePrintingId === spec.expectedPrintingId || ref.candidatePrintingIds.includes(spec.expectedPrintingId)))) throw Error('Expected printing is outside the active EN corpus');
      if (spec.previousTrialId !== undefined && !trials.some(trial => trial.trialId === spec.previousTrialId && trial.removal)) throw Error('A rapid-switch link requires a completed prior trial with an explicit removal marker');
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
        t0Ms: now(), observations: [], notes: ['MANUAL_T0', ...(spec.notes || [])]
      };
      sample();
      active.t0Ms = active.observations[0].atMs;
      return copy(active);
    }
    function finish(scene) {
      requireOpen();
      if (!active || Boolean(active.scene) !== scene) throw Error(scene ? 'No active scene' : 'No active card trial');
      sample(); active.endMs = active.observations.at(-1).atMs;
      const result = active; active = null;
      (scene ? scenes : trials).push(result);
      return copy(result);
    }
    function eventSample(event) {
      if (event?.type === 'tcg-identification-result') lastForegroundEvent = event.detail || null;
      if (!active || queued || disposed) return;
      queued = true;
      root.queueMicrotask(() => { queued = false; if (active && !disposed) sample(); });
    }
    for (const event of EVENTS) root.addEventListener(event, eventSample);
    // Observation cadence measures persistence of the exposed runtime state,
    // not a new matcher inference or any engine smoothing.
    const timer = root.setInterval(() => { if (active && !disposed) sample(); }, 250);
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
      return harness.buildReport({ context: copy(context), trials: copy(trials), scenes: copy(scenes),
        indexMeasurements: copy(indexMeasurements), environment, plan });
    }
    return Object.freeze({
      version: '1.0.0-qualification-observer',
      context: () => copy(context),
      startTrial: spec => begin(spec || {}, false),
      endTrial: () => finish(false),
      switchTrial(spec) {
        if (!active || active.scene || !active.removal) throw Error('Rapid switch requires an active card trial with an explicit removal marker');
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
      getSession() {
        requireOpen();
        if (active) throw Error('End the active observation before exporting');
        return copy({ context, trials, scenes, indexMeasurements, environment, plan });
      },
      getRawResults: () => copy({ context, trials, scenes, indexMeasurements }),
      saveSession() {
        requireOpen();
        if (active) throw Error('End the active observation before exporting');
        const session = copy({ context, trials, scenes, indexMeasurements, environment, plan });
        const json = harness.stableStringify(session);
        const url = root.URL.createObjectURL(new root.Blob([json], { type: 'application/json' }));
        const anchor = root.document.createElement('a');
        anchor.href = url; anchor.download = 'vision-qualification-session.json';
        anchor.click(); root.setTimeout(() => root.URL.revokeObjectURL(url), 0);
      },
      exportReport,
      exportJson() { return harness.stableStringify(exportReport()); },
      downloadReport() {
        const json = harness.stableStringify(exportReport());
        const url = root.URL.createObjectURL(new root.Blob([json], { type: 'application/json' }));
        const anchor = root.document.createElement('a');
        anchor.href = url; anchor.download = 'vision-qualification-1.0.json';
        anchor.click(); root.setTimeout(() => root.URL.revokeObjectURL(url), 0);
      },
      detach() {
        if (disposed) return;
        if (active) throw Error('End the active observation before detaching');
        for (const event of EVENTS) root.removeEventListener(event, eventSample);
        root.clearInterval(timer); disposed = true;
      }
    });
  }
  return Object.freeze({ attach, databaseSha: DATABASE_SHA, physicalConfirmation: PHYSICAL_CONFIRMATION });
});
