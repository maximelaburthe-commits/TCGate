'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const root = process.env.TCGATE_QUALIFICATION_WORKSPACE_TEST_ROOT || __dirname;
const harness = require(path.join(root, 'public/vision-qualification-harness.js'));
const runtimePath = process.env.VISION_QUALIFICATION_RUNTIME_PATH || path.join(root, 'public/vision-qualification-runtime.js');
let assertions = 0;
function equal(actual, expected, message) { assertions++; assert.equal(actual, expected, message); }
function check(value, message) { assertions++; assert.ok(value, message); }
function throws(callback, expression) { assertions++; assert.throws(callback, expression); }
const copy = value => JSON.parse(JSON.stringify(value));
async function main() {
  // Explicit fixtures exercise observer boundaries, never physical evidence.
  const refs = Array.from({ length: 229 }, (_, n) => ({ refId: 'fixture-ref-' + n, cardId: 'fixture-card-' + (n % 150),
    printingId: 'fixture-print-' + n, referencePrintingId: 'fixture-print-' + n, candidatePrintingIds: ['fixture-print-' + n], recognitionMode: 'exact', locale: 'en' }));
  let clock = 0, clears = 0;
  const listeners = new Map(), intervals = new Set();
  const state = { gameId: 'cyberpunk', playerLocale: 'en', libraryReady: true, matcherWorker: { ready: true, busy: false, queued: false },
    visionReferenceCount: 229, librarySize: 229, visionLocales: ['en'], libraryIntegrity: { degraded: false }, visionIndexKey: 'fixture-index',
    identification: null, visibleIdentity: null, hoveredTrack: null };
  const local = { detecting: true, stream: { getVideoTracks: () => [{ readyState: 'live' }] }, tracks: [], lostTracks: [], identityMemoryMs: 8000, analysisSeq: 0 };
  const detector = { active: true, modelReady: true, activeCards: 0, rawDetections: 0, tracking: { activeTracks: [] } };
  const table = { entries: [], workerBusy: false };
  const window = { TCGateVisionQualification: harness,
    TCGIdentificationLab: { getSnapshot: () => copy(state), clearVisibleForHandoff: () => { state.visibleIdentity = null; clears++; } },
    TCGVisionEngine: { getSnapshot: () => copy(detector) }, TCGDetectionLab: { state: local }, TCGTableStateEngine: { getSnapshot: () => copy(table) },
    TCGTableStateBridge: { getRefs: () => refs.map(ref => ({ ...ref, image: ref.refId })) },
    TCGateDatabaseSource: { getVisionReferences: async () => copy(refs) },
    TCGateGameDatabases: { get: () => ({ manifestUrl: 'https://raw.githubusercontent.com/maximelaburthe-commits/tcgate_db_cyberpunk/' + harness.DATABASE_SHA + '/manifest.json' }) },
    performance: { now: () => clock, timeOrigin: 123 }, crypto: crypto.webcrypto,
    addEventListener: (name, handler) => listeners.set(name, handler), removeEventListener: name => listeners.delete(name),
    setInterval: callback => { intervals.add(callback); return callback; }, clearInterval: callback => intervals.delete(callback),
    queueMicrotask: callback => callback() };
  const sandbox = { window, console, TextEncoder }; vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(runtimePath, 'utf8'), sandbox);
  const q = await window.TCGVisionQualificationRuntime.attach({ productSha: 'a'.repeat(40), environment: { execution: 'AUTOMATED' } });
  const spec = n => ({ mode: 'automated', expectedCardId: refs[n].cardId, expectedPrintingId: refs[n].printingId });
  const tick = (count = 1, advanceDetector = true) => { for (let n = 0; n < count; n++) { clock += 250; if (advanceDetector) local.analysisSeq++; for (const callback of intervals) callback(); } };
  const visible = (n, uid) => { state.visibleIdentity = { accepted: true, refId: refs[n].refId, trackUid: uid }; state.hoveredTrack = { uid }; state.identification = { accepted: true, best: { ...refs[n], matcherScore: .7 }, candidates: [{ ...refs[n] }] }; };
  const empty = () => { detector.activeCards = 0; detector.rawDetections = 0; detector.tracking.activeTracks = []; local.tracks = []; state.hoveredTrack = null; state.identification = null; };
  equal(q.getNeutralState().ready, false);
  throws(() => q.startTrial(spec(1)), /confirmed neutral/);
  equal(q.getSession().trials.length, 0, 'Blocked starts cannot create an observation');
  clock += 1000;
  equal(q.getNeutralState().ready, false, 'An unobserved gap is not continuous neutral evidence');
  tick(3); equal(q.getNeutralState().ready, true);
  const savedReady = q.getNeutralState();
  detector.activeCards = 1; local.tracks = [{ uid: 1 }]; visible(0, 1);
  throws(() => q.startTrial(spec(1)), /CARD_PRESENT/, 'Start rechecks live state even when UI held an earlier ready value');
  equal(savedReady.ready, true); equal(q.getNeutralState().ready, false);
  empty(); local.lostTracks = [{ uid: 1, lostAtMs: clock, displayId: 1 }];
  const originalMemory = copy(local.lostTracks), originalMemoryMs = local.identityMemoryMs;
  tick(32); check(q.getNeutralState().blockers.includes('TRACK_MEMORY_RETAINED'), 'Boundary waits the actual unchanged 8-second engine memory');
  equal(clears, 0, 'Presentation cannot be cleared to bypass live identity memory');
  tick(); equal(q.getNeutralState().ready, false);
  check(clears > 0, 'Existing presentation-only handoff clears the otherwise persistent HD result after memory expiry');
  tick(3); equal(q.getNeutralState().ready, true);
  equal(local.identityMemoryMs, originalMemoryMs); equal(JSON.stringify(local.lostTracks), JSON.stringify(originalMemory), 'Observer never mutates lost identities');
  const b = q.startTrial(spec(1));
  equal(b.observations[0].identifiedCardId, null, 'B T0 has no identity'); equal(b.neutralBoundary.requiredMs, 750);
  // A late retained display update from UID 1 must never become a B identity.
  visible(0, 1); tick();
  equal(q.getActiveObservation().observations.at(-1).identifiedCardId, null, 'Pre-boundary A UID cannot be attributed to B');
  empty(); visible(1, 2); detector.activeCards = 1; detector.tracking.activeTracks = [{ uid: 2 }]; local.tracks = [{ uid: 2 }];
  tick(5); const finished = q.endTrial();
  equal(finished.expectedCardId, refs[1].cardId);
  equal(finished.observations.filter(item => item.identifiedCardId === refs[0].cardId).length, 0);
  const result = q.exportReport().trials[0]; equal(result.category, 'CORRECT'); equal(result.wrongCardEvents, 0);
  throws(() => q.startTrial(spec(2)), /confirmed neutral/);
  empty(); state.visibleIdentity = null; local.lostTracks = []; tick(4);
  q.startTrial(spec(2));
  visible(0, 40); detector.activeCards = 1; local.tracks = [{ uid: 40 }]; tick(5); q.endTrial();
  equal(q.exportReport().trials[1].category, 'WRONG_IDENTIFICATION', 'Fresh B-origin wrongly matched to card A remains a real wrong identification');
  empty(); state.visibleIdentity = null; local.lostTracks = [];
  tick(2); equal(q.getNeutralState().ready, false);
  detector.rawDetections = 1; tick(); detector.rawDetections = 0; tick(2);
  equal(q.getNeutralState().ready, false, 'A brief card glimpse restarts the full neutral window');
  tick(2); equal(q.getNeutralState().ready, true);
  state.matcherWorker.busy = true; throws(() => q.startTrial(spec(2)), /MATCHER_PENDING/);
  state.matcherWorker.busy = false; table.entries = [{ activeUid: null, identity: { refId: refs[1].refId } }];
  tick(5); check(q.getNeutralState().blockers.includes('TABLE_MEMORY_RETAINED'), 'Off-table retained table identity blocks a new trial');
  table.entries = []; tick(4); equal(q.getNeutralState().ready, true);
  state.playerLocale = 'fr'; equal(q.getNeutralState().ready, false); throws(() => q.startTrial(spec(2)), /context changed/);
  state.playerLocale = 'en'; tick(4); equal(q.getNeutralState().ready, true);
  tick(5, false); equal(q.getNeutralState().ready, false, 'A frozen detector cannot establish a neutral boundary');
  tick(4); equal(q.getNeutralState().ready, true);
  q.startTrial(spec(2)); visible(2, 3); detector.activeCards = 1; local.tracks = [{ uid: 3 }]; tick(5); q.markRemoval();
  throws(() => q.switchTrial(spec(3)), /confirmed neutral/);
  equal(q.getActiveObservation().expectedCardId, refs[2].cardId, 'Rejected switch retains A active without overwriting its evidence');
  empty(); state.visibleIdentity = null; local.lostTracks = [];
  tick(4); equal(q.getNeutralState().ready, true);
  const linked = q.switchTrial(spec(3)); equal(linked.next.previousTrialId, linked.previous.trialId);
  equal(linked.next.observations[0].identifiedCardId, null);
  tick(5); q.endTrial();
  empty(); state.visibleIdentity = null; local.lostTracks = []; tick(4);
  q.startTrial(spec(4)); local.analysisSeq = 0; tick(); q.endTrial();
  equal(q.exportReport().trials.at(-1).category, 'INVALID_TEST', 'A reset invalidates an active observation rather than reporting a false recognition failure');
  equal(q.getNeutralState().reason, 'TRACKING_RESET_NEW_SESSION_REQUIRED');
  throws(() => q.startTrial(spec(4)), /TRACKING_RESET_NEW_SESSION_REQUIRED/);
  q.detach(); equal(listeners.size, 0); equal(intervals.size, 0);
  const streamBoundary = await window.TCGVisionQualificationRuntime.attach({ productSha: 'a'.repeat(40), environment: { execution: 'AUTOMATED' } });
  tick(4); equal(streamBoundary.getNeutralState().ready, true);
  local.stream = { getVideoTracks: () => [{ readyState: 'live' }] };
  equal(streamBoundary.getNeutralState().reason, 'TRACKING_RESET_NEW_SESSION_REQUIRED', 'Changing camera stream cannot silently recycle quarantined UIDs');
  throws(() => streamBoundary.startTrial(spec(4)), /TRACKING_RESET_NEW_SESSION_REQUIRED/); streamBoundary.detach();
  const eventBoundary = await window.TCGVisionQualificationRuntime.attach({ productSha: 'a'.repeat(40), environment: { execution: 'AUTOMATED' } });
  tick(4); equal(eventBoundary.getNeutralState().ready, true);
  listeners.get('tcg-vision-geometry')({ type: 'tcg-vision-geometry' });
  equal(eventBoundary.getNeutralState().ready, false, 'Geometry resets are fenced even if a low sequence counter recycles between polls');
  eventBoundary.detach();
  console.log('VISION_QUALIFICATION_NEUTRAL_ASSERTIONS ' + assertions);
  console.log('VISION_QUALIFICATION_NEUTRAL_TEST PASS');
}
main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
