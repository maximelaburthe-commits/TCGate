'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createControlCenterForwarder, deliverReport, normalizeOrigin, DEFAULT_TIMEOUT_MS } = require('./control-center-forwarder');

const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x54, 0x43, 0x47, 0x61, 0x74, 0x65]);
const KEY = 'integration-test-ingest-key';
const REPORT = { attachment: ZIP, filename: 'tcgate-alpha-report.zip', note: 'tester note', roomCode: 'ROOM42', context: 'game' };

function response(status, payload) {
  return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } });
}

async function inspectForward(status, payload) {
  let request = null;
  const forwarder = createControlCenterForwarder({
    url: 'https://control.example/', ingestKey: KEY,
    fetchImpl: async (url, options) => { request = { url, options }; return response(status, payload); }
  });
  const result = await forwarder.forward(REPORT);
  const file = request.options.body.get('report');
  assert.strictEqual(request.url, 'https://control.example/api/reports');
  assert.strictEqual(request.options.method, 'POST');
  assert.strictEqual(request.options.headers.Authorization, `Bearer ${KEY}`);
  assert.strictEqual(file.name, REPORT.filename);
  assert.strictEqual(file.type, 'application/zip');
  assert.deepStrictEqual(Buffer.from(await file.arrayBuffer()), ZIP, 'ZIP bytes must be unchanged');
  assert.deepStrictEqual([...request.options.body.keys()], ['report'], 'only the accepted report field is sent');
  return result;
}

async function run() {
  assert.strictEqual(normalizeOrigin('https://control.example/'), 'https://control.example');
  assert.strictEqual(normalizeOrigin('https://control.example/path'), null);
  assert.strictEqual(DEFAULT_TIMEOUT_MS, 5000);

  const created = await inspectForward(201, { duplicate: false, reportId: 'r1', sessionRunId: 's1' });
  assert.deepStrictEqual(created, { configured: true, forwarded: true, duplicate: false, reportId: 'r1', sessionRunId: 's1', status: 201 });
  const duplicate = await inspectForward(200, { duplicate: true, reportId: 'r1', sessionRunId: 's1' });
  assert.strictEqual(duplicate.forwarded, true);
  assert.strictEqual(duplicate.duplicate, true);

  for (const status of [401, 500]) {
    let emailCalls = 0;
    const forwarder = createControlCenterForwarder({ url: 'https://control.example', ingestKey: KEY, fetchImpl: async () => response(status, { error: 'rejected' }) });
    const delivery = await deliverReport({ report: REPORT, sendEmail: async value => { emailCalls += 1; assert.strictEqual(value.attachment, ZIP); return { id: 'email-ok' }; }, forwarder, logger: { warn() {}, info() {} } });
    assert.strictEqual(emailCalls, 1, `email remains operational after Center ${status}`);
    assert.strictEqual(delivery.email.id, 'email-ok');
    assert.strictEqual(delivery.controlCenter.forwarded, false);
  }

  let timeoutEmailCalls = 0;
  const timeoutForwarder = createControlCenterForwarder({
    url: 'https://control.example', ingestKey: KEY, timeoutMs: 5,
    fetchImpl: async (url, options) => new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))))
  });
  const timeoutDelivery = await deliverReport({ report: REPORT, sendEmail: async () => { timeoutEmailCalls += 1; return { id: 'email-timeout-ok' }; }, forwarder: timeoutForwarder, logger: { warn() {}, info() {} } });
  assert.strictEqual(timeoutEmailCalls, 1);
  assert.strictEqual(timeoutDelivery.controlCenter.reason, 'timeout');

  let historicalEmailCalls = 0;
  const unconfigured = createControlCenterForwarder({ url: '', ingestKey: '', fetchImpl: async () => { throw new Error('must not fetch'); } });
  const historical = await deliverReport({ report: REPORT, sendEmail: async () => { historicalEmailCalls += 1; return { id: 'historical-email' }; }, forwarder: unconfigured, logger: { warn() {}, info() {} } });
  assert.strictEqual(historicalEmailCalls, 1);
  assert.deepStrictEqual(historical.controlCenter, { configured: false, forwarded: false, reason: 'not-configured' });

  const publicFiles = fs.readdirSync(path.join(__dirname, 'public'), { recursive: true }).filter(name => typeof name === 'string' && name.endsWith('.js'));
  for (const name of publicFiles) {
    const content = fs.readFileSync(path.join(__dirname, 'public', name), 'utf8');
    assert(!content.includes('CONTROL_CENTER_INGEST_KEY'), `ingest key name leaked into public/${name}`);
    assert(!content.includes(KEY), `ingest key leaked into public/${name}`);
  }
  assert(!ZIP.includes(KEY), 'ingest key must not be added to ZIP');

  const bridgeSource = fs.readFileSync(path.join(__dirname, 'report-mail-server.js'), 'utf8');
  assert(bridgeSource.includes('controlCenterConfigured: controlCenterForwarder.configured()'));
  assert(bridgeSource.includes('sendEmail: sendViaResend'), 'existing Resend delivery remains wired');

  console.log('CONTROL_CENTER_FORWARDER_OK');
  console.log('email + 201/200 + 401/500/timeout + unconfigured + security: OK');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
