'use strict';

(() => {
  function kindFromLabel(label = '') {
    const value = String(label).toLowerCase();
    if (/front|user|face|avant/.test(value)) return 'front';
    if (/ultra|0[.,]5|grand.?angle|ultrawide|ultra.?wide/.test(value)) return 'ultrawide';
    if (/tele|télé|2x|3x|4x|5x/.test(value)) return 'tele';
    if (/back|rear|environment|arrière|world/.test(value)) return 'rear';
    return 'unknown';
  }

  function selectableVideoInputs(devices = []) {
    const cameras = devices.filter(device => device?.kind === 'videoinput');
    const nonFront = cameras.filter(device => kindFromLabel(device.label) !== 'front');
    return nonFront.length ? nonFront : cameras;
  }

  function displayLabel(device, index, total) {
    const kind = kindFromLabel(device?.label);
    if (kind === 'ultrawide') return 'Ultra grand-angle';
    if (kind === 'tele') return 'Téléobjectif';
    if (kind === 'rear' && index === 0) return 'Caméra principale';
    if (kind === 'front') return 'Caméra avant';
    if (total === 1) return 'Caméra principale';
    return `Caméra arrière ${index + 1}`;
  }

  function publicCameraList(devices, activeDeviceId = '', aliasFor = (_, index) => `camera-${index + 1}`) {
    const cameras = selectableVideoInputs(devices);
    return cameras.map((device, index) => ({
      id: aliasFor(device, index),
      label: displayLabel(device, index, cameras.length),
      kind: kindFromLabel(device.label),
      active: Boolean(activeDeviceId && device.deviceId === activeDeviceId)
    }));
  }

  function resolveOpaqueCamera(devices, cameraId, aliasFor = (_, index) => `camera-${index + 1}`) {
    return devices.find((device, index) => aliasFor(device, index) === cameraId) || null;
  }

  async function replaceTrackSafely(sender, oldTrack, newTrack) {
    if (!sender || !newTrack) throw new Error('Piste caméra invalide');
    await sender.replaceTrack(newTrack);
    if (oldTrack && oldTrack !== newTrack) oldTrack.stop();
    return newTrack;
  }

  const api = { kindFromLabel, selectableVideoInputs, displayLabel, publicCameraList, resolveOpaqueCamera, replaceTrackSafely };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.TCGatePhoneCameraDevices = api;
})();
