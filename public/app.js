
'use strict';

const $ = id => document.getElementById(id);

const screens = {
  home: $('screenHome'),
  setup: $('screenSetup'),
  lobby: $('screenLobby'),
  game: $('screenGame')
};

const PRODUCT_VERSION = 'TCGate Alpha 0.1 Candidate 11 · UI 1.0.4';
const VISION_PROFILE = 'Vision FaceWebcam 0.3.1 · State 0.1.6';

const state = {
  mode: 'create',
  playerName: 'Joueur',
  game: 'cyberpunk',
  roomCode: null,
  peerId: null,
  authToken: null,
  role: null,
  roomSnapshot: null,
  opponentId: null,
  opponentName: 'Adversaire',
  opponentPresent: false,
  opponentConnected: false,
  ownReady: false,
  opponentReady: false,
  readyRequestPending: false,
  readyRequestedValue: null,
  readyStatePollTimer: null,
  readyStatePollInFlight: false,
  readyStatePollCount: 0,
  hubMetadataTimer: null,
  rtcPrewarmPending: false,
  rtcPrewarmReady: false,
  rtcPrewarmError: null,
  recoveryEpoch: 0,
  sseReconnectTimer: null,
  sseReconnectAttempts: 0,
  rtcRecoveryTimer: null,
  rtcRecoveryInFlight: false,
  remoteRecoveryWatchdogTimer: null,
  remoteRecoveryRetryUsed: false,
  pendingRtcRestartRequest: false,
  mainRtcRecoveryActive: false,
  recoveryBootstrapPending: false,
  roomRecoveryInFlight: false,
  rtcPeerCreatePromise: null,
  rtcCreateEpoch: 0,
  rtcPeerGeneration: 0,
  remoteVideoPlaybackRetryTimer: null,

  eventSource: null,
  localStream: null,
  remoteStream: null,
  remoteMediaState: {
    cameraEnabled: null,
    microphoneEnabled: null,
    receivedAt: null
  },
  cameraEnabled: false,
  micEnabled: false,
  selectedCameraId: null,
  selectedMicrophoneId: null,
  localPreviewVisible: true,
  videoSource: 'webcam',
  phoneCameraQrUrl: null,

  gigDice: [],
  dieDrag: null,
  lastMovedDieId: null,
  timer: { enabled: true, durationSeconds: 3000, running: false, remainingSeconds: 3000, endsAt: null, revision: 0 },
  timerTick: null,

  lostCameraId: null,
  lostMicrophoneId: null,
  lostCameraLabel: null,
  lostMicrophoneLabel: null,
  deviceRecoveryInFlight: false,
  deviceChangeTimer: null,
  persistentRecovery: null,

  pc: null,
  videoTransceiver: null,
  audioTransceiver: null,
  pendingIce: [],
  rtcStarted: false,
  remoteVideoStarted: false,
  rtcStatsTimer: null,
  lastRtcMetrics: null,
  rtcConfig: null,
  rtcConfigKey: null,
  rtcConfigLoading: null,
  turnStatus: {
    configured: false,
    available: false,
    provider: null,
    policy: 'all',
    expiresAt: null,
    reason: 'not-loaded'
  },
  rtcQualityControl: {
    cpuEpisode: null,
    cpuEpisodes: [],
    cpuSamples: 0,
    recoverySamples: 0,
    currentVisionThrottleMs: 0,
    senderPolicyApplied: false,
    senderPolicyError: null,
    senderScaleResolutionDownBy: 1,
    senderAdaptiveMode: 'native',
    senderAdaptationPending: false,
    senderAdaptations: [],
    captureAdaptiveMode: 'native',
    captureAdaptationPending: false,
    captureAdaptationError: null,
    captureAdaptations: [],
    captureAdaptationAttempts: 0,
    captureLastAttemptAtMs: 0,
    lastReason: null
  },
  gameEntering: false,
  gameActive: false,
  offerInFlight: false,
  offerSent: false,
  offerDeliveryRebuilds: 0,
  lastRemoteOfferSdp: null,
  lastRemoteAnswerSdp: null,
  remotePlayPending: false,

  visionAssetsLoaded: false,
  visionAssetsLoading: false,
  visionAssetsError: null,
  visionPrepared: false,
  visionPreparing: false,
  visionAttachedStreamId: null,
  visionMetricsTimer: null,
  visionResumeToken: 0,
  calibrationResizeTimer: null,
  currentIdentifiedCard: null,
  cardDisplayHideTimer: null,
  cardDisplayHovering: false,
  lastIdentificationEventKey: null,
  visionStateReady: false,
  visionFeedback: [],

  demoCardVisible: false,

  reportStartedAt: Date.now(),
  reportEvents: [],
  reportSeq: 0
};

const DEFAULT_RTC_CONFIG = {
  iceServers: [
    { urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }
  ],
  iceTransportPolicy: 'all'
};

function logEvent(type, data = {}) {
  state.reportEvents.push({
    seq: ++state.reportSeq,
    at: new Date().toISOString(),
    tMs: Date.now() - state.reportStartedAt,
    type,
    data
  });
  if (state.reportEvents.length > 5000) state.reportEvents.splice(0, 500);
}

function resetReportSession(meta = {}) {
  state.reportStartedAt = Date.now();
  state.reportEvents = [];
  state.reportSeq = 0;
  state.visionFeedback = [];
  state.lastRtcMetrics = null;
  state.remoteMediaState = { cameraEnabled: null, microphoneEnabled: null, receivedAt: null };

  const q = state.rtcQualityControl;
  q.cpuEpisode = null;
  q.cpuEpisodes = [];
  q.cpuSamples = 0;
  q.recoverySamples = 0;
  q.currentVisionThrottleMs = 0;
  q.senderPolicyApplied = false;
  q.senderPolicyError = null;
  q.senderScaleResolutionDownBy = 1;
  q.senderAdaptiveMode = 'native';
  q.senderAdaptationPending = false;
  q.senderAdaptations = [];
  q.captureAdaptiveMode = 'native';
  q.captureAdaptationPending = false;
  q.captureAdaptationError = null;
  q.captureAdaptations = [];
  q.captureAdaptationAttempts = 0;
  q.captureLastAttemptAtMs = 0;
  q.lastReason = null;

  logEvent('report-session-start', meta);
}

async function loadRtcConfig() {
  if (!state.roomCode || !state.peerId) return DEFAULT_RTC_CONFIG;
  const key = `${state.roomCode}:${state.peerId}`;
  if (state.rtcConfig && state.rtcConfigKey === key) return state.rtcConfig;
  if (state.rtcConfigLoading) return state.rtcConfigLoading;

  state.rtcConfigLoading = (async () => {
    try {
      const result = await api(`/api/rtc-config?room=${encodeURIComponent(state.roomCode)}&peer=${encodeURIComponent(state.peerId)}`);
      const config = {
        iceServers: Array.isArray(result?.iceServers) && result.iceServers.length ? result.iceServers : DEFAULT_RTC_CONFIG.iceServers,
        iceTransportPolicy: result?.iceTransportPolicy === 'relay' ? 'relay' : 'all'
      };
      state.rtcConfig = config;
      state.rtcConfigKey = key;
      state.turnStatus = {
        configured: Boolean(result?.turn?.configured),
        available: Boolean(result?.turn?.available),
        provider: result?.turn?.provider || null,
        policy: result?.turn?.policy || config.iceTransportPolicy,
        expiresAt: result?.turn?.expiresAt || null,
        reason: result?.turn?.reason || null
      };
      logEvent('rtc-config-loaded', {
        iceServerEntries: config.iceServers.length,
        iceTransportPolicy: config.iceTransportPolicy,
        turn: { ...state.turnStatus }
      });
      return config;
    } catch (err) {
      state.rtcConfig = { ...DEFAULT_RTC_CONFIG, iceServers: [...DEFAULT_RTC_CONFIG.iceServers] };
      state.rtcConfigKey = key;
      state.turnStatus = {
        configured: false,
        available: false,
        provider: null,
        policy: 'all',
        expiresAt: null,
        reason: 'rtc-config-fetch-failed'
      };
      logEvent('rtc-config-error', { name: err?.name || null, message: err?.message || String(err) });
      return state.rtcConfig;
    } finally {
      state.rtcConfigLoading = null;
    }
  })();

  return state.rtcConfigLoading;
}

function showScreen(name) {
  if (screens[name]?.classList.contains('active')) return;
  Object.entries(screens).forEach(([key, el]) => el.classList.toggle('active', key === name));
  window.scrollTo({ top: 0, behavior: 'instant' });
  logEvent('screen', { name });
}

function toast(text) {
  const el = $('toast');
  el.textContent = text;
  el.classList.remove('hidden');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => el.classList.add('hidden'), 1800);
}

function setNetworkStatus(text, mode = '') {
  $('networkStatus').textContent = text;
  const line = $('networkStatus').closest('.network-state-line');
  line.className = `network-state-line ${mode}`.trim();
}

function setRtcStatus(text, mode = '') {
  $('rtcStatus').textContent = text;
  $('rtcStatus').className = `rtc-status ${mode}`.trim();
  $('remoteVideoStatus').textContent = text;
}

const SESSION_STORAGE_KEY = 'tcgate-alpha-room-session-v1';
const MEDIA_PREFS_KEY = 'tcgate-alpha-media-prefs-v1';

function saveMediaPreferences() {
  try {
    localStorage.setItem(MEDIA_PREFS_KEY, JSON.stringify({
      cameraId: state.selectedCameraId || null,
      microphoneId: state.selectedMicrophoneId || null,
      savedAt: Date.now()
    }));
  } catch {}
}

function readMediaPreferences() {
  try {
    const raw = localStorage.getItem(MEDIA_PREFS_KEY);
    if (!raw) return { cameraId: null, microphoneId: null };
    const prefs = JSON.parse(raw);
    return {
      cameraId: typeof prefs?.cameraId === 'string' ? prefs.cameraId : null,
      microphoneId: typeof prefs?.microphoneId === 'string' ? prefs.microphoneId : null
    };
  } catch {
    return { cameraId: null, microphoneId: null };
  }
}

function saveRoomSession() {
  if (!state.roomCode || !state.peerId || !state.authToken) return;
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
      roomCode: state.roomCode,
      peerId: state.peerId,
      authToken: state.authToken,
      role: state.role,
      playerName: state.playerName,
      game: state.game,
      gigDice: gigDiceEnabledForCurrentGame() ? serializeGigState() : null,
      savedAt: Date.now()
    }));
  } catch {}
}

function clearSavedRoomSession() {
  try { sessionStorage.removeItem(SESSION_STORAGE_KEY); } catch {}
}

function readSavedRoomSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (!saved?.roomCode || !saved?.peerId || !saved?.authToken) return null;
    return saved;
  } catch {
    return null;
  }
}

function hidePersistentRecoveryCard() {
  state.persistentRecovery = null;
  $('resumeSessionCard')?.classList.add('hidden');
}

async function checkPersistentRecovery() {
  try {
    const result = await api('/api/recovery-state', { auth: false });
    if (!result?.available) {
      hidePersistentRecoveryCard();
      return false;
    }
    state.persistentRecovery = result;
    const gameLabel = result.game === 'cyberpunk' ? 'Cyberpunk TCG' : 'Sans jeu';
    $('resumeSessionTitle').textContent = `Salon ${result.code} · ${gameLabel}`;
    $('resumeSessionMeta').textContent = result.phase === 'game'
      ? 'Partie en cours · reprise sécurisée disponible.'
      : 'Salon encore actif · reprise sécurisée disponible.';
    $('resumeSessionCard').classList.remove('hidden');
    logEvent('persistent-recovery-available', {
      code: result.code,
      role: result.role,
      game: result.game,
      phase: result.phase
    });
    return true;
  } catch (err) {
    hidePersistentRecoveryCard();
    logEvent('persistent-recovery-check-error', { message: err?.message || String(err) });
    return false;
  }
}

function hydrateSessionFromResult(result) {
  state.roomCode = result.code;
  state.peerId = result.peerId;
  state.authToken = result.sessionToken || state.authToken;
  state.role = result.role || null;
  state.playerName = result.name || state.playerName || 'Joueur';
  state.roomSnapshot = result.room || null;
  state.game = result.room?.game || state.game || 'cyberpunk';
  state.recoveryEpoch = Number(result.room?.recoveryEpoch || 0);
  state.rtcConfig = null;
  state.rtcConfigKey = null;
  state.rtcConfigLoading = null;
  state.turnStatus = { configured: false, available: false, provider: null, policy: 'all', expiresAt: null, reason: 'not-loaded' };

  applyGameModeUi();
  $('lobbyCode').textContent = state.roomCode;
  $('lobbyPlayerName').textContent = state.playerName;
  $('localPlayerLabel').textContent = state.playerName;
  $('gameCode').textContent = state.roomCode;
  $('gameTitle').textContent = state.game === 'cyberpunk' ? 'Cyberpunk TCG' : 'Sans jeu';
  history.replaceState({}, '', `${location.pathname}?room=${state.roomCode}`);
  saveRoomSession();
  hidePersistentRecoveryCard();
  syncHubSessionControls();
}

function syncHubSessionControls() {
  const connected = Boolean(state.roomCode && state.peerId && state.authToken);
  const host = state.role === 'host' || (!connected && state.mode === 'create');
  screens.lobby?.classList.toggle('hub-preconnect', !connected);
  $('setupContinue')?.classList.toggle('hidden', connected);
  $('roomCodeField')?.classList.toggle('hidden', connected || state.mode === 'create');
  $('gameField')?.classList.toggle('hidden', connected ? !host : state.mode !== 'create');
  $('hubGameReadonly')?.classList.toggle('hidden', !connected || host);
  if ($('hubGameReadonlyValue')) $('hubGameReadonlyValue').textContent = gameLabel(state.game);
  if ($('gameSelect') && host) $('gameSelect').value = state.game;
  if ($('copyCode')) $('copyCode').disabled = !connected;
  if ($('copyLink')) $('copyLink').disabled = !connected;
  if ($('timerToggle')) $('timerToggle').disabled = !host;
  if ($('timerMinutes')) $('timerMinutes').disabled = !host;
}

function timerRemainingSeconds() {
  return state.timer.running && state.timer.endsAt != null
    ? Math.max(0, Math.ceil((state.timer.endsAt - Date.now()) / 1000))
    : Math.max(0, Number(state.timer.remainingSeconds || 0));
}

function formatTimer(seconds) {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

function renderSharedTimer() {
  const remaining = timerRemainingSeconds();
  if (remaining === 0 && state.timer.running) {
    state.timer.running = false;
    state.timer.remainingSeconds = 0;
    state.timer.endsAt = null;
    clearInterval(state.timerTick);
    state.timerTick = null;
    logEvent('timer-zero', { remainingSeconds: 0 });
  }
  const text = formatTimer(remaining);
  $('timerToggle')?.classList.toggle('on', state.timer.enabled);
  $('timerToggle')?.setAttribute('aria-pressed', state.timer.enabled ? 'true' : 'false');
  $('timerCfg')?.classList.toggle('hidden', !state.timer.enabled);
  if ($('timerMinutes') && document.activeElement !== $('timerMinutes')) $('timerMinutes').value = String(state.timer.durationSeconds / 60);
  if ($('sumTimer')) $('sumTimer').textContent = state.timer.enabled ? `${state.timer.durationSeconds / 60} min` : 'Désactivé';
  $('timerChip')?.classList.toggle('hidden', !state.timer.enabled || !state.gameActive);
  if ($('timerText')) $('timerText').textContent = text;
  if ($('timerBig')) $('timerBig').textContent = text;
  if ($('timerStart')) $('timerStart').textContent = state.timer.running ? '⏸ Pause' : '▶ Démarrer';
}

function applySharedTimer(timer, source = 'room-state') {
  if (!timer) return;
  state.timer = { ...state.timer, ...timer };
  clearInterval(state.timerTick);
  state.timerTick = state.timer.running ? setInterval(renderSharedTimer, 250) : null;
  renderSharedTimer();
  logEvent('timer-state-received', { source, enabled: state.timer.enabled, durationSeconds: state.timer.durationSeconds, running: state.timer.running, remainingSeconds: timerRemainingSeconds() });
}

async function sendTimerAction(action) {
  const result = await api('/api/timer', { method: 'POST', body: { room: state.roomCode, peerId: state.peerId, action } });
  logEvent(`timer-${action}`, { remainingSeconds: result?.room?.timer?.remainingSeconds ?? null });
  if (result?.room) applyRoomState(result.room);
}

async function updateHubMetadata(patch) {
  if (!state.roomCode || !state.peerId || !state.authToken || state.gameActive) return;
  try {
    const result = await api(`/api/rooms/${encodeURIComponent(state.roomCode)}`, {
      method: 'PATCH',
      body: { peerId: state.peerId, ...patch }
    });
    if (patch.name && result?.room) {
      const me = result.room.peers.find(peer => peer.id === state.peerId);
      if (me?.name) {
        state.playerName = me.name;
        $('lobbyPlayerName').textContent = me.name;
        $('localPlayerLabel').textContent = me.name;
        if (document.activeElement !== $('playerName')) $('playerName').value = me.name;
      }
    }
    if (patch.game && result?.room?.game) {
      state.game = result.room.game;
      applyGameModeUi();
    }
    if (result?.room) applyRoomState(result.room);
    saveRoomSession();
  } catch (err) {
    toast(err.message);
  }
}

function scheduleHubNameUpdate() {
  if (!state.roomCode) return;
  clearTimeout(state.hubMetadataTimer);
  state.hubMetadataTimer = setTimeout(() => {
    const name = $('playerName').value.trim();
    if (name) updateHubMetadata({ name });
  }, 350);
}

async function recoverPersistentSession() {
  const button = $('resumeSessionButton');
  if (button) button.disabled = true;
  try {
    const result = await api('/api/recover', { method: 'POST', auth: false });
    resetReportSession({
      roomCode: result.code,
      role: result.role,
      game: result.room?.game || state.game || 'cyberpunk',
      resumed: true
    });
    hydrateSessionFromResult(result);
    const wasInGame = (result.room?.phase || 'lobby') === 'game';
    state.recoveryBootstrapPending = wasInGame;
    state.gameEntering = true;
    applyRoomState(result.room);
    state.gameEntering = false;
    if (wasInGame) prepareMainRtcRecovery('persistent-recovery');
    await connectEventStream().catch(() => {});
    await waitForEventStreamOpen().catch(() => false);

    const phoneRestored = await restorePhoneCameraAfterRecovery();
    if (!phoneRestored) {
      const prefs = readMediaPreferences();
      await startLocalMedia({
        cameraId: prefs.cameraId,
        microphoneId: prefs.microphoneId
      }).catch(() => false);
    }

    if (wasInGame) {
      showScreen('game');
      await enterNetworkGame({ recovery: true, reason: 'persistent-recovery' });
      state.recoveryBootstrapPending = false;
      toast('Partie reprise.');
    } else {
      state.recoveryBootstrapPending = false;
      showScreen('lobby');
      toast('Salon repris.');
    }
    logEvent('persistent-recovery-success', {
      code: state.roomCode,
      role: state.role,
      phase: result.room?.phase || 'lobby'
    });
    return true;
  } catch (err) {
    state.recoveryBootstrapPending = false;
    logEvent('persistent-recovery-error', { message: err?.message || String(err) });
    toast(err?.message || 'Impossible de reprendre la partie.');
    await checkPersistentRecovery();
    return false;
  } finally {
    if (button) button.disabled = false;
  }
}

async function api(path, options = {}) {
  const headers = {};
  if (options.body) headers['Content-Type'] = 'application/json';
  if (options.auth !== false && state.authToken) headers.Authorization = `Bearer ${state.authToken}`;
  const response = await fetch(path, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
    credentials: 'same-origin'
  });
  let payload = {};
  try { payload = await response.json(); } catch {}
  if (!response.ok) throw new Error(payload.error || `Erreur HTTP ${response.status}`);
  return payload;
}


function setVisionStatus(text,mode='') {
  const el=$('visionStatus');
  if (!el) return;
  el.textContent=text;
  el.className=`vision-status-pill ${mode}`.trim();
}

function setCalibrationStatus(s) {
  const el=$('calibrationStatus');
  if (!el) return;
  const status=s?.status || 'idle';

  if(status==='ok'){
    el.textContent='Calibration : OK';
    el.className='vision-status-pill good';
  }else if(status==='partial'){
    el.textContent=`Calibration : partielle${s?.reasons?.length?' · '+s.reasons[0]:''}`;
    el.className='vision-status-pill warning';
  }else if(status==='error'){
    el.textContent='Calibration : échec';
    el.className='vision-status-pill error';
  }else if(status==='calibrating'){
    el.textContent='Calibration : analyse…';
    el.className='vision-status-pill warning';
  }else{
    el.textContent='Calibration : attente';
    el.className='vision-status-pill';
  }
}

function setVisionStateStatus(snapshot=null) {
  const el=$('visionStateStatus');
  if (!el) return;
  if(!snapshot){
    el.textContent='Mémoire : attente';
    el.className='vision-status-pill';
    return;
  }
  if(snapshot.workerError){
    el.textContent='Mémoire : erreur';
    el.className='vision-status-pill error';
    return;
  }
  if(snapshot.workerReady){
    const known=Number(snapshot.knownCards||0);
    const active=Number(snapshot.activeTableCards||0);
    el.textContent=`Mémoire : active · ${known}/${active}`;
    el.className='vision-status-pill good';
    return;
  }
  el.textContent='Mémoire : initialisation…';
  el.className='vision-status-pill warning';
}

const VISION_ASSETS = [
  '/game-databases.js',
  '/database-source.js',
  '/vision-library-integrity.js',
  '/vision-frame-gate.js',
  '/vision-analysis-frame.js',
  '/vision-appearance-sampler.js',
  '/vision-core.js',
  '/vision-calibration.js',
  '/table-state-bridge.js',
  '/identification.js',
  '/table-state-engine.js'
];

function gameLabel(game = state.game) {
  if (game === 'cyberpunk') return 'Cyberpunk Trading Card Game · Vision';
  if (game === 'no-game') return 'Sans jeu · webcam uniquement';
  return 'TCG';
}

function visionEnabledForCurrentGame() {
  return state.game === 'cyberpunk';
}

function gigDiceEnabledForCurrentGame() {
  return state.game === 'cyberpunk';
}

function localGigRole() {
  return state.role === 'guest' ? 'guest' : 'host';
}

function opponentGigRole() {
  return localGigRole() === 'host' ? 'guest' : 'host';
}

function createGigDiceState() {
  const sides = [4, 6, 8, 10, 12, 20];
  return [
    ...sides.map(side => ({ id: `host-d${side}`, origin: 'host', owner: 'host', sides: side, value: 0 })),
    ...sides.map(side => ({ id: `guest-d${side}`, origin: 'guest', owner: 'guest', sides: side, value: 0 }))
  ];
}

function validGigDiceState(dice) {
  if (!Array.isArray(dice) || dice.length !== 12) return false;
  const allowedSides = new Set([4, 6, 8, 10, 12, 20]);
  const ids = new Set();
  for (const die of dice) {
    if (!die || typeof die !== 'object') return false;
    if (typeof die.id !== 'string' || ids.has(die.id)) return false;
    ids.add(die.id);
    if (!['host', 'guest'].includes(die.origin) || !['host', 'guest'].includes(die.owner)) return false;
    const sides = Number(die.sides);
    const value = Number(die.value);
    if (!allowedSides.has(sides) || !Number.isInteger(value) || value < 0 || value > sides) return false;
  }
  return true;
}

function ensureGigDiceState() {
  if (!validGigDiceState(state.gigDice)) state.gigDice = createGigDiceState();
  return state.gigDice;
}

function getGigDice(uiOwner) {
  ensureGigDiceState();
  const canonicalOwner = uiOwner === 'self' ? localGigRole() : opponentGigRole();
  return state.gigDice
    .filter(die => die.owner === canonicalOwner)
    .sort((a, b) => a.sides - b.sides || a.origin.localeCompare(b.origin) || a.id.localeCompare(b.id));
}

const GIG_DICE_ICONS={"D4": "<svg viewBox=\"0 0 1000 1000\" class=\"die-svg\"><g id=\"XMLID_1_\">\n\t<path id=\"XMLID_20_\" d=\"M795.2885742,617.5536499l-289.62323-414.6074829\n\t\tc-0.0148621-0.0212708-0.033783-0.0381012-0.0488892-0.0592041c-0.1234436-0.1726532-0.2658691-0.3295135-0.4047852-0.4902649\n\t\tc-0.1009521-0.1167603-0.1941833-0.2415924-0.3018188-0.3505249c-0.1365356-0.1381989-0.2902832-0.258255-0.438446-0.3848114\n\t\tc-0.1281128-0.1092072-0.2494812-0.2272644-0.3843689-0.3263092c-0.1430664-0.1050262-0.3006287-0.1907959-0.4522705-0.2849731\n\t\tc-0.1568604-0.0973206-0.3087769-0.2026978-0.4723816-0.2868958c-0.1435852-0.0738678-0.2984619-0.1283875-0.4480896-0.192627\n\t\tc-0.1875-0.0803833-0.3721619-0.1662292-0.5658875-0.229599c-0.0256042-0.0083313-0.0482788-0.0218811-0.0739746-0.029953\n\t\tc-0.1303711-0.0409698-0.263092-0.0568542-0.3943481-0.0897522c-0.199585-0.0501709-0.3971252-0.1045074-0.6007996-0.1368103\n\t\tc-0.1661377-0.0262146-0.3315735-0.0328979-0.4978027-0.0469513c-0.196106-0.0167542-0.3907166-0.037674-0.588562-0.0375061\n\t\tc-0.1730957,0.0002594-0.3433228,0.0197906-0.5151062,0.0329895c-0.1901855,0.0144043-0.379425,0.0231781-0.5694275,0.0537262\n\t\tc-0.1833496,0.0294342-0.3610229,0.0795135-0.5409851,0.1234436c-0.1472168,0.0358429-0.2957458,0.0548553-0.4418335,0.1008606\n\t\tc-0.0280457,0.0088654-0.0527039,0.0235291-0.0805664,0.0326385c-0.1783752,0.0585938-0.3480835,0.1385498-0.5212708,0.2114716\n\t\tc-0.1643982,0.0692596-0.3334961,0.1296844-0.490448,0.2106781c-0.1515503,0.078125-0.2919312,0.1764679-0.4376831,0.2658844\n\t\tc-0.163269,0.1002502-0.331665,0.1927948-0.4850464,0.3054657c-0.1286621,0.0945282-0.2441101,0.2072906-0.3665771,0.3111115\n\t\tc-0.1540833,0.1308136-0.3132019,0.255722-0.4548035,0.3989563c-0.105896,0.1072083-0.1974792,0.2301178-0.296936,0.3449707\n\t\tc-0.1402893,0.1621552-0.2841187,0.3206482-0.4086914,0.494873c-0.0150146,0.0210114-0.0340271,0.0378418-0.0488892,0.0591125\n\t\tl-289.62323,414.6074829c-1.1009674,1.5760498-1.495575,3.5394897-1.0888977,5.4187622\n\t\tc0.4065094,1.8793335,1.5777893,3.5037842,3.2320404,4.4842529l289.6229858,171.5786743\n\t\tc0.0179443,0.0106812,0.0374146,0.0174561,0.0554504,0.0279541c0.0158081,0.0092163,0.0295105,0.0209961,0.0454102,0.0300293\n\t\tc0.1318665,0.0751953,0.2704773,0.1314087,0.4057312,0.1972046c0.1240234,0.0602417,0.2450562,0.1282349,0.3717041,0.1807251\n\t\tc0.1708374,0.0708618,0.3462524,0.1231079,0.5209045,0.1796265c0.1134644,0.0366211,0.2243958,0.0824585,0.3390808,0.1130981\n\t\tc0.2006836,0.0536499,0.4046631,0.0872192,0.60849,0.1224976c0.0927124,0.0160522,0.1841125,0.041748,0.2772522,0.0539551\n\t\tC499.3997803,799.9794922,499.6997681,800,499.9999695,800c0.3000793,0,0.6000671-0.0205078,0.8982544-0.0595703\n\t\tc0.0938416-0.0123291,0.1855774-0.038147,0.2789001-0.0543213c0.2033081-0.0352173,0.4067688-0.0686646,0.6070251-0.1221313\n\t\tc0.1146851-0.0306396,0.2255249-0.076416,0.3388977-0.1130371c0.1747437-0.0565186,0.3502502-0.1087646,0.5211792-0.1796875\n\t\tc0.1267395-0.0524902,0.2478333-0.1204834,0.3719788-0.1807861c0.1351318-0.0657959,0.2735901-0.1220703,0.405365-0.1971436\n\t\tc0.0158997-0.0090332,0.0296021-0.020813,0.0454102-0.0300293c0.0180359-0.010498,0.0375061-0.0172729,0.0554504-0.0279541\n\t\tL793.1454468,627.456665c1.6542358-0.9804688,2.8255005-2.6049194,3.2319946-4.4842529\n\t\tC796.7841797,621.0931396,796.3895264,619.1296997,795.2885742,617.5536499z M493.0893555,228.8634949v552.0997314\n\t\tL220.3077087,619.3614502L493.0893555,228.8634949z M506.9106445,780.9631958V228.8634949l272.7816162,390.4979553\n\t\tL506.9106445,780.9631958z\"/>\n</g></svg>", "D6": "<svg viewBox=\"0 0 1000 1000\" class=\"die-svg\"><g id=\"XMLID_1_\">\n\t<path id=\"XMLID_35_\" d=\"M760.6980591,352.8495789c-0.008667-0.0964661-0.0064087-0.1919861-0.019165-0.2881775\n\t\tc-0.0499878-0.3764954-0.1401978-0.7420654-0.2492676-1.1010437c-0.0369263-0.1211853-0.0790405-0.2399292-0.1228638-0.3599548\n\t\tc-0.1282349-0.3513794-0.2767334-0.6937866-0.4589233-1.0189819c-0.0147705-0.0263672-0.0213623-0.0547791-0.036499-0.0810547\n\t\tc-0.013855-0.0239868-0.0334473-0.0422974-0.0476074-0.06604c-0.1925659-0.3250122-0.4180908-0.6286011-0.6616821-0.9191284\n\t\tc-0.0790405-0.0942993-0.1578369-0.186615-0.2410278-0.2757874c-0.2600708-0.278717-0.5358276-0.5436707-0.842041-0.778656\n\t\tc-0.0621948-0.0476685-0.1300659-0.0843201-0.1937866-0.1297302c-0.1834717-0.1313171-0.3664551-0.2633972-0.564209-0.3776245\n\t\tl-253.782135-146.5211334c-2.1526184-1.2430267-4.8050842-1.2430267-6.9577026,0L242.7390289,347.4533997\n\t\tc-0.1977844,0.1142273-0.3807373,0.2463074-0.5642242,0.3776245c-0.0637054,0.0454102-0.1315613,0.0820618-0.1938019,0.1297302\n\t\tc-0.3061981,0.2349854-0.5819855,0.499939-0.8419952,0.778656c-0.0832062,0.0891724-0.1619873,0.181488-0.2410278,0.2757874\n\t\tc-0.2436371,0.2905273-0.4691467,0.5941162-0.6617279,0.9191284c-0.0141296,0.0237427-0.0337219,0.0420532-0.0475922,0.06604\n\t\tc-0.0151672,0.0262756-0.0217438,0.0546875-0.0364838,0.0810547c-0.1821747,0.3251953-0.3307343,0.6676025-0.4589233,1.0189819\n\t\tc-0.0438538,0.1200256-0.085968,0.2387695-0.1228943,0.3599548c-0.109024,0.3589783-0.1992493,0.7245483-0.2492676,1.1010437\n\t\tc-0.0127411,0.0961914-0.0104828,0.1917114-0.0191498,0.2881775c-0.0189819,0.2088928-0.0417786,0.4171448-0.0417786,0.629303\n\t\tv293.0422363c0,2.4860229,1.3262329,4.7825317,3.4788666,6.0255127L496.5211487,799.067749\n\t\tc0.2104187,0.121521,0.4290771,0.2211914,0.6481934,0.3189697c0.0534058,0.0239258,0.1025391,0.0545044,0.1567078,0.0771484\n\t\tc0.3678284,0.1531982,0.7469177,0.2635498,1.1305237,0.3508911c0.1020203,0.0231934,0.2041931,0.0420532,0.3078613,0.0606689\n\t\tC499.173584,799.9494019,499.5858154,800,500,800s0.826416-0.0505981,1.2355652-0.1245728\n\t\tc0.1036682-0.0186157,0.2058411-0.0374756,0.3078613-0.0606689c0.383606-0.0873413,0.7626953-0.1976929,1.1305237-0.3508911\n\t\tc0.0541687-0.022644,0.103302-0.0532227,0.1567078-0.0771484c0.2191162-0.0977783,0.4377747-0.1974487,0.6481934-0.3189697\n\t\tl253.782135-146.5211182c2.1525879-1.242981,3.4788208-3.5394897,3.4788208-6.0255127V353.4788818\n\t\tC760.7398071,353.2667236,760.717041,353.0584717,760.6980591,352.8495789z M500,214.9920349l239.8687134,138.4878235\n\t\tL500,491.9660339L260.1312561,353.4798584L500,214.9920349z M253.175705,365.532074l239.8665619,138.4849548v276.973877\n\t\tL253.175705,642.5043945V365.532074z M506.9577332,780.9909058v-276.973877L746.8242798,365.532074v276.9723206\n\t\tL506.9577332,780.9909058z\"/>\n</g></svg>", "D8": "<svg viewBox=\"0 0 1000 1000\" class=\"die-svg\"><g id=\"XMLID_1_\">\n\t<path id=\"XMLID_24_\" d=\"M760.333374,648.8185425c0.0560303-0.1607056,0.1187744-0.3185425,0.1629639-0.4835815\n\t\tc0.0424805-0.1581421,0.0655518-0.319397,0.0964355-0.4794922c0.026001-0.1348877,0.0615234-0.2669067,0.0795898-0.4038696\n\t\tc0.0370483-0.2817383,0.0540771-0.5653687,0.0563354-0.848938c0.0001831-0.0179443,0.0036011-0.0352783,0.0036011-0.0532227\n\t\tV353.4506531c0-2.4659119-1.3155518-4.7437744-3.4506226-5.9767456L503.450592,200.9245148\n\t\tc-0.0130005-0.0074463-0.026886-0.0122986-0.0400696-0.0196686c-0.2492981-0.1418304-0.5065918-0.2698669-0.7721863-0.379776\n\t\tc-0.1099243-0.045517-0.2241821-0.0752563-0.3359985-0.1147766c-0.171814-0.0610352-0.3415527-0.1273499-0.5184021-0.1747589\n\t\tc-0.1352234-0.0361481-0.273407-0.0546112-0.4102173-0.0824432c-0.1577454-0.0321655-0.313446-0.0722198-0.4743347-0.0933685\n\t\tc-0.2236633-0.0293884-0.4487-0.0372772-0.6737366-0.0447235C500.1500549,200.0124817,500.0762024,200,499.9999084,200\n\t\tc-0.0759277,0-0.1497803,0.0124817-0.2255554,0.0149994c-0.2250366,0.0074463-0.4502563,0.0153351-0.6739197,0.0447235\n\t\tc-0.1605225,0.0211487-0.3162231,0.061203-0.4741516,0.0933685c-0.1368103,0.027832-0.2748108,0.0462952-0.4100342,0.0824432\n\t\tc-0.1770325,0.0474091-0.3467712,0.1137238-0.5187378,0.1747589c-0.1116638,0.0395203-0.2257385,0.0692596-0.3359985,0.1147766\n\t\tc-0.265625,0.1099091-0.5227356,0.2379456-0.7722168,0.379776c-0.0128174,0.00737-0.026886,0.0122223-0.0398865,0.0196686\n\t\tL242.718338,347.4739075c-2.1352692,1.2329712-3.4506683,3.5108337-3.4506683,5.9767456v293.0987854\n\t\tc0,0.3013916,0.0206299,0.6027222,0.0598145,0.9021606c0.0176849,0.133606,0.0523682,0.2623901,0.0776825,0.3939819\n\t\tc0.0313721,0.1636963,0.05513,0.3283691,0.098465,0.4899902c0.0433502,0.1619263,0.105072,0.3169556,0.1600342,0.4746704\n\t\tc0.0438538,0.1260376,0.0780182,0.2544556,0.1291656,0.378418c0.1126862,0.2715454,0.2427216,0.5349731,0.3887024,0.7896118\n\t\tc0.0039825,0.0070801,0.0065918,0.0146484,0.0107422,0.0217285c0.0024261,0.0045166,0.0059052,0.0083618,0.0083313,0.0127563\n\t\tc0.1487579,0.2563477,0.3139801,0.5032349,0.494812,0.7387695c0.0814819,0.1060791,0.1750946,0.199707,0.2623138,0.300415\n\t\tc0.1093903,0.126709,0.2130737,0.2579956,0.3318329,0.3768311c0.1170349,0.1169434,0.2463684,0.218811,0.3708496,0.3266602\n\t\tc0.1028137,0.0889282,0.1983337,0.1846313,0.3068695,0.2678833c0.2163696,0.1660156,0.4441833,0.3150635,0.6782379,0.4541626\n\t\tc0.0253143,0.0149536,0.0473328,0.0339355,0.0728149,0.0487061L496.549408,799.0755005\n\t\tC497.6170654,799.6915894,498.8086548,800,499.9999084,800c1.1914368,0,2.3830261-0.3084106,3.4506836-0.9244995\n\t\tl253.8310852-146.5493164c0.0341187-0.0197144,0.0634155-0.0447998,0.0970459-0.0650024\n\t\tc0.2249146-0.1350098,0.4452515-0.2775879,0.6538086-0.4376221c0.1123657-0.0862427,0.2115479-0.1853638,0.3178101-0.277771\n\t\tc0.1204834-0.1047974,0.2463379-0.2032471,0.3597412-0.3166504c0.1227417-0.1229248,0.2302246-0.2584839,0.3432617-0.3898315\n\t\tc0.0828857-0.0965576,0.1730347-0.1858521,0.2510986-0.2873535c0.1809692-0.2359009,0.3460083-0.4830933,0.4951172-0.7398071\n\t\tc0.0024414-0.0042114,0.0057373-0.0078735,0.0081787-0.012146c0.0039673-0.0070801,0.0067139-0.0146484,0.0107422-0.0217285\n\t\tc0.145813-0.2546387,0.276001-0.5180664,0.3884888-0.7896118\n\t\tC760.2572632,649.0674438,760.2904053,648.9418335,760.333374,648.8185425z M746.9298096,620.7935791l-228.0749512-395.037262\n\t\tl228.0749512,131.6785583V620.7935791z M741.8775024,639.6481934H258.1221313l241.8777771-418.944519L741.8775024,639.6481934z\n\t\t M481.1451111,225.7563171L253.0701752,620.793457V357.4348755L481.1451111,225.7563171z M499.9999084,785.1295776\n\t\tL271.9242859,653.4506226h456.1514587L499.9999084,785.1295776z\"/>\n</g></svg>", "D10": "<svg viewBox=\"0 0 1000 1000\" class=\"die-svg\"><path id=\"XMLID_25_\" d=\"M789.4313965,526.1958008c0.0775757-0.2147827,0.1482544-0.4309692,0.2038574-0.6522217\n\tc0.0316772-0.1257935,0.0567017-0.2514038,0.0812378-0.3783569c0.0401001-0.2079468,0.0701904-0.4168091,0.0908813-0.6282349\n\tc0.0124512-0.1273193,0.0249023-0.25354,0.0304565-0.3811646c0.0092773-0.2207031,0.0031128-0.4415894-0.0090332-0.6635742\n\tc-0.0062256-0.1154175-0.0065308-0.2303467-0.0186157-0.3452759c-0.0276489-0.2633667-0.076416-0.5255737-0.1351318-0.7873535\n\tc-0.0157471-0.0700073-0.0224609-0.1412964-0.0402832-0.2107544c-0.0020752-0.0081787-0.0026245-0.0164185-0.0046387-0.0245972\n\tc-0.0839844-0.3208008-0.1930542-0.6303711-0.3197021-0.9307251c-0.0359497-0.0852051-0.0834961-0.1656494-0.1230469-0.2496338\n\tc-0.1060791-0.2254028-0.2184448-0.446167-0.3473511-0.6571655c-0.0611572-0.1000366-0.1297607-0.1953125-0.1962891-0.2927246\n\tc-0.1316528-0.1925659-0.2706299-0.3781738-0.4205933-0.5557861c-0.0418091-0.0495605-0.072937-0.1049194-0.1161499-0.1535034\n\tL505.1311646,202.2949066c-0.0070801-0.0079498-0.0158997-0.0134888-0.0229797-0.0214233\n\tc-0.0570068-0.0631714-0.1194153-0.1198425-0.1786804-0.1806793c-0.0806885-0.0831909-0.16745-0.1603546-0.2528076-0.2399292\n\tc-0.1302795-0.1211395-0.259552-0.2427826-0.398468-0.3532104c-0.085022-0.0677338-0.1741943-0.1257935-0.2619934-0.1890411\n\tc-0.0552673-0.039917-0.0993347-0.089859-0.156189-0.1283875c-0.0336914-0.0229034-0.0711975-0.0357819-0.105072-0.0579834\n\tc-0.1335754-0.0870972-0.2718201-0.1645966-0.4112854-0.2422638c-0.117157-0.0652313-0.2332764-0.1286621-0.3535461-0.1866302\n\tc-0.0713501-0.0344696-0.1378784-0.0774994-0.2106323-0.1095581c-0.0725708-0.032135-0.1481018-0.0508881-0.2213745-0.0803528\n\tc-0.0978088-0.0392303-0.1976929-0.0732727-0.2973938-0.1080017c-0.1010742-0.0351715-0.1985474-0.0789642-0.3008423-0.1092987\n\tc-0.0741272-0.0220337-0.1503296-0.037323-0.2256775-0.0569305c-0.1427307-0.0372467-0.2856445-0.063858-0.4299316-0.0917664\n\tc-0.1308289-0.0252228-0.2590332-0.0578003-0.3919067-0.0755157c-0.0983276-0.0132141-0.1970215-0.0136414-0.2960205-0.0225525\n\tc-0.1460266-0.0131226-0.2904968-0.0252228-0.4368591-0.0290222C500.1202393,200.0108032,500.0628662,200,500.003418,200\n\tc-0.0634155,0-0.1247559,0.0114899-0.1879883,0.0132141c-0.1382446,0.0036316-0.275116,0.0145264-0.4133606,0.026535\n\tc-0.1085205,0.0095062-0.2166748,0.010788-0.3245239,0.0253906c-0.1271667,0.0172882-0.2498474,0.0502014-0.3749695,0.0744019\n\tc-0.1482544,0.0284271-0.2947998,0.0558167-0.4416809,0.0941772c-0.0661926,0.0173645-0.1337585,0.029892-0.1994324,0.0492401\n\tc-0.1330566,0.0390625-0.2598877,0.0947876-0.3905334,0.1418762c-0.0561523,0.0203094-0.1126404,0.0392303-0.1679382,0.0610046\n\tc-0.1151123,0.0450134-0.2308655,0.0831146-0.3442383,0.134613c-0.0393982,0.0178833-0.0753479,0.0417328-0.1143799,0.0603943\n\tc-0.1446533,0.0689392-0.2844543,0.1448059-0.4247742,0.2242889c-0.1161194,0.0657501-0.2322388,0.1300354-0.3442078,0.2023621\n\tc-0.0438843,0.0283356-0.0919189,0.0452728-0.1354675,0.0747375c-0.0567017,0.0385284-0.1009216,0.0882874-0.1562195,0.1282196\n\tc-0.0960693,0.069458-0.1923218,0.1361542-0.2854614,0.2110748c-0.1123352,0.0902863-0.2156677,0.1906891-0.3224487,0.2880554\n\tc-0.1140747,0.1042023-0.2281189,0.2066803-0.3340454,0.3172607c-0.0397339,0.0414734-0.0834656,0.0781097-0.1221619,0.1206207\n\tc-0.0158997,0.0174561-0.0350952,0.0298157-0.0508118,0.0474396L211.8931122,519.284729\n\tc-0.0430298,0.0483398-0.0741425,0.1035156-0.1156158,0.152771c-0.1503296,0.1782837-0.2899628,0.3642578-0.4219818,0.5574951\n\tc-0.0660095,0.0969238-0.1344299,0.1916504-0.1952667,0.2911377c-0.1290741,0.2113647-0.2419128,0.4325562-0.3480225,0.6583252\n\tc-0.0393982,0.0838013-0.0867462,0.1640625-0.1226807,0.2490845c-0.1266785,0.300354-0.2357025,0.6099243-0.3196869,0.9307251\n\tc-0.0020752,0.0081787-0.002594,0.0164185-0.0046692,0.0245972c-0.017807,0.0692139-0.0243683,0.1403198-0.0400848,0.2099609\n\tc-0.0589294,0.2623291-0.107666,0.5250854-0.1353149,0.7888184c-0.012085,0.1141357-0.0124359,0.2283936-0.0186615,0.3430176\n\tc-0.0121002,0.2225952-0.0183105,0.4440308-0.0088043,0.6652832c0.0053558,0.1275024,0.0176239,0.25354,0.0302277,0.3807983\n\tc0.0207367,0.211853,0.0508118,0.4211426,0.0912476,0.6295166c0.0241852,0.1263428,0.0492401,0.2514038,0.0807037,0.3766479\n\tc0.0558167,0.2216797,0.1264801,0.4382324,0.204071,0.6533203c0.0375061,0.1036987,0.0684357,0.2081909,0.1109467,0.3104858\n\tc0.1311493,0.3150635,0.281311,0.6223145,0.4589539,0.9164429c0.0020752,0.0031738,0.0031128,0.0068359,0.0050201,0.0100098\n\tc0.0962524,0.1583862,0.2082214,0.3018799,0.3153534,0.4501343c0.0680847,0.0944824,0.1268463,0.1943359,0.1999359,0.2855835\n\tc0.1919861,0.2394409,0.3983154,0.4634399,0.6170807,0.6721802c0.0024261,0.0024414,0.0043182,0.005127,0.0069122,0.0075073\n\tl282.9754944,269.2562866c0.0404358,0.0383911,0.0884705,0.0640259,0.1296082,0.1012573\n\tc0.2446899,0.2220459,0.5057983,0.4260864,0.7831421,0.6125488c0.0587463,0.0394287,0.1124878,0.0870361,0.1722717,0.1246338\n\tc0.299469,0.1880493,0.6138,0.3571777,0.9457703,0.4995117c0.0283203,0.012146,0.0585632,0.015564,0.0870667,0.0272827\n\tc0.2927551,0.1209106,0.5961914,0.2026978,0.9011841,0.2819214c0.1322021,0.0343018,0.2604065,0.0877686,0.3934631,0.1140747\n\tc0.421814,0.0831299,0.850708,0.1262207,1.2820129,0.1293335C499.9680176,799.9954834,499.9832153,800,499.9984131,800\n\tc0.0005188,0,0.0010376-0.0001831,0.0015564-0.0001831S500.0010071,800,500.0015259,800\n\tc0.0153809,0,0.0305786-0.0045166,0.0458069-0.0045776c0.4311218-0.0031128,0.8598633-0.0462036,1.2816772-0.1292725\n\tc0.1339111-0.0264282,0.2628174-0.0801392,0.3957214-0.1147461c0.3042908-0.0791016,0.6072083-0.1607666,0.8992615-0.2813721\n\tc0.0285034-0.0117798,0.0585632-0.0150757,0.0869141-0.0272217c0.3317871-0.142334,0.6460876-0.3114014,0.9455566-0.4993896\n\tc0.0601501-0.0378418,0.1144104-0.0857544,0.1734924-0.1255493c0.2770081-0.1862183,0.5377808-0.3898315,0.7821045-0.6116333\n\tc0.0411377-0.0372314,0.0891724-0.0629883,0.1296082-0.1013794l282.9754944-269.2562866\n\tc0.0026245-0.0023804,0.0045166-0.0050659,0.006897-0.0075073c0.218811-0.2087402,0.4251099-0.4327393,0.6171265-0.6721802\n\tc0.0730591-0.0912476,0.1318359-0.1911011,0.1998901-0.2855835c0.1071777-0.1482544,0.2191162-0.291748,0.3153687-0.4501343\n\tc0.0018921-0.0031738,0.0029297-0.0068359,0.0050049-0.0100098c0.1776733-0.2941284,0.3278198-0.6013794,0.4589844-0.9164429\n\tC789.3630981,526.4042969,789.394043,526.2996826,789.4313965,526.1958008z M630.5391235,483.892395l-130.5391541,50.8838501\n\tL369.4656677,483.894104l130.5367126-261.6080322L630.5391235,483.892395z M644.8084717,481.6739502L529.1203003,249.8251801\n\tl233.737854,261.833374L644.8084717,481.6739502z M355.1937256,481.6736145l-118.0519257,29.9849243L470.8846436,249.819046\n\tL355.1937256,481.6736145z M359.4945984,494.7747192l133.6268005,52.086792V777.081543L230.7875061,527.4664307\n\tL359.4945984,494.7747192z M506.87854,777.081543V546.8643188l133.6314697-52.0884705l128.7024536,32.6905823L506.87854,777.081543z\n\t\"/></svg>", "D12": "<svg viewBox=\"0 0 1000 1000\" class=\"die-svg\"><path id=\"XMLID_26_\" d=\"M782.4796753,408.3996582c-0.0027466-0.1383667-0.013855-0.2755737-0.0246582-0.4133301\n\tc-0.0107422-0.1336365-0.0197754-0.2669678-0.0378418-0.3990784c-0.0183716-0.1329651-0.0458374-0.263855-0.0715332-0.3955078\n\tc-0.0263672-0.1331482-0.0510254-0.2663879-0.085022-0.3972778c-0.03302-0.1278381-0.0753174-0.2528992-0.1159668-0.3788452\n\tc-0.0419922-0.1305237-0.0822754-0.2614136-0.1315918-0.3890991c-0.0475464-0.1219482-0.104126-0.2402344-0.1583252-0.3597717\n\tc-0.057251-0.1255798-0.112793-0.2516174-0.1773682-0.3735657c-0.0614624-0.1156921-0.1315918-0.2269592-0.199646-0.3395386\n\tc-0.0722046-0.1193237-0.1430054-0.2391968-0.222168-0.354126c-0.0194702-0.0279236-0.0344238-0.058136-0.0541992-0.085907\n\tL676.5966187,257.965332c-0.8627319-1.2082825-2.0917358-2.1069489-3.505127-2.5626221l-170.9726563-55.0811768\n\tc-0.0416565-0.0133667-0.0843811-0.0198822-0.1263733-0.0324554c-0.1274109-0.0384521-0.2565613-0.0684814-0.3860779-0.099472\n\tc-0.1347046-0.0321198-0.2683716-0.0652771-0.4041138-0.0891418c-0.130188-0.0230865-0.2614136-0.0372314-0.3930054-0.0527649\n\tc-0.1357422-0.015976-0.2707825-0.0332489-0.4068909-0.0411377c-0.1340027-0.0078125-0.2680054-0.006424-0.4023743-0.0065155\n\tc-0.1343689,0.0000916-0.2683716-0.001297-0.4023743,0.0065155c-0.1361084,0.0078888-0.2711487,0.0251617-0.4068909,0.0411377\n\tc-0.1315918,0.0155334-0.2624817,0.0295868-0.3930054,0.0526733c-0.1361084,0.0240479-0.270813,0.0572968-0.4058533,0.0896606\n\tc-0.1284485,0.0307312-0.2565613,0.0605011-0.3836365,0.0986023c-0.0420227,0.0127563-0.0854187,0.0193634-0.1274109,0.0328979\n\tL326.9081421,255.40271c-1.4133606,0.4556732-2.6423645,1.3543396-3.5054626,2.5626221L218.7982788,404.5136108\n\tc-0.0204773,0.0286255-0.0357513,0.0597839-0.0558929,0.0886841c-0.0767212,0.1112061-0.1447754,0.2272339-0.2149048,0.3425903\n\tc-0.070816,0.116394-0.1433868,0.2315674-0.2065735,0.3513489c-0.0624847,0.1173401-0.1156006,0.2387695-0.1708069,0.3595886\n\tc-0.0569305,0.1244507-0.1156158,0.2477112-0.164917,0.3748779c-0.0475616,0.1222839-0.0857391,0.2476196-0.1260223,0.3725891\n\tc-0.0426941,0.1313171-0.086441,0.2616882-0.1211548,0.3950806c-0.0326385,0.1262207-0.0562439,0.2544861-0.0815887,0.3826904\n\tc-0.0270844,0.1365356-0.0555573,0.2723694-0.074295,0.4101868c-0.0173645,0.1275024-0.0263977,0.2562256-0.0364532,0.3851929\n\tc-0.0114594,0.1424255-0.0232697,0.2844238-0.0256958,0.4274597c-0.0007019,0.041748-0.0072937,0.0824585-0.0072937,0.1242981\n\tv184.9536133c0,1.4575806,0.4607086,2.8778076,1.3164978,4.0574951l101.9095917,140.4839478\n\tc0.0163269,0.0227661,0.0361328,0.0422363,0.0531311,0.0647583c0.0822754,0.1109009,0.1732483,0.2143555,0.2621155,0.3200073\n\tc0.0857544,0.1019897,0.1690674,0.2060547,0.2600403,0.3023682c0.0920105,0.097168,0.1912842,0.1863403,0.2885132,0.2780151\n\tc0.098938,0.0930176,0.1954651,0.1881714,0.2992554,0.2749023c0.1013794,0.0847168,0.2093506,0.1610718,0.3152466,0.2399902\n\tc0.1097107,0.0812988,0.2173157,0.1644287,0.331543,0.2390747c0.1100769,0.0722046,0.2256775,0.1356812,0.3399048,0.2016602\n\tc0.1190796,0.0686646,0.2371216,0.1386108,0.3600159,0.1999512c0.1163025,0.0580444,0.2371216,0.107605,0.3569031,0.1593018\n\tc0.1294861,0.055603,0.2583008,0.1118774,0.3909302,0.1594849c0.0367737,0.0133667,0.071167,0.0317993,0.1086426,0.0445557\n\tl173.6678467,59.1243286C498.4949951,799.8769531,499.2469788,800,499.9996643,800s1.5046692-0.1230469,2.2267761-0.3683472\n\tl173.6682129-59.1243286c0.0374756-0.0127563,0.0714722-0.031189,0.1086426-0.0445557\n\tc0.1326294-0.0476074,0.2614136-0.1038818,0.390564-0.1594849c0.1201172-0.0516968,0.2409668-0.1012573,0.3569336-0.1593018\n\tc0.12323-0.0613403,0.2409058-0.1312866,0.3603516-0.1999512c0.1141968-0.065979,0.2298584-0.1294556,0.3399048-0.2016602\n\tc0.1141968-0.074646,0.2218018-0.1577759,0.331543-0.2390747c0.105896-0.0789185,0.2138672-0.1552734,0.3152466-0.2399902\n\tc0.1034546-0.086731,0.2003174-0.1818848,0.2992554-0.2749023c0.097229-0.0916748,0.1964722-0.1808472,0.288147-0.2780151\n\tc0.0913086-0.0963135,0.1746216-0.2003784,0.260376-0.3023682c0.0888672-0.1056519,0.1798706-0.2091064,0.262146-0.3200073\n\tc0.0170288-0.022522,0.036438-0.0419922,0.0531006-0.0647583l101.9096069-140.4839478\n\tc0.8557739-1.1796875,1.3165283-2.5999146,1.3165283-4.0574951l0.0003052-184.9536133\n\tC782.4873047,408.4849854,782.4803467,408.4427795,782.4796753,408.3996582z M394.2519836,644.3881836l-12.039093-37.0529785\n\tl-53.3164673-164.0916443L500,318.9298706l171.1032104,124.3136902l-53.3164673,164.0916443l-12.0394287,37.0529785H394.2519836z\n\t M666.677063,267.8552246l97.840332,137.0719604l-84.1032104,27.9986877l-173.504303-126.058075v-90.4832916L666.677063,267.8552246\n\tz M333.3226013,267.8552246l159.7671814-51.4707184v90.4834442l-116.6000977,84.7148438l-56.9042358,41.3430786\n\tl-84.1035309-27.9986877L333.3226013,267.8552246z M231.3321075,418.1108398l3.5578766,1.1843872l80.3897705,26.7626648\n\tL381.542511,649.992981l-55.0784302,72.3880615l-95.1319733-131.1417847V418.1108398z M499.9996643,785.7907104\n\tl-162.3605957-55.2741699l55.0180054-72.3088379h214.6855164l55.0176392,72.3088379L499.9996643,785.7907104z\n\t M768.6675415,591.2392578l-95.131958,131.1417847l-55.0784302-72.3880615l66.2627563-203.9350891l83.947998-27.947052\n\tL768.6675415,591.2392578z\"/></svg>", "D20": "<svg viewBox=\"0 0 1000 1000\" class=\"die-svg\"><g id=\"XMLID_1_\">\n\t<path id=\"XMLID_29_\" d=\"M771.555603,338.8777771c-0.0079956-0.0405884,0-0.0812073-0.0079956-0.1299438\n\t\tc0-0.0244751,0-0.0569153-0.0083008-0.089386v-0.0487366c-0.0083008-0.1056824-0.0162964-0.2113647-0.0325928-0.316925\n\t\tc-0.0079956-0.065094-0.0159912-0.1300659-0.024292-0.1950378c-0.0079956-0.0487671-0.0159912-0.089447-0.024292-0.1382141\n\t\tc-0.0163574-0.0812073-0.0326538-0.1543579-0.048584-0.2356262c-0.0166626-0.089386-0.0409546-0.1787415-0.0569458-0.2680969\n\t\tc-0.0162964-0.0487671-0.0246582-0.089447-0.0409546-0.1381226c-0.0159302-0.0569153-0.0322876-0.1056824-0.048584-0.1625977\n\t\tc-0.0325928-0.113739-0.0732422-0.227478-0.1138306-0.3331299c0,0,0,0,0-0.0080872\n\t\tc-0.0162964-0.0406799-0.024292-0.0812683-0.0405884-0.1218872c-0.0079956-0.0325317-0.024292-0.0649719-0.0405884-0.0975037\n\t\tc-0.0406494-0.1056824-0.0895386-0.2113647-0.1381226-0.3169556c-0.0326538-0.0568237-0.0569458-0.1218872-0.0895386-0.1787109\n\t\tc0-0.0162964-0.0079956-0.0244751-0.0079956-0.0325317c-0.0079956-0.0081482-0.0162964-0.0243835-0.024292-0.0406799\n\t\tc-0.0489502-0.089386-0.0975342-0.1705933-0.1464233-0.2518616c-0.048584-0.0812073-0.0892334-0.1625061-0.1381226-0.2438049\n\t\tc-0.0569458-0.0812073-0.1135254-0.1625061-0.1704102-0.2437134c-0.0569458-0.0812683-0.1138306-0.1625671-0.1707764-0.2437744\n\t\tc-0.0325928-0.0325317-0.0568848-0.0650024-0.0811768-0.1056824c-0.0409546-0.0405884-0.0811768-0.0893555-0.1221313-0.1300354\n\t\tc-0.0569458-0.0730591-0.1138306-0.1462097-0.1784058-0.2193298c-0.0409546-0.0406189-0.0895386-0.089447-0.130127-0.1300659\n\t\tl-0.1381226-0.1381226c-0.0489502-0.0487366-0.0975342-0.0975037-0.1544189-0.1462708\n\t\tc-0.0652466-0.0568237-0.130127-0.113739-0.1950684-0.1706543c-0.0488892-0.0405884-0.0974731-0.0812073-0.1544189-0.1217957\n\t\tc-0.0325928-0.0325317-0.0648804-0.0569153-0.0975342-0.089447c-0.0974731-0.0731506-0.2033081-0.1381226-0.3088379-0.2112732\n\t\tc-0.0405884-0.0243835-0.0811768-0.0568237-0.1297607-0.0893555c-0.1950684-0.1218872-0.3984375-0.2356262-0.6014404-0.3413086\n\t\tc-0.0083008-0.0081482-0.0083008-0.0081482-0.0162964-0.0081482L502.9820862,200.6906891\n\t\tc-0.0406189-0.0162201-0.0812073-0.0325317-0.1218262-0.0487671c-0.130127-0.0650635-0.2682495-0.1138153-0.4063721-0.1706543\n\t\tc-0.1218262-0.0487518-0.2519531-0.1055756-0.3817444-0.1462708c-0.1381226-0.0487518-0.2762451-0.0812073-0.4147034-0.113739\n\t\tc-0.1381226-0.0325317-0.2679138-0.0731354-0.4063721-0.0975189c-0.1381226-0.0243835-0.2762451-0.0406952-0.4143677-0.0568237\n\t\tc-0.1381226-0.0244751-0.2762451-0.0406952-0.4223328-0.0487671C500.2762451,200,500.1460876,200,500.0079956,200\n\t\tc-0.1461182,0-0.2845764,0-0.4306946,0.0081482c-0.1381226,0.0080719-0.2682495,0.024292-0.4063721,0.0406036\n\t\tc-0.1460876,0.024292-0.2842102,0.0406036-0.4223328,0.0649872s-0.2682495,0.0649872-0.4063721,0.0975189\n\t\ts-0.2762451,0.0649872-0.4143677,0.113739c-0.130127,0.0406952-0.2599182,0.0975189-0.3817444,0.1462708\n\t\tc-0.1381226,0.056839-0.2762451,0.1055908-0.4063721,0.1706543c-0.0406189,0.0162354-0.081543,0.032547-0.1218262,0.0487671\n\t\tL232.1253815,333.1409607c-0.0083313,0-0.0083313,0-0.0163116,0.0081482\n\t\tc-0.2113495,0.1056824-0.4063721,0.2194214-0.6014099,0.3413086c-0.048584,0.0325317-0.0895386,0.0649719-0.1301422,0.0893555\n\t\tc-0.1054993,0.0731506-0.2113342,0.1381226-0.3085175,0.2112732c-0.032608,0.0325317-0.0652313,0.0569153-0.0975037,0.089447\n\t\tc-0.0569153,0.0405884-0.1058502,0.0812073-0.1544342,0.1217957c-0.0652466,0.0569153-0.1381226,0.1138306-0.1950378,0.1706543\n\t\tc-0.0569153,0.0487671-0.1054993,0.0975342-0.1544342,0.1462708c-0.0489197,0.0406189-0.0891876,0.0893555-0.1381226,0.1381226\n\t\tc-0.0405884,0.0406189-0.0895233,0.089447-0.130127,0.1300659c-0.0648956,0.0731201-0.1218109,0.1462708-0.1867065,0.2193298\n\t\tc-0.0326233,0.0406799-0.0732269,0.089447-0.1138306,0.1300354c-0.024292,0.0406799-0.0489349,0.0731506-0.0812073,0.1056824\n\t\tc-0.0569153,0.0812073-0.1138306,0.1625061-0.1707458,0.2437744c-0.0569,0.0812073-0.1138153,0.1625061-0.1707306,0.2437134\n\t\tc-0.048584,0.0812988-0.0891876,0.1625977-0.1381226,0.2438049c-0.048584,0.0812683-0.0975189,0.1706543-0.1461029,0.2518616\n\t\tc-0.0083313,0.0162964-0.0163116,0.0325317-0.0246429,0.0406799c0,0.0080566-0.0079803,0.0162354-0.0079803,0.0243835\n\t\tc-0.0322723,0.0649719-0.0569153,0.1300354-0.0891876,0.1868591c-0.0489349,0.1055908-0.0975189,0.2112732-0.1381226,0.3169556\n\t\tc-0.0163116,0.0325317-0.0326233,0.0649719-0.0409393,0.1055603c-0.015976,0.0325623-0.024292,0.0731506-0.0406036,0.1138306\n\t\tv0.0080872c-0.0406036,0.1056519-0.0812073,0.2193909-0.1134796,0.3331299\n\t\tc-0.0163116,0.0569153-0.0409546,0.1056824-0.0489349,0.1625977c-0.0163116,0.0486755-0.024292,0.0893555-0.0406036,0.1381226\n\t\tc-0.0163116,0.0893555-0.0406036,0.1787109-0.0569153,0.2680969c-0.024292,0.0812683-0.0326233,0.1625671-0.048584,0.2356262\n\t\tc-0.0083313,0.0487671-0.0163116,0.089447-0.024292,0.1382141c-0.0083313,0.0649719-0.0166626,0.1299438-0.0246429,0.203186\n\t\tc-0.0163116,0.0974121-0.024292,0.2030945-0.0322723,0.3087769c0,0.0162048,0,0.0405884-0.0083313,0.0649719v0.0731506\n\t\tc-0.0079803,0.0487366-0.0079803,0.0893555-0.0079803,0.1381226v0.4874878l12.4484863,304.0101013\n\t\tc0,0.0406494,0.0083313,0.0731201,0.0083313,0.1218872c0.0079803,0.0487671,0,0.0893555,0.0079803,0.1462402\n\t\tc0.0079803,0.1463013,0.0406036,0.2925415,0.0569153,0.4387817c0.0163116,0.0975952,0.024292,0.1950684,0.0406036,0.2844849\n\t\tc0.0569153,0.2843628,0.1301422,0.5687866,0.2193298,0.836853c0.0083313,0.0325317,0.024292,0.0568848,0.0326233,0.0894165\n\t\tc0.0895386,0.2438354,0.1867065,0.4794312,0.2925415,0.7069092c0.0485992,0.0894775,0.0975189,0.1706543,0.1461029,0.2601318\n\t\tc0.0895386,0.1705933,0.1790771,0.3330688,0.2845764,0.4874878c0.0569153,0.0893555,0.1218109,0.1787109,0.1867065,0.2763062\n\t\tc0.105835,0.1381226,0.2193298,0.2762451,0.3331451,0.4143677c0.0732269,0.0893555,0.1464539,0.1706543,0.2276611,0.2518921\n\t\tc0.1218109,0.1300659,0.2519531,0.2519531,0.3900604,0.3738403c0.0812073,0.0731201,0.1624146,0.1462402,0.2519531,0.2194214\n\t\tc0.1461029,0.1217651,0.3088684,0.2355957,0.4712677,0.3411865c0.0812073,0.0569458,0.1544342,0.1138306,0.2356415,0.1625977\n\t\tc0.024292,0.0162354,0.0406036,0.0324707,0.0648956,0.0405884l252.3055878,150.1401367\n\t\tc0.0326233,0.0162354,0.0652466,0.0407104,0.0895386,0.0568848l0.048584,0.0244141\n\t\tc0.0246277,0.0162354,0.0409546,0.024353,0.0569153,0.0324707c0.2276611,0.1300049,0.4552917,0.2438354,0.6909485,0.3494263\n\t\tc0.0565491,0.0244141,0.1134644,0.0487671,0.1703796,0.0731201c0.2113647,0.0812988,0.422699,0.1543579,0.6420288,0.2194214\n\t\tc0.0569153,0.0162354,0.1221619,0.0324707,0.1787109,0.0487671c0.2356567,0.0650024,0.4796143,0.1137695,0.7152405,0.1461792\n\t\tc0.0406189,0.0081787,0.072876,0.0081787,0.1054993,0.0163574C499.4228821,799.9755249,499.7154236,800,500,800\n\t\tc0.471283,0,0.926239-0.0487671,1.3811951-0.1463623c0,0,0.0083313,0,0.0163269,0\n\t\tc0.1950073-0.0405884,0.3820801-0.0975342,0.5687866-0.1543579c0.0405884-0.0162354,0.081543-0.024353,0.130127-0.0405884\n\t\tc0.1624146-0.0568848,0.3331604-0.1218872,0.495575-0.1868896c0.0569153-0.0244751,0.1138306-0.0487671,0.1787109-0.0732422\n\t\tc0.1464539-0.072998,0.292572-0.1542969,0.446991-0.2355957c0.0648804-0.0324707,0.130127-0.0650024,0.1950378-0.1055908\n\t\tc0.1381226-0.0812988,0.2682495-0.1706543,0.4063721-0.2681885c0.0648804-0.0487671,0.1297913-0.0893555,0.1950378-0.1381226\n\t\tc0.1297913-0.0975342,0.2519531-0.203186,0.3817444-0.3168945c0.0569153-0.0487671,0.1138306-0.0975342,0.1707153-0.15448\n\t\tc0.1218262-0.1136475,0.2436218-0.2355347,0.3574524-0.3574829c0.0326233-0.0406494,0.0732422-0.0812378,0.1138306-0.1218262\n\t\tc0.0163269-0.0244141,0.0326233-0.0487671,0.048584-0.0650635c0.0326233-0.0405884,0.0732422-0.0730591,0.1058655-0.1137695\n\t\tl0.0079651-0.0162354L753.65448,649.6566162c0.5039063-0.0893555,0.9995117-0.2355347,1.4870605-0.4468994\n\t\tc2.0881348-0.9263306,3.5345459-2.8440552,3.8840332-5.0704346c0.0811768-0.3413086,0.1544189-0.6907959,0.1787109-1.0483398\n\t\tc0.0326538-0.430542,0.0162964-0.8613281-0.0322876-1.2838135l12.383606-302.4336853V338.8777771z M506.6630859,217.4378967\n\t\tl196.2295532,98.118866l-192.7678833-51.7449951l-3.4616699-0.9343872V217.4378967z M756.0351563,343.62323\n\t\tl-49.7540283,130.7438965l-33.2261963,87.3035278L533.3886108,313.6959839l-19.7941895-35.1521606L756.0351563,343.62323z\n\t\t M500,281.5828247l162.8243408,289.0830688H337.1753235L500,281.5828247z M493.3365784,217.4378967v45.4394836\n\t\tl-196.2295837,52.6793823L493.3365784,217.4378967z M486.4056091,278.5438232L326.9450684,561.6706543l-67.9234314-178.474762\n\t\tL243.9644775,343.62323L486.4056091,278.5438232z M243.4442749,379.7504578l38.8658447,102.124939L317.852417,575.28125\n\t\tl-21.8666992,18.3887329l-42.3271637,35.5909424L243.4442749,379.7504578z M259.021637,642.1727905l65.8349915-55.3610229\n\t\tl146.6299438,181.7982788L259.021637,642.1727905z M499.8292542,782.5050659L343.9199524,589.2171021l-4.209198-5.2168579\n\t\th320.2373657L499.8292542,782.5050659z M529.2689209,767.6674194l145.8741455-180.8556519l65.4938354,55.0766602\n\t\tL529.2689209,767.6674194z M746.3657227,628.6351929l-64.0310669-53.8495483l74.2207031-195.0351868L746.3657227,628.6351929z\"/>\n</g></svg>"};

const GIG_DICE_ORDER = Object.freeze({
  opponent: [20, 12, 10, 8, 6, 4],
  self: [4, 6, 8, 10, 12, 20]
});

function orderedGigDice(uiOwner) {
  const canonicalOwner = uiOwner === 'self' ? localGigRole() : opponentGigRole();
  const dice = getGigDice(uiOwner);
  const ordered = [];
  GIG_DICE_ORDER[uiOwner].forEach(sides => {
    const homologues = dice.filter(die => die.sides === sides);
    const native = homologues.find(die => die.origin === canonicalOwner);
    const stolen = homologues.filter(die => die.origin !== canonicalOwner);
    if (uiOwner === 'opponent') {
      ordered.push(...stolen);
      if (native) ordered.push(native);
    } else {
      if (native) ordered.push(native);
      ordered.push(...stolen);
    }
  });
  return ordered;
}

function streetCred(uiOwner) {
  return getGigDice(uiOwner).reduce((sum, die) => sum + Number(die.value || 0), 0);
}

function dieUiOriginClass(die) {
  return die.origin === localGigRole() ? 'self' : 'opponent';
}

function renderGigLane(uiOwner, containerId) {
  const lane = $(containerId);
  if (!lane) return;
  const dice = orderedGigDice(uiOwner);
  const drag = state.dieDrag;
  const draggedDie = drag ? ensureGigDiceState().find(die => die.id === drag.dieId) : null;
  const targetHasPlaceholder = Boolean(
    draggedDie && drag.dragging && drag.targetUiOwner === uiOwner && drag.sourceUiOwner !== uiOwner
  );
  const dieMarkup = die => {
    const originClass = dieUiOriginClass(die);
    return `
      <div class="die-slot2 ${state.lastMovedDieId === die.id ? 'just-moved' : ''}" data-die-id="${die.id}">
        <button class="die-control2 minus2" type="button" data-action="decrement" aria-label="Diminuer la valeur">−</button>
        <div class="die-token2 ${originClass === 'opponent' ? 'owner-rival' : ''}" title="d${die.sides}" aria-label="Dé à ${die.sides} faces, valeur ${die.value}">
          ${GIG_DICE_ICONS[`D${die.sides}`]}
          <span class="die-score2">${die.value}</span>
        </div>
        <button class="die-control2 plus2" type="button" data-action="increment" aria-label="Augmenter la valeur">+</button>
      </div>`;
  };
  let markup = '';
  GIG_DICE_ORDER[uiOwner].forEach(sides => {
    const homologues = dice.filter(die => die.sides === sides);
    if (uiOwner === 'opponent' && targetHasPlaceholder && draggedDie.sides === sides) {
      markup += '<div class="die-slot2"><div class="ghost-slot"></div></div>';
    }
    homologues.forEach(die => { markup += dieMarkup(die); });
    if (uiOwner === 'self' && targetHasPlaceholder && draggedDie.sides === sides) {
      markup += '<div class="die-slot2"><div class="ghost-slot"></div></div>';
    }
  });
  lane.innerHTML = markup;
  lane.classList.toggle('is-empty', dice.length === 0);
}
function renderGigDicePanel() {
  const panel = $('gigDicePanel');
  const visible = gigDiceEnabledForCurrentGame();
  panel?.classList.toggle('hidden', !visible);
  if (!visible || !panel) return;

  const selfDice = getGigDice('self');
  const opponentDice = getGigDice('opponent');
  const selfSide = panel.querySelector('.gig-side2.self');
  const opponentSide = panel.querySelector('.gig-side2.opponent');
  selfSide?.setAttribute('data-dice-count', String(selfDice.length));
  opponentSide?.setAttribute('data-dice-count', String(opponentDice.length));

  renderGigLane('self', 'gigSelfDice');
  renderGigLane('opponent', 'gigOpponentDice');
  $('gigSelfCred').textContent = streetCred('self');
  $('gigOpponentCred').textContent = streetCred('opponent');
}
function serializeGigState() {
  ensureGigDiceState();
  return state.gigDice.map(die => ({
    id: die.id,
    origin: die.origin,
    owner: die.owner,
    sides: Number(die.sides),
    value: Number(die.value)
  }));
}

function persistGigState() {
  saveRoomSession();
}

async function sendGigState(source = 'local-change') {
  if (!gigDiceEnabledForCurrentGame() || !state.opponentId) return null;
  const result = await sendSignal('gig-state', { dice: serializeGigState(), source });
  logEvent('gig-state-sent', { source, delivered: result?.delivered ?? null });
  return result;
}

function requestGigState() {
  if (!gigDiceEnabledForCurrentGame() || !state.opponentId) return;
  if (state.role === 'guest') sendSignal('gig-state', { request: true }).catch(()=>{});
  else sendGigState('host-initial').catch(()=>{});
}

function applyRemoteGigState(payload = {}) {
  if (!gigDiceEnabledForCurrentGame() || !validGigDiceState(payload.dice)) return false;
  state.gigDice = payload.dice.map(die => ({ ...die, sides: Number(die.sides), value: Number(die.value) }));
  state.lastMovedDieId = null;
  renderGigDicePanel();
  persistGigState();
  logEvent('gig-state-applied', { source: payload.source || 'remote' });
  return true;
}

function changeDieValue(dieId, delta) {
  const die = ensureGigDiceState().find(item => item.id === dieId);
  if (!die) return;
  die.value = Math.min(die.sides, Math.max(0, Number(die.value) + delta));
  renderGigDicePanel();
  persistGigState();
  sendGigState('value-change').catch(()=>{});
}

function resetGigDice() {
  if (!gigDiceEnabledForCurrentGame()) return;
  if (!window.confirm('Réinitialiser les dés ?')) return;
  state.gigDice = ensureGigDiceState().map(die => ({ ...die, value: 0 }));
  state.lastMovedDieId = null;
  renderGigDicePanel();
  persistGigState();
  sendGigState('manual-reset').catch(()=>{});
}

function transferDie(dieId, targetUiOwner) {
  const die = ensureGigDiceState().find(item => item.id === dieId);
  if (!die) return false;
  const targetOwner = targetUiOwner === 'self' ? localGigRole() : opponentGigRole();
  if (die.owner === targetOwner) return false;
  die.owner = targetOwner;
  state.lastMovedDieId = die.id;
  renderGigDicePanel();
  persistGigState();
  sendGigState('die-transfer').catch(()=>{});
  window.setTimeout(() => {
    if (state.lastMovedDieId === die.id) {
      state.lastMovedDieId = null;
      document.querySelector(`[data-die-id="${die.id}"]`)?.classList.remove('just-moved');
    }
  }, 520);
  return true;
}

function clearDieDropTargets() {
  document.querySelectorAll('.gig-side2').forEach(side => side.classList.remove('die-drop-target', 'die-drop-active'));
}

function dieDropOwnerAtPoint(clientX, clientY, sourceUiOwner) {
  const targetUiOwner = sourceUiOwner === 'self' ? 'opponent' : 'self';
  const targetSide = document.querySelector(targetUiOwner === 'self' ? '.gig-side2.self' : '.gig-side2.opponent');
  if (!targetSide) return null;
  const rect = targetSide.getBoundingClientRect();
  return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom ? targetUiOwner : null;
}

function uiOwnerForDie(die) {
  return die.owner === localGigRole() ? 'self' : 'opponent';
}

function beginDieDrag(event, dieWrap) {
  const dieId = dieWrap.dataset.dieId;
  const die = ensureGigDiceState().find(item => item.id === dieId);
  const dieEl = dieWrap.querySelector('.die-token2');
  if (!die || !dieEl) return;
  state.dieDrag = {
    pointerId: event.pointerId,
    dieId,
    sourceUiOwner: uiOwnerForDie(die),
    startX: event.clientX,
    startY: event.clientY,
    dragging: false,
    ghost: null,
    sourceEl: dieWrap
  };
  dieEl.setPointerCapture?.(event.pointerId);
}

function updateDieDrag(event) {
  const drag = state.dieDrag;
  if (!drag || event.pointerId !== drag.pointerId) return;
  const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
  if (!drag.dragging && distance < 6) return;

  if (!drag.dragging) {
    drag.dragging = true;
    const dieEl = drag.sourceEl.querySelector('.die-token2');
    drag.ghost = dieEl?.cloneNode(true) || null;
    if (drag.ghost) {
      drag.ghost.classList.add('drag-proxy2');
      const fullscreenRoot = document.querySelector('.opponent-feed-card');
      const ghostHost = document.fullscreenElement === fullscreenRoot ? fullscreenRoot : document.body;
      ghostHost.appendChild(drag.ghost);
    }
    drag.sourceEl.classList.add('is-dragging-die');
    const targetSide = document.querySelector(drag.sourceUiOwner === 'self' ? '.gig-side2.opponent' : '.gig-side2.self');
    targetSide?.classList.add('die-drop-target');
  }

  if (drag.ghost) {
    drag.ghost.style.left = `${event.clientX}px`;
    drag.ghost.style.top = `${event.clientY}px`;
  }
  const targetUiOwner = dieDropOwnerAtPoint(event.clientX, event.clientY, drag.sourceUiOwner);
  if (drag.targetUiOwner !== targetUiOwner) {
    drag.targetUiOwner = targetUiOwner;
    renderGigDicePanel();
  }
  const targetSide = document.querySelector(drag.sourceUiOwner === 'self' ? '.gig-side2.opponent' : '.gig-side2.self');
  targetSide?.classList.toggle('die-drop-active', Boolean(targetUiOwner));
  event.preventDefault();
}

function finishDieDrag(event) {
  const drag = state.dieDrag;
  if (!drag || (event.pointerId != null && event.pointerId !== drag.pointerId)) return;
  const targetUiOwner = drag.dragging ? dieDropOwnerAtPoint(event.clientX, event.clientY, drag.sourceUiOwner) : null;
  drag.ghost?.remove();
  drag.sourceEl?.classList.remove('is-dragging-die');
  clearDieDropTargets();
  state.dieDrag = null;
  renderGigDicePanel();
  if (targetUiOwner && transferDie(drag.dieId, targetUiOwner)) toast('Dé transféré.');
}

const GIG_PANEL_POSITION_KEY = 'tcgate.alpha.gig-panel-position.v3';

function gigPanelContextKey(panel = $('gigDicePanel')) {
  return panel?.classList.contains('is-fullscreen') ? 'fullscreen' : 'normal';
}
function readGigPanelPositions() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(GIG_PANEL_POSITION_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch { return {}; }
}
function writeGigPanelPositions(positions) {
  try { sessionStorage.setItem(GIG_PANEL_POSITION_KEY, JSON.stringify(positions || {})); } catch {}
}
function clearSavedGigPanelPosition(panel = $('gigDicePanel')) {
  const positions = readGigPanelPositions();
  delete positions[gigPanelContextKey(panel)];
  writeGigPanelPositions(positions);
}
function gigPanelContainer(panel = $('gigDicePanel')) {
  return panel?.classList.contains('is-fullscreen')
    ? document.querySelector('.opponent-feed-card')
    : document.querySelector('.tcgate-opponent-column');
}
function gigPanelHasLayout(panel) {
  return Boolean(panel && !panel.classList.contains('hidden') && panel.offsetWidth >= 120 && panel.offsetHeight >= 40);
}
function setGigPanelCoordinates(panel, left, top) {
  panel.style.left = `${Math.round(left)}px`;
  panel.style.top = `${Math.round(top)}px`;
  panel.style.right = 'auto';
  panel.style.bottom = 'auto';
  panel.style.transform = 'none';
}
function saveGigPanelPosition(panel = $('gigDicePanel')) {
  if (!gigPanelHasLayout(panel)) return;
  const container = gigPanelContainer(panel);
  if (!container) return;
  const containerRect = container.getBoundingClientRect();
  const panelRect = panel.getBoundingClientRect();
  const positions = readGigPanelPositions();
  positions[gigPanelContextKey(panel)] = {
    left: Math.max(8, panelRect.left - containerRect.left),
    top: Math.max(8, panelRect.top - containerRect.top)
  };
  writeGigPanelPositions(positions);
}
function gigPanelWouldOverlapLocalPip(container, panel, left, top, margin = 14) {
  const pip = document.querySelector('.tcgate-local-pip');
  if (!container || !gigPanelHasLayout(panel) || !pip || pip.classList.contains('preview-hidden')) return false;
  const pipStyle = getComputedStyle(pip);
  if (pipStyle.display === 'none' || pipStyle.visibility === 'hidden') return false;
  const containerRect = container.getBoundingClientRect();
  const pipRect = pip.getBoundingClientRect();
  if (pipRect.width < 8 || pipRect.height < 8) return false;
  const candidate = {
    left: containerRect.left + left,
    top: containerRect.top + top,
    right: containerRect.left + left + panel.offsetWidth,
    bottom: containerRect.top + top + panel.offsetHeight
  };
  return !(
    candidate.right + margin <= pipRect.left ||
    candidate.left >= pipRect.right + margin ||
    candidate.bottom + margin <= pipRect.top ||
    candidate.top >= pipRect.bottom + margin
  );
}
function defaultSafeGigPanelPosition(panel = $('gigDicePanel')) {
  const container = gigPanelContainer(panel);
  if (!container || !gigPanelHasLayout(panel)) return null;
  const margin = 14;
  const rect = container.getBoundingClientRect();
  const maxLeft = Math.max(margin, rect.width - panel.offsetWidth - margin);
  const maxTop = Math.max(margin, rect.height - panel.offsetHeight - margin);
  let left = maxLeft;
  let top = maxTop;

  const pip = document.querySelector('.tcgate-local-pip');
  if (pip && !pip.classList.contains('preview-hidden')) {
    const pipStyle = getComputedStyle(pip);
    const pipRect = pip.getBoundingClientRect();
    if (pipStyle.display !== 'none' && pipStyle.visibility !== 'hidden' && pipRect.width >= 8 && pipRect.height >= 8) {
      const pipLeft = pipRect.left - rect.left;
      const pipTop = pipRect.top - rect.top;
      const pipRight = pipRect.right - rect.left;
      const pipBottom = pipRect.bottom - rect.top;
      const overlaps = () => !(
        left + panel.offsetWidth + margin <= pipLeft ||
        left >= pipRight + margin ||
        top + panel.offsetHeight + margin <= pipTop ||
        top >= pipBottom + margin
      );
      if (overlaps()) {
        const rightOfPip = pipRight + margin;
        if (rightOfPip + panel.offsetWidth <= rect.width - margin) {
          left = rightOfPip;
        } else {
          const abovePip = pipTop - panel.offsetHeight - margin;
          if (abovePip >= margin) top = abovePip;
          else top = margin;
        }
      }
    }
  }
  left = Math.max(margin, Math.min(maxLeft, left));
  top = Math.max(margin, Math.min(maxTop, top));
  return { left, top };
}
function applySavedGigPanelPosition(panel = $('gigDicePanel')) {
  if (!gigPanelHasLayout(panel)) return false;
  const container = gigPanelContainer(panel);
  const saved = readGigPanelPositions()[gigPanelContextKey(panel)];
  if (!container || !saved || !Number.isFinite(saved.left) || !Number.isFinite(saved.top)) return false;
  const rect = container.getBoundingClientRect();
  const left = Math.max(8, Math.min(Math.max(8, rect.width - panel.offsetWidth - 8), saved.left));
  const top = Math.max(8, Math.min(Math.max(8, rect.height - panel.offsetHeight - 8), saved.top));
  if (gigPanelWouldOverlapLocalPip(container, panel, left, top)) {
    clearSavedGigPanelPosition(panel);
    logEvent('gig-position-reset-safe-zone', { context: gigPanelContextKey(panel) });
    return false;
  }
  setGigPanelCoordinates(panel, left, top);
  return true;
}
function resetGigPanelPosition() {
  const panel = $('gigDicePanel');
  if (!panel) return;
  panel.style.left = '';
  panel.style.top = '';
  panel.style.right = '';
  panel.style.bottom = '';
  panel.style.transform = '';
}
function placeGigPanelSafely(panel = $('gigDicePanel'), reason = 'layout') {
  if (!gigPanelHasLayout(panel) || panel.dataset.dragging === 'true') return false;
  if (applySavedGigPanelPosition(panel)) return true;
  const safe = defaultSafeGigPanelPosition(panel);
  if (!safe) return false;
  setGigPanelCoordinates(panel, safe.left, safe.top);
  logEvent('gig-position-default-safe', { context: gigPanelContextKey(panel), reason });
  return true;
}
let gigPlacementFrame = 0;
let gigPlacementTimer = 0;
function scheduleGigPanelSafePlacement(reason = 'layout') {
  const panel = $('gigDicePanel');
  if (!panel || panel.classList.contains('hidden')) return;
  if (gigPlacementFrame) cancelAnimationFrame(gigPlacementFrame);
  if (gigPlacementTimer) clearTimeout(gigPlacementTimer);
  let attempt = 0;
  const tryPlace = () => {
    gigPlacementFrame = requestAnimationFrame(() => {
      gigPlacementFrame = 0;
      if (placeGigPanelSafely(panel, reason)) return;
      attempt += 1;
      if (attempt < 4) tryPlace();
      else gigPlacementTimer = window.setTimeout(() => placeGigPanelSafely(panel, `${reason}-delayed`), 80);
    });
  };
  tryPlace();
}

function moveGigPanelForFullscreen() {
  const panel = $('gigDicePanel');
  const mount = $('gigDiceMount');
  const fullscreenRoot = document.querySelector('.opponent-feed-card');
  if (!panel || !mount || !fullscreenRoot) return;
  if (document.fullscreenElement === fullscreenRoot) {
    if (panel.parentElement !== fullscreenRoot) fullscreenRoot.appendChild(panel);
    panel.classList.add('is-fullscreen');
  } else {
    if (panel.parentElement !== mount) mount.appendChild(panel);
    panel.classList.remove('is-fullscreen');
  }
  resetGigPanelPosition();
  scheduleGigPanelSafePlacement('fullscreen-change');
}

function setupDraggableGigPanel() {
  const panel = $('gigDicePanel');
  const handle = $('gigDiceDragHandle');
  if (!panel || !handle || panel.dataset.draggableBound === '1') return;
  panel.dataset.draggableBound = '1';
  let drag = null;
  const getContainer = () => panel.classList.contains('is-fullscreen')
    ? document.querySelector('.opponent-feed-card')
    : document.querySelector('.tcgate-opponent-column');

  handle.addEventListener('pointerdown', event => {
    const container = getContainer();
    if (!container) return;
    const rect = panel.getBoundingClientRect();
    drag = { pointerId: event.pointerId, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top };
    panel.dataset.dragging = 'true';
    handle.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  });
  const move = event => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const container = getContainer();
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const left = Math.max(8, Math.min(rect.width - panel.offsetWidth - 8, event.clientX - rect.left - drag.offsetX));
    const top = Math.max(8, Math.min(rect.height - panel.offsetHeight - 8, event.clientY - rect.top - drag.offsetY));
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    panel.style.transform = 'none';
    event.preventDefault();
  };
  const stop = event => {
    if (!drag || (event.pointerId != null && event.pointerId !== drag.pointerId)) return;
    try { handle.releasePointerCapture?.(drag.pointerId); } catch {}
    drag = null;
    panel.dataset.dragging = 'false';
    saveGigPanelPosition(panel);
  };
  window.addEventListener('pointermove', move, { passive: false });
  window.addEventListener('pointerup', stop);
  window.addEventListener('pointercancel', stop);
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-tcgate-dynamic="${src}"]`);
    if (existing?.dataset.loaded === '1') return resolve();
    if (existing) {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', () => reject(new Error(`Chargement impossible : ${src}`)), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.dataset.tcgateDynamic = src;
    script.addEventListener('load', () => { script.dataset.loaded = '1'; resolve(); }, { once: true });
    script.addEventListener('error', () => reject(new Error(`Chargement impossible : ${src}`)), { once: true });
    document.body.appendChild(script);
  });
}

async function ensureVisionAssets() {
  if (!visionEnabledForCurrentGame()) return false;
  if (state.visionAssetsLoaded) return true;
  if (state.visionAssetsLoading) {
    while (state.visionAssetsLoading) await new Promise(resolve => setTimeout(resolve, 25));
    if (state.visionAssetsError) throw new Error(state.visionAssetsError.message || 'Vision assets indisponibles');
    return state.visionAssetsLoaded;
  }

  state.visionAssetsLoading = true;
  state.visionAssetsError = null;
  const startedAt = performance.now();
  logEvent('vision-assets-load-start', { game: state.game });
  try {
    for (const src of VISION_ASSETS) await loadScript(src);
    state.visionAssetsLoaded = true;
    logEvent('vision-assets-load-end', { durationMs: Math.round(performance.now() - startedAt), count: VISION_ASSETS.length });
    return true;
  } catch (err) {
    state.visionAssetsError = { name: err?.name || null, message: err?.message || String(err) };
    logEvent('vision-assets-load-error', state.visionAssetsError);
    throw err;
  } finally {
    state.visionAssetsLoading = false;
  }
}

function applyGameModeUi() {
  const visionEnabled = visionEnabledForCurrentGame();
  screens.game?.classList.toggle('no-vision-mode', !visionEnabled);
  $('lobbyGameLabel').textContent = gameLabel();
  $('gameTitle').textContent = state.game === 'cyberpunk' ? 'Cyberpunk TCG' : 'Sans jeu';
  renderGigDicePanel();

  if (!visionEnabled) {
    setVisionStatus('Vision : désactivée');
    setCalibrationStatus({ status: 'idle' });
    setVisionStateStatus(null);
    if (state.visionAssetsLoaded) detachVision();
  }
}

async function prepareVision() {
  if(!visionEnabledForCurrentGame() || state.visionPrepared || state.visionPreparing) return;
  state.visionPreparing=true;
  setVisionStatus('Vision : chargement…','warning');
  logEvent('vision-prepare-start');

  try{
    await ensureVisionAssets();
    const [detector,identifier]=await Promise.allSettled([
      window.TCGVisionEngine?.preload?.(),
      window.TCGIdentificationLab?.start?.()
    ]);

    const detOk=detector.status==='fulfilled' && detector.value?.ready;
    const idOk=identifier.status==='fulfilled' && identifier.value?.ready;
    const libraryIntegrity=identifier.status==='fulfilled' ? identifier.value?.integrity || null : null;

    let tableState=null;
    if(detOk && idOk && window.TCGTableStateEngine){
      try {
        tableState=await window.TCGTableStateEngine.start?.();
        state.visionStateReady=Boolean(tableState?.workerReady);
        setVisionStateStatus(tableState);
      } catch(err) {
        state.visionStateReady=false;
        setVisionStateStatus({workerError:err?.message||String(err)});
        logEvent('vision-state-start-error',{name:err?.name||null,message:err?.message||String(err)});
      }
    }

    state.visionPrepared=Boolean(detOk && idOk);

    logEvent('vision-library-integrity',libraryIntegrity || {
      sourceReferences:0,
      loadedReferences:identifier.value?.cards||0,
      failedReferences:0,
      cacheStatus:'unknown',
      degraded:true,
      reason:'integrity-diagnostics-unavailable'
    });

    if(state.visionPrepared){
      setVisionStatus(`Vision : prête · ${identifier.value?.cards || 0} cartes`,'good');
    }else{
      setVisionStatus('Vision : préparation partielle','warning');
    }

    logEvent('vision-prepare-end',{
      detector:detector.status,
      detectorReady:Boolean(detector.value?.ready),
      provider:detector.value?.provider || null,
      identification:identifier.status,
      identificationReady:Boolean(identifier.value?.ready),
      cards:identifier.value?.cards || 0,
      libraryIntegrity,
      tableStateReady:Boolean(tableState?.workerReady),
      tableStateVersion:tableState?.version || null
    });
  }catch(err){
    setVisionStatus('Vision : erreur','error');
    logEvent('vision-prepare-error',{name:err?.name||null,message:err?.message||String(err)});
  }finally{
    state.visionPreparing=false;
  }
}

async function attachVisionToRemoteStream(stream) {
  if(!visionEnabledForCurrentGame()) return;
  if(!stream || !stream.getVideoTracks().length) return;
  const videoTrack=stream.getVideoTracks()[0];
  const key=`${stream.id}:${videoTrack.id}`;
  if(state.visionAttachedStreamId===key) return;

  state.visionAttachedStreamId=key;

  try{
    await prepareVision();
    await window.TCGVisionEngine?.attachRemoteStream?.(stream);
    const remoteCameraOff = state.remoteMediaState.cameraEnabled === false;
    if (remoteCameraOff) {
      window.TCGVisionEngine?.setInputPaused?.(true, 'remote-camera-off');
      setVisionStatus('Vision : pause · caméra adverse coupée', 'warning');
    }
    if(window.TCGTableStateEngine){
      try {
        const before=window.TCGTableStateEngine.getSnapshot?.();
        if(before?.started) window.TCGTableStateEngine.reset?.('restart');
        const table=await window.TCGTableStateEngine.start?.();
        state.visionStateReady=Boolean(table?.workerReady);
        setVisionStateStatus(table);
      } catch(err) {
        logEvent('vision-state-attach-error',{name:err?.name||null,message:err?.message||String(err)});
      }
    }
    if (!remoteCameraOff) {
      setVisionStatus('Vision : active','good');
      window.TCGVisionCalibration?.start?.($('remoteVideo'),'initial').catch(err=>{
        logEvent('calibration-error',{name:err?.name||null,message:err?.message||String(err)});
      });
    } else {
      window.TCGVisionCalibration?.stop?.();
    }

    startVisionMetricsSampler();
    logEvent('vision-attached',{streamId:stream.id,videoTrack:videoTrack.label||null});
  }catch(err){
    setVisionStatus('Vision : erreur','error');
    logEvent('vision-attach-error',{name:err?.name||null,message:err?.message||String(err)});
  }
}

function detachVision() {
  state.visionResumeToken += 1;
  clearInterval(state.visionMetricsTimer);
  state.visionMetricsTimer=null;
  clearTimeout(state.calibrationResizeTimer);
  state.calibrationResizeTimer=null;
  state.visionAttachedStreamId=null;
  state.currentIdentifiedCard=null;
  state.lastIdentificationEventKey=null;

  window.TCGVisionCalibration?.stop?.();
  window.TCGVisionEngine?.detachRemoteStream?.();
  window.TCGTableStateEngine?.reset?.('restart');
  state.visionStateReady=false;

  setVisionStatus('Vision : attente');
  setCalibrationStatus({status:'idle'});
  setVisionStateStatus(null);
  hideFullscreenIdentifiedCard();
}

function startVisionMetricsSampler() {
  clearInterval(state.visionMetricsTimer);
  state.visionMetricsTimer=setInterval(()=>{
    if(!state.gameActive) return;
    const detection=window.TCGVisionEngine?.getSnapshot?.() || null;
    const identification=window.TCGIdentificationLab?.getSnapshot?.() || null;
    const calibration=window.TCGVisionCalibration?.getSnapshot?.() || null;
    const tableState=window.TCGTableStateEngine?.getSnapshot?.() || null;
    setVisionStateStatus(tableState);

    logEvent('vision-sample',{
      detection:detection?{
        active:detection.active,
        provider:detection.provider,
        activeCards:detection.activeCards,
        inference:detection.inference,
        scheduling:detection.scheduling,
        playback:detection.playback,
        mainThread:detection.mainThread,
        analysisResolution:detection.analysisResolution,
        pipelineTiming:detection.pipelineTiming,
        filters:detection.filters
      }:null,
      identification:identification?{
        libraryReady:identification.libraryReady,
        librarySize:identification.librarySize,
        libraryIntegrity:identification.libraryIntegrity || null,
        matcherMs:identification.matcherMs,
        scheduling:identification.scheduling,
        pipelineTiming:identification.pipelineTiming,
        hoverCache:identification.hoverCache,
        identityStability:identification.identityStability || null
      }:null,
      tableState:tableState?{
        version:tableState.version,
        activeTableCards:tableState.activeTableCards,
        knownCards:tableState.knownCards,
        suspendedKnownCards:tableState.suspendedKnownCards,
        stats:tableState.stats
      }:null,
      calibration
    });
  },5000);
}

const CARD_DISPLAY_HIDE_DELAY_MS = 1200;

function cancelCardDisplayHide() {
  clearTimeout(state.cardDisplayHideTimer);
  state.cardDisplayHideTimer = null;
}

function showSideIdentifiedCard(card) {
  if(!card?.imageUrl) return;
  const image=$('displayCardImage');
  const button=$('displayCardButton');
  const empty=$('displayCardEmpty');
  if(image){
    image.src=card.imageUrl;
    image.alt=card.name || 'Carte identifiée';
  }
  button?.classList.remove('hidden');
  empty?.classList.add('hidden');
}

function hideSideIdentifiedCard() {
  $('displayCardButton')?.classList.add('hidden');
  $('displayCardEmpty')?.classList.remove('hidden');
}

function showFullscreenIdentifiedCard(card) {
  if(!card?.imageUrl) return;
  $('fullscreenIdentImage').src=card.imageUrl;
  $('fullscreenIdentImage').alt=card.name || 'Carte identifiée';
  $('fullscreenIdentName').textContent=card.name || 'Carte identifiée';
  $('fullscreenCardPreview').classList.remove('hidden');
}

function hideFullscreenIdentifiedCard() {
  $('fullscreenCardPreview')?.classList.add('hidden');
  setFullscreenCardZoom(false);
}

function presentIdentifiedCard(card) {
  if(!card?.imageUrl) return;
  cancelCardDisplayHide();
  state.currentIdentifiedCard={...card};
  showSideIdentifiedCard(state.currentIdentifiedCard);
  if(document.fullscreenElement===document.querySelector('.opponent-feed-card')){
    showFullscreenIdentifiedCard(state.currentIdentifiedCard);
  }
}

function clearVisibleCardNow(reason='handoff') {
  cancelCardDisplayHide();
  state.currentIdentifiedCard=null;
  hideSideIdentifiedCard();
  hideFullscreenIdentifiedCard();
  logEvent('visible-card-cleared',{reason});
}

function scheduleVisibleCardClear(reason='pointer-left-card') {
  if(!state.currentIdentifiedCard || state.cardDisplayHovering) return;
  cancelCardDisplayHide();
  state.cardDisplayHideTimer=setTimeout(()=>{
    if(state.cardDisplayHovering) return;
    clearVisibleCardNow(reason);
  },CARD_DISPLAY_HIDE_DELAY_MS);
}

function syncIdentifiedCardUi(detail) {
  if(!detail?.accepted){
    if(detail?.reason){
      logEvent('identification-rejected',{
        reason:detail.reason,
        visualIndex:detail.visualIndex ?? null,
        margin:detail.margin ?? null,
        mode:detail.mode || null,
        quality:detail.quality || null
      });
    }

    const snap=window.TCGIdentificationLab?.getSnapshot?.();
    if(snap?.pointerInsideStage && !snap?.hoveredTrack){
      scheduleVisibleCardClear('pointer-left-card');
    }
    return;
  }

  const card={
    cardId:detail.cardId||null,
    printingId:detail.printingId||null,
    refId:detail.refId||null,
    recognitionGroupId:detail.recognitionGroupId||null,
    candidatePrintingIds:Array.isArray(detail.candidatePrintingIds)?[...detail.candidatePrintingIds]:[],
    recognitionMode:detail.recognitionMode||null,
    variantKind:detail.variantKind||null,
    name:detail.name,
    type:detail.type,
    image:detail.image,
    imageUrl:detail.imageUrl,
    visualIndex:detail.visualIndex,
    mode:detail.mode,
    matcherMs:detail.matcherMs
  };
  presentIdentifiedCard(card);

  const key=`${detail.trackUid}:${detail.image}:${detail.mode}`;
  if(state.lastIdentificationEventKey!==key){
    state.lastIdentificationEventKey=key;
    logEvent('identification',{
      name:detail.name,
      image:detail.image,
      visualIndex:detail.visualIndex,
      margin:detail.margin,
      mode:detail.mode,
      matcherMs:detail.matcherMs,
      quality:detail.quality || null
    });
  }
}

function syncMemoryVisibleCard() {
  const snap=window.TCGIdentificationLab?.getSnapshot?.();
  const visible=snap?.visibleIdentity || null;
  if(!visible?.accepted || !visible?.imageUrl) return;
  presentIdentifiedCard({
    cardId:visible.cardId||null,
    printingId:visible.printingId||null,
    refId:visible.refId||null,
    recognitionGroupId:visible.recognitionGroupId||null,
    candidatePrintingIds:Array.isArray(visible.candidatePrintingIds)?[...visible.candidatePrintingIds]:[],
    recognitionMode:visible.recognitionMode||null,
    variantKind:visible.variantKind||null,
    name:visible.name,
    type:visible.type,
    image:visible.image,
    imageUrl:visible.imageUrl,
    visualIndex:null,
    mode:visible.mode || 'memory-hover',
    matcherMs:0
  });
}

function clearCurrentVisibleCard(reason='handoff') {
  scheduleVisibleCardClear(reason);
}

function captureTesterVisionFeedback(kind) {
  if (!visionEnabledForCurrentGame()) return;
  const detector=window.TCGVisionEngine?.getSnapshot?.() || null;
  const identification=window.TCGIdentificationLab?.getSnapshot?.() || null;
  const tableState=window.TCGTableStateEngine?.getSnapshot?.() || null;
  const feedback={
    id:`vf-${String(state.visionFeedback.length+1).padStart(3,'0')}`,
    at:new Date().toISOString(),
    kind,
    visibleIdentity:identification?.visibleIdentity || null,
    hoveredTrack:identification?.hoveredTrack || null,
    activeCards:detector?.activeCards ?? null,
    tableLastHover:tableState?.lastHover || null
  };
  state.visionFeedback.push(feedback);
  logEvent('vision-tester-feedback',feedback);
  try {
    if(kind==='missed-card') window.TCGDetectionLab?.captureCase?.('Alpha · carte non détectée');
  } catch {}
  toast(kind==='missed-card' ? 'Incident « carte non détectée » ajouté au rapport.' : 'Incident « mauvaise carte » ajouté au rapport.');
}

function configureSetup(mode) {
  state.mode = mode;
  const create = mode === 'create';
  $('setupEyebrow').textContent = create ? 'Créer une partie' : 'Rejoindre une partie';
  $('setupTitle').textContent = create ? 'Prépare ton salon' : 'Rejoins ton adversaire';
  $('setupSubtitle').textContent = create
    ? 'Choisis ton pseudo et le jeu.'
    : 'Entre le code reçu et choisis ton pseudo. Le jeu est défini par le salon.';
  $('roomCodeField').classList.toggle('hidden', create);
  $('gameField').classList.toggle('hidden', !create);
  $('setupContinue').textContent = create ? 'Ouvrir la table' : 'Rejoindre la table';
  if (!create && !new URLSearchParams(location.search).get('room')) $('roomCodeInput').value = '';
  state.roomCode = null;
  state.peerId = null;
  state.authToken = null;
  state.role = null;
  state.roomSnapshot = null;
  state.opponentPresent = false;
  state.opponentReady = false;
  screens.lobby?.classList.add('hub-preconnect');
  $('lobbyCode').textContent = '—';
  $('lobbyPlayerName').textContent = create ? 'Hôte' : 'Invité';
  $('lobbyOwnStatus').textContent = 'Configuration';
  $('lobbyOpponentName').textContent = create ? 'Invité' : 'Hôte';
  $('opponentWaitingText').textContent = 'En attente…';
  syncHubSessionControls();
  showScreen('lobby');
  setTimeout(() => (create ? $('playerName') : $('roomCodeInput')).focus(), 0);
}

async function openCreateHub() {
  configureSetup('create');
  $('playerName').value = 'Joueur';
  $('gameSelect').value = 'cyberpunk';
  state.game = 'cyberpunk';
  $('setupContinue').classList.add('hidden');
  await enterLobby({ provisional: true });
}

function currentVideoTrack() {
  return state.localStream?.getVideoTracks?.().find(track => track.readyState === 'live') || null;
}

function currentAudioTrack() {
  return state.localStream?.getAudioTracks?.().find(track => track.readyState === 'live') || null;
}

async function usePhoneVideoTrack(track, stream) {
  if (!track || track.kind !== 'video') return;
  const oldVideo = currentVideoTrack();
  const audio = currentAudioTrack();
  const local = new MediaStream([track, ...(audio ? [audio] : [])]);
  state.localStream = local;
  state.videoSource = 'phone';
  state.cameraEnabled = true;
  state.lostCameraId = null;
  state.lostCameraLabel = null;
  attachLocalTrackLifecycle(track, 'video');
  $('lobbyPreview').srcObject = local;
  $('localVideo').srcObject = local;
  await Promise.allSettled([$('lobbyPreview').play(), $('localVideo').play()]);
  if (state.videoTransceiver?.sender) {
    await state.videoTransceiver.sender.replaceTrack(track);
    await configureVideoSenderPolicy(state.videoTransceiver.sender, 'phone-camera');
  }
  if (oldVideo && oldVideo !== track) {
    try { oldVideo.stop(); } catch {}
  }
  updateMediaUi();
  updateGameDeviceStatus('Téléphone connecté · micro du PC actif');
  sendCurrentMediaState('phone-camera-active').catch(() => {});
  logEvent('phone-camera-track-active', { settings: safeTrackSettings(track), audioSource: audio ? 'pc' : null });
}

function phoneCameraBindings() {
  return {
    api,
    room: state.roomCode,
    peerId: state.peerId,
    onTrack: (track, stream) => usePhoneVideoTrack(track, stream).catch(err => {
      logEvent('phone-camera-track-error', { name: err?.name || null, message: err?.message || String(err) });
      toast('Impossible d’utiliser la caméra du téléphone.');
    }),
    onState: updatePhoneCameraUi
  };
}

async function startPcMicrophoneOnly(microphoneId = null) {
  if (!navigator.mediaDevices?.getUserMedia) return false;
  const constraints = {
    video: false,
    audio: microphoneId ? {
      deviceId: { exact: microphoneId },
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    } : {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  };
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  const audio = stream.getAudioTracks()[0] || null;
  if (!audio) throw new Error('Microphone PC indisponible');
  const old = state.localStream;
  state.localStream = new MediaStream([audio]);
  state.videoSource = 'phone';
  state.cameraEnabled = false;
  state.micEnabled = true;
  state.selectedMicrophoneId = audio.getSettings?.().deviceId || microphoneId || null;
  saveMediaPreferences();
  attachLocalTrackLifecycle(audio, 'audio');
  if (state.audioTransceiver?.sender) await state.audioTransceiver.sender.replaceTrack(audio);
  old?.getTracks?.().forEach(track => {
    if (track !== audio) track.stop();
  });
  $('lobbyPreview').srcObject = state.localStream;
  $('localVideo').srcObject = state.localStream;
  updateMediaUi();
  logEvent('phone-camera-pc-microphone-restored', { audio: safeTrackSettings(audio) });
  return true;
}

async function restorePhoneCameraAfterRecovery() {
  if (!window.TCGatePhoneCamera || !state.roomCode || !state.peerId) return false;
  const current = await window.TCGatePhoneCamera.findCurrent({
    api,
    room: state.roomCode,
    peerId: state.peerId
  }).catch(err => {
    logEvent('phone-camera-current-error', { name: err?.name || null, message: err?.message || String(err) });
    return null;
  });
  if (!current) return false;

  const prefs = readMediaPreferences();
  await startPcMicrophoneOnly(prefs.microphoneId).catch(err => {
    logEvent('phone-camera-pc-microphone-error', { name: err?.name || null, message: err?.message || String(err) });
  });
  state.videoSource = 'phone';
  const restored = await window.TCGatePhoneCamera.restoreCurrent({
    ...phoneCameraBindings(),
    current
  }).catch(err => {
    logEvent('phone-camera-restore-error', { name: err?.name || null, message: err?.message || String(err) });
    return null;
  });
  updatePhoneCameraUi({
    status: restored?.connected ? (restored.cameraActive ? 'streaming' : 'connected') : 'disconnected',
    diagnostics: restored?.state || null,
    recovered: true
  });
  logEvent('phone-camera-recovery', {
    found: true,
    connected: Boolean(restored?.connected),
    cameraActive: Boolean(restored?.cameraActive)
  });
  return true;
}

function updatePhoneCameraUi(info = {}) {
  const status = info.status || 'idle';
  const panel = $('phoneCameraPanel');
  const statusEl = $('phoneCameraStatus');
  const title = $('phoneCameraTitle');
  const help = $('phoneCameraHelp');
  const lensField = $('phoneCameraLensField');
  const lensSelect = $('phoneCameraLens');
  const gameLensField = $('gamePhoneCameraLensField');
  const gameLensSelect = $('gamePhoneCameraLens');
  if (!panel || !statusEl) return;
  const labels = {
    idle: ['Optionnel', 'Téléphone dissocié'],
    waiting: ['En attente', 'En attente du téléphone'],
    connected: ['Téléphone connecté', 'Téléphone associé'],
    streaming: ['Téléphone connecté', 'Caméra du téléphone active'],
    disconnected: ['Téléphone déconnecté', 'Connexion temporairement perdue']
  };
  const [short, heading] = labels[status] || labels.idle;
  statusEl.textContent = short;
  title.textContent = heading;
  panel.classList.toggle('hidden', status === 'idle');
  const cameras = Array.isArray(info.diagnostics?.cameraDevices) ? info.diagnostics.cameraDevices : [];
  for (const [field, select, inGame] of [[lensField, lensSelect, false], [gameLensField, gameLensSelect, true]]) {
    if (!field || !select) continue;
    const visible = ['connected', 'streaming', 'disconnected'].includes(status) && (!inGame || state.videoSource === 'phone');
    field.classList.toggle('hidden', !visible);
    if (cameras.length) {
      const active = cameras.find(camera => camera.active)?.id || info.diagnostics?.selectedCameraId || '';
      select.replaceChildren(...cameras.map(camera => {
        const option = document.createElement('option');
        option.value = camera.id;
        option.textContent = camera.label;
        return option;
      }));
      if (active && cameras.some(camera => camera.id === active)) select.value = active;
      select.disabled = cameras.length < 2 || status === 'disconnected';
    } else {
      select.replaceChildren(new Option('Liste indisponible', ''));
      select.disabled = true;
    }
  }
  $('returnToWebcam')?.classList.toggle('hidden', status !== 'streaming' || state.videoSource !== 'phone');
  $('reusePhoneCamera')?.classList.toggle('hidden', !(status === 'streaming' && state.videoSource === 'webcam'));
  if (status === 'disconnected') help.textContent = 'La partie reste active. Garde cette page ouverte pendant la reconnexion.';
  else if (status === 'streaming') help.textContent = 'Le téléphone remplace la webcam. Le microphone reste celui du PC.';
  if (info.controlError) toast(info.controlError);
}

async function pairPhoneCamera() {
  if (!state.roomCode || !state.peerId || !window.TCGatePhoneCamera) return toast('Entre d’abord dans un salon.');
  $('usePhoneCamera').disabled = true;
  try {
    if (!currentAudioTrack()) {
      const prefs = readMediaPreferences();
      await startPcMicrophoneOnly(prefs.microphoneId);
      await enumerateDevices();
    }
    const result = await window.TCGatePhoneCamera.createPair({
      ...phoneCameraBindings()
    });
    if (state.phoneCameraQrUrl) URL.revokeObjectURL(state.phoneCameraQrUrl);
    state.phoneCameraQrUrl = URL.createObjectURL(new Blob([result.qrSvg], { type: 'image/svg+xml' }));
    $('phoneCameraQr').src = state.phoneCameraQrUrl;
    $('copyPhoneCameraLink').dataset.url = result.phoneUrl;
    updatePhoneCameraUi({ status: 'waiting' });
  } catch (err) {
    logEvent('phone-camera-pair-error', { message: err.message });
    toast(err.message || 'Association téléphone impossible.');
  } finally {
    $('usePhoneCamera').disabled = false;
  }
}

async function returnToPcWebcam() {
  const cameraId = $('cameraSelect')?.value || state.selectedCameraId;
  if (!cameraId) return toast('Sélectionne une webcam PC.');
  const changed = await replaceMediaKind('video', cameraId, { reason: 'return-from-phone' });
  if (!changed) return;
  state.videoSource = 'webcam';
  const phone = window.TCGatePhoneCamera?.getSnapshot?.();
  updatePhoneCameraUi({
    status: phone?.cameraActive ? 'streaming' : (phone?.connected ? 'connected' : 'disconnected'),
    diagnostics: phone?.diagnostics || null
  });
  toast('Webcam PC réactivée.');
}

async function reusePhoneCamera() {
  try {
    await window.TCGatePhoneCamera?.usePhoneSource?.();
    await enumerateDevices();
    toast('Caméra du téléphone réactivée.');
  } catch (err) {
    toast(err.message || 'Flux téléphone indisponible.');
  }
}

function updateGameDeviceStatus(message = null) {
  const el = $('gameDeviceStatus');
  if (!el) return;
  if (message) {
    el.textContent = message;
    return;
  }
  const video = currentVideoTrack();
  const audio = currentAudioTrack();
  if (video && audio) el.textContent = 'Caméra et micro actifs';
  else if (video) el.textContent = 'Caméra active · micro indisponible';
  else if (audio) el.textContent = 'Micro actif · caméra indisponible';
  else el.textContent = 'Caméra et micro indisponibles';
}

async function openGameDeviceMenu(message = null) {
  await enumerateDevices();
  const menu = $('gameDeviceMenu');
  if (!menu) return;
  menu.classList.remove('hidden');
  $('deviceMenuToggle')?.setAttribute('aria-expanded', 'true');
  updateGameDeviceStatus(message);
}

function phoneCameraAvailable() {
  const phone = window.TCGatePhoneCamera?.getSnapshot?.();
  return Boolean(phone?.pairId && (phone.cameraActive || phone.connected));
}

function closeGameDeviceMenu() {
  $('gameDeviceMenu')?.classList.add('hidden');
  $('deviceMenuToggle')?.setAttribute('aria-expanded', 'false');
}

function attachLocalTrackLifecycle(track, kind) {
  if (!track || track.__tcgateLifecycleAttached) return;
  try { track.__tcgateLifecycleAttached = true; } catch {}
  track.addEventListener('ended', () => {
    const current = kind === 'video' ? currentVideoTrack() : currentAudioTrack();
    if (current && current !== track) return;
    handleLocalTrackEnded(kind, track).catch(() => {});
  }, { once: true });
}

async function handleLocalTrackEnded(kind, track) {
  const isVideo = kind === 'video';
  const settings = track?.getSettings?.() || {};
  const lostId = settings.deviceId || (isVideo ? state.selectedCameraId : state.selectedMicrophoneId) || null;

  if (state.localStream?.getTracks?.().includes(track)) {
    try { state.localStream.removeTrack(track); } catch {}
  }
  try { track?.stop?.(); } catch {}

  if (isVideo) {
    state.lostCameraId = lostId;
    state.lostCameraLabel = track?.label || null;
    if (state.videoTransceiver?.sender) {
      try { await state.videoTransceiver.sender.replaceTrack(null); } catch {}
    }
    toast('Caméra déconnectée · rebranche-la ou choisis-en une autre.');
    updateGameDeviceStatus('Caméra déconnectée · choisissez une caméra.');
  } else {
    state.lostMicrophoneId = lostId;
    state.lostMicrophoneLabel = track?.label || null;
    if (state.audioTransceiver?.sender) {
      try { await state.audioTransceiver.sender.replaceTrack(null); } catch {}
    }
    toast('Micro déconnecté · rebranche-le ou choisis-en un autre.');
    updateGameDeviceStatus('Micro déconnecté · choisissez un micro.');
  }

  logEvent('media-track-ended', {
    kind,
    hadDeviceId: Boolean(lostId),
    label: track?.label || null
  });

  $('lobbyPreview').srcObject = state.localStream;
  $('localVideo').srcObject = state.localStream;
  updateMediaUi();
  sendCurrentMediaState(`device-${kind}-lost`).catch(() => {});
  await enumerateDevices();
}

async function replaceMediaKind(kind, deviceId, { reason = 'manual-device-change', silent = false, acquiredStream = null } = {}) {
  if (!navigator.mediaDevices?.getUserMedia || state.deviceRecoveryInFlight) return false;
  const isVideo = kind === 'video';
  if (!deviceId) {
    if (!silent) toast(isVideo ? 'Aucune caméra sélectionnée.' : 'Aucun micro sélectionné.');
    return false;
  }

  state.deviceRecoveryInFlight = true;
  const oldTrack = isVideo ? currentVideoTrack() : currentAudioTrack();
  const preservePhoneTrack = isVideo && state.videoSource === 'phone';
  try {
    let stream = acquiredStream;
    if (isVideo && !stream) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { exact: deviceId },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30, max: 30 }
          },
          audio: false
        });
      } catch (firstErr) {
        logEvent('device-replace-video-relaxed', {
          reason,
          firstError: firstErr?.name || null
        });
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { exact: deviceId },
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30, max: 30 }
          },
          audio: false
        });
      }
    } else if (!isVideo && !stream) {
      stream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: {
          deviceId: { exact: deviceId },
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
    }

    const newTrack = isVideo ? stream.getVideoTracks()[0] : stream.getAudioTracks()[0];
    if (!newTrack) throw new Error(isVideo ? 'Caméra indisponible' : 'Micro indisponible');

    const keptTrack = isVideo ? currentAudioTrack() : currentVideoTrack();
    const tracks = isVideo
      ? [newTrack, ...(keptTrack ? [keptTrack] : [])]
      : [...(keptTrack ? [keptTrack] : []), newTrack];
    const newLocalStream = new MediaStream(tracks);

    state.localStream = newLocalStream;
    if (isVideo) {
      state.videoSource = 'webcam';
      state.selectedCameraId = newTrack.getSettings?.().deviceId || deviceId;
      state.lostCameraId = null;
      state.lostCameraLabel = null;
      const q = state.rtcQualityControl;
      q.captureAdaptiveMode = 'native';
      q.captureAdaptationPending = false;
      q.captureAdaptationError = null;
      q.captureLastAttemptAtMs = 0;
      q.senderAdaptiveMode = 'native';
      q.senderScaleResolutionDownBy = 1;
      if (state.videoTransceiver?.sender) {
        await state.videoTransceiver.sender.replaceTrack(newTrack);
        await configureVideoSenderPolicy(state.videoTransceiver.sender, `device-${reason}`);
      }
    } else {
      state.selectedMicrophoneId = newTrack.getSettings?.().deviceId || deviceId;
      state.lostMicrophoneId = null;
      state.lostMicrophoneLabel = null;
      if (state.audioTransceiver?.sender) {
        await state.audioTransceiver.sender.replaceTrack(newTrack);
      }
    }

    attachLocalTrackLifecycle(newTrack, kind);
    saveMediaPreferences();

    $('lobbyPreview').srcObject = newLocalStream;
    $('localVideo').srcObject = newLocalStream;
    await Promise.allSettled([
      $('lobbyPreview').play(),
      $('localVideo').play()
    ]);

    if (oldTrack && oldTrack !== newTrack && !preservePhoneTrack) {
      try { oldTrack.stop(); } catch {}
    }

    await enumerateDevices();
    updateMediaUi();
    updateGameDeviceStatus();
    sendCurrentMediaState(`device-${kind}-replaced`).catch(() => {});

    logEvent('media-device-replaced', {
      kind,
      reason,
      settings: safeTrackSettings(newTrack)
    });
    if (!silent) toast(isVideo ? 'Caméra changée.' : 'Micro changé.');
    return true;
  } catch (err) {
    logEvent('media-device-replace-error', {
      kind,
      reason,
      name: err?.name || null,
      message: err?.message || String(err)
    });
    if (!silent) toast(`${isVideo ? 'Caméra' : 'Micro'} indisponible.`);
    return false;
  } finally {
    state.deviceRecoveryInFlight = false;
  }
}

async function handleMediaDeviceChange() {
  clearTimeout(state.deviceChangeTimer);
  state.deviceChangeTimer = setTimeout(async () => {
    const devices = await enumerateDevices({ returnDevices: true });
    if (!devices) return;

    const cameras = devices.filter(d => d.kind === 'videoinput');
    const microphones = devices.filter(d => d.kind === 'audioinput');

    const activeVideo = currentVideoTrack();
    const activeAudio = currentAudioTrack();
    const activeCameraMissing = Boolean(
      activeVideo &&
      state.selectedCameraId &&
      !cameras.some(d => d.deviceId === state.selectedCameraId)
    );
    const activeMicrophoneMissing = Boolean(
      activeAudio &&
      state.selectedMicrophoneId &&
      !microphones.some(d => d.deviceId === state.selectedMicrophoneId)
    );

    if (activeCameraMissing) await handleLocalTrackEnded('video', activeVideo);
    if (activeMicrophoneMissing) await handleLocalTrackEnded('audio', activeAudio);

    const cameraMatch = cameras.find(d =>
      (state.lostCameraId && d.deviceId === state.lostCameraId) ||
      (state.lostCameraLabel && d.label && d.label === state.lostCameraLabel)
    ) || null;
    const microphoneMatch = microphones.find(d =>
      (state.lostMicrophoneId && d.deviceId === state.lostMicrophoneId) ||
      (state.lostMicrophoneLabel && d.label && d.label === state.lostMicrophoneLabel)
    ) || null;

    if (!currentVideoTrack() && cameraMatch) {
      const recovered = await replaceMediaKind('video', cameraMatch.deviceId, {
        reason: 'same-device-replug',
        silent: true
      });
      if (recovered) toast('Caméra reconnectée automatiquement.');
    }

    if (!currentAudioTrack() && microphoneMatch) {
      const recovered = await replaceMediaKind('audio', microphoneMatch.deviceId, {
        reason: 'same-device-replug',
        silent: true
      });
      if (recovered) toast('Micro reconnecté automatiquement.');
    }

    if ((!currentVideoTrack() && cameras.length) || (!currentAudioTrack() && microphones.length)) {
      updateGameDeviceStatus('Périphérique détecté · sélectionnez-le si nécessaire.');
    }

    logEvent('media-devicechange', {
      cameras: cameras.length,
      microphones: microphones.length,
      activeCameraMissing,
      activeMicrophoneMissing,
      sameCameraFound: Boolean(cameraMatch),
      sameMicrophoneFound: Boolean(microphoneMatch)
    });
  }, 250);
}

function updateMediaUi() {
  const videoTrack = currentVideoTrack();
  const audioTrack = currentAudioTrack();

  state.cameraEnabled = Boolean(videoTrack && videoTrack.enabled);
  state.micEnabled = Boolean(audioTrack && audioTrack.enabled);

  $('lobbyToggleCam').disabled = !videoTrack;
  $('lobbyToggleMic').disabled = !audioTrack;
  $('lobbyToggleCam').classList.toggle('active', state.cameraEnabled);
  $('lobbyToggleMic').classList.toggle('active', state.micEnabled);
  $('toggleCam').classList.toggle('active', state.cameraEnabled);
  $('toggleMic').classList.toggle('active', state.micEnabled);
  $('fullscreenCam')?.classList.toggle('active', state.cameraEnabled);
  $('fullscreenMic')?.classList.toggle('active', state.micEnabled);
  $('toggleCam').classList.toggle('muted', !state.cameraEnabled);
  $('toggleMic').classList.toggle('muted', !state.micEnabled);
  $('fullscreenCam')?.classList.toggle('muted', !state.cameraEnabled);
  $('fullscreenMic')?.classList.toggle('muted', !state.micEnabled);
  $('toggleCam').title = state.cameraEnabled ? 'Caméra active' : 'Caméra coupée';
  $('toggleMic').title = state.micEnabled ? 'Micro actif' : 'Micro coupé';
  if($('fullscreenCam')) $('fullscreenCam').title = $('toggleCam').title;
  if($('fullscreenMic')) $('fullscreenMic').title = $('toggleMic').title;

  $('lobbyPreviewPlaceholder').classList.toggle('hidden', Boolean(videoTrack && state.cameraEnabled));
  $('localVideoPlaceholder').classList.toggle('hidden', Boolean(videoTrack && state.cameraEnabled));
  $('lobbyPreviewShell').classList.toggle('camera-off', !state.cameraEnabled);
  $('localFeed').classList.toggle('camera-off', !state.cameraEnabled);
  const localPreviewVisible = state.cameraEnabled && state.localPreviewVisible;
  $('localFeed').classList.toggle('preview-hidden', !localPreviewVisible);
  $('restoreLocalFeed')?.classList.toggle('hidden', localPreviewVisible || !state.cameraEnabled);

  $('lobbyToggleCam').textContent = state.cameraEnabled ? 'Caméra active' : 'Caméra coupée';
  $('lobbyToggleMic').textContent = state.micEnabled ? 'Micro actif' : 'Micro coupé';

  if (!state.localStream) {
    $('mediaStatus').textContent = 'Non activés';
    $('mediaStatus').className = 'media-status';
  } else if (videoTrack && audioTrack) {
    $('mediaStatus').textContent = 'Caméra et micro prêts';
    $('mediaStatus').className = 'media-status ready';
  } else if (videoTrack) {
    $('mediaStatus').textContent = 'Caméra prête · micro indisponible';
    $('mediaStatus').className = 'media-status warning';
  } else if (audioTrack) {
    $('mediaStatus').textContent = 'Micro prêt · caméra indisponible';
    $('mediaStatus').className = 'media-status warning';
  } else {
    $('mediaStatus').textContent = 'Périphériques déconnectés';
    $('mediaStatus').className = 'media-status warning';
  }

  updateGameDeviceStatus();

  if (state.roomSnapshot && screens.lobby.classList.contains('active')) {
    applyRoomState(state.roomSnapshot);
  }
}

async function enumerateDevices({ returnDevices = false } = {}) {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter(d => d.kind === 'videoinput');
    const microphones = devices.filter(d => d.kind === 'audioinput');

    const fill = (select, items, fallback, selectedId = null, forceChoice = false) => {
      if (!select) return;
      const previous = select.value;
      select.innerHTML = '';
      if (!items.length) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = `Aucun ${fallback.toLowerCase()}`;
        select.appendChild(option);
        select.disabled = true;
        return;
      }
      select.disabled = false;

      const selectedStillExists = Boolean(selectedId && items.some(x => x.deviceId === selectedId));
      if (forceChoice && !selectedStillExists) {
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = `Choisir ${fallback.toLowerCase()}…`;
        select.appendChild(placeholder);
      }

      items.forEach((device, index) => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.textContent = device.label || `${fallback} ${index + 1}`;
        select.appendChild(option);
      });

      const preferred = selectedStillExists
        ? selectedId
        : (!forceChoice && items.some(x => x.deviceId === previous) ? previous : null);
      select.value = preferred || '';
    };

    const needCameraChoice = !currentVideoTrack();
    const needMicroChoice = !currentAudioTrack();
    fill($('cameraSelect'), cameras, 'Caméra', state.selectedCameraId, needCameraChoice);
    fill($('microSelect'), microphones, 'Micro', state.selectedMicrophoneId, needMicroChoice);
    fill($('phoneCameraMicro'), microphones, 'Micro', state.selectedMicrophoneId, needMicroChoice);
    fill($('gameMicroSelect'), microphones, 'Micro', state.selectedMicrophoneId, needMicroChoice);

    fill($('gameCameraSelect'), cameras, 'Webcam', state.selectedCameraId, needCameraChoice);
    const sourceSelect = $('gameVideoSourceSelect');
    if (sourceSelect) {
      sourceSelect.replaceChildren(...window.TCGateMediaRecovery.videoSourceOptions(phoneCameraAvailable())
        .map(source => new Option(source.label, source.value)));
      sourceSelect.value = state.videoSource === 'phone' && phoneCameraAvailable() ? 'phone' : 'webcam';
    }
    $('gameWebcamField')?.classList.toggle('hidden', state.videoSource !== 'webcam');
    $('gamePhoneCameraLensField')?.classList.toggle('hidden', state.videoSource !== 'phone');
    $('deviceSelectors').classList.toggle('hidden', !(cameras.length || microphones.length));

    if (returnDevices) return devices;
    return true;
  } catch (err) {
    logEvent('media-enumerate-error', { message: err?.message || String(err) });
    return returnDevices ? null : false;
  }
}

async function startLocalMedia({ cameraId = null, microphoneId = null } = {}) {
  if (!navigator.mediaDevices?.getUserMedia) {
    $('mediaStatus').textContent = 'Caméra/micro non pris en charge';
    $('mediaStatus').className = 'media-status error';
    logEvent('media-error', { stage: 'unsupported' });
    return false;
  }

  const videoConstraint = cameraId
    ? { deviceId: { exact: cameraId }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30, max: 30 } }
    : { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30, max: 30 } };

  const relaxedVideoConstraint = cameraId
    ? { deviceId: { exact: cameraId }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } }
    : { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } };

  const audioConstraint = microphoneId
    ? { deviceId: { exact: microphoneId }, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    : { echoCancellation: true, noiseSuppression: true, autoGainControl: true };

  const describeMediaError = (err) => ({
    name: err?.name || 'UnknownError',
    message: err?.message || String(err || 'Erreur inconnue'),
    constraint: err?.constraint || null
  });

  $('mediaStatus').textContent = 'Demande d’autorisation…';
  $('mediaStatus').className = 'media-status';

  let stream = null;
  let mode = 'audio-video';
  let videoFailure = null;
  let audioFailure = null;
  let fullFailure = null;

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: videoConstraint,
      audio: audioConstraint
    });
  } catch (err) {
    fullFailure = describeMediaError(err);
    logEvent('media-attempt-error', { stage: 'audio-video', error: fullFailure });

    // Candidate 2: recover video and audio independently. A camera allocation
    // failure must not silently discard a microphone that is otherwise usable.
    let recoveredVideo = null;
    let recoveredAudio = null;
    let videoMode = null;

    try {
      recoveredVideo = await navigator.mediaDevices.getUserMedia({
        video: videoConstraint,
        audio: false
      });
      videoMode = '1080';
    } catch (errVideo) {
      videoFailure = describeMediaError(errVideo);
      logEvent('media-attempt-error', { stage: 'video-only-1080', error: videoFailure });

      try {
        recoveredVideo = await navigator.mediaDevices.getUserMedia({
          video: relaxedVideoConstraint,
          audio: false
        });
        videoMode = '720';
        videoFailure = null;
      } catch (errVideoRelaxed) {
        videoFailure = describeMediaError(errVideoRelaxed);
        logEvent('media-attempt-error', { stage: 'video-only-720', error: videoFailure });
      }
    }

    try {
      recoveredAudio = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: audioConstraint
      });
    } catch (errAudio) {
      audioFailure = describeMediaError(errAudio);
      logEvent('media-attempt-error', { stage: 'audio-only-recovery', error: audioFailure });
    }

    const recoveredTracks = [
      ...(recoveredVideo?.getVideoTracks?.() || []),
      ...(recoveredAudio?.getAudioTracks?.() || [])
    ];

    if (!recoveredTracks.length) {
      $('mediaStatus').textContent = 'Autorisation refusée ou périphérique indisponible';
      $('mediaStatus').className = 'media-status error';
      logEvent('media-error', {
        stage: 'all-failed',
        fullFailure,
        videoFailure,
        audioFailure
      });
      toast('Impossible d’activer la caméra ou le micro.');
      return false;
    }

    stream = new MediaStream(recoveredTracks);
    if (recoveredVideo && recoveredAudio) mode = `recovered-audio-video-${videoMode || 'default'}`;
    else if (recoveredVideo) mode = `video-only-${videoMode || 'default'}`;
    else mode = 'audio-only';
  }

  const oldStream = state.localStream;
  state.localStream = stream;
  state.videoSource = 'webcam';

  const v = stream.getVideoTracks()[0] || null;
  const a = stream.getAudioTracks()[0] || null;

  state.selectedCameraId = v?.getSettings?.().deviceId || cameraId || null;
  state.selectedMicrophoneId = a?.getSettings?.().deviceId || microphoneId || null;
  if (v) {
    state.lostCameraId = null;
    state.lostCameraLabel = null;
    attachLocalTrackLifecycle(v, 'video');
  } else if (cameraId) {
    state.lostCameraId = cameraId;
  }
  if (a) {
    state.lostMicrophoneId = null;
    state.lostMicrophoneLabel = null;
    attachLocalTrackLifecycle(a, 'audio');
  } else if (microphoneId) {
    state.lostMicrophoneId = microphoneId;
  }
  saveMediaPreferences();

  // A deliberate media start/device change begins a fresh native-quality session.
  // Candidate 5 never auto-upgrades an adapted track, but a manual camera restart
  // is an explicit user action and may legitimately try 1080p again.
  const qualityControl = state.rtcQualityControl;
  const previousAdaptiveProfile = {
    capture: qualityControl.captureAdaptiveMode,
    sender: qualityControl.senderAdaptiveMode
  };
  qualityControl.captureAdaptiveMode = 'native';
  qualityControl.captureAdaptationPending = false;
  qualityControl.captureAdaptationError = null;
  qualityControl.captureLastAttemptAtMs = 0;
  qualityControl.senderAdaptiveMode = 'native';
  qualityControl.senderScaleResolutionDownBy = 1;
  if (previousAdaptiveProfile.capture !== 'native' || previousAdaptiveProfile.sender !== 'native') {
    logEvent('rtc-adaptive-profile-reset', { source: 'manual-media-start', previousAdaptiveProfile });
  }

  $('lobbyPreview').srcObject = stream;
  $('localVideo').srcObject = stream;
  await Promise.allSettled([
    $('lobbyPreview').play(),
    $('localVideo').play()
  ]);

  if (state.pc) {
    if (state.videoTransceiver) {
      await state.videoTransceiver.sender.replaceTrack(v);
      await configureVideoSenderPolicy(state.videoTransceiver.sender, 'media-restart');
    }
    if (state.audioTransceiver) {
      await state.audioTransceiver.sender.replaceTrack(a);
    }
  }

  if (oldStream && oldStream !== stream) {
    oldStream.getTracks().forEach(track => track.stop());
  }

  await enumerateDevices();
  updateMediaUi();

  if (!v && videoFailure) {
    $('mediaStatus').textContent = `Micro actif · caméra indisponible (${videoFailure.name})`;
    $('mediaStatus').className = 'media-status warning';
  } else if (v && !a && audioFailure) {
    $('mediaStatus').textContent = `Caméra active · micro indisponible (${audioFailure.name})`;
    $('mediaStatus').className = 'media-status warning';
  }

  logEvent('media-started', {
    mode,
    video: safeTrackSettings(v),
    audio: safeTrackSettings(a),
    videoFailure,
    audioFailure,
    fullFailure
  });

  return true;
}

async function changeCameraFromSelector(selectId) {
  const cameraId = $(selectId)?.value || null;
  if (!cameraId) return;
  logEvent('device-change-request', { kind: 'video', source: selectId });
  await replaceMediaKind('video', cameraId, { reason: `selector-${selectId}` });
}

async function changeGameVideoSource() {
  const source = $('gameVideoSourceSelect')?.value;
  if (source === 'phone') {
    try {
      await window.TCGatePhoneCamera?.usePhoneSource?.();
      await enumerateDevices();
      toast('Caméra du téléphone réactivée.');
    } catch (err) {
      await enumerateDevices();
      toast('Flux téléphone indisponible — source actuelle conservée.');
    }
    return;
  }
  if (source !== 'webcam' || state.videoSource === 'webcam') {
    await enumerateDevices();
    return;
  }

  let permissionStream = null;
  try {
    permissionStream = await window.TCGateMediaRecovery.acquirePcWebcam(navigator.mediaDevices);
    const track = permissionStream.getVideoTracks()[0] || null;
    if (!track) throw new Error('Webcam PC indisponible');
    const deviceId = track.getSettings?.().deviceId || '';
    const changed = await replaceMediaKind('video', deviceId || 'default', {
      reason: 'game-source-webcam',
      acquiredStream: permissionStream
    });
    if (!changed) throw new Error('Webcam PC indisponible');
    permissionStream = null;
    await enumerateDevices();
  } catch (err) {
    permissionStream?.getTracks?.().forEach(track => track.stop());
    await enumerateDevices();
    toast('Autorisation webcam refusée — téléphone conservé.');
  }
}

async function changeMicrophoneFromSelector(selectId) {
  const microphoneId = $(selectId)?.value || null;
  if (!microphoneId) return;
  logEvent('device-change-request', { kind: 'audio', source: selectId });
  await replaceMediaKind('audio', microphoneId, { reason: `selector-${selectId}` });
}

function safeTrackSettings(track) {
  if (!track) return null;
  const s = track.getSettings?.() || {};
  return {
    kind: track.kind,
    label: track.label || null,
    width: s.width || null,
    height: s.height || null,
    frameRate: s.frameRate || null,
    sampleRate: s.sampleRate || null,
    channelCount: s.channelCount || null
  };
}

function stopLocalStream() {
  if (state.localStream) state.localStream.getTracks().forEach(track => track.stop());
  state.localStream = null;
  state.videoSource = 'webcam';
  state.lostCameraId = null;
  state.lostMicrophoneId = null;
  state.lostCameraLabel = null;
  state.lostMicrophoneLabel = null;
  $('lobbyPreview').srcObject = null;
  $('localVideo').srcObject = null;
  $('gameDeviceMenu')?.classList.add('hidden');
  $('deviceMenuToggle')?.setAttribute('aria-expanded', 'false');
  updateMediaUi();
  logEvent('media-stopped');
}

async function tryResumeSavedSession() {
  const saved = readSavedRoomSession();
  if (!saved) return false;

  state.roomCode = saved.roomCode;
  state.peerId = saved.peerId;
  state.authToken = saved.authToken;
  state.role = saved.role || null;
  state.playerName = saved.playerName || 'Joueur';
  state.game = saved.game || 'cyberpunk';
  state.gigDice = validGigDiceState(saved.gigDice) ? saved.gigDice.map(die => ({ ...die })) : createGigDiceState();

  try {
    const result = await api('/api/resume', {
      method: 'POST',
      body: { room: state.roomCode, peerId: state.peerId }
    });

    resetReportSession({
      roomCode: result.code,
      role: result.role,
      game: result.room?.game || state.game,
      resumed: true
    });

    hydrateSessionFromResult(result);
    const wasInGame = (result.room?.phase || 'lobby') === 'game';
    state.recoveryBootstrapPending = wasInGame;
    state.gameEntering = true;
    applyRoomState(result.room);
    state.gameEntering = false;
    if (wasInGame) prepareMainRtcRecovery('session-resume');
    await connectEventStream().catch(() => {});
    await waitForEventStreamOpen().catch(() => false);

    const phoneRestored = await restorePhoneCameraAfterRecovery();
    if (!phoneRestored) {
      const prefs = readMediaPreferences();
      await startLocalMedia({
        cameraId: prefs.cameraId,
        microphoneId: prefs.microphoneId
      }).catch(() => false);
    }

    if (wasInGame) {
      showScreen('game');
      await enterNetworkGame({ recovery: true, reason: 'session-resume' });
      state.recoveryBootstrapPending = false;
      toast('Partie reprise.');
    } else {
      state.recoveryBootstrapPending = false;
      showScreen('lobby');
      toast('Salon repris.');
    }

    logEvent('room-resumed', {
      code: state.roomCode,
      role: state.role,
      game: state.game,
      phase: result.room?.phase || 'lobby'
    });
    return true;
  } catch (err) {
    state.recoveryBootstrapPending = false;
    logEvent('room-resume-failed', { message: err?.message || String(err) });
    clearSavedRoomSession();
    state.roomCode = null;
    state.peerId = null;
    state.authToken = null;
    state.role = null;
    return false;
  }
}

async function enterLobby({ provisional = false } = {}) {
  const name = $('playerName').value.trim() || 'Joueur';
  state.playerName = name;
  if (state.mode === 'create') state.game = $('gameSelect').value;
  $('setupContinue').disabled = true;

  try {
    let result;
    if (state.mode === 'create') {
      result = await api('/api/rooms', {
        method: 'POST',
        body: { name, game: state.game },
        auth: false
      });
    } else {
      const entered = $('roomCodeInput').value.trim().toUpperCase();
      if (!entered) {
        toast('Entre un code de partie.');
        $('roomCodeInput').focus();
        return;
      }
      result = await api(`/api/rooms/${encodeURIComponent(entered)}/join`, {
        method: 'POST',
        body: { name },
        auth: false
      });
    }

    resetReportSession({
      roomCode: result.code,
      role: result.role,
      game: result.room?.game || state.game || 'cyberpunk'
    });

    state.roomCode = result.code;
    state.peerId = result.peerId;
    state.authToken = result.sessionToken;
    state.role = result.role;
    state.roomSnapshot = result.room;
    state.game = result.room?.game || state.game || 'cyberpunk';
    state.gigDice = createGigDiceState();
    state.lastMovedDieId = null;
    state.rtcConfig = null;
    state.rtcConfigKey = null;
    state.rtcConfigLoading = null;
    state.turnStatus = { configured: false, available: false, provider: null, policy: 'all', expiresAt: null, reason: 'not-loaded' };
    $('roomCodeInput').value = '';
    applyGameModeUi();

    $('lobbyCode').textContent = state.roomCode;
    $('lobbyPlayerName').textContent = state.playerName;
    $('localPlayerLabel').textContent = state.playerName;
    $('gameCode').textContent = state.roomCode;
    $('gameTitle').textContent = state.game === 'cyberpunk' ? 'Cyberpunk TCG' : 'Sans jeu';

    history.replaceState({}, '', `${location.pathname}?room=${state.roomCode}`);
    saveRoomSession();
    logEvent('room-entered', { code: state.roomCode, role: state.role, game: state.game });

    connectEventStream().catch(() => {});
    applyRoomState(result.room);
    syncHubSessionControls();
    showScreen('lobby');
  } catch (err) {
    toast(err.message);
    logEvent('room-error', { message: err.message });
    if (provisional) $('setupContinue').classList.remove('hidden');
  } finally {
    $('setupContinue').disabled = false;
  }
}

async function connectEventStream() {
  if (!state.roomCode || !state.peerId || !state.authToken) return;
  clearTimeout(state.sseReconnectTimer);
  state.sseReconnectTimer = null;
  state.eventSource?.close();

  let ticketResult;
  try {
    ticketResult = await api('/api/events-ticket', {
      method: 'POST',
      body: { room: state.roomCode, peerId: state.peerId }
    });
  } catch (err) {
    setNetworkStatus('Reconnexion au serveur…', 'warning');
    logEvent('sse-ticket-error', { message: err?.message || String(err) });
    scheduleEventStreamReconnect();
    return;
  }

  const src = new EventSource(`/api/events?ticket=${encodeURIComponent(ticketResult.ticket)}`);
  state.eventSource = src;

  src.addEventListener('open', () => {
    state.sseReconnectAttempts = 0;
    setNetworkStatus('Connecté au serveur de salon', 'connected');
    logEvent('sse-open');
  });

  src.addEventListener('room-state', event => {
    const snapshot = JSON.parse(event.data);
    applyRoomState(snapshot);
  });

  src.addEventListener('room-recovery', event => {
    const payload = JSON.parse(event.data);
    logEvent('room-recovery', payload);
  });

  src.addEventListener('peer-joined', event => {
    const payload = JSON.parse(event.data);
    logEvent('peer-joined', { role: payload.peer?.role || null });
  });

  src.addEventListener('peer-left', event => {
    const payload = JSON.parse(event.data);
    logEvent('peer-left', payload);
    state.opponentPresent = false;
    state.opponentReady = false;
    applyRoomState(state.roomSnapshot || { peers: [] });
    closePeerConnection('peer-left');
    toast('L’adversaire a quitté la partie.');
  });

  src.addEventListener('signal', async event => {
    const signal = JSON.parse(event.data);
    await handleSignal(signal);
  });

  src.addEventListener('error', () => {
    if (state.eventSource !== src) return;
    src.close();
    state.eventSource = null;
    setNetworkStatus('Reconnexion au serveur…', 'warning');
    logEvent('sse-error');
    scheduleEventStreamReconnect();
  });
}

async function waitForEventStreamOpen(timeoutMs = 3500) {
  const startedAt = performance.now();
  while (performance.now() - startedAt < timeoutMs) {
    if (state.eventSource?.readyState === EventSource.OPEN) return true;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  return state.eventSource?.readyState === EventSource.OPEN;
}

function scheduleEventStreamReconnect() {
  if (!state.roomCode || !state.peerId || !state.authToken || state.sseReconnectTimer) return;
  const attempt = ++state.sseReconnectAttempts;
  const delay = Math.min(5000, 500 * Math.pow(1.6, Math.min(attempt, 6)));
  state.sseReconnectTimer = setTimeout(() => {
    state.sseReconnectTimer = null;
    connectEventStream().catch(() => {});
  }, delay);
  logEvent('sse-reconnect-scheduled', { attempt, delayMs: Math.round(delay) });
}

function stopReadyStatePolling(reason = 'stop') {
  const wasActive = Boolean(state.readyStatePollTimer || state.readyStatePollInFlight);
  if (state.readyStatePollTimer) clearInterval(state.readyStatePollTimer);
  state.readyStatePollTimer = null;
  state.readyStatePollInFlight = false;
  if (wasActive) logEvent('ready-state-poll-stop', { reason, polls: state.readyStatePollCount });
}

async function pollRoomStateOnce() {
  if (!state.roomCode || !state.peerId || state.readyStatePollInFlight || state.gameActive || state.gameEntering) return;
  state.readyStatePollInFlight = true;
  const startedAt = performance.now();
  try {
    const result = await api(`/api/rooms/${encodeURIComponent(state.roomCode)}/state?peer=${encodeURIComponent(state.peerId)}`);
    state.readyStatePollCount += 1;
    logEvent('ready-state-poll', { durationMs: Math.round(performance.now() - startedAt), count: state.readyStatePollCount });
    if (result?.room) applyRoomState(result.room);
  } catch (err) {
    logEvent('ready-state-poll-error', { message: err?.message || String(err) });
  } finally {
    state.readyStatePollInFlight = false;
  }
}

function startReadyStatePolling() {
  if (state.readyStatePollTimer || state.gameActive || state.gameEntering) return;
  state.readyStatePollCount = 0;
  logEvent('ready-state-poll-start');
  pollRoomStateOnce().catch(() => {});
  state.readyStatePollTimer = setInterval(() => pollRoomStateOnce().catch(() => {}), 500);
}

async function recoverRtcInPlaceAfterRoomRecovery(previousEpoch, nextEpoch) {
  if (!state.gameActive || state.roomRecoveryInFlight) return;
  state.roomRecoveryInFlight = true;
  logEvent('room-recovery-in-place-start', {
    previousEpoch,
    nextEpoch,
    role: state.role
  });

  try {
    setRtcStatus('Adversaire en reconnexion…', 'warning');
    state.mainRtcRecoveryActive = true;
    closePeerConnection('room-recovery-in-place');
    await new Promise(resolve => setTimeout(resolve, 120));
    if (!state.gameActive) return;

    await ensurePeerConnection();
    scheduleRemoteRecoveryWatchdog('room-recovery-in-place');
    logEvent('room-recovery-in-place-ready', {
      role: state.role,
      action: state.role === 'host' ? 'await-guest-restart' : 'await-host-offer'
    });
  } catch (err) {
    logEvent('room-recovery-in-place-error', {
      name: err?.name || null,
      message: err?.message || String(err)
    });
    setRtcStatus('Reconnexion en attente…', 'warning');
  } finally {
    state.roomRecoveryInFlight = false;
  }
}

function applyRoomState(snapshot) {
  if (!snapshot) return;
  const incomingRecoveryEpoch = Number(snapshot.recoveryEpoch || 0);
  if (incomingRecoveryEpoch > state.recoveryEpoch && state.gameActive) {
    const previousEpoch = state.recoveryEpoch;
    logEvent('room-recovery-in-place', {
      previousEpoch,
      nextEpoch: incomingRecoveryEpoch
    });
    recoverRtcInPlaceAfterRoomRecovery(previousEpoch, incomingRecoveryEpoch).catch(() => {});
  }
  state.recoveryEpoch = incomingRecoveryEpoch;
  state.roomSnapshot = snapshot;
  if (snapshot.timer) applySharedTimer(snapshot.timer);
  if (snapshot.game && snapshot.game !== state.game) {
    state.game = snapshot.game;
    applyGameModeUi();
  }

  const me = snapshot.peers.find(p => p.id === state.peerId);
  const opponent = snapshot.peers.find(p => p.id !== state.peerId);

  const serverOwnReady = Boolean(me?.ready);
  state.ownReady = state.readyRequestPending && state.readyRequestedValue != null
    ? Boolean(state.readyRequestedValue)
    : serverOwnReady;
  state.opponentPresent = Boolean(opponent);
  state.opponentConnected = Boolean(opponent?.connected);
  state.opponentId = opponent?.id || null;
  state.opponentName = opponent?.name || 'Adversaire';
  state.opponentReady = Boolean(opponent?.ready);

  $('lobbyOpponentName').textContent = state.opponentName;
  $('gameOpponentName').textContent = state.opponentName;

  const remoteRow = $('opponentWaitingText').closest('.player-row');
  if (!opponent) {
    $('opponentWaitingText').textContent = 'En attente…';
    remoteRow.classList.remove('ready', 'remote-ready');
    remoteRow.classList.add('waiting');
    setNetworkStatus('En attente de l’adversaire…', 'warning');
  } else if (!opponent.connected) {
    $('opponentWaitingText').textContent = 'Reconnexion…';
    remoteRow.classList.remove('remote-ready');
    remoteRow.classList.add('ready', 'waiting');
    setNetworkStatus('Adversaire en reconnexion…', 'warning');
    if (state.gameActive) setRtcStatus('Adversaire en reconnexion…', 'warning');
  } else {
    $('opponentWaitingText').textContent = opponent.ready ? 'Connecté · prêt' : 'Connecté · préparation';
    remoteRow.classList.add('ready');
    remoteRow.classList.toggle('remote-ready', opponent.ready);
    remoteRow.classList.remove('waiting');
    setNetworkStatus(opponent.ready ? 'Adversaire prêt' : 'Adversaire connecté', 'connected');
  }

  const cameraReady = Boolean(currentVideoTrack() && state.cameraEnabled);
  const waitingForOpponent = Boolean(state.ownReady || state.readyRequestPending);
  $('startGame').disabled = !opponent || !cameraReady || waitingForOpponent;
  $('startGame').classList.toggle('waiting-state', waitingForOpponent);
  $('lobbyOwnStatus').textContent = state.ownReady ? 'Prêt' : 'Préparation';

  if (!cameraReady) {
    $('startGame').textContent = 'Caméra requise';
  } else if (waitingForOpponent) {
    $('startGame').textContent = state.opponentReady ? 'Connexion à la partie…' : 'Attente de l’adversaire…';
  } else {
    $('startGame').textContent = 'Je suis prêt';
  }

  if (state.ownReady && !state.opponentReady && opponent && !state.gameEntering && !state.gameActive) {
    startReadyStatePolling();
  } else if (state.opponentReady || !state.ownReady || !opponent || state.gameEntering || state.gameActive) {
    stopReadyStatePolling(state.opponentReady ? 'opponent-ready' : 'state-change');
  }

  if(opponent && cameraReady && !state.gameActive && !state.gameEntering){
    prewarmRtcInLobby().catch(()=>{});
  }

  if(opponent && state.game==='cyberpunk'){
    prepareVision().catch(()=>{});
    if (state.gameActive) requestGigState();
  }

  if (window.TCGateMediaRecovery.shouldAutoEnterGame(state)) {
    enterNetworkGame();
  }
}

async function prewarmRtcInLobby() {
  if (state.pc || state.rtcPrewarmPending || state.gameActive || state.gameEntering) return state.pc;
  if (!state.opponentPresent || !currentVideoTrack() || !state.cameraEnabled) return null;

  state.rtcPrewarmPending = true;
  state.rtcPrewarmError = null;
  const startedAt = performance.now();
  logEvent('rtc-prewarm-start', { role: state.role });

  try {
    const pc = await ensurePeerConnection();
    state.rtcPrewarmReady = Boolean(pc);
    logEvent('rtc-prewarm-end', {
      role: state.role,
      durationMs: Math.round(performance.now() - startedAt),
      ready: state.rtcPrewarmReady
    });
    return pc;
  } catch (err) {
    state.rtcPrewarmReady = false;
    state.rtcPrewarmError = { name: err?.name || null, message: err?.message || String(err) };
    logEvent('rtc-prewarm-error', state.rtcPrewarmError);
    return null;
  } finally {
    state.rtcPrewarmPending = false;
  }
}

async function setReady(ready) {
  if (!state.roomCode || !state.peerId || state.readyRequestPending) return;

  const previousReady = state.ownReady;
  const startedAt = performance.now();
  state.readyRequestPending = true;
  state.readyRequestedValue = Boolean(ready);
  state.ownReady = Boolean(ready);
  logEvent('ready-click', { ready: Boolean(ready) });

  // Optimistic UX: the button changes immediately instead of waiting for the
  // HTTP response/SSE round-trip. A stale room-state received while the request
  // is pending cannot roll the button back.
  if (state.roomSnapshot) applyRoomState(state.roomSnapshot);

  try {
    const result = await api('/api/ready', {
      method: 'POST',
      body: { room: state.roomCode, peerId: state.peerId, ready }
    });
    state.readyRequestPending = false;
    state.readyRequestedValue = null;
    logEvent('ready-ack', {
      ready: Boolean(ready),
      durationMs: Math.round(performance.now() - startedAt)
    });

    // The API already returns the authoritative room snapshot. Apply it
    // immediately instead of waiting for the next SSE room-state event.
    if (result?.room) applyRoomState(result.room);
    else {
      state.ownReady = Boolean(ready);
      if (state.roomSnapshot) applyRoomState(state.roomSnapshot);
    }
  } catch (err) {
    state.readyRequestPending = false;
    state.readyRequestedValue = null;
    state.ownReady = previousReady;
    if (state.roomSnapshot) applyRoomState(state.roomSnapshot);
    logEvent('ready-error', {
      ready: Boolean(ready),
      durationMs: Math.round(performance.now() - startedAt),
      message: err?.message || String(err)
    });
    toast(err.message);
  }
}

async function enterNetworkGame({ recovery = false, reason = 'game-enter' } = {}) {
  if (state.gameEntering || state.gameActive) return;

  // Lock immediately: updateMediaUi() may itself refresh room state.
  state.gameEntering = true;
  stopReadyStatePolling('game-enter');
  logEvent('game-enter-start', { role: state.role });

  try {
    showScreen('game');
    $('localVideo').srcObject = state.localStream;
    updateMediaUi();
    renderGigDicePanel();
    setupDraggableGigPanel();
    if (visionEnabledForCurrentGame()) prepareVision().catch(()=>{});
    setRtcStatus('Initialisation WebRTC…', 'warning');

    if (recovery) await ensureRecoveryLocalTracksReady();

    await ensurePeerConnection();

    // Host is the single deterministic offerer.
    if (state.role === 'host') {
      await createAndSendOffer();
    }

    state.gameActive = true;
    renderSharedTimer();
    const recoveryAction = recovery ? window.TCGateMediaRecovery.recoveryAction(state.role) : null;
    if (recoveryAction === 'restart-request') {
      await sendSignal('restart-request', { reason });
    } else if (state.role === 'host' && state.pendingRtcRestartRequest) {
      state.pendingRtcRestartRequest = false;
      logEvent('rtc-restart-request-consumed', { reason, offerSent: state.offerSent });
    }
    if (recovery) scheduleRemoteRecoveryWatchdog(reason);
    requestGigState();
    logEvent('game-enter', { role: state.role });
  } catch (err) {
    logEvent('game-enter-error', {
      name: err?.name || null,
      message: err?.message || String(err)
    });
    setRtcStatus('Erreur initialisation WebRTC', 'error');
  } finally {
    state.gameEntering = false;
  }
}

async function applyVideoSenderEncoding(sender, {
  scaleResolutionDownBy = 1,
  degradationPreference = 'maintain-resolution',
  source = 'unknown',
  mode = 'native'
} = {}) {
  if (!sender?.getParameters || !sender?.setParameters) return false;
  try {
    const params = sender.getParameters() || {};
    params.degradationPreference = degradationPreference;
    if (!Array.isArray(params.encodings) || !params.encodings.length) params.encodings = [{}];

    const encoding = params.encodings[0];
    encoding.maxFramerate = 30;
    encoding.scaleResolutionDownBy = Math.max(1, Number(scaleResolutionDownBy) || 1);

    await sender.setParameters(params);

    const q = state.rtcQualityControl;
    const previousScale = q.senderScaleResolutionDownBy;
    const previousMode = q.senderAdaptiveMode;
    q.senderPolicyApplied = true;
    q.senderPolicyError = null;
    q.senderScaleResolutionDownBy = encoding.scaleResolutionDownBy;
    q.senderAdaptiveMode = mode;

    if (previousScale !== encoding.scaleResolutionDownBy || previousMode !== mode) {
      const adaptation = {
        at: new Date().toISOString(),
        source,
        fromScale: previousScale,
        toScale: encoding.scaleResolutionDownBy,
        fromMode: previousMode,
        toMode: mode,
        degradationPreference
      };
      q.senderAdaptations.push(adaptation);
      logEvent('rtc-video-sender-adaptation', adaptation);
    }

    logEvent('rtc-video-sender-policy', {
      source,
      degradationPreference,
      scaleResolutionDownBy: encoding.scaleResolutionDownBy,
      maxFramerate: encoding.maxFramerate,
      mode
    });
    return true;
  } catch (err) {
    state.rtcQualityControl.senderPolicyError = {
      name: err?.name || null,
      message: err?.message || String(err)
    };
    logEvent('rtc-video-sender-policy-error', {
      source,
      name: err?.name || null,
      message: err?.message || String(err)
    });
    return false;
  }
}

async function configureVideoSenderPolicy(sender, source='unknown') {
  // Candidate 5 keeps the sender at 1:1. Under sustained CPU pressure we now
  // lower the *camera capture itself* to 1280x720 instead of asking WebRTC to
  // scale a still-expensive 1920x1080 source after capture.
  const q = state.rtcQualityControl;
  return applyVideoSenderEncoding(sender, {
    scaleResolutionDownBy: 1,
    degradationPreference: 'maintain-resolution',
    source,
    mode: q.senderAdaptiveMode || 'native'
  });
}

function capture720Constraints(deviceId = null) {
  return {
    ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
    width: { exact: 1280 },
    height: { exact: 720 },
    frameRate: { ideal: 30, max: 30 }
  };
}

async function acquireReplacement720Track(track) {
  if (!navigator.mediaDevices?.getUserMedia) return null;
  const settings = track?.getSettings?.() || {};
  const deviceId = settings.deviceId || state.selectedCameraId || null;
  const replacementStream = await navigator.mediaDevices.getUserMedia({
    video: capture720Constraints(deviceId),
    audio: false
  });
  const replacement = replacementStream.getVideoTracks()[0] || null;
  if (!replacement) {
    replacementStream.getTracks().forEach(t => t.stop());
    return null;
  }
  replacement.enabled = track?.enabled !== false;
  return replacement;
}

async function replaceLocalVideoTrack(oldTrack, newTrack) {
  if (!newTrack || newTrack === oldTrack) return false;
  const sender = state.videoTransceiver?.sender || null;

  try {
    if (sender) await sender.replaceTrack(newTrack);

    if (!state.localStream) state.localStream = new MediaStream();
    if (oldTrack && state.localStream.getTracks().includes(oldTrack)) {
      state.localStream.removeTrack(oldTrack);
    }
    if (!state.localStream.getTracks().includes(newTrack)) {
      state.localStream.addTrack(newTrack);
    }

    $('lobbyPreview').srcObject = state.localStream;
    $('localVideo').srcObject = state.localStream;
    await Promise.allSettled([
      $('lobbyPreview').play(),
      $('localVideo').play()
    ]);

    state.selectedCameraId = newTrack.getSettings?.().deviceId || state.selectedCameraId;
    oldTrack?.stop?.();
    updateMediaUi();
    return true;
  } catch (err) {
    try { newTrack.stop(); } catch {}
    throw err;
  }
}

async function adaptLocalCaptureForCpu(video, durationMs) {
  const q = state.rtcQualityControl;
  if (q.captureAdaptiveMode === 'cpu-capture-720p' || q.captureAdaptationPending) return false;
  if (durationMs < 6000) return false;
  const now = Date.now();
  if (q.captureLastAttemptAtMs && now - q.captureLastAttemptAtMs < 15000) return false;

  let track = currentVideoTrack();
  if (!track) return false;

  const before = safeTrackSettings(track);
  const sourceWidth = Number(before?.width || video?.frameWidth || 0);
  const sourceHeight = Number(before?.height || video?.frameHeight || 0);
  if (!sourceWidth || sourceWidth <= 1280) return false;

  q.captureAdaptationPending = true;
  q.captureAdaptationError = null;
  q.captureLastAttemptAtMs = now;
  q.captureAdaptationAttempts += 1;
  let method = 'applyConstraints';
  let firstError = null;

  try {
    try {
      if (typeof track.applyConstraints !== 'function') throw new Error('applyConstraints unavailable');
      await track.applyConstraints(capture720Constraints());
    } catch (err) {
      firstError = {
        name: err?.name || null,
        message: err?.message || String(err),
        constraint: err?.constraint || null
      };
      logEvent('rtc-local-capture-constraints-error', { durationMs, before, error: firstError });

      // Some Windows/UVC drivers do not allow a live format change. In that
      // case, acquire the same camera directly in 720p and atomically swap only
      // the video track. Audio is deliberately left untouched.
      method = 'replaceTrack';
      const replacement = await acquireReplacement720Track(track);
      if (!replacement) throw err;
      await replaceLocalVideoTrack(track, replacement);
      track = replacement;
    }

    // Allow camera settings to settle before reading them back.
    await new Promise(resolve => setTimeout(resolve, 200));
    const after = safeTrackSettings(track);
    const afterWidth = Number(after?.width || 0);
    const afterHeight = Number(after?.height || 0);

    if (!afterWidth || afterWidth > 1280 || (afterHeight && afterHeight > 720)) {
      throw new Error(`Capture 720p non confirmée (${afterWidth || '?'}x${afterHeight || '?'})`);
    }

    q.captureAdaptiveMode = 'cpu-capture-720p';
    q.senderAdaptiveMode = 'cpu-capture-720p';

    await applyVideoSenderEncoding(state.videoTransceiver?.sender, {
      scaleResolutionDownBy: 1,
      degradationPreference: 'maintain-resolution',
      source: 'rtc-cpu-capture-720p',
      mode: 'cpu-capture-720p'
    });

    const adaptation = {
      at: new Date().toISOString(),
      reason: 'rtc-cpu-sustained',
      durationMs,
      method,
      before,
      after,
      firstError
    };
    q.captureAdaptations.push(adaptation);
    logEvent('rtc-local-capture-adaptation', adaptation);
    logEvent('rtc-cpu-protect-video', {
      durationMs,
      strategy: 'camera-capture-720p',
      method,
      sourceWidth,
      sourceHeight,
      targetWidth: 1280,
      targetHeight: 720,
      captureAfter: after,
      outboundFps: video?.framesPerSecond ?? null
    });
    return true;
  } catch (err) {
    q.captureAdaptationError = {
      name: err?.name || null,
      message: err?.message || String(err),
      constraint: err?.constraint || null,
      before,
      firstError
    };
    logEvent('rtc-local-capture-adaptation-error', q.captureAdaptationError);
    return false;
  } finally {
    q.captureAdaptationPending = false;
  }
}

function setVisionCpuThrottle(ms, reason='rtc-cpu') {
  const next = Math.max(0, Math.min(1000, Number(ms) || 0));
  if (state.rtcQualityControl.currentVisionThrottleMs === next) return;
  state.rtcQualityControl.currentVisionThrottleMs = next;
  window.TCGVisionEngine?.setPerformanceThrottle?.(next, reason);
  logEvent('vision-performance-throttle', { intervalMs: next, reason });
}

function closeCpuEpisode(now=Date.now(), reason='recovered') {
  const q = state.rtcQualityControl;
  if (!q.cpuEpisode) return;
  const episode = {
    ...q.cpuEpisode,
    endedAt: new Date(now).toISOString(),
    durationMs: Math.max(0, now - q.cpuEpisode.startedAtMs),
    endReason: reason
  };
  delete episode.startedAtMs;
  q.cpuEpisodes.push(episode);
  q.cpuEpisode = null;
  q.cpuSamples = 0;
  q.recoverySamples = 0;
  logEvent('rtc-quality-cpu-end', episode);
}

function updateRtcCpuQualityControl(rtcData) {
  const video = rtcData?.outbound?.find?.(x => x.kind === 'video') || null;
  const reason = video?.qualityLimitationReason || null;
  const q = state.rtcQualityControl;
  const now = Date.now();
  q.lastReason = reason;

  if (reason === 'cpu') {
    q.recoverySamples = 0;
    q.cpuSamples += 1;
    if (!q.cpuEpisode) {
      q.cpuEpisode = {
        startedAt: new Date(now).toISOString(),
        startedAtMs: now,
        startFrameWidth: video?.frameWidth ?? null,
        startFrameHeight: video?.frameHeight ?? null,
        startFramesPerSecond: video?.framesPerSecond ?? null,
        startSenderMode: q.senderAdaptiveMode
      };
      logEvent('rtc-quality-cpu-start', {
        frameWidth: video?.frameWidth ?? null,
        frameHeight: video?.frameHeight ?? null,
        framesPerSecond: video?.framesPerSecond ?? null,
        senderMode: q.senderAdaptiveMode
      });
    }

    const durationMs = now - q.cpuEpisode.startedAtMs;

    // Candidate 5: the EMEET/PC-A isolation test proved that scaling only the
    // WebRTC sender is not enough. Reduce Vision pressure first, then after
    // 6 s lower the camera capture itself to 1280x720 @ 30 fps. The adaptive
    // path never requests a capture below 720p.
    const targetThrottle =
      durationMs >= 12000 ? 1000 :
      durationMs >= 6000  ? 750 :
      durationMs >= 3000  ? 500 : 160;
    setVisionCpuThrottle(targetThrottle, 'rtc-cpu');

    if (durationMs >= 6000) {
      adaptLocalCaptureForCpu(video, durationMs).catch(err => {
        logEvent('rtc-local-capture-adaptation-dispatch-error', {
          name: err?.name || null,
          message: err?.message || String(err)
        });
      });
    }
    return;
  }

  if (q.cpuEpisode) {
    q.recoverySamples += 1;
    if (q.recoverySamples >= 3) {
      closeCpuEpisode(now, reason || 'none');
      setVisionCpuThrottle(0, 'rtc-recovered');
      // Keep the real 720p capture profile until the next manual camera restart
      // to avoid 1080p/720p oscillation once a machine has proven CPU-limited.
    }
  } else if (q.currentVisionThrottleMs && reason !== 'cpu') {
    q.recoverySamples += 1;
    if (q.recoverySamples >= 3) {
      q.recoverySamples = 0;
      setVisionCpuThrottle(0, 'rtc-recovered');
    }
  }
}

function rtcQualitySummary() {
  const q = state.rtcQualityControl;
  const now = Date.now();
  const episodes = [...q.cpuEpisodes];
  if (q.cpuEpisode) {
    const active = {
      ...q.cpuEpisode,
      endedAt: null,
      durationMs: Math.max(0, now - q.cpuEpisode.startedAtMs),
      endReason: null,
      active: true
    };
    delete active.startedAtMs;
    episodes.push(active);
  }
  return {
    senderPolicyApplied: q.senderPolicyApplied,
    senderPolicyError: q.senderPolicyError,
    degradationPreference: q.senderPolicyApplied ? 'maintain-resolution' : null,
    senderAdaptiveMode: q.senderAdaptiveMode,
    senderScaleResolutionDownBy: q.senderScaleResolutionDownBy,
    senderAdaptationPending: q.senderAdaptationPending,
    senderAdaptations: [...q.senderAdaptations],
    captureAdaptiveMode: q.captureAdaptiveMode,
    captureAdaptationPending: q.captureAdaptationPending,
    captureAdaptationError: q.captureAdaptationError,
    captureAdaptations: [...q.captureAdaptations],
    captureAdaptationAttempts: q.captureAdaptationAttempts,
    currentVisionThrottleMs: q.currentVisionThrottleMs,
    lastQualityLimitationReason: q.lastReason,
    cpuEpisodes: episodes,
    totalCpuLimitedMs: episodes.reduce((sum, e) => sum + Number(e.durationMs || 0), 0)
  };
}


function localMediaStatePayload() {
  const videoTrack = currentVideoTrack();
  const audioTrack = currentAudioTrack();
  return {
    cameraEnabled: Boolean(videoTrack && videoTrack.enabled),
    microphoneEnabled: Boolean(audioTrack && audioTrack.enabled)
  };
}

async function sendCurrentMediaState(source='local-change') {
  if (!state.roomCode || !state.peerId || !state.opponentId) return null;
  const payload = localMediaStatePayload();
  const result = await sendSignal('media-state', payload);
  logEvent('media-state-sent', { source, ...payload, delivered: result?.delivered ?? null });
  return result;
}

function cancelVisionResume(reason='cancelled') {
  state.visionResumeToken += 1;
  logEvent('vision-resume-cancelled', { reason, token: state.visionResumeToken });
}

function waitForFreshRemoteVideoFrames(video, token, frameCount = 3, timeoutMs = 3500) {
  return new Promise(resolve => {
    if (!video) return resolve(false);
    const startedAt = performance.now();
    let seen = 0;
    let settled = false;
    let lastTime = Number(video.currentTime || 0);

    const finish = ok => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(Boolean(ok));
    };

    const timeout = setTimeout(() => finish(false), timeoutMs);

    const stillValid = () =>
      token === state.visionResumeToken &&
      state.remoteMediaState.cameraEnabled !== false &&
      Boolean(state.remoteStream?.getVideoTracks?.().some(track => track.readyState === 'live'));

    if (typeof video.requestVideoFrameCallback === 'function') {
      const step = () => {
        if (settled) return;
        if (!stillValid()) return finish(false);
        video.requestVideoFrameCallback(() => {
          if (settled) return;
          if (!stillValid()) return finish(false);
          seen += 1;
          if (seen >= frameCount) return finish(true);
          if (performance.now() - startedAt >= timeoutMs) return finish(false);
          step();
        });
      };
      step();
      return;
    }

    const poll = () => {
      if (settled) return;
      if (!stillValid()) return finish(false);
      const nowTime = Number(video.currentTime || 0);
      if (video.readyState >= 2 && video.videoWidth > 0 && nowTime > lastTime + 0.001) {
        lastTime = nowTime;
        seen += 1;
        if (seen >= frameCount) return finish(true);
      }
      if (performance.now() - startedAt >= timeoutMs) return finish(false);
      setTimeout(poll, 90);
    };
    poll();
  });
}

async function resumeVisionAfterRemoteCamera() {
  if (!visionEnabledForCurrentGame()) return false;
  const token = ++state.visionResumeToken;
  const video = $('remoteVideo');

  window.TCGVisionEngine?.setInputPaused?.(true, 'remote-camera-recovering');
  setVisionStatus('Vision : reprise caméra…', 'warning');
  logEvent('vision-resume-start', { token });

  const fresh = await waitForFreshRemoteVideoFrames(video, token, 3, 3500);
  if (token !== state.visionResumeToken || state.remoteMediaState.cameraEnabled === false) return false;

  if (!fresh) {
    setVisionStatus('Vision : attente du flux caméra', 'warning');
    logEvent('vision-resume-timeout', { token });
    return false;
  }

  try {
    if (!state.visionAttachedStreamId && state.remoteStream?.getVideoTracks?.().length) {
      await attachVisionToRemoteStream(state.remoteStream);
    } else {
      window.TCGVisionEngine?.setInputPaused?.(false, 'remote-camera-stable');
      await window.TCGVisionCalibration?.start?.(video, 'remote-camera-resume');
      setVisionStatus('Vision : active', 'good');
    }
    logEvent('vision-resume-success', {
      token,
      width: Number(video?.videoWidth || 0),
      height: Number(video?.videoHeight || 0)
    });
    return true;
  } catch (err) {
    setVisionStatus('Vision : reprise incomplète', 'warning');
    logEvent('vision-resume-error', {
      token,
      name: err?.name || null,
      message: err?.message || String(err)
    });
    return false;
  }
}

function applyRemoteMediaState(payload = {}) {
  const previous = { ...state.remoteMediaState };
  const next = {
    cameraEnabled: typeof payload.cameraEnabled === 'boolean' ? payload.cameraEnabled : previous.cameraEnabled,
    microphoneEnabled: typeof payload.microphoneEnabled === 'boolean' ? payload.microphoneEnabled : previous.microphoneEnabled,
    receivedAt: new Date().toISOString()
  };
  state.remoteMediaState = next;

  const cameraChanged = previous.cameraEnabled !== next.cameraEnabled;
  if (cameraChanged && typeof next.cameraEnabled === 'boolean') {
    if (!next.cameraEnabled) {
      cancelVisionResume('remote-camera-off');
      window.TCGVisionEngine?.setInputPaused?.(true, 'remote-camera-off');
      window.TCGVisionCalibration?.stop?.();
      setVisionStatus('Vision : pause · caméra adverse coupée', 'warning');
      logEvent('vision-paused-remote-camera-off');
    } else if (previous.cameraEnabled === false) {
      resumeVisionAfterRemoteCamera().catch(() => {});
    }
  }

  logEvent('remote-media-state', {
    cameraEnabled: next.cameraEnabled,
    microphoneEnabled: next.microphoneEnabled,
    cameraChanged
  });
}

function clearRtcRecoveryTimer() {
  if (state.rtcRecoveryTimer) clearTimeout(state.rtcRecoveryTimer);
  state.rtcRecoveryTimer = null;
}

function clearRemoteRecoveryWatchdog() {
  clearTimeout(state.remoteRecoveryWatchdogTimer);
  state.remoteRecoveryWatchdogTimer = null;
}

function hasLiveRemoteMedia() {
  return Boolean(state.remoteStream?.getTracks?.().some(track => track.readyState === 'live'));
}

function localRtcSendersReady() {
  return Boolean(window.TCGateMediaRecovery?.localSendersReady?.({
    videoSender: state.videoTransceiver?.sender,
    audioSender: state.audioTransceiver?.sender,
    videoTrack: currentVideoTrack(),
    audioTrack: currentAudioTrack()
  }));
}

function mainRtcRecoveryHealthy() {
  return Boolean(window.TCGateMediaRecovery?.mainRtcRecoveryHealthy?.({
    pc: state.pc,
    remoteStream: state.remoteStream,
    videoSender: state.videoTransceiver?.sender,
    audioSender: state.audioTransceiver?.sender,
    videoTrack: currentVideoTrack(),
    audioTrack: currentAudioTrack()
  }));
}

function markRemoteRecoverySuccess(source = 'remote-track') {
  if (!state.remoteRecoveryWatchdogTimer && !state.remoteRecoveryRetryUsed) return;
  if (!mainRtcRecoveryHealthy()) return;
  clearRemoteRecoveryWatchdog();
  logEvent('remote-recovery-success', { source, role: state.role });
  state.remoteRecoveryRetryUsed = false;
  state.mainRtcRecoveryActive = false;
}

function scheduleRemoteRecoveryWatchdog(reason = 'recovery') {
  clearRemoteRecoveryWatchdog();
  state.remoteRecoveryRetryUsed = false;
  logEvent('remote-recovery-start', { reason, role: state.role });
  state.remoteRecoveryWatchdogTimer = setTimeout(async () => {
    if (!state.gameActive) {
      state.remoteRecoveryWatchdogTimer = null;
      return;
    }
    if (mainRtcRecoveryHealthy()) return markRemoteRecoverySuccess('watchdog-check');
    state.remoteRecoveryWatchdogTimer = null;
    state.remoteRecoveryRetryUsed = true;
    logEvent('remote-recovery-retry', { reason, role: state.role, connectionState: state.pc?.connectionState || null });
    await attemptRtcRecovery(`remote-watchdog:${reason}`);
    state.remoteRecoveryWatchdogTimer = setTimeout(() => {
      state.remoteRecoveryWatchdogTimer = null;
      if (mainRtcRecoveryHealthy()) return markRemoteRecoverySuccess('watchdog-retry');
      logEvent('remote-recovery-failed', { reason, role: state.role, connectionState: state.pc?.connectionState || null });
      state.remoteRecoveryRetryUsed = false;
    }, 7000);
  }, 7000);
}

function prepareMainRtcRecovery(reason) {
  clearRemoteRecoveryWatchdog();
  closePeerConnection(`prepare-${reason}`);
  state.gameActive = false;
  state.pendingRtcRestartRequest = false;
  state.remoteRecoveryRetryUsed = false;
  state.mainRtcRecoveryActive = true;
  logEvent('remote-recovery-prepared', { reason, role: state.role });
}

function scheduleRtcRecovery(reason = 'disconnected') {
  if (!state.gameActive || state.rtcRecoveryTimer || state.rtcRecoveryInFlight) return;
  state.rtcRecoveryTimer = setTimeout(() => {
    state.rtcRecoveryTimer = null;
    attemptRtcRecovery(reason).catch(() => {});
  }, reason === 'failed' ? 300 : 5000);
  logEvent('rtc-recovery-scheduled', { reason });
}

async function attemptRtcRecovery(reason = 'unknown') {
  if (!state.pc || state.rtcRecoveryInFlight || !state.gameActive) return;
  state.rtcRecoveryInFlight = true;
  logEvent('rtc-recovery-start', { reason, role: state.role });
  try {
    if (state.role === 'host') {
      try { state.pc.restartIce?.(); } catch {}
      state.offerSent = false;
      state.offerInFlight = false;
      await createAndSendOffer({ iceRestart: true });
    } else {
      await sendSignal('restart-request', { reason });
    }
  } catch (err) {
    logEvent('rtc-recovery-error', { reason, message: err?.message || String(err) });
  } finally {
    state.rtcRecoveryInFlight = false;
  }
}


function remoteIceUfrags(pc) {
  const sdp = String(pc?.remoteDescription?.sdp || '');
  return new Set([...sdp.matchAll(/^a=ice-ufrag:(.+)$/gm)].map(match => String(match[1] || '').trim()).filter(Boolean));
}

function candidateMatchesRemoteDescription(pc, candidate) {
  const ufrags = remoteIceUfrags(pc);
  if (!ufrags.size || !candidate?.usernameFragment) return true;
  return ufrags.has(candidate.usernameFragment);
}

async function waitForLiveLocalTrack(kind, timeoutMs = 7000) {
  const getter = kind === 'video' ? currentVideoTrack : currentAudioTrack;
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const track = getter();
    if (track?.readyState === 'live') return track;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Local ${kind} track unavailable during recovery`);
}

async function ensureRecoveryLocalTracksReady() {
  if (!currentAudioTrack()) {
    const prefs = readMediaPreferences();
    await startPcMicrophoneOnly(prefs.microphoneId);
  }
  if (!currentVideoTrack() && state.videoSource === 'webcam') {
    const prefs = readMediaPreferences();
    const cameraId = state.selectedCameraId || prefs.cameraId;
    if (cameraId) await replaceMediaKind('video', cameraId, { reason: 'rtc-recovery-webcam', silent: true });
  }
  await Promise.all([waitForLiveLocalTrack('video'), waitForLiveLocalTrack('audio')]);
  logEvent('rtc-local-media-ready', { source: state.videoSource });
}

function logRtcLocalTrackBound(data) {
  logEvent('rtc-local-track-bound', data);
}

async function bindRtcLocalTracks({ strict = false, source = 'rtc-bind' } = {}) {
  const videoTrack = currentVideoTrack();
  const audioTrack = currentAudioTrack();
  if (strict) {
    await window.TCGateMediaRecovery.bindLocalTracks({
      videoSender: state.videoTransceiver?.sender,
      audioSender: state.audioTransceiver?.sender,
      videoTrack,
      audioTrack,
      source: state.videoSource,
      generation: state.pc?.__tcgateGeneration || null,
      onBound: logRtcLocalTrackBound
    });
  } else {
    if (state.videoTransceiver?.sender) await state.videoTransceiver.sender.replaceTrack(videoTrack);
    if (state.audioTransceiver?.sender) await state.audioTransceiver.sender.replaceTrack(audioTrack);
  }
  if (state.videoTransceiver?.sender) await configureVideoSenderPolicy(state.videoTransceiver.sender, source);
  return localRtcSendersReady();
}

async function playRemoteVideoForPeer(pc, attempt = 0) {
  if (!pc || pc !== state.pc) return false;
  const video = $('remoteVideo');
  if (!video?.srcObject || !video.srcObject.getVideoTracks?.().length) return false;
  if (state.remotePlayPending) return false;

  state.remotePlayPending = true;
  try {
    await video.play();
    if (pc !== state.pc) return false;
    state.remoteVideoStarted = true;
    clearTimeout(state.remoteVideoPlaybackRetryTimer);
    state.remoteVideoPlaybackRetryTimer = null;
    return true;
  } catch (err) {
    logEvent('remote-video-play-error', {
      name: err?.name || null,
      message: err?.message || null,
      attempt
    });
    if (pc === state.pc && attempt < 2 && (err?.name === 'AbortError' || err?.name === 'NotAllowedError')) {
      clearTimeout(state.remoteVideoPlaybackRetryTimer);
      state.remoteVideoPlaybackRetryTimer = setTimeout(() => {
        playRemoteVideoForPeer(pc, attempt + 1).catch(() => {});
      }, 160 * (attempt + 1));
    }
    return false;
  } finally {
    state.remotePlayPending = false;
  }
}

async function ensurePeerConnection() {
  if (state.rtcPeerCreatePromise) return state.rtcPeerCreatePromise;
  if (state.pc) return state.pc;

  const createEpoch = state.rtcCreateEpoch;
  const createPromise = (async () => {
    const rtcConfig = await loadRtcConfig();
    if (createEpoch !== state.rtcCreateEpoch) throw new Error('RTC creation superseded');
    if (state.pc) return state.pc;

    let pc = null;
    let generation = null;
    try {
      pc = new RTCPeerConnection(rtcConfig);
      generation = ++state.rtcPeerGeneration;
      pc.__tcgateGeneration = generation;
      state.pc = pc;
      state.rtcStarted = true;

    // Only the deterministic offerer creates m-lines before the offer.
    // The answerer lets setRemoteDescription(offer) create matching
    // transceivers, then attaches its local tracks to those transceivers.
    if (state.role === 'host') {
      state.videoTransceiver = pc.addTransceiver('video', { direction: 'sendrecv' });
      state.audioTransceiver = pc.addTransceiver('audio', { direction: 'sendrecv' });
      await bindRtcLocalTracks({ strict: state.mainRtcRecoveryActive, source: 'host-create' });
    }

    if (createEpoch !== state.rtcCreateEpoch || state.pc !== pc) {
      throw new Error('RTC creation superseded');
    }

    pc.ontrack = async event => {
      if (pc !== state.pc) {
        logEvent('rtc-stale-track-ignored', { generation, kind: event.track?.kind || null });
        return;
      }

      let stream = event.streams?.[0] || null;

      if (!stream) {
        if (!state.remoteStream) state.remoteStream = new MediaStream();
        if (!state.remoteStream.getTracks().some(t => t.id === event.track.id)) {
          state.remoteStream.addTrack(event.track);
        }
      } else {
        state.remoteStream = stream;
      }

      if (!state.remoteStream || pc !== state.pc) return;

      if ($('remoteVideo').srcObject !== state.remoteStream) {
        $('remoteVideo').srcObject = state.remoteStream;
        state.remoteVideoStarted = false;
      }
      const hasRemoteVideo = Boolean(state.remoteStream.getVideoTracks().length);
      $('remoteVideoPlaceholder').classList.toggle('hidden', hasRemoteVideo);

      if (hasRemoteVideo && !state.remoteVideoStarted) {
        queueMicrotask(() => playRemoteVideoForPeer(pc).catch(() => {}));
      }

      logEvent('rtc-track', {
        generation,
        kind: event.track.kind,
        streamTracks: state.remoteStream.getTracks().map(t => t.kind)
      });

      if (hasRemoteVideo) {
        markRemoteRecoverySuccess('ontrack');
        attachVisionToRemoteStream(state.remoteStream).catch(()=>{});
      }
    };

    pc.onicecandidate = event => {
      if (pc !== state.pc) return;
      if (!event.candidate) {
        logEvent('rtc-ice-complete', { generation });
        return;
      }
      sendSignal('candidate', event.candidate.toJSON?.() || event.candidate);
    };

    pc.onconnectionstatechange = () => {
      if (pc !== state.pc) return;
      const cs = pc.connectionState;
      if (cs === 'connected') {
        clearRtcRecoveryTimer();
        setRtcStatus('WebRTC connecté', 'connected');
        configureVideoSenderPolicy(state.videoTransceiver?.sender, 'connected').catch(()=>{});
        sendCurrentMediaState('rtc-connected').catch(()=>{});
        markRemoteRecoverySuccess('connection-state');
      } else if (cs === 'connecting' || cs === 'new') {
        setRtcStatus('Connexion WebRTC…', 'warning');
      } else if (cs === 'disconnected') {
        setRtcStatus('Connexion interrompue · tentative de reprise…', 'warning');
        scheduleRtcRecovery('disconnected');
      } else if (cs === 'failed') {
        setRtcStatus('Reconnexion WebRTC…', 'warning');
        scheduleRtcRecovery('failed');
      } else if (cs === 'closed') {
        clearRtcRecoveryTimer();
        setRtcStatus('WebRTC fermé');
      }

      logEvent('rtc-connection-state', { state: cs, generation });
      snapshotRtcMetrics().catch(() => {});
    };

    pc.oniceconnectionstatechange = () => {
      if (pc !== state.pc) return;
      logEvent('rtc-ice-state', { state: pc.iceConnectionState, generation });
    };

    pc.onsignalingstatechange = () => {
      if (pc !== state.pc) return;
      logEvent('rtc-signaling-state', { state: pc.signalingState, generation });
    };

    clearInterval(state.rtcStatsTimer);
    state.rtcStatsTimer = setInterval(() => {
      if (pc === state.pc) snapshotRtcMetrics().catch(() => {});
    }, 2000);

    logEvent('rtc-created', {
      role: state.role,
      generation,
      recoveryEpoch: state.recoveryEpoch,
      precreatedTransceivers: state.role === 'host' ? ['video', 'audio'] : []
    });

      return pc;
    } catch (err) {
      window.TCGateMediaRecovery.disposePeerConnection(pc);
      if (pc && state.pc === pc) {
        state.pc = null;
        state.videoTransceiver = null;
        state.audioTransceiver = null;
        state.rtcStarted = false;
        state.pendingIce = [];
        state.offerInFlight = false;
        state.offerSent = false;
        clearInterval(state.rtcStatsTimer);
        state.rtcStatsTimer = null;
        state.rtcCreateEpoch += 1;
      }
      logEvent('rtc-create-rollback', {
        generation,
        name: err?.name || null,
        message: err?.message || String(err)
      });
      throw err;
    }
  })();

  state.rtcPeerCreatePromise = createPromise;
  try {
    return await createPromise;
  } finally {
    if (state.rtcPeerCreatePromise === createPromise) state.rtcPeerCreatePromise = null;
  }
}

async function bindAnswererTracks(pc) {
  if (state.role !== 'guest') return;

  const transceivers = pc.getTransceivers();
  state.videoTransceiver =
    transceivers.find(t => t.receiver?.track?.kind === 'video') || null;
  state.audioTransceiver =
    transceivers.find(t => t.receiver?.track?.kind === 'audio') || null;

  if (state.videoTransceiver) {
    state.videoTransceiver.direction = 'sendrecv';
  }

  if (state.audioTransceiver) {
    state.audioTransceiver.direction = 'sendrecv';
  }

  const senderReady = await bindRtcLocalTracks({ strict: state.mainRtcRecoveryActive, source: 'guest-bind' });

  logEvent('rtc-answerer-tracks-bound', {
    video: Boolean(state.videoTransceiver?.sender?.track),
    audio: Boolean(state.audioTransceiver?.sender?.track),
    senderReady,
    transceivers: transceivers.map(t => ({
      kind: t.receiver?.track?.kind || t.sender?.track?.kind || null,
      direction: t.direction,
      currentDirection: t.currentDirection || null,
      mid: t.mid
    }))
  });
}

async function sendSignal(type, payload) {
  if (!state.roomCode || !state.peerId) return;
  try {
    const result = await api('/api/signal', {
      method: 'POST',
      body: {
        room: state.roomCode,
        from: state.peerId,
        to: state.opponentId,
        type,
        payload
      }
    });
    if (type !== 'candidate') logEvent('signal-sent', { type, delivered: result.delivered });
    return result;
  } catch (err) {
    logEvent('signal-send-error', { type, message: err.message });
    return null;
  }
}

const offerDeliveryRetry = window.TCGateOfferDeliveryRetry.createController({
  maxAttempts: 3,
  retryDelaysMs: [300, 900]
});

function cancelOfferDeliveryRetry(reason = 'cancelled') {
  if (offerDeliveryRetry.isActive()) logEvent('rtc-offer-retry-cancelled', { reason });
  offerDeliveryRetry.cancel();
}

async function rebuildRtcAfterOfferDeliveryFailure(pc, generation) {
  if (pc !== state.pc || generation !== state.rtcPeerGeneration) return;
  if (state.offerDeliveryRebuilds >= 1) {
    logEvent('rtc-offer-delivery-failed', { generation, rebuilds: state.offerDeliveryRebuilds });
    setRtcStatus('Signal WebRTC indisponible', 'error');
    return;
  }
  state.offerDeliveryRebuilds += 1;
  logEvent('rtc-offer-generation-rebuild', { generation, rebuilds: state.offerDeliveryRebuilds });
  closePeerConnection('offer-delivery-exhausted');
  await ensurePeerConnection();
  await createAndSendOffer();
}

async function deliverLocalOffer(pc) {
  const generation = pc.__tcgateGeneration;
  const createEpoch = state.rtcCreateEpoch;
  const description = pc.localDescription;
  state.offerSent = false;
  await offerDeliveryRetry.start({
    description,
    isActive: () => pc === state.pc && generation === state.rtcPeerGeneration && createEpoch === state.rtcCreateEpoch &&
      pc.localDescription?.type === description?.type && pc.localDescription?.sdp === description?.sdp,
    send: current => sendSignal('offer', current),
    onDelivered: (result, attempts) => {
      state.offerSent = true;
      state.offerDeliveryRebuilds = 0;
      logEvent('rtc-offer-delivered', { generation, attempts, delivered: result.delivered });
    },
    onFailed: (result, attempts) => {
      state.offerSent = false;
      logEvent('rtc-offer-delivery-retry', { generation, attempts, delivered: result?.delivered ?? null });
    },
    onExhausted: attempts => {
      state.offerSent = false;
      rebuildRtcAfterOfferDeliveryFailure(pc, generation).catch(err => {
        logEvent('rtc-offer-rebuild-error', { generation, attempts, message: err?.message || String(err) });
      });
    },
    onError: err => logEvent('rtc-offer-retry-error', { generation, message: err?.message || String(err) })
  });
}

async function createAndSendOffer(options = {}) {
  if (state.role !== 'host') return;
  if (state.offerInFlight || state.offerSent) return;

  const pc = await ensurePeerConnection();
  if (pc.signalingState !== 'stable') {
    logEvent('rtc-offer-skipped', { signalingState: pc.signalingState });
    return;
  }

  state.offerInFlight = true;
  try {
    const offer = await pc.createOffer(options);
    await pc.setLocalDescription(offer);
    logEvent('rtc-offer-created', { generation: pc.__tcgateGeneration || null });
    await deliverLocalOffer(pc);
  } catch (err) {
    logEvent('rtc-offer-error', {
      name: err?.name || null,
      message: err?.message || String(err)
    });
    setRtcStatus('Erreur offre WebRTC', 'error');
  } finally {
    state.offerInFlight = false;
  }
}

async function handleSignal(signal) {
  logEvent('signal-received', { type: signal.type });

  if (signal.type === 'media-state') {
    applyRemoteMediaState(signal.payload || {});
    return;
  }

  if (signal.type === 'gig-state') {
    const payload = signal.payload || {};
    if (payload.request === true) {
      if (state.role === 'host') sendGigState('request-response').catch(()=>{});
    } else {
      applyRemoteGigState(payload);
    }
    return;
  }

  if (signal.type === 'restart-request') {
    logEvent('rtc-restart-request-received', { fromRole: signal.fromRole || null });
    if (state.role === 'host' && !state.gameActive) {
      state.pendingRtcRestartRequest = true;
      logEvent('rtc-restart-request-pending', { gameEntering: state.gameEntering });
    } else if (state.role === 'host') {
      const pc = await ensurePeerConnection();
      try { pc.restartIce?.(); } catch {}
      state.offerSent = false;
      state.offerInFlight = false;
      await createAndSendOffer({ iceRestart: true });
    }
    return;
  }

  if (signal.type === 'candidate') {
    try {
      const candidate = new RTCIceCandidate(signal.payload);
      const pc = state.pc;
      if (!pc || !pc.remoteDescription) {
        state.pendingIce.push(candidate);
        if (state.pendingIce.length > 128) state.pendingIce.splice(0, state.pendingIce.length - 128);
        logEvent('rtc-candidate-buffered', {
          reason: !pc ? 'peer-not-created' : 'remote-description-missing',
          usernameFragment: candidate.usernameFragment || null,
          pending: state.pendingIce.length
        });
        return;
      }
      if (!candidateMatchesRemoteDescription(pc, candidate)) {
        logEvent('rtc-candidate-stale-ignored', {
          usernameFragment: candidate.usernameFragment || null,
          generation: pc.__tcgateGeneration || null
        });
        return;
      }
      await pc.addIceCandidate(candidate);
    } catch (err) {
      logEvent('rtc-candidate-error', { message: err?.message || String(err) });
    }
    return;
  }

  const pc = await ensurePeerConnection();
  if (pc !== state.pc) {
    logEvent('signal-ignored', { type: signal.type, reason: 'stale-peer-generation' });
    return;
  }

  try {
    if (signal.type === 'offer') {
      if (state.role !== 'guest') {
        logEvent('signal-ignored', { type: 'offer', reason: 'not-answerer' });
        return;
      }

      const sdp = signal.payload?.sdp || null;
      if (sdp && sdp === state.lastRemoteOfferSdp) {
        logEvent('signal-ignored', { type: 'offer', reason: 'duplicate' });
        return;
      }

      if (pc.signalingState !== 'stable') {
        logEvent('signal-ignored', {
          type: 'offer',
          reason: 'signaling-not-stable',
          signalingState: pc.signalingState
        });
        return;
      }

      await pc.setRemoteDescription(new RTCSessionDescription(signal.payload));
      state.lastRemoteOfferSdp = sdp;

      // The remote offer has now created the exact m-lines on Chrome/Firefox.
      // Attach local camera/mic to those existing transceivers before answering.
      await bindAnswererTracks(pc);
      await flushPendingIce(pc);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await sendSignal('answer', pc.localDescription);
      logEvent('rtc-answer-created');
      return;
    }

    if (signal.type === 'answer') {
      if (state.role !== 'host') {
        logEvent('signal-ignored', { type: 'answer', reason: 'not-offerer' });
        return;
      }

      const sdp = signal.payload?.sdp || null;
      if (sdp && sdp === state.lastRemoteAnswerSdp) {
        logEvent('signal-ignored', { type: 'answer', reason: 'duplicate' });
        return;
      }

      if (pc.signalingState !== 'have-local-offer') {
        logEvent('signal-ignored', {
          type: 'answer',
          reason: 'unexpected-state',
          signalingState: pc.signalingState
        });
        return;
      }

      await pc.setRemoteDescription(new RTCSessionDescription(signal.payload));
      cancelOfferDeliveryRetry('answer-applied');
      state.offerSent = true;
      state.offerDeliveryRebuilds = 0;
      state.lastRemoteAnswerSdp = sdp;
      await flushPendingIce(pc);
      logEvent('rtc-answer-applied');
      return;
    }

  } catch (err) {
    logEvent('signal-handle-error', {
      type: signal.type,
      name: err?.name || null,
      message: err?.message || String(err)
    });
    setRtcStatus('Erreur signal WebRTC', 'error');
  }
}

async function flushPendingIce(pc = state.pc) {
  if (!pc?.remoteDescription || pc !== state.pc) return;
  while (state.pendingIce.length && pc === state.pc) {
    const candidate = state.pendingIce.shift();
    if (!candidateMatchesRemoteDescription(pc, candidate)) {
      logEvent('rtc-candidate-stale-ignored', {
        usernameFragment: candidate?.usernameFragment || null,
        generation: pc.__tcgateGeneration || null,
        source: 'pending'
      });
      continue;
    }
    try { await pc.addIceCandidate(candidate); }
    catch (err) { logEvent('rtc-candidate-error', { message: err.message }); }
  }
}

function closePeerConnection(reason = 'manual') {
  cancelOfferDeliveryRetry(`peer-close:${reason}`);
  state.rtcCreateEpoch += 1;
  state.rtcPeerCreatePromise = null;
  clearRemoteRecoveryWatchdog();
  clearTimeout(state.remoteVideoPlaybackRetryTimer);
  state.remoteVideoPlaybackRetryTimer = null;

  const pc = state.pc;
  if (pc) {
    snapshotRtcMetrics(pc).catch(() => {});
    try {
      window.TCGateMediaRecovery.disposePeerConnection(pc);
    } catch {}
  }

  clearInterval(state.rtcStatsTimer);
  state.rtcStatsTimer = null;

  state.pc = null;
  state.videoTransceiver = null;
  state.audioTransceiver = null;
  state.rtcPrewarmPending = false;
  state.rtcPrewarmReady = false;
  state.rtcPrewarmError = null;
  state.pendingIce = [];
  state.rtcStarted = false;
  state.remoteStream = null;
  state.remoteVideoStarted = false;
  state.remotePlayPending = false;
  detachVision();
  state.offerInFlight = false;
  state.offerSent = false;
  state.lastRemoteOfferSdp = null;
  state.lastRemoteAnswerSdp = null;
  $('remoteVideo').srcObject = null;
  $('remoteVideoPlaceholder').classList.remove('hidden');
  setRtcStatus('WebRTC fermé');
  logEvent('rtc-closed', { reason });
}

async function leaveRoom() {
  stopReadyStatePolling('leave-room');
  const room = state.roomCode;
  const peerId = state.peerId;

  state.eventSource?.close();
  state.eventSource = null;
  closePeerConnection('leave-room');

  if (room && peerId && state.authToken) {
    await api('/api/leave', {
      method: 'POST',
      body: { room, peerId }
    }).catch(() => {});
  }

  clearTimeout(state.sseReconnectTimer);
  state.sseReconnectTimer = null;
  clearTimeout(state.rtcRecoveryTimer);
  state.rtcRecoveryTimer = null;
  clearSavedRoomSession();
  hidePersistentRecoveryCard();
  state.roomCode = null;
  state.peerId = null;
  state.authToken = null;
  state.role = null;
  state.opponentId = null;
  state.opponentPresent = false;
  state.opponentConnected = false;
  state.ownReady = false;
  state.opponentReady = false;
  state.roomSnapshot = null;
  state.rtcConfig = null;
  state.rtcConfigKey = null;
  state.rtcConfigLoading = null;
  state.turnStatus = { configured: false, available: false, provider: null, policy: 'all', expiresAt: null, reason: 'not-loaded' };
  $('roomCodeInput').value = '';
  state.gameEntering = false;
  state.gameActive = false;
  state.gigDice = createGigDiceState();
  state.dieDrag = null;
  state.lastMovedDieId = null;
  state.localPreviewVisible = true;
  state.offerInFlight = false;
  state.offerSent = false;
  history.replaceState({}, '', location.pathname);
  logEvent('room-left');
}

async function setCameraEnabled(enabled) {
  const track = currentVideoTrack();
  if (!track) {
    if (state.gameActive) await openGameDeviceMenu('Aucune caméra active · choisissez une caméra.');
    toast('Aucune caméra active.');
    return;
  }
  track.enabled = enabled;
  updateMediaUi();
  logEvent('camera-toggle', { enabled });
  sendCurrentMediaState('camera-toggle').catch(()=>{});

  if (!enabled && state.ownReady && screens.lobby.classList.contains('active')) {
    await setReady(false).catch(() => {});
  }

  toast(enabled ? 'Caméra activée' : 'Caméra coupée');
}

async function setMicEnabled(enabled) {
  const track = currentAudioTrack();
  if (!track) {
    if (state.gameActive) await openGameDeviceMenu('Aucun micro actif · choisissez un micro.');
    toast('Aucun micro actif.');
    return;
  }
  track.enabled = enabled;
  updateMediaUi();
  logEvent('microphone-toggle', { enabled });
  sendCurrentMediaState('microphone-toggle').catch(()=>{});
  toast(enabled ? 'Micro activé' : 'Micro coupé');
}

/* ---------- HD card UX simulation ---------- */

function toggleDemoCard(force) {
  state.demoCardVisible = typeof force === 'boolean' ? force : !state.demoCardVisible;
  $('demoCard').classList.toggle('hidden', !state.demoCardVisible);
  $('cardPreview').querySelector('.card-placeholder').classList.toggle('hidden', state.demoCardVisible);
  $('cardPreview').classList.toggle('empty', !state.demoCardVisible);
  $('fullscreenCardPreview').classList.toggle('hidden', !state.demoCardVisible);

  if (!state.demoCardVisible) $('fullscreenCardPreview').classList.remove('expanded');

  $('demoHoverCard').textContent = state.demoCardVisible
    ? 'Retirer la carte simulée'
    : 'Simuler une carte survolée';

  logEvent('demo-card', { visible: state.demoCardVisible });
}

function openCardModal() {
  const card=state.currentIdentifiedCard;
  if(!card?.imageUrl) return toast('Aucune carte identifiée.');

  $('modalCardImage').src=card.imageUrl;
  $('modalCardImage').alt=card.name || 'Carte identifiée';
  $('modalCardName').textContent=card.name || '';
  $('cardModal').classList.remove('hidden');
  logEvent('identified-card-modal-open',{name:card.name,image:card.image});
}

/* ---------- Complete alpha report ---------- */

async function snapshotRtcMetrics(pc = state.pc) {
  if (!pc) return state.lastRtcMetrics;

  try {
    const report = await pc.getStats();
    const statsById = new Map();
    report.forEach(stat => statsById.set(stat.id, stat));

    const data = {
      available: true,
      capturedAt: new Date().toISOString(),
      connectionState: pc.connectionState,
      iceConnectionState: pc.iceConnectionState,
      signalingState: pc.signalingState,
      inbound: [],
      outbound: [],
      candidatePair: null,
      route: null
    };

    report.forEach(stat => {
      if (stat.type === 'inbound-rtp' && !stat.isRemote) {
        data.inbound.push({
          kind: stat.kind || stat.mediaType || null,
          ssrc: stat.ssrc ?? null,
          packetsReceived: stat.packetsReceived ?? null,
          packetsLost: stat.packetsLost ?? null,
          jitter: stat.jitter ?? null,
          bytesReceived: stat.bytesReceived ?? null,
          framesDecoded: stat.framesDecoded ?? null,
          framesDropped: stat.framesDropped ?? null,
          framesPerSecond: stat.framesPerSecond ?? null,
          frameWidth: stat.frameWidth ?? null,
          frameHeight: stat.frameHeight ?? null,
          jitterBufferDelay: stat.jitterBufferDelay ?? null,
          jitterBufferTargetDelay: stat.jitterBufferTargetDelay ?? null,
          jitterBufferMinimumDelay: stat.jitterBufferMinimumDelay ?? null,
          jitterBufferEmittedCount: stat.jitterBufferEmittedCount ?? null,
          jitterBufferDelayPerFrame: Number(stat.jitterBufferEmittedCount) > 0
            ? Number(stat.jitterBufferDelay || 0) / Number(stat.jitterBufferEmittedCount)
            : null,
          totalDecodeTime: stat.totalDecodeTime ?? null,
          totalProcessingDelay: stat.totalProcessingDelay ?? null,
          estimatedPlayoutTimestamp: stat.estimatedPlayoutTimestamp ?? null
        });
      }

      if (stat.type === 'outbound-rtp' && !stat.isRemote) {
        data.outbound.push({
          kind: stat.kind || stat.mediaType || null,
          ssrc: stat.ssrc ?? null,
          packetsSent: stat.packetsSent ?? null,
          bytesSent: stat.bytesSent ?? null,
          framesEncoded: stat.framesEncoded ?? null,
          framesPerSecond: stat.framesPerSecond ?? null,
          frameWidth: stat.frameWidth ?? null,
          frameHeight: stat.frameHeight ?? null,
          qualityLimitationReason: stat.qualityLimitationReason ?? null,
          qualityLimitationDurations: stat.qualityLimitationDurations ? { ...stat.qualityLimitationDurations } : null,
          qualityLimitationResolutionChanges: stat.qualityLimitationResolutionChanges ?? null,
          totalEncodeTime: stat.totalEncodeTime ?? null,
          framesSent: stat.framesSent ?? null
        });
      }

      if (stat.type === 'candidate-pair' && stat.state === 'succeeded' && stat.nominated) {
        const local = statsById.get(stat.localCandidateId);
        const remote = statsById.get(stat.remoteCandidateId);

        data.candidatePair = {
          currentRoundTripTime: stat.currentRoundTripTime ?? null,
          availableOutgoingBitrate: stat.availableOutgoingBitrate ?? null,
          availableIncomingBitrate: stat.availableIncomingBitrate ?? null,
          bytesSent: stat.bytesSent ?? null,
          bytesReceived: stat.bytesReceived ?? null
        };

        // Deliberately exclude candidate addresses/IPs from the report.
        data.route = {
          localCandidateType: local?.candidateType || null,
          remoteCandidateType: remote?.candidateType || null,
          localProtocol: local?.protocol || null,
          remoteProtocol: remote?.protocol || null,
          localNetworkType: local?.networkType || null,
          remoteNetworkType: remote?.networkType || null,
          relayProtocol: local?.relayProtocol || remote?.relayProtocol || null,
          usingRelay: local?.candidateType === 'relay' || remote?.candidateType === 'relay'
        };
      }
    });

    const previous = state.lastRtcMetrics;
    const elapsedSeconds = previous?.capturedAt
      ? (Date.parse(data.capturedAt) - Date.parse(previous.capturedAt)) / 1000
      : 0;
    if (elapsedSeconds > 0) {
      const addBitrate = (current, prior, bytesKey) => {
        for (const item of current) {
          const prev = prior?.find(p => p.kind === item.kind && (item.ssrc == null || p.ssrc === item.ssrc))
            || prior?.find(p => p.kind === item.kind);
          const nowBytes = Number(item[bytesKey]);
          const prevBytes = Number(prev?.[bytesKey]);
          item.bitrateKbps = Number.isFinite(nowBytes) && Number.isFinite(prevBytes) && nowBytes >= prevBytes
            ? Math.round(((nowBytes - prevBytes) * 8 / elapsedSeconds) / 1000)
            : null;
        }
      };
      addBitrate(data.inbound, previous?.inbound, 'bytesReceived');
      addBitrate(data.outbound, previous?.outbound, 'bytesSent');
    } else {
      data.inbound.forEach(item => { item.bitrateKbps = null; });
      data.outbound.forEach(item => { item.bitrateKbps = null; });
    }

    updateRtcCpuQualityControl(data);
    state.lastRtcMetrics = data;
    return data;
  } catch (err) {
    logEvent('rtc-stats-error', {
      name: err?.name || null,
      message: err?.message || null
    });
    return state.lastRtcMetrics;
  }
}

async function collectRtcMetrics() {
  if (state.pc) {
    const current = await snapshotRtcMetrics();
    if (current) return current;
  }

  if (state.lastRtcMetrics) {
    return {
      ...state.lastRtcMetrics,
      available: false,
      lastKnown: true
    };
  }

  return { available: false, lastKnown: false };
}

function median(values) {
  const xs = values.filter(Number.isFinite).sort((a,b) => a-b);
  if (!xs.length) return null;
  const m = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[m] : (xs[m-1] + xs[m]) / 2;
}

async function buildCompleteReport() {
  const rtc = await collectRtcMetrics();
  const nav = performance.getEntriesByType('navigation')[0];
  const phoneCamera = await window.TCGatePhoneCamera?.fetchDiagnostics?.().catch(() => window.TCGatePhoneCamera?.getSnapshot?.() || null) || null;

  return {
    format: 'tcgate-alpha-complete-report',
    version: PRODUCT_VERSION,
    generatedAt: new Date().toISOString(),
    session: {
      startedAt: new Date(state.reportStartedAt).toISOString(),
      durationMs: Date.now() - state.reportStartedAt,
      roomCode: state.roomCode,
      role: state.role,
      game: state.game,
      opponentPresent: state.opponentPresent,
      ownReady: state.ownReady,
      opponentReady: state.opponentReady,
      timer: {
        enabled: state.timer.enabled,
        durationSeconds: state.timer.durationSeconds,
        running: state.timer.running,
        remainingSeconds: timerRemainingSeconds()
      }
    },
    privacy: {
      videoIncluded: false,
      audioIncluded: false,
      screenshotsIncluded: false,
      ipAddressesIncluded: false,
      note: 'Rapport technique uniquement. Aucun flux média n’est enregistré.'
    },
    environment: {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      hardwareConcurrency: navigator.hardwareConcurrency || null,
      deviceMemoryGB: navigator.deviceMemory || null,
      screen: {
        width: screen.width,
        height: screen.height,
        pixelRatio: devicePixelRatio
      },
      viewport: {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        visualWidth: window.visualViewport?.width || null,
        visualHeight: window.visualViewport?.height || null,
        documentClientWidth: document.documentElement.clientWidth,
        documentClientHeight: document.documentElement.clientHeight,
        documentScrollWidth: document.documentElement.scrollWidth,
        documentScrollHeight: document.documentElement.scrollHeight,
        verticalOverflowPx: Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
        horizontalOverflowPx: Math.max(0, document.documentElement.scrollWidth - window.innerWidth)
      },
      page: {
        origin: location.origin,
        protocol: location.protocol,
        hostname: location.hostname,
        isTryCloudflare: location.hostname.endsWith('.trycloudflare.com'),
        isRailway: location.hostname.endsWith('.up.railway.app') || location.hostname.endsWith('.railway.app')
      },
      secureContext: window.isSecureContext
    },
    navigation: nav ? {
      domContentLoadedMs: nav.domContentLoadedEventEnd,
      loadEventMs: nav.loadEventEnd,
      transferSize: nav.transferSize
    } : null,
    media: {
      cameraEnabled: state.cameraEnabled,
      microphoneEnabled: state.micEnabled,
      localVideo: safeTrackSettings(currentVideoTrack()),
      localAudio: safeTrackSettings(currentAudioTrack()),
      remoteTracks: state.remoteStream?.getTracks?.().map(safeTrackSettings) || [],
      remoteMediaState: { ...state.remoteMediaState }
    },
    phoneCamera,
    network: {
      signaling: {
        eventSourceReadyState: state.eventSource?.readyState ?? null
      },
      negotiation: {
        role: state.role,
        gameEntering: state.gameEntering,
        gameActive: state.gameActive,
        readyRequestPending: state.readyRequestPending,
        readyStatePolling: Boolean(state.readyStatePollTimer),
        readyStatePollCount: state.readyStatePollCount,
        rtcPrewarmPending: state.rtcPrewarmPending,
        rtcPrewarmReady: state.rtcPrewarmReady,
        rtcPrewarmError: state.rtcPrewarmError,
        offerInFlight: state.offerInFlight,
        offerSent: state.offerSent,
        hasRemoteOffer: Boolean(state.lastRemoteOfferSdp),
        hasRemoteAnswer: Boolean(state.lastRemoteAnswerSdp)
      },
      webrtc: rtc,
      rtcConfiguration: {
        iceTransportPolicy: state.rtcConfig?.iceTransportPolicy || 'all',
        iceServerEntries: state.rtcConfig?.iceServers?.length || DEFAULT_RTC_CONFIG.iceServers.length,
        turn: { ...state.turnStatus }
      },
      qualityControl: rtcQualitySummary()
    },
    calibration: visionEnabledForCurrentGame()
      ? (window.TCGVisionCalibration?.getSnapshot?.() || { version: '0.6-calibration-v1', status: 'unavailable' })
      : { version: 'disabled-no-game', status: 'disabled' },
    vision: {
      integrated: true,
      enabledForGame: visionEnabledForCurrentGame(),
      assetsLoaded: state.visionAssetsLoaded,
      assetsLoading: state.visionAssetsLoading,
      assetsError: state.visionAssetsError,
      disabledReason: visionEnabledForCurrentGame() ? null : 'no-game',
      profile: visionEnabledForCurrentGame() ? VISION_PROFILE : null,
      scope: 'opponent-stream-only',
      detector: visionEnabledForCurrentGame() ? (window.TCGVisionEngine?.getSnapshot?.() || null) : null,
      identification: visionEnabledForCurrentGame() ? (window.TCGIdentificationLab?.getSnapshot?.() || null) : null,
      libraryIntegrity: visionEnabledForCurrentGame() ? (window.TCGIdentificationLab?.getSnapshot?.()?.libraryIntegrity || null) : null,
      tableState: visionEnabledForCurrentGame() ? (window.TCGTableStateEngine?.getSnapshot?.() || null) : null,
      tableStateEvents: visionEnabledForCurrentGame() ? (window.TCGTableStateEngine?.getEvents?.() || []) : [],
      testerFeedback: [...state.visionFeedback]
    },
    events: state.reportEvents
  };
}

function reportText(report) {
  const inbound = report.network.webrtc.inbound || [];
  const outbound = report.network.webrtc.outbound || [];
  const inboundVideo = inbound.find(x => x.kind === 'video') || null;
  const outboundVideo = outbound.find(x => x.kind === 'video') || null;
  const lines = [
    'TCGATE — RAPPORT COMPLET ALPHA FERMÉE',
    `Version: ${report.version}`,
    `Généré: ${report.generatedAt}`,
    `Durée session: ${(report.session.durationMs / 1000).toFixed(1)} s`,
    `Salon: ${report.session.roomCode || '—'} · rôle ${report.session.role || '—'}`,
    `Mode de jeu: ${report.session.game || '—'}`,
    `Vision active pour ce salon: ${report.vision?.enabledForGame ?? false}`,
    `Assets Vision chargés: ${report.vision?.assetsLoaded ?? false}`,
    '',
    'CONFIDENTIALITÉ',
    '- aucune vidéo enregistrée',
    '- aucun audio enregistré',
    '- aucune capture enregistrée',
    '- aucune adresse IP incluse',
    '',
    'MÉDIA LOCAL',
    `Caméra active: ${report.media.cameraEnabled}`,
    `Micro actif: ${report.media.microphoneEnabled}`,
    `Caméra: ${report.media.localVideo?.label || '—'}`,
    `Capture: ${report.media.localVideo?.width || '—'}x${report.media.localVideo?.height || '—'} @ ${report.media.localVideo?.frameRate || '—'} fps`,
    '',
    'WEBRTC',
    `État: ${report.network.webrtc.connectionState || 'non initialisé'}`,
    `ICE: ${report.network.webrtc.iceConnectionState || '—'}`,
    `RTT: ${report.network.webrtc.candidatePair?.currentRoundTripTime ?? '—'} s`,
    `Route ICE locale: ${report.network.webrtc.route?.localCandidateType || '—'}`,
    `Route ICE distante: ${report.network.webrtc.route?.remoteCandidateType || '—'}`,
    `TURN/relay utilisé: ${report.network.webrtc.route?.usingRelay ?? '—'}`,
    `TURN configuré/disponible: ${report.network.rtcConfiguration?.turn?.configured ?? false} / ${report.network.rtcConfiguration?.turn?.available ?? false}`,
    `Provider TURN: ${report.network.rtcConfiguration?.turn?.provider || '—'}`,
    `Politique ICE: ${report.network.rtcConfiguration?.iceTransportPolicy || 'all'}`,
    `Flux vidéo reçu: ${inboundVideo?.frameWidth || '—'}x${inboundVideo?.frameHeight || '—'} · ${inboundVideo?.framesPerSecond || '—'} fps · ${inboundVideo?.bitrateKbps ?? '—'} kb/s`,
    `Flux vidéo envoyé: ${outboundVideo?.frameWidth || '—'}x${outboundVideo?.frameHeight || '—'} · ${outboundVideo?.framesPerSecond || '—'} fps · ${outboundVideo?.bitrateKbps ?? '—'} kb/s`,
    `Flux entrants: ${inbound.length}`,
    `Flux sortants: ${outbound.length}`,
    `Préférence vidéo: ${report.network.qualityControl?.degradationPreference || '—'}`,
    `Mode sender adaptatif: ${report.network.qualityControl?.senderAdaptiveMode || '—'}`,
    `Échelle sender: ${report.network.qualityControl?.senderScaleResolutionDownBy ?? 1}x`,
    `Adaptations sender: ${report.network.qualityControl?.senderAdaptations?.length ?? 0}`,
    `Mode capture adaptatif: ${report.network.qualityControl?.captureAdaptiveMode || '—'}`,
    `Adaptations capture: ${report.network.qualityControl?.captureAdaptations?.length ?? 0}`,
    `Tentatives adaptation capture: ${report.network.qualityControl?.captureAdaptationAttempts ?? 0}`,
    `Erreur adaptation capture: ${report.network.qualityControl?.captureAdaptationError?.name || 'aucune'}`,
    `Limitation CPU cumulée: ${report.network.qualityControl?.totalCpuLimitedMs ?? 0} ms`,
    `Throttle Vision actuel: ${report.network.qualityControl?.currentVisionThrottleMs ?? 0} ms`,
    '',
    'INTERFACE',
    `Viewport: ${report.environment.viewport?.innerWidth || '—'} x ${report.environment.viewport?.innerHeight || '—'}`,
    `Overflow vertical: ${report.environment.viewport?.verticalOverflowPx ?? '—'} px`,
    `Origine: ${report.environment.page?.origin || '—'}`,
    `Contexte sécurisé: ${report.environment.secureContext}`,
    '',
    'VISION / CALIBRATION',
    'Scope: flux adverse uniquement',
    `Calibration: ${report.calibration?.status || '—'}`,
    `Calibration raisons: ${report.calibration?.reasons?.join(', ') || 'aucune'}`,
    `Détecteur actif: ${report.vision?.detector?.active ?? false}`,
    `Provider: ${report.vision?.detector?.provider || '—'}`,
    `YOLO inference: ${report.vision?.detector?.inference?.inferenceMs ?? '—'} ms`,
    `YOLO cycle: ${report.vision?.detector?.inference?.totalMs ?? '—'} ms`,
    `Cartes détectées: ${report.vision?.detector?.activeCards ?? '—'}`,
    `Bibliothèque: ${report.vision?.identification?.librarySize ?? '—'} cartes`,
    `Matcher: ${report.vision?.identification?.matcherMs ?? '—'} ms`,
    `Cache hover hits: ${report.vision?.identification?.hoverCache?.hits ?? '—'}`,
    `Changements géométrie vidéo: ${report.vision?.detector?.geometry?.changes ?? '—'}`,
    `Garde reflet - rejets: ${report.vision?.identification?.qualityGuard?.rejected ?? '—'}`,
    `Garde reflet - modérés: ${report.vision?.identification?.qualityGuard?.moderate ?? '—'}`,
    `Vision State: ${report.vision?.tableState?.version || '—'}`,
    `Mémoire connue: ${report.vision?.tableState?.knownCards ?? '—'} / ${report.vision?.tableState?.activeTableCards ?? '—'}`,
    `Hover mémoire hits/misses: ${report.vision?.tableState?.sessionStats?.hoverMemoryHits ?? '—'} / ${report.vision?.tableState?.sessionStats?.hoverMemoryMisses ?? '—'}`,
    `Handoffs visuels nettoyés: ${report.vision?.tableState?.sessionStats?.visibleHandoffClears ?? '—'}`,
    `Handoff HD demandés/validés: ${report.vision?.identification?.imageHandoff?.telemetry?.handoffRequested ?? '—'} / ${report.vision?.identification?.imageHandoff?.telemetry?.handoffCommitted ?? '—'}`,
    `Clear HD demandés/validés/dédupliqués: ${report.vision?.identification?.imageHandoff?.telemetry?.clearRequested ?? '—'} / ${report.vision?.identification?.imageHandoff?.telemetry?.clearCommitted ?? '—'} / ${report.vision?.identification?.imageHandoff?.telemetry?.clearDeduplicated ?? '—'}`,
    `Rendus mémoire: ${report.vision?.tableState?.sessionStats?.visibleMemoryRenders ?? '—'}`,
    `Retours testeur Vision: ${report.vision?.testerFeedback?.length ?? 0}`,
    `Pointer misses 3x3: ${JSON.stringify(report.vision?.identification?.spatialPointer?.misses || [])}`,
    `Détections filtrées 3x3: ${JSON.stringify(report.vision?.detector?.spatial?.filtered || [])}`,
    '',
    'ÉVÉNEMENTS',
    `Total: ${report.events.length}`,
    ...report.events.slice(-120).map(e => `${String(e.tMs).padStart(7)} ms · ${e.type} · ${JSON.stringify(e.data)}`)
  ];
  return lines.join('\n');
}

function crc32(bytes) {
  let crc = 0 ^ -1;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ -1) >>> 0;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const day = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

function makeStoredZip(files) {
  const enc = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const stamp = dosDateTime();

  const u16 = v => [v & 255, (v >>> 8) & 255];
  const u32 = v => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];

  for (const file of files) {
    const name = enc.encode(file.name);
    const data = typeof file.data === 'string' ? enc.encode(file.data) : file.data;
    const crc = crc32(data);

    const localHeader = new Uint8Array([
      ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0),
      ...u16(stamp.time), ...u16(stamp.day),
      ...u32(crc), ...u32(data.length), ...u32(data.length),
      ...u16(name.length), ...u16(0)
    ]);

    localParts.push(localHeader, name, data);

    const centralHeader = new Uint8Array([
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0),
      ...u16(stamp.time), ...u16(stamp.day),
      ...u32(crc), ...u32(data.length), ...u32(data.length),
      ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(0), ...u32(offset)
    ]);

    centralParts.push(centralHeader, name);
    offset += localHeader.length + name.length + data.length;
  }

  const centralSize = centralParts.reduce((n, p) => n + p.length, 0);
  const end = new Uint8Array([
    ...u32(0x06054b50), ...u16(0), ...u16(0),
    ...u16(files.length), ...u16(files.length),
    ...u32(centralSize), ...u32(offset), ...u16(0)
  ]);

  return new Blob([...localParts, ...centralParts, end], { type: 'application/zip' });
}

async function generateCompleteReport() {
  logEvent('report-generation-request');
  const report = await buildCompleteReport();
  const json = JSON.stringify(report, null, 2);
  const txt = reportText(report);

  const zip = makeStoredZip([
    { name: 'report.json', data: json },
    { name: 'rapport.txt', data: txt },
    { name: 'README.txt', data:
`TCGate Alpha 0.1 — Rapport complet

Ce ZIP ne contient ni vidéo, ni audio, ni capture d’écran automatique.
Il contient les données de session, média, réseau WebRTC, Vision, calibration, Vision State et événements alpha.
Les boutons de retour testeur peuvent ajouter un incident technique au rapport.
`
    }
  ]);

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const url = URL.createObjectURL(zip);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tcgate-alpha-rapport-complet-${stamp}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Rapport complet généré.');
}



window.addEventListener('tcg-vision-geometry',(event)=>{
  const d=event.detail || {};
  logEvent('vision-geometry-change',d);

  clearTimeout(state.calibrationResizeTimer);
  state.calibrationResizeTimer=setTimeout(()=>{
    if(!state.gameActive || !$('remoteVideo')?.videoWidth) return;
    window.TCGVisionCalibration?.start?.($('remoteVideo'),'video-resize').catch(err=>{
      logEvent('calibration-error',{
        name:err?.name || null,
        message:err?.message || String(err),
        reason:'video-resize'
      });
    });
  },900);
});

window.addEventListener('tcg-identification-result',(event)=>{
  syncIdentifiedCardUi(event.detail || {});
});

window.addEventListener('tcg-identification-stability',(event)=>{
  const d=event.detail || {};
  logEvent('identification-stability',{
    type:d.type || null,
    trackUid:d.trackUid ?? null,
    stableName:d.stableName || null,
    candidateName:d.candidateName || d.pendingName || null,
    count:d.count ?? d.pendingCount ?? null,
    required:d.required ?? null,
    reason:d.reason || null,
    holdAgeMs:d.holdAgeMs ?? null,
    quality:d.quality || null
  });
});

window.addEventListener('tcg-calibration-updated',(event)=>{
  const s=event.detail || {};
  setCalibrationStatus(s);
  logEvent('calibration-status',{
    status:s.status,
    reasons:s.reasons || [],
    brightness:s.meanBrightness ?? null,
    detail:s.meanDetail ?? null,
    automaticRecalibrations:s.automaticRecalibrations ?? 0
  });
});

window.addEventListener('tcg-vision-state',(event)=>{
  const d=event.detail || {};
  if(d.active) setVisionStatus(`Vision : active · ${d.provider || 'moteur'}`,'good');
});

window.addEventListener('tcg-identification-library',(event)=>{
  const d=event.detail || {};
  if(d.ready) setVisionStatus(`Vision : prête · ${d.cards || 0} cartes`,'good');
});

window.addEventListener('tcg-table-state-updated',(event)=>{
  const snapshot=event.detail?.snapshot || window.TCGTableStateEngine?.getSnapshot?.() || null;
  setVisionStateStatus(snapshot);
});

window.addEventListener('tcg-table-hover-hit',()=>{
  queueMicrotask(syncMemoryVisibleCard);
});

window.addEventListener('tcg-identification-visible',(event)=>{
  const visible=event.detail || null;
  if(!visible?.accepted || !visible?.imageUrl) return;
  presentIdentifiedCard({
    cardId:visible.cardId||null, printingId:visible.printingId||null,
    refId:visible.refId||null, variantKind:visible.variantKind||null,
    recognitionGroupId:visible.recognitionGroupId||null,
    candidatePrintingIds:Array.isArray(visible.candidatePrintingIds)?[...visible.candidatePrintingIds]:[], recognitionMode:visible.recognitionMode||null,
    name:visible.name, type:visible.type, image:visible.image, imageUrl:visible.imageUrl,
    visualIndex:null, mode:visible.mode||'memory-hover', matcherMs:0
  });
});

window.addEventListener('tcg-identification-visible-cleared',(event)=>{
  // UI retention only: Vision may clear its internal result immediately, but the
  // player gets a short grace period to move from the physical card to the HD panel.
  scheduleVisibleCardClear(event.detail?.reason || 'pointer-left-card');
});

/* ---------- Bindings ---------- */

$('timerToggle')?.addEventListener('click', () => {
  if (state.role !== 'host') return;
  const minutes = Math.max(1, Math.min(180, Number($('timerMinutes')?.value || 50)));
  const enabled = !state.timer.enabled;
  updateHubMetadata({ timer: { enabled, durationMinutes: minutes } }).then(() => logEvent('timer-config', { enabled, durationSeconds: minutes * 60 }));
});
$('timerMinutes')?.addEventListener('change', () => {
  if (state.role !== 'host') return;
  const minutes = Math.max(1, Math.min(180, Math.round(Number($('timerMinutes').value || 50))));
  $('timerMinutes').value = String(minutes);
  updateHubMetadata({ timer: { enabled: state.timer.enabled, durationMinutes: minutes } }).then(() => logEvent('timer-config', { enabled: state.timer.enabled, durationSeconds: minutes * 60 }));
});
$('timerChip')?.addEventListener('click', () => $('timerPop')?.classList.toggle('hidden'));
$('timerStart')?.addEventListener('click', () => sendTimerAction(state.timer.running ? 'pause' : 'start').catch(err => toast(err.message)));
$('timerReset')?.addEventListener('click', () => sendTimerAction('reset').catch(err => toast(err.message)));

$('gigDicePanel')?.addEventListener('pointerdown', event => {
  if (event.target.closest('.die-control2') || event.target.closest('#gigDiceReset')) return;
  const dieWrap = event.target.closest('.die-slot2');
  if (dieWrap) beginDieDrag(event, dieWrap);
});
window.addEventListener('pointermove', updateDieDrag, { passive: false });
window.addEventListener('pointerup', finishDieDrag);
window.addEventListener('pointercancel', finishDieDrag);
$('gigDicePanel')?.addEventListener('click', event => {
  if (event.target.closest('#gigDiceReset')) {
    event.stopPropagation();
    resetGigDice();
    return;
  }
  const dieWrap = event.target.closest('.die-slot2');
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (!dieWrap || !action) return;
  event.stopPropagation();
  if (action === 'increment') changeDieValue(dieWrap.dataset.dieId, 1);
  if (action === 'decrement') changeDieValue(dieWrap.dataset.dieId, -1);
});

$('toggleLocalPreview')?.addEventListener('click', event => {
  event.stopPropagation();
  state.localPreviewVisible = false;
  updateMediaUi();
});
$('restoreLocalFeed')?.addEventListener('click', event => {
  event.stopPropagation();
  state.localPreviewVisible = true;
  updateMediaUi();
});

$('gameSelect').addEventListener('change', () => {
  const noGame = $('gameSelect').value === 'no-game';
  $('gameModeHelp').textContent = noGame
    ? 'Mode webcam pur : aucun modèle, aucune base de cartes et aucun traitement Vision ne seront chargés.'
    : 'Vision analyse uniquement le flux adverse pour ce jeu pris en charge.';
  if (state.roomCode && state.role === 'host') updateHubMetadata({ game: $('gameSelect').value });
});

$('playerName').addEventListener('input', scheduleHubNameUpdate);

$('goCreate').addEventListener('click', openCreateHub);
$('goJoin').addEventListener('click', () => configureSetup('join'));
$('resumeSessionButton').addEventListener('click', recoverPersistentSession);
$('setupBack').addEventListener('click', () => showScreen('home'));
$('setupContinue').addEventListener('click', enterLobby);
$('roomCodeInput').addEventListener('keydown', e => { if (e.key === 'Enter') enterLobby(); });

$('copyCode').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(state.roomCode || ''); toast('Code copié.'); }
  catch { toast(state.roomCode || ''); }
});

$('copyLink').addEventListener('click', async () => {
  const link = `${location.origin}${location.pathname}?room=${state.roomCode}`;
  try { await navigator.clipboard.writeText(link); toast('Lien d’invitation copié.'); }
  catch { toast(link); }
});

$('enableMedia').addEventListener('click', () => startLocalMedia({
  cameraId: $('cameraSelect').value || state.selectedCameraId,
  microphoneId: $('microSelect').value || state.selectedMicrophoneId
}));
$('usePhoneCamera')?.addEventListener('click', pairPhoneCamera);
$('copyPhoneCameraLink')?.addEventListener('click', async () => {
  const link = $('copyPhoneCameraLink').dataset.url || '';
  try { await navigator.clipboard.writeText(link); toast('Lien téléphone copié.'); }
  catch { toast(link); }
});
$('cancelPhoneCamera')?.addEventListener('click', async () => {
  await window.TCGatePhoneCamera?.disconnect?.({ server: true });
  updatePhoneCameraUi({ status: 'idle' });
});
$('returnToWebcam')?.addEventListener('click', returnToPcWebcam);
$('reusePhoneCamera')?.addEventListener('click', reusePhoneCamera);
async function changePhoneLensFromSelector(event) {
  const select = event.currentTarget;
  select.disabled = true;
  toast('Changement d’objectif…');
  try {
    const result = await window.TCGatePhoneCamera?.selectCamera?.(select.value);
    const label = result?.state?.selectedCameraLabel || select.selectedOptions[0]?.textContent || 'objectif sélectionné';
    toast(`Objectif changé : ${label}`);
  } catch (err) {
    toast(err.rollbackRestored
      ? 'Changement impossible — caméra précédente restaurée'
      : 'Changement impossible — caméra téléphone indisponible');
  } finally {
    const diagnostics = window.TCGatePhoneCamera?.getSnapshot?.().diagnostics || {};
    const cameras = diagnostics.cameraDevices || [];
    const active = cameras.find(camera => camera.active)?.id || diagnostics.selectedCameraId || '';
    if (active && cameras.some(camera => camera.id === active)) select.value = active;
    select.disabled = cameras.length < 2;
  }
}
$('phoneCameraLens')?.addEventListener('change', changePhoneLensFromSelector);
$('gamePhoneCameraLens')?.addEventListener('change', changePhoneLensFromSelector);
$('cameraSelect').addEventListener('change', () => changeCameraFromSelector('cameraSelect'));
$('microSelect').addEventListener('change', () => changeMicrophoneFromSelector('microSelect'));
$('phoneCameraMicro')?.addEventListener('change', () => changeMicrophoneFromSelector('phoneCameraMicro'));
$('gameVideoSourceSelect')?.addEventListener('change', changeGameVideoSource);
$('gameCameraSelect').addEventListener('change', () => changeCameraFromSelector('gameCameraSelect'));
$('gameMicroSelect').addEventListener('change', () => changeMicrophoneFromSelector('gameMicroSelect'));

$('deviceMenuToggle').addEventListener('click', async () => {
  const menu = $('gameDeviceMenu');
  if (menu.classList.contains('hidden')) await openGameDeviceMenu();
  else closeGameDeviceMenu();
});
$('closeDeviceMenu').addEventListener('click', closeGameDeviceMenu);

$('lobbyToggleMic').addEventListener('click', () => setMicEnabled(!state.micEnabled));
$('lobbyToggleCam').addEventListener('click', () => setCameraEnabled(!state.cameraEnabled));
$('toggleMic').addEventListener('click', () => setMicEnabled(!state.micEnabled));
$('toggleCam').addEventListener('click', () => setCameraEnabled(!state.cameraEnabled));
$('fullscreenMic')?.addEventListener('click', () => setMicEnabled(!state.micEnabled));
$('fullscreenCam')?.addEventListener('click', () => setCameraEnabled(!state.cameraEnabled));

$('startGame').addEventListener('click', async () => {
  if (!state.opponentPresent) return toast('En attente de l’adversaire.');
  if (!currentVideoTrack() || !state.cameraEnabled) {
    toast('Active ta caméra avant de te déclarer prêt.');
    return;
  }
  await setReady(!state.ownReady);
});

$('leaveLobby').addEventListener('click', async () => {
  await setReady(false).catch(() => {});
  await leaveRoom();
  stopLocalStream();
  showScreen('home');
});

$('leaveGame').addEventListener('click', async () => {
  toggleDemoCard(false);
  clearVisibleCardNow('leave-game');
  await leaveRoom();
  stopLocalStream();
  showScreen('home');
});

$('generateReportLobby').addEventListener('click', generateCompleteReport);
$('generateReportGame').addEventListener('click', generateCompleteReport);
$('feedbackMissedCard')?.addEventListener('click',()=>captureTesterVisionFeedback('missed-card'));
$('feedbackWrongCard')?.addEventListener('click',()=>captureTesterVisionFeedback('wrong-card'));

$('fullscreenOpponent').addEventListener('click', async () => {
  const target = document.querySelector('.opponent-feed-card');
  try {
    if (!document.fullscreenElement) await target.requestFullscreen();
    else await document.exitFullscreen();
  } catch {
    toast('Le plein écran n’est pas disponible dans ce navigateur.');
  }
});

$('demoHoverCard').addEventListener('click', () => toggleDemoCard());
$('expandCard').addEventListener('click', openCardModal);
$('displayCardButton')?.addEventListener('click', openCardModal);

function setFullscreenCardZoom(expanded){
  const preview=$('fullscreenCardPreview');
  if(!preview) return;
  preview.classList.toggle('expanded', Boolean(expanded));
  preview.setAttribute('aria-expanded', expanded ? 'true' : 'false');
}
function toggleFullscreenCardZoom(){
  if(!state.currentIdentifiedCard?.imageUrl) return toast('Aucune carte identifiée.');
  const opponentCard=document.querySelector('.opponent-feed-card');
  if(document.fullscreenElement!==opponentCard) return openCardModal();
  setFullscreenCardZoom(!$('fullscreenCardPreview')?.classList.contains('expanded'));
}
$('fullscreenExpandCard').addEventListener('click', toggleFullscreenCardZoom);
$('fullscreenIdentImage')?.addEventListener('click', toggleFullscreenCardZoom);
$('fullscreenZoomClose')?.addEventListener('click', event => {
  event.stopPropagation();
  setFullscreenCardZoom(false);
});
$('fullscreenCardPreview')?.addEventListener('click', event => {
  if (!$('fullscreenCardPreview')?.classList.contains('expanded')) return;
  if (event.target === $('fullscreenCardPreview')) setFullscreenCardZoom(false);
});

[$('displayCardPanel'), $('fullscreenCardPreview')].forEach(panel=>{
  if(!panel) return;
  panel.addEventListener('pointerenter',()=>{
    state.cardDisplayHovering=true;
    cancelCardDisplayHide();
  });
  panel.addEventListener('pointerleave',()=>{
    state.cardDisplayHovering=false;
    scheduleVisibleCardClear('left-hd-panel');
  });
});

$('opponentFeed')?.addEventListener('pointerleave',()=>{
  // Identification deliberately keeps the last accepted result when the pointer
  // exits the video stage. Start the same grace period at that exact moment.
  scheduleVisibleCardClear('left-video-stage');
});
$('closeCardModal').addEventListener('click', () => $('cardModal').classList.add('hidden'));
$('cardModal').addEventListener('click', e => {
  if (e.target === $('cardModal')) $('cardModal').classList.add('hidden');
});

document.addEventListener('fullscreenchange', () => {
  const opponentCard=document.querySelector('.opponent-feed-card');
  const button=$('fullscreenOpponent');
  const active=document.fullscreenElement===opponentCard;
  moveGigPanelForFullscreen();
  renderGigDicePanel();
  if(button){
    button.title=active ? 'Quitter le plein écran' : 'Plein écran';
    button.setAttribute('aria-label',button.title);
  }

  if(active && state.currentIdentifiedCard?.imageUrl){
    showFullscreenIdentifiedCard(state.currentIdentifiedCard);
  }else if(!active){
    setFullscreenCardZoom(false);
    $('fullscreenCardPreview').classList.add('hidden');
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') $('cardModal').classList.add('hidden');
});

state.gigDice = createGigDiceState();
renderGigDicePanel();
setupDraggableGigPanel();
window.addEventListener('resize', () => {
  renderGigDicePanel();
  scheduleGigPanelSafePlacement('window-resize');
});
window.visualViewport?.addEventListener?.('resize', () => {
  scheduleGigPanelSafePlacement('visual-viewport-resize');
});

window.addEventListener('beforeunload', () => {
  // Refresh keeps sessionStorage, while a full tab close can
  // still be recovered through the separate HttpOnly recovery credential.
  // Explicit Quit buttons remain authoritative and remove the peer immediately.
  saveRoomSession();
});

if (navigator.mediaDevices?.addEventListener) {
  navigator.mediaDevices.addEventListener('devicechange', handleMediaDeviceChange);
} else if (navigator.mediaDevices) {
  navigator.mediaDevices.ondevicechange = handleMediaDeviceChange;
}

logEvent('page-loaded', {
  secureContext: window.isSecureContext,
  origin: location.origin,
  protocol: location.protocol,
  isTryCloudflare: location.hostname.endsWith('.trycloudflare.com'),
  isRailway: location.hostname.endsWith('.up.railway.app') || location.hostname.endsWith('.railway.app'),
  viewport: {
    width: window.innerWidth,
    height: window.innerHeight
  },
  userAgent: navigator.userAgent,
  visionAssetsLoadedAtPageLoad: state.visionAssetsLoaded
});

const params = new URLSearchParams(location.search);
const roomFromUrl = params.get('room');

(async () => {
  const resumed = await tryResumeSavedSession();
  if (resumed) return;

  const recoveryAvailable = await checkPersistentRecovery();
  const normalizedUrlRoom = roomFromUrl ? roomFromUrl.toUpperCase() : null;
  if (
    recoveryAvailable &&
    (!normalizedUrlRoom || state.persistentRecovery?.code === normalizedUrlRoom)
  ) {
    showScreen('home');
    return;
  }

  if (normalizedUrlRoom) {
    $('roomCodeInput').value = normalizedUrlRoom;
    configureSetup('join');
  }
})();
