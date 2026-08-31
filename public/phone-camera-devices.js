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

  function isCameraBusyError(error) {
    const name = String(error?.name || '');
    const message = String(error?.message || '');
    return name === 'NotReadableError' || name === 'AbortError' ||
      /busy|in use|already.*use|could not start video|camera.*occup/i.test(message);
  }

  async function runCameraSwitch({
    acquireTarget,
    activateTarget,
    stopCurrent,
    acquirePrevious,
    activatePrevious,
    verifyTarget = () => true
  }) {
    let directTarget = null;
    try {
      directTarget = await acquireTarget();
      if (!verifyTarget(directTarget)) throw Object.assign(new Error('La caméra obtenue ne correspond pas à l’objectif demandé'), { name: 'CameraMismatchError' });
      await activateTarget(directTarget, 'seamless');
      return { strategy: 'seamless', rollbackRestored: false };
    } catch (error) {
      if (directTarget || !isCameraBusyError(error)) throw error;
    }

    stopCurrent();
    let fallbackTarget = null;
    try {
      fallbackTarget = await acquireTarget();
      if (!verifyTarget(fallbackTarget)) throw Object.assign(new Error('La caméra obtenue ne correspond pas à l’objectif demandé'), { name: 'CameraMismatchError' });
      await activateTarget(fallbackTarget, 'controlled-handoff');
      return { strategy: 'controlled-handoff', rollbackRestored: false };
    } catch (switchError) {
      fallbackTarget?.stream?.getTracks?.().forEach(track => track.stop());
      try {
        const previous = await acquirePrevious();
        await activatePrevious(previous);
        const error = new Error(switchError?.message || 'Changement de caméra impossible');
        error.name = switchError?.name || 'CameraSwitchError';
        error.rollbackRestored = true;
        throw error;
      } catch (rollbackError) {
        if (rollbackError?.rollbackRestored) throw rollbackError;
        const error = new Error(switchError?.message || 'Caméra téléphone indisponible');
        error.name = switchError?.name || 'CameraSwitchError';
        error.rollbackRestored = false;
        error.rollbackErrorName = rollbackError?.name || 'Error';
        throw error;
      }
    }
  }

  const api = {
    kindFromLabel,
    selectableVideoInputs,
    displayLabel,
    publicCameraList,
    resolveOpaqueCamera,
    replaceTrackSafely,
    isCameraBusyError,
    runCameraSwitch
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.TCGatePhoneCameraDevices = api;
})();
