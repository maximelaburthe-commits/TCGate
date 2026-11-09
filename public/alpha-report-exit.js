'use strict';

(function initAlphaReportExit(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root?.document) { root.TCGateAlphaReportExit = api; api.install(root); }
})(typeof window !== 'undefined' ? window : null, function createAlphaReportExit() {
  function createSessionGate() {
    let current = null;
    let reported = false;
    return Object.freeze({
      observe(session) { if (current !== session) { current = session; reported = false; } },
      markSent(session) { if (session && session === current) reported = true; },
      shouldRemind(session) { return Boolean(session && session === current && !reported); }
    });
  }

  function install(win) {
    const doc = win.document;
    if (doc.getElementById('alphaReportExitOverlay')) return;
    const gate = createSessionGate();
    const sentStorageKey = 'tcgate-alpha-report-sent-room-v1';
    let lastSession = null;
    let reportedRoom = null;
    try { reportedRoom = win.sessionStorage.getItem(sentStorageKey); } catch {}
    let pending = null;
    let bypass = null;
    let restoreReportOverlay = null;
    let focusBefore = null;
    const overlay = doc.createElement('div');
    overlay.id = 'alphaReportExitOverlay';
    overlay.className = 'flow-overlay alpha-report-exit';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'alphaReportExitTitle');
    overlay.setAttribute('aria-describedby', 'alphaReportExitDescription');
    overlay.innerHTML = `<div class="flow-card">
      <h3 id="alphaReportExitTitle"></h3><p id="alphaReportExitDescription"></p>
      <div class="flow-actions">
        <button class="btn primary" id="alphaExitReport" type="button">Envoyer un rapport</button>
        <button class="btn danger" id="alphaExitWithoutReport" type="button">Quitter sans rapport</button>
        <button class="btn" id="alphaExitCancel" type="button">Annuler</button>
      </div></div>`;
    doc.body.appendChild(overlay);
    const endDescription = doc.querySelector('#endOverlay .flow-card > p');
    if (endDescription) endDescription.textContent = 'Vous pouvez revenir au Hub ou quitter la session. Le rapport reste facultatif.';
    const byId = id => doc.getElementById(id);
    const session = () => {
      const screen = byId('screenLobby')?.classList.contains('active') || byId('screenGame')?.classList.contains('active');
      if (!screen) return null;
      const code = new URL(win.location.href).searchParams.get('room');
      return code && /^[a-z0-9]{4,12}$/i.test(code) ? code.toUpperCase() : null;
    };
    function syncSession() {
      const current = session();
      if ((lastSession && !current) || (current && reportedRoom && current !== reportedRoom)) {
        reportedRoom = null;
        try { win.sessionStorage.removeItem(sentStorageKey); } catch {}
      }
      gate.observe(current);
      if (current && reportedRoom === current) gate.markSent(current);
      lastSession = current;
      if (pending && pending.session !== current) { overlay.classList.remove('show'); pending = null; }
    }
    syncSession();
    for (const id of ['screenHome', 'screenLobby', 'screenGame']) {
      if (byId(id)) new win.MutationObserver(syncSession).observe(byId(id), { attributes: true, attributeFilter: ['class'] });
    }
    function showPrompt() {
      if (!pending || pending.session !== session()) return;
      const sent = !gate.shouldRemind(pending.session);
      byId('alphaReportExitTitle').textContent = sent ? 'Rapport envoy\u00e9' : 'Avant de partir\u2026';
      byId('alphaReportExitDescription').textContent = sent
        ? 'Votre rapport a \u00e9t\u00e9 envoy\u00e9. Vous pouvez quitter ou revenir \u00e0 la session.'
        : 'TCGate est encore en Alpha. Un probl\u00e8me, une suggestion ou simplement un retour sur votre partie ? Votre rapport nous aidera \u00e0 am\u00e9liorer la plateforme.';
      byId('alphaExitReport').hidden = sent;
      byId('alphaExitWithoutReport').textContent = sent ? 'Quitter' : 'Quitter sans rapport';
      overlay.classList.add('show');
      (sent ? byId('alphaExitWithoutReport') : byId('alphaExitReport')).focus();
    }
    function cancel() {
      if (!pending) return;
      const restore = pending.restore;
      pending = null;
      overlay.classList.remove('show');
      if (restore) byId(restore)?.classList.add('show');
      focusBefore?.focus?.();
    }
    function continueExit() {
      const action = pending;
      if (!action || action.session !== session()) return cancel();
      pending = null;
      overlay.classList.remove('show');
      bypass = action.continueId;
      try { byId(action.continueId)?.click(); } finally { bypass = null; }
    }
    const exitIds = new Set(['leaveLobby', 'leaveGame', 'confirmQuit', 'endQuit', 'endHub']);
    doc.addEventListener('click', event => {
      const button = event.target.closest?.('button');
      if (!button) return;
      if (button.id === 'endReport') { restoreReportOverlay = 'endOverlay'; return; }
      if (!exitIds.has(button.id) || bypass === button.id) return;
      syncSession();
      if (!gate.shouldRemind(session())) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (pending) return;
      focusBefore = button;
      const restore = byId('endOverlay')?.classList.contains('show') ? 'endOverlay'
        : byId('quitOverlay')?.classList.contains('show') ? 'quitOverlay' : null;
      byId('quitOverlay')?.classList.remove('show');
      byId('endOverlay')?.classList.remove('show');
      pending = { session: session(), continueId: button.id === 'leaveGame' ? 'confirmQuit' : button.id, restore };
      showPrompt();
    }, true);
    byId('alphaExitCancel').addEventListener('click', cancel);
    byId('alphaExitWithoutReport').addEventListener('click', continueExit);
    byId('alphaExitReport').addEventListener('click', () => {
      if (!pending) return;
      overlay.classList.remove('show');
      byId(byId('screenGame')?.classList.contains('active') ? 'generateReportGame' : 'generateReportLobby')?.click();
    });
    win.addEventListener('tcgate-report-sent', event => {
      syncSession();
      const sentRoom = event.detail?.roomCode || null;
      gate.markSent(sentRoom);
      if (sentRoom && sentRoom === session()) {
        reportedRoom = sentRoom;
        try { win.sessionStorage.setItem(sentStorageKey, sentRoom); } catch {}
      }
    });
    win.addEventListener('tcgate-report-closed', () => {
      if (pending) showPrompt();
      else if (restoreReportOverlay) {
        if (session()) byId(restoreReportOverlay)?.classList.add('show');
        restoreReportOverlay = null;
      }
    });
    doc.addEventListener('keydown', event => {
      if (!overlay.classList.contains('show')) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); cancel(); }
      if (event.key === 'Tab') {
        const buttons = [...overlay.querySelectorAll('button')].filter(button => !button.hidden);
        const first = buttons[0], last = buttons.at(-1);
        if (event.shiftKey && doc.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && doc.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }, true);
    overlay.addEventListener('click', event => { if (event.target === overlay) cancel(); });
  }
  return Object.freeze({ createSessionGate, install });
});