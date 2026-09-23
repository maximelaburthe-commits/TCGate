'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const diagnostics = require('./public/report-diagnostics-v2.js');

const legacy = overrides => ({
  format: 'tcgate-alpha-complete-report', version: 'Candidate 12', generatedAt: '2026-09-17T10:00:00.000Z',
  session: { roomCode: 'ABCD42', role: 'host', game: 'cyberpunk', startedAt: '2026-09-17T09:00:00.000Z' },
  environment: { userAgent: 'Mozilla/5.0 Windows NT 10.0 Chrome/140.0', platform: 'Win32', page: { hostname: 'alpha.example' } },
  network: { webrtc: { available: true, connectionState: 'connected', iceConnectionState: 'connected', iceGatheringState: 'complete', signalingState: 'stable', route: { usingRelay: false, localCandidateType: 'host', remoteCandidateType: 'srflx', localProtocol: 'udp' }, candidatePair: { currentRoundTripTime: .02, availableOutgoingBitrate: 2500000 }, inbound: [{ kind: 'video', packetsReceived: 100, packetsLost: 2, bytesReceived: 5000, framesDecoded: 90, framesDropped: 1, framesPerSecond: 30, bitrateKbps: 800 }], outbound: [{ kind: 'video', packetsSent: 80, bytesSent: 4500, framesEncoded: 75, bitrateKbps: 700, qualityLimitationReason: 'none' }] } },
  vision: { enabledForGame: true, assetsLoaded: true, profile: 'vision-1', detector: { activeCards: 1, inference: { inferenceMs: 12 } }, identification: { libraryReady: true, librarySize: 150, scheduling: { visionFramesRequested: 12, visionFramesProcessed: 10, visionFramesDropped: 2, visionIdentificationP50: 8, visionIdentificationP95: 14 }, database: { databaseGame: 'cyberpunk', databaseVersion: '1.1.0', canonicalCount: 150, printingCount: 229, visionReferenceCount: 229, databaseSource: 'public-github-direct', fallbackActive: false }, libraryPerformance: { cacheStatus: 'hit', databaseLoadMs: 30, networkBytes: 1000 } }, libraryIntegrity: { loadedReferences: 229, failedReferences: 0, failed: [] } },
  media: { remoteTracks: [{ kind: 'video', width: 1280, height: 720 }] }, events: [] , ...overrides
});

(async () => {
  diagnostics.reset();
  for (let i = 0; i < 80; i++) diagnostics.recordNetworkEvent('rtc-connection-state', { state: i % 2 ? 'connected' : 'disconnected', reason: `Bearer secret-${i}` }, Date.now() + i);
  const complete = await diagnostics.build(legacy(), { buildSha: 'a'.repeat(40), timezone: 'Europe/Paris', timezoneOffsetMinutes: -120, sessionSeed: 'private-room', database: { sourceCommit: 'b'.repeat(40), runtimeScope: 'cyberpunk-beta-2026' } });
  assert.equal(complete.reportSchemaVersion, 2);
  assert.equal(complete.diagnostics.network.summary.route, 'direct');
  assert.equal(complete.diagnostics.network.timeline.items.length, diagnostics.LIMITS.networkEvents);
  assert.equal(complete.diagnostics.network.timeline.truncated, true);
  assert.equal(complete.diagnostics.network.timeline.totalItems, 80);
  assert.equal(complete.diagnostics.vision.summary.framesDropped, 2);
  assert.equal(complete.diagnostics.database.summary.cacheUsed, true);
  assert.equal(complete.privacy.userJourneyCollected, false);
  assert.doesNotMatch(JSON.stringify(complete), /secret-\d|private-room/);

  const relay = diagnostics.collectNetwork(legacy().network ? legacy() : {});
  assert.equal(relay.summary.route, 'direct');
  assert.equal(diagnostics.collectNetwork({}).status, 'unavailable');
  assert.equal(diagnostics.collectVision({ vision: { enabledForGame: false } }).status, 'inactive');
  assert.equal(diagnostics.collectVision({ vision: { enabledForGame: true, assetsError: 'worker token=abc failed' } }).status, 'error');
  assert.doesNotMatch(JSON.stringify(diagnostics.collectVision({ vision: { enabledForGame: true, assetsError: '10.1.2.3 Bearer abc' }, events: [{ type: 'vision-error', data: { message: 'SDP token=private from 10.1.2.3' } }] })), /10\.1\.2\.3|private|Bearer abc/);
  const partial = await diagnostics.build({ session: { game: 'none' }, environment: {} });
  assert.equal(partial.envelope.mode, 'no-game');
  assert.equal(partial.diagnostics.database.status, 'unavailable');
  const failedInput = { session: {}, environment: {} }; Object.defineProperty(failedInput, 'network', { get() { throw new Error('collector failure'); } });
  const failed = await diagnostics.build(failedInput);
  assert.equal(failed.diagnostics.network.status, 'error');

  const many = diagnostics.collectDatabase({ vision: { libraryIntegrity: { failed: Array.from({ length: 60 }, (_, i) => ({ id: `card-${i}`, reason: 'missing' })) } } });
  assert.equal(many.problems.truncated, true);
  assert.equal(many.problems.retainedItems, diagnostics.LIMITS.databaseProblems);
  const sanitized = diagnostics.sanitize({ token: 'abc', sdp: 'v=0', message: 'connect 192.168.1.4 Bearer xyz', nested: { cookie: 'x' } });
  assert.equal(sanitized.token, undefined);
  assert.doesNotMatch(JSON.stringify(sanitized), /192\.168\.1\.4|xyz|v=0/);

  const adversarialCases = [
    { input: 'Authorization: Bearer SUPERSECRET123', forbidden: ['SUPERSECRET123'] },
    { input: 'cookie=session=abc123', forbidden: ['session=abc123'] },
    { input: 'Set-Cookie: recovery=xyz789; HttpOnly', forbidden: ['recovery=xyz789', 'HttpOnly'] },
    { input: 'token=mytoken', forbidden: ['mytoken'] },
    { input: 'recoveryToken=something-secret', forbidden: ['something-secret'] },
    { input: 'credential=turn-password', forbidden: ['turn-password'] },
    { input: '192.168.1.42', forbidden: ['192.168.1.42'] },
    { input: '8.8.8.8:3478', forbidden: ['8.8.8.8', '3478'] },
    { input: '::1', forbidden: ['::1'] },
    { input: '2001:db8::1', forbidden: ['2001:db8::1'] },
    { input: 'fe80::abcd:1234', forbidden: ['fe80::abcd:1234'] },
    {
      input: 'v=0\no=- 123 456 IN IP4 192.168.1.42\ns=-\nt=0 0\nm=video 9 UDP/TLS/RTP/SAVPF 96\na=ice-ufrag:abcd\na=ice-pwd:secret-password\na=fingerprint:sha-256 00:11:22\na=candidate:1 1 UDP 2122260223 192.168.1.42 54321 typ host',
      forbidden: ['v=0', '192.168.1.42', 'secret-password', 'a=candidate:', 'a=fingerprint:']
    },
    {
      input: 'texte avant v=0\no=- 123 456 IN IP6 2001:db8::1\ns=-\nt=0 0\nm=video 9 UDP/TLS/RTP/SAVPF 96\na=ice-pwd:hidden puis texte après',
      forbidden: ['v=0', '2001:db8::1', 'hidden', 'a=ice-pwd:']
    },
    { input: 'https://example.com/private/token/abcdef?secret=qwerty', forbidden: ['/private/token/abcdef', 'qwerty'] },
    { input: 'https://user:password@example.com/private', forbidden: ['user:password', '/private'] },
    { input: 'wss://example.com/events?token=abc', forbidden: ['/events', 'token=abc'] }
  ];
  for (const { input, forbidden } of adversarialCases) {
    const output = String(diagnostics.sanitize(input));
    for (const secret of forbidden) assert(!output.includes(secret), `adversarial value survived sanitation: ${secret}`);
  }
  const nestedAdversarial = diagnostics.sanitize({
    token: 'nested-token',
    nested: { cookie: 'nested-cookie', text: 'Bearer nested-bearer' },
    values: ['recoveryToken=array-token', '10.0.0.2', 'a=ice-pwd:array-password']
  });
  const nestedJson = JSON.stringify(nestedAdversarial);
  for (const secret of ['nested-token', 'nested-cookie', 'nested-bearer', 'array-token', '10.0.0.2', 'array-password']) {
    assert(!nestedJson.includes(secret), `nested adversarial value survived sanitation: ${secret}`);
  }
  const readable = diagnostics.sanitize('Connexion rétablie après 2 tentatives, latence stable.');
  assert.equal(readable, 'Connexion rétablie après 2 tentatives, latence stable.');

  assert.deepEqual(diagnostics.normalizeTesterFeedback([]), []);
  const noFeedbackReport = { vision: { integrated: true } };
  diagnostics.addTesterFeedback(noFeedbackReport, []);
  assert.equal(Object.hasOwn(noFeedbackReport.vision, 'testerFeedback'), false);
  assert.deepEqual(diagnostics.normalizeTesterFeedback([{ issueType: 'not_recognized', cardName: '  Panam  ' }]), [
    { issueType: 'not_recognized', cardName: 'Panam', recognizedAs: null, note: '' }
  ]);
  assert.deepEqual(diagnostics.normalizeTesterFeedback([{ issueType: 'wrong_identification', cardName: 'Panam', recognizedAs: 'Jackie Wells' }]), [
    { issueType: 'wrong_identification', cardName: 'Panam', recognizedAs: 'Jackie Wells', note: '' }
  ]);
  assert.deepEqual(diagnostics.normalizeTesterFeedback([{ issueType: 'unstable_identification', cardName: 'Rogue', recognizedAs: 'ignored' }]), [
    { issueType: 'unstable_identification', cardName: 'Rogue', recognizedAs: null, note: '' }
  ]);
  assert.deepEqual(diagnostics.normalizeTesterFeedback([{ issueType: 'something_else', cardName: 'Panam' }, { issueType: 'not_recognized', cardName: '   ' }]), []);
  assert.equal(diagnostics.normalizeTesterFeedback(Array.from({ length: 12 }, (_, index) => ({ issueType: 'not_recognized', cardName: `Card ${index}` }))).length, 10);
  const boundedFeedback = diagnostics.normalizeTesterFeedback([{ issueType: 'wrong_identification', cardName: 'a'.repeat(121), recognizedAs: 'b'.repeat(121), note: 'c'.repeat(501) }])[0];
  assert.equal(boundedFeedback.cardName.length, 120);
  assert.equal(boundedFeedback.recognizedAs.length, 120);
  assert.equal(boundedFeedback.note.length, 500);
  const privateFeedback = diagnostics.normalizeTesterFeedback([{ issueType: 'wrong_identification', cardName: 'Panam 10.0.0.2', recognizedAs: 'https://example.test/card?token=secret', note: 'cookie=session-secret Bearer private-token' }])[0];
  assert.doesNotMatch(JSON.stringify(privateFeedback), /10\.0\.0\.2|example\.test|session-secret|private-token/);
  const feedbackReport = { vision: { integrated: true } };
  diagnostics.addTesterFeedback(feedbackReport, [{ issueType: 'not_recognized', cardName: 'Panam' }]);
  assert.equal(feedbackReport.vision.testerFeedback.length, 1);

  const privacyFixture = legacy({
    events: [{ type: 'vision-error', data: { message: adversarialCases.map(item => item.input).join('\n') } }],
    vision: { enabledForGame: true, assetsError: adversarialCases.map(item => item.input).join('\n'), identification: {} }
  });
  const privacyReport = await diagnostics.build(privacyFixture, { sessionSeed: 'privacy-fixture' });
  const privacyJson = JSON.stringify(privacyReport);
  for (const marker of ['SUPERSECRET123', 'abc123', 'xyz789', 'mytoken', 'something-secret', 'turn-password', '192.168.1.42', '8.8.8.8', '::1', '2001:db8::1', 'fe80::abcd:1234', 'secret-password', '/private/token/abcdef', 'user:password', '/events']) {
    assert(!privacyJson.includes(marker), `report privacy guarantee failed: ${marker}`);
  }
  assert.deepEqual(privacyReport.privacy, {
    userJourneyCollected: false,
    audiovisualContentIncluded: false,
    fullIpAddressesIncluded: false,
    sdpIncluded: false,
    rawCandidatesIncluded: false,
    secretsIncluded: false
  });
  const appSource = fs.readFileSync('public/app.js', 'utf8');
  const indexSource = fs.readFileSync('public/index.html', 'utf8');
  const reportUiSource = fs.readFileSync('public/report-mail-ui.js', 'utf8');
  assert(indexSource.indexOf('/report-diagnostics-v2.js') < indexSource.indexOf('/app.js'));
  assert.match(appSource, /try \{[\s\S]*TCGateReportDiagnosticsV2\.build/);
  assert.match(appSource, /maxReportBytes = 768 \* 1024/);
  assert.match(appSource, /report\.events = report\.events\.slice\(-256\)/);
  assert.match(appSource, /TCGateReportDiagnosticsV2\?\.addTesterFeedback/);
  assert.doesNotMatch(appSource, /testerFeedback:\s*\[\.\.\.state\.visionFeedback\]/);
  assert.match(indexSource, /id="visionFeedbackSection"/);
  assert.match(indexSource, /id="addVisionFeedback"/);
  assert.match(reportUiSource, /feedbackEntries\.length >= 10/);
  assert.match(reportUiSource, /type\.value === 'wrong_identification'/);
  assert.match(reportUiSource, /maxlength="120"/);
  assert.match(reportUiSource, /maxlength="500"/);
  console.log('Report Schema V2 tests: OK');
})().catch(error => { console.error(error); process.exitCode = 1; });
