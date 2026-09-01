
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
  const hostValues = [3, 4, 5, 6, 7, 10];
  const guestValues = [2, 3, 4, 5, 6, 9];
  return [
    ...sides.map((side, index) => ({ id: `host-d${side}`, origin: 'host', owner: 'host', sides: side, value: hostValues[index] })),
    ...sides.map((side, index) => ({ id: `guest-d${side}`, origin: 'guest', owner: 'guest', sides: side, value: guestValues[index] }))
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
    if (!allowedSides.has(sides) || !Number.isInteger(value) || value < 1 || value > sides) return false;
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

function streetCred(uiOwner) {
  return getGigDice(uiOwner).reduce((sum, die) => sum + Number(die.value || 0), 0);
}

function dieUiOriginClass(die) {
  return die.origin === localGigRole() ? 'self' : 'opponent';
}

function renderGigLane(uiOwner, containerId) {
  const lane = $(containerId);
  if (!lane) return;
  lane.innerHTML = getGigDice(uiOwner).map(die => {
    const originClass = dieUiOriginClass(die);
    return `
      <div class="tcgate-die-wrap ${state.lastMovedDieId === die.id ? 'just-moved' : ''}" data-die-id="${die.id}">
        <div class="tcgate-die-rail ${originClass}">
          <button class="tcgate-die-adjust tcgate-die-adjust-plus" type="button" data-action="increment" aria-label="Augmenter la valeur">+</button>
          <div class="tcgate-die ${originClass}" aria-label="Dé à ${die.sides} faces, valeur ${die.value}">
            <img class="tcgate-die-icon" src="/assets/dice/${originClass}/D${die.sides}.svg" alt="" aria-hidden="true">
            <span class="tcgate-die-value">${die.value}</span>
          </div>
          <button class="tcgate-die-adjust tcgate-die-adjust-minus" type="button" data-action="decrement" aria-label="Diminuer la valeur">−</button>
        </div>
      </div>`;
  }).join('');
}

function renderGigDicePanel() {
  const panel = $('gigDicePanel');
  const visible = gigDiceEnabledForCurrentGame();
  panel?.classList.toggle('hidden', !visible);
  if (!visible || !panel) return;

  const selfDice = getGigDice('self');
  const opponentDice = getGigDice('opponent');
  const selfSide = panel.querySelector('.tcgate-gig-side-self');
  const opponentSide = panel.querySelector('.tcgate-gig-side-opp');
  const track = panel.querySelector('.tcgate-gig-track');
  selfSide?.setAttribute('data-dice-count', String(selfDice.length));
  opponentSide?.setAttribute('data-dice-count', String(opponentDice.length));

  const SIDE_PADDING = 18;
  const SCORE_WIDTH = 48;
  const SCORE_LANE_GAP = 10;
  const DIE_WIDTH = 52;
  const DIE_GAP = 6;
  const GRID_GAPS_AND_DIVIDER = 29;
  const sideDemand = count => SIDE_PADDING + SCORE_WIDTH + SCORE_LANE_GAP +
    (count ? count * DIE_WIDTH + Math.max(0, count - 1) * DIE_GAP : 0);
  const selfDemand = sideDemand(selfDice.length);
  const opponentDemand = sideDemand(opponentDice.length);

  if (track) {
    const usable = Math.max(0, track.clientWidth - GRID_GAPS_AND_DIVIDER);
    const wanted = selfDemand + opponentDemand;
    if (usable >= wanted || usable === 0) {
      track.style.gridTemplateColumns = `${selfDemand}px 1px ${opponentDemand}px`;
      track.classList.remove('is-tight');
    } else {
      const selfShare = selfDemand / Math.max(1, wanted);
      track.style.gridTemplateColumns = `${selfShare}fr 1px ${1 - selfShare}fr`;
      track.classList.add('is-tight');
    }
  }

  renderGigLane('self', 'gigSelfDice');
  renderGigLane('opponent', 'gigOpponentDice');
  $('gigSelfCred').textContent = streetCred('self');
  $('gigOpponentCred').textContent = streetCred('opponent');
  scheduleGigPanelSafePlacement('render');
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
  die.value = Math.min(die.sides, Math.max(1, Number(die.value) + delta));
  renderGigDicePanel();
  persistGigState();
  sendGigState('value-change').catch(()=>{});
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
  document.querySelectorAll('.tcgate-gig-side').forEach(side => side.classList.remove('die-drop-target', 'die-drop-active'));
}

function dieDropOwnerAtPoint(clientX, clientY, sourceUiOwner) {
  const targetUiOwner = sourceUiOwner === 'self' ? 'opponent' : 'self';
  const targetSide = document.querySelector(`.tcgate-gig-side-${targetUiOwner === 'self' ? 'self' : 'opp'}`);
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
  const dieEl = dieWrap.querySelector('.tcgate-die');
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
    const dieEl = drag.sourceEl.querySelector('.tcgate-die');
    drag.ghost = dieEl?.cloneNode(true) || null;
    if (drag.ghost) {
      drag.ghost.classList.add('tcgate-die-drag-ghost');
      const fullscreenRoot = document.querySelector('.opponent-feed-card');
      const ghostHost = document.fullscreenElement === fullscreenRoot ? fullscreenRoot : document.body;
      ghostHost.appendChild(drag.ghost);
    }
    drag.sourceEl.classList.add('is-dragging-die');
    const targetSide = document.querySelector(drag.sourceUiOwner === 'self' ? '.tcgate-gig-side-opp' : '.tcgate-gig-side-self');
    targetSide?.classList.add('die-drop-target');
  }

  if (drag.ghost) {
    drag.ghost.style.left = `${event.clientX}px`;
    drag.ghost.style.top = `${event.clientY}px`;
  }
  const targetUiOwner = dieDropOwnerAtPoint(event.clientX, event.clientY, drag.sourceUiOwner);
  const targetSide = document.querySelector(drag.sourceUiOwner === 'self' ? '.tcgate-gig-side-opp' : '.tcgate-gig-side-self');
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
        filters:detection.filters
      }:null,
      identification:identification?{
        libraryReady:identification.libraryReady,
        librarySize:identification.librarySize,
        matcherMs:identification.matcherMs,
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
  $('setupContinue').textContent = create ? 'Créer le salon' : 'Rejoindre le salon';
  if (!create && !new URLSearchParams(location.search).get('room')) $('roomCodeInput').value = '';
  showScreen('setup');
  setTimeout(() => (create ? $('playerName') : $('roomCodeInput')).focus(), 0);
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

async function enterLobby() {
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
    showScreen('lobby');
  } catch (err) {
    toast(err.message);
    logEvent('room-error', { message: err.message });
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
    const result = await sendSignal('offer', pc.localDescription);
    state.offerSent = true;
    logEvent('rtc-offer-created', {
      delivered: result?.delivered ?? null
    });
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
      opponentReady: state.opponentReady
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

$('gigDicePanel')?.addEventListener('pointerdown', event => {
  if (event.target.closest('.tcgate-die-adjust') || event.target.closest('#gigDiceDragHandle')) return;
  const dieWrap = event.target.closest('.tcgate-die-wrap');
  if (dieWrap) beginDieDrag(event, dieWrap);
});
window.addEventListener('pointermove', updateDieDrag, { passive: false });
window.addEventListener('pointerup', finishDieDrag);
window.addEventListener('pointercancel', finishDieDrag);
$('gigDicePanel')?.addEventListener('click', event => {
  const dieWrap = event.target.closest('.tcgate-die-wrap');
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
});

$('goCreate').addEventListener('click', () => configureSetup('create'));
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
