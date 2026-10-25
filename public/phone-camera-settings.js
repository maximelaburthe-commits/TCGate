'use strict';

// Presentation for the existing PC Phone Camera owner. No pairing, capture or network engine here.
(() => {
  if (window.TCGatePhoneCameraSettings) return;
  const panel = document.getElementById('phoneCameraPanel');
  const micro = document.getElementById('phoneCameraMicroField');
  if (!panel || !micro?.parentElement) return;
  const owner = () => window.TCGatePhoneCamera;
  const elements = {};
  let busy = false;
  let lastInfo = {};

  function node(tag, text, parent, id, className = '') {
    const element = document.createElement(tag);
    if (text != null) element.textContent = text;
    if (id) element.id = id;
    if (className) element.className = className;
    parent?.append(element);
    return element;
  }
  function button(text, id, parent) {
    const element = node('button', text, parent, id, 'secondary smallish');
    element.type = 'button';
    return element;
  }
  const details = node('details', null, null, 'phoneCameraSettings');
  node('summary', 'Réglages et diagnostic du téléphone', details);
  const content = node('div', null, details, null, 'phone-settings-content');
  const qualityField = node('label', null, content, 'phoneCameraQualityField', 'phone-camera-lens');
  qualityField.htmlFor = 'phoneCameraQuality';
  node('span', 'Qualité vidéo', qualityField);
  elements.quality = node('select', null, qualityField, 'phoneCameraQuality');
  const zoomField = node('div', null, content, 'phoneCameraZoomField');
  const zoomLabel = node('label', 'Zoom matériel', zoomField);
  zoomLabel.htmlFor = 'phoneCameraZoom';
  const zoomLine = node('div', null, zoomField, null, 'phone-settings-zoom');
  elements.zoom = node('input', null, zoomLine, 'phoneCameraZoom');
  elements.zoom.type = 'range';
  elements.zoomValue = node('output', '—', zoomLine, 'phoneCameraZoomValue');
  elements.zoomValue.htmlFor = 'phoneCameraZoom';
  elements.wide = button('Champ maximum', 'phoneCameraWide', zoomField);
  elements.focus = node('p', 'Mise au point : gérée par le navigateur.', content, 'phoneCameraFocus', 'phone-settings-hint');
  const actions = node('div', null, content, null, 'phone-camera-actions');
  elements.refresh = button('Actualiser le diagnostic', 'phoneCameraRefresh', actions);
  elements.export = button('Exporter le diagnostic JSON', 'phoneCameraExport', actions);
  elements.stop = button('Arrêter la caméra du téléphone', 'phoneCameraStop', actions);
  const metrics = node('dl', null, content, 'phoneCameraMetrics');
  metrics.setAttribute('aria-label', 'Diagnostic Phone Camera');
  elements.status = node('p', '', content, 'phoneCameraSettingsStatus', 'phone-settings-status');
  elements.status.setAttribute('role', 'status');
  micro.parentElement.insertBefore(details, micro);

  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const metric = (value, unit = '') => finite(value) ? `${Math.round(value * 10) / 10}${unit}` : 'Non renseigné';
  function row(label, value) { node('dt', label, metrics); node('dd', value, metrics); }
  function safeText(value) {
    const privacy = window.TCGatePhoneCameraPrivacy;
    return typeof privacy?.sanitize === 'function' ? String(privacy.sanitize(value) || '').slice(0, 160) : '';
  }
  function status(text, failed = false) {
    elements.status.textContent = text;
    elements.status.dataset.state = failed ? 'error' : 'info';
  }
  function update(info = lastInfo) {
    lastInfo = info || {};
    const snapshot = owner()?.getSnapshot?.() || {};
    const phone = lastInfo.diagnostics || snapshot.diagnostics || {};
    const connected = Boolean(snapshot.connected) && lastInfo.status !== 'disconnected';
    const active = connected && snapshot.cameraActive === true && phone.cameraActive !== false;
    const paired = Boolean(snapshot.pairId);
    details.hidden = !paired || lastInfo.status === 'idle' || lastInfo.status === 'waiting';

    const offered = window.TCGatePhoneCameraControl?.availableCaptureProfiles?.(phone) || [];
    const profiles = [...new Set(offered)].filter(value => ['auto', '1280x720', '1920x1080'].includes(value));
    const labels = { auto: 'Auto stable · 720p30', '1280x720': '720p30', '1920x1080': '1080p30 · expérimental' };
    qualityField.hidden = profiles.length < 2;
    const signature = profiles.join('|');
    if (elements.quality.dataset.profiles !== signature) {
      elements.quality.replaceChildren(...profiles.map(value => {
        const option = node('option', labels[value]);
        option.value = value;
        return option;
      }));
      elements.quality.dataset.profiles = signature;
    }
    elements.quality.value = profiles.includes(phone.requestedMode) ? phone.requestedMode : (profiles[0] || '');
    elements.quality.disabled = busy || !active || profiles.length < 2;

    const zoom = phone.zoom;
    const hasZoom = Boolean(zoom && finite(zoom.min) && finite(zoom.max) && zoom.min >= 0 && zoom.max <= 100 && zoom.max > zoom.min && (zoom.step == null || (finite(zoom.step) && zoom.step > 0)));
    zoomField.hidden = !hasZoom;
    elements.zoom.disabled = elements.wide.disabled = busy || !active || !hasZoom;
    if (hasZoom) {
      elements.zoom.min = String(zoom.min);
      elements.zoom.max = String(zoom.max);
      elements.zoom.step = String(finite(zoom.step) && zoom.step > 0 ? zoom.step : 0.1);
      const value = finite(zoom.value) ? Math.min(zoom.max, Math.max(zoom.min, zoom.value)) : zoom.min;
      elements.zoom.value = String(value);
      elements.zoomValue.textContent = `${Math.round(value * 10) / 10}×`;
    }
    const focusMode = phone.focus?.currentMode;
    elements.focus.textContent = focusMode === 'continuous'
      ? 'Mise au point : autofocus continu du téléphone.'
      : 'Mise au point : autofocus natif, selon le navigateur.';
    elements.refresh.disabled = busy || !paired || !connected;
    elements.export.disabled = busy || !paired || !connected;
    elements.stop.disabled = busy || !active;

    const capture = phone.capture || {};
    const measure = phone.metrics || {};
    const sender = phone.sender || phone.diagnostics?.sender || {};
    const route = phone.route || phone.diagnostics?.route || {};
    const battery = phone.energy?.battery;
    const thermalLabels = { stable: 'Stable', 'pressure-observed': 'À surveiller', 'throttling-suspected': 'Throttling possible' };
    metrics.replaceChildren();
    row('Résolution réelle', finite(capture.width) && finite(capture.height) ? `${capture.width} × ${capture.height}` : 'Non renseignée');
    row('FPS', metric(measure.fps ?? sender.fps));
    row('Débit vidéo', metric(measure.bitrateKbps ?? sender.bitrateKbps, ' kbit/s'));
    row('Codec', safeText(measure.codec || sender.codec) || 'Non renseigné');
    row('Route ICE', route.usingRelay === true ? 'Relay TURN' : route.localCandidateType && route.remoteCandidateType ? 'Directe' : 'Non renseignée');
    row('RTT', metric(measure.rttMs ?? sender.rttMs, ' ms'));
    row('Batterie', battery?.supported === false ? 'API indisponible' : finite(battery?.levelPct) && battery.levelPct >= 0 && battery.levelPct <= 100 ? `${battery.levelPct} %${battery.charging === true ? ' · en charge' : ''}` : 'Non renseignée');
    row('Analyse thermique', thermalLabels[phone.energy?.thermal?.status] || 'Non renseignée');
  }

  async function run(action, args = {}) {
    if (busy) return;
    busy = true;
    status('Commande en cours…');
    update();
    try {
      await owner().requestControl(action, args);
      if (action === 'request-state') await owner().fetchDiagnostics();
      // Discard stale presentation input; the Phone owner holds the acknowledged state.
      lastInfo = {};
      status(action === 'stop-camera' ? 'Caméra du téléphone arrêtée. Le micro reste celui du PC.' : 'Réglage confirmé par le téléphone.');
    } catch (error) {
      lastInfo = {};
      status(safeText(error?.message) || 'Impossible d’appliquer la commande.', true);
    } finally {
      busy = false;
      update();
    }
  }
  elements.quality.addEventListener('change', () => run('set-quality', { mode: elements.quality.value }));
  elements.zoom.addEventListener('change', () => run('set-zoom', { value: Number(elements.zoom.value) }));
  elements.wide.addEventListener('click', () => run('wide'));
  elements.refresh.addEventListener('click', () => run('request-state'));
  elements.stop.addEventListener('click', () => run('stop-camera'));
  elements.export.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    status('Préparation du diagnostic…');
    update();
    try {
      const privacy = window.TCGatePhoneCameraPrivacy;
      if (typeof privacy?.sanitize !== 'function') throw new Error('Protection du diagnostic indisponible.');
      const snapshot = await owner().fetchDiagnostics();
      const clean = privacy.sanitize(snapshot);
      const url = URL.createObjectURL(new Blob([JSON.stringify(clean, null, 2)], { type: 'application/json' }));
      const anchor = node('a', null, document.body);
      anchor.href = url;
      anchor.download = `tcgate-phone-diagnostic-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      try { anchor.click(); } finally { anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
      lastInfo = {};
      status('Diagnostic JSON exporté, sans média ni donnée sensible.');
    } catch (error) {
      status(safeText(error?.message) || 'Impossible d’exporter le diagnostic.', true);
    } finally {
      busy = false;
      update();
    }
  });
  window.TCGatePhoneCameraSettings = Object.freeze({ update });
  update({ status: 'idle' });
})();
