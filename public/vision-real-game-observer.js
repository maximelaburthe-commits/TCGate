(function initRealGameObserver(root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TCGVisionRealGameObserver = api;
})(typeof window !== 'undefined' ? window : globalThis, function realGameObserverFactory(initialWindow) {
  'use strict';
  const DATABASE_SHA = '56402636a77af9c8b5dc4e3b61c509a185f3c834';
  const MANIFEST = 'https://raw.githubusercontent.com/maximelaburthe-commits/tcgate_db_cyberpunk/' + DATABASE_SHA + '/manifest.json';
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const id = value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9:_.-]{0,159}$/.test(value) ? value : null;
  const uid = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
  const safeGet = (api, fallback = null) => { try { return api?.() ?? fallback; } catch { return fallback; } };
  function refsProjection(refs) {
    return refs.map(ref => ({ cardId: id(ref.cardId), printingId: id(ref.printingId), refId: id(ref.refId),
      referencePrintingId: id(ref.referencePrintingId), locale: ref.locale,
      candidatePrintingIds: (ref.candidatePrintingIds || []).map(id).filter(Boolean),
      recognitionMode: id(ref.recognitionMode), image: typeof ref.image === 'string' ? ref.image : null,
      name: typeof ref.name === 'string' ? ref.name.slice(0, 160) : ref.cardId }));
  }
  const referenceWitnesses = new WeakMap();
  function normalizedReferences(refs) {
    return refs.map(ref => ({ refId: id(ref.refId), cardId: id(ref.cardId), printingId: id(ref.printingId),
      referencePrintingId: id(ref.referencePrintingId), candidatePrintingIds: (ref.candidatePrintingIds || []).map(id).filter(Boolean).sort(),
      recognitionMode: id(ref.recognitionMode), locale: ref.locale
    })).sort((a, b) => String(a.refId).localeCompare(String(b.refId)));
  }
  function ensureReferenceWitness(w) {
    if (!w?.document || !w.addEventListener || referenceWitnesses.has(w)) return;
    const witness = { projection: null, captureCount: null };
    referenceWitnesses.set(w, witness);
    // Scalar provenance only, installed before the normal lazy worker startup.
    // Table State releases its heavy references after initialization. This copy
    // retains only 229 IDs/locale/recognition fields; no descriptors or media.
    w.addEventListener('tcg-table-reference-library', () => {
      witness.projection = null; witness.captureCount = null;
      const refs = safeGet(() => w.TCGTableStateBridge.getRefs());
      const bridge = safeGet(() => w.TCGTableStateBridge.getSnapshot());
      if (!Array.isArray(refs) || refs.length !== 229) return;
      witness.projection = normalizedReferences(refs);
      witness.captureCount = bridge?.captureCount ?? null;
    }, { passive: true });
  }
  ensureReferenceWitness(initialWindow);
  function attestWorkerReferences(w, refs) {
    const current = safeGet(() => w.TCGTableStateBridge.getRefs());
    const bridge = safeGet(() => w.TCGTableStateBridge.getSnapshot());
    const witness = referenceWitnesses.get(w);
    const projection = Array.isArray(current) ? normalizedReferences(current) :
      witness && witness.captureCount === bridge?.captureCount ? witness.projection : null;
    const expected = normalizedReferences(refs);
    if (!projection || projection.length !== 229 || JSON.stringify(projection) !== JSON.stringify(expected)) throw Error('LOADED_WORKER_CORPUS_MISMATCH_OR_UNOBSERVED');
    return typeof w.TCGVisionNominalQualificationReceipt?.digest === 'function' ?
      w.TCGVisionNominalQualificationReceipt.digest(w.TCGVisionNominalQualificationReceipt.normalizedReferences(refs)) : null;
  }
  function inspectContext(w) {
    const snapshot = safeGet(() => w.TCGIdentificationLab.getSnapshot());
    const descriptor = safeGet(() => w.TCGateGameDatabases.get('cyberpunk'));
    const lab = w.TCGDetectionLab;
    if (!snapshot || !lab || w.TCGWorkspaceLabProviderInstance ||
        lab.els?.videoStage !== w.document.getElementById('opponentFeed') ||
        lab.els?.video !== w.document.getElementById('remoteVideo')) throw Error('NORMAL_OPPONENT_STREAM_REQUIRED');
    if (descriptor?.manifestUrl !== MANIFEST) throw Error('DATABASE_CONTEXT_CHANGED');
    if (snapshot.gameId !== 'cyberpunk' || snapshot.playerLocale !== 'en' ||
        snapshot.visionReferenceCount !== 229 || snapshot.librarySize !== 229 ||
        snapshot.libraryReady !== true || snapshot.matcherWorker?.ready !== true ||
        snapshot.visionLocales?.length !== 1 || snapshot.visionLocales[0] !== 'en' ||
        snapshot.libraryIntegrity?.degraded !== false || snapshot.enabled !== true ||
        snapshot.qualificationTracking?.active === true) throw Error('NORMAL_EN_229_CONTEXT_REQUIRED');
    return { snapshot, signature: JSON.stringify([snapshot.gameId, snapshot.playerLocale, snapshot.visionIndexKey,
      snapshot.librarySize, descriptor.manifestUrl, snapshot.libraryIntegrity?.sourceRef,
      safeGet(() => w.TCGTableStateBridge.getSnapshot())?.captureCount ?? null]) };
  }
  async function readContext(options = {}) {
    const w = options.targetWindow || (options.document ? options : globalThis.window);
    if (!w) throw Error('A browser window is required');
    ensureReferenceWitness(w);
    const first = inspectContext(w);
    if (!/^[a-f0-9]{40}$/i.test(options.productSha || '')) throw Error('Exact build productSha required');
    if (!w.TCGateDatabaseSource?.getVisionReferences || !w.TCGateDatabaseSource?.load) throw Error('Read-only reference metadata API unavailable');
    const rawRefs = await w.TCGateDatabaseSource.getVisionReferences('cyberpunk', 'en');
    // The normal Vision startup already loaded this source. Read its cached
    // canonical names only; never read unfiltered candidates or change caches.
    const database = await w.TCGateDatabaseSource.load('cyberpunk', { force: false });
    if (database?.manifest?.sourceCommit !== DATABASE_SHA || !database?.cardsById?.get) throw Error('CANONICAL_METADATA_CONTEXT_CHANGED');
    const refs = refsProjection(rawRefs.map(ref => {
      const name = database.cardsById.get(ref.cardId)?.name;
      if (typeof name !== 'string' || !name) throw Error('CANONICAL_CARD_LABEL_UNAVAILABLE');
      return { ...ref, name };
    }));
    if (refs.length !== 229 || new Set(refs.map(ref => ref.cardId)).size !== 150 ||
        new Set(refs.map(ref => ref.refId)).size !== 229 || refs.some(ref => !ref.cardId || !ref.refId || ref.locale !== 'en')) throw Error('CORPUS_CONTEXT_CHANGED');
    const referencesSha256 = attestWorkerReferences(w, refs);
    if (inspectContext(w).signature !== first.signature) throw Error('CONTEXT_CHANGED_DURING_PREPARATION');
    const cards = [...new Map(refs.map(ref => [ref.cardId, { cardId: ref.cardId, id: ref.cardId, name: ref.name }])).values()];
    return { productSha: options.productSha.toLowerCase(), buildSha: options.productSha.toLowerCase(), databaseSha: DATABASE_SHA,
      gameId: 'cyberpunk', locale: 'en', referenceCount: 229, scope: 'opponent-stream-only', references: refs, cards,
      runtimeSignature: first.signature, referencesSha256 };
  }
  function create(options = {}) {
    const w = options.targetWindow || globalThis.window;
    if (!w?.document || typeof options.onEvent !== 'function') throw Error('Browser window and onEvent are required');
    const context = options.context;
    if (!context || !/^[a-f0-9]{40}$/.test(context.productSha || context.buildSha || '') || context.databaseSha !== DATABASE_SHA ||
        context.gameId !== 'cyberpunk' || context.locale !== 'en' || context.referenceCount !== 229 ||
        !Array.isArray(context.references) || context.references.length !== 229 || context.references.some(ref => ref?.locale !== 'en')) throw Error('Prepared immutable context required');
    const refs = refsProjection(context.references), byRef = new Map(refs.map(ref => [ref.refId, ref]));
    const byImage = new Map(refs.filter(ref => ref.image).map(ref => [ref.image, ref]));
    if (byRef.size !== 229 || new Set(refs.map(ref => ref.cardId)).size !== 150) throw Error('Prepared corpus must contain EN229 / 150 canonical cards');
    const clockId = id(options.clockId);
    if (!clockId) throw Error('A shared monotonic clockId is required');
    const now = () => w.performance.now();
    const lab = w.TCGDetectionLab, stage = lab?.els?.videoStage;
    const displayImages = ['displayCardImage', 'fullscreenIdentImage'].map(name => w.document.getElementById(name)).filter(Boolean);
    const displayContainers = ['displayCardButton', 'fullscreenCardPreview'].map(name => w.document.getElementById(name)).filter(Boolean);
    if (!stage || !displayImages.length || !displayContainers.length) throw Error('Normal player hover and visible inspector DOM required');
    let running = false, disposed = false, signature = null, current = null, nextRequest = 1, pointer = null;
    let heartbeat = null, queued = null, frame = null, frameVerify = null, lastPerformanceAt = null, previousObservationAt = null, wasHidden = false;
    let lastTrackHeartbeatAt = null;
    let candidate = null, eventCount = 0, errors = 0, lastVideo = null, mutationObserver = null;
    const removers = [], lastTrack = new Map(), lastNative = new Map(), requestsByUid = new Map();
    const diagnostics = { started: false, stoppedReason: null, emitted: 0, contextFailures: 0, maxTracks: 64, heartbeatMs: 250,
      requestOrigins: { HUMAN_POINTER: 0, STATIONARY_POINTER: 0 }, detached: false };
    function emit(kind, fields = {}) {
      if (!running) return;
      const event = { kind, atMs: now(), clockId, ...fields };
      eventCount++; diagnostics.emitted = eventCount;
      try { options.onEvent(event); } catch { errors++; }
    }
    function listen(target, name, callback, capture = false) {
      target.addEventListener(name, callback, { capture, passive: true });
      removers.push(() => target.removeEventListener(name, callback, { capture }));
    }
    function resolve(value) {
      if (!value) return null;
      const direct = byRef.get(value.refId) || byRef.get(value.image) || byImage.get(value.image);
      if (direct && (!value.cardId || value.cardId === direct.cardId)) return direct;
      if (id(value.cardId) && refs.some(ref => ref.cardId === value.cardId)) {
        return { cardId: value.cardId, printingId: id(value.printingId), refId: id(value.refId) };
      }
      return null;
    }
    function source(value) {
      if (value?.source === 'vision-state-memory' || value?.mode === 'memory-hover') return 'TABLE_MEMORY';
      if (value?.source === 'hover-cache' || String(value?.mode || '').startsWith('cached-')) return 'HOVER_CACHE';
      if (value?.source === 'foreground' || typeof value?.mode === 'string') return 'NEW_ANALYSIS';
      return 'UNKNOWN';
    }
    function matchingUid(a, b) { return a !== null && b !== null && a === b; }
    function checkContext() {
      if (!running) return false;
      try {
        const inspected = inspectContext(w);
        if (inspected.signature !== signature) throw Error('RUNTIME_CONTEXT_CHANGED');
        if (typeof options.getContext === 'function') {
          const actual = options.getContext();
          if (!actual || (actual.productSha || actual.buildSha) !== (context.productSha || context.buildSha) ||
              actual.databaseSha !== context.databaseSha || actual.gameId !== context.gameId || actual.locale !== context.locale ||
              actual.referenceCount !== context.referenceCount) throw Error('BUILD_OR_CORPUS_CHANGED');
        }
        return true;
      } catch {
        diagnostics.contextFailures++; emit('CONTEXT_INVALIDATED', { reason: 'BUILD_OR_CORPUS_OR_MODE_CHANGED' });
        stop('CONTEXT_INVALIDATED'); return false;
      }
    }
    function tracks() { return safeGet(() => lab.activeTracks(), []).slice(0, 64); }
    function targetAt(event) {
      const rect = stage.getBoundingClientRect(), video = lab.els.video, overlay = lab.els.overlay;
      const width = video.videoWidth || overlay.width || 1, height = video.videoHeight || overlay.height || 1;
      const scale = Math.min(rect.width / width, rect.height / height);
      if (!(scale > 0)) return null;
      const x = (event.clientX - rect.left - (rect.width - width * scale) / 2) / scale;
      const y = (event.clientY - rect.top - (rect.height - height * scale) / 2) / scale;
      if (x < 0 || y < 0 || x > width || y > height) return null;
      return tracks().filter(track => (track.misses || 0) === 0).sort((a, b) => (b.conf || 0) - (a.conf || 0)).find(track => {
        const a = -(track.angle || 0), dx = x - track.cx, dy = y - track.cy;
        return Math.abs(dx * Math.cos(a) - dy * Math.sin(a)) <= track.w / 2 &&
          Math.abs(dx * Math.sin(a) + dy * Math.cos(a)) <= track.h / 2;
      }) || null;
    }
    function definitivePrinting(ref) {
      return Boolean(ref?.printingId && ref.recognitionMode === 'exact' && ref.candidatePrintingIds?.length === 1 &&
        ref.candidatePrintingIds[0] === ref.printingId);
    }
    function visible(snapshot, requestedUid, ref) {
      const identity = snapshot?.visibleIdentity;
      const resolved = resolve(identity);
      if (!identity?.accepted || !matchingUid(uid(identity.trackUid), requestedUid) || !resolved ||
          (ref && (ref.cardId !== resolved.cardId || (definitivePrinting(ref) && ref.printingId !== resolved.printingId))) ||
          typeof identity.imageUrl !== 'string' || w.document.hidden) return false;
      // identImage is a technical legacy control hidden in the normal product.
      // Only the real sidebar/fullscreen player mirrors establish display.
      return displayImages.some(image => {
        if (!image.complete || image.naturalWidth <= 0 || image.currentSrc !== identity.imageUrl || !image.getClientRects().length) return false;
        for (let element = image; element; element = element.parentElement) {
          const style = w.getComputedStyle(element);
          if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) return false;
        }
        const rect = image.getBoundingClientRect();
        if (!(rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.bottom > 0 && rect.left < w.innerWidth && rect.top < w.innerHeight)) return false;
        // A loaded CSS-visible image may still be covered by the campaign panel
        // or another dialog. Check a representative point of its visible area.
        // The normal image may have pointer-events:none: its owning button or
        // preview ancestor is then the legitimate hit-test surface.
        const x = (Math.max(0, rect.left) + Math.min(w.innerWidth, rect.right)) / 2;
        const y = (Math.max(0, rect.top) + Math.min(w.innerHeight, rect.bottom)) / 2;
        const top = w.document.elementsFromPoint(x, y)[0];
        if (top && (top === image || image.contains(top) || top.contains(image))) return true;
        // In the unchanged normal product, the floating inspector and its
        // ancestors intentionally use pointer-events:none. Hit testing therefore
        // sees the known opponent-video underlay through this visible mirror.
        // Accept that specific native underlay; campaign panels, dialogs and
        // unrelated overlays remain blockers. This is a conservative UI check,
        // not a claim to measure every painted pixel or translucent overlay.
        return w.getComputedStyle(image).pointerEvents === 'none' &&
          [lab.els.video, lab.els.overlay, stage].includes(top);
      });
    }
    function cancel(reason) {
      if (!current) return;
      if (!current.displayed) emit('CANCEL', { consultationId: current.id, trackUid: current.uid, reason });
      current = null; candidate = null;
    }
    function request(track, origin, genuine) {
      const trackUid = uid(track?.uid);
      if (trackUid === null) { cancel('NO_TRACK_UNDER_POINTER'); return; }
      if (current?.uid === trackUid) return;
      cancel('POINTER_TARGET_CHANGED');
      const snapshot = safeGet(() => w.TCGIdentificationLab.getSnapshot(), {});
      const table = safeGet(() => w.TCGTableStateEngine.getSnapshot(), {});
      const entry = table.entries?.find(value => value.activeUid === trackUid);
      const nativeRef = !entry?.identitySuspended && !entry?.needsReacquireVerification && entry?.state === 'STABLE_KNOWN' ? resolve(entry.identity) : null;
      const preexisting = Boolean(nativeRef || (snapshot.identification?.accepted && snapshot.hoveredTrack?.uid === trackUid));
      current = { id: 'consultation-' + nextRequest++, uid: trackUid, atMs: now(), displayed: false,
        alreadyVisible: visible(snapshot, trackUid, null), timeout: false, origin };
      requestsByUid.delete(trackUid); requestsByUid.set(trackUid, { id: current.id, atMs: current.atMs });
      if (requestsByUid.size > 64) requestsByUid.delete(requestsByUid.keys().next().value);
      diagnostics.requestOrigins[origin]++;
      emit('REQUEST', { consultationId: current.id, trackUid, requestOrigin: origin, genuineHover: genuine,
        preexisting, alreadyVisibleAtRequest: current.alreadyVisible, source: preexisting ? 'PREEXISTING' : 'UNKNOWN',
        cardId: nativeRef?.cardId || null, nativeIdentityAtMs: finite(entry?.identity?.establishedAt) ? entry.identity.establishedAt : null,
        observationSource: 'DOM' });
    }
    function pointerMove(event) {
      if (!running || event.target?.closest?.('.fullscreen-card-preview')) return;
      // A real browser PointerEvent, captured before the normal stage listeners.
      // Synthetic DOM dispatches do not create human demand evidence.
      if (event.isTrusted !== true) return;
      pointer = { clientX: event.clientX, clientY: event.clientY };
      const target = targetAt(pointer);
      if (current && uid(target?.uid) === current.uid) return;
      if (!checkContext() || !observeContinuity()) return;
      request(target, 'HUMAN_POINTER', true);
      queueSample();
    }
    function stationaryRetarget() {
      if (!running || !checkContext() || !observeContinuity()) return;
      if (pointer) request(targetAt(pointer), 'STATIONARY_POINTER', false);
      queueSample();
    }
    function queueDisplay() {
      if (!running || frame !== null || frameVerify !== null || !candidate || !current) return;
      frame = w.requestAnimationFrame(() => {
        frame = null;
        if (!running || !candidate || !current || !checkContext()) return;
        const token = candidate, requestId = current.id;
        const snapshot = safeGet(() => w.TCGIdentificationLab.getSnapshot(), {});
        if (!visible(snapshot, current.uid, token.ref)) return;
        // Confirm the same loaded image remains presentable across a frame.
        frameVerify = w.requestAnimationFrame(() => {
          frameVerify = null;
          if (!running || candidate !== token || !current || current.id !== requestId || !checkContext()) return;
          if (!visible(safeGet(() => w.TCGIdentificationLab.getSnapshot(), {}), current.uid, token.ref)) return;
          const key = [token.ref.cardId, token.ref.printingId || '', token.atMs].join(':');
          if (current.lastDisplay === key) return;
          current.lastDisplay = key; current.displayed = true;
          emit('DISPLAY', { consultationId: current.id, trackUid: current.uid, cardId: token.ref.cardId,
            printingId: token.ref.printingId || null, definitivePrinting: definitivePrinting(token.ref), accepted: true, displayConfirmed: true,
            alreadyVisibleAtRequest: current.alreadyVisible, source: token.source, retainedPreview: false,
            decisionFresh: token.source === 'NEW_ANALYSIS', observationSource: 'DOM' });
          candidate = null;
        });
      });
    }
    function nativeResult(event, memory = false) {
      if (!running || !checkContext() || !observeContinuity()) return;
      const detail = event.detail || {}, trackUid = uid(detail.trackUid ?? detail.uid), at = detail.at;
      // A Window-target CustomEvent can reach older normal listeners before a
      // later capture listener. A synchronous memory response reveals the real
      // stationary retarget. Keep it separate from any human request latency.
      const underPointer = pointer ? targetAt(pointer) : null;
      const discoveredRetarget = pointer && current?.uid !== trackUid && uid(underPointer?.uid) === trackUid;
      if (discoveredRetarget) request(underPointer, 'STATIONARY_POINTER', false);
      const ref = resolve(detail), accepted = detail.accepted === true || memory;
      const same = current && matchingUid(trackUid, current.uid) && finite(at) && (at >= current.atMs || (discoveredRetarget && current.origin === 'STATIONARY_POINTER')) && at <= now() + 1;
      const oldRequest = requestsByUid.get(trackUid);
      const consultationId = same ? current.id : oldRequest && finite(at) && at >= oldRequest.atMs ? oldRequest.id : null;
      const nativeSource = memory ? 'TABLE_MEMORY' : source(detail);
      emit('RESULT', { consultationId, trackUid, cardId: ref?.cardId || null, printingId: ref?.printingId || null,
        accepted, definitivePrinting: definitivePrinting(ref), source: nativeSource, decisionFresh: nativeSource === 'NEW_ANALYSIS',
        reason: accepted ? null : id(detail.reason) || 'UNSPECIFIED_NATIVE_REJECTION',
        matcherMs: finite(detail.matcherMs) && detail.matcherMs >= 0 ? detail.matcherMs : null,
        nativeIdentityAtMs: finite(at) ? at : null, observationSource: 'NATIVE_EVENT' });
      if (same && accepted && ref) {
        candidate = { ref, source: nativeSource, atMs: at };
        queueDisplay();
      }
      queueSample();
    }
    function sampleTracks(snapshot, table, active, force) {
      const activeUids = new Set(active.map(track => uid(track.uid)).filter(value => value !== null));
      const keys = new Set([...lastTrack.keys(), ...activeUids]);
      for (const trackUid of keys) {
        const track = active.find(item => item.uid === trackUid);
        const entry = table.entries?.find(item => item.activeUid === trackUid);
        const suspended = entry?.identitySuspended === true || entry?.needsReacquireVerification === true;
        const native = entry?.identity && !suspended && entry.state === 'STABLE_KNOWN' && track ? entry.identity : null;
        const ref = resolve(native), observedAt = finite(native?.establishedAt) ? native.establishedAt : null;
        // Foreground decisions are current only for their native hovered track.
        const fg = snapshot.identification?.accepted && snapshot.hoveredTrack?.uid === trackUid ? resolve(snapshot.identification.best) : null;
        const identity = ref || (!suspended && track ? fg : null);
        const status = !track ? 'LOST' : suspended ? 'SUSPENDED' : identity ? 'ACTIVE' : 'UNKNOWN';
        const nativeValue = { trackUid, detected: Boolean(track && (track.misses || 0) === 0), tracked: Boolean(track),
          nativeStatus: status, identityCurrent: Boolean(identity), cardId: identity?.cardId || null,
          printingId: identity?.printingId || null, definitivePrinting: definitivePrinting(identity), source: ref ? 'TABLE_MEMORY' : fg ? source(snapshot.visibleIdentity) : 'UNKNOWN',
          nativeIdentityAtMs: observedAt, accepted: Boolean(identity), decisionFresh: null, retainedPreview: Boolean(snapshot.visibleIdentity?.accepted &&
            snapshot.visibleIdentity.trackUid === trackUid && (!track || !identity)),
          observationSource: 'NATIVE_SNAPSHOT', misses: track ? Number(track.misses || 0) : null };
        const key = JSON.stringify(nativeValue);
        // Native events may be frequent. Store only changes plus 250 ms heartbeat,
        // without copying candidates, observations, images or video into a log.
        if (lastTrack.get(trackUid) !== key || (track && lastNative.get(trackUid) !== observedAt) || force) {
          emit('TRACK_STATE', nativeValue); lastTrack.set(trackUid, key); lastNative.set(trackUid, observedAt);
        }
        if (!track) { lastTrack.delete(trackUid); lastNative.delete(trackUid); }
      }
    }
    function observeContinuity() {
      const observationAt = now();
      const hidden = w.document.hidden;
      if ((previousObservationAt !== null && observationAt - previousObservationAt > 1000) || hidden !== wasHidden) {
        emit('OBSERVATION_GAP', { reason: hidden || wasHidden ? 'DOCUMENT_HIDDEN' : 'CALLBACK_GAP',
          durationMs: previousObservationAt === null ? null : observationAt - previousObservationAt, previousAtMs: previousObservationAt });
        lastTrack.clear(); lastNative.clear();
      }
      previousObservationAt = observationAt; wasHidden = hidden;
      return !hidden;
    }
    function sample(sampleOptions) {
      if (!running || !checkContext() || !observeContinuity()) return;
      const snapshot = safeGet(() => w.TCGIdentificationLab.getSnapshot(), {});
      const table = safeGet(() => w.TCGTableStateEngine.getSnapshot(), {});
      const detection = safeGet(() => w.TCGVisionEngine.getSnapshot(), {}), active = tracks();
      const forceTracks = sampleOptions?.force === true || lastTrackHeartbeatAt === null || now() - lastTrackHeartbeatAt >= 1000;
      if (forceTracks) lastTrackHeartbeatAt = now();
      sampleTracks(snapshot, table, active, forceTracks);
      const video = lab.els.video;
      const videoState = { videoPaused: video.paused, videoReadyState: video.readyState, documentHidden: w.document.hidden,
        videoCurrentTimeSec: finite(video.currentTime) ? video.currentTime : null };
      const videoKey = JSON.stringify([video.paused, video.readyState, w.document.hidden]);
      if (videoKey !== lastVideo) { emit('VIDEO_STATE', videoState); lastVideo = videoKey; }
      if (lastPerformanceAt === null || now() - lastPerformanceAt >= 1000) {
        lastPerformanceAt = now();
        emit('PERFORMANCE_SAMPLE', { ...videoState, tracksCount: active.length,
          detectionFps: finite(detection.inference?.detectionFps) ? detection.inference.detectionFps : null,
          videoFps: finite(detection.inference?.videoFps) ? detection.inference.videoFps : null,
          longTaskCount: finite(detection.mainThread?.longTaskCount) ? detection.mainThread.longTaskCount : null,
          droppedVideoFrames: finite(detection.playback?.droppedVideoFrames) ? detection.playback.droppedVideoFrames : null,
          observationSource: 'NATIVE_SNAPSHOT' });
      }
      if (current && !current.displayed && !current.timeout && now() - current.atMs >= 10000) {
        current.timeout = true; emit('TIMEOUT', { consultationId: current.id, trackUid: current.uid, reason: 'NO_DISPLAY_WITHIN_OBSERVATION_WINDOW' });
      }
      queueDisplay();
    }
    function queueSample() {
      if (!running || queued !== null) return;
      queued = w.setTimeout(() => { queued = null; sample(); }, 0);
    }
    function start() {
      if (disposed) throw Error('Observer disposed');
      if (running) return getDiagnostics();
      signature = inspectContext(w).signature;
      if (context.runtimeSignature && signature !== context.runtimeSignature) throw Error('Prepared runtime context changed');
      const detection = safeGet(() => w.TCGVisionEngine.getSnapshot(), {});
      if (detection.active !== true || detection.modelReady !== true || !lab.els.video.videoWidth) throw Error('Normal remote camera-fed Vision must already be active');
      running = true; diagnostics.started = true;
      listen(stage, 'pointermove', pointerMove, true);
      listen(stage, 'pointerleave', () => { pointer = null; cancel('POINTER_LEFT_VIDEO'); queueSample(); }, true);
      // Window capture precedes existing target listeners, including stationary
      // retargets that synchronously produce a memory response.
      listen(w, 'tcg-tracks-updated', stationaryRetarget, true);
      listen(w, 'tcg-identification-result', event => nativeResult(event));
      listen(w, 'tcg-identification-visible', event => nativeResult(event, true));
      for (const name of ['tcg-table-state-updated', 'tcg-identification-stability', 'tcg-identification-visible-cleared']) listen(w, name, queueSample);
      for (const name of ['tcg-identification-context', 'tcg-identification-library', 'tcg-table-reference-library']) listen(w, name, () => checkContext());
      for (const name of ['loadeddata', 'waiting', 'stalled', 'playing', 'pause', 'emptied']) listen(lab.els.video, name, queueSample);
      listen(w.document, 'visibilitychange', queueSample);
      for (const image of displayImages) listen(image, 'load', queueDisplay);
      mutationObserver = new w.MutationObserver(queueDisplay);
      for (const image of displayImages) mutationObserver.observe(image, { attributes: true, attributeFilter: ['src', 'style', 'class'] });
      for (const container of displayContainers) mutationObserver.observe(container, { attributes: true, attributeFilter: ['style', 'class'] });
      heartbeat = w.setInterval(sample, 250); sample();
      return getDiagnostics();
    }
    function stop(reason = 'OPERATOR_STOPPED') {
      if (!running) return getDiagnostics();
      cancel(id(reason) || 'OPERATOR_STOPPED');
      running = false; diagnostics.stoppedReason = id(reason) || 'OPERATOR_STOPPED';
      removers.splice(0).forEach(remove => remove());
      mutationObserver?.disconnect(); mutationObserver = null;
      if (heartbeat !== null) w.clearInterval(heartbeat);
      if (queued !== null) w.clearTimeout(queued);
      if (frame !== null) w.cancelAnimationFrame(frame);
      if (frameVerify !== null) w.cancelAnimationFrame(frameVerify);
      heartbeat = queued = frame = frameVerify = null; pointer = null; candidate = null;
      return getDiagnostics();
    }
    function getDiagnostics() { return { ...diagnostics, requestOrigins: { ...diagnostics.requestOrigins }, running, disposed, errors,
      pendingConsultationId: current?.id || null, clockId, activeTimers: [heartbeat, queued, frame, frameVerify].filter(value => value !== null).length }; }
    function dispose() { stop('OBSERVER_DISPOSED'); disposed = true; diagnostics.detached = true; return getDiagnostics(); }
    return Object.freeze({ start, stop, dispose, getDiagnostics, sample });
  }
  return Object.freeze({ create, readContext, databaseSha: DATABASE_SHA, version: '1.0' });
});
