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

  // C15 extends C14 cases to serialized diagnostics and raw device/ICE identity.
  const reconciliationCases = [
    { input: 'Authorization: Basic c15-private-basic', forbidden: ['c15-private-basic'] },
    { input: '{"token":"c15-json-token","credential":"c15-json-credential"}', forbidden: ['c15-json-token', 'c15-json-credential'] },
    { input: '{\\"recoveryToken\\":\\"c15-escaped-token\\"}', forbidden: ['c15-escaped-token'] },
    { input: 'password="c15 password with spaces"', forbidden: ['c15 password with spaces'] },
    { input: 'deviceId=c15-device-identity group_id=c15-group-identity', forbidden: ['c15-device-identity', 'c15-group-identity'] },
    { input: '{"device_id":"c15-json-device","groupId":"c15-json-group"}', forbidden: ['c15-json-device', 'c15-json-group'] },
    { input: 'ICE username=c15-turn-user ice_ufrag=c15-ufrag ice-pwd:c15-ice-password', forbidden: ['c15-turn-user', 'c15-ufrag', 'c15-ice-password'] },
    { input: 'https:\\/\\/user:pass@example.invalid/private/c15-url-token?token=secret', forbidden: ['user:pass', 'c15-url-token', 'example.invalid'] },
    { input: 'turn:alice:c15-turn-password@example.invalid:3478?transport=udp', forbidden: ['c15-turn-password', 'example.invalid'] },
    { input: 'blob:https://example.invalid/c15-blob-id', forbidden: ['c15-blob-id', 'example.invalid'] },
    { input: 'data:image/png;base64,c15-private-image', forbidden: ['c15-private-image'] },
    { input: '[2001:db8::1234]:3478', forbidden: ['2001:db8', '1234', '3478'] },
    { input: 'fe80::abcd%eth0', forbidden: ['fe80', 'abcd', 'eth0'] },
    { input: '::ffff:192.0.2.39', forbidden: ['::ffff', '192.0.2.39'] },
    { input: 'candidate:c15-foundation 1 udp 2122260223 c15-private-host.local 54321 typ host', forbidden: ['c15-foundation', 'c15-private-host.local', '54321'] },
    { input: 'prefix a=candidate:c15-inline 1 udp 1 c15-inline-host.local 55123 typ host', forbidden: ['c15-inline', 'c15-inline-host.local', '55123'] },
    { input: '{"sdp":"v=0\\r\\no=- 1 2 IN IP4 203.0.113.29\\r\\nm=video 9 UDP/TLS/RTP/SAVPF 96\\r\\na=ice-pwd:c15-sdp-secret"}', forbidden: ['v=0', '203.0.113.29', 'c15-sdp-secret'] },
    { input: 'v=0\ro=- 1 2 IN IP6 2001:db8::39\rm=video 9 UDP/TLS/RTP/SAVPF 96\ra=ice-ufrag:c15-cr-secret', forbidden: ['v=0', '2001:db8', 'c15-cr-secret'] },
    { input: 'a=extmap:3 urn:ietf:params:rtp-hdrext:c15-session-extension', forbidden: ['c15-session-extension'] },
    { input: 'a=ice-pwd:c15-single-escaped\\n', forbidden: ['c15-single-escaped'] }
  ];
  for (const { input, forbidden } of reconciliationCases) {
    const cleaned = String(diagnostics.sanitize(input));
    for (const marker of forbidden) assert(!cleaned.includes(marker), 'C15 private value survived sanitation: ' + marker);
    assert(cleaned.length <= diagnostics.LIMITS.messageChars);
  }
  const identity = diagnostics.sanitize({
    deviceId: 'c15-raw-device', device_id: 'c15-underscore-device', groupId: 'c15-raw-group',
    username: 'c15-raw-username', iceUfrag: 'c15-raw-ufrag', ice_pwd: 'c15-raw-ice-password',
    candidate: 'c15-raw-candidate', rawCandidate: 'c15-raw-foundation',
    iceServers: [{ urls: 'turn:example.invalid', credential: 'c15-raw-turn-secret' }],
    nested: { values: ['deviceId=c15-array-device', 'cookie=c15-array-cookie'], fps: 30 },
    selectedCameraId: 'camera-1', localCandidateType: 'relay', reason: 'Connexion stable'
  });
  assert.deepEqual(identity, { nested: { values: ['[SECRET REDACTED]', '[SECRET REDACTED]'], fps: 30 }, selectedCameraId: 'camera-1', localCandidateType: 'relay', reason: 'Connexion stable' });
  const keys = diagnostics.sanitize({ 'https://example.invalid/c15-key-secret': 'error', 'connect 203.0.113.39': 'timeout' });
  assert.doesNotMatch(JSON.stringify(keys), /c15-key-secret|203\.0\.113\.39/);
  const prototype = diagnostics.sanitize(JSON.parse('{"__proto__":{"private":"c15-prototype"},"constructor":{"private":"c15-constructor"},"fps":30}'));
  assert.deepEqual(prototype, { fps: 30 });
  for (const readableValue of ['Connexion retablie apres 2 tentatives.', 'fps=30, bitrate=850, rtt=0.02', 'Heure 10:30:00 ; SHA abcdef1234 ; camera-1', 'candidate-qualified', 'relay', 'udp']) assert.equal(diagnostics.sanitize(readableValue), readableValue);
  for (const { input, forbidden } of reconciliationCases) {
    diagnostics.reset();
    diagnostics.recordNetworkEvent('rtc-recovery', { state: input, reason: input });
    const protectedReport = await diagnostics.build(legacy({
      events: [{ type: 'vision-error', data: { reason: input, message: input } }],
      vision: { enabledForGame: true, assetsError: input, identification: {}, libraryIntegrity: { failed: [{ id: 'card-1', reason: input }] } }
    }), { environment: input, timezone: input, database: { sourceRef: input } });
    const serialized = JSON.stringify(protectedReport);
    for (const marker of forbidden) assert(!serialized.includes(marker), 'C15 report private value survived: ' + marker);
  }

  const appSource = fs.readFileSync('public/app.js', 'utf8');
  const indexSource = fs.readFileSync('public/index.html', 'utf8');
  assert(indexSource.indexOf('/report-diagnostics-v2.js') < indexSource.indexOf('/app.js'));
  assert.match(appSource, /try \{[\s\S]*TCGateReportDiagnosticsV2\.build/);
  assert.match(appSource, /maxReportBytes = 768 \* 1024/);
  assert.match(appSource, /report\.events = report\.events\.slice\(-256\)/);
  console.log('Report Schema V2 tests: OK');
})().catch(error => { console.error(error); process.exitCode = 1; });
