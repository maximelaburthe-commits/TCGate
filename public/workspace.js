'use strict';
(()=>{
  const $=id=>document.getElementById(id),rawStateUrl='https://raw.githubusercontent.com/maximelaburthe-commits/TCGate/workspace-state/tcgate_workspace_state.json';
  const text=(tag,value,parent)=>{const e=document.createElement(tag);e.textContent=String(value??'Non renseigné');parent.append(e);return e;};
  const summary=(id,entries)=>{const parent=$(id);parent.replaceChildren();for(const [label,value]of entries){text('dt',label,parent);text('dd',typeof value==='object'&&value!==null?JSON.stringify(value):value,parent);}};
  const link=(label,url,parent)=>{const e=text('a',label,parent);e.href=url;e.target='_blank';e.rel='noopener noreferrer';e.className='button';return e;};
  document.querySelectorAll('[data-tab]').forEach(button=>button.addEventListener('click',()=>{
    document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-selected',String(b===button)));
    document.querySelectorAll('[role=tabpanel]').forEach(p=>p.hidden=p.id!=='panel-'+button.dataset.tab);
    if(button.dataset.tab==='lab')ensureDetectionRuntime().catch(()=>{});
  }));
  async function loadState(){
    try{const response=await fetch(rawStateUrl,{credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('HTTP '+response.status);
      const state=await response.json();if(!Array.isArray(state.items)||!state.session)throw Error('État canonique invalide');
      $('workspaceStateStatus').textContent='État canonique · Workspace '+state.meta?.workspaceVersion+' · '+(state.meta?.generatedAt||'date inconnue');
      const home=$('content-reprise');text('h2','Reprise',home);
      for(const [key,label] of [['activeWork','Travaux actifs'],['priorities','Priorités'],['decisions','Décisions ouvertes']]){
        text('h3',label,home);for(const item of state.session[key]||[]){const a=text('article','',home);text('strong',item.title,a);text('p',item.detail,a);text('small',item.status,a);}
      }
      text('p',state.session.notes||'',home);
      for(const [id,label] of [['general','Général'],['vision','Vision'],['uiux','UI / UX'],['annex','Fonctions annexes']]){
        const panel=$('content-'+id);text('h2',label,panel);for(const item of state.items.filter(i=>i.category===id)){
          const a=text('article','',panel);text('h3',item.name,a);text('p',item.summary,a);text('small',[item.status,item.version,item.maturity,item.progress+' %'].join(' · '),a);text('p',item.notes||'',a);
          if(item.history?.length){const d=text('details','',a);text('summary','Historique',d);item.history.forEach(h=>text('p',h.date+' · '+h.text,d));}
        }
      }
    }catch(error){$('workspaceStateStatus').textContent='État canonique indisponible : '+error.message+'. Le Vision Lab reste indépendant.';}
  }
  loadState();
  function renderDatabases(){for(const db of window.TCGWorkspaceDatabases){
    const card=text('article','',$('databaseCards'));text('h3',db.label,card);const production=window.TCGateGameDatabases.get(db.gameId);
    text('strong',production?'ACTIVE · '+production.expectedVersion:'ACTIVE · non configurée',card);
    if(production){text('p','SHA actif : '+production.manifestUrl.split('/')[5],card);text('p','Statut : '+production.expectedStatus+' · snapshot/locales : non exposés dans la configuration active.',card);link('Manifest actif',production.manifestUrl,card);}else text('p','Version, SHA et snapshot : non qualifiés / non configurés.',card);
    text('p',db.source,card);
    if(db.candidate){const c=db.candidate;text('h3','DEVELOPMENT / CANDIDATE · '+c.status,card);text('p','Version '+c.version+' · schema '+c.schema+' · locales '+c.locales.join(' / '),card);text('p','Checkpoint '+c.sha,card);text('p',c.detail,card);text('p','Snapshot : à inspecter dans le manifest candidate.',card);text('p','Blockers : '+c.blockers.join(' ; '),card);}
    else text('p','Aucune Candidate',card);
    const actions=text('div','',card);actions.className='toolbar';link('Vérifier / Mettre à jour',db.updateWorkflowUrl||db.actionsUrl,actions);
    if(!db.updateWorkflowUrl)text('small','Workflow de mise à jour non configuré · ouvre GitHub Actions.',card);
    if(db.candidateUrl)link('Voir la Candidate',db.candidateUrl,actions);else{const disabled=text('button','Aucune Candidate',actions);disabled.disabled=true;}
    link('Voir la DB GitHub',db.repositoryUrl,actions);
  }}renderDatabases();
  let provider=null,sourceInfo=null,started=false,inspecting=false,lastObservation=null;const feedback=[];
  $('labSource').addEventListener('change',()=>{provider=null;sourceInfo=null;$('labDatabase').textContent='';$('labDatabaseSummary').replaceChildren();$('labStart').disabled=true;$('labManifestLabel').hidden=$('labSource').value!=='test';});
  $('labManifestUrl').addEventListener('input',()=>{provider=null;sourceInfo=null;$('labStart').disabled=true;});
  $('labReload').addEventListener('click',()=>location.reload());
  $('labInspect').addEventListener('click',async()=>{
    if(started||inspecting)return;inspecting=true;provider=null;sourceInfo=null;$('labStart').disabled=true;$('labInspect').disabled=true;$('labSource').disabled=true;$('labManifestUrl').disabled=true;
    $('labStatus').textContent='Inspection de la BDD…';
    try{if($('labSource').value==='test'){
      provider=await window.TCGWorkspaceLabProvider.prepare($('labManifestUrl').value);sourceInfo=provider.diagnostic;
    }else{const db=await window.TCGateDatabaseSource.load('cyberpunk');const m=db.manifest;
      const inspected=await window.TCGWorkspaceLabProvider.prepare(window.TCGateGameDatabases.get('cyberpunk').manifestUrl);
      sourceInfo={...inspected.diagnostic,gameId:m.gameId,version:m.databaseVersion,status:m.databaseStatus,manifestUrl:window.TCGateGameDatabases.get('cyberpunk').manifestUrl,sourceRef:m.sourceCommit,
        cards:db.cards.length,printings:db.printings.length,visionReferences:db.references.length,recognitionGroups:db.recognitionGroups.length,
        unloadableReferences:null,visionCoverage:{coveredCards:new Set(db.references.map(r=>r.cardId)).size,totalCards:db.cards.length}};
    }
    $('labDatabase').textContent=JSON.stringify(sourceInfo,null,2);summary('labDatabaseSummary',[['Jeu',sourceInfo.gameId],['Version',sourceInfo.version],['Schema',sourceInfo.schemaVersion],['Statut',sourceInfo.status],['Snapshot',sourceInfo.snapshot],['Locales',sourceInfo.locales.join(' / ')||'Non exposées'],['Défaut',sourceInfo.defaultLocale],['Cartes',sourceInfo.cards],['Printings',sourceInfo.printings],['Références Vision',sourceInfo.visionReferences],['Groupes',sourceInfo.recognitionGroups],['Couverture',sourceInfo.visionCoverage],['Par locale',sourceInfo.localeCoverage||'Non exposée']]);$('labStatus').textContent='Source inspectée. Assets : contrôlés lors de la construction de bibliothèque. Champs null : non exposés par le manifest.';$('labStart').disabled=false;
    }catch(error){$('labDatabase').textContent='';$('labDatabaseSummary').replaceChildren();$('labStatus').textContent='BDD invalide ou indisponible : '+error.message;}
    finally{inspecting=false;$('labInspect').disabled=false;$('labSource').disabled=false;$('labManifestUrl').disabled=false;}
  });
  // Camera/tracking has no dependency on a manifest, corpus, or matcher.
  const detectionScripts=['/vision-frame-gate.js','/vision-analysis-frame.js','/vision-appearance-sampler.js','/vision-core.js'];
  const identificationScripts=['/vision-library-integrity.js','/identification.js'];
  const scriptLoads=new Map();
  function loadScript(src){
    if(!scriptLoads.has(src))scriptLoads.set(src,new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src=src;script.onload=resolve;
      script.onerror=()=>{script.remove();scriptLoads.delete(src);reject(Error('Chargement impossible : '+src));};document.head.append(script);
    }));return scriptLoads.get(src);
  }
  let detectionRuntime=null;
  function cameraAvailability(){return window.TCGWorkspaceCameraStatus.availability(window.isSecureContext,navigator.mediaDevices);}
  function updateRuntimeStatus(){
    const state=window.TCGDetectionLab?.state,video=$('remoteVideo');
    const warning=$('visionRuntimeWarning').textContent;
    const cameraError=/Caméra|Camera/.test(warning)?window.TCGWorkspaceCameraStatus.error(warning):null;
    $('labCameraStatus').textContent=state?.stream?'Caméra : active · '+video.videoWidth+'×'+video.videoHeight:'Caméra : '+(cameraAvailability()||cameraError||'arrêtée');
    $('labDetectionStatus').textContent='Détection : '+(state?.detecting?'active':state?.modelLoading?'chargement du modèle…':'arrêtée');
  }
  function ensureDetectionRuntime(){
    if(detectionRuntime)return detectionRuntime;
    $('labCameraStatus').textContent='Caméra : chargement des contrôles…';
    detectionRuntime=(async()=>{
      for(const src of detectionScripts)await loadScript(src);
      window.TCGVisionEngine.setDebugOverlay(true);
      $('visionCameraButton').disabled=Boolean(cameraAvailability());
      updateRuntimeStatus();
    })().catch(error=>{detectionRuntime=null;$('labCameraStatus').textContent='Caméra & détection : '+error.message+' · rouvrir l’onglet pour réessayer.';throw error;});
    return detectionRuntime;
  }
  // Vision Core owns getUserMedia, enumerateDevices, switching cameras and stopping tracks.
  // Its raw camera warnings are translated here without changing the product engine.
  $('visionCameraButton').addEventListener('click',event=>{
    const unavailable=cameraAvailability();
    if(unavailable){event.stopImmediatePropagation();$('labCameraStatus').textContent='Caméra : '+unavailable;return;}
    $('visionRuntimeWarning').textContent='';
    $('labCameraStatus').textContent=window.TCGDetectionLab?.state.stream?'Caméra : arrêt en cours…':'Caméra : demande d’autorisation…';
  },true);
  $('visionCaptureButton').addEventListener('click',async event=>{
    event.stopImmediatePropagation();
    const lab=window.TCGDetectionLab;if(!lab)return;
    const count=lab.state.captures.length;
    const source=sourceInfo?structuredClone(sourceInfo):null;
    const observation=lastObservation?structuredClone(lastObservation):null;
    try{await lab.captureCase('workspace-button');
      const capture=lab.state.captures[count];if(capture){capture.labSource=source;capture.labObservation=observation;}
    }catch(error){$('labFeedbackStatus').textContent='Capture impossible : '+error.message;}
  },true);
  new MutationObserver(updateRuntimeStatus).observe($('visionRuntimeWarning'),{childList:true,subtree:true,characterData:true});
  window.addEventListener('tcg-camera-state',updateRuntimeStatus);
  window.addEventListener('tcg-identification-library',event=>{
    const ready=Boolean(event.detail.ready&&event.detail.workerReady);
    $('identificationToggle').disabled=!ready;$('identificationToggle').checked=ready;
    $('labStatus').textContent=ready?'Identification : active':'Identification : indisponible · consulter la bibliothèque et le matcher. Caméra et détection restent disponibles.';
  });
  $('labStart').addEventListener('click',async()=>{
    if(started||!sourceInfo)return;started=true;$('labStart').disabled=true;$('labInspect').disabled=true;$('labSource').disabled=true;$('labManifestUrl').disabled=true;
    try{
      await ensureDetectionRuntime();
      if(provider)window.TCGWorkspaceLabProviderInstance=provider;
      for(const src of identificationScripts)await loadScript(src);
      $('labStatus').textContent='Identification : construction des références et démarrage du matcher…';
      const result=await window.TCGIdentificationLab.start();
      const ready=Boolean(result.ready&&result.workerReady);
      $('identificationToggle').disabled=!ready;$('identificationToggle').checked=ready;$('identRefreshButton').disabled=false;
      $('labStatus').textContent=ready?'Identification : active · BDD '+sourceInfo.version:'Identification : indisponible · consulter les diagnostics. Caméra et détection restent disponibles.';
      refresh();
    }catch(error){$('labStatus').textContent='Identification indisponible : '+error.message+'. Caméra et détection restent disponibles ; nouvelle session pour réessayer.';}
  });
  function parameters(){const s=window.TCGDetectionLab?.state;return s?{confidence:s.confidence,intervalMs:s.intervalMs,confirmations:s.confirmationsNeeded,misses:s.maxMisses,identityMemoryMs:s.identityMemoryMs,reidSimilarity:s.reidSimilarity,
    tracking:$('visionTrackingToggle').checked,shapeFilter:$('visionShapeFilterToggle').checked,visualLock:$('visionVisualLockToggle').checked,resolution:$('visionResolutionSelect').value}:{};}
  function refresh(){if(!window.TCGIdentificationLab)return;const live=window.TCGIdentificationLab.getSnapshot();
    if(live.identification)lastObservation={timestamp:new Date().toISOString(),identification:live,vision:window.TCGVisionEngine.getSnapshot(),crop:window.TCGIdentificationLab.getAnalyzedCropDataUrl(),parameters:parameters()};
    const snapshot=lastObservation?.identification||live,result=snapshot.identification;
    $('labRecognition').textContent=JSON.stringify({libraryReady:snapshot.libraryReady,librarySize:snapshot.librarySize,matcher:snapshot.matcherWorker,matcherMs:snapshot.matcherMs,
      accepted:result?.accepted??null,best:result?.best||null,margin:result?.margin??null,rejectionReason:result?.rejectionReason||null,mode:result?.mode||null,quality:result?.quality||null,glare:snapshot.qualityGuard?.last||null,
      unloadableReferences:snapshot.libraryIntegrity?.failedReferences??null,integrity:snapshot.libraryIntegrity},null,2);
    summary('labRecognitionSummary',[['Résultat',result?(result.accepted?'Accepté':'Refusé'):'En attente'],['Meilleur candidat',result?.best?.name],['Score / indice',result?result.best?.matcherScore+' / '+result.best?.visualIndex:null],['Marge',result?.margin],['Motif',result?.rejectionReason||(result&&!result.accepted?'Seuil score / marge du moteur':'—')],['Mode',result?.mode],['Qualité / glare',result?.quality],['Matcher (ms)',snapshot.matcherMs],['Assets échoués',live.libraryIntegrity?.failedReferences]]);
    $('labTop5').replaceChildren();for(const candidate of result?.candidates||[]){const row=text('tr','',$('labTop5'));for(const value of [candidate.rank,candidate.name,Number(candidate.matcherScore).toFixed(4),candidate.visualIndex])text('td',value,row);}
    const crop=lastObservation?.crop||null;$('labCrop').hidden=!crop;if(crop)$('labCrop').src=crop;
  }
  window.addEventListener('tcg-identification-result',()=>queueMicrotask(refresh));
  setInterval(()=>{if(!$('panel-lab').hidden){updateRuntimeStatus();if(started)refresh();}},250);
  document.querySelectorAll('[data-feedback]').forEach(button=>button.addEventListener('click',()=>{
    try{const id=window.TCGIdentificationLab?.getSnapshot();if(!id)throw Error('Démarrer le Lab avant de saisir un feedback');
      if(feedback.length>=100)throw Error('Maximum de 100 feedbacks : exporter puis ouvrir une nouvelle session');
      feedback.push({...window.TCGWorkspaceLabProvider.feedback(button.dataset.feedback,$('recognizedAs').value,$('visionCaseNote').value,sourceInfo,lastObservation?.vision||window.TCGVisionEngine.getSnapshot(),lastObservation?.identification||id,lastObservation?.crop||null,lastObservation?.parameters||parameters()),observationTimestamp:lastObservation?.timestamp||null});
      $('labFeedbackCount').textContent=feedback.length+' feedback';$('labFeedbackStatus').textContent='Feedback conservé dans cette session locale.';
    }catch(error){$('labFeedbackStatus').textContent=error.message;}
  }));
  $('labExport').addEventListener('click',async()=>{
    try{const captures=await Promise.all((window.TCGDetectionLab?.state.captures||[]).map(async c=>{const data=blob=>new Promise((resolve,reject)=>{if(!blob)return resolve(null);const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});
      return {id:c.id,source:c.labSource??null,observation:c.labObservation??null,meta:c.meta,raw:await data(c.rawBlob),overlay:await data(c.overlayBlob),crop:await data(c.hoveredCardBlob)};}));
      const payload={format:'tcgate-workspace-lab-v1',exportedAt:new Date().toISOString(),source:sourceInfo,feedback,captures,lastObservation,labState:{cameraActive:Boolean(window.TCGDetectionLab?.state.stream),detecting:Boolean(window.TCGDetectionLab?.state.detecting)},parameters:parameters(),detection:window.TCGVisionEngine?.getSnapshot(),identification:window.TCGIdentificationLab?.getSnapshot()};
      const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='tcgate-vision-lab-'+Date.now()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(error){$('labFeedbackStatus').textContent='Export impossible : '+error.message;}
  });
})();
