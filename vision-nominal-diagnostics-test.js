'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const publicRoot = fs.existsSync(path.join(__dirname, 'public', 'vision-qualification-diagnostics.js')) ? path.join(__dirname, 'public') : __dirname;
const api = require(path.join(publicRoot, 'vision-qualification-diagnostics.js'));
const contract = require(path.join(__dirname, 'workspace-production-contract.js'));
let checks = 0;
const check = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++; };
const refs = [
  { cardId: 'cp-a', printingId: 'cpp-a', refId: 'cprg-a:cpp-a', locale: 'en', candidatePrintingIds: ['cpp-a'] },
  { cardId: 'cp-b', printingId: null, referencePrintingId: 'cpp-b', refId: 'cprg-b:cpp-b', locale: 'en', candidatePrintingIds: ['cpp-b', 'cpp-b-alt'] },
  { cardId: 'cp-c', printingId: 'cpp-c', refId: 'cprg-c:cpp-c', locale: 'fr', candidatePrintingIds: ['cpp-c'] }
];
const base = () => ({ attemptId: 1, atMs: 200, requestStartedAtMs: 150, trackUid: 7,
  candidates: [{ rank: 1, cardId: 'cp-a', printingId: 'cpp-a', refId: 'cprg-a:cpp-a', matcherScore: .30 },
    { rank: 2, cardId: 'cp-b', printingId: null, refId: 'cprg-b:cpp-b', matcherScore: .29 }],
  bestScore: .30, secondScore: .29, margin: .01, matcherAccepted: false, finalAccepted: false,
  rejectionReason: 'uncertain', mode: 'normal',
  thresholds: { normalScore: .235, normalMargin: .075, lowScore: .185, lowMargin: .135 },
  quality: { risk: 'normal', clippedFraction: 0, brightFraction: .02, maxBlockClip: .02, detail: .1 },
  temporal: { action: 'render', stableCardId: null, pendingCardId: null, pendingCount: 0, uncertainAgeMs: 0 },
  trackMisses: 0, activeTrackCount: 1 });
const options = { references: refs, expectedCardId: 'cp-b', t0Ms: 100, endMs: 300 };
const margin = api.sanitizeAttempt(base(), options);
check(margin.expectedScore, .29, 'Expected score comes from the existing ranked candidates');
check(margin.expectedRank, 2);
check(margin.rejectionCauses, ['EXPECTED_NOT_FIRST', 'MARGIN_INSUFFICIENT']);
check(margin.bestScore, .30); check(margin.secondScore, .29); check(margin.margin, .01);
check(margin.thresholds, base().thresholds, 'Observed constants are retained; never replaced');
check(margin.validationErrors, []);
const scoreRaw = base(); scoreRaw.bestScore = .12; scoreRaw.margin = .1;
check(api.sanitizeAttempt(scoreRaw, options).rejectionCauses.includes('SCORE_INSUFFICIENT'), true);
check(api.sanitizeAttempt(scoreRaw, options).rejectionCauses.includes('MARGIN_INSUFFICIENT'), false);
const lowRaw = base(); lowRaw.bestScore = .21; lowRaw.margin = .14;
check(api.sanitizeAttempt(lowRaw, options).rejectionCauses.includes('MARGIN_INSUFFICIENT'), false, 'Dual acceptance path remains an OR');
check(api.sanitizeAttempt(lowRaw, options).rejectionCauses.includes('SCORE_INSUFFICIENT'), false);
const highRaw = base(); highRaw.rejectionReason = 'glare-high'; highRaw.quality.risk = 'high';
check(api.sanitizeAttempt(highRaw, options).rejectionCauses.includes('QUALITY_REJECTED'), true);
const temporalRaw = base(); temporalRaw.matcherAccepted = true; temporalRaw.temporal = { action: 'hold', stableCardId: 'cp-a', pendingCardId: 'cp-b', pendingCount: 1, required: 2, uncertainAgeMs: 40 };
check(api.sanitizeAttempt(temporalRaw, options).rejectionCauses, ['EXPECTED_NOT_FIRST', 'STABILITY_INSUFFICIENT']);
check(api.sanitizeAttempt(temporalRaw, options).temporal.pendingCount, 1);
check(api.sanitizeAttempt(temporalRaw, options).temporal.stableCardId, 'cp-a');
const expired = base(); expired.rejectionReason = 'temporal-unstable';
check(api.sanitizeAttempt(expired, options).rejectionCauses.includes('STABILITY_INSUFFICIENT'), true);
const missing = base(); missing.candidates = [missing.candidates[0]];
check(api.sanitizeAttempt(missing, options).expectedScore, null);
check(api.sanitizeAttempt(missing, options).expectedRank, null);
check(api.sanitizeAttempt(missing, options).expectedScoreStatus, 'NOT_AVAILABLE_IN_EXISTING_RANKED_CANDIDATES');
check(api.sanitizeAttempt(missing, options).rejectionCauses.includes('EXPECTED_NOT_IN_RANKED_CANDIDATES'), true);
const crossed = base(); crossed.requestStartedAtMs = 90;
check(api.sanitizeAttempt(crossed, options), null, 'A result started before B T0 cannot be assigned to B');
const late = base(); late.atMs = 301;
check(api.sanitizeAttempt(late, options), null, 'A result completed after trial end cannot be assigned');
const backwards = base(); backwards.requestStartedAtMs = 201;
check(api.sanitizeAttempt(backwards, options), null);
check(api.sanitizeAttempt(base(), { ...options, expectedCardId: 'cp-unknown' }), null);
check(api.sanitizeAttempt(base(), { ...options, expectedCardId: 'cp-c' }), null, 'FR expectation cannot enter an EN campaign');
for (const bad of [NaN, Infinity, -Infinity, null, '200']) {
  check(api.sanitizeAttempt({ ...base(), atMs: bad }, options), null);
}
const untrusted = base(); untrusted.candidates[1].refId = 'unknown-ref';
const cleanUnknown = api.sanitizeAttempt(untrusted, options);
check(cleanUnknown.candidates.length, 1);
check(cleanUnknown.validationErrors, ['UNKNOWN_OR_INVALID_REFERENCE']);
check(api.sanitizeAttempt(cleanUnknown, options).validationErrors, ['UNKNOWN_OR_INVALID_REFERENCE']);
const crossLocale = base(); crossLocale.candidates.push({ cardId: 'cp-c', printingId: 'cpp-c', refId: 'cprg-c:cpp-c', matcherScore: .1 });
check(api.sanitizeAttempt(crossLocale, options).validationErrors, ['UNKNOWN_OR_INVALID_REFERENCE']);
const scalarLeak = base(); scalarLeak.media = 'data:image/jpeg;base64,PRIVATE'; scalarLeak.image = 'https://secret.invalid/card.png';
scalarLeak.candidates[0].image = scalarLeak.image; scalarLeak.candidates[0].descriptor = new Float32Array([1, 2]);
scalarLeak.quality.crop = scalarLeak.media; scalarLeak.quality.brightFraction = 2;
scalarLeak.temporal.deviceId = 'PRIVATE-DEVICE'; scalarLeak.temporal.pendingCardId = 'private-user-name';
scalarLeak.visibleIdentityBeforeRender = { present: true, cardId: 'private-user-name', ageMs: 70, image: scalarLeak.image };
scalarLeak.trackUid = 'PRIVATE-DEVICE'; scalarLeak.rejectionReason = 'PRIVATE-FREE-TEXT'; scalarLeak.mode = 'PRIVATE-FREE-TEXT';
const cleanLeak = api.sanitizeAttempt(scalarLeak, options), json = JSON.stringify(cleanLeak);
check(/PRIVATE|https:|data:image|descriptor|deviceId|crop|\.png/.test(json), false, 'Only explicitly whitelisted scalars can escape');
check(cleanLeak.trackUid, null); check(cleanLeak.temporal.pendingCardId, null);
check(cleanLeak.visibleIdentityBeforeRender.cardId, null); check(cleanLeak.visibleIdentityBeforeRender.ageMs, 70);
check(cleanLeak.rejectionReason, 'other'); check(cleanLeak.mode, 'other'); check(cleanLeak.quality.brightFraction, null);
const many = base(); many.candidates = Array.from({ length: 20 }, () => base().candidates[0]);
check(api.sanitizeAttempt(many, options).candidates.length, 5);
const trial = { expectedCardId: 'cp-b', t0Ms: 100, endMs: 300,
  attemptDiagnostics: [base(), crossed, late], attemptDiagnosticsTruncated: true, attemptDiagnosticsDropped: 2 };
const report = api.sanitizeTrialDiagnostics(trial, { references: refs });
check(report.recorded, 1); check(report.rejected, 2); check(report.truncated, true); check(report.dropped, 2);
check(report.attempts[0].expectedScore, .29);
check(api.sanitizeTrialDiagnostics({}, { references: refs }).attempts, []);
check(api.sanitizeTrialDiagnostics({}, { references: refs }).states, [], 'Legacy exports do not invent runtime-state evidence');
const absentState = { pointerInsideStage: null, hoveredTrackUid: null, activeTrackUids: null,
  activeTrackCount: null, matcherBusy: null, matcherQueued: null, temporalEventType: null, visibleSource: null };
check(api.sanitizeRuntimeState(null), absentState, 'Unavailable APIs remain null, not false or zero');
check(api.sanitizeRuntimeState({ activeTrackUids: [] }).activeTrackUids, [], 'An observed empty list differs from an unavailable API');
const state = { pointerInsideStage: true, hoveredTrackUid: 7, activeTrackUids: [9, 7, 9],
  activeTrackCount: 2, matcherBusy: false, matcherQueued: true, temporalEventType: 'stable-held', visibleSource: 'TABLE_MEMORY' };
const safeState = api.sanitizeRuntimeState(state);
check(safeState, { ...state, activeTrackUids: [7, 9] });
check(state.activeTrackUids, [9, 7, 9], 'Sanitization does not mutate runtime arrays');
const privateState = { ...state, pointerInsideStage: 'PRIVATE', hoveredTrackUid: 'PRIVATE-DEVICE',
  activeTrackUids: [3, 'PRIVATE', NaN, Infinity, -2, 4.2, 1, 3], activeTrackCount: 3.1,
  matcherBusy: 1, matcherQueued: 'false', temporalEventType: 'PRIVATE-TEXT', visibleSource: 'PRIVATE',
  deviceId: 'PRIVATE-DEVICE', x: 99, y: 88, crop: 'data:image/png;base64,PRIVATE',
  name: 'PRIVATE-NAME', image: 'https://secret.invalid/card.png' };
check(api.sanitizeRuntimeState(privateState), { ...absentState, activeTrackUids: [1, 3] });
check(/PRIVATE|device|image|crop|"x"|"y"|name|https:/.test(JSON.stringify(api.sanitizeRuntimeState(privateState))), false);
check(api.sanitizeRuntimeState({ activeTrackUids: Array.from({ length: 50 }, (_, i) => 50 - i) }).activeTrackUids,
  Array.from({ length: 32 }, (_, i) => i + 1), 'Runtime UID lists are unique, sorted, numeric and bounded');
for (const event of api.TEMPORAL_EVENT_TYPES) check(api.sanitizeRuntimeState({ temporalEventType: event }).temporalEventType, event);
const stateTrial = { t0Ms: 100, endMs: 300, observations: [
  { atMs: 99, runtimeState: state }, { atMs: 100, runtimeState: state }, { atMs: 200, runtimeState: {} },
  { atMs: 250 }, { atMs: 300, runtimeState: privateState }, { atMs: 301, runtimeState: state },
  { atMs: NaN, runtimeState: state }, { atMs: '200', runtimeState: state }, { atMs: -1, runtimeState: state }
] };
const stateProjection = api.sanitizeTrialDiagnostics(stateTrial, { references: refs }).states;
check(stateProjection.map(value => value.atMs), [100, 200, 300], 'Only measured runtime states inside the exact trial interval survive');
check(stateProjection[0], { atMs: 100, ...safeState });
check(stateProjection[1], { atMs: 200, ...absentState });
check(stateProjection[2], { atMs: 300, ...absentState, activeTrackUids: [1, 3] });
check(/PRIVATE|device|image|crop|"x"|"y"|name|https:/.test(JSON.stringify(stateProjection)), false);

// Real optional tap, before HOLD return; stripping this exact tap must reproduce
// the entire immutable production identification source at the 6A.1 baseline.
// Reverse only the reviewed exact 6C hunks, then run every historical 6B
// tap and 79-function fingerprint assertion unchanged against the real source.
const engine = require('./vision-6c-production-contract.js').normalizeIdentification6C(fs.readFileSync(path.join(publicRoot, 'identification.js'))).toString('utf8');
const tap = '\n    // Qualification-only scalar diagnostics; absent outside the Workspace workflow.\n' +
  '    window.TCGVisionQualificationDiagnostics?.observeAttempt({\n' +
  '      result,temporal,temporalEntry:state.identityStability.tracks.get(track.uid),\n' +
  '      visibleIdentityBeforeRender:state.visibleIdentity,references:state.refs,\n' +
  '      track,requestStartedAtMs:cropStarted,activeTrackCount:lab.activeTracks().length,\n' +
  '      thresholds:{normalScore:NORMAL_ACCEPT,normalMargin:NORMAL_MARGIN,lowScore:LOW_ACCEPT,lowMargin:LOW_MARGIN}\n' +
  '    });\n';
check(engine.split(tap).length, 2, 'Exactly one optional observation tap');
check(crypto.createHash('sha256').update(engine.replace(tap, '')).digest('hex'),
  'e85113774054c72e5c4add1f81606a09efc253f43c9a3045bf64a60d91c7bceb', 'All existing matcher and temporal code is unchanged');
check(engine.indexOf(tap) > engine.indexOf('const temporal=temporalIdentityGuard(track,result);'), true);
check(engine.indexOf(tap) < engine.indexOf("if(temporal.action==='hold')"), true, 'Held attempts are observed, even though no render event occurs');
const baselineEngine = engine.replace(tap, '');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const baselineAlgorithmHash = 'e5593e42a8dfd60a4d81850fb76c518c4212302906a1cd655fb3901cf9e18071';
check(contract.stripQualificationDiagnostics(Buffer.from(engine)).toString(), baselineEngine);
check(contract.stripQualificationDiagnostics(Buffer.from(baselineEngine)).toString(), baselineEngine);
check(contract.stripQualificationDiagnostics(Buffer.from(engine.replace(/\n/g, '\r\n'))).toString(), baselineEngine, 'Windows text conversion remains accepted');
check(hash(contract.productionIdentification(Buffer.from(engine))), baselineAlgorithmHash, 'All 79 existing protected functions keep their fingerprint');
check(hash(contract.productionIdentification(Buffer.from(baselineEngine))), baselineAlgorithmHash);
const changedTap = engine.replace('requestStartedAtMs:cropStarted', 'requestStartedAtMs:0');
check(contract.stripQualificationDiagnostics(Buffer.from(changedTap)).toString(), changedTap, 'A changed tap is not stripped');
check(hash(contract.stripQualificationDiagnostics(Buffer.from(changedTap))) === hash(Buffer.from(baselineEngine)), false);
check(hash(contract.productionIdentification(Buffer.from(changedTap))) === baselineAlgorithmHash, false, 'A changed tap fails the existing protected algorithm fingerprint');
const extraCode = engine.replace('    const temporal=temporalIdentityGuard(track,result);', '    result.accepted=true;\n    const temporal=temporalIdentityGuard(track,result);');
check(hash(contract.stripQualificationDiagnostics(Buffer.from(extraCode))) === hash(Buffer.from(baselineEngine)), false, 'Extra matcher code cannot hide behind the diagnostics exception');
check(hash(contract.productionIdentification(Buffer.from(extraCode))) === baselineAlgorithmHash, false);
const lowerThreshold = engine.replace('const NORMAL_ACCEPT = 0.235;', 'const NORMAL_ACCEPT = 0.234;');
check(hash(contract.stripQualificationDiagnostics(Buffer.from(lowerThreshold))) === hash(Buffer.from(baselineEngine)), false, 'A threshold change is retained for rejection');
check(hash(contract.productionIdentification(Buffer.from(lowerThreshold))) === baselineAlgorithmHash, false);
const lifecycleMutation = engine.replace('  function matcherWorkerPayload() {', '  function matcherWorkerPayload() {\n    state.ready=false;');
check(hash(contract.stripQualificationDiagnostics(Buffer.from(lifecycleMutation))) === hash(Buffer.from(baselineEngine)), false, 'Complete-file CLI comparison still protects lifecycle functions');
assert.throws(() => contract.stripQualificationDiagnostics(Buffer.from(engine + tap)), /Duplicate qualification diagnostics tap/); checks++;
assert.throws(() => contract.stripQualificationDiagnostics(Buffer.from(baselineEngine + tap)), /protected site/); checks++;
const movedTap = engine.replace(tap, '').replace('    return {action:\'render\',result};', tap + '    return {action:\'render\',result};');
assert.throws(() => contract.stripQualificationDiagnostics(Buffer.from(movedTap)), /protected site/); checks++;
let atMs = 200, events = [];
const context = { performance: { now: () => atMs }, CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
  dispatchEvent: event => events.push(event) };
vm.runInNewContext(fs.readFileSync(path.join(publicRoot, 'vision-qualification-diagnostics.js'), 'utf8'), context);
const frozenResult = { accepted: true, best: { ref: { ...refs[1], image: 'PRIVATE-IMAGE' }, score: .29 },
  second: { ref: { ...refs[0], image: 'PRIVATE-OTHER-IMAGE' }, score: .1 },
  ranked: [{ ref: { ...refs[1], image: 'PRIVATE-IMAGE' }, score: .29 }, { ref: refs[0], score: .1 }], margin: .19,
  mode: 'normal', quality: { ...base().quality, crop: 'PRIVATE-CROP' } };
const input = { result: frozenResult, temporal: { action: 'hold', result: frozenResult, count: 1, required: 2 },
  visibleIdentityBeforeRender: { accepted: true, refId: refs[0].refId, cardId: refs[0].cardId, at: 100, image: 'PRIVATE-IMAGE' },
  references: refs,
  temporalEntry: { stableResult: { best: { ref: refs[0] } }, pendingKey: 'PRIVATE-IMAGE', pendingCount: 1, uncertainSince: 180, lastConfirmedAt: 160 },
  track: { uid: 7, misses: 0 }, requestStartedAtMs: 150, activeTrackCount: 1, thresholds: base().thresholds };
const before = JSON.stringify(input);
function deepFreeze(value) { if (value && typeof value === 'object') { Object.freeze(value); for (const key of Object.keys(value)) deepFreeze(value[key]); } return value; }
context.TCGVisionQualificationDiagnostics.observeAttempt(deepFreeze(input));
check(events.length, 1); check(events[0].type, 'tcg-identification-attempt');
check(events[0].detail.requestStartedAtMs, 150); check(events[0].detail.atMs, 200);
check(events[0].detail.temporal.action, 'hold'); check(events[0].detail.temporal.pendingCardId, 'cp-b');
check(events[0].detail.temporal.stableCardId, 'cp-a'); check(events[0].detail.finalAccepted, false);
check(events[0].detail.matcherAccepted, true); check(events[0].detail.temporal.uncertainAgeMs, 20);
check(events[0].detail.temporal.lastConfirmedAgeMs, 40);
check(events[0].detail.visibleIdentityBeforeRender.present, true);
check(events[0].detail.visibleIdentityBeforeRender.cardId, 'cp-a');
check(events[0].detail.visibleIdentityBeforeRender.ageMs, 100);
check(JSON.stringify(input), before, 'Diagnostic tap never mutates input objects');
check(/PRIVATE|image|crop|device|descriptor/.test(JSON.stringify(events[0].detail)), false);
atMs = 201; context.TCGVisionQualificationDiagnostics.observeAttempt(input);
check(events[1].detail.attemptId, events[0].detail.attemptId + 1);
context.dispatchEvent = () => { throw Error('Listener failure'); };
context.TCGVisionQualificationDiagnostics.observeAttempt(input);
checks++; // Non-throwing observation is required even when a diagnostic listener fails.
context.TCGVisionQualificationDiagnostics.observeAttempt(null);
checks++;
console.log(`Vision nominal diagnostics: ${checks} assertions PASS; scalar-only attempt events; original Vision fingerprints retained after exact authorised 6C patches and the optional 6B tap.`);
