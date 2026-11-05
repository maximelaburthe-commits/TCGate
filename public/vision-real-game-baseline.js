(function initRealGameBaseline(root, factory) {
  'use strict';
  const receiptApi = typeof module === 'object' && module.exports
    ? require('./vision-qualification-receipt.js') : root.TCGVisionNominalQualificationReceipt;
  const api = factory(root, receiptApi);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TCGVisionRealGameBaseline = api;
})(typeof window !== 'undefined' ? window : globalThis, function createRealGameBaseline(root, receiptApi) {
  'use strict';
  // This immutable artifact predates this campaign. It is never presented as
  // a physical observation of the current build or added to its denominator.
  const BASELINE_SHA = '6d08ad3fde309a6c38990ba82ef4e56aa2e21597';
  const RECEIPT_SHA256 = '2612d126e31a31453ff2c50368a66c10e0f718e25d7c2f2891cb2530bbe75e99';
  const SAMPLE_SHA256 = '36dba0fee7c07226a95661e643e62a62e2a8e37c56aa9788eecf8df94adc5a4a';
  const RAW = 'https://raw.githubusercontent.com/maximelaburthe-commits/TCGate/' + BASELINE_SHA + '/';
  const sha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
  const blocked = reason => ({ ready: false, status: 'UNAVAILABLE', reasons: [reason], source: 'HISTORICAL_NOMINAL_RECEIPT',
    baselineProductSha: BASELINE_SHA, summary: { correct: null, valid: null, wrong: null, correctIdentificationRate: null } });
  async function load(options = {}) {
    if (!receiptApi) return blocked('RECEIPT_VALIDATOR_UNAVAILABLE');
    if (!sha(options.productSha) || (options.context?.productSha && options.context.productSha !== options.productSha)) return blocked('EXACT_BUILD_REQUIRED');
    const fetchImpl = options.fetchImpl || root.fetch?.bind(root);
    if (typeof fetchImpl !== 'function') return blocked('FETCH_UNAVAILABLE');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const request = async (url, maxBytes) => {
      const response = await fetchImpl(url, { method: 'GET', cache: 'no-store', redirect: 'error', credentials: 'omit', signal: controller.signal });
      if (!response.ok) throw Error('RESOURCE_UNAVAILABLE');
      const text = await response.text();
      if (new TextEncoder().encode(text).byteLength > maxBytes) throw Error('RESOURCE_TOO_LARGE');
      return text;
    };
    try {
      const [rawReceipt, rawSample, rawCompatibility, rawHealth] = await Promise.all([
        request(RAW + 'VISION_NOMINAL_QUALIFICATION_RECEIPT.json', 262144),
        request(RAW + 'VISION_QUALIFICATION_SAMPLE.json', 524288),
        request('/api/vision-qualification-compatibility', 32768),
        request('/api/health', 8192)
      ]);
      if (receiptApi.sha256(rawReceipt) !== RECEIPT_SHA256) return blocked('PINNED_RECEIPT_INTEGRITY_MISMATCH');
      const receipt = JSON.parse(rawReceipt), sample = JSON.parse(rawSample);
      if (receiptApi.digest(sample) !== SAMPLE_SHA256) return blocked('PINNED_SAMPLE_INTEGRITY_MISMATCH');
      const active = JSON.parse(rawCompatibility), health = JSON.parse(rawHealth);
      if (active.buildSha !== options.productSha || health.ok !== true || health.buildSha !== options.productSha) return blocked('DEPLOYED_BUILD_CHANGED');
      const input = options.context;
      if (!input || !['cyberpunk', 'cyberpunk-tcg'].includes(input.gameId) || input.locale !== 'en' ||
          (input.playerLocale && input.playerLocale !== 'en') || input.databaseSha !== receiptApi.DATABASE_SHA) return blocked('ACTIVE_CONTEXT_MISMATCH');
      const context = receiptApi.contextCompatibility({ ...input, gameId: 'cyberpunk' }, sample);
      if (active.databaseSha !== context.databaseSha) return blocked('DEPLOYED_DATABASE_MISMATCH');
      const compatibility = { ...active, ...context };
      const result = receiptApi.validateReceipt(receipt, compatibility);
      if (!result.ready) return { ...blocked(result.reasons[0] || 'HISTORICAL_RECEIPT_INCOMPATIBLE'), compatibility };
      // A rolling update between the parallel requests cannot silently change
      // which deployed build this attestation describes.
      const finalHealth = JSON.parse(await request('/api/health', 8192));
      if (finalHealth.ok !== true || finalHealth.buildSha !== options.productSha) return blocked('DEPLOYED_BUILD_CHANGED');
      return { ready: true, status: 'PASS', reasons: [], source: 'HISTORICAL_NOMINAL_RECEIPT',
        baselineProductSha: BASELINE_SHA, physicalProductSha: receiptApi.PHYSICAL_SHA, semanticsProductSha: receiptApi.SEMANTICS_SHA,
        activeProductSha: options.productSha, summary: { correct: result.correct, valid: result.valid, wrong: result.wrong,
          correctIdentificationRate: result.correctIdentificationRate }, receipt, compatibility };
    } catch (error) {
      return blocked(error?.message === 'RESOURCE_TOO_LARGE' ? 'RESOURCE_TOO_LARGE' : 'HISTORICAL_BASELINE_LOAD_FAILED');
    } finally { clearTimeout(timeout); controller.abort(); }
  }
  return Object.freeze({ load, BASELINE_SHA, RECEIPT_SHA256, SAMPLE_SHA256 });
});
