(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;if(root)root.TCGWorkspaceLabProvider=api;})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  // Lab-only adapter. Reuses the production DB validator, never its registry or cache.
  function normalizeUrl(input){
    const url=new URL(String(input).trim());
    if(url.username||url.password||url.search||url.hash||url.protocol!=='https:')throw Error('URL manifest HTTPS publique sans identifiants ni paramètres requise');
    if(url.hostname==='github.com'){
      const parts=url.pathname.split('/').filter(Boolean);
      if(parts[2]!=='blob'||parts.length<5)throw Error('Utiliser une URL GitHub blob ou raw');
      url.hostname='raw.githubusercontent.com';parts.splice(2,1);url.pathname='/'+parts.join('/');
    }
    if(url.origin!=='https://raw.githubusercontent.com'||!/^\/[^/]+\/[^/]+\/[^/]+\/.+manifest\.json$/.test(url.pathname.replace('/manifest.json','/db-manifest.json')))throw Error('Manifest GitHub/raw attendu');
    return url.href;
  }
  function diagnostic(database, manifest, meta, url, multilingual){
    return {gameId:manifest.game_id||manifest.game,version:manifest.database_version||manifest.databaseVersion,schemaVersion:meta.schemaVersion||manifest.schema_version||null,
      status:manifest.database_status||manifest.status||meta.status||'inconnu',snapshot:meta.activeSnapshot||manifest.snapshot||null,manifestUrl:url,
      sourceRef:new URL(url).pathname.split('/')[3],qualified:false,labOnly:true,
      locales:manifest.availableLocales||meta.locales?.availableLocales||[],defaultLocale:manifest.defaultLocale||meta.locales?.defaultLocale||null,
      localeCoverage:multilingual?.localizationCoverage||null,cards:database.cards.length,printings:database.printings.length,
      visionReferences:database.references.length,recognitionGroups:database.recognitionGroups.length,unloadableReferences:null,
      visionCoverage:{coveredCards:new Set(database.references.map(r=>r.cardId)).size,totalCards:database.cards.length}};
  }
  async function prepare(input, dependencies={}){
    const url=normalizeUrl(input),api=dependencies.source||globalThis.TCGateDatabaseSource,fetchImpl=dependencies.fetchImpl||globalThis.fetch;
    if(!api||typeof fetchImpl!=='function')throw Error('Chargeur DB indisponible');
    async function read(address){
      const response=await fetchImpl(address,{credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});
      if(!response.ok)throw Error('Manifest/DB HTTP '+response.status);
      const text=await response.text();if(text.length>12000000)throw Error('Ressource DB trop volumineuse');return JSON.parse(text);
    }
    const manifest=await read(url);
    const paths=[manifest.database_manifest,manifest.entrypoint||manifest.runtime_cards,manifest.runtime_printings,manifest.canonical_vision_index,manifest.printing_recognition_index,manifest.recognition_groups];
    if(paths.some(p=>typeof p!=='string'||!p))throw Error('Manifest DB incomplet : ressources runtime requises');
    const [meta,cards,printings,canonical,index,groups]=await Promise.all(paths.map(p=>read(api.resolveUrl(url,p))));
    if(!Array.isArray(cards)||!cards.length||cards.length>10000||!Array.isArray(printings)||!Array.isArray(groups.recognitionGroups))throw Error('Collections DB invalides');
    const config={manifestUrl:url,expectedGame:manifest.game_id||manifest.game,expectedVersion:manifest.database_version||manifest.databaseVersion,
      expectedStatus:manifest.database_status||meta.database_status||meta.status,expectedRuntimeScope:manifest.runtime_scope||meta.runtimeScope,
      expectedRuntimeReady:manifest.runtime_ready??meta.runtimeReady,expectedCanonicalCards:cards.length,expectedRuntimePrintings:printings.length,expectedRecognitionGroups:groups.recognitionGroups.length,expectedMatcherReferences:groups.recognitionGroups.reduce((sum,g)=>sum+(g.candidatePrintingIds||g.printingIds||[]).length,0)};
    if(typeof config.expectedGame!=='string'||!config.expectedGame||typeof config.expectedVersion!=='string'||!config.expectedVersion)throw Error('Jeu/version DB absents');
    const db=api.validate(config,manifest,meta,cards,printings,canonical,index,groups);
    if(!db.references.length||db.references.some(r=>!db.cardsById.get(r.cardId)?.name))throw Error('Références ou noms de cartes absents');
    let multilingual=null;if(manifest.multilingual_coverage)multilingual=await read(api.resolveUrl(url,manifest.multilingual_coverage));
    const info=diagnostic(db,manifest,meta,url,multilingual);
    const normalized=db.references.map(r=>({...db.cardsById.get(r.cardId),...r,name:db.cardsById.get(r.cardId).name,type:db.cardsById.get(r.cardId).type||'',image:r.refId,imageUrl:r.displayImageUrl,referenceImageUrl:r.referenceImageUrl}));
    const sourceRef=info.sourceRef,immutable=/^[a-f0-9]{40}$/i.test(sourceRef);
    return Object.freeze({diagnostic:info,loadCardList:async()=>({cards:normalized,source:'Manifest de test · LAB ONLY · non qualifié',sourceUrl:url,sourceRef,sourceImmutable:immutable,sourceAssetBase:null,sourceError:null,
      databaseInfo:{...db.manifest,game:info.gameId,schemaVersion:info.schemaVersion,locales:info.locales,databaseStatus:info.status,databaseVersion:info.version,labOnly:true,qualified:false}})});
  }
  function feedback(kind,recognizedAs,note,source,vision,identification,crop,parameters){
    if(!['correct','wrong_identification','non_identification','false_positive'].includes(kind))throw Error('Feedback invalide');
    if(kind==='wrong_identification'&&!String(recognizedAs).trim())throw Error('Renseigner recognizedAs');
    return {timestamp:new Date().toISOString(),kind,recognizedAs:kind==='wrong_identification'?String(recognizedAs).trim():null,note:String(note||''),source,
      result:identification.identification||null,top5:identification.identification?.candidates||[],score:identification.identification?.best?.matcherScore??null,
      margin:identification.identification?.margin??null,rejectionReason:identification.identification?.rejectionReason||null,crop:crop||null,parameters,vision,identification};
  }
  return Object.freeze({normalizeUrl,prepare,feedback});
});
