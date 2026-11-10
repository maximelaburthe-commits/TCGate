/* Gig Dice V6: presentation adapter; app.js remains the state/sync authority. */
(function (root) {
  'use strict';
  if (root.TCGateGigDiceV6) return;
  const panel = document.getElementById('gigDicePanel');
  if (!panel || !root.renderGigDicePanel || !root.setGigPanelCoordinates) return;
  const native = { render: root.renderGigDicePanel, clearZoom: root.clearGigDieZoom, showZoom: root.showGigDieZoom, coordinates: root.setGigPanelCoordinates, applySaved: root.applySavedGigPanelPosition };
  let placementFrame = 0;
  function decorate() {
    panel.querySelectorAll('.die-slot2[data-die-id]').forEach(slot => {
      const token = slot.querySelector('.die-token2');
      if (!token) return;
      const sides = /-d(4|6|8|10|12|20)$/.exec(slot.dataset.dieId)?.[1];
      if (!sides) return;
      token.removeAttribute('title'); token.dataset.dieType = 'D' + sides;
      slot.querySelectorAll('.die-control2').forEach(button => button.setAttribute('aria-label', (button.dataset.action === 'increment' ? 'Augmenter' : 'Diminuer') + ' D' + sides));
    });
  }
  root.clearGigDieZoom = function () {
    panel.querySelectorAll('.is-zoom-source').forEach(token => token.classList.remove('is-zoom-source'));
    return native.clearZoom.apply(this, arguments);
  };
  root.showGigDieZoom = function (source) {
    const result = native.showZoom.apply(this, arguments);
    if (result) source?.classList.add('is-zoom-source');
    return result;
  };
  root.renderGigDicePanel = function () { const result = native.render.apply(this, arguments); decorate(); schedulePlacement(); return result; };
  // Existing Future UX CSS prevented the native saved-position helpers from moving.
  root.futureUxOwnsGigPlacement = () => false;
  root.setGigPanelCoordinates = function (element, left, top) {
    native.coordinates(element, left, top);
    for (const name of ['left', 'top', 'right', 'bottom', 'transform']) element.style.setProperty(name, element.style.getPropertyValue(name), 'important');
  };
  function obstacles(container) {
    const bounds = container.getBoundingClientRect();
    const boxes = [...document.querySelectorAll('.tcgate-local-pip, #screenGame .controls, #screenGame .tcgate-card-rail, #screenGame .tcgate-fullscreen-card, #screenGame .tcgate-alpha-diagnostics, #screenGame .tcgate-feed-actions, #timerChip, #rtcStatus')]
      .filter(element => !panel.contains(element) && !element.classList.contains('preview-hidden'))
      .filter(element => { const style = getComputedStyle(element); return style.display !== 'none' && style.visibility !== 'hidden'; })
      .map(element => element.getBoundingClientRect()).filter(rect => rect.width > 0 && rect.height > 0)
      .map(rect => ({ left: rect.left - bounds.left, top: rect.top - bounds.top, right: rect.right - bounds.left, bottom: rect.bottom - bounds.top }));
    // Prefer real letterboxing space when it is large enough for the entire HUD.
    // No frames are captured or analyzed: these are the video's layout dimensions.
    const video = document.getElementById('remoteVideo');
    if (video?.videoWidth && video.videoHeight && getComputedStyle(video).objectFit === 'contain') {
      const rect = video.getBoundingClientRect();
      const scale = Math.min(rect.width / video.videoWidth, rect.height / video.videoHeight);
      const width = video.videoWidth * scale, height = video.videoHeight * scale;
      const spareX = (rect.width - width) / 2, spareY = (rect.height - height) / 2;
      if (spareX >= panel.offsetWidth + 64 || spareY >= panel.offsetHeight + 64) boxes.push({ left: rect.left - bounds.left + spareX, top: rect.top - bounds.top + spareY, right: rect.left - bounds.left + spareX + width, bottom: rect.top - bounds.top + spareY + height });
    }
    return boxes;
  }
  function overlaps(container, element, left, top, margin = 8) {
    return obstacles(container).some(rect => left + element.offsetWidth + margin > rect.left && left < rect.right + margin && top + element.offsetHeight + margin > rect.top && top < rect.bottom + margin);
  }
  root.gigPanelWouldOverlapLocalPip = overlaps;
  function safePoint(element, preferred) {
    const container = root.gigPanelContainer(element);
    if (!container || !root.gigPanelHasLayout(element)) return null;
    const rect = container.getBoundingClientRect(), margin = element.classList.contains('open') ? 32 : 8;
    const maxLeft = Math.max(margin, rect.width - element.offsetWidth - margin), maxTop = Math.max(margin, rect.height - element.offsetHeight - margin);
    const minTop = element.classList.contains('open') ? 72 : margin;
    const clamp = point => ({ left: Math.max(margin, Math.min(maxLeft, point.left)), top: Math.max(minTop, Math.min(maxTop, point.top)) });
    const center = clamp({ left: (rect.width - element.offsetWidth) / 2, top: maxTop }), desired = clamp(preferred || center);
    const candidates = [desired, center, { left: margin, top: maxTop }, { left: maxLeft, top: maxTop }, { left: margin, top: margin }, { left: maxLeft, top: margin }];
    obstacles(container).forEach(box => {
      candidates.push(clamp({ left: desired.left, top: box.top - element.offsetHeight - margin }));
      candidates.push(clamp({ left: box.right + margin, top: desired.top }));
      candidates.push(clamp({ left: box.left - element.offsetWidth - margin, top: desired.top }));
      candidates.push(clamp({ left: desired.left, top: box.bottom + margin }));
    });
    return candidates.find(point => !overlaps(container, element, point.left, point.top, margin)) || null;
  }
  root.defaultSafeGigPanelPosition = element => safePoint(element || panel);
  root.applySavedGigPanelPosition = function (element = panel) {
    if (!native.applySaved(element)) return false;
    const bounds = root.gigPanelContainer(element).getBoundingClientRect(), rect = element.getBoundingClientRect();
    const point = safePoint(element, { left: rect.left - bounds.left, top: rect.top - bounds.top });
    if (!point) return false;
    root.setGigPanelCoordinates(element, point.left, point.top);
    return true;
  };
  function schedulePlacement() {
    if (placementFrame) return;
    placementFrame = requestAnimationFrame(() => { placementFrame = 0; if (panel.dataset.dragging !== 'true') root.placeGigPanelSafely(panel, 'v6-layout'); });
  }
  const handle = document.createElement('button');
  handle.id = 'gigDiceDragHandle'; handle.type = 'button'; handle.className = 'gig-drag-handle'; handle.textContent = '\u2807';
  handle.setAttribute('aria-label', 'D\u00e9placer Gig Dice'); handle.title = 'D\u00e9placer Gig Dice (fl\u00e8ches au clavier)';
  panel.querySelector('.gig-core').append(handle);
  panel.dataset.draggableBound = '1'; // This presentation handle already owns pointer placement.
  let drag = null;
  handle.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    const rect = panel.getBoundingClientRect(); drag = { id: event.pointerId, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top };
    panel.dataset.dragging = 'true'; handle.setPointerCapture(event.pointerId); root.clearGigDieZoom(); event.preventDefault();
  });
  handle.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    const bounds = root.gigPanelContainer(panel)?.getBoundingClientRect(); if (!bounds) return;
    const point = safePoint(panel, { left: event.clientX - bounds.left - drag.offsetX, top: event.clientY - bounds.top - drag.offsetY });
    if (point) root.setGigPanelCoordinates(panel, point.left, point.top); event.preventDefault();
  });
  const stop = event => {
    if (!drag || drag.id !== event.pointerId) return;
    try { handle.releasePointerCapture(drag.id); } catch (_) {}
    drag = null; panel.dataset.dragging = 'false'; root.saveGigPanelPosition(panel);
  };
  handle.addEventListener('pointerup', stop); handle.addEventListener('pointercancel', stop);
  handle.addEventListener('keydown', event => {
    const vector = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key]; if (!vector) return;
    const bounds = root.gigPanelContainer(panel).getBoundingClientRect(), rect = panel.getBoundingClientRect();
    const point = safePoint(panel, { left: rect.left - bounds.left + vector[0] * 16, top: rect.top - bounds.top + vector[1] * 16 });
    if (point) { root.setGigPanelCoordinates(panel, point.left, point.top); root.saveGigPanelPosition(panel); } event.preventDefault();
  });
  new MutationObserver(records => { if (records.some(record => record.target === panel && record.attributeName === 'class')) schedulePlacement(); }).observe(panel, { attributes: true, attributeFilter: ['class'] });
  decorate(); schedulePlacement(); root.TCGateGigDiceV6 = Object.freeze({ version: '6.0', decorate, safePoint, obstacles });
})(window);