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
  const appSource = fs.readFileSync('public/app.js', 'utf8');
  const indexSource = fs.readFileSync('public/index.html', 'utf8');
  assert(indexSource.indexOf('/report-diagnostics-v2.js') < indexSource.indexOf('/app.js'));
  assert.match(appSource, /try \{[\s\S]*TCGateReportDiagnosticsV2\.build/);
  assert.match(appSource, /maxReportBytes = 768 \* 1024/);
  assert.match(appSource, /report\.events = report\.events\.slice\(-256\)/);
  console.log('Report Schema V2 tests: OK');
})().catch(error => { console.error(error); process.exitCode = 1; });
