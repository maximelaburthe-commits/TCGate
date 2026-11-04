(function initNominalQualificationReceipt(root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TCGVisionNominalQualificationReceipt = api;
})(typeof window !== 'undefined' ? window : globalThis, function createNominalQualificationReceipt(root) {
  'use strict';
  // Qualification proof only. No engine, camera, matching or tracking state is changed.
  const DATABASE_SHA = '56402636a77af9c8b5dc4e3b61c509a185f3c834';
  const PHYSICAL_SHA = 'ce5be2ad9aeaa27df4c217dec99df7f6c7e47c94';
  const SEMANTICS_SHA = 'f6225e1d64b4fce633e5353afb9f716ece1c00eb';
  const RAW_ROOT = 'https://raw.githubusercontent.com/maximelaburthe-commits/TCGate/';
  const RECEIPT_FILE = 'VISION_NOMINAL_QUALIFICATION_RECEIPT.json';
  const ENGINE_PATHS = Object.freeze([
    'models/card_detector_v53_512.onnx',
    'public/app.js', 'public/cards-fallback.json', 'public/database-locale-core.js',
    'public/database-source.js', 'public/detection-worker.js', 'public/game-databases.js',
    'public/identification-worker.js', 'public/identification.js', 'public/player-locale.js',
    'public/table-state-bridge.js', 'public/table-state-engine.js',
    'public/vision-analysis-frame.js', 'public/vision-appearance-sampler.js',
    'public/vision-calibration.js', 'public/vision-core.js', 'public/vision-frame-gate.js',
    'public/vision-library-integrity.js', 'public/vision-locale.js',
    'public/vision-qualification-runtime.js', 'public/vision-qualification-track.js',
    'public/workspace-lab-provider.js', 'public/workspace.js', 'server.js'
  ].sort());
  const SOURCE_HASHES = Object.freeze({
    session: 'a6e7c29bf123ffcf8cae0e421f7fdf67d119c53eede4c170125944c7044078a4',
    report: 'cc0994cdb6bf0e2b240ae5c146097309527d340a6bdf5fce71e9f3032d676fc8'
  });
  const list = value => Array.isArray(value) ? value : [];
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const sha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
  const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
  const copy = value => JSON.parse(JSON.stringify(value));
  function canonical(value) {
    const ancestors = new Set();
    function ordered(input) {
      if (input === null || typeof input !== 'object') {
        if (typeof input === 'number' && !Number.isFinite(input)) throw Error('Non-finite proof value');
        if (['undefined', 'function', 'symbol', 'bigint'].includes(typeof input)) throw Error('JSON proof required');
        return input;
      }
      if (ancestors.has(input)) throw Error('Cyclic proof rejected');
      ancestors.add(input);
      const result = Array.isArray(input) ? input.map(ordered) : Object.keys(input).sort().reduce((out, key) => {
        Object.defineProperty(out, key, { value: ordered(input[key]), enumerable: true }); return out;
      }, {});
      ancestors.delete(input);
      return result;
    }
    return JSON.stringify(ordered(value)) + '\n';
  }
  // Standard SHA-256 over UTF-8; synchronous so Node and browser canonical
  // reporting use the same integrity check. Verified against native crypto.
  function sha256(input) {
    const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
    if (!(bytes instanceof Uint8Array)) throw Error('SHA-256 bytes required');
    const k = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
    const h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    const size = Math.ceil((bytes.length + 9) / 64) * 64, padded = new Uint8Array(size);
    padded.set(bytes); padded[bytes.length] = 0x80;
    const view = new DataView(padded.buffer), bits = bytes.length * 8;
    view.setUint32(size - 8, Math.floor(bits / 0x100000000)); view.setUint32(size - 4, bits >>> 0);
    const w = new Uint32Array(64), rr = (n, r) => (n >>> r) | (n << (32 - r));
    for (let offset = 0; offset < size; offset += 64) {
      for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4);
      for (let i = 16; i < 64; i++) { const a = w[i - 15], b = w[i - 2]; w[i] = (w[i - 16] + (rr(a, 7) ^ rr(a, 18) ^ (a >>> 3)) + w[i - 7] + (rr(b, 17) ^ rr(b, 19) ^ (b >>> 10))) >>> 0; }
      let [a,b,c,d,e,f,g,z] = h;
      for (let i = 0; i < 64; i++) {
        const t1 = (z + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & f) ^ (~e & g)) + k[i] + w[i]) >>> 0;
        const t2 = ((rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
        z=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;
      }
      const last = [a,b,c,d,e,f,g,z]; for (let i = 0; i < 8; i++) h[i] = (h[i] + last[i]) >>> 0;
    }
    return h.map(value => value.toString(16).padStart(8, '0')).join('');
  }
  const digest = value => sha256(canonical(value));
  function normalizedReferences(input) {
    return list(input).map(ref => ({ refId: ref.refId, cardId: ref.cardId, printingId: ref.printingId || null,
      referencePrintingId: ref.referencePrintingId || null, candidatePrintingIds: [...list(ref.candidatePrintingIds)].sort(),
      recognitionMode: ref.recognitionMode || null, locale: ref.locale
    })).sort((a, b) => a.refId < b.refId ? -1 : a.refId > b.refId ? 1 : 0);
  }
  function contextCompatibility(context, sampleDocument) {
    const refs = normalizedReferences(context?.references);
    if (!object(context) || refs.length !== 229 || new Set(refs.map(ref => ref.refId)).size !== 229 ||
        new Set(refs.map(ref => ref.cardId)).size !== 150 || refs.some(ref => ref.locale !== 'en') || context.referenceCount !== 229) throw Error('Active corpus incomplete');
    return { gameId: context.gameId, locale: context.locale, databaseSha: context.databaseSha, referenceCount: context.referenceCount,
      referencesSha256: digest(refs), sampleSha256: digest(sampleDocument) };
  }
  function blocked(reason) {
    return { ready: false, status: 'UNAVAILABLE', reasons: [reason], source: 'QUALIFICATION_RECEIPT', evidence: null,
      valid: 0, correct: 0, wrong: 0, correctIdentificationRate: null, wrongIdentificationRate: null };
  }
  function strictSchema(r) {
    const keys = (value, allowed) => object(value) && Object.keys(value).every(key => allowed.includes(key));
    const every = (values, allowed) => Array.isArray(values) && values.every(value => keys(value, allowed));
    if (!keys(r, ['schemaVersion','receiptType','receiptId','status','sourcePhysicalProductSha','qualificationSemanticsSha',
      'databaseSha','gameId','locale','referenceCount','referencesSha256','sampleSha256','sourceSession','sourceReport',
      'provenance','physicalEvidence','physicalSessionImmutable','noNewPhysicalTrials','engineCompatibility','qualificationSemantics',
      'validTrials','correct','correctIdentificationRate','wrongIdentification','wrongIdentificationRate','nominalMetrics',
      'actualSample','coverage','trials','variantCases','complementaryPhysicalQualification','fullQualificationVerdict'])) return false;
    if (![r.sourceSession,r.sourceReport].every(value => keys(value, ['name','sha256','bytes'])) ||
        !keys(r.engineCompatibility, ['files','fingerprintSha256','physicalAndSemanticsIdentical']) ||
        !every(r.engineCompatibility.files, ['path','sha256','scope']) ||
        !keys(r.qualificationSemantics, ['harnessSha256','previousHarnessSha256','change']) ||
        !every(r.actualSample, ['cardId','printingId']) || !every(r.coverage, ['cardId','printingId','valid']) ||
        !every(r.trials, ['trialId','expectedCardId','expectedPrintingId','category','correct','wrongCardEvents',
          'wrongPrintingEvents','stableConfirmedAtMs','printingAssessment'])) return false;
    const m = r.nominalMetrics;
    if (!keys(m, ['categories','correct','correctIdentificationRate','detected','detectionLatency','detectionRate','disappearances',
      'identificationLatency','identityChanges','invalid','printingAssessments','removalLatency','total','valid','wrongCardTrials',
      'wrongIdentification','wrongIdentificationRate','wrongPrintingTrials']) ||
        !keys(m.categories, ['CORRECT','INVALID_TEST','NOT_IDENTIFIED','NO_DETECTION','UNSTABLE','WRONG_IDENTIFICATION']) ||
        !keys(m.printingAssessments, ['exactPrintingObserved','expectedPrintingTrials','unresolvedPrinting','unresolvedSharedArt','wrongPrinting']) ||
        ![m.detectionLatency,m.identificationLatency,m.removalLatency].every(value => keys(value, ['count','max','median','min','p95','p95Method','p95MinimumSamples']))) return false;
    return every(r.variantCases, ['cardId','caseId','printings']) && r.variantCases.every(value =>
      every(value.printings, ['availability','exactPrintingObserved','observed','printingId','required','status']));
  }
  function validateReceipt(receipt, compatibility) {
    try {
      const r = receipt, c = compatibility;
      if (!strictSchema(r) || r.schemaVersion !== '1.0' || r.status !== 'PASS' || r.receiptType !== 'VISION_NOMINAL_QUALIFICATION') return blocked('RECEIPT_SCHEMA_OR_STATUS');
      if (!object(c) || c.schemaVersion !== '1.0' || !sha(c.buildSha)) return blocked('DEPLOYED_COMPATIBILITY_REQUIRED');
      if (!hash(c.receiptSha256) || digest(r) !== c.receiptSha256) return blocked('RECEIPT_INTEGRITY_MISMATCH');
      if (r.sourcePhysicalProductSha !== PHYSICAL_SHA || r.qualificationSemanticsSha !== SEMANTICS_SHA ||
          r.sourceSession?.sha256 !== SOURCE_HASHES.session || r.sourceReport?.sha256 !== SOURCE_HASHES.report ||
          r.sourceSession?.bytes !== 18290805 || r.sourceReport?.bytes !== 20970917 ||
          r.sourceSession?.name !== 'vision-qualification-session.json' || r.sourceReport?.name !== 'vision-qualification-1.0-recalculated-6c1-final.json' ||
          r.receiptId !== 'vision-nominal-ce5be2a-f6225e1-' + SOURCE_HASHES.report.slice(0, 12) ||
          r.provenance !== 'physical' || r.physicalEvidence !== 'OPERATOR_DECLARED_REAL_CARDS' ||
          r.physicalSessionImmutable !== true || r.noNewPhysicalTrials !== true) return blocked('PHYSICAL_PROVENANCE_MISMATCH');
      if (r.gameId !== 'cyberpunk' || r.locale !== 'en' || r.databaseSha !== DATABASE_SHA || r.referenceCount !== 229 ||
          c.gameId !== r.gameId || c.locale !== r.locale || c.databaseSha !== r.databaseSha || c.referenceCount !== r.referenceCount) return blocked('CORPUS_CONTEXT_MISMATCH');
      if (!hash(r.referencesSha256) || r.referencesSha256 !== c.referencesSha256 ||
          !hash(r.sampleSha256) || r.sampleSha256 !== c.sampleSha256) return blocked('REFERENCES_OR_SAMPLE_MISMATCH');
      const files = list(r.engineCompatibility?.files), active = list(c.files);
      if (files.length !== ENGINE_PATHS.length || active.length !== ENGINE_PATHS.length ||
          files.some((file, i) => file.path !== ENGINE_PATHS[i] || !hash(file.sha256) || (file.path === 'server.js' ? file.scope !== 'MODEL_SERVING_V1' : Object.prototype.hasOwnProperty.call(file, 'scope'))) ||
          active.some((file, i) => file.path !== ENGINE_PATHS[i] || !hash(file.sha256) || (file.path === 'server.js' ? file.scope !== 'MODEL_SERVING_V1' : Object.prototype.hasOwnProperty.call(file, 'scope'))) ||
          digest(files) !== r.engineCompatibility?.fingerprintSha256 || digest(active) !== c.fingerprintSha256 ||
          canonical(files) !== canonical(active) || c.fingerprintSha256 !== r.engineCompatibility.fingerprintSha256) return blocked('ENGINE_INCOMPATIBLE');
      if (!hash(r.qualificationSemantics?.harnessSha256) ||
          r.qualificationSemantics.harnessSha256 !== c.semantics?.harnessSha256 ||
          r.engineCompatibility?.physicalAndSemanticsIdentical !== true ||
          r.qualificationSemantics?.change !== 'EXACT_6C1_NOMINAL_CLASSIFICATION_ONLY') return blocked('SEMANTICS_INCOMPATIBLE');
      const metrics = r.nominalMetrics, trials = list(r.trials), coverage = list(r.coverage), sample = list(r.actualSample);
      if (!object(metrics) || metrics.valid !== 45 || metrics.total !== 45 || metrics.invalid !== 0 ||
          !Number.isInteger(metrics.correct) || !Number.isInteger(metrics.wrongIdentification) ||
          metrics.correct < 0 || metrics.correct > 45 || metrics.wrongIdentification < 0 || metrics.wrongIdentification > 45 ||
          metrics.correctIdentificationRate !== metrics.correct / 45 * 100 || metrics.wrongIdentificationRate !== metrics.wrongIdentification / 45 * 100 ||
          r.validTrials !== metrics.valid || r.correct !== metrics.correct || r.wrongIdentification !== metrics.wrongIdentification ||
          r.correctIdentificationRate !== metrics.correctIdentificationRate || r.wrongIdentificationRate !== metrics.wrongIdentificationRate ||
          metrics.correctIdentificationRate < 95 || metrics.wrongIdentificationRate > 1) return blocked('NOMINAL_THRESHOLD_OR_METRICS');
      if (sample.length !== 15 || coverage.length !== 15 || new Set(sample.map(item => item.cardId)).size !== 15 ||
          coverage.some((item, i) => item.cardId !== sample[i].cardId || item.printingId !== sample[i].printingId || item.valid !== 3) ||
          trials.length !== 45 || new Set(trials.map(trial => trial.trialId)).size !== 45 ||
          coverage.some(item => trials.filter(trial => trial.expectedCardId === item.cardId && trial.expectedPrintingId === item.printingId).length !== 3)) return blocked('NOMINAL_COVERAGE_INCOMPLETE');
      const categories = ['CORRECT', 'NOT_IDENTIFIED', 'NO_DETECTION', 'UNSTABLE', 'WRONG_IDENTIFICATION'];
      if (trials.some(trial => typeof trial.trialId !== 'string' || !categories.includes(trial.category) ||
          !Number.isInteger(trial.wrongCardEvents) || trial.wrongCardEvents < 0 || !Number.isInteger(trial.wrongPrintingEvents) || trial.wrongPrintingEvents < 0) ||
          categories.some(category => metrics.categories?.[category] !== trials.filter(trial => trial.category === category).length) ||
          trials.filter(trial => trial.category === 'CORRECT').length !== metrics.correct ||
          trials.filter(trial => trial.wrongCardEvents > 0 || trial.wrongPrintingEvents > 0).length !== metrics.wrongIdentification ||
          trials.some(trial => trial.category === 'CORRECT' && (trial.stableConfirmedAtMs === null || !Number.isFinite(trial.stableConfirmedAtMs) || trial.wrongCardEvents || trial.wrongPrintingEvents))) return blocked('TRIAL_SUMMARY_MISMATCH');
      const evidence = { source: 'QUALIFICATION_RECEIPT', schemaVersion: r.schemaVersion, receiptId: r.receiptId,
        sourcePhysicalProductSha: r.sourcePhysicalProductSha, qualificationSemanticsSha: r.qualificationSemanticsSha,
        databaseSha: r.databaseSha, gameId: r.gameId, locale: r.locale, referenceCount: r.referenceCount,
        sourceSession: copy(r.sourceSession), sourceReport: copy(r.sourceReport), nominalMetrics: copy(metrics),
        actualSample: copy(sample), coverage: copy(coverage), trials: copy(trials), variantCases: copy(list(r.variantCases)),
        engineCompatibility: copy(r.engineCompatibility), qualificationSemantics: copy(r.qualificationSemantics),
        referencesSha256: r.referencesSha256, sampleSha256: r.sampleSha256,
        provenance: r.provenance, physicalEvidence: r.physicalEvidence, physicalSessionImmutable: true, noNewPhysicalTrials: true };
      return { ready: true, status: 'PASS', reasons: [], source: 'QUALIFICATION_RECEIPT', evidence,
        valid: metrics.valid, correct: metrics.correct, wrong: metrics.wrongIdentification,
        correctIdentificationRate: metrics.correctIdentificationRate, wrongIdentificationRate: metrics.wrongIdentificationRate };
    } catch { return blocked('MALFORMED_QUALIFICATION_RECEIPT'); }
  }
  async function load(options = {}) {
    let receipt = null, compatibility = null;
    try {
      if (!sha(options.productSha) || options.context?.productSha !== options.productSha) return blocked('EXACT_BUILD_REQUIRED');
      const fetchImpl = options.fetchImpl || root.fetch?.bind(root);
      if (typeof fetchImpl !== 'function') return blocked('FETCH_UNAVAILABLE');
      const [artifact, deployed] = await Promise.all([
        fetchImpl(RAW_ROOT + options.productSha + '/' + RECEIPT_FILE, { cache: 'no-store', redirect: 'error', credentials: 'omit' }),
        fetchImpl('/api/vision-qualification-compatibility', { cache: 'no-store', redirect: 'error', credentials: 'omit' })
      ]);
      if (!artifact.ok) return blocked('RECEIPT_ABSENT');
      if (!deployed.ok) return blocked('DEPLOYED_COMPATIBILITY_UNAVAILABLE');
      const text = await artifact.text();
      if (text.length > 262144) return blocked('RECEIPT_TOO_LARGE');
      receipt = JSON.parse(text); compatibility = await deployed.json();
      if (compatibility.buildSha !== options.productSha) return blocked('DEPLOYED_BUILD_CHANGED');
      const context = contextCompatibility(options.context, options.sampleDocument);
      if (compatibility.databaseSha !== context.databaseSha) return blocked('DEPLOYED_DATABASE_MISMATCH');
      compatibility = { ...compatibility, ...context };
      return { ...validateReceipt(receipt, compatibility), receipt, compatibility };
    } catch { return { ...blocked('RECEIPT_LOAD_FAILED'), receipt, compatibility }; }
  }
  return Object.freeze({ load, validateReceipt, contextCompatibility, normalizedReferences, canonical, sha256, digest,
    DATABASE_SHA, PHYSICAL_SHA, SEMANTICS_SHA, RAW_ROOT, RECEIPT_FILE, ENGINE_PATHS, SOURCE_HASHES });
});
