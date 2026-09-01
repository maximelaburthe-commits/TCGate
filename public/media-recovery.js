'use strict';

(() => {
  function isLiveTrack(track, kind) {
    return Boolean(track && track.kind === kind && track.readyState === 'live');
  }

  async function bindSenderTrack(sender, track, { kind, source, generation, onBound } = {}) {
    if (!sender?.replaceTrack) throw new Error(`Sender ${kind || 'media'} unavailable`);
    if (!isLiveTrack(track, kind)) throw new Error(`Local ${kind || 'media'} track not live`);
    await sender.replaceTrack(track);
    if (sender.track !== undefined && sender.track !== track) throw new Error(`Local ${kind} sender binding not confirmed`);
    const settings = track.getSettings?.() || {};
    onBound?.({
      source: kind === 'video' ? source : 'pc',
      kind,
      readyState: track.readyState,
      enabled: track.enabled !== false,
      width: kind === 'video' ? settings.width || null : null,
      height: kind === 'video' ? settings.height || null : null,
      generation
    });
    return track;
  }

  async function bindLocalTracks({ videoSender, audioSender, videoTrack, audioTrack, source, generation, onBound }) {
    const video = await bindSenderTrack(videoSender, videoTrack, { kind: 'video', source, generation, onBound });
    const audio = await bindSenderTrack(audioSender, audioTrack, { kind: 'audio', source, generation, onBound });
    return { video, audio };
  }

  function localSendersReady({ videoSender, audioSender, videoTrack, audioTrack }) {
    return isLiveTrack(videoTrack, 'video') && isLiveTrack(audioTrack, 'audio') &&
      videoSender?.track === videoTrack && audioSender?.track === audioTrack;
  }

  function recoveryAction(role) {
    return role === 'host' ? 'offer' : 'restart-request';
  }

  function videoSourceOptions(phoneAvailable) {
    return [...(phoneAvailable ? [{ value: 'phone', label: 'Téléphone' }] : []), { value: 'webcam', label: 'Webcam PC' }];
  }

  async function acquirePcWebcam(mediaDevices) {
    if (!mediaDevices?.getUserMedia) throw new Error('Webcam API unavailable');
    return mediaDevices.getUserMedia({ video: true, audio: false });
  }

  const api = { isLiveTrack, bindSenderTrack, bindLocalTracks, localSendersReady, recoveryAction, videoSourceOptions, acquirePcWebcam };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.TCGateMediaRecovery = api;
})();
