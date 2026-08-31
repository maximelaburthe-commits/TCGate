'use strict';

const $ = id => document.getElementById(id);
const q = new URLSearchParams(location.search);
const pair = q.get('pair') || '';
const tokenKey = `tcgate-phone-camera-token-${pair}`;
const preferredCameraKey = 'tcgate-phone-camera-preferred-camera-v1';
const urlToken = q.get('token') || '';
if (urlToken) history.replaceState({}, '', `${location.pathname}?pair=${encodeURIComponent(pair)}`);

const st = {
  pair,
  token: urlToken || sessionStorage.getItem(tokenKey) || '',
  es: null,
  pc: null,
  sender: null,
  stream: null,
  config: null,
  events: [],
  lastBytes: null,
  lastAt: null,
  metrics: null,
  wake: null,
  eventsReconnect: null,
  statsTimer: null,
  offerBusy: false,
  pendingRemoteCandidates: [],
  localCandidates: [],
  canSendCandidates: false,
  signalChain: Promise.resolve(),
  restartAttempts: 0,
  hardResets: 0,
  lastCapture: null,
  orientationLandscape: false,
  peerGeneration: 0,
  recoveryEpoch: 0,
  recoveryActive: false,
  recoveryState: 'idle',
  lastConnectedAt: 0,
  performanceHistory: [],
  lowFpsStreak: 0,
  autoProfile: '1280x720',
  autoDowngrades: 0,
  cameraDevices: [],
  cameraAliases: new Map(),
  nextCameraAlias: 1,
  cameraCapabilities: null,
  captureBusy: false,
  lastCaptureChangeAt: 0,
  supportedVideoCodecs: [],
  codecPreference: 'browser-default',
  qualityFloorBreaches: 0,
  lowResolutionStreak: 0,
  remoteCommandCount: 0,
  lastControlStateAt: 0,
  energy: {
    batterySupported: null,
    batteryManager: null,
    initialBattery: null,
    cameraStartBattery: null,
    lastBattery: null,
    batteryHistory: [],
    cameraSessionStartedAt: null,
    chargingChangedDuringSession: false,
    lastChargingState: null,
    lastBatterySampleAt: 0,
    manualThermalFeel: 'not-provided',
  },
};


function cleanSettings(settings = {}) {
  const out = { ...settings };
  delete out.deviceId;
  delete out.groupId;
  return out;
}

function cleanCapabilities(caps = {}) {
  const out = { ...caps };
  delete out.deviceId;
  delete out.groupId;
  return out;
}

function log(type, data = {}) {
  st.events.push({ at: new Date().toISOString(), type, data });
  if (st.events.length > 240) st.events.shift();
}

function finiteOrNull(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function median(values = []) {
  const v = values.filter(Number.isFinite).slice().sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

function batterySnapshot(reason = 'sample') {
  const b = st.energy.batteryManager;
  if (!b) return null;
  return {
    at: new Date().toISOString(),
    reason,
    levelPct: Number.isFinite(b.level) ? Math.round(b.level * 1000) / 10 : null,
    charging: Boolean(b.charging),
    chargingTimeSec: finiteOrNull(b.chargingTime),
    dischargingTimeSec: finiteOrNull(b.dischargingTime),
  };
}

function updateBatteryUi(snapshot = st.energy.lastBattery) {
  if (!$('batteryDebug') || !$('batteryBadge')) return;
  if (st.energy.batterySupported === false) {
    $('batteryDebug').textContent = 'API batterie indisponible sur ce navigateur';
    $('batteryBadge').textContent = 'Batterie : API indisponible';
    return;
  }
  if (!snapshot) {
    $('batteryDebug').textContent = 'Analyse en attente…';
    $('batteryBadge').textContent = 'Batterie : …';
    return;
  }
  $('batteryDebug').textContent = `${snapshot.levelPct ?? '—'} %${snapshot.charging ? ' · en charge' : ' · sur batterie'}`;
  $('batteryBadge').textContent = `Batterie : ${snapshot.levelPct ?? '—'} %`;
  $('batteryBadge').classList.toggle('good', snapshot.levelPct != null && snapshot.levelPct >= 30);
}

function recordBatterySample(reason = 'timer', force = false) {
  if (!st.energy.batteryManager) return null;
  const now = Date.now();
  if (!force && now - st.energy.lastBatterySampleAt < 30000) return st.energy.lastBattery;
  const snap = batterySnapshot(reason);
  if (!snap) return null;
  st.energy.lastBatterySampleAt = now;
  st.energy.lastBattery = snap;
  st.energy.batteryHistory.push(snap);
  if (st.energy.batteryHistory.length > 240) st.energy.batteryHistory.shift();
  if (st.energy.lastChargingState != null && st.energy.lastChargingState !== snap.charging && st.energy.cameraSessionStartedAt) {
    st.energy.chargingChangedDuringSession = true;
  }
  st.energy.lastChargingState = snap.charging;
  updateBatteryUi(snap);
  return snap;
}

async function initBatteryTelemetry() {
  if (typeof navigator.getBattery !== 'function') {
    st.energy.batterySupported = false;
    updateBatteryUi();
    log('battery-api-unavailable');
    return;
  }
  try {
    const b = await navigator.getBattery();
    st.energy.batteryManager = b;
    st.energy.batterySupported = true;
    const initial = recordBatterySample('page-init', true);
    st.energy.initialBattery = initial;
    if (st.energy.cameraSessionStartedAt && !st.energy.cameraStartBattery) st.energy.cameraStartBattery = initial;
    for (const ev of ['levelchange', 'chargingchange', 'chargingtimechange', 'dischargingtimechange']) {
      b.addEventListener(ev, () => {
        const sample = recordBatterySample(ev, true);
        log('battery-change', { event: ev, levelPct: sample?.levelPct ?? null, charging: sample?.charging ?? null });
        pushControlState('battery-change').catch(() => {});
      });
    }
    log('battery-api-ready', { levelPct: initial?.levelPct ?? null, charging: initial?.charging ?? null });
  } catch (e) {
    st.energy.batterySupported = false;
    updateBatteryUi();
    log('battery-api-error', { message: e.message });
  }
}

function beginEnergySession() {
  if (!st.energy.cameraSessionStartedAt) {
    st.energy.cameraSessionStartedAt = Date.now();
    st.energy.chargingChangedDuringSession = false;
    const snap = recordBatterySample('camera-start', true);
    if (snap) st.energy.cameraStartBattery = snap;
    log('energy-session-start', { battery: snap ? { levelPct: snap.levelPct, charging: snap.charging } : null });
  }
}

function batteryAnalysis() {
  const end = recordBatterySample('report', true) || st.energy.lastBattery;
  const start = st.energy.cameraStartBattery || st.energy.initialBattery;
  const startedAt = st.energy.cameraSessionStartedAt;
  const durationSec = startedAt ? Math.max(0, (Date.now() - startedAt) / 1000) : null;
  const chargingObserved = Boolean(start?.charging || end?.charging || st.energy.chargingChangedDuringSession);
  const consumptionPct = start?.levelPct != null && end?.levelPct != null ? Math.round((start.levelPct - end.levelPct) * 10) / 10 : null;
  const estimatedPctPerHour = durationSec >= 300 && !chargingObserved && consumptionPct != null && consumptionPct >= 0
    ? Math.round((consumptionPct / (durationSec / 3600)) * 10) / 10
    : null;
  let assessment = 'insufficient-data';
  if (st.energy.batterySupported === false) assessment = 'unsupported';
  else if (chargingObserved) assessment = 'charging-during-session';
  else if (estimatedPctPerHour != null) assessment = estimatedPctPerHour <= 24 ? 'good' : estimatedPctPerHour <= 30 ? 'watch' : 'high';
  return {
    supported: st.energy.batterySupported,
    sessionStartedAt: startedAt ? new Date(startedAt).toISOString() : null,
    durationSec: durationSec != null ? Math.round(durationSec) : null,
    start,
    end,
    consumptionPct,
    estimatedPctPerHour,
    chargingObserved,
    assessment,
    history: st.energy.batteryHistory,
  };
}

function thermalAnalysis() {
  const samples = st.performanceHistory.filter(s => Number.isFinite(s.framesEncoded) && Number.isFinite(s.totalEncodeTime));
  const encodeCosts = [];
  for (let i = 1; i < samples.length; i++) {
    const df = samples[i].framesEncoded - samples[i - 1].framesEncoded;
    const dt = samples[i].totalEncodeTime - samples[i - 1].totalEncodeTime;
    if (df > 0 && dt >= 0) encodeCosts.push((dt * 1000) / df);
  }
  const third = Math.max(1, Math.floor(encodeCosts.length / 3));
  const encodeStart = median(encodeCosts.slice(0, third));
  const encodeEnd = median(encodeCosts.slice(-third));
  const encodeDriftPct = encodeStart && encodeEnd != null ? Math.round(((encodeEnd - encodeStart) / encodeStart) * 1000) / 10 : null;
  const fps = st.performanceHistory.map(s => Number(s.fps)).filter(Number.isFinite);
  const tailSize = Math.max(1, Math.floor(fps.length / 4));
  const fpsMedian = median(fps);
  const fpsTailMedian = median(fps.slice(-tailSize));
  const lowFpsRate = fps.length ? st.performanceHistory.filter(s => Number.isFinite(Number(s.fps)) && Number(s.fps) < 24).length / fps.length : null;
  const cpuDurationSec = Number(st.metrics?.qualityLimitationDurations?.cpu || 0);
  const cpuLimitedSamples = st.performanceHistory.filter(s => s.qualityLimitationReason === 'cpu').length;
  let status = 'stable';
  let throttlingSuspected = false;
  if ((cpuDurationSec >= 30 && (fpsTailMedian != null && fpsTailMedian < 24)) || (lowFpsRate != null && lowFpsRate >= 0.15 && cpuLimitedSamples >= 4)) {
    status = 'throttling-suspected';
    throttlingSuspected = true;
  } else if (cpuDurationSec > 5 || (lowFpsRate != null && lowFpsRate >= 0.05) || (encodeDriftPct != null && encodeDriftPct >= 30)) {
    status = 'pressure-observed';
  }
  return {
    status,
    throttlingSuspected,
    userFeel: st.energy.manualThermalFeel,
    note: 'Proxy de pression thermique basé sur WebRTC/encodage ; aucune température matérielle n’est accessible au navigateur.',
    fpsMedian,
    fpsTailMedian,
    lowFpsRatePct: lowFpsRate != null ? Math.round(lowFpsRate * 1000) / 10 : null,
    cpuLimitationDurationSec: Math.round(cpuDurationSec * 10) / 10,
    cpuLimitedSamples,
    encodeMsPerFrameMedian: median(encodeCosts) != null ? Math.round(median(encodeCosts) * 1000) / 1000 : null,
    encodeMsPerFrameStart: encodeStart != null ? Math.round(encodeStart * 1000) / 1000 : null,
    encodeMsPerFrameEnd: encodeEnd != null ? Math.round(encodeEnd * 1000) / 1000 : null,
    encodeCostDriftPct: encodeDriftPct,
    autoDowngrades: st.autoDowngrades,
    qualityFloorBreaches: st.qualityFloorBreaches,
  };
}

function updateThermalUi() {
  if (!$('thermalDebug')) return;
  const t = thermalAnalysis();
  const labels = { stable: 'Stable · aucun signe de throttling', 'pressure-observed': 'Pression observée · à surveiller', 'throttling-suspected': 'Throttling possible · vérifier la chauffe' };
  $('thermalDebug').textContent = labels[t.status] || t.status;
}

async function api(path, opt = {}) {
  const h = {};
  if (opt.body) h['Content-Type'] = 'application/json';
  if (st.token) h.Authorization = `Bearer ${st.token}`;
  const r = await fetch(path, {
    method: opt.method || 'GET',
    headers: h,
    body: opt.body ? JSON.stringify(opt.body) : undefined,
    cache: 'no-store',
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}

function status(text, ok = false) {
  $('status').querySelector('span:last-child').textContent = text;
  $('status').querySelector('.dot').classList.toggle('ok', ok);
}

function isLandscape() {
  return window.innerWidth >= window.innerHeight;
}

function updateStartState() {
  const landscape = isLandscape();
  st.orientationLandscape = landscape;
  $('orientationGuard').classList.toggle('hidden', landscape);
  $('orientationBadge').textContent = landscape ? 'Orientation : paysage' : 'Orientation : portrait';
  $('orientationBadge').classList.toggle('good', landscape);
  $('start').disabled = !landscape || Boolean(st.stream);
  if (!landscape && !st.stream) status('Tournez le téléphone à l’horizontale');
}

let orientationTimer = null;
function orientationChanged() {
  clearTimeout(orientationTimer);
  orientationTimer = setTimeout(async () => {
    const wasLandscape = st.orientationLandscape;
    updateStartState();
    if (wasLandscape && !st.orientationLandscape && st.stream) {
      log('orientation-portrait-stop');
      await stopCamera({ reason: 'orientation-portrait' });
      status('Caméra arrêtée · repassez en paysage');
    }
  }, 180);
}
window.addEventListener('resize', orientationChanged);
window.addEventListener('orientationchange', orientationChanged);

async function wake() {
  try {
    if ('wakeLock' in navigator) {
      if (st.wake && !st.wake.released) return;
      st.wake = await navigator.wakeLock.request('screen');
      $('wakeBadge').textContent = 'Écran : maintenu';
      st.wake.addEventListener('release', () => { $('wakeBadge').textContent = 'Écran : auto'; });
    }
  } catch {}
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && st.stream) wake();
});

async function loadRtc() {
  st.config = await api(`/api/phone/pairs/${st.pair}/rtc-config?role=phone`);
  if (st.pc && st.pc.connectionState !== 'closed') {
    try { st.pc.setConfiguration({ iceServers: st.config.iceServers, iceTransportPolicy: st.config.iceTransportPolicy }); } catch {}
  }
}

async function join() {
  if (!st.pair || !st.token) throw new Error('Lien d’association incomplet');
  const joined = await api(`/api/phone/pairs/${st.pair}/join`, { method: 'POST' });
  if (joined.phoneToken) {
    st.token = joined.phoneToken;
    try { sessionStorage.setItem(tokenKey, joined.phoneToken); } catch {}
  }
  $('pairBadge').textContent = `Associé · ${st.pair}`;
  await loadRtc();
  connectEvents();
  updateStartState();
}

async function ticket() {
  return api(`/api/phone/pairs/${st.pair}/events-ticket`, { method: 'POST', body: { role: 'phone' } });
}

async function connectEvents() {
  clearTimeout(st.eventsReconnect);
  try {
    const t = await ticket();
    st.es?.close();
    const es = new EventSource(`/api/phone/events?ticket=${encodeURIComponent(t.ticket)}`);
    st.es = es;
    es.addEventListener('signal', e => enqueueSignal(JSON.parse(e.data)));
    es.onopen = () => { pushControlState('sse-open').catch(() => {}); };
    es.onerror = () => {
      es.close();
      st.es = null;
      st.eventsReconnect = setTimeout(connectEvents, 1000);
    };
  } catch {
    st.eventsReconnect = setTimeout(connectEvents, 1500);
  }
}

function enqueueSignal(s) {
  st.signalChain = st.signalChain
    .then(() => handleSignal(s))
    .catch(e => log('signal-chain-error', { message: e.message }));
}

async function signal(type, payload) {
  return api(`/api/phone/pairs/${st.pair}/signal`, {
    method: 'POST',
    body: { role: 'phone', type, payload },
  });
}

function currentProfile() {
  const selected = $('resolution').value;
  return selected === 'auto' ? st.autoProfile : selected;
}

function captureConstraints(deviceId = $('camera').value, profile = currentProfile()) {
  const [w, h] = profile.split('x').map(Number);
  return {
    audio: false,
    video: {
      ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: 'environment' } }),
      width: { ideal: w, max: w },
      height: { ideal: h, max: h },
      aspectRatio: { ideal: 16 / 9 },
      frameRate: { ideal: 30, max: 30 },
    },
  };
}

function cameraKind(label = '') {
  return window.TCGatePhoneCameraDevices.kindFromLabel(label);
}

function cameraDisplayLabel(device, index) {
  return window.TCGatePhoneCameraDevices.displayLabel(device, index, st.cameraDevices.length);
}

function cameraPublicId(device) {
  if (!st.cameraAliases.has(device.deviceId)) {
    st.cameraAliases.set(device.deviceId, `camera-${st.nextCameraAlias++}`);
  }
  return st.cameraAliases.get(device.deviceId);
}

function publicCameraDevices() {
  const activeId = st.stream?.getVideoTracks()[0]?.getSettings?.().deviceId || $('camera').value || '';
  return st.cameraDevices.map((device, index) => ({
    id: cameraPublicId(device),
    label: cameraDisplayLabel(device, index),
    kind: cameraKind(device.label),
    active: device.deviceId === activeId
  }));
}

async function devices(activeId = '') {
  const list = await navigator.mediaDevices.enumerateDevices();
  const cams = window.TCGatePhoneCameraDevices.selectableVideoInputs(list);
  st.cameraDevices = cams;

  const preferred = activeId || (() => { try { return localStorage.getItem(preferredCameraKey) || ''; } catch { return ''; } })();
  $('camera').replaceChildren(...cams.map((d, i) => {
    const o = document.createElement('option');
    o.value = d.deviceId;
    o.textContent = cameraDisplayLabel(d, i);
    return o;
  }));
  if (preferred && cams.some(c => c.deviceId === preferred)) $('camera').value = preferred;
  $('lensHelp').textContent = cams.length > 1
    ? `${cams.length} objectifs/caméras accessibles. Teste-les : garde celui qui montre le plus de tapis.`
    : `1 caméra arrière accessible au navigateur. Certains téléphones ne publient pas séparément leurs objectifs 0,5× / 1×.`;
  return cams;
}

function setTrackHint(track) {
  // Une partie TCG est une scène de webcam avec mains/cartes en mouvement.
  // V0.3 utilisait \"detail\". V0.4 privilégie la cadence réelle.
  try { track.contentHint = 'motion'; } catch {}
}

function describeZoom(track) {
  const caps = track?.getCapabilities?.() || {};
  st.cameraCapabilities = cleanCapabilities(caps);
  const zoom = caps.zoom;
  const wrap = $('zoomWrap');
  if (zoom && Number.isFinite(zoom.min) && Number.isFinite(zoom.max) && zoom.max > zoom.min) {
    wrap.classList.remove('hidden');
    $('zoom').min = String(zoom.min);
    $('zoom').max = String(zoom.max);
    $('zoom').step = String(zoom.step || 0.1);
    const current = track.getSettings?.().zoom ?? Math.max(zoom.min, 1);
    $('zoom').value = String(current);
    $('zoomValue').textContent = `${Number(current).toFixed(1)}×`;
  } else {
    wrap.classList.add('hidden');
    $('zoomValue').textContent = '—';
  }
  return caps;
}

function updateCaptureUi(track) {
  const settings = track?.getSettings?.() || {};
  st.lastCapture = settings;
  $('capture').textContent = `${settings.width || '—'}×${settings.height || '—'} @ ${Math.round(settings.frameRate || 0)} fps`;
  const selectedLabel = $('camera').selectedOptions[0]?.textContent || 'Caméra arrière';
  $('lens').textContent = selectedLabel;
  describeZoom(track);
  $('profile').textContent = $('resolution').value === 'auto'
    ? 'Auto · 720p30 stabilité'
    : `${settings.width || '—'}×${settings.height || '—'} fixe`;
  if ($('focusDebug')) $('focusDebug').textContent = `Autofocus natif${settings.focusMode ? ` · ${settings.focusMode}` : ''}`;
}

async function obtainStream(deviceId = $('camera').value, profile = currentProfile()) {
  const next = await navigator.mediaDevices.getUserMedia(captureConstraints(deviceId, profile));
  const track = next.getVideoTracks()[0];
  setTrackHint(track);
  const settings = track.getSettings();
  if ((settings.width || 0) < (settings.height || 0)) {
    next.getTracks().forEach(t => t.stop());
    log('capture-rejected-portrait', { settings: cleanSettings(settings) });
    throw new Error(`Flux portrait reçu (${settings.width || '?'}×${settings.height || '?'}). Tournez le téléphone en paysage puis réessayez.`);
  }
  return { stream: next, track, settings };
}

async function activateStream(next, track, settings, reason) {
  const old = st.stream;
  const oldTrack = old?.getVideoTracks?.()[0] || null;
  await devices(settings.deviceId || '');
  if (settings.deviceId) {
    $('camera').value = settings.deviceId;
    try { localStorage.setItem(preferredCameraKey, settings.deviceId); } catch {}
  }
  await wake();
  const pc = await ensurePc();
  await window.TCGatePhoneCameraDevices.replaceTrackSafely(st.sender, oldTrack, track);
  st.stream = next;
  await tuneSender();
  old?.getTracks().filter(t => t !== oldTrack).forEach(t => t.stop());
  await ensureContinuousAutofocus(track);
  updateCaptureUi(track);
  st.lastCaptureChangeAt = Date.now();
  st.lowFpsStreak = 0;
  $('start').disabled = true;
  $('stop').disabled = false;
  $('start').textContent = 'Caméra active';
  document.body.classList.add('camera-active');
  beginEnergySession();
  $('resolution').disabled = false;
  $('camera').disabled = false;
  if (!pc.remoteDescription && pc.signalingState === 'stable') await negotiate(false);
  status('Diffusion active', pc.connectionState === 'connected');
  log('camera-active', { reason, settings: cleanSettings(settings), requested: currentProfile(), orientation: 'landscape' });
}

async function startCamera() {
  if (!isLandscape()) {
    updateStartState();
    throw new Error('Tournez le téléphone à l’horizontale avant d’activer la caméra');
  }
  if ($('resolution').value === 'auto') st.autoProfile = '1280x720';
  st.lowFpsStreak = 0;
  status('Activation caméra…');
  let preferred = '';
  try { preferred = localStorage.getItem(preferredCameraKey) || ''; } catch {}
  let acquired;
  try {
    acquired = await obtainStream(preferred, currentProfile());
  } catch (e) {
    if (!preferred) throw e;
    log('preferred-camera-fallback', { message: e.message });
    acquired = await obtainStream('', currentProfile());
  }
  await activateStream(acquired.stream, acquired.track, acquired.settings, 'start');
  await setMinimumZoom();
  await pushControlState('camera-start');
}

async function switchCamera(deviceId) {
  if (!st.stream || !deviceId || st.captureBusy) return;
  if (!isLandscape()) throw new Error('Repassez le téléphone en paysage');
  st.captureBusy = true;
  const oldTrack = st.stream.getVideoTracks()[0];
  const oldSettings = oldTrack?.getSettings?.() || {};
  if (oldSettings.deviceId === deviceId) {
    st.captureBusy = false;
    return;
  }
  status('Changement d’objectif…');
  let replacement = null;
  try {
    replacement = await obtainStream(deviceId, currentProfile());
    const { stream, track, settings } = replacement;
    await activateStream(stream, track, settings, 'camera-switch');
    await setMinimumZoom();
    await pushControlState('camera-switch');
    log('camera-switch', { label: $('camera').selectedOptions[0]?.textContent || null, settings: cleanSettings(track.getSettings?.() || settings) });
  } catch (e) {
    replacement?.stream?.getTracks?.().forEach(track => {
      if (track !== oldTrack) track.stop();
    });
    log('camera-switch-error', { message: e.message, previous: cleanSettings(oldSettings) });
    status('Changement impossible · caméra précédente conservée', true);
    throw e;
  } finally {
    st.captureBusy = false;
    st.lastCaptureChangeAt = Date.now();
    st.lowFpsStreak = 0;
  }
}

async function applyCaptureProfile(profile, reason = 'manual-resolution') {
  if (!st.stream || st.captureBusy) return false;
  if (!isLandscape()) throw new Error('Repassez le téléphone en paysage');
  st.captureBusy = true;
  const [w, h] = profile.split('x').map(Number);
  const track = st.stream.getVideoTracks()[0];
  try {
    await track.applyConstraints({
      width: { ideal: w, max: w },
      height: { ideal: h, max: h },
      aspectRatio: { ideal: 16 / 9 },
      frameRate: { ideal: 30, max: 30 },
    });
    const settings = track.getSettings();
    if ((settings.width || 0) < (settings.height || 0)) {
      log('resolution-rejected-portrait', { settings: cleanSettings(settings), requested: profile });
      await stopCamera({ reason: 'resolution-portrait' });
      throw new Error(`Le navigateur a basculé en portrait (${settings.width || '?'}×${settings.height || '?'}). Réactivez la caméra en paysage.`);
    }
    if ($('resolution').value === 'auto') st.autoProfile = profile;
    st.lastCapture = settings;
    updateCaptureUi(track);
    await tuneSender();
    st.lastBytes = null;
    st.lastAt = null;
    st.lowFpsStreak = 0;
    st.lastCaptureChangeAt = Date.now();
    log('resolution-change', { settings: cleanSettings(settings), requested: profile, reason });
    await pushControlState('resolution-change');
    return true;
  } finally {
    st.captureBusy = false;
  }
}

async function changeResolution() {
  if ($('resolution').value === 'auto') {
    st.autoProfile = '1280x720';
    if (st.stream) await applyCaptureProfile('1280x720', 'auto-stable-720p');
    return;
  }
  if (st.stream) await applyCaptureProfile($('resolution').value, 'manual-resolution');
}

async function changeZoom() {
  const track = st.stream?.getVideoTracks()[0];
  if (!track) return;
  const value = Number($('zoom').value);
  try {
    await track.applyConstraints({ advanced: [{ zoom: value }] });
    $('zoomValue').textContent = `${value.toFixed(1)}×`;
    log('zoom-change', { value, settings: cleanSettings(track.getSettings?.() || {}) });
    await pushControlState('zoom-change');
  } catch (e) {
    log('zoom-error', { message: e.message, value });
  }
}

async function stopCamera({ reason = 'manual' } = {}) {
  cancelRecovery(`camera-stop:${reason}`);
  if (st.sender) {
    try { await st.sender.replaceTrack(null); } catch {}
  }
  if (st.stream) st.stream.getTracks().forEach(t => t.stop());
  st.stream = null;
  $('start').disabled = !isLandscape();
  $('stop').disabled = true;
  $('camera').disabled = false;
  $('start').textContent = 'Démarrer la caméra';
  document.body.classList.remove('camera-active');
  recordBatterySample('camera-stop', true);
  status(reason === 'manual' ? 'Caméra arrêtée' : 'Caméra suspendue');
  log('camera-stop', { reason });
  await pushControlState('camera-stop');
}


function observeCodecSupport() {
  try {
    const codecs = RTCRtpReceiver?.getCapabilities?.('video')?.codecs || [];
    st.supportedVideoCodecs = codecs
      .filter(c => /^video\//i.test(c.mimeType || ''))
      .map(c => ({ mimeType: c.mimeType, clockRate: c.clockRate, sdpFmtpLine: c.sdpFmtpLine || null }));
    log('codec-order-browser-default', {
      mode: st.codecPreference,
      supported: st.supportedVideoCodecs.filter(c => /^video\/(H264|VP8|VP9|AV1|H265)$/i.test(c.mimeType || '')).map(c => c.mimeType),
    });
  } catch (e) {
    log('codec-observe-error', { message: e.message });
  }
}

async function ensureContinuousAutofocus(track) {
  if (!track) return;
  try {
    const caps = track.getCapabilities?.() || {};
    const modes = Array.isArray(caps.focusMode) ? caps.focusMode : [];
    if (modes.includes('continuous')) {
      await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
      log('autofocus-native', { mode: track.getSettings?.().focusMode || 'continuous' });
    } else {
      log('autofocus-native-uncontrolled', { mode: track.getSettings?.().focusMode || null });
    }
  } catch (e) {
    log('autofocus-native-error', { message: e.message });
  }
}

async function tuneSender() {
  if (!st.sender) return;
  try {
    const p = st.sender.getParameters();
    if (!p.encodings?.length) p.encodings = [{}];
    const profile = currentProfile();
    const maxBitrate = profile === '1920x1080' ? 5_000_000 : 3_500_000;
    p.encodings[0].maxFramerate = 30;
    p.encodings[0].maxBitrate = maxBitrate;
    p.encodings[0].scaleResolutionDownBy = 1;
    p.degradationPreference = profile === '1920x1080' ? 'balanced' : 'maintain-resolution';
    await st.sender.setParameters(p);
    log('sender-tuned', {
      maxFramerate: 30,
      maxBitrate,
      scaleResolutionDownBy: 1,
      degradationPreference: p.degradationPreference || null,
      profile,
    });
  } catch (e) {
    log('sender-tune-error', { message: e.message });
  }
}

async function setMinimumZoom() {
  const track = st.stream?.getVideoTracks()[0];
  if (!track) return;
  const caps = track.getCapabilities?.() || {};
  const min = Number(caps.zoom?.min);
  if (!Number.isFinite(min)) return;
  try {
    await track.applyConstraints({ advanced: [{ zoom: min }] });
    $('zoom').value = String(min);
    $('zoomValue').textContent = `${min.toFixed(1)}×`;
    log('zoom-min', { value: min, settings: cleanSettings(track.getSettings?.() || {}) });
    await pushControlState('zoom-min');
  } catch (e) {
    log('zoom-min-error', { message: e.message, value: min });
  }
}


function activeCameraIndex() {
  const activeId = st.stream?.getVideoTracks()[0]?.getSettings?.().deviceId || $('camera').value || '';
  const idx = st.cameraDevices.findIndex(d => d.deviceId === activeId);
  return idx >= 0 ? idx : null;
}

function controlSnapshot(reason = 'state') {
  const track = st.stream?.getVideoTracks()[0] || null;
  const settings = cleanSettings(track?.getSettings?.() || st.lastCapture || {});
  const caps = track?.getCapabilities?.() || {};
  const zoom = caps.zoom && Number.isFinite(caps.zoom.min) && Number.isFinite(caps.zoom.max)
    ? { min: Number(caps.zoom.min), max: Number(caps.zoom.max), step: Number(caps.zoom.step || 0.1), value: Number(track?.getSettings?.().zoom ?? caps.zoom.min) }
    : null;
  return {
    reason,
    cameraActive: Boolean(st.stream),
    orientation: st.orientationLandscape ? 'landscape' : 'portrait',
    selectedCameraIndex: activeCameraIndex(),
    selectedCameraId: publicCameraDevices().find(camera => camera.active)?.id || null,
    selectedCameraLabel: $('camera').selectedOptions[0]?.textContent || null,
    cameraDevices: publicCameraDevices(),
    requestedMode: $('resolution').value,
    activeProfile: currentProfile(),
    capture: settings,
    zoom,
    focus: {
      state: 'native-autofocus',
      label: 'Autofocus natif',
      currentMode: settings.focusMode || null,
    },
    metrics: st.metrics,
    rtcState: st.pc?.connectionState || null,
    encoder: {
      implementation: st.metrics?.encoderImplementation || null,
      powerEfficient: st.metrics?.powerEfficientEncoder ?? null,
      codec: st.metrics?.codec || null,
      limitation: st.metrics?.qualityLimitationReason || null,
    },
    energy: {
      battery: st.energy.batterySupported === false ? { supported: false } : {
        supported: st.energy.batterySupported,
        levelPct: st.energy.lastBattery?.levelPct ?? null,
        charging: st.energy.lastBattery?.charging ?? null,
      },
      thermal: {
        status: thermalAnalysis().status,
        userFeel: st.energy.manualThermalFeel,
      },
    },
  };
}

async function pushControlState(reason = 'state') {
  if (!st.pair || !st.token) return;
  const snapshot = controlSnapshot(reason);
  const [signalResult, storeResult] = await Promise.allSettled([
    signal('control-state', snapshot),
    api(`/api/phone/pairs/${st.pair}/state`, { method: 'POST', body: { state: snapshot } }),
  ]);
  const signalOk = signalResult.status === 'fulfilled' && signalResult.value?.delivered !== false;
  const storeOk = storeResult.status === 'fulfilled';
  if (signalResult.status === 'rejected') log('control-state-signal-error', { reason, message: signalResult.reason?.message || String(signalResult.reason) });
  else if (signalResult.value?.delivered === false) log('control-state-signal-undelivered', { reason });
  if (storeResult.status === 'rejected') log('control-state-store-error', { reason, message: storeResult.reason?.message || String(storeResult.reason) });
  if (signalOk || storeOk) st.lastControlStateAt = Date.now();
}

async function setZoomRemote(value) {
  const track = st.stream?.getVideoTracks()[0];
  if (!track) throw new Error('Caméra inactive');
  const caps = track.getCapabilities?.() || {};
  const min = Number(caps.zoom?.min), max = Number(caps.zoom?.max);
  if (!Number.isFinite(min) || !Number.isFinite(max)) throw new Error('Zoom indisponible');
  const v = Math.max(min, Math.min(max, Number(value)));
  await track.applyConstraints({ advanced: [{ zoom: v }] });
  $('zoom').value = String(v);
  $('zoomValue').textContent = `${v.toFixed(1)}×`;
  log('zoom-remote', { value: v });
  await pushControlState('zoom-remote');
  return controlSnapshot('zoom-remote');
}

async function executeRemoteControl(payload = {}) {
  const requestId = String(payload.requestId || '');
  const action = String(payload.action || '');
  const args = payload.args && typeof payload.args === 'object' ? payload.args : {};
  st.remoteCommandCount += 1;
  log('remote-control', { requestId, action, count: st.remoteCommandCount });
  try {
    let result = null;
    if (action === 'request-state') {
      result = controlSnapshot('request-state');
    } else if (action === 'select-camera') {
      const cameraId = String(args.cameraId || '');
      const device = window.TCGatePhoneCameraDevices.resolveOpaqueCamera(st.cameraDevices, cameraId, cameraPublicId);
      if (!device) throw new Error('Objectif inconnu');
      $('camera').value = device.deviceId;
      await switchCamera(device.deviceId);
      result = controlSnapshot('select-camera');
    } else if (action === 'set-quality') {
      const mode = String(args.mode || 'auto');
      if (!['auto','1280x720','1920x1080'].includes(mode)) throw new Error('Profil qualité invalide');
      $('resolution').value = mode;
      await changeResolution();
      result = controlSnapshot('set-quality');
    } else if (action === 'wide') {
      await setMinimumZoom();
      result = controlSnapshot('wide');
    } else if (action === 'set-zoom') {
      result = await setZoomRemote(args.value);
    } else if (action === 'stop-camera') {
      await stopCamera({ reason: 'remote-pc' });
      result = controlSnapshot('stop-camera');
    } else {
      throw new Error('Commande inconnue');
    }
    await signal('control-result', { requestId, action, ok: true, state: result || controlSnapshot(action) });
  } catch (e) {
    log('remote-control-error', { requestId, action, message: e.message });
    await signal('control-result', { requestId, action, ok: false, error: e.message, state: controlSnapshot(`error:${action}`) }).catch(() => {});
  }
}

function newPeer() {
  const generation = ++st.peerGeneration;
  const pc = new RTCPeerConnection({
    iceServers: st.config.iceServers,
    iceTransportPolicy: st.config.iceTransportPolicy,
  });
  pc.__generation = generation;
  st.pc = pc;
  st.pendingRemoteCandidates = [];
  st.localCandidates = [];
  st.canSendCandidates = false;
  st.lastBytes = null;
  st.lastAt = null;

  const transceiver = pc.addTransceiver('video', { direction: 'sendonly' });
  observeCodecSupport();
  st.sender = transceiver.sender;
  const track = st.stream?.getVideoTracks()[0] || null;
  if (track) st.sender.replaceTrack(track).catch(() => {});

  pc.onicecandidate = e => {
    if (!e.candidate) return;
    const candidate = e.candidate.toJSON?.() || e.candidate;
    const packet = { generation, candidate };
    if (!st.canSendCandidates) st.localCandidates.push(packet);
    else signal('candidate', packet).catch(e2 => log('candidate-send-error', { message: e2.message, generation }));
  };

  pc.onconnectionstatechange = () => {
    if (st.pc !== pc) return;
    const cs = pc.connectionState;
    $('rtc').textContent = cs;
    log('rtc-state', { state: cs, generation });
    if (cs === 'connected') {
      st.lastConnectedAt = Date.now();
      cancelRecovery('connected');
      status(st.stream ? 'Diffusion active' : 'Connexion prête', true);
    } else if (cs === 'connecting') {
      status('Connexion du flux…');
    } else if (cs === 'disconnected' || cs === 'failed') {
      status(navigator.onLine ? 'Liaison interrompue · reprise…' : 'Réseau perdu · attente du retour…');
      beginRecovery(pc, cs);
    }
  };
  pc.oniceconnectionstatechange = () => {
    if (st.pc === pc) log('ice-state', { state: pc.iceConnectionState, generation });
  };

  clearInterval(st.statsTimer);
  st.statsTimer = setInterval(stats, 1500);
  log('peer-created', { generation });
  return pc;
}

async function ensurePc() {
  if (st.pc && st.pc.connectionState !== 'closed') return st.pc;
  if (!st.config) await loadRtc();
  return newPeer();
}

async function flushLocalCandidates() {
  const list = st.localCandidates.splice(0);
  for (const packet of list) {
    if (packet.generation !== st.peerGeneration) continue;
    try { await signal('candidate', packet); } catch (e) { log('candidate-send-error', { message: e.message, generation: packet.generation }); }
  }
}

async function addRemoteCandidate(packet) {
  const generation = Number(packet?.generation || 0);
  const candidate = packet?.candidate ?? packet;
  if (generation && generation !== st.peerGeneration) {
    log('stale-candidate-ignored', { generation, active: st.peerGeneration });
    return;
  }
  const pc = await ensurePc();
  if (!pc.remoteDescription) {
    st.pendingRemoteCandidates.push({ generation: st.peerGeneration, candidate });
    log('candidate-queued', { queue: st.pendingRemoteCandidates.length, generation: st.peerGeneration });
    return;
  }
  await pc.addIceCandidate(candidate);
}

async function flushRemoteCandidates() {
  if (!st.pc?.remoteDescription) return;
  const active = st.peerGeneration;
  const list = st.pendingRemoteCandidates.splice(0);
  for (const packet of list) {
    if (packet.generation && packet.generation !== active) continue;
    try { await st.pc.addIceCandidate(packet.candidate); } catch (e) { log('candidate-flush-error', { message: e.message, generation: active }); }
  }
}

async function waitSignalingStable(pc, maxMs = 3500) {
  const until = Date.now() + maxMs;
  while (st.pc === pc && pc.signalingState !== 'stable' && Date.now() < until) await sleep(100);
  return st.pc === pc && pc.signalingState === 'stable';
}

async function negotiate(restart = false) {
  if (!st.stream) return false;
  if (st.offerBusy) return false;
  const pc = await ensurePc();
  if (!(await waitSignalingStable(pc))) return false;

  st.offerBusy = true;
  st.canSendCandidates = false;
  st.localCandidates = [];
  const generation = pc.__generation;
  try {
    if (restart) {
      try { pc.restartIce?.(); } catch {}
    }
    const offer = await pc.createOffer(restart ? { iceRestart: true } : {});
    await pc.setLocalDescription(offer);
    await signal('offer', { generation, description: pc.localDescription, restart });
    log('offer', { restart, signalingState: pc.signalingState, generation });
    st.canSendCandidates = true;
    await flushLocalCandidates();
    return true;
  } finally {
    st.offerBusy = false;
  }
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function serverReachable() {
  if (!navigator.onLine) return false;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 2200);
  try {
    const r = await fetch('/api/health', { cache: 'no-store', signal: ctl.signal });
    return r.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function cancelRecovery(reason = 'cancelled') {
  if (st.recoveryActive) log('recovery-cancelled', { reason, state: st.recoveryState, epoch: st.recoveryEpoch });
  st.recoveryEpoch += 1;
  st.recoveryActive = false;
  st.recoveryState = 'idle';
}

async function waitForConnected(pc, epoch, maxMs) {
  const until = Date.now() + maxMs;
  while (epoch === st.recoveryEpoch && st.pc === pc && Date.now() < until) {
    if (pc.connectionState === 'connected') return true;
    await sleep(250);
  }
  return st.pc === pc && pc.connectionState === 'connected';
}

async function waitForNetwork(epoch) {
  let announced = false;
  while (epoch === st.recoveryEpoch && st.stream) {
    if (navigator.onLine && await serverReachable()) return true;
    if (!announced) {
      announced = true;
      st.recoveryState = 'waiting-network';
      status('Réseau indisponible · attente du retour…');
      log('recovery-wait-network', { online: navigator.onLine, epoch });
    }
    await sleep(navigator.onLine ? 1200 : 700);
  }
  return false;
}

async function beginRecovery(pc, trigger) {
  if (st.recoveryActive || !st.stream || st.pc !== pc) return;
  st.recoveryActive = true;
  const epoch = ++st.recoveryEpoch;
  st.recoveryState = 'grace';
  log('recovery-start', { trigger, generation: pc.__generation, epoch });

  try {
    // Laisse 1,5 s à WebRTC pour absorber une micro-coupure sans aucune renégociation.
    await sleep(1500);
    if (epoch !== st.recoveryEpoch || st.pc !== pc || pc.connectionState === 'connected') return;

    if (!(await waitForNetwork(epoch))) return;
    if (epoch !== st.recoveryEpoch) return;

    st.recoveryState = 'ice-restart';
    status('Réseau revenu · reprise WebRTC…');
    try {
      await loadRtc();
      st.restartAttempts += 1;
      log('ice-restart-attempt', { attempt: st.restartAttempts, generation: pc.__generation, epoch });
      const offered = await negotiate(true);
      if (offered && await waitForConnected(pc, epoch, 7000)) return;
    } catch (e) {
      log('ice-restart-error', { message: e.message, epoch });
      if (!(await waitForNetwork(epoch))) return;
    }

    if (epoch !== st.recoveryEpoch || pc.connectionState === 'connected') return;
    st.recoveryState = 'hard-reset';
    status('Reconstruction de la liaison…');
    const rebuilt = await hardReset('recovery-fallback', epoch);
    if (rebuilt) {
      const activePc = st.pc;
      if (await waitForConnected(activePc, epoch, 9000)) return;
    }

    // Si le réseau vient de retomber pendant la reconstruction, on attend proprement
    // son prochain retour au lieu d'empiler des offres et des timers concurrents.
    if (epoch === st.recoveryEpoch && st.stream && st.pc?.connectionState !== 'connected') {
      st.recoveryState = 'waiting-network';
      await waitForNetwork(epoch);
      if (epoch !== st.recoveryEpoch) return;
      await sleep(1200);
      if (st.pc?.connectionState !== 'connected') {
        log('recovery-second-hard-reset', { epoch });
        await hardReset('recovery-second-pass', epoch);
      }
    }
  } finally {
    if (epoch === st.recoveryEpoch && st.pc?.connectionState !== 'connected') {
      st.recoveryActive = false;
      st.recoveryState = 'idle';
    }
  }
}

async function hardReset(reason, epoch = st.recoveryEpoch) {
  if (!st.stream || epoch !== st.recoveryEpoch) return false;
  if (!(await serverReachable())) {
    log('hard-reset-deferred-offline', { reason, epoch });
    return false;
  }
  st.hardResets += 1;
  log('hard-reset-start', { reason, count: st.hardResets, epoch });
  await loadRtc();
  await signal('reset-peer', { reason, generation: st.peerGeneration });
  try { st.pc?.close(); } catch {}
  st.pc = null;
  st.sender = null;
  st.pendingRemoteCandidates = [];
  st.localCandidates = [];
  st.canSendCandidates = false;
  const pc = await ensurePc();
  await st.sender.replaceTrack(st.stream.getVideoTracks()[0]);
  const sent = await negotiate(false);
  if (sent) log('hard-reset-offer-sent', { reason, generation: pc.__generation, epoch });
  return sent;
}

async function handleSignal(s) {
  try {
    if (s.type === 'answer') {
      const generation = Number(s.payload?.generation || 0);
      const description = s.payload?.description ?? s.payload;
      if (generation && generation !== st.peerGeneration) {
        log('stale-answer-ignored', { generation, active: st.peerGeneration });
        return;
      }
      const pc = await ensurePc();
      await pc.setRemoteDescription(description);
      await flushRemoteCandidates();
      log('answer-applied', { generation: st.peerGeneration });
    } else if (s.type === 'candidate') {
      await addRemoteCandidate(s.payload);
    } else if (s.type === 'restart-request') {
      // V0.3 : le téléphone pilote seul la reprise. Une requête ancienne du PC ne doit
      // plus lancer une seconde négociation concurrente.
      log('restart-request-ignored-v03', { payload: s.payload || null });
    } else if (s.type === 'reset-peer') {
      log('remote-reset-ignored-v03', { payload: s.payload || null });
    } else if (s.type === 'control') {
      await executeRemoteControl(s.payload || {});
    }
  } catch (e) {
    log('signal-error', { type: s.type, message: e.message });
  }
}

async function maybeAutoAdapt(metrics) {
  if (!st.stream || st.captureBusy || st.recoveryActive || st.pc?.connectionState !== 'connected') return;
  if (Date.now() - st.lastConnectedAt < 12000 || Date.now() - st.lastCaptureChangeAt < 12000) return;
  const requested = $('resolution').value;
  const capture = st.stream.getVideoTracks()[0]?.getSettings?.() || {};

  // 1080p reste expérimental : en cas de cadence durablement trop faible, retour contrôlé au 720p.
  if (requested === '1920x1080' && metrics.fps != null) {
    if (metrics.fps < 24) st.lowFpsStreak += 1;
    else st.lowFpsStreak = 0;
    if (st.lowFpsStreak >= 4) {
      log('quality-1080-downgrade-attempt', { from: '1920x1080', to: '1280x720', fps: metrics.fps, streak: st.lowFpsStreak });
      $('resolution').value = '1280x720';
      status('1080p instable · retour en 720p30…');
      const changed = await applyCaptureProfile('1280x720', '1080-low-fps');
      if (changed) {
        st.autoDowngrades += 1;
        log('quality-1080-downgrade', { count: st.autoDowngrades });
      }
    }
    return;
  }

  // Profil standard : la capture est 720p et WebRTC reçoit l'instruction de conserver la résolution.
  // On ne dégrade pas automatiquement : on mesure seulement les violations réelles du plancher pour le Lab.
  const wants720 = requested === 'auto' || requested === '1280x720';
  if (wants720 && Number(capture.width) >= 1280 && Number(capture.height) >= 720 && metrics.width) {
    if (metrics.width < 1280 || metrics.height < 720) st.lowResolutionStreak += 1;
    else st.lowResolutionStreak = 0;
    if (st.lowResolutionStreak === 4) {
      st.qualityFloorBreaches += 1;
      log('quality-floor-breach', {
        capture: { width: capture.width, height: capture.height, frameRate: capture.frameRate },
        encoded: { width: metrics.width, height: metrics.height, fps: metrics.fps },
        limitation: metrics.qualityLimitationReason || null,
        codec: metrics.codec || null,
        encoderImplementation: metrics.encoderImplementation || null,
        count: st.qualityFloorBreaches,
      });
    }
  }
}

async function stats() {
  if (!st.pc) return;
  const reports = await st.pc.getStats();
  let out = null, pairRec = null, codec = null;
  reports.forEach(r => {
    if (r.type === 'outbound-rtp' && r.kind === 'video') out = r;
    if (r.type === 'candidate-pair' && r.state === 'succeeded' && r.nominated) pairRec = r;
  });
  if (!out) return;
  if (out.codecId) codec = reports.get(out.codecId) || null;
  const now = performance.now();
  let kbps = null;
  if (st.lastBytes != null && st.lastAt) {
    const dt = (now - st.lastAt) / 1000;
    kbps = Math.round(((out.bytesSent - st.lastBytes) * 8 / 1000) / dt);
  }
  st.lastBytes = out.bytesSent;
  st.lastAt = now;
  st.metrics = {
    width: out.frameWidth || null,
    height: out.frameHeight || null,
    fps: out.framesPerSecond ?? null,
    bitrateKbps: kbps,
    rttMs: pairRec?.currentRoundTripTime != null ? Math.round(pairRec.currentRoundTripTime * 1000) : null,
    framesEncoded: out.framesEncoded ?? null,
    framesSent: out.framesSent ?? null,
    totalEncodeTime: out.totalEncodeTime ?? null,
    qualityLimitationReason: out.qualityLimitationReason || null,
    qualityLimitationDurations: out.qualityLimitationDurations || null,
    encoderImplementation: out.encoderImplementation || null,
    powerEfficientEncoder: out.powerEfficientEncoder ?? null,
    codec: codec?.mimeType || null,
  };
  const sample = { at: new Date().toISOString(), ...st.metrics, profile: currentProfile(), recoveryState: st.recoveryState };
  st.performanceHistory.push(sample);
  if (st.performanceHistory.length > 180) st.performanceHistory.shift();

  $('fps').textContent = out.framesPerSecond != null ? `${out.framesPerSecond} fps` : '—';
  $('bitrate').textContent = kbps != null ? `${kbps} kb/s` : '—';
  $('quality').textContent = `${out.qualityLimitationReason || 'none'}${codec?.mimeType ? ` · ${codec.mimeType.replace('video/', '')}` : ''}`;
  maybeAutoAdapt(st.metrics).catch(e => log('auto-adapt-error', { message: e.message }));
  recordBatterySample('stats');
  updateThermalUi();
  if (Date.now() - st.lastControlStateAt > 10000) pushControlState('stats').catch(() => {});
}

function buildPhoneReport() {
  return {
    version: 'tcgate-phone-camera-lab-v0.6.4.1',
    generatedAt: new Date().toISOString(),
    role: 'phone',
    pair: st.pair,
    orientation: st.orientationLandscape ? 'landscape' : 'portrait',
    capture: cleanSettings(st.stream?.getVideoTracks()[0]?.getSettings?.() || st.lastCapture || {}),
    cameraCapabilities: st.cameraCapabilities,
    cameraDevices: publicCameraDevices(),
    selectedCameraId: publicCameraDevices().find(camera => camera.active)?.id || null,
    selectedCameraLabel: $('camera').selectedOptions[0]?.textContent || null,
    requestedMode: $('resolution').value,
    activeProfile: currentProfile(),
    autoDowngrades: st.autoDowngrades,
    qualityFloorBreaches: st.qualityFloorBreaches,
    remoteCommandCount: st.remoteCommandCount,
    focus: controlSnapshot('report').focus,
    codecPreference: st.codecPreference,
    supportedVideoCodecs: st.supportedVideoCodecs,
    contentHint: st.stream?.getVideoTracks()[0]?.contentHint || null,
    metrics: st.metrics,
    energy: {
      battery: batteryAnalysis(),
      thermal: thermalAnalysis(),
      screen: {
        mode: 'ultra-dark',
        wakeLockSupported: 'wakeLock' in navigator,
        wakeLockActive: Boolean(st.wake && !st.wake.released),
        brightnessControl: 'not-available-to-web-page',
        brightnessRecommendation: 'minimum-manual',
      },
    },
    performanceHistory: st.performanceHistory,
    rtcState: st.pc?.connectionState || null,
    recovery: { active: st.recoveryActive, state: st.recoveryState, restartAttempts: st.restartAttempts, hardResets: st.hardResets },
    turn: {
      available: st.config?.turn?.available || false,
      policy: st.config?.iceTransportPolicy || null,
    },
    events: st.events,
  };
}

function downloadPhoneReport(data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const file = new File([blob], `tcgate-phone-lab-phone-${Date.now()}.json`, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] }) && navigator.share) {
    return navigator.share({ files: [file], title: 'Diagnostic TCGate Phone Camera Lab' });
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return Promise.resolve();
}

async function report() {
  const button = $('report');
  log('report-export-start', { transport: 'server-to-pc' });
  const data = buildPhoneReport();
  if (button) button.disabled = true;
  try {
    const stored = await api(`/api/phone/pairs/${st.pair}/report`, { method: 'POST', body: { report: data } });
    log('report-export-success', { transport: 'server-to-pc', bytes: stored.bytes || null });
    if ($('reportStatus')) $('reportStatus').textContent = 'Diagnostic transmis au PC ✓';
    if (button) button.textContent = 'Diagnostic transmis ✓';
    await pushControlState('report-staged').catch(() => {});
  } catch (e) {
    log('report-export-failure', { transport: 'server-to-pc', message: e.message });
    if ($('reportStatus')) $('reportStatus').textContent = `Transmission impossible · secours local : ${e.message}`;
    try {
      const fallbackData = buildPhoneReport();
      await downloadPhoneReport(fallbackData);
      log('report-export-success', { transport: 'mobile-fallback' });
    } catch (fallbackError) {
      log('report-export-failure', { transport: 'mobile-fallback', message: fallbackError.message });
      status(`Diagnostic non exporté : ${fallbackError.message}`);
    }
  } finally {
    if (button) {
      setTimeout(() => {
        button.disabled = false;
        button.textContent = 'Transmettre diagnostic au PC';
      }, 1600);
    }
  }
}

$('start').onclick = () => startCamera().catch(e => status(`Erreur : ${e.message}`));
$('stop').onclick = () => stopCamera();
$('resolution').onchange = () => changeResolution().catch(e => status(`Erreur : ${e.message}`));
$('camera').onchange = () => {
  const id = $('camera').value;
  if (id) {
    try { localStorage.setItem(preferredCameraKey, id); } catch {}
  }
  if (st.stream) switchCamera(id).catch(e => status(`Erreur objectif : ${e.message}`));
};
$('zoom').oninput = () => changeZoom();
$('wide').onclick = () => setMinimumZoom();
$('report').onclick = report;
if ($('thermalFeel')) $('thermalFeel').onchange = () => {
  st.energy.manualThermalFeel = $('thermalFeel').value;
  log('thermal-feel', { value: st.energy.manualThermalFeel });
  updateThermalUi();
  pushControlState('thermal-feel').catch(() => {});
};

window.addEventListener('online', () => {
  log('network-online');
  if (st.stream && st.pc && st.pc.connectionState !== 'connected') {
    status('Réseau revenu · reprise…');
    if (!st.recoveryActive) beginRecovery(st.pc, 'browser-online');
  }
});
window.addEventListener('offline', () => {
  log('network-offline');
  if (st.stream) status('Réseau perdu · attente du retour…');
});

updateStartState();
initBatteryTelemetry().catch(e => log('battery-init-error', { message: e.message }));
join().catch(e => status(`Association impossible : ${e.message}`));
