(function initDatabaseSource(root, factory) {
  const configApi = root?.TCGateGameDatabases || (typeof require === 'function' ? require('./game-databases.js') : null);
  const api = factory(configApi);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TCGateDatabaseSource = api;
})(typeof window !== 'undefined' ? window : globalThis, function createDatabaseSource(configApi) {
  'use strict';

  const sessionCache = new Map();
  const PUBLIC_RAW_ORIGIN = 'https://raw.githubusercontent.com';

  function resolveUrl(manifestUrl, relativePath) {
    const value=String(relativePath||'').trim();
    if(!value||value.startsWith('/')||value.includes('\\')||value.split('/').some(part=>!part||part==='.'||part==='..'))throw new Error('Chemin DB non autorisé');
    const base=new URL(manifestUrl),resolved=new URL(value,base);
    const repositoryRoot=base.pathname.slice(0,base.pathname.lastIndexOf('/')+1);
    if(resolved.origin!==PUBLIC_RAW_ORIGIN||resolved.origin!==base.origin||!resolved.pathname.startsWith(repositoryRoot))throw new Error('Origine DB non autorisée');
    return resolved.href;
  }

  async function fetchJson(fetchImpl,url,metrics) {
    const started=performance.now();
    const response=await fetchImpl(url,{cache:'force-cache',credentials:'omit'});
    if(!response.ok)throw new Error(`DB HTTP ${response.status} : ${url}`);
    const text=await response.text();
    metrics.requests+=1;metrics.bytes+=new TextEncoder().encode(text).length;metrics.resources[url]=performance.now()-started;
    return JSON.parse(text);
  }

  function validate(config,manifest,databaseManifest,cards,printings,canonicalIndex,printingIndex,groupsIndex) {
    const gameId=manifest.game_id||manifest.game;
    const databaseVersion=manifest.database_version||manifest.databaseVersion;
    const databaseStatus=manifest.database_status||databaseManifest?.database_status||databaseManifest?.status;
    const runtimeScope=manifest.runtime_scope||databaseManifest?.runtimeScope;
    const runtimeReady=manifest.runtime_ready??databaseManifest?.runtimeReady;
    if(gameId!==config.expectedGame)throw new Error('Manifest DB : jeu invalide');
    if(databaseVersion!==config.expectedVersion)throw new Error('Manifest DB : version incompatible');
    if(databaseStatus!==config.expectedStatus)throw new Error('Manifest DB : statut invalide');
    if(runtimeScope!==config.expectedRuntimeScope)throw new Error('Manifest DB : scope runtime invalide');
    if(runtimeReady!==config.expectedRuntimeReady)throw new Error('Manifest DB : runtime non qualifie');
    if(!Array.isArray(cards)||cards.length!==config.expectedCanonicalCards)throw new Error('Runtime DB : cardinalité canonique invalide');
    if(!Array.isArray(printings)||printings.length!==config.expectedRuntimePrintings)throw new Error('Runtime DB : cardinalité impressions invalide');
    const canonicalReferences=canonicalIndex?.references;
    const recognitionGroups=groupsIndex?.recognitionGroups;
    const printingCards=printingIndex?.cards;
    if(!Array.isArray(canonicalReferences)||canonicalReferences.length!==cards.length)throw new Error('Runtime DB : index Vision canonique invalide');
    if(!Array.isArray(recognitionGroups)||recognitionGroups.length!==config.expectedRecognitionGroups||!Array.isArray(printingCards))throw new Error('Runtime DB : groupes de reconnaissance invalides');

    const cardsById=new Map(),printingsById=new Map(),richGroups=new Map();
    for(const card of cards){if(!card?.cardId||cardsById.has(card.cardId))throw new Error('Runtime DB : cardId invalide ou dupliqué');cardsById.set(card.cardId,Object.freeze({...card}));}
    for(const printing of printings){if(!printing?.printingId||printingsById.has(printing.printingId)||!cardsById.has(printing.cardId))throw new Error('Runtime DB : impression invalide ou orpheline');printingsById.set(printing.printingId,Object.freeze({...printing}));}
    for(const cardEntry of printingCards)for(const group of cardEntry?.recognitionGroups||[]){if(group?.recognitionGroupId)richGroups.set(group.recognitionGroupId,group);}

    const references=recognitionGroups.flatMap(group=>{
      const canonical=cardsById.get(group.cardId),rich=richGroups.get(group.recognitionGroupId);
      const candidatePrintingIds=Array.isArray(group.candidatePrintingIds)?group.candidatePrintingIds:Array.isArray(group.printingIds)?group.printingIds:[];
      if(!canonical||!rich||!candidatePrintingIds.length||candidatePrintingIds.some(id=>printingsById.get(id)?.cardId!==group.cardId))throw new Error('Runtime DB : groupe orphelin');
      const sourceReferences=(rich.references||[]).filter(ref=>candidatePrintingIds.includes(ref.printingId)&&ref.visionAssetPath);
      if(sourceReferences.length!==candidatePrintingIds.length||new Set(sourceReferences.map(ref=>ref.printingId)).size!==candidatePrintingIds.length)throw new Error('Runtime DB : groupe sans couverture Vision complete');
      const exact=group.mode==='exact'&&candidatePrintingIds.length===1;
      return sourceReferences.map(sourceReference=>{
        const artworkPrinting=printingsById.get(sourceReference.printingId);
        if(!artworkPrinting||artworkPrinting.cardId!==group.cardId)throw new Error('Runtime DB : reference Vision orpheline');
        const referenceImageUrl=resolveUrl(config.manifestUrl,sourceReference.visionAssetPath||sourceReference.referenceImageUrl);
        const displayImageUrl=resolveUrl(config.manifestUrl,artworkPrinting.displayAssetPath||artworkPrinting.imageUrl);
        return Object.freeze({refId:`${group.recognitionGroupId}:${sourceReference.printingId}`,recognitionGroupId:group.recognitionGroupId,cardId:group.cardId,printingId:exact?sourceReference.printingId:null,candidatePrintingIds:Object.freeze([...candidatePrintingIds]),recognitionMode:group.mode,variantKind:artworkPrinting.variantKind,referencePrintingId:sourceReference.printingId,referenceImageUrl,imageUrl:referenceImageUrl,displayImageUrl,displayAssetPath:displayImageUrl,recognition:Object.freeze({eligible:true,mode:group.mode,recognitionGroupId:group.recognitionGroupId})});
      });
    });
    if(references.length!==config.expectedMatcherReferences||new Set(references.map(reference=>reference.refId)).size!==references.length)throw new Error('Runtime DB : corpus matcher incomplet');
    const coveredCards=new Set(references.map(reference=>reference.cardId));
    if(coveredCards.size!==cards.length)throw new Error('Runtime DB : couverture canonique incomplète');
    return Object.freeze({manifest:Object.freeze({game:'cyberpunk',gameId,databaseVersion,databaseStatus,runtimeScope,runtimeReady,sourceRef:databaseVersion,sourceCommit:config.manifestUrl.split('/').slice(-2,-1)[0],canonicalCount:cards.length,printingCount:printings.length,visionReferenceCount:references.length,recognitionGroupCount:recognitionGroups.length,knownCanonicalCount:config.knownCanonicalCards,knownPrintingCount:config.knownOfficialPrintings,source:'public-github-direct',fallbackActive:false}),cards:Object.freeze([...cardsById.values()]),printings:Object.freeze([...printingsById.values()]),cardsById,printingsById,references:Object.freeze(references),recognitionGroups:Object.freeze(recognitionGroups.map(group=>Object.freeze({...group})))});
  }

  async function loadUncached(game,fetchImpl) {
    const config=configApi?.get?.(game);if(!config)throw new Error(`DB inconnue : ${game}`);
    const metrics={requests:0,bytes:0,resources:{},startedAt:performance.now()};
    const manifest=await fetchJson(fetchImpl,config.manifestUrl,metrics);
    const paths={databaseManifest:manifest.database_manifest,cards:manifest.entrypoint||manifest.runtime_cards,printings:manifest.runtime_printings,canonical:manifest.canonical_vision_index,printingRecognition:manifest.printing_recognition_index,groups:manifest.recognition_groups};
    if(Object.values(paths).some(path=>!path))throw new Error('Manifest DB : runtime absent');
    const urls=Object.fromEntries(Object.entries(paths).map(([key,path])=>[key,resolveUrl(config.manifestUrl,path)]));
    const [databaseManifest,cards,printings,canonicalIndex,printingIndex,groupsIndex]=await Promise.all([fetchJson(fetchImpl,urls.databaseManifest,metrics),fetchJson(fetchImpl,urls.cards,metrics),fetchJson(fetchImpl,urls.printings,metrics),fetchJson(fetchImpl,urls.canonical,metrics),fetchJson(fetchImpl,urls.printingRecognition,metrics),fetchJson(fetchImpl,urls.groups,metrics)]);
    const database=validate(config,manifest,databaseManifest,cards,printings,canonicalIndex,printingIndex,groupsIndex);
    return Object.freeze({...database,metrics:Object.freeze({...metrics,resources:Object.freeze({...metrics.resources}),totalMs:performance.now()-metrics.startedAt})});
  }

  function load(game,options={}) {
    const key=String(game||''),fetchImpl=options.fetchImpl||globalThis.fetch;
    if(typeof fetchImpl!=='function')return Promise.reject(new Error('Fetch indisponible'));
    if(options.force)sessionCache.delete(key);
    if(!sessionCache.has(key)){const promise=loadUncached(key,fetchImpl).catch(error=>{sessionCache.delete(key);throw error;});sessionCache.set(key,promise);}
    return sessionCache.get(key);
  }
  function clear(game){if(game==null)sessionCache.clear();else sessionCache.delete(String(game));}
  return Object.freeze({load,clear,validate,resolveUrl});
});
