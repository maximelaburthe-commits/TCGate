(function initVisionQualification(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TCGateVisionQualification = api;
})(typeof window !== 'undefined' ? window : globalThis, function createVisionQualification() {
  'use strict';

  // Measurement definitions only. These values never enter the Vision engine.
  const DATABASE_SHA = '56402636a77af9c8b5dc4e3b61c509a185f3c834';
  const CONDITIONS = Object.freeze(['NOMINAL', 'ANGLE', 'SLEEVE_GLARE', 'LOW_LIGHT', 'DISTANCE', 'ORIENTATION', 'SIMILAR_PRINTINGS', 'STABILITY', 'REMOVAL', 'RAPID_SWITCH']);
  const CATEGORIES = Object.freeze(['CORRECT', 'NO_DETECTION', 'NOT_IDENTIFIED', 'WRONG_IDENTIFICATION', 'UNSTABLE', 'INVALID_TEST']);
  const SCENES = Object.freeze(['EMPTY_TABLE', 'PLAYMAT', 'VISIBLE_HAND', 'CLOSED_DECK', 'DESK_OBJECTS']);
  const NOTE_CODES = Object.freeze(['SLEEVE_USED', 'GLARE_VISIBLE', 'SUBSTITUTED_SAME_PROFILE', 'MANUAL_T0', 'CARD_REMOVED', 'RAPID_SWITCH', 'PHYSICAL_CARD_UNAVAILABLE', 'ANGLE_SLIGHT', 'ANGLE_MODERATE', 'DISTANCE_NEAR', 'DISTANCE_FAR', 'ROTATED_SLIGHT']);
  const ERROR_CODES = Object.freeze(['RUNTIME_CONTEXT_CHANGED', 'CONTEXT_CHANGED', 'LOCALE_CONTAMINATION', 'MULTIPLE_IDENTITIES', 'UNKNOWN_REFERENCE', 'AMBIGUOUS_REFERENCE', 'CROSS_LOCALE_REFERENCE', 'CRASH', 'INTERRUPTED', 'MISSING_RUNTIME_STATE', 'OBSERVATION_LIMIT', 'AUTOMATED_ENVIRONMENT_CANNOT_BE_PHYSICAL']);
  const DEFAULT_STABLE_WINDOW_MS = 1000;
  const DEFAULT_MAX_GAP_MS = 1000;
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const finite = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
  const id = value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9:_./-]{0,179}$/.test(value) && !['constructor', 'prototype', '__proto__'].includes(value);
  const identifier = value => id(value) ? value : null;
  const sha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
  const list = value => Array.isArray(value) ? value : [];
  const unique = values => [...new Set(values)].sort();
  const physical = value => value.provenance === 'physical' && value.physicalConfirmation === 'REAL_CARDS_OPERATOR_CONFIRMED' && value.captureMethod === 'runtime-manual';
  const timestamp = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) && Number.isFinite(Date.parse(value)) ? value : null;

  function stableStringify(value, space = 2) {
    function ordered(input, ancestors) {
      if (input === null || typeof input !== 'object') {
        if (typeof input === 'number' && !Number.isFinite(input)) throw new Error('Non-finite report value');
        if (['undefined', 'function', 'symbol', 'bigint'].includes(typeof input)) throw new Error('JSON value required');
        return input;
      }
      if (ancestors.has(input)) throw new Error('Cyclic report rejected');
      ancestors.add(input);
      const output = Array.isArray(input) ? input.map(item => ordered(item, ancestors)) : Object.keys(input).sort().reduce((result, key) => {
        Object.defineProperty(result, key, { value: ordered(input[key], ancestors), enumerable: true });
        return result;
      }, {});
      ancestors.delete(input);
      return output;
    }
    return JSON.stringify(ordered(value, new Set()), null, space) + '\n';
  }

  function stats(values) {
    const sorted = list(values).filter(finite).sort((a, b) => a - b);
    const n = sorted.length;
    return { count: n, min: n ? sorted[0] : null, median: n ? n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : null, max: n ? sorted[n - 1] : null, p95: n >= 20 ? sorted[Math.ceil(n * .95) - 1] : null, p95MinimumSamples: 20, p95Method: 'nearest-rank' };
  }

  function validateContext(context) {
    const errors = [];
    if (!object(context)) return { valid: false, errors: ['CONTEXT_REQUIRED'] };
    if (!sha(context.productSha)) errors.push('PRODUCT_SHA_REQUIRED');
    if (context.databaseSha !== DATABASE_SHA) errors.push('DATABASE_SHA_MISMATCH');
    if (!['cyberpunk', 'cyberpunk-tcg'].includes(context.gameId)) errors.push('GAME_MISMATCH');
    if (context.locale !== 'en' || (context.playerLocale !== undefined && context.playerLocale !== 'en')) errors.push('LOCALE_MISMATCH');
    if (context.referenceCount !== 229) errors.push('REFERENCE_COUNT_MISMATCH');
    if (!Array.isArray(context.references) || context.references.length !== 229) errors.push('REFERENCE_LIST_MISMATCH');
    const seen = new Set();
    for (const reference of list(context.references)) {
      if (!object(reference) || !id(reference.refId) || !id(reference.cardId) || seen.has(reference.refId)) { errors.push('REFERENCE_IDENTITY_INVALID'); continue; }
      seen.add(reference.refId);
      if (reference.locale !== 'en') errors.push('CROSS_LOCALE_REFERENCE');
      if (reference.printingId != null && !id(reference.printingId)) errors.push('PRINTING_ID_INVALID');
      if (reference.referencePrintingId != null && !id(reference.referencePrintingId)) errors.push('PRINTING_ID_INVALID');
      if (reference.candidatePrintingIds !== undefined && (!Array.isArray(reference.candidatePrintingIds) || reference.candidatePrintingIds.some(value => !id(value)))) errors.push('PRINTING_ID_INVALID');
    }
    if (new Set(list(context.references).map(reference => reference?.cardId)).size !== 150) errors.push('CARD_COUNT_MISMATCH');
    return { valid: errors.length === 0, errors: unique(errors) };
  }

  function contextData(context) {
    const checked = validateContext(context);
    const references = new Map();
    const cards = new Set();
    const printings = new Map();
    for (const reference of list(context?.references)) {
      if (!object(reference)) continue;
      references.set(reference.refId, reference);
      cards.add(reference.cardId);
      for (const printingId of [reference.printingId, reference.referencePrintingId, ...list(reference.candidatePrintingIds)].filter(Boolean)) {
        if (printings.has(printingId) && printings.get(printingId) !== reference.cardId) checked.errors.push('PRINTING_CARD_CONFLICT');
        printings.set(printingId, reference.cardId);
      }
    }
    checked.errors = unique(checked.errors);
    checked.valid = checked.errors.length === 0;
    return { ...checked, references, cards, printings };
  }

  function sanitizeObservation(input, context) {
    const data = context?.references instanceof Map ? context : contextData(context);
    const source = object(input) ? input : {};
    const errors = [];
    if (!finite(source.atMs)) errors.push('OBSERVATION_TIME_INVALID');
    if (source.locale !== 'en') errors.push('CROSS_LOCALE_REFERENCE');
    const output = { atMs: finite(source.atMs) ? source.atMs : null, detected: source.detected === true, identifiedCardId: identifier(source.identifiedCardId), identifiedPrintingId: identifier(source.identifiedPrintingId), locale: source.locale === 'en' ? 'en' : null, referenceIds: [], candidateIds: [], candidatePrintingIds: [] };
    if (source.identifiedCardId != null && (!output.identifiedCardId || !data.cards.has(output.identifiedCardId))) errors.push('UNKNOWN_CARD');
    if (source.identifiedPrintingId != null && (!output.identifiedPrintingId || data.printings.get(output.identifiedPrintingId) !== output.identifiedCardId)) errors.push('UNKNOWN_PRINTING');
    for (const key of ['referenceIds', 'candidateIds']) {
      if (source[key] !== undefined && !Array.isArray(source[key])) errors.push('REFERENCE_LIST_INVALID');
      for (const refId of list(source[key])) {
        const reference = data.references.get(refId);
        if (!id(refId) || !reference) errors.push('UNKNOWN_REFERENCE');
        else if (reference.locale !== 'en') errors.push('CROSS_LOCALE_REFERENCE');
        else output[key].push(refId);
      }
      output[key] = unique(output[key]);
    }
    for (const printingId of list(source.candidatePrintingIds)) {
      if (!id(printingId) || !data.printings.has(printingId)) errors.push('UNKNOWN_PRINTING');
      else output.candidatePrintingIds.push(printingId);
    }
    output.candidatePrintingIds = unique(output.candidatePrintingIds);
    if (Array.isArray(source.identifiedCandidates)) {
      output.identifiedCandidates = [];
      for (const candidate of source.identifiedCandidates) {
        const reference = data.references.get(candidate?.refId);
        if (!reference || reference.locale !== 'en' || reference.cardId !== candidate?.cardId || (candidate?.printingId != null && data.printings.get(candidate.printingId) !== candidate.cardId)) errors.push('IDENTIFIED_CANDIDATE_INVALID');
        else output.identifiedCandidates.push({ cardId: candidate.cardId, printingId: identifier(candidate.printingId), refId: candidate.refId });
      }
    }
    if (output.identifiedCardId && output.referenceIds.length && output.referenceIds.some(refId => data.references.get(refId).cardId !== output.identifiedCardId)) errors.push('REFERENCE_CARD_MISMATCH');
    if (output.identifiedCardId && !output.referenceIds.length) errors.push('IDENTIFICATION_PROVENANCE_MISSING');
    for (const key of ['score', 'confidence']) if (finite(source[key])) output[key] = source[key];
    if (['matcherScore', 'visualIndex'].includes(source.scoreKind)) output.scoreKind = source.scoreKind;
    if (['exact', 'canonical', 'shared', 'shared_art', 'shared-art'].includes(source.recognitionMode)) output.recognitionMode = source.recognitionMode;
    if (object(source.qualificationTracking)) {
      const trace=source.qualificationTracking;
      output.qualificationTracking={mode:trace.mode==='PINNED_CANONICAL_TRACK'?trace.mode:null,
        status:['WAITING_FOR_SINGLE_TRACK','TRACKING','TRACK_LOST','MULTIPLE_TRACKS','MATCHER_ERROR','TRACKING_ERROR','STOPPED'].includes(trace.status)?trace.status:null,
        lockedTrackUid:Number.isSafeInteger(trace.lockedTrackUid)&&trace.lockedTrackUid>0?trace.lockedTrackUid:null,
        trackPresent:trace.trackPresent===true,accepted:trace.accepted===true,
        observedTrackCount:Number.isSafeInteger(trace.observedTrackCount)&&trace.observedTrackCount>=0?trace.observedTrackCount:null,
        decisionAtMs:finite(trace.decisionAtMs)?trace.decisionAtMs:null,
        errors:list(trace.errors).filter(value=>['MATCHER_ERROR','TRACKING_ERROR'].includes(value))};
    }
    output.multipleIdentities = list(source.validityErrors).includes('MULTIPLE_IDENTITIES') || list(output.identifiedCandidates).length > 1;
    for (const code of list(source.validityErrors)) if (code !== 'MULTIPLE_IDENTITIES') errors.push(ERROR_CODES.includes(code) ? code : 'RUNTIME_INVALID');
    output.validityErrors = unique(errors);
    return output;
  }

  function classifyTrial(input, context) {
    const source = object(input) ? input : {};
    const data = contextData(context);
    const errors = [...data.errors];
    if (!id(source.trialId)) errors.push('TRIAL_ID_INVALID');
    if (!timestamp(source.timestamp)) errors.push('TIMESTAMP_INVALID');
    if (!CONDITIONS.includes(source.condition)) errors.push('CONDITION_INVALID');
    if (!['physical', 'automated'].includes(source.provenance)) errors.push('PROVENANCE_REQUIRED');
    if (source.provenance === 'physical' && !physical(source)) errors.push('PHYSICAL_CONFIRMATION_REQUIRED');
    if (!data.cards.has(source.expectedCardId)) errors.push('EXPECTED_CARD_INVALID');
    if (source.expectedPrintingId != null && data.printings.get(source.expectedPrintingId) !== source.expectedCardId) errors.push('EXPECTED_PRINTING_INVALID');
    if (!finite(source.t0Ms) || !finite(source.endMs) || source.endMs <= source.t0Ms) errors.push('TRIAL_INTERVAL_INVALID');
    const stableWindowMs = source.stableWindowMs === undefined ? DEFAULT_STABLE_WINDOW_MS : source.stableWindowMs;
    const maxObservationGapMs = source.maxObservationGapMs === undefined ? DEFAULT_MAX_GAP_MS : source.maxObservationGapMs;
    if (!finite(stableWindowMs) || stableWindowMs <= 0 || !finite(maxObservationGapMs) || maxObservationGapMs <= 0) errors.push('MEASUREMENT_WINDOW_INVALID');
    if (physical(source) && (stableWindowMs !== DEFAULT_STABLE_WINDOW_MS || maxObservationGapMs !== DEFAULT_MAX_GAP_MS)) errors.push('PHYSICAL_MEASUREMENT_WINDOW_MISMATCH');
    if (!Array.isArray(source.observations) || !source.observations.length) errors.push('OBSERVATIONS_REQUIRED');
    const observations = list(source.observations).map(observation => sanitizeObservation(observation, data));
    const pinnedMeasurement=source.identityMeasurement==='PINNED_CANONICAL_TRACK';
    let lockedUid=null;
    let previous = -Infinity;
    for (const observation of observations) {
      errors.push(...observation.validityErrors);
      if(pinnedMeasurement) {
        const trace=observation.qualificationTracking;
        if(!trace || trace.mode!=='PINNED_CANONICAL_TRACK' || !trace.status || trace.observedTrackCount===null) errors.push('MISSING_RUNTIME_STATE');
        else {
          if(trace.lockedTrackUid!==null) {
            if(lockedUid!==null && lockedUid!==trace.lockedTrackUid) errors.push('CONTEXT_CHANGED');
            lockedUid=trace.lockedTrackUid;
          }
          if(trace.accepted!==Boolean(observation.identifiedCardId) ||
            (observation.identifiedCardId && (!trace.trackPresent || trace.status!=='TRACKING' || trace.lockedTrackUid===null ||
              trace.decisionAtMs===null || trace.decisionAtMs<source.t0Ms || trace.decisionAtMs>observation.atMs))) errors.push('MISSING_RUNTIME_STATE');
          if(trace.status==='MULTIPLE_TRACKS' || trace.observedTrackCount>1) errors.push('MISSING_RUNTIME_STATE');
          if(trace.errors.length) errors.push('CRASH');
        }
        if(previous!==-Infinity && observation.atMs-previous>maxObservationGapMs) errors.push('INCOMPLETE_CONTINUOUS_OBSERVATION');
      }
      if (observation.atMs < source.t0Ms || observation.atMs > source.endMs || observation.atMs <= previous) errors.push('OBSERVATION_INTERVAL_INVALID');
      previous = observation.atMs;
    }
    for (const code of list(source.validityErrors)) errors.push(ERROR_CODES.includes(code) ? code : 'RUNTIME_INVALID');
    const removalAt = object(source.removal) ? source.removal.t0Ms : null;
    if (source.removal && (!finite(removalAt) || removalAt <= source.t0Ms || removalAt > source.endMs)) errors.push('REMOVAL_TIME_INVALID');
    const visible = observations.filter(observation => removalAt === null || observation.atMs < removalAt);
    const detected = visible.some(observation => observation.detected);
    const identified = visible.some(observation => observation.identifiedCardId);
    const pinnedCanonical=source.identityMeasurement==='PINNED_CANONICAL_TRACK';
    const identities = [];
    let previousIdentity = null, lastKnownIdentity = null, disappearances = 0, lastAt = null, runStart = null, stableSince = null, stableAt = null;
    let wrongCardEvents = 0, wrongPrintingEvents = 0, firstNativeDecisionAt = null, staleNativeAfterStable = false;
    let firstDetectionAt = null;
    const expectedPrintingId = identifier(source.expectedPrintingId);
    for (const observation of visible) {
      if (observation.detected && firstDetectionAt === null) firstDetectionAt = observation.atMs;
      const identity = observation.identifiedCardId ? pinnedCanonical ? observation.identifiedCardId : `${observation.identifiedCardId}|${observation.identifiedPrintingId || '?'}` : null;
      if (identity && lastKnownIdentity && identity !== lastKnownIdentity) identities.push([lastKnownIdentity, identity]);
      if (identity) lastKnownIdentity = identity;
      if (!identity && previousIdentity) disappearances += 1;
      if (identity) previousIdentity = identity;
      else previousIdentity = null;
      // Only accepted visible identities count here. candidateIds is the
      // ranked search shortlist and never establishes an identification.
      const accepted = new Map(list(observation.identifiedCandidates).map(candidate => [`${candidate.cardId}|${candidate.printingId || '?'}`, candidate]));
      if (observation.identifiedCardId) accepted.set(`${observation.identifiedCardId}|${observation.identifiedPrintingId || '?'}`, { cardId: observation.identifiedCardId, printingId: observation.identifiedPrintingId });
      const wrongCards = [...accepted.values()].filter(candidate => candidate.cardId !== source.expectedCardId).length;
      const wrongPrintings = expectedPrintingId ? [...accepted.values()].filter(candidate => candidate.cardId === source.expectedCardId && candidate.printingId && candidate.printingId !== expectedPrintingId).length : 0;
      wrongCardEvents += wrongCards;
      wrongPrintingEvents += wrongPrintings;
      const freshNative=!pinnedCanonical || (finite(observation.qualificationTracking?.decisionAtMs) &&
        observation.atMs-observation.qualificationTracking.decisionAtMs<=maxObservationGapMs);
      if(pinnedCanonical && stableAt!==null && observation.identifiedCardId && !freshNative) staleNativeAfterStable=true;
      const correct = observation.detected && observation.identifiedCardId === source.expectedCardId && !wrongCards && !wrongPrintings && freshNative;
      if (correct) {
        if (runStart === null || lastAt === null || observation.atMs - lastAt > maxObservationGapMs) {
          runStart = observation.atMs; firstNativeDecisionAt=observation.qualificationTracking?.decisionAtMs??null;
        }
        if (stableAt === null && observation.atMs - runStart >= stableWindowMs && (!pinnedCanonical || observation.qualificationTracking.decisionAtMs-firstNativeDecisionAt>=stableWindowMs)) { stableSince = runStart; stableAt = observation.atMs; }
      } else { runStart = null; firstNativeDecisionAt = null; }
      lastAt = observation.atMs;
    }
    const transitions = identities.length;
    // New controlled trials measure native track/identity continuity. A UI
    // presentation withdrawal does not enter this history; real losses do.
    const postStableTrackLoss=pinnedCanonical && stableAt!==null && visible.some(observation=>
      observation.atMs>=stableAt && observation.qualificationTracking?.status==='TRACK_LOST');
    let nativeLossStart=null,prolongedNativeLoss=false;
    if(pinnedCanonical && stableAt!==null) for(const observation of visible) {
      if(observation.atMs<stableAt) continue;
      if(!observation.identifiedCardId) {
        if(nativeLossStart===null) nativeLossStart=observation.atMs;
        if(observation.atMs-nativeLossStart>DEFAULT_STABLE_WINDOW_MS) prolongedNativeLoss=true;
      } else nativeLossStart=null;
    }
    const unstable = transitions >= 2 || disappearances >= 2 || postStableTrackLoss || prolongedNativeLoss || staleNativeAfterStable;
    const invalidReasons = unique(errors);
    // NOMINAL certifies acquisition once the correct stable window completes.
    // Later losses stay in the counters; invalid evidence and any wrong result
    // still prevent success. Dedicated conditions retain their continuity rules.
    const nominalConfirmed = source.condition === 'NOMINAL' && stableAt !== null && !wrongCardEvents && !wrongPrintingEvents;
    const category = invalidReasons.length ? 'INVALID_TEST' : nominalConfirmed ? 'CORRECT' : unstable ? 'UNSTABLE' : wrongCardEvents || wrongPrintingEvents ? 'WRONG_IDENTIFICATION' : stableAt !== null ? 'CORRECT' : !detected ? 'NO_DETECTION' : 'NOT_IDENTIFIED';
    const correctObservations = visible.filter(observation => observation.identifiedCardId === source.expectedCardId);
    const exactPrinting = expectedPrintingId && correctObservations.some(observation => observation.identifiedPrintingId === expectedPrintingId);
    const sharedArt = correctObservations.some(observation => observation.referenceIds.some(refId => { const reference = data.references.get(refId); return reference && (['shared', 'shared_art', 'shared-art'].includes(reference.recognitionMode) || list(reference.candidatePrintingIds).length > 1); }));
    const printingAssessment = !expectedPrintingId ? 'NOT_REQUESTED' : wrongPrintingEvents ? 'WRONG_PRINTING' : exactPrinting ? 'EXACT_PRINTING_OBSERVED' : correctObservations.length ? sharedArt ? 'UNRESOLVED_SHARED_ART' : 'UNRESOLVED_PRINTING' : 'NOT_IDENTIFIED';
    const cleared = removalAt === null ? null : observations.find(observation => observation.atMs >= removalAt && !observation.identifiedCardId);
    return {
      trialId: identifier(source.trialId), previousTrialId: identifier(source.previousTrialId), timestamp: timestamp(source.timestamp), provenance: source.provenance === 'automated' ? 'automated' : physical(source) ? 'physical' : 'unconfirmed', evidence: physical(source) ? 'OPERATOR_DECLARED_REAL_CARDS' : 'AUTOMATED_HARNESS_VALIDATION', condition: CONDITIONS.includes(source.condition) ? source.condition : null,
      gameId: 'cyberpunk', locale: 'en', referenceCount: 229, expectedCardId: data.cards.has(source.expectedCardId) ? source.expectedCardId : null, expectedPrintingId,
      t0Ms: finite(source.t0Ms) ? source.t0Ms : null, endMs: finite(source.endMs) ? source.endMs : null,
      stableWindowMs: finite(stableWindowMs) ? stableWindowMs : null, maxObservationGapMs: finite(maxObservationGapMs) ? maxObservationGapMs : null,
      detected, identified, identifiedCardId: visible.filter(observation => observation.identifiedCardId).at(-1)?.identifiedCardId || null,
      identifiedPrintingId: visible.filter(observation => observation.identifiedCardId).at(-1)?.identifiedPrintingId || null,
      ...(pinnedCanonical?{identityMeasurement:'PINNED_CANONICAL_TRACK',canonicalIdentityAssessment:stableAt!==null&&!wrongCardEvents?'CORRECT CANONICAL IDENTITY':'NOT_CONFIRMED'}:{}),
      correct: category === 'CORRECT', category, printingAssessment, wrongCardEvents, wrongPrintingEvents, identityChanges: transitions, disappearances,
      detectionLatency: invalidReasons.length || firstDetectionAt === null ? null : firstDetectionAt - source.t0Ms,
      identificationLatency: invalidReasons.length || stableAt === null ? null : stableAt - source.t0Ms,
      stableCorrectSinceMs: invalidReasons.length ? null : stableSince, stableConfirmedAtMs: invalidReasons.length ? null : stableAt,
      removal: removalAt === null ? null : { t0Ms: finite(removalAt) ? removalAt : null, clearAtMs: cleared?.atMs ?? null, latencyMs: !invalidReasons.length && cleared ? cleared.atMs - removalAt : null, assessment: stableAt === null ? 'NOT_PRERECOGNIZED' : cleared ? 'CLEARED' : 'NOT_CLEARED' },
      notes: unique(list(source.notes).filter(value => NOTE_CODES.includes(value))), invalidReasons, observations
    };
  }

  function rates(trials) {
    const categories = Object.fromEntries(CATEGORIES.map(category => [category, trials.filter(trial => trial.category === category).length]));
    const valid = trials.filter(trial => trial.category !== 'INVALID_TEST');
    const percent = n => valid.length ? n / valid.length * 100 : null;
    return { total: trials.length, valid: valid.length, invalid: categories.INVALID_TEST, categories, detected: valid.filter(trial => trial.detected).length, correct: categories.CORRECT, wrongIdentification: valid.filter(trial => trial.wrongCardEvents || trial.wrongPrintingEvents).length,
      detectionRate: percent(valid.filter(trial => trial.detected).length), correctIdentificationRate: percent(categories.CORRECT), wrongIdentificationRate: percent(valid.filter(trial => trial.wrongCardEvents || trial.wrongPrintingEvents).length),
      wrongCardTrials: valid.filter(trial => trial.wrongCardEvents).length, wrongPrintingTrials: valid.filter(trial => trial.wrongPrintingEvents).length,
      printingAssessments: { expectedPrintingTrials: valid.filter(trial => trial.expectedPrintingId).length, exactPrintingObserved: valid.filter(trial => trial.printingAssessment === 'EXACT_PRINTING_OBSERVED').length, unresolvedSharedArt: valid.filter(trial => trial.printingAssessment === 'UNRESOLVED_SHARED_ART').length, unresolvedPrinting: valid.filter(trial => trial.printingAssessment === 'UNRESOLVED_PRINTING').length, wrongPrinting: valid.filter(trial => trial.printingAssessment === 'WRONG_PRINTING').length },
      detectionLatency: stats(valid.map(trial => trial.detectionLatency)), identificationLatency: stats(valid.map(trial => trial.identificationLatency)), removalLatency: stats(valid.map(trial => trial.removal?.latencyMs)),
      identityChanges: valid.reduce((n, trial) => n + trial.identityChanges, 0), disappearances: valid.reduce((n, trial) => n + trial.disappearances, 0) };
  }

  function classifyScene(input, context) {
    const source = object(input) ? input : {};
    const data = contextData(context);
    const errors = [...data.errors];
    if (!id(source.sceneId)) errors.push('SCENE_ID_INVALID');
    if (!SCENES.includes(source.scene)) errors.push('SCENE_INVALID');
    if (!timestamp(source.timestamp)) errors.push('TIMESTAMP_INVALID');
    if (!['physical', 'automated'].includes(source.provenance)) errors.push('PROVENANCE_REQUIRED');
    if (source.provenance === 'physical' && !physical(source)) errors.push('PHYSICAL_CONFIRMATION_REQUIRED');
    if (!finite(source.t0Ms) || !finite(source.endMs) || source.endMs <= source.t0Ms) errors.push('SCENE_INTERVAL_INVALID');
    const observations = list(source.observations).map(observation => sanitizeObservation(observation, data));
    if (!observations.length) errors.push('OBSERVATIONS_REQUIRED');
    let previous = -Infinity;
    for (const observation of observations) {
      errors.push(...observation.validityErrors);
      if (observation.atMs < source.t0Ms || observation.atMs > source.endMs || observation.atMs <= previous) errors.push('OBSERVATION_INTERVAL_INVALID');
      previous = observation.atMs;
    }
    for (const code of list(source.validityErrors)) errors.push(ERROR_CODES.includes(code) ? code : 'RUNTIME_INVALID');
    const invalidReasons = unique(errors);
    let lastIdentities = new Set();
    let falseIdentifications = 0;
    for (const observation of observations) {
      const identities = new Set(list(observation.identifiedCandidates).map(candidate => `${candidate.cardId}|${candidate.printingId || '?'}`));
      if (observation.identifiedCardId) identities.add(`${observation.identifiedCardId}|${observation.identifiedPrintingId || '?'}`);
      for (const identity of identities) if (!lastIdentities.has(identity)) falseIdentifications += 1;
      lastIdentities = identities;
    }
    return { sceneId: identifier(source.sceneId), timestamp: timestamp(source.timestamp), scene: SCENES.includes(source.scene) ? source.scene : null, provenance: physical(source) ? 'physical' : source.provenance === 'automated' ? 'automated' : 'unconfirmed', evidence: physical(source) ? 'OPERATOR_DECLARED_REAL_SCENE' : 'AUTOMATED_HARNESS_VALIDATION', t0Ms: finite(source.t0Ms) ? source.t0Ms : null, endMs: finite(source.endMs) ? source.endMs : null, durationMs: finite(source.t0Ms) && finite(source.endMs) ? source.endMs - source.t0Ms : null, valid: !invalidReasons.length, invalidReasons, shapeDetections: observations.filter(observation => observation.detected).length, falseIdentifications, identifiedObservationCount: observations.filter(observation => observation.identifiedCardId).length, observations };
  }

  function environmentMetadata(input) {
    const source = object(input) ? input : {};
    const output = {};
    for (const [key, values] of Object.entries({ illumination: ['NORMAL', 'LOW_PLAYABLE', 'SIDE_GLARE', 'UNSPECIFIED'], cameraFacing: ['USER', 'ENVIRONMENT', 'EXTERNAL', 'UNSPECIFIED'], background: ['TABLE', 'PLAYMAT', 'DESK', 'UNSPECIFIED'], sleeve: ['YES', 'NO', 'MIXED', 'UNSPECIFIED'], execution: ['RAILWAY_TEST', 'LOCAL_TEST', 'AUTOMATED'], browserFamily: ['CHROMIUM', 'FIREFOX', 'WEBKIT', 'OTHER'] })) if (values.includes(source[key])) output[key] = source[key];
    for (const key of ['frameWidth', 'frameHeight']) if (Number.isInteger(source[key]) && source[key] > 0 && source[key] <= 16384) output[key] = source[key];
    return output;
  }

  function buildReport(input = {}) {
    const context = object(input.context) ? input.context : {};
    const checked = contextData(context);
    const enforceProvenance = value => input.environment?.execution === 'AUTOMATED' && value?.provenance === 'physical' ? { ...value, provenance: 'automated', validityErrors: [...list(value.validityErrors), 'AUTOMATED_ENVIRONMENT_CANNOT_BE_PHYSICAL'] } : value;
    const trials = list(input.trials).map(trial => classifyTrial(enforceProvenance(trial), context));
    const scenes = list(input.scenes).map(scene => classifyScene(enforceProvenance(scene), context));
    const duplicateTrialIds = unique(trials.map(trial => trial.trialId).filter((value, index, array) => value && array.indexOf(value) !== index));
    const duplicateSceneIds = unique(scenes.map(scene => scene.sceneId).filter((value, index, array) => value && array.indexOf(value) !== index));
    for (const trial of trials) if (duplicateTrialIds.includes(trial.trialId)) { trial.category = 'INVALID_TEST'; trial.correct = false; trial.invalidReasons = unique([...trial.invalidReasons, 'DUPLICATE_TRIAL_ID']); trial.detectionLatency = null; trial.identificationLatency = null; }
    for (const scene of scenes) if (duplicateSceneIds.includes(scene.sceneId)) { scene.valid = false; scene.invalidReasons = unique([...scene.invalidReasons, 'DUPLICATE_SCENE_ID']); }
    const observedContinuously = value => value.observations.length > 0 && value.observations[0].atMs - value.t0Ms <= 250 && value.endMs - value.observations.at(-1).atMs <= 250 && value.observations.every((observation, index, array) => index === 0 || observation.atMs - array[index - 1].atMs <= 1000);
    for (const trial of trials.filter(value => value.provenance === 'physical')) {
      const protocolErrors = [];
      if (!observedContinuously(trial)) protocolErrors.push('INCOMPLETE_CONTINUOUS_OBSERVATION');
      if (trial.condition === 'REMOVAL' && (!trial.removal || trial.removal.assessment === 'NOT_PRERECOGNIZED')) protocolErrors.push('REMOVAL_NOT_PRERECOGNIZED');
      if (protocolErrors.length) { trial.category = 'INVALID_TEST'; trial.correct = false; trial.invalidReasons = unique([...trial.invalidReasons, ...protocolErrors]); trial.detectionLatency = null; trial.identificationLatency = null; }
    }
    const physicalTrials = trials.filter(trial => trial.provenance === 'physical');
    const physicalScenes = scenes.filter(scene => scene.provenance === 'physical');
    const conditions = Object.fromEntries(CONDITIONS.map(condition => [condition, { physical: rates(physicalTrials.filter(trial => trial.condition === condition)), automated: rates(trials.filter(trial => trial.provenance === 'automated' && trial.condition === condition)) }]));
    const rawIndexes = list(input.indexMeasurements).map(value => {
      const measurement = { measurementId: typeof value?.measurementId === 'string' && /^index-[a-f0-9]{64}$/.test(value.measurementId) ? value.measurementId : null, kind: value?.kind === 'RELOAD' ? 'WARM_RELOAD' : ['COLD', 'WARM_RELOAD'].includes(value?.kind) ? value.kind : null, durationMs: finite(value?.durationMs) ? value.durationMs : null, referenceCount: value?.referenceCount === 229 ? 229 : null };
      for (const key of ['descriptorBuildMs', 'totalReadyMs', 'databaseLoadMs', 'workerInitPostMs', 'networkRequests', 'networkBytes', 'sourceCount', 'librarySize', 'referenceCountBeforeLocale', 'referenceCountAfterLocale']) if (finite(value?.[key])) measurement[key] = value[key];
      if (['hit', 'miss', 'invalid', 'none', 'error', 'unknown'].includes(value?.cacheStatus)) measurement.cacheStatus = value.cacheStatus;
      if (['AUTOMATED_BROWSER', 'OPERATOR_RUNTIME'].includes(value?.provenance)) measurement.provenance = value.provenance;
      return measurement;
    });
    const byMeasurementId = new Map(), conflictingMeasurementIds = new Set();
    let duplicateMeasurementsIgnored = 0, invalidMeasurements = 0;
    for (const measurement of rawIndexes) {
      if (!measurement.measurementId || !measurement.kind || measurement.durationMs === null || measurement.referenceCount !== 229) { invalidMeasurements += 1; continue; }
      const previous = byMeasurementId.get(measurement.measurementId);
      if (previous) {
        if (stableStringify(previous) !== stableStringify(measurement)) conflictingMeasurementIds.add(measurement.measurementId);
        duplicateMeasurementsIgnored += 1;
      } else byMeasurementId.set(measurement.measurementId, measurement);
    }
    const indexes = [...byMeasurementId.values()].filter(value => !conflictingMeasurementIds.has(value.measurementId));
    invalidMeasurements += conflictingMeasurementIds.size;
    const plannedSample = list(input.plan?.sample);
    const sample = plannedSample.filter(value => object(value) && checked.cards.has(value.cardId) && (!value.printingId || checked.printings.get(value.printingId) === value.cardId)).map(value => ({ cardId: value.cardId, printingId: identifier(value.printingId) }));
    const substitutions = [];
    const substitutionErrors = [];
    const replaced = new Set();
    for (const value of list(input.plan?.substitutions)) {
      const original = plannedSample.find(item => item?.cardId === value?.originalCardId);
      const eligible = list(original?.substitution?.eligibleAlternatives).some(item => item?.cardId === value?.replacementCardId && item?.printingId === value?.replacementPrintingId);
      if (!original || !eligible || replaced.has(value.originalCardId) || checked.printings.get(value.replacementPrintingId) !== value.replacementCardId || value.reason !== 'PHYSICAL_CARD_UNAVAILABLE') { substitutionErrors.push('INVALID_PROFILE_SUBSTITUTION'); continue; }
      replaced.add(value.originalCardId);
      substitutions.push({ originalCardId: value.originalCardId, replacementCardId: value.replacementCardId, replacementPrintingId: value.replacementPrintingId, reason: value.reason });
    }
    const actualSample = sample.map(value => { const substitution = substitutions.find(item => item.originalCardId === value.cardId); return substitution ? { cardId: substitution.replacementCardId, printingId: substitution.replacementPrintingId } : value; });
    const sampleCards = unique(actualSample.map(value => value.cardId));
    const sleeveSkip = input.plan?.sleeveAvailability === 'UNAVAILABLE' && input.plan?.sleeveSkipReason === 'NO_GAME_SLEEVE_AVAILABLE';
    const requiredConditions = CONDITIONS.filter(condition => condition !== 'SLEEVE_GLARE' || !sleeveSkip);
    const missing = [];
    if (!checked.valid) missing.push('VALID_EN_229_CONTEXT');
    if (!Array.isArray(input.plan?.matrix) || !input.plan.matrix.length) missing.push('PREDECLARED_PROTOCOL_MATRIX_REQUIRED');
    if (!Array.isArray(input.plan?.similarPairs) || !input.plan.similarPairs.length) missing.push('PREDECLARED_SIMILAR_PAIRS_REQUIRED');
    if (!Array.isArray(input.plan?.variantCases) || !input.plan.variantCases.length) missing.push('PREDECLARED_VARIANT_CASES_REQUIRED');
    if (!Array.isArray(input.plan?.rapidSwitchPairs) || !input.plan.rapidSwitchPairs.length) missing.push('PREDECLARED_RAPID_SWITCH_PAIRS_REQUIRED');
    missing.push(...substitutionErrors);
    if (sample.length !== plannedSample.length || sampleCards.length !== actualSample.length) missing.push('INVALID_OR_DUPLICATE_PLANNED_SAMPLE');
    if (sampleCards.length < 12 || sampleCards.length > 15) missing.push('DIVERSE_SAMPLE_12_TO_15_CARDS');
    for (const cardId of sampleCards) if (physicalTrials.filter(trial => trial.condition === 'NOMINAL' && trial.expectedCardId === cardId && trial.category !== 'INVALID_TEST').length < 3) missing.push(`NOMINAL_THREE_TRIALS:${cardId}`);
    for (const condition of requiredConditions) if (!physicalTrials.some(trial => trial.condition === condition && trial.category !== 'INVALID_TEST')) missing.push(`CONDITION:${condition}`);
    const validPhysical = physicalTrials.filter(trial => trial.category !== 'INVALID_TEST');
    for (const code of ['ANGLE_SLIGHT', 'ANGLE_MODERATE']) if (!validPhysical.some(trial => trial.condition === 'ANGLE' && trial.notes.includes(code))) missing.push(`ANGLE_VARIATION:${code}`);
    for (const code of ['DISTANCE_NEAR', 'DISTANCE_FAR']) if (!validPhysical.some(trial => trial.condition === 'DISTANCE' && trial.notes.includes(code))) missing.push(`DISTANCE_VARIATION:${code}`);
    if (!validPhysical.some(trial => trial.condition === 'STABILITY' && trial.endMs - trial.t0Ms >= 3000)) missing.push('STABILITY_OBSERVATION_THREE_SECONDS');
    if (!validPhysical.some(trial => trial.condition === 'REMOVAL' && trial.removal?.assessment === 'CLEARED')) missing.push('REMOVAL_MARKER_AND_CLEARANCE_OBSERVATION');
    const sampleById = new Map(plannedSample.filter(value => id(value?.sampleId)).map(value => [value.sampleId, value]));
    const actualFor = value => { const replacement = substitutions.find(item => item.originalCardId === value?.cardId); return replacement ? { cardId: replacement.replacementCardId, printingId: replacement.replacementPrintingId } : value; };
    const protocolCoverage = { matrix: [], similarPairs: [], variantCases: [], rapidSwitchPairs: [] };
    const positionNotes = { SLIGHT: 'ANGLE_SLIGHT', MODERATE: 'ANGLE_MODERATE', SLIGHTLY_CLOSER: 'DISTANCE_NEAR', SLIGHTLY_FARTHER: 'DISTANCE_FAR', SLIGHTLY_ROTATED: 'ROTATED_SLIGHT' };
    for (const row of list(input.plan?.matrix)) {
      if (!CONDITIONS.includes(row?.condition) || (row.condition === 'SLEEVE_GLARE' && sleeveSkip)) continue;
      const repetitions = Number.isInteger(row.repetitions) && row.repetitions >= 1 && row.repetitions <= 10 ? row.repetitions : Number.isInteger(row.repetitionsPerPosition) && row.repetitionsPerPosition >= 1 && row.repetitionsPerPosition <= 10 ? row.repetitionsPerPosition : 1;
      for (const sampleId of list(row.sampleIds)) {
        const entry = actualFor(sampleById.get(sampleId));
        if (!entry) { missing.push('INVALID_PROTOCOL_SAMPLE_ID'); continue; }
        const positions = list(row.positions).length ? row.positions : [null];
        for (const position of positions) {
          const note = position === null ? null : positionNotes[position];
          if (position !== null && !note) { missing.push('INVALID_PROTOCOL_POSITION'); continue; }
          const durationMs = finite(row.durationMs) && row.durationMs <= 60000 ? row.durationMs : 0;
          const count = validPhysical.filter(trial => trial.condition === row.condition && trial.expectedCardId === entry.cardId && (!note || trial.notes.includes(note)) && trial.endMs - trial.t0Ms >= durationMs && (row.condition !== 'REMOVAL' || trial.removal?.assessment === 'CLEARED')).length;
          const coverage = { condition: row.condition, sampleId, cardId: entry.cardId, note, durationMs, required: repetitions, observed: count, complete: count >= repetitions };
          protocolCoverage.matrix.push(coverage);
          if (!coverage.complete) missing.push(`MATRIX:${row.condition}:${sampleId}:${note || 'DEFAULT'}`);
        }
      }
    }
    for (const pair of list(input.plan?.similarPairs)) {
      if (!id(pair?.pairId) || list(pair.cardIds).length !== 2 || list(pair.printingIds).length !== 2 || pair.printingIds.some((printingId, index) => checked.printings.get(printingId) !== pair.cardIds[index])) { missing.push('INVALID_SIMILAR_PAIR'); continue; }
      const observed = pair.printingIds.map((printingId, index) => validPhysical.filter(trial => trial.condition === 'SIMILAR_PRINTINGS' && trial.expectedCardId === pair.cardIds[index] && trial.expectedPrintingId === printingId).length);
      const coverage = { pairId: pair.pairId, cardIds: [...pair.cardIds], printingIds: [...pair.printingIds], requiredPerPrinting: 3, observed, complete: observed.every(count => count >= 3) };
      protocolCoverage.similarPairs.push(coverage);
      if (!coverage.complete) missing.push(`SIMILAR_PAIR:${pair.pairId}`);
    }
    for (const variant of list(input.plan?.variantCases)) {
      if (!id(variant?.caseId) || !checked.cards.has(variant.cardId)) { missing.push('INVALID_VARIANT_CASE'); continue; }
      const printings = [];
      for (const printingId of unique(list(variant.candidatePrintingIds))) {
        if (checked.printings.get(printingId) !== variant.cardId) { missing.push('INVALID_VARIANT_PRINTING'); continue; }
        const declared = list(input.plan?.variantAvailability).find(value => value?.caseId === variant.caseId && value?.printingId === printingId);
        const unavailable = declared?.availability === 'UNAVAILABLE' && declared?.reason === 'PHYSICAL_VARIANT_UNAVAILABLE';
        const matching = validPhysical.filter(trial => ['NOMINAL', 'SIMILAR_PRINTINGS'].includes(trial.condition) && trial.expectedCardId === variant.cardId && trial.expectedPrintingId === printingId);
        const exact = matching.filter(trial => trial.printingAssessment === 'EXACT_PRINTING_OBSERVED' && trial.correct).length;
        const result = { printingId, availability: unavailable ? 'UNAVAILABLE' : declared?.availability === 'AVAILABLE' ? 'AVAILABLE' : 'UNCONFIRMED', required: 3, observed: matching.length, exactPrintingObserved: exact, status: unavailable ? 'NOT TESTED' : matching.length < 3 ? 'PENDING' : matching.some(trial => trial.wrongPrintingEvents) ? 'WRONG_PRINTING' : exact === matching.length ? 'EXACT_PRINTINGS_OBSERVED' : 'UNRESOLVED_SHARED_ART' };
        printings.push(result);
        if (!unavailable && matching.length < 3) missing.push(`VARIANT_PRINTING:${variant.caseId}:${printingId}`);
      }
      protocolCoverage.variantCases.push({ caseId: variant.caseId, cardId: variant.cardId, printings });
    }
    for (const pair of list(input.plan?.rapidSwitchPairs)) {
      if (!Array.isArray(pair) || pair.length !== 2) { missing.push('INVALID_RAPID_SWITCH_PAIR'); continue; }
      const a = actualFor(sampleById.get(pair[0])), b = actualFor(sampleById.get(pair[1]));
      if (!a || !b || a.cardId === b.cardId) { missing.push('INVALID_RAPID_SWITCH_PAIR'); continue; }
      const pairs = [];
      for (const before of validPhysical.filter(trial => trial.condition === 'RAPID_SWITCH' && trial.expectedCardId === a.cardId && trial.stableConfirmedAtMs !== null && trial.removal)) {
        for (const after of validPhysical.filter(trial => trial.condition === 'RAPID_SWITCH' && trial.expectedCardId === b.cardId && trial.previousTrialId === before.trialId && trial.t0Ms >= before.endMs)) pairs.push({ beforeTrialId: before.trialId, afterTrialId: after.trialId, aClearanceLatency: before.removal.latencyMs, bIdentificationLatency: after.identificationLatency });
      }
      protocolCoverage.rapidSwitchPairs.push({ sampleIds: [...pair], cardIds: [a.cardId, b.cardId], observed: pairs, complete: pairs.length > 0 });
      if (!pairs.length) missing.push(`RAPID_SWITCH_PAIR:${pair[0]}:${pair[1]}`);
    }
    for (const scene of SCENES) if (!physicalScenes.some(value => value.scene === scene && value.valid && value.durationMs >= 30000 && value.observations[0].atMs - value.t0Ms <= 250 && value.endMs - value.observations.at(-1).atMs <= 250 && value.observations.every((observation, index, array) => index === 0 || observation.atMs - array[index - 1].atMs <= 1000))) missing.push(`SCENE_30_SECONDS:${scene}`);
    for (const kind of ['COLD', 'WARM_RELOAD']) if (indexes.filter(value => value.kind === kind).length < 3) missing.push(`INDEX_THREE_MEASURES:${kind}`);
    if (physicalTrials.some(trial => trial.category === 'INVALID_TEST') || physicalScenes.some(scene => !scene.valid)) missing.push('RESOLVE_INVALID_PHYSICAL_TESTS');
    const nominal = conditions.NOMINAL.physical;
    const falsePositiveCount = physicalScenes.filter(scene => scene.valid).reduce((n, scene) => n + scene.falseIdentifications, 0);
    const complete = missing.length === 0;
    const nominalComplete = !missing.some(code => code.startsWith('NOMINAL_THREE_TRIALS:') || code === 'DIVERSE_SAMPLE_12_TO_15_CARDS');
    const scenesComplete = !missing.some(code => code.startsWith('SCENE_30_SECONDS:'));
    const gates = { nominalCorrectIdentification: { targetPercent: 95, measuredPercent: nominal.correctIdentificationRate, status: nominal.valid ? nominal.correctIdentificationRate < 95 ? 'FAIL' : nominalComplete ? 'PASS' : 'INCOMPLETE' : 'NOT TESTED' }, nominalWrongIdentification: { maximumPercent: 1, measuredPercent: nominal.wrongIdentificationRate, status: nominal.valid ? nominal.wrongIdentificationRate > 1 ? 'FAIL' : nominalComplete ? 'PASS' : 'INCOMPLETE' : 'NOT TESTED' }, falsePositive: { maximum: 0, count: falsePositiveCount, status: physicalScenes.some(scene => scene.valid) ? falsePositiveCount > 0 ? 'FAIL' : scenesComplete ? 'PASS' : 'INCOMPLETE' : 'NOT TESTED' }, degradedIndicativeCorrectPercent: 85 };
    const defects = [];
    if (!checked.valid) defects.push({ code: 'INVALID_OR_CROSS_LOCALE_CONTEXT', severity: 'MAJOR', contextErrors: checked.errors });
    for (const trial of physicalTrials) {
      if (trial.wrongCardEvents || trial.wrongPrintingEvents) defects.push({ code: trial.wrongCardEvents ? 'WRONG_CARD' : 'WRONG_PRINTING', severity: trial.condition === 'NOMINAL' ? 'MAJOR' : 'INTERMEDIATE', trialId: trial.trialId });
      else if (trial.category === 'UNSTABLE') defects.push({ code: 'UNSTABLE_IDENTIFICATION', severity: 'INTERMEDIATE', trialId: trial.trialId });
      else if (['NO_DETECTION', 'NOT_IDENTIFIED'].includes(trial.category)) defects.push({ code: trial.category, severity: trial.condition === 'NOMINAL' ? 'INTERMEDIATE' : 'MINOR', trialId: trial.trialId });
      if (trial.removal?.assessment === 'NOT_CLEARED') defects.push({ code: 'IDENTITY_NOT_CLEARED_IN_OBSERVATION_WINDOW', severity: 'INTERMEDIATE', trialId: trial.trialId });
    }
    for (const scene of physicalScenes.filter(scene => scene.falseIdentifications)) defects.push({ code: 'FALSE_IDENTIFICATION_WITHOUT_TARGET', severity: 'MAJOR', sceneId: scene.sceneId, events: scene.falseIdentifications });
    const anyPhysical = physicalTrials.length > 0 || physicalScenes.length > 0;
    const verdict = !complete ? 'NOT YET QUALIFIED' : Object.values(gates).some(gate => object(gate) && gate.status === 'FAIL') ? 'FAIL' : 'PASS';
    return { schemaVersion: '1.0', productSha: sha(context.productSha) ? context.productSha : null, databaseSha: sha(context.databaseSha) ? context.databaseSha : null, gameId: 'cyberpunk', locale: 'en', referenceCount: context.referenceCount === 229 ? 229 : null,
      configuration: { valid: checked.valid, errors: checked.errors, canonicalGameId: 'cyberpunk-tcg', physicalEvidence: 'OPERATOR_DECLARED_REAL_CARDS_ONLY', stableWindowMs: DEFAULT_STABLE_WINDOW_MS, maxObservationGapMs: DEFAULT_MAX_GAP_MS, t0: 'Operator start command while presenting the physical card; monotonic milliseconds', t1: 'First observed detection at or after T0', t2: 'Observation confirming an uninterrupted correct-identity run lasting stableWindowMs; no inter-observation gap beyond maxObservationGapMs', wrongIdentificationRate: 'Valid card trials with any wrong card or definite wrong printing, including unstable trials; no-target scenes excluded', p95: 'Nearest-rank; emitted only with at least 20 valid latency values' },
      environment: environmentMetadata(input.environment), sample, actualSample, substitutions, trials, scenes,
      metrics: { physical: rates(physicalTrials), automated: rates(trials.filter(trial => trial.provenance === 'automated')), invalidUnconfirmed: trials.filter(trial => trial.provenance === 'unconfirmed').length }, conditions,
      falsePositiveScenes: { physicalCount: physicalScenes.length, valid: physicalScenes.filter(scene => scene.valid).length, totalDurationMs: physicalScenes.filter(scene => scene.valid).reduce((n, scene) => n + scene.durationMs, 0), falseIdentifications: falsePositiveCount, automatedCount: scenes.filter(scene => scene.provenance === 'automated').length },
      indexPerformance: { cold: stats(indexes.filter(value => value.kind === 'COLD').map(value => value.durationMs)), warmReload: stats(indexes.filter(value => value.kind === 'WARM_RELOAD').map(value => value.durationMs)), coldTotalReady: stats(indexes.filter(value => value.kind === 'COLD').map(value => value.totalReadyMs)), warmReloadTotalReady: stats(indexes.filter(value => value.kind === 'WARM_RELOAD').map(value => value.totalReadyMs)), measurements: indexes, duplicateMeasurementsIgnored, invalidMeasurements, historical: { coldMinMs: 8270, coldMaxMs: 8330, reloadMs: 6610, source: 'Jalon 4 historical reference; not a product gate' } },
      gates, plan: { complete, missing: unique(missing), nominalRepetitions: 3, sceneDurationMs: 30000, indexRepetitions: 3, requiredConditions, sleeveGlare: sleeveSkip ? 'NOT TESTED — NO_GAME_SLEEVE_AVAILABLE' : conditions.SLEEVE_GLARE.physical.total ? 'OPERATOR_DECLARED_TESTED' : 'PENDING', protocolCoverage }, defects,
      automatedHarnessValidation: input.automatedHarnessValidation === 'PASS' ? 'PASS' : 'NOT RUN', physicalQualification: anyPhysical ? complete ? verdict : 'INCOMPLETE' : 'NOT TESTED', verdict,
      privacy: { mediaRecorded: false, exportedFields: 'Explicit whitelist only; no video, image, audio, SDP, ICE, raw device IDs, arbitrary free text or runtime object export', notes: 'Controlled observation codes only' }
    };
  }

  return Object.freeze({ DATABASE_SHA, CONDITIONS, CATEGORIES, SCENES, NOTE_CODES, DEFAULT_STABLE_WINDOW_MS, DEFAULT_MAX_GAP_MS, validateContext, sanitizeObservation, sanitizeEnvironment: environmentMetadata, classifyTrial, classifyScene, buildReport, stats, stableStringify });
});
