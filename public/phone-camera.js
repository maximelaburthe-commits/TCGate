'use strict';

(() => {
  const state = {
    api: null, room: null, peerId: null, pairId: null, phoneUrl: null, es: null, pc: null,
    pendingIce: [], signalChain: Promise.resolve(), connected: false, cameraActive: false,
    phoneState: null, phoneReport: null, events: [], reconnectTimer: null, onTrack: null, onState: null
  };

  function record(type, data = {}) {
    state.events.push({ at: new Date().toISOString(), type, data });
    if (state.events.length > 200) state.events.shift();
  }

  function notify(status, extra = {}) {
    state.onState?.({ status, pairId: state.pairId, connected: state.connected, cameraActive: state.cameraActive, ...extra });
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
      es.addEventListener('phone-pair-state', event => {
        const data = JSON.parse(event.data);
        state.connected = Boolean(data.connected);
        state.cameraActive = Boolean(data.cameraActive);
        notify(state.connected ? (state.cameraActive ? 'streaming' : 'connected') : (data.joined ? 'disconnected' : 'waiting'));
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
      record('video-track', { id: event.track.id });
      state.onTrack?.(event.track, event.streams?.[0] || new MediaStream([event.track]));
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
    }
  }

  async function fetchDiagnostics() {
    if (!state.pairId) return null;
    const [phoneState, phoneReport] = await Promise.all([
      call(`/api/phone/pairs/${state.pairId}/state`).catch(() => null),
      call(`/api/phone/pairs/${state.pairId}/report`).catch(() => null)
    ]);
    if (phoneState?.state) state.phoneState = phoneState.state;
    if (phoneReport?.available) state.phoneReport = phoneReport.report;
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
      diagnostics: state.phoneState,
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
    const pairId = state.pairId;
    state.connected = false;
    state.cameraActive = false;
    if (server && pairId && state.api) await call(`/api/phone/pairs/${pairId}`, { method: 'DELETE' }).catch(() => {});
    state.pairId = null;
    state.phoneUrl = null;
    if (!quiet) notify('idle');
  }

  window.TCGatePhoneCamera = { createPair, disconnect, fetchDiagnostics, getSnapshot: snapshot };
})();
