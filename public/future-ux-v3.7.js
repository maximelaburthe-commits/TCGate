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
  root.TCGateFutureUx = Object.freeze({ version: '3.7-table', mountUnifiedHub, mountFutureTable, showMediaDock });
})(window);
