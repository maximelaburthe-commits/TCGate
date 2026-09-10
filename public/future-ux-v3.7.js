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
  root.TCGateFutureUx = Object.freeze({ version: '3.7-hub', mountUnifiedHub });
})(window);
