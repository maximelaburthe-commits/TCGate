'use strict';

(() => {
  function object(value){return Boolean(value)&&typeof value==='object'&&!Array.isArray(value);}
  function keys(value,expected){return object(value)&&Object.keys(value).length===expected.length&&expected.every(key=>Object.hasOwn(value,key));}
  function range(value){return object(value)&&typeof value.min==='number'&&typeof value.max==='number'&&Number.isFinite(value.min)&&Number.isFinite(value.max)&&value.min>=0&&value.max>=value.min;}
  function contains(value,number){return range(value)&&number>=value.min&&number<=value.max;}
  function availableCaptureProfiles(phoneState={}){
    const caps=phoneState?.captureCapabilities||{},profiles=['auto'];
    for(const [name,width,height]of [['1280x720',1280,720],['1920x1080',1920,1080]])if(contains(caps.width,width)&&contains(caps.height,height)&&contains(caps.frameRate,30))profiles.push(name);
    return profiles;
  }
  function validatePhoneControlPayload(payload,phoneState={}){
    if(!keys(payload,['requestId','action','args'])||typeof payload.requestId!=='string'||!/^[A-Za-z0-9_-]{6,80}$/.test(payload.requestId))return false;
    const args=payload.args;
    if(payload.action==='select-camera')return keys(args,['cameraId'])&&typeof args.cameraId==='string'&&/^camera-[1-9][0-9]{0,2}$/.test(args.cameraId);
    if(payload.action==='request-state'||payload.action==='stop-camera')return keys(args,[]);
    if(payload.action==='set-quality')return keys(args,['mode'])&&typeof args.mode==='string'&&availableCaptureProfiles(phoneState).includes(args.mode);
    const zoom=phoneState?.zoom;
    if(!range(zoom)||zoom.max>100||zoom.max===zoom.min)return false;
    if(payload.action==='wide')return keys(args,[]);
    if(payload.action!=='set-zoom'||!keys(args,['value'])||typeof args.value!=='number'||!Number.isFinite(args.value)||args.value<0||args.value>100||!contains(zoom,args.value))return false;
    if(zoom.step!=null&&(!Number.isFinite(zoom.step)||zoom.step<=0||Math.abs((args.value-zoom.min)/zoom.step-Math.round((args.value-zoom.min)/zoom.step))>1e-6))return false;
    return true;
  }

  class PhoneCameraControlWaiter {
    constructor(timeoutMs = 8000) {
      this.timeoutMs = timeoutMs;
      this.pending = new Map();
    }

    wait(requestId) {
      if (!requestId || this.pending.has(requestId)) throw new Error('requestId de contrôle invalide');
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          this.pending.delete(requestId);
          const error = new Error('Délai de réponse du téléphone dépassé');
          error.name = 'TimeoutError';
          reject(error);
        }, this.timeoutMs);
        this.pending.set(requestId, { resolve, reject, timer });
      });
    }

    settle(payload = {}) {
      const requestId = String(payload.requestId || '');
      const pending = this.pending.get(requestId);
      if (!pending) return false;
      clearTimeout(pending.timer);
      this.pending.delete(requestId);
      if (payload.ok) pending.resolve(payload);
      else {
        const error = new Error(payload.error || 'Commande refusée');
        error.name = payload.errorName || 'PhoneCameraControlError';
        error.rollbackRestored = payload.rollbackRestored ?? null;
        pending.reject(error);
      }
      return true;
    }

    cancel(requestId, message = 'Commande annulée') {
      const pending = this.pending.get(requestId);
      if (!pending) return false;
      clearTimeout(pending.timer);
      this.pending.delete(requestId);
      pending.reject(new Error(message));
      return true;
    }

    cancelAll(message = 'Téléphone dissocié') {
      for (const requestId of [...this.pending.keys()]) this.cancel(requestId, message);
    }
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { PhoneCameraControlWaiter, validatePhoneControlPayload, availableCaptureProfiles };
  if (typeof window !== 'undefined') window.TCGatePhoneCameraControl = { PhoneCameraControlWaiter, validatePhoneControlPayload, availableCaptureProfiles };
})();
