'use strict';

(() => {
  const reportButtons = [
    document.getElementById('generateReportLobby'),
    document.getElementById('generateReportGame')
  ].filter(Boolean);

  if (!reportButtons.length) return;

  let bypassNextReportClick = false;
  let activeReportButton = null;
  let busy = false;

  const modal = document.createElement('div');
  modal.id = 'reportMailModal';
  modal.className = 'tcgate-report-mail-modal hidden';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'reportMailTitle');
  modal.innerHTML = `
    <div class="tcgate-report-mail-card">
      <button type="button" class="tcgate-report-mail-close" aria-label="Fermer">×</button>
      <span class="eyebrow">Alpha TCGate</span>
      <h2 id="reportMailTitle">Envoyer un rapport</h2>
      <p class="tcgate-report-mail-help">
        Le diagnostic technique sera envoyé à l'équipe TCGate.
        Aucune vidéo, aucun audio et aucune capture d'écran ne sont ajoutés automatiquement.
      </p>
      <label class="tcgate-report-mail-label" for="reportMailNote">Notes facultatives</label>
      <textarea id="reportMailNote" maxlength="2000"
        placeholder="Ex. : la carte HD a disparu après être passé en plein écran. J'étais sur Chrome, webcam active."></textarea>
      <div id="reportMailStatus" class="tcgate-report-mail-status" aria-live="polite"></div>
      <div class="tcgate-report-mail-actions">
        <button type="button" class="secondary tcgate-report-mail-cancel">Annuler</button>
        <button type="button" class="primary tcgate-report-mail-send">Envoyer le rapport</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const note = modal.querySelector('#reportMailNote');
  const status = modal.querySelector('#reportMailStatus');
  const sendButton = modal.querySelector('.tcgate-report-mail-send');
  const closeButtons = [
    modal.querySelector('.tcgate-report-mail-close'),
    modal.querySelector('.tcgate-report-mail-cancel')
  ];

  function setStatus(message = '', kind = '') {
    status.textContent = message;
    status.className = `tcgate-report-mail-status ${kind}`.trim();
  }

  function openModal(sourceButton) {
    activeReportButton = sourceButton;
    note.value = '';
    setStatus('');
    modal.classList.remove('hidden');
    setTimeout(() => note.focus(), 0);
  }

  function closeModal() {
    if (busy) return;
    modal.classList.add('hidden');
    activeReportButton = null;
  }

  reportButtons.forEach(button => {
    button.addEventListener('click', event => {
      if (bypassNextReportClick) {
        bypassNextReportClick = false;
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      openModal(button);
    }, true);
  });

  closeButtons.forEach(button => button?.addEventListener('click', closeModal));
  modal.addEventListener('click', event => {
    if (event.target === modal) closeModal();
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !modal.classList.contains('hidden') && !busy) {
      closeModal();
    }
  });

  async function captureExistingReportZip(sourceButton) {
    if (!sourceButton) throw new Error('Bouton Rapport introuvable.');

    const nativeCreateObjectURL = URL.createObjectURL.bind(URL);
    const nativeRevokeObjectURL = URL.revokeObjectURL.bind(URL);
    const nativeAnchorClick = HTMLAnchorElement.prototype.click;

    let capturedBlob = null;
    let resolveCapture;
    let rejectCapture;
    const capturePromise = new Promise((resolve, reject) => {
      resolveCapture = resolve;
      rejectCapture = reject;
    });

    const timer = setTimeout(() => rejectCapture(new Error('Generation du rapport trop longue.')), 20000);

    URL.createObjectURL = function patchedCreateObjectURL(object) {
      if (object instanceof Blob && object.type === 'application/zip') {
        capturedBlob = object;
        resolveCapture(object);
      }
      return nativeCreateObjectURL(object);
    };

    URL.revokeObjectURL = function patchedRevokeObjectURL(url) {
      return nativeRevokeObjectURL(url);
    };

    HTMLAnchorElement.prototype.click = function patchedAnchorClick() {
      const name = String(this.download || '');
      if (name.startsWith('tcgate-alpha-rapport-complet-') && name.endsWith('.zip')) {
        return;
      }
      return nativeAnchorClick.call(this);
    };

    try {
      bypassNextReportClick = true;
      sourceButton.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
      }));
      return await capturePromise;
    } finally {
      clearTimeout(timer);
      URL.createObjectURL = nativeCreateObjectURL;
      URL.revokeObjectURL = nativeRevokeObjectURL;
      HTMLAnchorElement.prototype.click = nativeAnchorClick;
      bypassNextReportClick = false;
      if (!capturedBlob) {
        // no-op; capturePromise carries the useful error
      }
    }
  }

  async function blobToBase64(blob) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const chunk = 0x8000;
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  function currentRoomCode() {
    const fromDom = document.getElementById('lobbyCode')?.textContent?.trim();
    if (fromDom && /^[A-Z0-9]{4,12}$/i.test(fromDom)) return fromDom.toUpperCase();
    const fromUrl = new URLSearchParams(location.search).get('room');
    return fromUrl ? fromUrl.toUpperCase().slice(0, 12) : '';
  }

  function currentContext() {
    const game = document.getElementById('lobbyGameLabel')?.textContent?.trim() || 'TCGate';
    const screen = document.getElementById('screenGame')?.classList.contains('active') ? 'partie' : 'salon';
    return `${screen} · ${game}`.slice(0, 120);
  }

  sendButton.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    sendButton.disabled = true;
    closeButtons.forEach(button => { if (button) button.disabled = true; });
    setStatus('Generation du rapport complet…', 'working');

    try {
      const zipBlob = await captureExistingReportZip(activeReportButton);
      setStatus('Envoi securise du rapport…', 'working');

      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `tcgate-alpha-rapport-complet-${stamp}.zip`;
      const zipBase64 = await blobToBase64(zipBlob);

      const response = await fetch('/api/report-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename,
          zipBase64,
          note: note.value || '',
          roomCode: currentRoomCode(),
          context: currentContext()
        })
      });

      let result = null;
      try { result = await response.json(); } catch {}

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || `Erreur d'envoi (${response.status})`);
      }

      setStatus('Rapport envoye ✓', 'success');
      setTimeout(() => {
        busy = false;
        sendButton.disabled = false;
        closeButtons.forEach(button => { if (button) button.disabled = false; });
        modal.classList.add('hidden');
        activeReportButton = null;
      }, 1100);
    } catch (err) {
      setStatus(err?.message || 'Impossible d’envoyer le rapport.', 'error');
      busy = false;
      sendButton.disabled = false;
      closeButtons.forEach(button => { if (button) button.disabled = false; });
    }
  });
})();
