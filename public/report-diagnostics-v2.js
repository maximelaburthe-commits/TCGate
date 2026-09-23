(function initReportDiagnosticsV2(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TCGateReportDiagnosticsV2 = api;
})(typeof window !== 'undefined' ? window : globalThis, function createReportDiagnosticsV2() {
  'use strict';

  const LIMITS = Object.freeze({ networkEvents: 64, visionErrors: 24, databaseProblems: 32, messageChars: 240, testerFeedbackEntries: 10, cardNameChars: 120, testerNoteChars: 500, sectionBytes: 96 * 1024, totalBytes: 384 * 1024 });
  const TESTER_FEEDBACK_TYPES = new Set(['not_recognized', 'wrong_identification', 'unstable_identification']);
  const NETWORK_EVENTS = /^(rtc-(connection-state|ice-state|signaling-state|restart-request-received|offer-generation-rebuild|offer-delivery-failed|recovery|recovery-success|recovery-failed)|room-recover|sse-(open|error|reconnect))/;
  const SECRET_KEY = /(authorization|cookie|password|secret|token|credential|icecandidate|candidate(raw|string)|sdp|address|ip$|url$)/i;
  const URL_TEXT = /\b(?:https?|wss?):\/\/[^\s"'<>]+/gi;
  const IPV4 = /\b(?:\d{1,3}\.){3}\d{1,3}(?::\d{1,5})?\b/g;
  const IPV6_CANDIDATE = /(^|[^a-f0-9:])([a-f0-9:]{2,})(?=$|[^a-f0-9:])/gi;
  const SECRET_TEXT = /\b(?:authorization\s*:\s*bearer|bearer|set-cookie\s*:|cookie\s*[:=]|(?:session|recovery)?token\s*[:=]|password\s*[:=]|secrets?\s*[:=]|credentials?\s*[:=]|ice-(?:pwd|ufrag)\s*:)\s*[^\s,;]+(?:\s*;\s*[^\r\n]*)?/gi;
  const SDP_LINE = /^\s*(?:v=0|o=-?\s|s=-?\s*$|i=\S|u=\S|e=\S|p=\S|c=IN\s+IP[46]\s|b=[A-Z]+:|t=\d+\s+\d+|r=\d|z=\d|k=\S|m=(?:audio|video|application)\s|a=(?:candidate:|ice-ufrag:|ice-pwd:|fingerprint:|setup:|mid:|rtpmap:|fmtp:|rtcp:|sendrecv|sendonly|recvonly|inactive))/i;

  const number = value => Number.isFinite(Number(value)) ? Number(value) : null;
  function validIpv6(value) {
    if (!value.includes(':') || !/^[a-f0-9:]+$/i.test(value) || (value.match(/::/g) || []).length > 1) return false;
    const compressed = value.includes('::');
    const groups = value.split(':').filter(Boolean);
    return groups.every(group => group.length <= 4) && (compressed ? groups.length < 8 : groups.length === 8);
  }
  function redactIpv6(value) {
    return value.replace(IPV6_CANDIDATE, (match, prefix, candidate) => validIpv6(candidate) ? `${prefix}[IP REDACTED]` : match);
  }
  function containsSdp(value) {
    const lines = value.split(/\r?\n/);
    const signatures = lines.filter(line => SDP_LINE.test(line)).length;
    return signatures >= 2 || (/\bv=0(?:\s|$)/i.test(value) && /(?:\bo=-?\s|\bm=(?:audio|video|application)\s|\ba=(?:candidate:|ice-ufrag:|ice-pwd:|fingerprint:))/i.test(value));
  }
  function text(value, maxChars = LIMITS.messageChars) {
    if (value == null) return null;
    let clean = String(value);
    if (containsSdp(clean)) return '[SDP REDACTED]';
    clean = clean.split(/\r?\n/).map(line => SDP_LINE.test(line) ? '[SDP REDACTED]' : line).join('\n');
    clean = clean.replace(URL_TEXT, '[URL REDACTED]');
    clean = clean.replace(SECRET_TEXT, '[SECRET REDACTED]');
    clean = clean.replace(/\ba=candidate:[^\r\n]*/gi, '[ICE CANDIDATE REDACTED]');
    clean = clean.replace(IPV4, '[IP REDACTED]');
    clean = redactIpv6(clean);
    return clean.slice(0, maxChars);
  }
  function normalizeTesterFeedback(entries) {
    if (!Array.isArray(entries)) return [];
    const normalized = [];
    for (const entry of entries) {
      if (normalized.length >= LIMITS.testerFeedbackEntries) break;
      if (!entry || !TESTER_FEEDBACK_TYPES.has(entry.issueType)) continue;
      const cardName = text(entry.cardName, LIMITS.cardNameChars)?.trim();
      if (!cardName) continue;
      const recognizedAs = entry.issueType === 'wrong_identification'
        ? (text(entry.recognizedAs, LIMITS.cardNameChars)?.trim() || null)
        : null;
      normalized.push({ issueType: entry.issueType, cardName, recognizedAs, note: text(entry.note, LIMITS.testerNoteChars)?.trim() || '' });
    }
    return normalized;
  }
  function addTesterFeedback(report, entries) {
    if (!report?.vision || typeof report.vision !== 'object') return report;
    delete report.vision.testerFeedback;
    const feedback = normalizeTesterFeedback(entries);
    if (feedback.length) report.vision.testerFeedback = feedback;
    return report;
  }
  const sum = values => values.map(number).filter(value => value != null).reduce((total, value) => total + value, 0);
  const percentile = (values, ratio) => {
    const sorted = values.map(number).filter(value => value != null).sort((a, b) => a - b);
    return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio))] : null;
  };
  function bounded(items, limit) {
    const list = Array.isArray(items) ? items : [];
    return { items: list.slice(-limit), totalItems: list.length, retainedItems: Math.min(list.length, limit), truncated: list.length > limit };
  }
  function sanitize(value, depth = 0) {
    if (depth > 7) return '[TRUNCATED]';
    if (typeof value === 'string') return text(value);
    if (typeof value === 'number' || typeof value === 'boolean' || value == null) return value;
    if (Array.isArray(value)) return value.slice(0, 128).map(item => sanitize(item, depth + 1));
    if (typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => !SECRET_KEY.test(key)).map(([key, item]) => [key, sanitize(item, depth + 1)]));
    return null;
  }
  function section(value) {
    const clean = sanitize(value);
    const json = JSON.stringify(clean);
    if (json.length <= LIMITS.sectionBytes) return clean;
    return { status: 'truncated', truncated: true, originalBytes: json.length, retainedSummary: sanitize(value?.summary || {}) };
  }
  function browserInfo(userAgent = '') {
    const match = String(userAgent).match(/(Edg|Chrome|Firefox|Version)\/([\d.]+)/);
    return { name: match?.[1] === 'Version' ? 'Safari' : match?.[1] || null, version: match?.[2] || null };
  }
  function osInfo(userAgent = '', platform = '') {
    const ua = String(userAgent);
    if (/Windows NT/i.test(ua)) return 'Windows';
    if (/Android/i.test(ua)) return 'Android';
    if (/iPhone|iPad/i.test(ua)) return 'iOS';
    if (/Mac OS X/i.test(ua)) return 'macOS';
    if (/Linux/i.test(ua)) return 'Linux';
    return text(platform);
  }
  async function pseudonym(value) {
    const input = String(value || 'unavailable');
    try {
      if (globalThis.crypto?.subtle) {
        const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
        return [...new Uint8Array(digest)].slice(0, 12).map(byte => byte.toString(16).padStart(2, '0')).join('');
      }
    } catch {}
    let hash = 2166136261;
    for (const char of input) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
    return `local-${(hash >>> 0).toString(16).padStart(8, '0')}`;
  }

  const networkTimeline = [];
  let networkEventsTotal = 0;
  let disconnectedSince = null;
  let disconnectedDurationMs = 0;
  let iceRestarts = 0;
  let reconnectionAttempts = 0;
  function recordNetworkEvent(type, data = {}, atMs = Date.now()) {
    if (!NETWORK_EVENTS.test(String(type))) return false;
    networkEventsTotal += 1;
    const stateValue = data?.state || null;
    if (type === 'rtc-connection-state' && /disconnected|failed/.test(stateValue) && disconnectedSince == null) disconnectedSince = atMs;
    if (type === 'rtc-connection-state' && stateValue === 'connected' && disconnectedSince != null) { disconnectedDurationMs += Math.max(0, atMs - disconnectedSince); disconnectedSince = null; }
    if (/restart-request|ice-restart|offer-generation-rebuild/.test(type)) iceRestarts += 1;
    if (/recovery|reconnect/.test(type) && !/success|failed/.test(type)) reconnectionAttempts += 1;
    networkTimeline.push({ at: new Date(atMs).toISOString(), type: text(type), state: text(stateValue), generation: number(data?.generation), reason: text(data?.reason) });
    if (networkTimeline.length > LIMITS.networkEvents) networkTimeline.splice(0, networkTimeline.length - LIMITS.networkEvents);
    return true;
  }
  function reset() { networkTimeline.length = 0; networkEventsTotal = 0; disconnectedSince = null; disconnectedDurationMs = 0; iceRestarts = 0; reconnectionAttempts = 0; }

  function collectNetwork(legacy = {}) {
    const rtc = legacy.network?.webrtc || {};
    const inbound = Array.isArray(rtc.inbound) ? rtc.inbound : [];
    const outbound = Array.isArray(rtc.outbound) ? rtc.outbound : [];
    const tracks = [...inbound, ...outbound].map(track => ({ direction: inbound.includes(track) ? 'inbound' : 'outbound', kind: text(track.kind || track.mediaType), packets: number(track.packetsReceived ?? track.packetsSent), packetsLost: number(track.packetsLost), bytes: number(track.bytesReceived ?? track.bytesSent), jitter: number(track.jitter), frames: number(track.framesDecoded ?? track.framesEncoded), framesDropped: number(track.framesDropped), fps: number(track.framesPerSecond), width: number(track.frameWidth), height: number(track.frameHeight), bitrateKbps: number(track.bitrateKbps), qualityLimitationReason: text(track.qualityLimitationReason) }));
    for (const track of [legacy.media?.localVideo, legacy.media?.localAudio, ...(legacy.media?.remoteTracks || [])].filter(Boolean)) tracks.push({ direction: (legacy.media?.remoteTracks || []).includes(track) ? 'remote' : 'local', kind: text(track.kind), readyState: text(track.readyState), enabled: typeof track.enabled === 'boolean' ? track.enabled : null, muted: typeof track.muted === 'boolean' ? track.muted : null, width: number(track.width), height: number(track.height), fps: number(track.frameRate) });
    const available = rtc.available === true || Boolean(rtc.connectionState || rtc.iceConnectionState || inbound.length || outbound.length);
    return section({ status: available ? 'available' : 'unavailable', summary: { connectionState: text(rtc.connectionState), iceConnectionState: text(rtc.iceConnectionState), iceGatheringState: text(rtc.iceGatheringState), signalingState: text(rtc.signalingState), route: rtc.route?.usingRelay === true ? 'turn' : rtc.route?.usingRelay === false ? 'direct' : null, localCandidateType: text(rtc.route?.localCandidateType), remoteCandidateType: text(rtc.route?.remoteCandidateType), protocol: text(rtc.route?.relayProtocol || rtc.route?.localProtocol || rtc.route?.remoteProtocol), currentRttSeconds: number(rtc.candidatePair?.currentRoundTripTime), jitter: inbound.length ? Math.max(...inbound.map(item => number(item.jitter)).filter(value => value != null), 0) : null, availableOutgoingBitrate: number(rtc.candidatePair?.availableOutgoingBitrate), packetsReceived: sum(inbound.map(item => item.packetsReceived)), packetsSent: sum(outbound.map(item => item.packetsSent)), packetsLost: sum(inbound.map(item => item.packetsLost)), bytesReceived: sum(inbound.map(item => item.bytesReceived)), bytesSent: sum(outbound.map(item => item.bytesSent)), framesDecoded: sum(inbound.map(item => item.framesDecoded)), framesEncoded: sum(outbound.map(item => item.framesEncoded)), framesDropped: sum(inbound.map(item => item.framesDropped)), inboundBitrateKbps: sum(inbound.map(item => item.bitrateKbps)), outboundBitrateKbps: sum(outbound.map(item => item.bitrateKbps)), iceRestarts, reconnectionAttempts, disconnectedOrFailedDurationMs: disconnectedDurationMs + (disconnectedSince == null ? 0 : Math.max(0, Date.now() - disconnectedSince)) }, tracks: bounded(tracks, 12), timeline: { items: sanitize(networkTimeline), totalItems: networkEventsTotal, retainedItems: networkTimeline.length, truncated: networkEventsTotal > networkTimeline.length } });
  }

  function collectVision(legacy = {}) {
    const vision = legacy.vision || {}, ident = vision.identification || {}, detector = vision.detector || {}, scheduling = ident.scheduling || {};
    const events = (legacy.events || []).filter(event => /vision|identification|worker|calibration/i.test(event?.type || ''));
    const errors = events.filter(event => /error|reject|unavailable|timeout/i.test(event?.type || '')).map(event => ({ at: text(event.at), type: text(event.type), reason: text(event.data?.reason), message: text(event.data?.message) }));
    const timings = [ident.matcherMs, scheduling.visionIdentificationP50, scheduling.visionIdentificationP95, detector.inference?.inferenceMs].map(number).filter(value => value != null);
    return section({ status: vision.enabledForGame === false ? 'inactive' : vision.assetsError ? 'error' : vision.assetsLoaded ? 'active' : 'unavailable', summary: { version: text(vision.profile || detector.version), workerVersion: text(ident.matcherWorker?.version), modelVersion: text(detector.modelVersion || detector.provider), game: text(legacy.session?.game), receivedResolution: { width: number(legacy.media?.remoteTracks?.find(track => track.kind === 'video')?.width), height: number(legacy.media?.remoteTracks?.find(track => track.kind === 'video')?.height) }, analyzedResolution: { width: number(detector.inference?.inputWidth), height: number(detector.inference?.inputHeight) }, receivedFps: number(legacy.network?.webrtc?.inbound?.find(track => track.kind === 'video')?.framesPerSecond), analyzedFps: number(detector.inference?.fps), framesReceived: number(legacy.network?.webrtc?.inbound?.find(track => track.kind === 'video')?.framesDecoded), framesAnalyzed: number(scheduling.visionFramesProcessed), framesDropped: number(scheduling.visionFramesDropped), processingMeanMs: timings.length ? sum(timings) / timings.length : null, processingMaxMs: timings.length ? Math.max(...timings) : null, processingP50Ms: number(scheduling.visionIdentificationP50 ?? percentile(timings, .5)), processingP95Ms: number(scheduling.visionIdentificationP95 ?? percentile(timings, .95)), detections: number(detector.activeCards), identifications: number(ident.identityStability?.stableRefreshes), nonIdentifications: errors.filter(item => /reject|identification/i.test(item.type)).length, candidatesGenerated: number(ident.matcherTiming?.candidates), confidence: { last: number(ident.lastResult?.confidence), threshold: number(ident.threshold) }, rejectionReasons: sanitize(ident.qualityGuard?.rejects || ident.hoverCache?.rejects || {}), workerErrors: errors.filter(item => /worker|error/i.test(item.type)).length, workerRestarts: events.filter(event => /worker.*restart/i.test(event.type || '')).length, fallbackUsed: Boolean(ident.database?.fallbackActive), unavailableDurationMs: null }, errors: bounded(errors, LIMITS.visionErrors) });
  }

  function collectDatabase(legacy = {}, databaseConfig = {}) {
    const ident = legacy.vision?.identification || {}, db = ident.database || {}, integrity = legacy.vision?.libraryIntegrity || ident.libraryIntegrity || {}, performance = ident.libraryPerformance || {};
    const problems = [];
    for (const item of integrity.failed || []) problems.push({ id: text(item?.id || item?.printingId), kind: 'missing-asset', reason: text(item?.reason || item?.message) });
    if (legacy.vision?.assetsError) problems.push({ id: null, kind: 'load-error', reason: text(legacy.vision.assetsError) });
    return section({ status: db.databaseVersion || ident.libraryReady ? 'available' : 'unavailable', summary: { game: text(db.databaseGame || legacy.session?.game), phase: text(databaseConfig.runtimeScope || db.databaseStatus), version: text(db.databaseVersion), sha: text(databaseConfig.sourceCommit), manifestVersion: text(databaseConfig.manifestVersion), checksum: text(databaseConfig.checksum), provider: text(db.databaseSource), sourceRef: text(databaseConfig.sourceRef), setsLoaded: number(databaseConfig.setsLoaded), cards: number(db.canonicalCount || ident.librarySize), assets: number(db.visionReferenceCount || ident.librarySize), imagesAvailable: number(integrity.loadedReferences), imagesMissing: number(integrity.failedReferences), cacheUsed: performance.cacheStatus === 'hit', cacheStatus: text(performance.cacheStatus), cacheAgeMs: number(performance.cacheAgeMs), loadMode: performance.cacheStatus === 'hit' ? 'cache' : performance.networkRequests > 0 ? 'network' : null, fallbackUsed: Boolean(db.fallbackActive), loadDurationMs: number(performance.databaseLoadMs), responseBytes: number(performance.networkBytes), jsonValid: legacy.vision?.assetsError ? false : db.databaseVersion ? true : null, manifestValid: db.databaseStatus ? true : null, httpErrors: problems.filter(item => item.kind === 'http-error').length, timeouts: problems.filter(item => item.kind === 'timeout').length, oversizedResponses: 0, invalidJson: legacy.vision?.assetsError && /json/i.test(legacy.vision.assetsError) ? 1 : 0, inconsistentManifest: 0, unknownIds: 0, missingCards: number(integrity.missingCards), missingImages: number(integrity.failedReferences), lookupFound: number(ident.identityStability?.stableRefreshes), lookupMissing: number(ident.qualityGuard?.rejected), lookupAmbiguous: number(ident.identityStability?.switchesSuppressed) }, problems: bounded(problems, LIMITS.databaseProblems) });
  }

  async function build(legacy, context = {}) {
    const generatedAt = legacy.generatedAt || new Date().toISOString();
    const ua = context.userAgent || legacy.environment?.userAgent || '';
    const collectors = await Promise.allSettled([
      Promise.resolve().then(() => collectNetwork(legacy)),
      Promise.resolve().then(() => collectVision(legacy)),
      Promise.resolve().then(() => collectDatabase(legacy, context.database || {}))
    ]);
    const fallback = reason => ({ status: 'error', error: text(reason?.message || reason) });
    const report = { reportSchemaVersion: 2, envelope: { tcgateVersion: text(legacy.version), buildSha: text(context.buildSha), environment: text(context.environment || legacy.environment?.page?.hostname), reportSchemaVersion: 2, sessionId: await pseudonym(context.sessionSeed || `${legacy.session?.roomCode}|${legacy.session?.startedAt}`), role: text(legacy.session?.role), browser: browserInfo(ua), operatingSystem: osInfo(ua, legacy.environment?.platform), capturedAt: generatedAt, timezone: text(context.timezone), timezoneOffsetMinutes: number(context.timezoneOffsetMinutes), game: text(legacy.session?.game), mode: legacy.session?.game === 'none' ? 'no-game' : 'tcg' }, diagnostics: { network: collectors[0].status === 'fulfilled' ? collectors[0].value : fallback(collectors[0].reason), vision: collectors[1].status === 'fulfilled' ? collectors[1].value : fallback(collectors[1].reason), database: collectors[2].status === 'fulfilled' ? collectors[2].value : fallback(collectors[2].reason) }, limits: LIMITS, privacy: { userJourneyCollected: false, audiovisualContentIncluded: false, fullIpAddressesIncluded: false, sdpIncluded: false, rawCandidatesIncluded: false, secretsIncluded: false } };
    const size = JSON.stringify(report).length;
    report.size = { estimatedBytes: size, maxBytes: LIMITS.totalBytes, truncated: size > LIMITS.totalBytes };
    if (size > LIMITS.totalBytes) report.diagnostics = Object.fromEntries(Object.entries(report.diagnostics).map(([key, value]) => [key, { status: value.status, summary: value.summary, truncated: true }]));
    return report;
  }

  return Object.freeze({ LIMITS, sanitize, normalizeTesterFeedback, addTesterFeedback, bounded, recordNetworkEvent, reset, collectNetwork, collectVision, collectDatabase, build });
});
