'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const api = require('./public/vision-real-game-baseline.js');
const receiptApi = require('./public/vision-qualification-receipt.js');
const { getCompatibility } = require('./vision-nominal-qualification-compatibility.js');
const fixture = require('./fixtures/vision-canonical-corpus-229.json');
const productSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const context = { productSha, databaseSha: fixture.databaseSha, gameId: 'cyberpunk', locale: 'en', playerLocale: 'en', referenceCount: 229, references: fixture.references };
const receiptText = fs.readFileSync('VISION_NOMINAL_QUALIFICATION_RECEIPT.json', 'utf8').replace(/\r\n/g, '\n');
const sampleText = fs.readFileSync('VISION_QUALIFICATION_SAMPLE.json', 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
function mock(options = {}) {
  const requests = [];
  let healthCalls = 0;
  const fetchImpl = async (url, config) => {
    requests.push({ url, config });
    let text;
    if (url === '/api/health') text = JSON.stringify({ ok: true, buildSha: ++healthCalls > 1 && options.rollover ? 'b'.repeat(40) : productSha });
    else if (url === '/api/vision-qualification-compatibility') text = JSON.stringify(options.compatibility || getCompatibility({ root: __dirname, buildSha: productSha }));
    else if (url === receiptApi.RAW_ROOT + api.BASELINE_SHA + '/VISION_NOMINAL_QUALIFICATION_RECEIPT.json') text = options.receipt || receiptText;
    else if (url === receiptApi.RAW_ROOT + api.BASELINE_SHA + '/VISION_QUALIFICATION_SAMPLE.json') text = options.sample || sampleText;
    else throw Error('Unexpected fetch or branch fallback: ' + url);
    if (options.offline) throw Error('offline');
    return { ok: !options.absent, text: async () => text };
  };
  return { requests, fetchImpl };
}
async function main() {
  const first = mock();
  const result = await api.load({ productSha, context, fetchImpl: first.fetchImpl });
  assert.equal(result.ready, true);
  assert.deepEqual(result.summary, { correct: 43, valid: 45, wrong: 0, correctIdentificationRate: 43 / 45 * 100 });
  assert.equal(result.baselineProductSha, api.BASELINE_SHA);
  assert.equal(result.physicalProductSha, receiptApi.PHYSICAL_SHA);
  assert.equal(result.semanticsProductSha, receiptApi.SEMANTICS_SHA);
  assert.equal(result.activeProductSha, productSha);
  assert.equal(first.requests.length, 5);
  assert(first.requests.every(r => r.config.method === 'GET' && r.config.redirect === 'error' && r.config.cache === 'no-store' && r.config.credentials === 'omit'));
  assert(first.requests.filter(r => r.url.startsWith('https:')).every(r => r.url.includes('/' + api.BASELINE_SHA + '/')));
  for (const [options, reason] of [
    [{ receipt: receiptText + ' ' }, 'PINNED_RECEIPT_INTEGRITY_MISMATCH'],
    [{ sample: JSON.stringify({ ...JSON.parse(sampleText), changed: true }) }, 'PINNED_SAMPLE_INTEGRITY_MISMATCH'],
    [{ receipt: 'x'.repeat(262145) }, 'RESOURCE_TOO_LARGE'],
    [{ offline: true }, 'HISTORICAL_BASELINE_LOAD_FAILED'],
    [{ absent: true }, 'HISTORICAL_BASELINE_LOAD_FAILED'],
    [{ rollover: true }, 'DEPLOYED_BUILD_CHANGED']
  ]) {
    const item = await api.load({ productSha, context, fetchImpl: mock(options).fetchImpl });
    assert.equal(item.ready, false); assert.deepEqual(item.reasons, [reason]); assert.equal(item.summary.valid, null);
  }
  for (const change of [
    c => { c.locale = 'fr'; }, c => { c.playerLocale = 'fr'; }, c => { c.gameId = 'other'; },
    c => { c.databaseSha = 'a'.repeat(40); }, c => { c.referenceCount = 228; },
    c => { c.references.pop(); }, c => { c.references[0].cardId = 'wrong'; },
    c => { c.references[0].locale = 'fr'; }, c => { c.productSha = 'a'.repeat(40); }
  ]) {
    const bad = clone(context); change(bad);
    assert.equal((await api.load({ productSha, context: bad, fetchImpl: mock().fetchImpl })).ready, false);
  }
  for (const change of [
    c => { c.buildSha = 'a'.repeat(40); }, c => { c.databaseSha = 'a'.repeat(40); },
    c => { c.files[0].sha256 = 'a'.repeat(64); }, c => { c.semantics.harnessSha256 = 'a'.repeat(64); },
    c => { c.receiptSha256 = 'a'.repeat(64); }
  ]) {
    const compatibility = getCompatibility({ root: __dirname, buildSha: productSha }); change(compatibility);
    assert.equal((await api.load({ productSha, context, fetchImpl: mock({ compatibility }).fetchImpl })).ready, false);
  }
  assert.equal((await api.load({ productSha: 'update/next', context, fetchImpl: mock().fetchImpl })).ready, false);
  assert.equal((await api.load({ productSha, context: { ...context, gameId: 'cyberpunk-tcg' }, fetchImpl: mock().fetchImpl })).ready, true);
  console.log('REAL_GAME_BASELINE PASS: pinned historical 43/45, real active corpus/build/code compatibility, rolling update, unavailable and tampered proofs fail closed. No new physical qualification.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
