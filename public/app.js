
'use strict';

const $ = id => document.getElementById(id);

const screens = {
  home: $('screenHome'),
  setup: $('screenSetup'),
  lobby: $('screenLobby'),
  game: $('screenGame')
};

const PRODUCT_VERSION = 'TCGate Alpha 0.1 Candidate 5';
const VISION_PROFILE = 'Vision FaceWebcam 0.3.1 · State 0.1.6';

const state = {
  mode: 'create',
  playerName: 'Joueur',
  game: 'cyberpunk',
  roomCode: null,
  peerId: null,
  role: null,
  roomSnapshot: null,
  opponentId: null,
  opponentName: 'Adversaire',
  opponentPresent: false,
  ownReady: false,
  opponentReady: false,

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

  pc: null,
  videoTransceiver: null,
  audioTransceiver: null,
  pendingIce: [],
  rtcStarted: false,
  remoteVideoStarted: false,
  rtcStatsTimer: null,
  lastRtcMetrics: null,
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

  visionPrepared: false,
  visionPreparing: false,
  visionAttachedStreamId: null,
  visionMetricsTimer: null,
  calibrationResizeTimer: null,
  currentIdentifiedCard: null,
  lastIdentificationEventKey: null,
  visionStateReady: false,
  visionFeedback: [],

  demoCardVisible: false,

  reportStartedAt: Date.now(),
  reportEvents: [],
  reportSeq: 0
};

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
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

async function api(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || 'GET',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: 'no-store'
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

async function prepareVision() {
  if(state.game!=='cyberpunk' || state.visionPrepared || state.visionPreparing) return;
  state.visionPreparing=true;
  setVisionStatus('Vision : chargement…','warning');
  logEvent('vision-prepare-start');

  try{
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
  if(!stream || !stream.getVideoTracks().length) return;
  const videoTrack=stream.getVideoTracks()[0];
  const key=`${stream.id}:${videoTrack.id}`;
  if(state.visionAttachedStreamId===key) return;

  state.visionAttachedStreamId=key;

  try{
    await prepareVision();
    await window.TCGVisionEngine?.attachRemoteStream?.(stream);
    if (state.remoteMediaState.cameraEnabled === false) {
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
    setVisionStatus('Vision : active','good');

    window.TCGVisionCalibration?.start?.($('remoteVideo'),'initial').catch(err=>{
      logEvent('calibration-error',{name:err?.name||null,message:err?.message||String(err)});
    });

    startVisionMetricsSampler();
    logEvent('vision-attached',{streamId:stream.id,videoTrack:videoTrack.label||null});
  }catch(err){
    setVisionStatus('Vision : erreur','error');
    logEvent('vision-attach-error',{name:err?.name||null,message:err?.message||String(err)});
  }
}

function detachVision() {
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

function showFullscreenIdentifiedCard(card) {
  if(!card?.imageUrl) return;
  $('fullscreenIdentImage').src=card.imageUrl;
  $('fullscreenIdentImage').alt=card.name || 'Carte identifiée';
  $('fullscreenIdentName').textContent=card.name || 'Carte identifiée';
  $('fullscreenCardPreview').classList.remove('hidden');
}

function hideFullscreenIdentifiedCard() {
  $('fullscreenCardPreview')?.classList.add('hidden');
  $('fullscreenCardPreview')?.classList.remove('expanded');
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
    if(snap?.pointerInsideStage){
      state.currentIdentifiedCard=null;
      hideFullscreenIdentifiedCard();
      $('cardPreview')?.classList.add('empty');
    }
    return;
  }

  state.currentIdentifiedCard={
    name:detail.name,
    type:detail.type,
    image:detail.image,
    imageUrl:detail.imageUrl,
    visualIndex:detail.visualIndex,
    mode:detail.mode,
    matcherMs:detail.matcherMs
  };
  $('cardPreview')?.classList.remove('empty');

  if(document.fullscreenElement===document.querySelector('.opponent-feed-card')){
    showFullscreenIdentifiedCard(state.currentIdentifiedCard);
  }

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
  state.currentIdentifiedCard={
    name:visible.name,
    type:visible.type,
    image:visible.image,
    imageUrl:visible.imageUrl,
    visualIndex:null,
    mode:visible.mode || 'memory-hover',
    matcherMs:0
  };
  $('cardPreview')?.classList.remove('empty');
  if(document.fullscreenElement===document.querySelector('.opponent-feed-card')){
    showFullscreenIdentifiedCard(state.currentIdentifiedCard);
  }
}

function clearCurrentVisibleCard(reason='handoff') {
  state.currentIdentifiedCard=null;
  hideFullscreenIdentifiedCard();
  $('cardPreview')?.classList.add('empty');
  logEvent('visible-card-cleared',{reason});
}

function captureTesterVisionFeedback(kind) {
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
    : 'Entre le code reçu et choisis ton pseudo.';
  $('roomCodeField').classList.toggle('hidden', create);
  $('setupContinue').textContent = create ? 'Créer le salon' : 'Rejoindre le salon';
  showScreen('setup');
  setTimeout(() => $('playerName').focus(), 0);
}

function currentVideoTrack() {
  return state.localStream?.getVideoTracks?.()[0] || null;
}

function currentAudioTrack() {
  return state.localStream?.getAudioTracks?.()[0] || null;
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

  $('lobbyPreviewPlaceholder').classList.toggle('hidden', Boolean(videoTrack && state.cameraEnabled));
  $('localVideoPlaceholder').classList.toggle('hidden', Boolean(videoTrack && state.cameraEnabled));
  $('lobbyPreviewShell').classList.toggle('camera-off', !state.cameraEnabled);
  $('localFeed').classList.toggle('camera-off', !state.cameraEnabled);

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
  }

  if (state.roomSnapshot && screens.lobby.classList.contains('active')) {
    applyRoomState(state.roomSnapshot);
  }
}

async function enumerateDevices() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter(d => d.kind === 'videoinput');
    const microphones = devices.filter(d => d.kind === 'audioinput');

    const fill = (select, items, fallback) => {
      const previous = select.value;
      select.innerHTML = '';
      items.forEach((device, index) => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.textContent = device.label || `${fallback} ${index + 1}`;
        select.appendChild(option);
      });
      if (items.some(x => x.deviceId === previous)) select.value = previous;
    };

    fill($('cameraSelect'), cameras, 'Caméra');
    fill($('microSelect'), microphones, 'Micro');
    $('deviceSelectors').classList.toggle('hidden', !(cameras.length || microphones.length));

    if (state.selectedCameraId && cameras.some(d => d.deviceId === state.selectedCameraId)) {
      $('cameraSelect').value = state.selectedCameraId;
    }
    if (state.selectedMicrophoneId && microphones.some(d => d.deviceId === state.selectedMicrophoneId)) {
      $('microSelect').value = state.selectedMicrophoneId;
    }
  } catch {}
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

  const v = stream.getVideoTracks()[0] || null;
  const a = stream.getAudioTracks()[0] || null;

  state.selectedCameraId = v?.getSettings?.().deviceId || cameraId || null;
  state.selectedMicrophoneId = a?.getSettings?.().deviceId || microphoneId || null;

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

async function restartFromDeviceSelectors() {
  const cameraId = $('cameraSelect').value || null;
  const microphoneId = $('microSelect').value || null;
  logEvent('device-change-request', { camera: Boolean(cameraId), microphone: Boolean(microphoneId) });
  await startLocalMedia({ cameraId, microphoneId });
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
  $('lobbyPreview').srcObject = null;
  $('localVideo').srcObject = null;
  updateMediaUi();
  logEvent('media-stopped');
}

async function enterLobby() {
  const name = $('playerName').value.trim() || 'Joueur';
  state.playerName = name;
  state.game = $('gameSelect').value;
  $('setupContinue').disabled = true;

  try {
    let result;
    if (state.mode === 'create') {
      result = await api('/api/rooms', {
        method: 'POST',
        body: { name, game: state.game }
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
        body: { name }
      });
    }

    state.roomCode = result.code;
    state.peerId = result.peerId;
    state.role = result.role;
    state.roomSnapshot = result.room;

    $('lobbyCode').textContent = state.roomCode;
    $('lobbyPlayerName').textContent = state.playerName;
    $('localPlayerLabel').textContent = state.playerName;
    $('gameCode').textContent = state.roomCode;
    $('gameTitle').textContent = state.game === 'cyberpunk' ? 'Cyberpunk TCG' : 'TCG';

    history.replaceState({}, '', `${location.pathname}?room=${state.roomCode}`);
    logEvent('room-entered', { code: state.roomCode, role: state.role, game: state.game });

    connectEventStream();
    applyRoomState(result.room);
    showScreen('lobby');
  } catch (err) {
    toast(err.message);
    logEvent('room-error', { message: err.message });
  } finally {
    $('setupContinue').disabled = false;
  }
}

function connectEventStream() {
  state.eventSource?.close();
  const src = new EventSource(`/api/events?room=${encodeURIComponent(state.roomCode)}&peer=${encodeURIComponent(state.peerId)}`);
  state.eventSource = src;

  src.addEventListener('open', () => {
    setNetworkStatus('Connecté au serveur de salon', 'connected');
    logEvent('sse-open');
  });

  src.addEventListener('room-state', event => {
    const snapshot = JSON.parse(event.data);
    applyRoomState(snapshot);
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
    setNetworkStatus('Reconnexion au serveur…', 'warning');
    logEvent('sse-error');
  });
}

function applyRoomState(snapshot) {
  if (!snapshot) return;
  state.roomSnapshot = snapshot;

  const me = snapshot.peers.find(p => p.id === state.peerId);
  const opponent = snapshot.peers.find(p => p.id !== state.peerId);

  state.ownReady = Boolean(me?.ready);
  state.opponentPresent = Boolean(opponent);
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
  } else {
    $('opponentWaitingText').textContent = opponent.ready ? 'Connecté · prêt' : 'Connecté · préparation';
    remoteRow.classList.add('ready');
    remoteRow.classList.toggle('remote-ready', opponent.ready);
    remoteRow.classList.remove('waiting');
    setNetworkStatus(opponent.ready ? 'Adversaire prêt' : 'Adversaire connecté', 'connected');
  }

  const cameraReady = Boolean(currentVideoTrack() && state.cameraEnabled);
  $('startGame').disabled = !opponent || !cameraReady;

  if (!cameraReady) {
    $('startGame').textContent = 'Caméra requise';
  } else {
    $('startGame').textContent = state.ownReady
      ? (state.opponentReady ? 'Connexion à la partie…' : 'Prêt · attente adversaire')
      : 'Je suis prêt';
  }

  if(opponent && state.game==='cyberpunk'){
    prepareVision().catch(()=>{});
  }

  if (
    state.ownReady &&
    state.opponentReady &&
    !state.gameEntering &&
    !state.gameActive
  ) {
    enterNetworkGame();
  }
}

async function setReady(ready) {
  if (!state.roomCode || !state.peerId) return;
  try {
    await api('/api/ready', {
      method: 'POST',
      body: { room: state.roomCode, peerId: state.peerId, ready }
    });
    state.ownReady = ready;
    logEvent('ready', { ready });
  } catch (err) {
    toast(err.message);
  }
}

async function enterNetworkGame() {
  if (state.gameEntering || state.gameActive) return;

  // Lock immediately: updateMediaUi() may itself refresh room state.
  state.gameEntering = true;
  logEvent('game-enter-start', { role: state.role });

  try {
    showScreen('game');
    $('localVideo').srcObject = state.localStream;
    updateMediaUi();
    prepareVision().catch(()=>{});
    setRtcStatus('Initialisation WebRTC…', 'warning');

    await ensurePeerConnection();

    // Host is the single deterministic offerer.
    if (state.role === 'host') {
      await createAndSendOffer();
    }

    state.gameActive = true;
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
    const paused = !next.cameraEnabled;
    window.TCGVisionEngine?.setInputPaused?.(paused, paused ? 'remote-camera-off' : 'remote-camera-on');
    if (paused) setVisionStatus('Vision : pause · caméra adverse coupée', 'warning');
    else if (state.visionAttachedStreamId) setVisionStatus('Vision : active', 'good');
  }

  logEvent('remote-media-state', {
    cameraEnabled: next.cameraEnabled,
    microphoneEnabled: next.microphoneEnabled,
    cameraChanged
  });
}

async function ensurePeerConnection() {
  if (state.pc) return state.pc;

  const pc = new RTCPeerConnection(RTC_CONFIG);
  state.pc = pc;
  state.rtcStarted = true;
  state.pendingIce = [];

  // Only the deterministic offerer creates m-lines before the offer.
  // The answerer lets setRemoteDescription(offer) create matching
  // transceivers, then attaches its local tracks to those transceivers.
  if (state.role === 'host') {
    state.videoTransceiver = pc.addTransceiver('video', { direction: 'sendrecv' });
    state.audioTransceiver = pc.addTransceiver('audio', { direction: 'sendrecv' });

    await state.videoTransceiver.sender.replaceTrack(currentVideoTrack());
    await configureVideoSenderPolicy(state.videoTransceiver.sender, 'host-create');
    await state.audioTransceiver.sender.replaceTrack(currentAudioTrack());
  }

  pc.ontrack = async event => {
    let stream = event.streams?.[0] || null;

    if (!stream) {
      if (!state.remoteStream) state.remoteStream = new MediaStream();
      if (!state.remoteStream.getTracks().some(t => t.id === event.track.id)) {
        state.remoteStream.addTrack(event.track);
      }
    } else {
      state.remoteStream = stream;
    }

    if (!state.remoteStream) return;

    $('remoteVideo').srcObject = state.remoteStream;
    const hasRemoteVideo = Boolean(state.remoteStream.getVideoTracks().length);
    $('remoteVideoPlaceholder').classList.toggle('hidden', hasRemoteVideo);

    // Avoid two simultaneous play() calls when audio/video ontrack events
    // arrive almost together.
    if (hasRemoteVideo && !state.remoteVideoStarted && !state.remotePlayPending) {
      state.remotePlayPending = true;
      queueMicrotask(async () => {
        try {
          await $('remoteVideo').play();
          state.remoteVideoStarted = true;
        } catch (err) {
          logEvent('remote-video-play-error', {
            name: err?.name || null,
            message: err?.message || null
          });
        } finally {
          state.remotePlayPending = false;
        }
      });
    }

    logEvent('rtc-track', {
      kind: event.track.kind,
      streamTracks: state.remoteStream.getTracks().map(t => t.kind)
    });

    if(hasRemoteVideo){
      attachVisionToRemoteStream(state.remoteStream).catch(()=>{});
    }
  };

  pc.onicecandidate = event => {
    if (!event.candidate) {
      logEvent('rtc-ice-complete');
      return;
    }
    sendSignal('candidate', event.candidate.toJSON?.() || event.candidate);
  };

  pc.onconnectionstatechange = () => {
    const cs = pc.connectionState;
    if (cs === 'connected') {
      setRtcStatus('WebRTC connecté', 'connected');
      configureVideoSenderPolicy(state.videoTransceiver?.sender, 'connected').catch(()=>{});
      sendCurrentMediaState('rtc-connected').catch(()=>{});
    } else if (cs === 'connecting' || cs === 'new') setRtcStatus('Connexion WebRTC…', 'warning');
    else if (cs === 'disconnected') setRtcStatus('Connexion interrompue', 'warning');
    else if (cs === 'failed') setRtcStatus('Échec WebRTC', 'error');
    else if (cs === 'closed') setRtcStatus('WebRTC fermé');

    logEvent('rtc-connection-state', { state: cs });
    snapshotRtcMetrics().catch(() => {});
  };

  pc.oniceconnectionstatechange = () => {
    logEvent('rtc-ice-state', { state: pc.iceConnectionState });
  };

  pc.onsignalingstatechange = () => {
    logEvent('rtc-signaling-state', { state: pc.signalingState });
  };

  clearInterval(state.rtcStatsTimer);
  state.rtcStatsTimer = setInterval(() => {
    snapshotRtcMetrics().catch(() => {});
  }, 2000);

  logEvent('rtc-created', {
    role: state.role,
    precreatedTransceivers: state.role === 'host' ? ['video', 'audio'] : []
  });

  return pc;
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
    await state.videoTransceiver.sender.replaceTrack(currentVideoTrack());
    await configureVideoSenderPolicy(state.videoTransceiver.sender, 'guest-bind');
  }

  if (state.audioTransceiver) {
    state.audioTransceiver.direction = 'sendrecv';
    await state.audioTransceiver.sender.replaceTrack(currentAudioTrack());
  }

  logEvent('rtc-answerer-tracks-bound', {
    video: Boolean(state.videoTransceiver?.sender?.track),
    audio: Boolean(state.audioTransceiver?.sender?.track),
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

async function createAndSendOffer() {
  if (state.role !== 'host') return;
  if (state.offerInFlight || state.offerSent) return;

  const pc = await ensurePeerConnection();
  if (pc.signalingState !== 'stable') {
    logEvent('rtc-offer-skipped', { signalingState: pc.signalingState });
    return;
  }

  state.offerInFlight = true;
  try {
    const offer = await pc.createOffer();
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

  const pc = await ensurePeerConnection();

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
      await flushPendingIce();

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
      await flushPendingIce();
      logEvent('rtc-answer-applied');
      return;
    }

    if (signal.type === 'candidate') {
      const candidate = new RTCIceCandidate(signal.payload);
      if (pc.remoteDescription) {
        await pc.addIceCandidate(candidate);
      } else {
        state.pendingIce.push(candidate);
      }
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

async function flushPendingIce() {
  if (!state.pc?.remoteDescription) return;
  while (state.pendingIce.length) {
    const candidate = state.pendingIce.shift();
    try { await state.pc.addIceCandidate(candidate); }
    catch (err) { logEvent('rtc-candidate-error', { message: err.message }); }
  }
}

function closePeerConnection(reason = 'manual') {
  if (state.pc) {
    snapshotRtcMetrics().catch(() => {});
    try { state.pc.ontrack = null; state.pc.onicecandidate = null; state.pc.close(); } catch {}
  }

  clearInterval(state.rtcStatsTimer);
  state.rtcStatsTimer = null;

  state.pc = null;
  state.videoTransceiver = null;
  state.audioTransceiver = null;
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
  const room = state.roomCode;
  const peerId = state.peerId;

  state.eventSource?.close();
  state.eventSource = null;
  closePeerConnection('leave-room');

  if (room && peerId) {
    fetch('/api/leave', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room, peerId }),
      keepalive: true
    }).catch(() => {});
  }

  state.roomCode = null;
  state.peerId = null;
  state.role = null;
  state.opponentId = null;
  state.opponentPresent = false;
  state.ownReady = false;
  state.opponentReady = false;
  state.roomSnapshot = null;
  state.gameEntering = false;
  state.gameActive = false;
  state.offerInFlight = false;
  state.offerSent = false;
  history.replaceState({}, '', location.pathname);
  logEvent('room-left');
}

async function setCameraEnabled(enabled) {
  const track = currentVideoTrack();
  if (!track) return toast('Aucune caméra active.');
  track.enabled = enabled;
  updateMediaUi();
  logEvent('camera-toggle', { enabled });
  sendCurrentMediaState('camera-toggle').catch(()=>{});

  if (!enabled && state.ownReady && screens.lobby.classList.contains('active')) {
    await setReady(false).catch(() => {});
  }

  toast(enabled ? 'Caméra activée' : 'Caméra coupée');
}

function setMicEnabled(enabled) {
  const track = currentAudioTrack();
  if (!track) return toast('Aucun micro actif.');
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

async function snapshotRtcMetrics() {
  if (!state.pc) return state.lastRtcMetrics;

  try {
    const report = await state.pc.getStats();
    const statsById = new Map();
    report.forEach(stat => statsById.set(stat.id, stat));

    const data = {
      available: true,
      capturedAt: new Date().toISOString(),
      connectionState: state.pc.connectionState,
      iceConnectionState: state.pc.iceConnectionState,
      signalingState: state.pc.signalingState,
      inbound: [],
      outbound: [],
      candidatePair: null,
      route: null
    };

    report.forEach(stat => {
      if (stat.type === 'inbound-rtp' && !stat.isRemote) {
        data.inbound.push({
          kind: stat.kind || stat.mediaType || null,
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
    network: {
      signaling: {
        eventSourceReadyState: state.eventSource?.readyState ?? null
      },
      negotiation: {
        role: state.role,
        gameEntering: state.gameEntering,
        gameActive: state.gameActive,
        offerInFlight: state.offerInFlight,
        offerSent: state.offerSent,
        hasRemoteOffer: Boolean(state.lastRemoteOfferSdp),
        hasRemoteAnswer: Boolean(state.lastRemoteAnswerSdp)
      },
      webrtc: rtc,
      qualityControl: rtcQualitySummary()
    },
    calibration: window.TCGVisionCalibration?.getSnapshot?.() || {
      version: '0.6-calibration-v1',
      status: 'unavailable'
    },
    vision: {
      integrated: true,
      profile: VISION_PROFILE,
      scope: 'opponent-stream-only',
      detector: window.TCGVisionEngine?.getSnapshot?.() || null,
      identification: window.TCGIdentificationLab?.getSnapshot?.() || null,
      tableState: window.TCGTableStateEngine?.getSnapshot?.() || null,
      tableStateEvents: window.TCGTableStateEngine?.getEvents?.() || [],
      testerFeedback: [...state.visionFeedback]
    },
    events: state.reportEvents
  };
}

function reportText(report) {
  const inbound = report.network.webrtc.inbound || [];
  const outbound = report.network.webrtc.outbound || [];
  const lines = [
    'TCGATE — RAPPORT COMPLET ALPHA FERMÉE',
    `Version: ${report.version}`,
    `Généré: ${report.generatedAt}`,
    `Durée session: ${(report.session.durationMs / 1000).toFixed(1)} s`,
    `Salon: ${report.session.roomCode || '—'} · rôle ${report.session.role || '—'}`,
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
  state.currentIdentifiedCard={
    name:visible.name, type:visible.type, image:visible.image, imageUrl:visible.imageUrl,
    visualIndex:null, mode:visible.mode||'memory-hover', matcherMs:0
  };
  $('cardPreview')?.classList.remove('empty');
  if(document.fullscreenElement===document.querySelector('.opponent-feed-card')) showFullscreenIdentifiedCard(state.currentIdentifiedCard);
});

window.addEventListener('tcg-identification-visible-cleared',(event)=>{
  clearCurrentVisibleCard(event.detail?.reason || 'atomic-handoff');
});

/* ---------- Bindings ---------- */

$('goCreate').addEventListener('click', () => configureSetup('create'));
$('goJoin').addEventListener('click', () => configureSetup('join'));
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
$('cameraSelect').addEventListener('change', restartFromDeviceSelectors);
$('microSelect').addEventListener('change', restartFromDeviceSelectors);
$('lobbyToggleMic').addEventListener('click', () => setMicEnabled(!state.micEnabled));
$('lobbyToggleCam').addEventListener('click', () => setCameraEnabled(!state.cameraEnabled));
$('toggleMic').addEventListener('click', () => setMicEnabled(!state.micEnabled));
$('toggleCam').addEventListener('click', () => setCameraEnabled(!state.cameraEnabled));

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
$('fullscreenExpandCard').addEventListener('click', () => {
  if(!state.currentIdentifiedCard?.imageUrl) return toast('Aucune carte identifiée.');

  const opponentCard=document.querySelector('.opponent-feed-card');
  const preview=$('fullscreenCardPreview');

  if(document.fullscreenElement===opponentCard){
    preview.classList.toggle('expanded');
  }else{
    openCardModal();
  }
});
$('closeCardModal').addEventListener('click', () => $('cardModal').classList.add('hidden'));
$('cardModal').addEventListener('click', e => {
  if (e.target === $('cardModal')) $('cardModal').classList.add('hidden');
});

document.addEventListener('fullscreenchange', () => {
  const opponentCard=document.querySelector('.opponent-feed-card');

  if(document.fullscreenElement===opponentCard && state.currentIdentifiedCard?.imageUrl){
    showFullscreenIdentifiedCard(state.currentIdentifiedCard);
  }else if(document.fullscreenElement!==opponentCard){
    $('fullscreenCardPreview').classList.remove('expanded');
    $('fullscreenCardPreview').classList.add('hidden');
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') $('cardModal').classList.add('hidden');
});

window.addEventListener('beforeunload', () => {
  if (state.roomCode && state.peerId) {
    navigator.sendBeacon?.('/api/leave', new Blob([
      JSON.stringify({ room: state.roomCode, peerId: state.peerId })
    ], { type: 'application/json' }));
  }
});

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
  userAgent: navigator.userAgent
});

const params = new URLSearchParams(location.search);
const roomFromUrl = params.get('room');
if (roomFromUrl) {
  $('roomCodeInput').value = roomFromUrl.toUpperCase();
  configureSetup('join');
}
