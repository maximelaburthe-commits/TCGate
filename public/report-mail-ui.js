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

  const modal = document.getElementById('reportOverlay');
  if (!modal) return;
  const note = modal.querySelector('#reportText');
  const sendButton = modal.querySelector('#sendReport');
  const closeButtons = [modal.querySelector('#closeReport')];
  const idleSendLabel = sendButton.textContent;
  const feedbackSection = modal.querySelector('#visionFeedbackSection');
  const feedbackList = modal.querySelector('#visionFeedbackList');
  const addFeedbackButton = modal.querySelector('#addVisionFeedback');
  const feedbackEntries = [];
  const feedbackTypes = [
    ['not_recognized', 'Carte non reconnue'],
    ['wrong_identification', 'Mauvaise carte reconnue'],
    ['unstable_identification', 'Reconnaissance instable']
  ];

  function collectFeedbackEntries() {
    return feedbackEntries.map(row => ({
      issueType: row.querySelector('[data-field="issueType"]').value,
      cardName: row.querySelector('[data-field="cardName"]').value,
      recognizedAs: row.querySelector('[data-field="recognizedAs"]').value,
      note: row.querySelector('[data-field="note"]').value
    }));
  }

  function updateFeedbackControls() {
    if (addFeedbackButton) addFeedbackButton.disabled = feedbackEntries.length >= 10;
  }

  function addFeedbackEntry() {
    if (!feedbackList || feedbackEntries.length >= 10) return;
    const row = document.createElement('div');
    row.className = 'vision-feedback-entry';
    row.innerHTML = `
      <label>Type de problème
        <select data-field="issueType">${feedbackTypes.map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select>
      </label>
      <label>Carte réellement jouée
        <input data-field="cardName" type="text" maxlength="120" placeholder="Panam" required>
      </label>
      <label data-recognized-as hidden>Carte reconnue par TCGate
        <input data-field="recognizedAs" type="text" maxlength="120" placeholder="Jackie Wells">
      </label>
      <label>Commentaire facultatif
        <textarea data-field="note" maxlength="500" placeholder="Reflet sur la sleeve, carte inclinée…"></textarea>
      </label>
      <button class="btn subtle vision-feedback-remove" type="button">Supprimer</button>`;
    const type = row.querySelector('[data-field="issueType"]');
    const recognized = row.querySelector('[data-recognized-as]');
    type.addEventListener('change', () => {
      const visible = type.value === 'wrong_identification';
      recognized.hidden = !visible;
      if (!visible) row.querySelector('[data-field="recognizedAs"]').value = '';
    });
    row.querySelector('.vision-feedback-remove').addEventListener('click', () => {
      feedbackEntries.splice(feedbackEntries.indexOf(row), 1);
      row.remove();
      updateFeedbackControls();
    });
    feedbackEntries.push(row);
    feedbackList.appendChild(row);
    feedbackSection.open = true;
    updateFeedbackControls();
    row.querySelector('[data-field="cardName"]').focus();
  }

  function resetFeedbackEntries() {
    feedbackEntries.splice(0);
    feedbackList?.replaceChildren();
    if (feedbackSection) feedbackSection.open = false;
    updateFeedbackControls();
  }

  addFeedbackButton?.addEventListener('click', addFeedbackEntry);
  window.TCGateReportVisionFeedback = Object.freeze({ getEntries: collectFeedbackEntries });

  function setStatus(message = '', kind = '') {
    sendButton.title = message;
    sendButton.dataset.status = kind;
    if (kind === 'working') sendButton.textContent = message;
    else if (!message || kind === 'error') sendButton.textContent = idleSendLabel;
  }

  function openModal(sourceButton) {
    activeReportButton = sourceButton;
    note.value = '';
    resetFeedbackEntries();
    setStatus('');
    document.getElementById('moreMenu')?.classList.add('hidden');
    document.getElementById('moreMenuToggle')?.setAttribute('aria-expanded', 'false');
    modal.classList.add('show');
    setTimeout(() => note.focus(), 0);
  }

  function closeModal() {
    if (busy) return;
    modal.classList.remove('show');
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
    if (event.key === 'Escape' && modal.classList.contains('show') && !busy) {
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
      const incomplete = feedbackEntries.find(row => !row.querySelector('[data-field="cardName"]').value.trim());
      if (incomplete) {
        incomplete.querySelector('[data-field="cardName"]').focus();
        throw new Error('Indiquez le nom de la carte signalée ou supprimez cette entrée.');
      }
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
        modal.classList.remove('show');
        sendButton.textContent = idleSendLabel;
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
