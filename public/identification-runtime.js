'use strict';

(() => {
  const cyberpunk=window.TCGIdentificationLab;
  let active=null;
  const api={
    async start({runtimeId}={}){if(active&&active.runtimeId!==runtimeId)active.api.stop?.();if(runtimeId==='cyberpunk'){active={runtimeId,api:cyberpunk};return cyberpunk?.start?.({runtimeId});}if(runtimeId==='swu-r14'){active={runtimeId,api:window.TCGateSwuIdentification};return window.TCGateSwuIdentification?.start?.();}throw new Error(`Runtime Vision inconnu: ${runtimeId}`);},
    stop(){active?.api?.stop?.();active=null;},
    getSnapshot(){return active?.api?.getSnapshot?.()||null;},
    preloadImage(...args){return active?.api?.preloadImage?.(...args);},
    clearVisibleForHandoff(...args){return active?.api?.clearVisibleForHandoff?.(...args);},
    showMemoryIdentity(...args){return active?.api?.showMemoryIdentity?.(...args);},
    getAnalyzedCropDataUrl(...args){return active?.api?.getAnalyzedCropDataUrl?.(...args);}
  };
  window.TCGateIdentificationRuntime=Object.freeze(api);
  window.TCGIdentificationLab=window.TCGateIdentificationRuntime;
})();
