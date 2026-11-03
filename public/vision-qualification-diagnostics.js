(function (root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TCGVisionQualificationDiagnostics = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  // Qualification-only observation. This module never changes a matcher result,
  // an identity, a threshold, tracking, scheduling, or any cache.
  const REASONS = Object.freeze(['uncertain', 'glare-high', 'glare-moderate', 'temporal-unstable']);
  const CAUSES = Object.freeze(['NO_MATCH_RESULT', 'SCORE_INSUFFICIENT', 'MARGIN_INSUFFICIENT',
    'EXPECTED_NOT_FIRST', 'EXPECTED_NOT_IN_RANKED_CANDIDATES', 'QUALITY_REJECTED',
    'STABILITY_INSUFFICIENT', 'TRACKING_MISSED_AT_COMPLETION', 'OTHER_OBSERVED_REJECTION']);
  const identifier = value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9:_.-]{0,159}$/.test(value) ? value : null;
  const number = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
  const nonnegative = value => number(value) !== null && value >= 0 ? value : null;
  const fraction = value => number(value) !== null && value >= 0 && value <= 1 ? value : null;
  const trackId = value => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
  const bool = value => value === true;
  const TEMPORAL_EVENT_TYPES = Object.freeze(['stable-established', 'stable-held', 'hold-expired',
    'switch-confirmed', 'switch-expired', 'switch-pending']);
  const nullableBoolean = value => typeof value === 'boolean' ? value : null;
  const integer = value => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
  let sequence = 0;

  function sanitizeRuntimeState(input) {
    const source = input && typeof input === 'object' ? input : {};
    return {
      pointerInsideStage: nullableBoolean(source.pointerInsideStage),
      hoveredTrackUid: integer(source.hoveredTrackUid),
      activeTrackUids: Array.isArray(source.activeTrackUids)
        ? [...new Set(source.activeTrackUids.filter(value => integer(value) !== null))].sort((a, b) => a - b).slice(0, 32)
        : null,
      activeTrackCount: integer(source.activeTrackCount),
      matcherBusy: nullableBoolean(source.matcherBusy), matcherQueued: nullableBoolean(source.matcherQueued),
      temporalEventType: TEMPORAL_EVENT_TYPES.includes(source.temporalEventType) ? source.temporalEventType : null,
      visibleSource: ['VISIBLE', 'FOREGROUND', 'TABLE_MEMORY'].includes(source.visibleSource) ? source.visibleSource : null
    };
  }

  function sanitizeAttempt(input, options = {}) {
    if (!input || typeof input !== 'object') return null;
    const atMs = nonnegative(input.atMs), requestStartedAtMs = nonnegative(input.requestStartedAtMs);
    if (atMs === null || requestStartedAtMs === null || requestStartedAtMs > atMs ||
        (number(options.t0Ms) !== null && requestStartedAtMs < options.t0Ms) ||
        (number(options.endMs) !== null && atMs > options.endMs)) return null;
    const references = Array.isArray(options.references) ? options.references : null;
    const byRef = references && new Map(references.map(value => [value.refId, value]));
    const expectedCardId = identifier(options.expectedCardId ?? input.expectedCardId);
    if (references && expectedCardId && !references.some(value => value.cardId === expectedCardId && value.locale === 'en')) return null;
    const candidates = [];
    const validationErrors = (Array.isArray(input.validationErrors) ? input.validationErrors : [])
      .filter(value => value === 'UNKNOWN_OR_INVALID_REFERENCE');
    for (const value of (Array.isArray(input.candidates) ? input.candidates : []).slice(0, 5)) {
      const cardId = identifier(value?.cardId), printingId = identifier(value?.printingId), refId = identifier(value?.refId);
      const score = number(value?.matcherScore);
      const reference = byRef?.get(refId);
      if (!cardId || !refId || score === null || (byRef && (!reference || reference.locale !== 'en' ||
          reference.cardId !== cardId || (printingId && ![reference.printingId, reference.referencePrintingId,
            ...(Array.isArray(reference.candidatePrintingIds) ? reference.candidatePrintingIds : [])].includes(printingId))))) {
        validationErrors.push('UNKNOWN_OR_INVALID_REFERENCE'); continue;
      }
      candidates.push({ rank: candidates.length + 1, cardId, printingId, refId, matcherScore: score });
    }
    const qualityInput = input.quality || {};
    const temporalInput = input.temporal || {};
    const visibleInput = input.visibleIdentityBeforeRender || {};
    const thresholdsInput = input.thresholds || {};
    const rejectionReason = REASONS.includes(input.rejectionReason) ? input.rejectionReason : input.rejectionReason ? 'other' : null;
    const mode = typeof input.mode === 'string' && /^(normal|masked)(-(uncertain|glare|rejected|guarded|rescued|strict|temporal|unstable))*$/.test(input.mode) ? input.mode : 'other';
    const thresholds = {
      normalScore: number(thresholdsInput.normalScore), normalMargin: number(thresholdsInput.normalMargin),
      lowScore: number(thresholdsInput.lowScore), lowMargin: number(thresholdsInput.lowMargin)
    };
    const bestScore = number(input.bestScore), secondScore = number(input.secondScore), margin = number(input.margin);
    const expected = expectedCardId && candidates.find(value => value.cardId === expectedCardId);
    const knownCard = value => {
      const result = identifier(value);
      if (result && references && !references.some(ref => ref.cardId === result && ref.locale === 'en')) {
        validationErrors.push('UNKNOWN_OR_INVALID_REFERENCE'); return null;
      }
      return result;
    };
    const temporal = {
      action: ['hold', 'render'].includes(temporalInput.action) ? temporalInput.action : 'unknown',
      stableCardId: knownCard(temporalInput.stableCardId), pendingCardId: knownCard(temporalInput.pendingCardId),
      pendingCount: nonnegative(temporalInput.pendingCount), required: nonnegative(temporalInput.required),
      uncertainAgeMs: nonnegative(temporalInput.uncertainAgeMs), lastConfirmedAgeMs: nonnegative(temporalInput.lastConfirmedAgeMs)
    };
    // Causes describe observed policy conditions, not an unproven physical root
    // cause. Expected-card scores are unavailable outside the existing top five;
    // no new comparisons are run to fill missing values.
    const causes = [];
    if (!candidates.length) causes.push('NO_MATCH_RESULT');
    if (expectedCardId && !expected) causes.push('EXPECTED_NOT_IN_RANKED_CANDIDATES');
    else if (expected && expected.rank > 1) causes.push('EXPECTED_NOT_FIRST');
    if (rejectionReason?.startsWith('glare-')) causes.push('QUALITY_REJECTED');
    if (temporal.action === 'hold' || rejectionReason === 'temporal-unstable') causes.push('STABILITY_INSUFFICIENT');
    if (number(input.trackMisses) > 0) causes.push('TRACKING_MISSED_AT_COMPLETION');
    if (input.matcherAccepted === false && mode.startsWith('normal') && bestScore !== null && margin !== null &&
        Object.values(thresholds).every(value => value !== null)) {
      const normalEligible = bestScore >= thresholds.normalScore;
      const lowEligible = bestScore >= thresholds.lowScore;
      if (!normalEligible && !lowEligible) causes.push('SCORE_INSUFFICIENT');
      else if (!((normalEligible && margin >= thresholds.normalMargin) || (lowEligible && margin >= thresholds.lowMargin))) causes.push('MARGIN_INSUFFICIENT');
    }
    if (input.matcherAccepted === false && !causes.length) causes.push('OTHER_OBSERVED_REJECTION');
    return {
      attemptId: nonnegative(input.attemptId), atMs, requestStartedAtMs, trackUid: trackId(input.trackUid),
      expectedCardId, candidates, bestScore, secondScore, margin,
      expectedRank: expected?.rank || null, expectedScore: expected?.matcherScore ?? null,
      expectedScoreStatus: !expectedCardId ? 'NO_EXPECTATION' : expected ? 'OBSERVED_IN_EXISTING_RANKED_CANDIDATES' : 'NOT_AVAILABLE_IN_EXISTING_RANKED_CANDIDATES',
      matcherAccepted: bool(input.matcherAccepted), finalAccepted: bool(input.finalAccepted),
      rejectionReason, rejectionCauses: [...new Set(causes)], mode, thresholds,
      quality: { risk: ['normal', 'moderate', 'high'].includes(qualityInput.risk) ? qualityInput.risk : null,
        brightFraction: fraction(qualityInput.brightFraction), clippedFraction: fraction(qualityInput.clippedFraction),
        maxBlockClip: fraction(qualityInput.maxBlockClip), detail: nonnegative(qualityInput.detail) },
      temporal, trackMisses: nonnegative(input.trackMisses), activeTrackCount: nonnegative(input.activeTrackCount),
      visibleIdentityBeforeRender: { present: visibleInput.present === true, cardId: knownCard(visibleInput.cardId),
        ageMs: nonnegative(visibleInput.ageMs) },
      validationErrors: [...new Set(validationErrors)]
    };
  }

  function observeAttempt(input) {
    // Optional tap: even diagnostics failures must leave Vision behavior intact.
    try {
      const result = input?.result, temporal = input?.temporal, entry = input?.temporalEntry;
      const atMs = root.performance.now();
      const visible = input?.visibleIdentityBeforeRender;
      const visibleReference = (Array.isArray(input?.references) ? input.references : []).find(ref =>
        ref.locale === 'en' && (visible?.refId ? visible.refId === ref.refId : visible?.image && visible.image === ref.image) &&
        (!visible.cardId || visible.cardId === ref.cardId));
      const output = sanitizeAttempt({
        attemptId: ++sequence, atMs, requestStartedAtMs: input.requestStartedAtMs,
        trackUid: input.track?.uid, trackMisses: input.track?.misses, activeTrackCount: input.activeTrackCount,
        candidates: (result?.ranked || []).slice(0, 5).map(item => ({ cardId: item.ref?.cardId,
          printingId: item.ref?.printingId, refId: item.ref?.refId, matcherScore: item.score })),
        bestScore: number(result?.best?.score), secondScore: number(result?.second?.score), margin: number(result?.margin),
        matcherAccepted: result?.accepted === true, finalAccepted: temporal?.action === 'render' && temporal.result?.accepted === true,
        rejectionReason: temporal?.result?.rejectionReason || result?.rejectionReason || null,
        mode: result?.mode, thresholds: input.thresholds, quality: result?.quality,
        visibleIdentityBeforeRender: { present: visible?.accepted === true, cardId: visibleReference?.cardId,
          ageMs: number(visible?.at) !== null ? atMs - visible.at : null },
        temporal: { action: temporal?.action, stableCardId: entry?.stableResult?.best?.ref?.cardId,
          pendingCardId: (result?.ranked || []).find(item => item.ref?.image === entry?.pendingKey)?.ref?.cardId,
          pendingCount: entry?.pendingCount, required: temporal?.required,
          uncertainAgeMs: entry?.uncertainSince ? atMs - entry.uncertainSince : 0,
          lastConfirmedAgeMs: entry?.lastConfirmedAt ? atMs - entry.lastConfirmedAt : null }
      }, { references: input?.references });
      if (output) root.dispatchEvent(new root.CustomEvent('tcg-identification-attempt', { detail: output }));
    } catch { /* Diagnostic-only failure cannot affect an identification. */ }
  }

  function sanitizeTrialDiagnostics(trial, context) {
    const source = Array.isArray(trial?.attemptDiagnostics) ? trial.attemptDiagnostics : [];
    const attempts = source.map(value => sanitizeAttempt(value, { expectedCardId: trial.expectedCardId,
      references: context?.references, t0Ms: trial.t0Ms, endMs: trial.endMs })).filter(Boolean);
    const states = (Array.isArray(trial?.observations) ? trial.observations : []).filter(value =>
      value?.runtimeState && typeof value.runtimeState === 'object' && nonnegative(value.atMs) !== null &&
      (number(trial.t0Ms) === null || value.atMs >= trial.t0Ms) &&
      (number(trial.endMs) === null || value.atMs <= trial.endMs))
      .map(value => ({ atMs: value.atMs, ...sanitizeRuntimeState(value.runtimeState) }));
    return { attempts, states, recorded: attempts.length, rejected: source.length - attempts.length,
      truncated: trial?.attemptDiagnosticsTruncated === true,
      dropped: nonnegative(trial?.attemptDiagnosticsDropped) || 0 };
  }
  return Object.freeze({ observeAttempt, sanitizeAttempt, sanitizeRuntimeState, sanitizeTrialDiagnostics, REASONS, CAUSES, TEMPORAL_EVENT_TYPES });
});
