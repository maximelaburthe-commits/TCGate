(function initFutureUx(root) {
  'use strict';

  const document = root.document;
  if (!document) return;

  function makeZone(title, className) {
    const zone = document.createElement('section');
    zone.className = `future-hub-zone ${className}`;
    const heading = document.createElement('div');
    heading.className = 'future-hub-zone-heading';
    const marker = document.createElement('span');
    marker.setAttribute('aria-hidden', 'true');
    const label = document.createElement('h3');
    label.textContent = title;
    heading.append(marker, label);
    zone.append(heading);
    return zone;
  }

  function mountUnifiedHub() {
    const setup = document.getElementById('screenSetup');
    const hub = document.getElementById('screenLobby');
    const shell = hub?.querySelector('.panel-shell');
    const form = setup?.querySelector('.form-card');
    const back = setup?.querySelector('#setupBack');
    const invite = hub?.querySelector('.invite-card');
    const players = hub?.querySelector('.players-card');
    const equipment = hub?.querySelector('.equipment-card');
    const preview = equipment?.querySelector('.lobby-preview-wrap');
    const ready = hub?.querySelector('.lobby-bottom');
    const legacyGrid = hub?.querySelector('.lobby-grid');
    if (!shell || !form || !invite || !players || !equipment || !preview || !ready) return false;

    const layout = document.createElement('div');
    layout.className = 'future-hub-layout';
    const cameraZone = makeZone('Aperçu caméra', 'future-hub-camera');
    const controls = document.createElement('div');
    controls.className = 'future-hub-controls';
    const sessionZone = makeZone('Session', 'future-hub-session');
    const installationZone = makeZone('Mon installation', 'future-hub-installation');
    const playersZone = makeZone('Joueurs', 'future-hub-players');

    form.classList.add('future-hub-form');
    invite.classList.add('future-hub-invite');
    players.classList.add('future-hub-presence');
    equipment.classList.add('future-hub-equipment');
    ready.classList.add('future-hub-ready');

    cameraZone.append(preview);
    sessionZone.append(form, invite);
    installationZone.append(equipment);
    playersZone.append(players, ready);
    controls.append(sessionZone, installationZone, playersZone);
    layout.append(cameraZone, controls);
    legacyGrid?.remove();
    shell.append(layout);
    if (back) {
      back.classList.add('future-hub-back');
      shell.prepend(back);
    }
    setup.classList.add('future-hub-retired');
    hub.classList.add('future-hub-mounted', 'hub-preconnect');
    return true;
  }

  mountUnifiedHub();

  const game = document.getElementById('screenGame');
  const gameActions = game?.querySelector('.tcgate-game-actions');
  const deviceMenu = document.getElementById('gameDeviceMenu');
  let dockTimer = null;

  function dockMustStayVisible() {
    return Boolean(
      gameActions?.matches(':hover') ||
      gameActions?.contains(document.activeElement) ||
      (deviceMenu && !deviceMenu.classList.contains('hidden'))
    );
  }

  function scheduleDockHide() {
    clearTimeout(dockTimer);
    dockTimer = root.setTimeout(() => {
      if (dockMustStayVisible()) return scheduleDockHide();
      game?.classList.remove('future-media-dock-visible');
    }, 2600);
  }

  function showMediaDock() {
    if (!game) return;
    game.classList.add('future-media-dock-visible');
    scheduleDockHide();
  }

  function mountFutureTable() {
    if (!game || !gameActions) return false;
    game.classList.add('future-table-v37');
    document.getElementById('generateReportGame')?.setAttribute('aria-label', 'Générer un rapport complet');
    document.getElementById('leaveGame')?.setAttribute('aria-label', 'Quitter la partie');
    document.getElementById('leaveGame')?.setAttribute('title', 'Quitter la partie');
    gameActions.addEventListener('pointerenter', showMediaDock);
    gameActions.addEventListener('pointerleave', scheduleDockHide);
    gameActions.addEventListener('focusin', showMediaDock);
    gameActions.addEventListener('focusout', scheduleDockHide);
    gameActions.addEventListener('click', showMediaDock);
    game.addEventListener('pointermove', event => {
      if (event.clientX >= root.innerWidth - 120 || event.clientY >= root.innerHeight - 120) showMediaDock();
    }, { passive: true });
    if (deviceMenu) {
      new MutationObserver(() => {
        if (!deviceMenu.classList.contains('hidden')) showMediaDock();
        else scheduleDockHide();
      }).observe(deviceMenu, { attributes: true, attributeFilter: ['class'] });
    }
    return true;
  }

  mountFutureTable();

  /* Checkpoint C — presentation only; Table State remains the hit-test source. */
  const visionStage = document.getElementById('opponentFeed');
  const visionPreview = document.getElementById('displayCardPanel');
  const visionPreviewButton = document.getElementById('displayCardButton');

  function hasRecognizedPhysicalHover() {
    return Boolean(root.TCGTableStateEngine?.getSnapshot?.()?.lastHover?.known);
  }

  function syncVisionPreviewVisibility() {
    const visible = hasRecognizedPhysicalHover() && !visionPreviewButton?.classList.contains('hidden');
    game?.classList.toggle('future-vision-preview-visible', Boolean(visible));
  }

  function placeVisionPreview(event) {
    if (!visionPreview) return;
    const previewWidth = Math.min(190, Math.max(132, root.innerWidth * .14));
    const previewHeight = previewWidth * 1.4;
    const gap = 18;
    let left = event.clientX + gap;
    let top = event.clientY + gap;
    if (left + previewWidth > root.innerWidth - 10) left = event.clientX - previewWidth - gap;
    if (top + previewHeight > root.innerHeight - 10) top = event.clientY - previewHeight - gap;
    visionPreview.style.setProperty('--future-card-x', `${Math.max(10, left)}px`);
    visionPreview.style.setProperty('--future-card-y', `${Math.max(10, top)}px`);
  }

  function updatePhysicalCardHover(event) {
    const hit = hasRecognizedPhysicalHover();
    visionStage?.classList.toggle('future-vision-hit', hit);
    if (hit) placeVisionPreview(event);
    syncVisionPreviewVisibility();
  }

  function clearPhysicalCardHover() {
    visionStage?.classList.remove('future-vision-hit');
    game?.classList.remove('future-vision-preview-visible');
  }

  function openPhysicalCardZoom(event) {
    if (!hasRecognizedPhysicalHover() || visionPreviewButton?.classList.contains('hidden')) return;
    if (event.target?.closest?.('button,select,input,#localFeed,.tcgate-fullscreen-card')) return;
    visionPreviewButton.click();
  }

  function mountFutureVisionUx() {
    if (!visionStage || !visionPreview || !visionPreviewButton) return false;
    visionPreviewButton.tabIndex = -1;
    visionPreviewButton.setAttribute('aria-hidden', 'true');
    visionStage.addEventListener('pointermove', updatePhysicalCardHover);
    visionStage.addEventListener('pointerleave', clearPhysicalCardHover);
    visionStage.addEventListener('click', openPhysicalCardZoom);
    root.addEventListener('tcg-table-hover-hit', syncVisionPreviewVisibility);
    root.addEventListener('tcg-identification-result', syncVisionPreviewVisibility);
    new MutationObserver(syncVisionPreviewVisibility).observe(visionPreviewButton, {
      attributes: true,
      attributeFilter: ['class']
    });
    return true;
  }

  mountFutureVisionUx();

  /* Checkpoint D — presentation only; app.js remains the single Gig state owner. */
  const gigPanel = document.getElementById('gigDicePanel');
  const gigTotem = document.getElementById('gigTotem');
  const gigReset = document.getElementById('gigDiceReset');

  function setGigExpanded(expanded) {
    gigPanel?.classList.toggle('open', expanded);
    gigTotem?.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    gigTotem?.setAttribute('aria-label', expanded ? 'Replier les Gig Dice' : 'Ouvrir les Gig Dice');
  }

  function mountFutureGigDice() {
    if (!gigPanel || !gigTotem) return false;
    if (gigReset && deviceMenu) {
      gigReset.classList.add('future-gig-reset-menu');
      deviceMenu.append(gigReset);
    }
    gigTotem.addEventListener('click', () => {
      setGigExpanded(!gigTotem.matches('[aria-expanded="true"]'));
    });
    setGigExpanded(false);
    return true;
  }

  mountFutureGigDice();
  root.TCGateFutureUx = Object.freeze({
    version: '3.7-gig',
    mountUnifiedHub,
    mountFutureTable,
    mountFutureVisionUx,
    mountFutureGigDice,
    showMediaDock
  });
})(window);
