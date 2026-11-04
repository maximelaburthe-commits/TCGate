(function initQualificationReport(root, factory) {
  'use strict';
  const harness = typeof module === 'object' && module.exports ? require('./vision-qualification-harness.js') : root.TCGateVisionQualification;
  const diagnostics = typeof module === 'object' && module.exports ? require('./vision-qualification-diagnostics.js') : root.TCGVisionQualificationDiagnostics;
  const receipt = typeof module === 'object' && module.exports ? require('./vision-qualification-receipt.js') : root.TCGVisionNominalQualificationReceipt;
  const api = factory(harness, diagnostics, receipt);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TCGVisionQualificationReport = api;
})(typeof window !== 'undefined' ? window : globalThis, function createQualificationReport(harness, diagnostics, receiptApi) {
  'use strict';
  // Shared canonical orchestration only. All classifications, metrics, gates,
  // corpus checks and sanitisation remain in the existing pure harness.
  if (!harness?.buildReport) throw Error('Load vision-qualification-harness.js first');
  const INVALIDATION_REASONS = Object.freeze(['OPERATOR_PROTOCOL_ERROR', 'WRONG_PHYSICAL_CARD_PRESENTED', 'ACCIDENTAL_START', 'OBSERVATION_INTERRUPTED']);
  const list = value => Array.isArray(value) ? value : [];
  const copy = value => JSON.parse(JSON.stringify(value));
  const sha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
  const id = value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9:_.-]{0,179}$/.test(value);
  const stableStringify = harness.stableStringify;
  const lexical = (a, b) => a < b ? -1 : a > b ? 1 : 0;
  const NOMINAL_BASELINE = Object.freeze({
    productSha: '062d6089fdfe5d778d65014642d909e8273fcc9a',
    label: 'PHYSICAL NOMINAL FAIL — ORIGINAL EXPORTS PRESERVED',
    trials: 45, valid: 43, invalid: 2, correct: 11, wrong: 7, detected: 43,
    correctIdentificationRate: 100 * 11 / 43, wrongIdentificationRate: 100 * 7 / 43, detectionRate: 100,
    categories: Object.freeze({ CORRECT: 11, NOT_IDENTIFIED: 18, UNSTABLE: 10, WRONG_IDENTIFICATION: 4, INVALID_TEST: 2, NO_DETECTION: 0 }),
    exports: Object.freeze([
      Object.freeze({ name: 'vision-qualification-session.json', sha256: '49f6c00a09ae40db4f6fa6d7b62827956b67af4f992b74161b9f69a98f0fa5f9' }),
      Object.freeze({ name: 'vision-qualification-reading-report.json', sha256: '593ee46ae23585e88a2d015aecee1088b040680832a873f927a28a3264c39541' }),
      Object.freeze({ name: 'vision-qualification-1.0.json', sha256: '593ee46ae23585e88a2d015aecee1088b040680832a873f927a28a3264c39541' })
    ])
  });
  const NOMINAL_6B_BASELINE={"productSha":"7082e92a66b50d0e0654ef44a6bdba89b0715e2b","label":"PHYSICAL 6B NOMINAL FAIL — ORIGINAL EXPORTS PRESERVED","trials":46,"valid":45,"invalid":1,"correct":0,"wrong":0,"detected":45,"correctIdentificationRate":0,"wrongIdentificationRate":0,"detectionRate":100,"categories":{"CORRECT":0,"NOT_IDENTIFIED":19,"UNSTABLE":26,"WRONG_IDENTIFICATION":0,"INVALID_TEST":1,"NO_DETECTION":0},"exports":[{"name":"vision-qualification-session.json","sha256":"da70fbce21f7ba1a99283ed6c51609883308780c011cdaf92502572cb9b1a6ac"},{"name":"vision-qualification-reading-report.json","sha256":"f9158f1daf5529c502d2b0bbff381fb26728ed8bcebb6e55f8b4bb47be9cfbb2"},{"name":"vision-qualification-1.0.json","sha256":"f9158f1daf5529c502d2b0bbff381fb26728ed8bcebb6e55f8b4bb47be9cfbb2"}]};
  // A separate nominal gate never promotes the full qualification verdict.
  // Counts and rates come from the existing harness, including every failure.
  function nominalGate(report) {
    const metrics = report?.conditions?.NOMINAL?.physical;
    const expected = list(report?.actualSample);
    const trials = list(report?.trials).filter(trial => trial.condition === 'NOMINAL' && trial.provenance === 'physical' &&
      trial.evidence === 'OPERATOR_DECLARED_REAL_CARDS' && trial.category !== 'INVALID_TEST');
    const coverage = expected.map(card => ({ cardId: card.cardId, printingId: card.printingId,
      valid: trials.filter(trial => trial.expectedCardId === card.cardId && trial.expectedPrintingId === card.printingId).length }));
    const sampleValid = coverage.length === 15 && new Set(coverage.map(card => card.cardId)).size === 15;
    const complete = sampleValid && coverage.every(card => card.valid === 3) && trials.length === 45 && metrics?.valid === 45;
    const correct = metrics?.correct || 0, wrong = metrics?.wrongIdentification || 0, valid = metrics?.valid || 0;
    const correctIdentificationRate = valid ? metrics.correctIdentificationRate : null;
    const wrongIdentificationRate = valid ? metrics.wrongIdentificationRate : null;
    const ready = complete && correctIdentificationRate >= 95 && wrongIdentificationRate <= 1;
    return { ready, status: ready ? 'VISION NOMINAL READY FOR FULL QUALIFICATION' : complete ? 'FAIL' : 'PENDING',
      requiredValid: 45, valid, correct, wrong, invalid: metrics?.invalid || 0, total: metrics?.total || 0,
      correctIdentificationRate, wrongIdentificationRate, minimumCorrectPercent: 95, maximumWrongPercent: 1,
      completedCards: coverage.filter(card => card.valid === 3).length, coverage,
      baseline: copy(NOMINAL_BASELINE), previousCampaign:copy(NOMINAL_6B_BASELINE), baselines:[copy(NOMINAL_BASELINE),copy(NOMINAL_6B_BASELINE)], currentProductSha: report?.productSha || null,
      fullQualificationVerdict: report?.verdict || 'NOT YET QUALIFIED' };
  }
  // The official nominal evidence remains a separate historical source. This
  // composition never inserts its 45 trials into the current session or counts
  // them as observations of the current product build.
  function qualifiedNominalReport(report, options) {
    if (options.qualifiedNominalReceipt === undefined && options.qualifiedBuildCompatibility === undefined) return report;
    if (!receiptApi?.validateReceipt) throw Error('Load the nominal qualification receipt validator before using qualified evidence');
    const compatibility = options.qualifiedBuildCompatibility;
    if (compatibility && compatibility.buildSha !== options.productSha) throw Error('Qualified nominal compatibility must describe this exact report build');
    const activeContext = receiptApi.contextCompatibility(canonicalContext(options.productSha, options.references), options.sampleDocument);
    const contextMatches = Object.keys(activeContext).every(key => compatibility?.[key] === activeContext[key]);
    const validated = contextMatches ? receiptApi.validateReceipt(options.qualifiedNominalReceipt, compatibility) :
      { ready: false, status: 'INCOMPATIBLE', reasons: ['REPORT_CONTEXT_MISMATCH'] };
    const sessionGate = nominalGate(report), evidence = validated.ready ? validated.evidence : null;
    const metrics = evidence?.nominalMetrics;
    report.sessionNominalGate = sessionGate;
    report.qualifiedNominalGate = {
      ready: Boolean(validated.ready), status: validated.status, reasons: [...list(validated.reasons)],
      source: 'QUALIFICATION_RECEIPT', valid: metrics?.valid || 0, correct: metrics?.correct || 0,
      wrong: metrics?.wrongIdentification || 0,
      correctIdentificationRate: metrics?.correctIdentificationRate ?? null,
      wrongIdentificationRate: metrics?.wrongIdentificationRate ?? null
    };
    if (!validated.ready) return report;
    const coverage = list(evidence.coverage);
    const pairs = values => values.map(value => ({ cardId: value.cardId, printingId: value.printingId || null }))
      .sort((a, b) => lexical(a.cardId + ':' + a.printingId, b.cardId + ':' + b.printingId));
    const compatibleSample = coverage.length === 15 && coverage.every(value => value.valid === 3) &&
      stableStringify(pairs(coverage)) === stableStringify(pairs(report.actualSample));
    if (!compatibleSample) {
      report.qualifiedNominalGate.ready = false;
      report.qualifiedNominalGate.status = 'INCOMPATIBLE';
      report.qualifiedNominalGate.reasons.push('QUALIFIED_NOMINAL_SAMPLE_MISMATCH');
      return report;
    }
    const historicalTrialIds = new Set(list(evidence.trials).map(trial => trial.trialId));
    if (report.trials.some(trial => historicalTrialIds.has(trial.trialId))) throw Error('A qualified nominal source trial cannot be counted again in the current session');
    report.nominalEvidence = { ...copy(evidence), source: 'QUALIFICATION_RECEIPT',
      appliedToProductSha: report.productSha, physicalTrialsReplayedOnCurrentBuild: false };
    report.conditions.NOMINAL.qualifiedPhysical = { ...copy(metrics), source: 'QUALIFICATION_RECEIPT',
      sourcePhysicalProductSha: evidence.sourcePhysicalProductSha };
    report.qualifiedNominalGate.sourcePhysicalProductSha = evidence.sourcePhysicalProductSha;
    report.qualifiedNominalGate.qualificationSemanticsSha = evidence.qualificationSemanticsSha;
    report.qualifiedNominalGate.coverage = copy(coverage);
    report.qualifiedNominalGate.completedCards = coverage.length;
    // Only the unchanged canonical nominal protocol is covered by the receipt.
    // Other conditions, printing cases, scenes, index measurements and defects
    // continue to be evaluated exclusively from their recorded observations.
    const nominalRows = report.plan.protocolCoverage.matrix.filter(row => row.condition === 'NOMINAL');
    const nominalProtocolCovered = nominalRows.length === 15 && nominalRows.every(row => row.required === 3 &&
      row.durationMs === 0 && row.note === null && coverage.some(card => card.cardId === row.cardId && card.valid === 3));
    report.plan.missing = report.plan.missing.filter(reason =>
      !reason.startsWith('NOMINAL_THREE_TRIALS:') && reason !== 'CONDITION:NOMINAL' &&
      !(nominalProtocolCovered && reason.startsWith('MATRIX:NOMINAL:')));
    if (nominalProtocolCovered) for (const row of nominalRows) {
      row.currentSessionObserved = row.observed;
      row.qualifiedObserved = 3;
      row.observed = Math.max(row.observed, 3);
      row.complete = row.observed >= row.required;
      row.source = 'QUALIFICATION_RECEIPT';
      row.sourcePhysicalProductSha = evidence.sourcePhysicalProductSha;
    }
    report.gates.nominalCorrectIdentification = { targetPercent: 95, measuredPercent: metrics.correctIdentificationRate,
      status: 'PASS', source: 'QUALIFICATION_RECEIPT', sourcePhysicalProductSha: evidence.sourcePhysicalProductSha };
    report.gates.nominalWrongIdentification = { maximumPercent: 1, measuredPercent: metrics.wrongIdentificationRate,
      status: 'PASS', source: 'QUALIFICATION_RECEIPT', sourcePhysicalProductSha: evidence.sourcePhysicalProductSha };
    const currentFailures = report.trials.filter(trial => trial.provenance === 'physical' && trial.condition === 'NOMINAL' &&
      trial.category !== 'INVALID_TEST' && trial.category !== 'CORRECT');
    if (currentFailures.length && !sessionGate.ready) {
      report.plan.missing.push('CURRENT_NOMINAL_FAILURE_REQUIRES_REVIEW');
      report.gates.currentNominalEvidence = { status: 'FAIL', source: 'CURRENT_SESSION',
        failedTrialIds: currentFailures.map(trial => trial.trialId),
        wrongIdentification: report.conditions.NOMINAL.physical.wrongIdentification };
    }
    report.plan.complete = report.plan.missing.length === 0;
    report.verdict = !report.plan.complete ? 'NOT YET QUALIFIED' : Object.values(report.gates)
      .some(gate => gate && typeof gate === 'object' && gate.status === 'FAIL') ? 'FAIL' : 'PASS';
    report.physicalQualification = report.plan.complete ? report.verdict : 'INCOMPLETE';
    report.nominalQualification = { ...copy(sessionGate), ready: true,
      status: 'VISION NOMINAL READY FOR FULL QUALIFICATION', source: 'QUALIFICATION_RECEIPT',
      total: metrics.total, valid: metrics.valid, invalid: metrics.invalid, correct: metrics.correct,
      wrong: metrics.wrongIdentification, correctIdentificationRate: metrics.correctIdentificationRate,
      wrongIdentificationRate: metrics.wrongIdentificationRate, completedCards: coverage.length, coverage: copy(coverage),
      sourcePhysicalProductSha: evidence.sourcePhysicalProductSha, qualificationSemanticsSha: evidence.qualificationSemanticsSha,
      fullQualificationVerdict: report.verdict };
    return report;
  }
  function normalizedReferences(input) {
    return list(input).map(ref => ({ refId: ref.refId, cardId: ref.cardId, printingId: ref.printingId || null,
      referencePrintingId: ref.referencePrintingId || null, candidatePrintingIds: [...list(ref.candidatePrintingIds)].sort(),
      recognitionMode: ref.recognitionMode || null, locale: ref.locale })).sort((a, b) => lexical(a.refId, b.refId));
  }
  function sameReferences(a, b) { return stableStringify(normalizedReferences(a)) === stableStringify(normalizedReferences(b)); }
  function canonicalContext(productSha, references) {
    const context = { productSha, databaseSha: harness.DATABASE_SHA, gameId: 'cyberpunk', locale: 'en', referenceCount: 229,
      references: normalizedReferences(references) };
    const validation = harness.validateContext(context);
    if (!validation.valid) throw Error('Invalid authentic corpus: ' + validation.errors.join(', '));
    return context;
  }
  function canonicalPlan(sampleDocument, context) {
    if (!sampleDocument || sampleDocument.schemaVersion !== '1.0' || sampleDocument.gameId !== 'cyberpunk' || sampleDocument.locale !== 'en' ||
        sampleDocument.databaseSha !== harness.DATABASE_SHA || sampleDocument.referenceCount !== 229 || sampleDocument.canonicalCardCount !== 150 ||
        sampleDocument.sampleCount !== 15 || sampleDocument.distinctCanonicalCards !== 15 || !Array.isArray(sampleDocument.sample) || sampleDocument.sample.length !== 15) throw Error('Invalid canonical build sample');
    const printings = new Map();
    for (const ref of context.references) for (const printingId of [ref.printingId, ref.referencePrintingId, ...ref.candidatePrintingIds].filter(Boolean)) {
      if (printings.has(printingId) && printings.get(printingId) !== ref.cardId) throw Error('Conflicting corpus printing identity');
      printings.set(printingId, ref.cardId);
    }
    const pair = item => {
      if (!item || !id(item.cardId) || printings.get(item.printingId) !== item.cardId) throw Error('Protocol identity is outside the exact EN corpus');
      return { cardId: item.cardId, printingId: item.printingId };
    };
    const sample = sampleDocument.sample.map(item => ({ sampleId: item.sampleId, ...pair(item), substitution: {
      eligibleAlternatives: list(item.substitution?.eligibleAlternatives).map(pair)
    } }));
    if (new Set(sample.map(item => item.sampleId)).size !== 15 || sample.some(item => !id(item.sampleId)) || new Set(sample.map(item => item.cardId)).size !== 15) throw Error('Duplicate canonical sample slot');
    const sampleIds = new Set(sample.map(item => item.sampleId));
    const input = sampleDocument.plan;
    if (!input || !Array.isArray(input.matrix) || !input.matrix.length || !Array.isArray(input.similarPairs) || !input.similarPairs.length ||
        !Array.isArray(input.variantCases) || !input.variantCases.length || !Array.isArray(input.rapidSwitchPairs) || !input.rapidSwitchPairs.length) throw Error('Canonical build protocol is incomplete');
    const matrix = input.matrix.map(row => {
      if (!harness.CONDITIONS.includes(row.condition)) throw Error('Unknown canonical matrix condition');
      const out = { condition: row.condition };
      if (row.sampleIds !== undefined) {
        if (!Array.isArray(row.sampleIds) || row.sampleIds.some(value => !sampleIds.has(value))) throw Error('Unknown canonical matrix sample');
        out.sampleIds = [...row.sampleIds];
      }
      if (row.positions !== undefined) {
        if (!Array.isArray(row.positions) || row.positions.some(value => !['SLIGHT', 'MODERATE', 'SLIGHTLY_CLOSER', 'SLIGHTLY_FARTHER', 'SLIGHTLY_ROTATED'].includes(value))) throw Error('Unknown canonical matrix position');
        out.positions = [...row.positions];
      }
      for (const key of ['repetitions', 'repetitionsPerPosition', 'durationMs']) if (row[key] !== undefined) {
        if (!Number.isInteger(row[key]) || row[key] < 1 || row[key] > (key === 'durationMs' ? 60000 : 10)) throw Error('Invalid canonical matrix duration/count');
        out[key] = row[key];
      }
      return out;
    });
    const nominal = matrix.find(row => row.condition === 'NOMINAL');
    if (!nominal || nominal.repetitions !== 3 || nominal.sampleIds?.length !== 15 || new Set(nominal.sampleIds).size !== 15) throw Error('Canonical nominal protocol must retain 45 trials');
    const similarPairs = input.similarPairs.map(value => {
      if (!id(value.pairId) || list(value.cardIds).length !== 2 || list(value.printingIds).length !== 2) throw Error('Invalid canonical similar pair');
      value.printingIds.forEach((printingId, i) => pair({ cardId: value.cardIds[i], printingId }));
      return { pairId: value.pairId, cardIds: [...value.cardIds], printingIds: [...value.printingIds] };
    });
    const variantCases = input.variantCases.map(value => {
      if (!id(value.caseId) || !list(value.candidatePrintingIds).length || new Set(value.candidatePrintingIds).size !== value.candidatePrintingIds.length) throw Error('Invalid canonical variant case');
      value.candidatePrintingIds.forEach(printingId => pair({ cardId: value.cardId, printingId }));
      return { caseId: value.caseId, cardId: value.cardId, candidatePrintingIds: [...value.candidatePrintingIds] };
    });
    const rapidSwitchPairs = input.rapidSwitchPairs.map(value => {
      if (!Array.isArray(value) || value.length !== 2 || value[0] === value[1] || value.some(sampleId => !sampleIds.has(sampleId))) throw Error('Invalid canonical rapid switch pair');
      return [...value];
    });
    return { sample, matrix, similarPairs, variantCases, rapidSwitchPairs };
  }
  function declarations(input, plan) {
    const source = input || {}, substitutions = [], variantAvailability = [], replaced = new Set();
    for (const key of ['substitutions', 'variantAvailability']) if (source[key] !== undefined && !Array.isArray(source[key])) throw Error('Malformed protocol declaration array');
    for (const value of list(source.substitutions)) {
      const original = plan.sample.find(item => item.cardId === value?.originalCardId);
      const eligible = original?.substitution.eligibleAlternatives.some(item => item.cardId === value.replacementCardId && item.printingId === value.replacementPrintingId);
      if (!original || !eligible || replaced.has(original.cardId) || value.reason !== 'PHYSICAL_CARD_UNAVAILABLE' ||
          (value.originalPrintingId !== undefined && value.originalPrintingId !== original.printingId)) throw Error('Invalid profile substitution');
      replaced.add(original.cardId);
      substitutions.push({ originalCardId: original.cardId, originalPrintingId: original.printingId, replacementCardId: value.replacementCardId,
        replacementPrintingId: value.replacementPrintingId, reason: 'PHYSICAL_CARD_UNAVAILABLE' });
    }
    const actual = plan.sample.map(item => substitutions.find(value => value.originalCardId === item.cardId)?.replacementCardId || item.cardId);
    if (new Set(actual).size !== actual.length) throw Error('Substitution reuses another selected canonical card');
    const seen = new Set();
    for (const value of list(source.variantAvailability)) {
      const variant = plan.variantCases.find(item => item.caseId === value?.caseId);
      const key = value?.caseId + ':' + value?.printingId;
      if (!variant?.candidatePrintingIds.includes(value.printingId) || !['AVAILABLE', 'UNAVAILABLE'].includes(value.availability) || seen.has(key) ||
          (value.availability === 'UNAVAILABLE' && value.reason !== 'PHYSICAL_VARIANT_UNAVAILABLE')) throw Error('Invalid variant availability declaration');
      seen.add(key);
      variantAvailability.push({ caseId: value.caseId, printingId: value.printingId, availability: value.availability,
        ...(value.availability === 'UNAVAILABLE' ? { reason: 'PHYSICAL_VARIANT_UNAVAILABLE' } : {}) });
    }
    if (source.sleeveAvailability !== undefined && source.sleeveAvailability !== null && !['AVAILABLE', 'UNAVAILABLE'].includes(source.sleeveAvailability)) throw Error('Invalid sleeve availability');
    if (source.sleeveAvailability === 'UNAVAILABLE' && source.sleeveSkipReason !== 'NO_GAME_SLEEVE_AVAILABLE') throw Error('A sleeve skip needs the controlled unavailability reason');
    substitutions.sort((a, b) => lexical(a.originalCardId, b.originalCardId));
    variantAvailability.sort((a, b) => lexical(a.caseId + a.printingId, b.caseId + b.printingId));
    return { substitutions, variantAvailability,
      ...(source.sleeveAvailability ? { sleeveAvailability: source.sleeveAvailability } : {}),
      ...(source.sleeveAvailability === 'UNAVAILABLE' ? { sleeveSkipReason: 'NO_GAME_SLEEVE_AVAILABLE' } : {}) };
  }
  function generate(options = {}) {
    if (!sha(options.productSha) || options.sampleProductSha !== options.productSha) throw Error('The canonical protocol must come from this exact product SHA');
    const context = canonicalContext(options.productSha, options.references);
    const plan = canonicalPlan(options.sampleDocument, context);
    for (const key of ['sessions', 'indexInputs']) if (options[key] !== undefined && !Array.isArray(options[key])) throw Error('Malformed qualification input array');
    const sessions = list(options.sessions), trials = [], scenes = [], indexMeasurements = [], annotations = [], environments = [];
    let declared = { substitutions: [], variantAvailability: [] }, declarationKey = null;
    for (const captured of sessions) {
      const incoming = captured?.context;
      const checked = harness.validateContext(incoming);
      if (!checked.valid || incoming.productSha !== context.productSha || incoming.databaseSha !== context.databaseSha || !sameReferences(incoming.references, context.references)) throw Error('Session does not match this exact product/corpus');
      if (!Array.isArray(captured.trials) || !Array.isArray(captured.scenes) || !Array.isArray(captured.indexMeasurements)) throw Error('Malformed qualification session');
      if (captured.environment?.execution === 'AUTOMATED' && [...captured.trials, ...captured.scenes].some(value => value?.provenance === 'physical')) throw Error('An automated session cannot supply physical evidence');
      const next = declarations(captured.plan, plan), key = stableStringify(next);
      if (declarationKey !== null && key !== declarationKey) throw Error('Sessions have conflicting predeclared availability/substitutions');
      declarationKey = key; declared = next;
      if (captured.plan?.sample !== undefined && stableStringify(list(captured.plan.sample).map(value => ({ cardId: value.cardId, printingId: value.printingId || null }))) !==
          stableStringify(plan.sample.map(value => ({ cardId: value.cardId, printingId: value.printingId })))) throw Error('Session changed the canonical sample');
      trials.push(...captured.trials); scenes.push(...captured.scenes); indexMeasurements.push(...captured.indexMeasurements);
      environments.push(harness.sanitizeEnvironment(captured.environment));
      if (captured.trialAnnotations !== undefined && !Array.isArray(captured.trialAnnotations)) throw Error('Malformed append-only annotation array');
      let annotationSequence = 0;
      for (const value of list(captured.trialAnnotations)) {
        if (!value || value.action !== 'INVALIDATE' || !INVALIDATION_REASONS.includes(value.reason) || !id(value.trialId) ||
            !Number.isInteger(value.sequence) || value.sequence !== ++annotationSequence ||
            !captured.trials.some(trial => trial.trialId === value.trialId) ||
            annotations.some(previous => previous.trialId === value.trialId)) throw Error('Invalid append-only trial annotation');
        annotations.push({ trialId: value.trialId, action: 'INVALIDATE', reason: value.reason, sequence: value.sequence });
      }
    }
    for (const input of list(options.indexInputs)) {
      const incoming = input.context || input;
      if (incoming.productSha !== context.productSha || incoming.databaseSha !== context.databaseSha || incoming.referenceCount !== 229 ||
          incoming.locale !== 'en' || !['cyberpunk', 'cyberpunk-tcg'].includes(incoming.gameId) || !Array.isArray(input.indexMeasurements) ||
          (incoming.references && !sameReferences(incoming.references, context.references))) throw Error('Index measurements do not match this exact product/corpus');
      indexMeasurements.push(...input.indexMeasurements);
    }
    if (declared.sleeveAvailability === 'UNAVAILABLE' && trials.some(value => value.condition === 'SLEEVE_GLARE')) throw Error('Unavailable sleeves conflict with recorded sleeve trials');
    if (declared.variantAvailability.some(value => value.availability === 'UNAVAILABLE' && trials.some(trial => trial.expectedPrintingId === value.printingId))) throw Error('Unavailable variant conflicts with a recorded trial');
    for (const substitution of declared.substitutions) if (trials.some(value => value.expectedCardId === substitution.originalCardId)) throw Error('A substitution cannot rewrite a previously tested card');
    const annotated = trials.map(trial => annotations.some(value => value.trialId === trial.trialId) ? { ...trial, validityErrors: [...list(trial.validityErrors), 'INTERRUPTED'] } : trial);
    const environment = environments.filter(value => value.execution !== 'AUTOMATED').at(-1) || environments.at(-1) || { execution: 'LOCAL_TEST' };
    const base = { context, plan: { ...plan, ...declared }, environment, trials, scenes, indexMeasurements,
      ...(options.automatedHarnessValidation === 'PASS' ? { automatedHarnessValidation: 'PASS' } : {}) };
    const report = harness.buildReport({ ...base, trials: annotated });
    if (annotations.length) {
      const original = harness.buildReport(base);
      report.operatorAnnotations = annotations;
      for (const trial of report.trials) {
        const annotation = annotations.find(value => value.trialId === trial.trialId);
        if (!annotation) continue;
        const observed = original.trials.find(value => value.trialId === trial.trialId);
        trial.operatorInvalidation = copy(annotation);
        trial.originalOutcome = { category: observed.category, correct: observed.correct, detectionLatency: observed.detectionLatency,
          identificationLatency: observed.identificationLatency, invalidReasons: [...observed.invalidReasons], wrongCardEvents: observed.wrongCardEvents,
          wrongPrintingEvents: observed.wrongPrintingEvents, printingAssessment: observed.printingAssessment };
      }
    }
    // Keep the originally requested printing in the canonical audit as well as
    // the session. The legacy harness intentionally omits ancillary plan fields.
    report.substitutions = copy(declared.substitutions);
    if (environments.length > 1) report.sessionEnvironments = environments;
    for (const trial of report.trials) {
      const raw = trials.find(value => value.trialId === trial.trialId);
      if (list(raw.attemptDiagnostics).length && !diagnostics?.sanitizeTrialDiagnostics) throw Error('Load the shared qualification diagnostics before reporting attempts');
      trial.identificationDiagnostics = diagnostics?.sanitizeTrialDiagnostics(raw, context) ||
        { attempts: [], states: [], recorded: 0, rejected: 0, truncated: false, dropped: 0 };
      const boundary = raw.neutralBoundary;
      if (boundary?.requiredMs === 750 && Number.isFinite(boundary.confirmedForMs) && boundary.confirmedForMs >= 750) {
        trial.neutralBoundary = { requiredMs: 750, confirmedForMs: boundary.confirmedForMs };
      }
    }
    report.nominalQualification = nominalGate(report);
    return qualifiedNominalReport(report, options);
  }
  return Object.freeze({ generate, canonicalContext, canonicalPlan, declarations, sameReferences, stableStringify, INVALIDATION_REASONS, nominalGate, NOMINAL_BASELINE });
});
