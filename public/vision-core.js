(function(){
'use strict';

const MAX_CAPTURES = 40;

const $ = (id) => document.getElementById(id);
const els = {
  globalStatus: $('visionGlobalStatus'), cameraSelect: $('visionCameraSelect'), resolutionSelect: $('visionResolutionSelect'),
  cameraButton: $('visionCameraButton'), detectButton: $('visionDetectButton'), quickCaptureButton: $('visionQuickCaptureButton'),
  videoStage: $('opponentFeed'), video: $('remoteVideo'), overlay: $('visionOverlay'),
  emptyState: $('visionEmptyState'), modelProgress: $('visionModelProgress'), progressBar: $('visionProgressBar'), progressText: $('visionProgressText'),
  runtimeWarning: $('visionRuntimeWarning'), metricCards: $('visionMetricCards'), metricVideoFps: $('visionMetricVideoFps'), metricDetectFps: $('visionMetricDetectFps'),
  metricInference: $('visionMetricInference'), metricPreprocess: $('visionMetricPreprocess'), metricTotal: $('visionMetricTotal'), metricProvider: $('visionMetricProvider'), metricOutput: $('visionMetricOutput'), metricShapeRejected: $('visionMetricShapeRejected'),
  confidenceSlider: $('visionConfidenceSlider'), confidenceValue: $('visionConfidenceValue'), intervalSlider: $('visionIntervalSlider'), intervalValue: $('visionIntervalValue'),
  trackingToggle: $('visionTrackingToggle'), shapeFilterToggle: $('visionShapeFilterToggle'), confirmationsSlider: $('visionConfirmationsSlider'), confirmationsValue: $('visionConfirmationsValue'),
  missesSlider: $('visionMissesSlider'), missesValue: $('visionMissesValue'), idMemorySlider: $('visionIdMemorySlider'), idMemoryValue: $('visionIdMemoryValue'), reidSlider: $('visionReidSlider'), reidValue: $('visionReidValue'), visualLockToggle: $('visionVisualLockToggle'), resetTrackingButton: $('visionResetTrackingButton'),
  caseNote: $('visionCaseNote'), captureButton: $('visionCaptureButton'), captureCount: $('visionCaptureCount'), exportButton: $('visionExportButton'), clearButton: $('visionClearButton'),
  exportTopButton: $('visionExportTopButton'), topCaptureCount: $('visionTopCaptureCount'), sidebarRuntimeAlert: $('visionSidebarRuntimeAlert')
};

const state = {
  stream: null,
  worker: null,
  workerReady: false,
  provider: null,
  modelLoading: false,
  detecting: false,
  inferenceBusy: false,
  confidence: 0.55,
  intervalMs: 0,
  confirmationsNeeded: 2,
  maxMisses: 2,
  identityMemoryMs: 8000,
  reidSimilarity: 0.76,
  tracks: [],
  lostTracks: [],
  nextUid: 1,
  nextDisplayId: 1,
  rawDetections: [],
  shapeRejected: 0,
  filterStats: { shape: 0, scale: 0, duplicate: 0, weakRejected: 0, rescued: 0 },
  lastWorkerConfidenceFloor: 0.55,
  captures: [],
  lastInferenceMs: 0,
  lastPreprocessMs: 0,
  lastTotalMs: 0,
  detectTimestamps: [],
  videoFps: 0,
  outputShape: '—',
  analysisSeq: 0,
  requestSeq: 0,
  analysisFrames: new Map(),
  lastResultAt: 0,
  lastRunFinishedAt: 0,
  externalMode: true,
  externalAttached: false,
  debugOverlay: false,
  modelReadyAt: null,
  startedAt: null
};

function setStatus(text, type = 'neutral') {
  els.globalStatus.textContent = text;
  els.globalStatus.className = `status-pill ${type}`;
}

function showWarning(text = '') {
  els.runtimeWarning.textContent = text;
  els.runtimeWarning.classList.toggle('hidden', !text);
  if (els.sidebarRuntimeAlert) {
    els.sidebarRuntimeAlert.textContent = text;
    els.sidebarRuntimeAlert.classList.toggle('hidden', !text);
  }
}

function formatBytes(n) {
  if (!Number.isFinite(n) || n <= 0) return '—';
  return `${(n / 1024 / 1024).toFixed(1)} Mo`;
}

async function listCameras() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cams = devices.filter((d) => d.kind === 'videoinput');
    const selected = els.cameraSelect.value;
    els.cameraSelect.innerHTML = '<option value="">Caméra par défaut</option>';
    cams.forEach((cam, i) => {
      const opt = document.createElement('option');
      opt.value = cam.deviceId;
      opt.textContent = cam.label || `Caméra ${i + 1}`;
      els.cameraSelect.appendChild(opt);
    });
    if ([...els.cameraSelect.options].some((o) => o.value === selected)) els.cameraSelect.value = selected;
  } catch {}
}

function chosenResolution() {
  const [width, height] = els.resolutionSelect.value.split('x').map(Number);
  return { width, height };
}

function resetTracking(message = '') {
  state.tracks = [];
  state.lostTracks = [];
  state.rawDetections = [];
  state.analysisFrames.clear();
  state.nextUid = 1;
  state.nextDisplayId = 1;
  state.analysisSeq = 0;
  drawOverlay();
  if (message) setStatus(message, 'good');
}

async function stopCamera() {
  if (window.TCGDiagnosticRecorder?.isRecording?.()) {
    try { await window.TCGDiagnosticRecorder.stop('camera-stop'); } catch {}
  }
  state.detecting = false;
  state.stream?.getTracks().forEach((t) => t.stop());
  state.stream = null;
  els.video.srcObject = null;
  els.videoStage.classList.add('empty');
  els.cameraButton.textContent = 'Activer la caméra';
  els.detectButton.textContent = 'Activer la détection';
  els.detectButton.disabled = true;
  els.captureButton.disabled = true;
  if (els.quickCaptureButton) els.quickCaptureButton.disabled = true;
  resetTracking();
  setStatus('Caméra arrêtée');
  window.dispatchEvent(new CustomEvent('tcg-camera-state', { detail: { active: false } }));
}

async function startCamera() {
  if (state.stream) {
    await stopCamera();
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus('Caméra non disponible', 'error');
    return;
  }
  const { width, height } = chosenResolution();
  const deviceId = els.cameraSelect.value;
  const video = {
    width: { ideal: width },
    height: { ideal: height },
    frameRate: { ideal: 30, max: 30 }
  };
  if (deviceId) video.deviceId = { exact: deviceId };
  setStatus('Activation caméra…', 'warn');
  try {
    state.stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
    els.video.srcObject = state.stream;
    await els.video.play();
    await new Promise((resolve) => {
      if (els.video.videoWidth) resolve();
      else els.video.addEventListener('loadedmetadata', resolve, { once: true });
    });
    syncStageSize();
    els.videoStage.classList.remove('empty');
    els.cameraButton.textContent = 'Arrêter la caméra';
    els.detectButton.disabled = false;
    els.captureButton.disabled = false;
    if (els.quickCaptureButton) els.quickCaptureButton.disabled = false;
    resetTracking();
    await listCameras();
    startVideoFpsMeter();
    setStatus(`${els.video.videoWidth}×${els.video.videoHeight} actif`, 'good');
    window.dispatchEvent(new CustomEvent('tcg-camera-state', { detail: { active: true } }));
  } catch (err) {
    state.stream = null;
    setStatus('Erreur caméra', 'error');
    showWarning(`Caméra : ${err?.name || 'Erreur'} — ${err?.message || 'accès impossible'}`);
  }
}

function syncStageSize() {
  const w = els.video.videoWidth || 1280;
  const h = els.video.videoHeight || 720;
  els.videoStage.style.aspectRatio = `${w} / ${h}`;
  els.overlay.width = w;
  els.overlay.height = h;
}

function startVideoFpsMeter() {
  let count = 0;
  let started = performance.now();
  const tick = () => {
    if (!state.stream) return;
    count += 1;
    const now = performance.now();
    if (now - started >= 1000) {
      state.videoFps = Math.round((count * 1000) / (now - started));
      count = 0;
      started = now;
    }
    if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) els.video.requestVideoFrameCallback(tick);
    else requestAnimationFrame(tick);
  };
  if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) els.video.requestVideoFrameCallback(tick);
  else requestAnimationFrame(tick);
}

function ensureWorker() {
  if (state.worker) return state.worker;
  const worker = new Worker('/detection-worker.js');
  state.worker = worker;

  worker.onmessage = (event) => {
    const msg = event.data || {};
    if (msg.type === 'model-progress') {
      els.modelProgress.classList.remove('hidden');
      const pct = Number(msg.pct || 0);
      els.progressBar.style.width = `${pct}%`;
      if (msg.total) {
        els.progressText.textContent = `${msg.text || 'Modèle'} · ${formatBytes(msg.received)} / ${formatBytes(msg.total)}`;
      } else {
        els.progressText.textContent = msg.text || 'Chargement du modèle…';
      }
      return;
    }
    if (msg.type === 'model-ready') {
      state.workerReady = true;
      state.modelLoading = false;
      state.modelReadyAt = performance.now();
      state.provider = msg.provider || '—';
      els.metricProvider.textContent = state.provider;
      els.detectButton.disabled = !state.stream;
      setStatus(`Modèle prêt · ${state.provider}`, 'good');
      return;
    }
    if (msg.type === 'status') {
      setStatus(msg.text || 'Préparation…', msg.kind || 'neutral');
      return;
    }
    if (msg.type === 'warning') {
      showWarning(msg.text || 'Avertissement moteur');
      return;
    }
    if (msg.type === 'inference-result') {
      state.inferenceBusy = false;
      const incoming = Array.isArray(msg.detections) ? msg.detections : [];
      const appearanceFrame = state.analysisFrames.get(msg.requestId) || null;
      state.analysisFrames.delete(msg.requestId);
      const filtered = filterTableDetections(incoming);
      state.rawDetections = attachAppearance(filtered, appearanceFrame);
      state.lastPreprocessMs = Number(msg.preprocessMs || 0);
      state.lastInferenceMs = Number(msg.inferenceMs || 0);
      state.lastTotalMs = Number(msg.totalMs || 0);
      state.outputShape = msg.outputShape || '—';
      state.provider = msg.provider || state.provider;
      state.analysisSeq += 1;
      updateTracks(state.rawDetections);
      window.dispatchEvent(new CustomEvent('tcg-tracks-updated', {
        detail: { analysisSeq: state.analysisSeq }
      }));
      state.lastRunFinishedAt = performance.now();
      const now = performance.now();
      state.detectTimestamps.push(now);
      state.detectTimestamps = state.detectTimestamps.filter((t) => now - t <= 1000);
      scheduleNextInference();
      return;
    }
    if (msg.type === 'error') {
      state.inferenceBusy = false;
      state.modelLoading = false;
      state.detecting = false;
      els.detectButton.textContent = 'Activer la détection';
      els.detectButton.disabled = !state.stream;
      setStatus('Erreur détection', 'error');
      showWarning(`Détection : ${msg.message || 'erreur inconnue'}`);
    }
  };

  worker.onerror = (err) => {
    state.inferenceBusy = false;
    state.detecting = false;
    setStatus('Erreur worker', 'error');
    showWarning(`Worker de détection : ${err.message || 'erreur inconnue'}`);
  };
  return worker;
}

async function ensureModel() {
  if (state.workerReady) return;
  if (state.modelLoading) {
    await new Promise((resolve, reject) => {
      const started = performance.now();
      const check = () => {
        if (state.workerReady) return resolve();
        if (!state.modelLoading) return reject(new Error('Le modèle n’a pas pu être chargé.'));
        if (performance.now() - started > 120000) return reject(new Error('Chargement du modèle trop long.'));
        setTimeout(check, 100);
      };
      check();
    });
    return;
  }
  state.modelLoading = true;
  els.detectButton.disabled = true;
  setStatus('Chargement du modèle…', 'warn');
  ensureWorker().postMessage({ type: 'load-model' });
  await new Promise((resolve, reject) => {
    const started = performance.now();
    const check = () => {
      if (state.workerReady) return resolve();
      if (!state.modelLoading) return reject(new Error('Le modèle n’a pas pu être chargé.'));
      if (performance.now() - started > 120000) return reject(new Error('Chargement du modèle trop long.'));
      setTimeout(check, 100);
    };
    check();
  });
}


const APPEAR_W = 12;
const APPEAR_H = 18;
const appearanceCanvas = document.createElement('canvas');
appearanceCanvas.width = APPEAR_W;
appearanceCanvas.height = APPEAR_H;
const appearanceCtx = appearanceCanvas.getContext('2d', { willReadFrequently: true });

function captureAppearanceFrame() {
  const sourceW = els.video.videoWidth || 1280;
  const sourceH = els.video.videoHeight || 720;
  const width = Math.min(640, sourceW);
  const height = Math.max(1, Math.round(sourceH * width / sourceW));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'medium';
  ctx.drawImage(els.video, 0, 0, width, height);
  return { canvas, sourceW, sourceH };
}

function appearanceDescriptor(det, frame) {
  if (!frame?.canvas || !appearanceCtx) return null;
  const sx = frame.canvas.width / Math.max(1, frame.sourceW);
  const sy = frame.canvas.height / Math.max(1, frame.sourceH);
  const cx = det.cx * sx;
  const cy = det.cy * sy;
  const w = Math.max(2, det.w * sx);
  const h = Math.max(2, det.h * sy);
  const shortSide = Math.max(2, Math.min(w, h));
  const longSide = Math.max(2, Math.max(w, h));

  // OBB = rectangle tourné : un simple transform affine suffit pour le redresser.
  let theta = det.angle || 0;
  if (w > h) theta += Math.PI / 2;

  const ctx = appearanceCtx;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, APPEAR_W, APPEAR_H);
  ctx.fillStyle = '#777';
  ctx.fillRect(0, 0, APPEAR_W, APPEAR_H);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'medium';

  ctx.translate(APPEAR_W / 2, APPEAR_H / 2);
  ctx.scale(APPEAR_W / shortSide, APPEAR_H / longSide);
  ctx.rotate(-theta);
  ctx.translate(-cx, -cy);
  ctx.drawImage(frame.canvas, 0, 0);

  const px = ctx.getImageData(0, 0, APPEAR_W, APPEAR_H).data;
  const raw = [];
  const lumas = [];

  // Ignore un pixel de bord : moins sensible aux sleeves et aux imprécisions de bbox.
  for (let y = 1; y < APPEAR_H - 1; y += 1) {
    for (let x = 1; x < APPEAR_W - 1; x += 1) {
      const i = (y * APPEAR_W + x) * 4;
      const r = px[i] / 255;
      const g = px[i + 1] / 255;
      const b = px[i + 2] / 255;
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      lumas.push(lum);
      raw.push([r, g, b, lum]);
    }
  }

  if (!raw.length) return null;
  const mean = lumas.reduce((a, b) => a + b, 0) / lumas.length;
  const variance = lumas.reduce((a, v) => a + (v - mean) ** 2, 0) / lumas.length;
  const std = Math.max(0.06, Math.sqrt(variance));

  const values = new Float32Array(raw.length * 3);
  raw.forEach(([r, g, b, lum], p) => {
    const sum = r + g + b + 0.12;
    values[p * 3] = Math.max(-2.5, Math.min(2.5, (lum - mean) / std));
    values[p * 3 + 1] = (r - g) / sum;
    values[p * 3 + 2] = (b - g) / sum;
  });
  return values;
}

function cosineAppearance(a, b, flip180 = false) {
  if (!a || !b || a.length !== b.length || a.length < 3) return null;
  const pixels = Math.floor(a.length / 3);
  let dot = 0, aa = 0, bb = 0;
  for (let p = 0; p < pixels; p += 1) {
    const q = flip180 ? (pixels - 1 - p) : p;
    for (let c = 0; c < 3; c += 1) {
      const av = a[p * 3 + c];
      const bv = b[q * 3 + c];
      dot += av * bv;
      aa += av * av;
      bb += bv * bv;
    }
  }
  if (aa < 1e-6 || bb < 1e-6) return null;
  const cos = Math.max(-1, Math.min(1, dot / Math.sqrt(aa * bb)));
  return (cos + 1) / 2;
}

function appearancePairScore(a, b) {
  const direct = cosineAppearance(a, b, false);
  const flipped = cosineAppearance(a, b, true);
  if (direct == null) return flipped;
  if (flipped == null) return direct;
  return Math.max(direct, flipped);
}

function trackAppearanceScore(det, track) {
  if (!det?.appearance) return null;
  const scores = [
    appearancePairScore(det.appearance, track.appearanceAnchor),
    appearancePairScore(det.appearance, track.appearanceRecent)
  ].filter(Number.isFinite);
  return scores.length ? Math.max(...scores) : null;
}

function attachAppearance(detections, frame) {
  if (!els.visualLockToggle?.checked || !frame) return detections;
  return detections.map((det) => ({
    ...det,
    appearance: appearanceDescriptor(det, frame)
  }));
}

function stripAppearance(obj) {
  if (!obj) return obj;
  const { appearance, appearanceAnchor, appearanceRecent, ...rest } = obj;
  return rest;
}

function canonicalAspect(det) {
  const short = Math.max(1, Math.min(det.w, det.h));
  const long = Math.max(det.w, det.h);
  return long / short;
}

function detectionAreaFraction(det) {
  const frameArea = Math.max(1, els.overlay.width * els.overlay.height);
  return (Math.max(1, det.w) * Math.max(1, det.h)) / frameArea;
}

function median(values) {
  const xs = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!xs.length) return null;
  const m = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[m] : (xs[m - 1] + xs[m]) / 2;
}

function normalizedAngleDistance(a, b) {
  let d = Math.abs((a || 0) - (b || 0)) % Math.PI;
  if (d > Math.PI / 2) d = Math.PI - d;
  return Math.abs(d);
}

function isNearDuplicate(a, b) {
  const sa = Math.max(1, Math.min(a.w, a.h));
  const sb = Math.max(1, Math.min(b.w, b.h));
  const center = Math.hypot(a.cx - b.cx, a.cy - b.cy) / Math.max(1, (sa + sb) / 2);
  const ar = Math.max(a.w * a.h, b.w * b.h) / Math.max(1, Math.min(a.w * a.h, b.w * b.h));
  const angle = normalizedAngleDistance(a.angle, b.angle);
  return center < 0.30 && ar < 1.55 && angle < 0.24;
}

function suppressDuplicateDetections(detections) {
  const kept = [];
  let rejected = 0;
  for (const det of [...detections].sort((a, b) => b.conf - a.conf)) {
    if (kept.some((other) => isNearDuplicate(det, other))) {
      rejected += 1;
      continue;
    }
    kept.push(det);
  }
  return { kept, rejected };
}

function expectedCardAreaFraction(strongDetections) {
  // On mélange les détections fortes du cycle avec les pistes déjà confirmées.
  // La médiane reste robuste même si un motif du tapis obtient ponctuellement un score élevé.
  const areas = [];
  strongDetections.forEach((d) => {
    const a = detectionAreaFraction(d);
    if (a >= 0.0010 && a <= 0.085) areas.push(a);
  });
  activeTracks().forEach((t) => {
    const a = detectionAreaFraction(t);
    if (a >= 0.0010 && a <= 0.085) areas.push(a);
  });
  return areas.length >= 2 ? median(areas) : null;
}

function filterTableDetections(incoming) {
  const stats = { shape: 0, scale: 0, duplicate: 0, weakRejected: 0, rescued: 0 };
  const weakFloor = Math.max(0.35, state.confidence - 0.12);

  // Même si le filtre UI est désactivé, le curseur de confiance reste le seuil final.
  if (!els.shapeFilterToggle?.checked) {
    const strongOnly = incoming.filter((d) => d.conf >= state.confidence);
    state.filterStats = stats;
    state.shapeRejected = incoming.length - strongOnly.length;
    return strongOnly;
  }

  // 1. Forme + taille physique maximale pour une vue de table.
  // Dans le diagnostic réel : cartes ~2–4 % de la frame ; faux Dark Vador ~14 %.
  const geometric = [];
  for (const det of incoming) {
    const ratio = canonicalAspect(det);
    const area = detectionAreaFraction(det);
    if (ratio < 1.18 || ratio > 1.82 || area < 0.0008 || area > 0.085) {
      stats.shape += 1;
      continue;
    }
    geometric.push(det);
  }

  // 2. Une seule détection par objet quasi identique.
  const dedup = suppressDuplicateDetections(geometric);
  stats.duplicate = dedup.rejected;

  // 3. Les détections >= seuil utilisateur sont les ancres.
  let strong = dedup.kept.filter((d) => d.conf >= state.confidence);
  const expected = expectedCardAreaFraction(strong);

  // 4. Cohérence d'échelle : une caméra fixe voit les cartes sur le même plan.
  // On ne rejette ici que les objets beaucoup TROP GRANDS ; on reste permissif pour
  // les cartes partiellement visibles ou proches du bord.
  if (expected) {
    const maxRelative = expected * 2.65;
    const filteredStrong = [];
    for (const det of strong) {
      if (detectionAreaFraction(det) > Math.max(0.055, maxRelative)) {
        stats.scale += 1;
        continue;
      }
      filteredStrong.push(det);
    }
    strong = filteredStrong;
  }

  // 5. Rescue : on laisse le worker descendre 12 points sous le curseur.
  // Une détection faible n'est récupérée QUE si au moins deux références de taille
  // existent et que son échelle est cohérente avec la table.
  const accepted = [...strong.map((d) => ({ ...d, rescuedLowConfidence: false }))];
  const acceptedRefs = new Set(strong);
  if (expected) {
    for (const det of dedup.kept) {
      if (acceptedRefs.has(det) || det.conf >= state.confidence) continue;
      if (det.conf < weakFloor) {
        stats.weakRejected += 1;
        continue;
      }
      const a = detectionAreaFraction(det);
      const scaleRatio = a / expected;
      if (scaleRatio >= 0.45 && scaleRatio <= 1.95) {
        accepted.push({ ...det, rescuedLowConfidence: true });
        stats.rescued += 1;
      } else {
        stats.weakRejected += 1;
      }
    }
  } else {
    stats.weakRejected += dedup.kept.filter((d) => d.conf < state.confidence).length;
  }

  state.filterStats = stats;
  state.shapeRejected = stats.shape + stats.scale + stats.duplicate + stats.weakRejected;
  return accepted.sort((a, b) => b.conf - a.conf);
}

function trackCost(det, track) {
  const dx = det.cx - track.cx;
  const dy = det.cy - track.cy;
  const detShort = Math.max(1, Math.min(det.w, det.h));
  const trackShort = Math.max(1, Math.min(track.w, track.h));
  const ref = Math.max(55, (detShort + trackShort) * 0.85);
  const spatial = Math.hypot(dx, dy) / ref;
  const areaRatio = Math.abs(Math.log(Math.max(1, det.w * det.h) / Math.max(1, track.w * track.h)));
  const aspectRatio = Math.abs(Math.log(canonicalAspect(det) / canonicalAspect(track)));
  let cost = spatial + Math.min(areaRatio, 1.5) * 0.18 + Math.min(aspectRatio, 0.8) * 0.12;

  if (els.visualLockToggle?.checked) {
    const sim = trackAppearanceScore(det, track);
    if (Number.isFinite(sim)) {
      // Empêche surtout une piste confirmée de sauter vers une carte voisine visuellement différente.
      // Si les centres sont pratiquement identiques, on reste tolérant aux reflets/occlusions.
      if (track.confirmed && sim < 0.48 && spatial > 0.20) return 99;
      cost += (1 - sim) * 1.25;
    }
  }
  return cost;
}

function assignDisplayIds(tracks) {
  const used = new Set(
    tracks
      .filter((t) => t.confirmed && Number.isInteger(t.displayId))
      .map((t) => t.displayId)
  );
  for (const track of tracks) {
    if (!track.confirmed || Number.isInteger(track.displayId)) continue;
    while (used.has(state.nextDisplayId)) state.nextDisplayId += 1;
    track.displayId = state.nextDisplayId;
    used.add(track.displayId);
    state.nextDisplayId += 1;
  }
}

function isCardLikeShape(det) {
  const ratio = canonicalAspect(det);
  const areaFraction = detectionAreaFraction(det);
  return ratio >= 1.18 && ratio <= 1.82 && areaFraction >= 0.0008 && areaFraction <= 0.085;
}

function confirmationWindow() {
  return Math.max(state.confirmationsNeeded + state.maxMisses + 1, state.confirmationsNeeded * 2);
}

function maybeConfirm(track) {
  if (track.confirmed) return track;
  const minSeq = state.analysisSeq - confirmationWindow() + 1;
  track.hitSeqs = (track.hitSeqs || []).filter((seq) => seq >= minSeq);
  const required = Math.max(
    state.confirmationsNeeded,
    Number(track.requiredConfirmations || state.confirmationsNeeded)
  );
  if (track.hitSeqs.length >= required) {
    track.confirmed = true;
    track.confirmedAtSeq = state.analysisSeq;
    if (!track.appearanceAnchor && track.appearanceRecent) {
      track.appearanceAnchor = track.appearanceRecent;
    }
  }
  return track;
}


function pruneLostTracks(now = performance.now()) {
  state.lostTracks = (state.lostTracks || []).filter((t) =>
    Number.isInteger(t.displayId) &&
    Number.isFinite(t.lostAtMs) &&
    now - t.lostAtMs <= state.identityMemoryMs
  );
}

function rememberLostTrack(track, now = performance.now()) {
  if (!track?.confirmed || !Number.isInteger(track.displayId)) return;
  // Une seule mémoire par ID.
  state.lostTracks = (state.lostTracks || []).filter((t) => t.displayId !== track.displayId);
  state.lostTracks.push({
    ...track,
    misses: 0,
    lostAtMs: now,
    rememberedCx: track.cx,
    rememberedCy: track.cy
  });
  pruneLostTracks(now);
}

function restoreLostTracks(detections, matchedDet, next, now = performance.now()) {
  pruneLostTracks(now);
  if (!state.lostTracks.length) return;

  const pairs = [];
  detections.forEach((det, di) => {
    if (matchedDet.has(di)) return;
    state.lostTracks.forEach((track, li) => {
      const cost = trackCost(det, track);
      const displacement = Math.hypot(det.cx - track.cx, det.cy - track.cy);
      const ref = Math.max(55, Math.max(track.w, track.h, det.w, det.h));
      const visual = trackAppearanceScore(det, track);

      if (els.visualLockToggle?.checked) {
        // Sans empreinte visuelle fiable, on ne recycle plus un ancien ID uniquement
        // parce qu'une autre carte est apparue au même endroit.
        if (!Number.isFinite(visual) || visual < state.reidSimilarity) return;
      }

      if (cost < 2.25 && displacement / ref < 1.05) {
        pairs.push({
          di, li,
          cost: cost + (Number.isFinite(visual) ? (1 - visual) * 0.8 : 0),
          visual
        });
      }
    });
  });

  pairs.sort((a, b) => a.cost - b.cost);
  const usedLost = new Set();

  for (const pair of pairs) {
    if (matchedDet.has(pair.di) || usedLost.has(pair.li)) continue;
    const det = detections[pair.di];
    const old = state.lostTracks[pair.li];

    matchedDet.add(pair.di);
    usedLost.add(pair.li);

    next.push({
      ...old,
      ...det,
      confirmed: true,
      misses: 0,
      lastSeenSeq: state.analysisSeq,
      hitSeqs: [...(old.hitSeqs || []), state.analysisSeq],
      appearanceAnchor: old.appearanceAnchor || old.appearanceRecent || det.appearance || null,
      appearanceRecent: det.appearance || old.appearanceRecent || null,
      revivedAtMs: now,
      lostAtMs: null
    });
  }

  if (usedLost.size) {
    state.lostTracks = state.lostTracks.filter((_, i) => !usedLost.has(i));
  }
}

function updateTracks(detections) {
  const now = performance.now();
  pruneLostTracks(now);

  if (!els.trackingToggle.checked) {
    state.tracks = detections.map((d, i) => ({
      ...d,
      uid: i + 1,
      displayId: i + 1,
      confirmed: true,
      misses: 0,
      hitSeqs: [state.analysisSeq]
    }));
    return;
  }

  const tracks = state.tracks.filter((t) => t.misses <= state.maxMisses);
  const pairs = [];
  detections.forEach((det, di) => {
    tracks.forEach((track, ti) => {
      const cost = trackCost(det, track);
      if (cost < 2.25) pairs.push({ di, ti, cost });
    });
  });
  pairs.sort((a, b) => a.cost - b.cost);

  const matchedDet = new Set();
  const matchedTrack = new Set();
  const assignment = new Map();
  for (const pair of pairs) {
    if (matchedDet.has(pair.di) || matchedTrack.has(pair.ti)) continue;
    matchedDet.add(pair.di);
    matchedTrack.add(pair.ti);
    assignment.set(pair.ti, pair.di);
  }

  const next = [];

  tracks.forEach((track, ti) => {
    if (assignment.has(ti)) {
      const det = detections[assignment.get(ti)];
      const displacement = Math.hypot(det.cx - track.cx, det.cy - track.cy);
      const shortSide = Math.max(1, Math.min(track.w, track.h, det.w, det.h));
      const movedClearly = displacement > shortSide * 0.32 || (track.misses || 0) > 0;
      // Petit jitter : lissage. Déplacement réel : recadrage immédiat sur la nouvelle
      // détection au lieu de laisser le cadre poursuivre la carte pendant plusieurs cycles.
      const alpha = movedClearly ? 1 : (track.confirmed ? 0.72 : 0.88);
      const updated = {
        ...track,
        cx: track.cx * (1 - alpha) + det.cx * alpha,
        cy: track.cy * (1 - alpha) + det.cy * alpha,
        w: track.w * (1 - alpha) + det.w * alpha,
        h: track.h * (1 - alpha) + det.h * alpha,
        angle: det.angle,
        conf: det.conf,
        cls: det.cls,
        rescuedLowConfidence: Boolean(det.rescuedLowConfidence),
        requiredConfirmations: det.rescuedLowConfidence ? state.confirmationsNeeded + 1 : state.confirmationsNeeded,
        misses: 0,
        lastSeenSeq: state.analysisSeq,
        hitSeqs: [...(track.hitSeqs || []), state.analysisSeq],
        appearanceAnchor: track.appearanceAnchor || track.appearanceRecent || det.appearance || null,
        appearanceRecent: det.appearance || track.appearanceRecent || null
      };
      next.push(maybeConfirm(updated));
    } else {
      const missed = { ...track, misses: (track.misses || 0) + 1 };
      if (missed.misses <= state.maxMisses) {
        next.push(missed);
      } else {
        rememberLostTrack(missed, now);
      }
    }
  });

  // Avant de créer de nouveaux IDs, tente de réveiller les cartes confirmées
  // récemment perdues. Le cadre n'était plus affiché, mais leur identité était gardée.
  restoreLostTracks(detections, matchedDet, next, now);

  detections.forEach((det, di) => {
    if (matchedDet.has(di)) return;
    const fresh = maybeConfirm({
      ...det,
      uid: state.nextUid++,
      displayId: null,
      confirmed: false,
      misses: 0,
      firstSeenSeq: state.analysisSeq,
      lastSeenSeq: state.analysisSeq,
      hitSeqs: [state.analysisSeq],
      appearanceAnchor: null,
      appearanceRecent: det.appearance || null,
      rescuedLowConfidence: Boolean(det.rescuedLowConfidence),
      requiredConfirmations: det.rescuedLowConfidence ? state.confirmationsNeeded + 1 : state.confirmationsNeeded
    });
    next.push(fresh);
  });

  // Attribution en une seule passe après mise à jour : garantit qu'aucune paire de
  // cartes confirmées dans le même cycle ne reçoit le même numéro.
  assignDisplayIds(next);

  // Les pistes confirmées sont prioritaires. Les provisoires très faibles sont limitées
  // afin qu'un décor instable ne remplisse pas le tracker.
  state.tracks = next
    .sort((a, b) => Number(b.confirmed) - Number(a.confirmed) || b.conf - a.conf)
    .slice(0, 80);
}

function corners(det) {
  const c = Math.cos(det.angle);
  const s = Math.sin(det.angle);
  const hw = det.w / 2;
  const hh = det.h / 2;
  return [[-hw,-hh],[hw,-hh],[hw,hh],[-hw,hh]].map(([x,y]) => [
    det.cx + x * c - y * s,
    det.cy + x * s + y * c
  ]);
}

function drawTrack(ctx, det) {
  const pts = corners(det);
  const hue = det.conf >= 0.7 ? '#64e6a4' : det.conf >= 0.55 ? '#ffc857' : '#46d6ff';
  const stale = det.misses > 0;
  ctx.save();
  ctx.globalAlpha = stale ? 0.56 : 1;
  ctx.lineWidth = Math.max(2, els.overlay.width / 700);
  ctx.strokeStyle = hue;
  ctx.fillStyle = 'rgba(6,10,14,.66)';
  if (stale) ctx.setLineDash([10, 7]);
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  pts.slice(1).forEach((p) => ctx.lineTo(p[0], p[1]));
  ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);
  const label = `CARD ${String(det.displayId).padStart(2, '0')} · ${Math.round(det.conf * 100)} %`;
  const fontSize = Math.max(13, els.overlay.width / 85);
  ctx.font = `700 ${fontSize}px system-ui`;
  const metrics = ctx.measureText(label);
  const x = Math.max(4, Math.min(pts[0][0], els.overlay.width - metrics.width - 18));
  const y = Math.max(fontSize + 8, pts[0][1]);
  ctx.fillRect(x - 5, y - fontSize - 5, metrics.width + 10, fontSize + 10);
  ctx.fillStyle = hue;
  ctx.fillText(label, x, y);
  ctx.restore();
}

function provisionalTracks() {
  // Réaction visuelle dès le premier hit fort, sans attribuer de CARD XX avant confirmation.
  // Cela ne change pas la logique de validation : confirmationsNeeded reste appliqué.
  return state.tracks.filter((t) =>
    !t.confirmed &&
    (t.misses || 0) === 0 &&
    t.conf >= Math.max(state.confidence, 0.75)
  );
}

function drawProvisional(ctx, det) {
  const pts = corners(det);
  ctx.save();
  ctx.globalAlpha = 0.72;
  ctx.lineWidth = Math.max(2, els.overlay.width / 850);
  ctx.strokeStyle = '#46d6ff';
  ctx.setLineDash([9, 7]);
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  pts.slice(1).forEach((p) => ctx.lineTo(p[0], p[1]));
  ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);
  const label = `DÉTECTION · ${Math.round(det.conf * 100)} %`;
  const fontSize = Math.max(12, els.overlay.width / 92);
  ctx.font = `700 ${fontSize}px system-ui`;
  const m = ctx.measureText(label);
  const x = Math.max(4, Math.min(pts[0][0], els.overlay.width - m.width - 18));
  const y = Math.max(fontSize + 8, pts[0][1]);
  ctx.fillStyle = 'rgba(6,10,14,.60)';
  ctx.fillRect(x - 5, y - fontSize - 5, m.width + 10, fontSize + 10);
  ctx.fillStyle = '#46d6ff';
  ctx.fillText(label, x, y);
  ctx.restore();
}

function activeTracks() {
  return state.tracks.filter((t) => t.confirmed && t.misses <= state.maxMisses);
}

function drawOverlay() {
  const ctx = els.overlay.getContext('2d');
  ctx.clearRect(0, 0, els.overlay.width, els.overlay.height);
  const active = activeTracks();

  // Player UI: the detector is invisible. Boxes can still be enabled for alpha diagnosis.
  if (state.debugOverlay) {
    provisionalTracks().forEach((t) => drawProvisional(ctx, t));
    active.forEach((t) => drawTrack(ctx, t));
  }

  els.metricCards.textContent = String(active.length);
}

let inferenceTimer = null;
function clearInferenceTimer() {
  if (inferenceTimer) clearTimeout(inferenceTimer);
  inferenceTimer = null;
}

function scheduleNextInference(delay = state.intervalMs) {
  clearInferenceTimer();
  if (!state.detecting) return;
  inferenceTimer = setTimeout(runInference, Math.max(20, delay));
}

async function runInference() {
  if (!state.detecting || !state.workerReady || !state.stream || state.inferenceBusy) {
    if (state.detecting) scheduleNextInference(100);
    return;
  }
  if (!els.video.videoWidth || !els.video.videoHeight) {
    scheduleNextInference(100);
    return;
  }
  state.inferenceBusy = true;
  try {
    const requestId = ++state.requestSeq;
    // Copie légère de la frame exacte analysée : l'empreinte visuelle est calculée
    // sur le même instant que les coordonnées YOLO, pas ~500 ms plus tard.
    if (els.visualLockToggle?.checked) {
      state.analysisFrames.set(requestId, captureAppearanceFrame());
      // Une seule inférence est active, mais garde-fou si une ancienne réponse est perdue.
      for (const key of [...state.analysisFrames.keys()]) {
        if (key < requestId - 2) state.analysisFrames.delete(key);
      }
    }
    const bitmap = await createImageBitmap(els.video);
    // Le modèle peut proposer des candidats légèrement sous le seuil UI.
    // Le navigateur ne les sauve que si leur taille est cohérente avec les cartes de la table.
    const workerConfidenceFloor = els.shapeFilterToggle?.checked
      ? Math.max(0.35, state.confidence - 0.12)
      : state.confidence;
    state.lastWorkerConfidenceFloor = workerConfidenceFloor;
    state.worker.postMessage({
      type: 'infer',
      requestId,
      confidence: workerConfidenceFloor,
      bitmap
    }, [bitmap]);
  } catch (err) {
    state.inferenceBusy = false;
    state.detecting = false;
    els.detectButton.textContent = 'Activer la détection';
    setStatus('Erreur capture vidéo', 'error');
    showWarning(`Capture de frame : ${err?.message || err}`);
  }
}

async function toggleDetection() {
  if (state.detecting) {
    state.detecting = false;
    clearInferenceTimer();
    els.detectButton.textContent = 'Activer la détection';
    setStatus('Détection en pause', 'warn');
    return;
  }
  try {
    await ensureModel();
    state.detecting = true;
    els.detectButton.textContent = 'Mettre en pause';
    setStatus(`Détection active · ${state.provider}`, 'good');
    scheduleNextInference(50);
  } catch (err) {
    setStatus('Modèle indisponible', 'error');
    showWarning(err?.message || String(err));
  }
}

function updateMetrics() {
  els.metricVideoFps.textContent = String(state.videoFps || 0);
  els.metricDetectFps.textContent = String(state.detectTimestamps.length);
  els.metricPreprocess.textContent = state.lastPreprocessMs ? `${state.lastPreprocessMs.toFixed(0)} ms` : '—';
  els.metricInference.textContent = state.lastInferenceMs ? `${state.lastInferenceMs.toFixed(0)} ms` : '—';
  els.metricTotal.textContent = state.lastTotalMs ? `${state.lastTotalMs.toFixed(0)} ms` : '—';
  els.metricProvider.textContent = state.provider || '—';
  els.metricOutput.textContent = state.outputShape;
  if (els.metricShapeRejected) els.metricShapeRejected.textContent = String(state.shapeRejected || 0);
  drawOverlay();
  requestAnimationFrame(updateMetrics);
}

function canvasBlob(canvas, type = 'image/jpeg', quality = 0.92) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function identificationSnapshot() {
  try {
    return window.TCGIdentificationLab?.getSnapshot?.() || null;
  } catch {
    return null;
  }
}

function drawCapturePointer(ctx, snapshot) {
  const p = snapshot?.pointer;
  if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return;

  const x = p.x;
  const y = p.y;
  const r = Math.max(10, ctx.canvas.width / 95);

  ctx.save();
  ctx.lineWidth = Math.max(3, ctx.canvas.width / 430);
  ctx.strokeStyle = '#111';
  ctx.fillStyle = '#ffd51f';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.lineWidth = Math.max(2, ctx.canvas.width / 650);
  ctx.strokeStyle = '#ffd51f';
  ctx.beginPath();
  ctx.moveTo(x-r*1.7, y);
  ctx.lineTo(x+r*1.7, y);
  ctx.moveTo(x, y-r*1.7);
  ctx.lineTo(x, y+r*1.7);
  ctx.stroke();

  const label = snapshot.pointerInsideStage ? 'POINTEUR' : 'DERNIER POINTEUR VIDEO';
  const fs = Math.max(13, ctx.canvas.width / 90);
  ctx.font = `700 ${fs}px system-ui`;
  const m = ctx.measureText(label);
  const lx = Math.min(ctx.canvas.width - m.width - 14, Math.max(7, x + r + 8));
  const ly = Math.min(ctx.canvas.height - 8, Math.max(fs + 8, y - r - 5));
  ctx.fillStyle = 'rgba(4,7,10,.78)';
  ctx.fillRect(lx-5, ly-fs-5, m.width+10, fs+10);
  ctx.fillStyle = '#ffd51f';
  ctx.fillText(label, lx, ly);
  ctx.restore();
}


async function exactMatcherCropBlob() {
  try {
    const dataUrl=window.TCGIdentificationLab?.getAnalyzedCropDataUrl?.();
    if (!dataUrl) return null;
    const r=await fetch(dataUrl);
    return await r.blob();
  } catch {
    return null;
  }
}

async function captureCase(trigger = 'panel') {
  if (!state.stream || !els.video.videoWidth) return;
  if (state.captures.length >= MAX_CAPTURES) {
    showWarning(`Maximum de ${MAX_CAPTURES} captures atteint. Exporte ou vide les captures.`);
    return;
  }
  const w = els.video.videoWidth;
  const h = els.video.videoHeight;
  const raw = document.createElement('canvas'); raw.width = w; raw.height = h;
  raw.getContext('2d').drawImage(els.video, 0, 0, w, h);
  const identSnapshot = identificationSnapshot();

  const overlayed = document.createElement('canvas'); overlayed.width = w; overlayed.height = h;
  const octx = overlayed.getContext('2d');
  octx.drawImage(raw, 0, 0);
  activeTracks().forEach((t) => drawTrack(octx, t));
  drawCapturePointer(octx, identSnapshot);

  let hoveredCardBlob = await exactMatcherCropBlob();
  const hoveredUid = identSnapshot?.hoveredTrack?.uid;
  if (!hoveredCardBlob && hoveredUid != null) {
    const hovered = activeTracks().find((t) => t.uid === hoveredUid);
    if (hovered) {
      const crop = captureCanonicalTrackCanvas(hovered, 432, 624);
      hoveredCardBlob = await canvasBlob(crop, 'image/jpeg', 0.94);
    }
  }

  const [rawBlob, overlayBlob] = await Promise.all([canvasBlob(raw), canvasBlob(overlayed)]);
  const id = state.captures.length + 1;
  state.captures.push({
    id,
    rawBlob,
    overlayBlob,
    hoveredCardBlob,
    meta: {
      id,
      timestamp: new Date().toISOString(),
      note: els.caseNote.value.trim(),
      trigger,
      pointerAndIdentification: identSnapshot,
      video: { width: w, height: h },
      settings: {
        confidence: state.confidence,
        workerConfidenceFloor: state.lastWorkerConfidenceFloor,
        intervalMs: state.intervalMs,
        tracking: els.trackingToggle.checked,
        confirmationsNeeded: state.confirmationsNeeded,
        maxMisses: state.maxMisses,
        identityMemoryMs: state.identityMemoryMs,
        visualIdLock: Boolean(els.visualLockToggle?.checked),
        reidSimilarity: state.reidSimilarity,
        rememberedIds: state.lostTracks.length,
        shapeFilter: Boolean(els.shapeFilterToggle?.checked),
        tableAwareFilter: true,
        filterStats: { ...state.filterStats },
        provider: state.provider,
        modelInputSize: 512
      },
      metrics: {
        preprocessMs: state.lastPreprocessMs,
        inferenceMs: state.lastInferenceMs,
        totalMs: state.lastTotalMs,
        detectionFps: state.detectTimestamps.length,
        videoFps: state.videoFps,
        outputShape: state.outputShape
      },
      detections: state.rawDetections.map(stripAppearance),
      tracks: activeTracks().map((t) => ({ ...stripAppearance(t), corners: corners(t) }))
    }
  });
  els.caseNote.value = '';
  refreshCaptureUi();
  setStatus(`Cas ${id} capturé`, 'good');
}

function refreshCaptureUi() {
  const n = state.captures.length;
  els.captureCount.textContent = String(n);
  if (els.topCaptureCount) els.topCaptureCount.textContent = String(n);
  els.exportButton.disabled = n === 0;
  if (els.exportTopButton) els.exportTopButton.disabled = n === 0;
  els.clearButton.disabled = n === 0;
}

async function exportZip() {
  if (!state.captures.length) return;
  if (!window.JSZip) {
    showWarning('JSZip ne s’est pas chargé. Vérifie la connexion Internet puis recharge la page.');
    return;
  }
  setStatus('Création du ZIP…', 'warn');
  const zip = new JSZip();
  const root = zip.folder('detection-tests');
  root.file('report.json', JSON.stringify({
    version: '0.2.0-alpha15-v53-512-persistent-hover-cache',
    exportedAt: new Date().toISOString(),
    browser: navigator.userAgent,
    captures: state.captures.length,
    provider: state.provider,
    model: 'TCG Card Detector v5.3 overlap (YOLO26n OBB 512 performance)',
    architecture: 'v53-overlap-512 + worker-fast-matcher + sliding-appearance-guarded-hover-cache + stationary-pointer-track-sync + recorder'
  }, null, 2));
  state.captures.forEach((item) => {
    const name = String(item.id).padStart(3, '0');
    root.file(`test-${name}-raw.jpg`, item.rawBlob);
    root.file(`test-${name}-overlay.jpg`, item.overlayBlob);
    if (item.hoveredCardBlob) {
      root.file(`test-${name}-hovered-card.jpg`, item.hoveredCardBlob);
    }
    root.file(`test-${name}.json`, JSON.stringify(item.meta, null, 2));
  });
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `tcg-detection-tests-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  setStatus('ZIP exporté', 'good');
}

els.cameraButton.addEventListener('click', startCamera);
els.detectButton.addEventListener('click', toggleDetection);
els.cameraSelect.addEventListener('change', async () => { if (state.stream) { await stopCamera(); await startCamera(); } });
els.resolutionSelect.addEventListener('change', async () => { if (state.stream) { await stopCamera(); await startCamera(); } });
els.confidenceSlider.addEventListener('input', () => {
  state.confidence = Number(els.confidenceSlider.value) / 100;
  els.confidenceValue.textContent = `${els.confidenceSlider.value} %`;
});
els.intervalSlider.addEventListener('input', () => {
  state.intervalMs = Number(els.intervalSlider.value);
  els.intervalValue.textContent = `${state.intervalMs} ms`;
  if (state.detecting && !state.inferenceBusy) scheduleNextInference();
});
els.confirmationsSlider.addEventListener('input', () => {
  state.confirmationsNeeded = Number(els.confirmationsSlider.value);
  els.confirmationsValue.textContent = String(state.confirmationsNeeded);
});
els.missesSlider.addEventListener('input', () => {
  state.maxMisses = Number(els.missesSlider.value);
  els.missesValue.textContent = String(state.maxMisses);
});
els.idMemorySlider?.addEventListener('input', () => {
  state.identityMemoryMs = Number(els.idMemorySlider.value) * 1000;
  els.idMemoryValue.textContent = `${els.idMemorySlider.value} s`;
  pruneLostTracks();
});
els.reidSlider?.addEventListener('input', () => {
  state.reidSimilarity = Number(els.reidSlider.value) / 100;
  els.reidValue.textContent = `${els.reidSlider.value} %`;
});
els.visualLockToggle?.addEventListener('change', () => {
  // On remet les associations à zéro lorsque la stratégie d'identité change,
  // pour ne pas garder de pistes créées sans empreinte.
  resetTracking(els.visualLockToggle.checked ? 'Verrouillage visuel activé' : 'Verrouillage visuel désactivé');
});
els.shapeFilterToggle?.addEventListener('change', () => resetTracking('Filtre de forme modifié · tracking réinitialisé'));
els.trackingToggle.addEventListener('change', () => resetTracking('Tracking réinitialisé'));
els.resetTrackingButton.addEventListener('click', () => resetTracking('IDs réinitialisés'));
els.captureButton.addEventListener('click', () => captureCase('panel-button'));
els.quickCaptureButton?.addEventListener('click', () => captureCase('toolbar-button'));

document.addEventListener('keydown', (event) => {
  const tag = document.activeElement?.tagName?.toLowerCase();
  const editing = ['input', 'textarea', 'select'].includes(tag) || document.activeElement?.isContentEditable;
  if (editing || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;

  if (event.key.toLowerCase() === 'c') {
    if (!state.stream || !els.video.videoWidth) return;
    event.preventDefault();
    captureCase('keyboard-c');
  }
});

els.exportButton.addEventListener('click', exportZip);
els.exportTopButton?.addEventListener('click', exportZip);
els.clearButton.addEventListener('click', () => { state.captures = []; refreshCaptureUi(); setStatus('Captures vidées'); });
window.addEventListener('resize', () => { if (state.stream) syncStageSize(); });
window.addEventListener('beforeunload', () => {
  state.stream?.getTracks().forEach((t) => t.stop());
  state.worker?.terminate();
});


// ---------------------------------------------------------------------------
// API minimale exposée à la branche d'identification.
// La détection stable reste propriétaire du flux, des pistes et de YOLO.
// ---------------------------------------------------------------------------
function captureCanonicalTrackCanvas(track, outW = 144, outH = 208) {
  if (!track || !els.video.videoWidth || !els.video.videoHeight) return null;
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.fillStyle = '#777';
  ctx.fillRect(0, 0, outW, outH);

  let shortSide, longSide, theta;
  if (track.w <= track.h) {
    shortSide = Math.max(2, track.w);
    longSide = Math.max(2, track.h);
    theta = track.angle || 0;
  } else {
    shortSide = Math.max(2, track.h);
    longSide = Math.max(2, track.w);
    theta = (track.angle || 0) + Math.PI / 2;
  }

  ctx.translate(outW / 2, outH / 2);
  ctx.scale(outW / shortSide, outH / longSide);
  ctx.rotate(-theta);
  ctx.translate(-track.cx, -track.cy);
  ctx.drawImage(els.video, 0, 0);
  return canvas;
}

async function preloadExternalVision() {
  await ensureModel();
  return { ready: state.workerReady, provider: state.provider };
}

function syncExternalVideoGeometry() {
  const w=els.video.videoWidth || 1280;
  const h=els.video.videoHeight || 720;
  els.overlay.width=w;
  els.overlay.height=h;
}

async function attachExternalStream(stream) {
  if (!stream) throw new Error('Flux adverse absent.');

  state.stream=stream;
  state.externalAttached=true;
  state.startedAt=state.startedAt || performance.now();

  if (els.video.srcObject !== stream) els.video.srcObject=stream;

  if (!els.video.videoWidth) {
    await new Promise((resolve)=>{
      const timer=setTimeout(resolve,2500);
      els.video.addEventListener('loadedmetadata',()=>{
        clearTimeout(timer);
        resolve();
      },{once:true});
    });
  }

  syncExternalVideoGeometry();
  resetTracking();
  startVideoFpsMeter();
  await ensureModel();

  if (!state.detecting) {
    state.detecting=true;
    els.detectButton.textContent='Mettre en pause';
    scheduleNextInference(50);
  }

  window.dispatchEvent(new CustomEvent('tcg-vision-state',{
    detail:{
      active:true,
      provider:state.provider,
      width:els.video.videoWidth,
      height:els.video.videoHeight
    }
  }));
  return true;
}

function detachExternalStream() {
  state.detecting=false;
  clearInferenceTimer();
  state.inferenceBusy=false;
  state.stream=null;
  state.externalAttached=false;
  resetTracking();

  window.dispatchEvent(new CustomEvent('tcg-vision-state',{
    detail:{active:false}
  }));
}

function getProductSnapshot() {
  return {
    version:'0.2.0-alpha15-v53-512-persistent-hover-cache',
    active:Boolean(state.detecting && state.externalAttached),
    modelReady:Boolean(state.workerReady),
    provider:state.provider || null,
    modelInputSize:512,
    confidence:state.confidence,
    workerConfidenceFloor:state.lastWorkerConfidenceFloor,
    activeCards:activeTracks().length,
    rawDetections:state.rawDetections.length,
    inference:{
      preprocessMs:Number(state.lastPreprocessMs || 0),
      inferenceMs:Number(state.lastInferenceMs || 0),
      totalMs:Number(state.lastTotalMs || 0),
      detectionFps:state.detectTimestamps.length,
      videoFps:Number(state.videoFps || 0),
      outputShape:state.outputShape
    },
    filters:{
      shapeRejected:Number(state.shapeRejected || 0),
      stats:{...state.filterStats}
    },
    tracking:{
      activeTracks:activeTracks().map(t=>({
        uid:t.uid,
        conf:Number(t.conf || 0),
        cx:Number(t.cx || 0),
        cy:Number(t.cy || 0),
        w:Number(t.w || 0),
        h:Number(t.h || 0),
        angle:Number(t.angle || 0),
        misses:Number(t.misses || 0)
      }))
    }
  };
}

window.TCGDetectionLab={
  version:'0.2.0-alpha15-v53-512-persistent-hover-cache',
  state,
  els,
  activeTracks,
  corners,
  captureCanonicalTrackCanvas,
  captureCase,
  setStatus,
  showWarning,
  refreshCaptureUi
};

window.TCGVisionEngine={
  version:'0.6-product-bridge-alpha15',
  preload:preloadExternalVision,
  attachRemoteStream:attachExternalStream,
  detachRemoteStream:detachExternalStream,
  getSnapshot:getProductSnapshot,
  setDebugOverlay(enabled){
    state.debugOverlay=Boolean(enabled);
    drawOverlay();
  }
};

refreshCaptureUi();
updateMetrics();
setStatus('Vision prête à être chargée');

})();
