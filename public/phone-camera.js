'use strict';

(() => {
  const state = {
    api: null, room: null, peerId: null, pairId: null, phoneUrl: null, es: null, pc: null,
    pendingIce: [], signalChain: Promise.resolve(), connected: false, cameraActive: false,
    phoneState: null, phoneReport: null, events: [], reconnectTimer: null, onTrack: null, onState: null,
    controls: new window.TCGatePhoneCameraControl.PhoneCameraControlWaiter(15000),
    remoteTrack: null,
    remoteStream: null, recoveryPending: false, pcDiagnostics: null
  };

  function record(type, data = {}) {
    state.events.push({ at: new Date().toISOString(), type, data });
    if (state.events.length > 200) state.events.shift();
  }

  function notify(status, extra = {}) {
    state.onState?.({
      status,
      pairId: state.pairId,
      connected: state.connected,
      cameraActive: state.cameraActive,
      diagnostics: state.phoneState,
      ...extra
    });
  }

  async function call(path, options = {}) {
    if (!state.api) throw new Error('Session PC non initialisée');
    return state.api(path, options);
  }

  async function createPair({ api, room, peerId, onTrack, onState }) {
    await disconnect({ server: true, quiet: true });
    Object.assign(state, { api, room, peerId, onTrack, onState });
    const result = await call('/api/phone/pairs', { method: 'POST', body: { room, peerId } });
    state.pairId = result.pairId;
    state.phoneUrl = result.phoneUrl;
    record('pair-created', { expiresInMs: result.expiresInMs });
    notify('waiting', { phoneUrl: result.phoneUrl, qrSvg: result.qrSvg, expiresInMs: result.expiresInMs });
    await connectEvents();
    return result;
  }

  async function eventTicket() {
    return call(`/api/phone/pairs/${state.pairId}/events-ticket`, { method: 'POST', body: { role: 'pc' } });
  }

  async function connectEvents() {
    clearTimeout(state.reconnectTimer);
    if (!state.pairId) return;
    try {
      const { ticket } = await eventTicket();
      state.es?.close();
      const es = new EventSource(`/api/phone/events?ticket=${encodeURIComponent(ticket)}`);
      state.es = es;
      const opened = new Promise(resolve => {
        const timer = setTimeout(() => resolve(false), 2500);
        es.onopen = () => {
          clearTimeout(timer);
          resolve(true);
        };
      });
      es.addEventListener('phone-pair-state', event => {
        const data = JSON.parse(event.data);
        state.connected = Boolean(data.connected);
        state.cameraActive = Boolean(data.cameraActive);
        notify(state.connected ? (state.cameraActive ? 'streaming' : 'connected') : (data.joined ? 'disconnected' : 'waiting'));
        if (state.connected && state.recoveryPending) {
          signal('restart-request', { reason: 'pc-recovery-phone-return', at: Date.now() })
            .then(result => {
              if (result?.delivered) state.recoveryPending = false;
              record('recovery-restart-request', { delivered: Boolean(result?.delivered), source: 'phone-return' });
            })
            .catch(() => {});
        }
      });
      es.addEventListener('phone-state', event => {
        const data = JSON.parse(event.data);
        state.phoneState = data.state || null;
        state.cameraActive = Boolean(data.state?.cameraActive);
        notify(state.cameraActive ? 'streaming' : 'connected', { diagnostics: state.phoneState });
      });
      es.addEventListener('signal', event => enqueueSignal(JSON.parse(event.data)));
      es.onerror = () => {
        es.close();
        if (state.es === es) state.es = null;
        if (state.pairId) state.reconnectTimer = setTimeout(connectEvents, 1200);
      };
      return await opened;
    } catch (error) {
      record('events-error', { message: error.message });
      if (state.pairId) state.reconnectTimer = setTimeout(connectEvents, 1500);
    }
  }

  async function signal(type, payload) {
    return call(`/api/phone/pairs/${state.pairId}/signal`, { method: 'POST', body: { role: 'pc', type, payload } });
  }

  async function ensurePeer() {
    if (state.pc && state.pc.signalingState !== 'closed') return state.pc;
    const config = await call(`/api/phone/pairs/${state.pairId}/rtc-config?role=pc`);
    const pc = new RTCPeerConnection({ iceServers: config.iceServers, iceTransportPolicy: config.iceTransportPolicy || 'all' });
    state.pc = pc;
    pc.addTransceiver('video', { direction: 'recvonly' });
    pc.onicecandidate = event => {
      if (event.candidate) signal('candidate', { candidate: event.candidate.toJSON?.() || event.candidate }).catch(() => {});
    };
    pc.ontrack = event => {
      if (event.track.kind !== 'video') return;
      state.connected = true;
      state.cameraActive = true;
      state.recoveryPending = false;
      state.remoteTrack = event.track;
      state.remoteStream = event.streams?.[0] || new MediaStream([event.track]);
      record('video-track', { id: event.track.id });
      state.onTrack?.(event.track, state.remoteStream);
      notify('streaming');
      event.track.addEventListener('ended', () => {
        state.cameraActive = false;
        notify('disconnected');
      }, { once: true });
    };
    pc.onconnectionstatechange = () => {
      record('connection-state', { value: pc.connectionState });
      if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
        state.connected = false;
        state.cameraActive = false;
        notify('disconnected');
      }
    };
    return pc;
  }

  function enqueueSignal(message) {
    state.signalChain = state.signalChain.then(() => handleSignal(message)).catch(error => {
      record('signal-error', { type: message.type, message: error.message });
    });
  }

  async function handleSignal(message) {
    if (message.type === 'offer') {
      const pc = await ensurePeer();
      const description = message.payload?.description || message.payload;
      if (pc.signalingState !== 'stable') {
        try { await pc.setLocalDescription({ type: 'rollback' }); } catch {}
      }
      await pc.setRemoteDescription(description);
      for (const candidate of state.pendingIce.splice(0)) await pc.addIceCandidate(candidate);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await signal('answer', { generation: message.payload?.generation || 0, description: pc.localDescription });
      return;
    }
    if (message.type === 'candidate') {
      const candidate = message.payload?.candidate || message.payload;
      const pc = await ensurePeer();
      if (pc.remoteDescription) await pc.addIceCandidate(candidate);
      else state.pendingIce.push(candidate);
      return;
    }
    if (message.type === 'reset-peer') {
      try { state.pc?.close(); } catch {}
      state.pc = null;
      state.pendingIce = [];
      return;
    }
    if (message.type === 'control-state') {
      state.phoneState = message.payload || null;
      notify(state.cameraActive ? 'streaming' : 'connected', { diagnostics: state.phoneState });
      return;
    }
    if (message.type === 'control-result') {
      if (message.payload?.state) state.phoneState = message.payload.state;
      state.controls.settle(message.payload || {});
      record('control-result', {
        requestId: message.payload?.requestId || null,
        action: message.payload?.action || null,
        ok: Boolean(message.payload?.ok),
        errorName: message.payload?.errorName || null,
        message: message.payload?.error ? String(message.payload.error).slice(0, 180) : null,
        rollbackRestored: message.payload?.rollbackRestored ?? null
      });
      notify(state.cameraActive ? 'streaming' : 'connected', {
        diagnostics: state.phoneState,
        controlError: message.payload?.ok === false ? message.payload.error || 'Commande refusée' : null
      });
    }
  }

  async function selectCamera(cameraId) {
    const id = String(cameraId || '');
    const known = state.phoneState?.cameraDevices?.some(camera => camera.id === id);
    if (!known) throw new Error('Objectif téléphone inconnu');
    const requestId = `camera-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const completion = state.controls.wait(requestId);
    let delivered;
    try {
      delivered = await signal('control', { requestId, action: 'select-camera', args: { cameraId: id } });
    } catch (error) {
      state.controls.cancel(requestId, error.message || 'Commande non délivrée');
      await completion.catch(() => {});
      throw error;
    }
    if (!delivered?.delivered) {
      state.controls.cancel(requestId, 'Téléphone indisponible');
      await completion.catch(() => {});
      throw new Error('Téléphone indisponible');
    }
    record('camera-select-requested', { cameraId: id, requestId });
    return completion;
  }

  async function findCurrent({ api, room, peerId }) {
    const result = await api(`/api/phone/pairs/current?room=${encodeURIComponent(room)}&peer=${encodeURIComponent(peerId)}`);
    return result?.available ? result : null;
  }

  async function restoreCurrent({ api, room, peerId, current = null, onTrack, onState }) {
    await disconnect({ server: false, quiet: true });
    Object.assign(state, { api, room, peerId, onTrack, onState });
    const found = current || await findCurrent({ api, room, peerId });
    if (!found?.pairId) return null;
    state.pairId = found.pairId;
    state.phoneState = found.state || null;
    state.connected = Boolean(found.connected);
    state.cameraActive = Boolean(found.cameraActive);
    state.recoveryPending = true;
    notify(state.connected ? (state.cameraActive ? 'streaming' : 'connected') : 'disconnected', { recovered: true });
    const eventsReady = await connectEvents();
    await ensurePeer();
    if (eventsReady && state.recoveryPending) {
      const restart = await signal('restart-request', { reason: 'pc-recovery', at: Date.now() }).catch(() => null);
      if (restart?.delivered) state.recoveryPending = false;
      record('recovery-restart-request', { delivered: Boolean(restart?.delivered) });
    }
    return found;
  }

  async function usePhoneSource() {
    if (!state.remoteTrack || state.remoteTrack.readyState !== 'live') throw new Error('Flux téléphone indisponible');
    await state.onTrack?.(state.remoteTrack, state.remoteStream || new MediaStream([state.remoteTrack]));
    return true;
  }

  async function fetchDiagnostics() {
    if (!state.pairId) return null;
    const [phoneState, phoneReport] = await Promise.all([
      call(`/api/phone/pairs/${state.pairId}/state`).catch(() => null),
      call(`/api/phone/pairs/${state.pairId}/report`).catch(() => null)
    ]);
    if (phoneState?.state) state.phoneState = phoneState.state;
    if (phoneReport?.available) state.phoneReport = phoneReport.report;
    if (state.pc) state.pcDiagnostics = await state.pc.getStats().then(report=>window.TCGatePhoneCameraDiagnostics.collect(report)).catch(()=>state.pcDiagnostics);
    return snapshot();
  }

  function snapshot() {
    return {
      version: 'tcgate-phone-camera-alpha-1',
      used: Boolean(state.pairId),
      pairId: state.pairId,
      connected: state.connected,
      cameraActive: state.cameraActive,
      connectionState: state.pc?.connectionState || null,
      diagnostics: {
        ...(state.phoneState || {}),
        route: state.pcDiagnostics?.route || state.phoneState?.diagnostics?.route || state.phoneReport?.diagnostics?.route || null,
        sender: state.phoneState?.diagnostics?.sender || state.phoneReport?.diagnostics?.sender || null,
        receiver: state.pcDiagnostics?.receiver || null
      },
      report: state.phoneReport,
      events: state.events.slice()
    };
  }

  async function disconnect({ server = true, quiet = false } = {}) {
    clearTimeout(state.reconnectTimer);
    state.reconnectTimer = null;
    state.es?.close();
    state.es = null;
    try { state.pc?.close(); } catch {}
    state.pc = null;
    state.pendingIce = [];
    state.remoteTrack = null;
    state.remoteStream = null;
    state.pcDiagnostics = null;
    state.recoveryPending = false;
    state.controls.cancelAll();
    const pairId = state.pairId;
    state.connected = false;
    state.cameraActive = false;
    if (server && pairId && state.api) await call(`/api/phone/pairs/${pairId}`, { method: 'DELETE' }).catch(() => {});
    state.pairId = null;
    state.phoneUrl = null;
    if (!quiet) notify('idle');
  }

  window.TCGatePhoneCamera = {
    createPair,
    disconnect,
    fetchDiagnostics,
    getSnapshot: snapshot,
    selectCamera,
    findCurrent,
    restoreCurrent,
    usePhoneSource
  };
})();
