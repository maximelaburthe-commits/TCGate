(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TCGWorkspaceDatabaseMaintenanceModel=api;})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  const REPOSITORY='maximelaburthe-commits/tcgate_db_cyberpunk';
  const BRANCH='develop-cyberpunk-db-v1.2';
  const FALLBACK_SHA='425e0198610cd0a746c4e2d1fc3094b3823340e4';
  const WORKFLOW_URL='https://github.com/'+REPOSITORY+'/actions/workflows/build-database.yml';
  const PATHS=Object.freeze({manifest:'manifest.json',databaseManifest:'db-manifest.json',candidateReport:'data/control-center-update-candidate.json',syncReport:'staging/latest/sync_report.json',coverage:'data/coverage.json',multilingualCoverage:'data/multilingual-coverage.json'});
  const object=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  const strings=value=>Array.isArray(value)?value.filter(item=>typeof item==='string'):[];
  const number=value=>Number.isFinite(value)&&value>=0?value:null;
  const first=(...values)=>values.find(value=>value!==null&&value!==undefined&&value!=='')??null;
  const sha=value=>typeof value==='string'&&/^[a-f0-9]{40}$/i.test(value)?value.toLowerCase():null;
  function activeFrom(registry,gameId='cyberpunk'){
    const source=typeof registry?.get==='function'?registry.get(gameId):null;
    if(!source)return null;
    let immutableSha=null;
    try{const url=new URL(source.manifestUrl);if(url.protocol==='https:'&&url.hostname==='raw.githubusercontent.com')immutableSha=sha(url.pathname.split('/')[3]);}catch{}
    return {version:source.expectedVersion??null,sha:immutableSha,manifestUrl:source.manifestUrl??null,game:source.expectedGame??null,status:source.expectedStatus??null,runtimeScope:source.expectedRuntimeScope??null,runtimeReady:source.expectedRuntimeReady??null,canonicalCards:number(source.expectedCanonicalCards),runtimePrintings:number(source.expectedRuntimePrintings),recognitionGroups:number(source.expectedRecognitionGroups),matcherReferences:number(source.expectedMatcherReferences),source:'public/game-databases.js'};
  }
  function candidateUrls(candidateSha){
    if(!sha(candidateSha))throw Error('SHA Candidate immuable invalide');
    const base='https://raw.githubusercontent.com/'+REPOSITORY+'/'+sha(candidateSha)+'/';
    return Object.fromEntries(Object.entries(PATHS).map(([key,path])=>[key,base+path]));
  }
  function listSummary(value){
    if(Array.isArray(value))return {count:value.length,items:value.map(item=>typeof item==='string'?item:JSON.stringify(item)),available:true};
    if(number(value)!==null)return {count:value,items:[],available:true};
    return {count:null,items:[],available:false};
  }
  function parseUpdateReport(input){
    const report=object(input),update=object(report.updateSummary),source=object(report.sourceSnapshot),status=object(report.sourceStatus);
    const changes={};
    for(const key of ['newCards','newPrintings','newLocales','newAssets','changedAssets','missingAssets','missingMetadata'])changes[key]=listSummary(update[key]);
    const localeCoverage=object(report.localizationCoverage);
    return {available:!!input,snapshotDate:first(source.snapshotDate,report.snapshotDate),capturedAt:first(source.capturedAt,report.capturedAt),sourceAuthority:first(status.authority,source.authority),sourceUrl:first(source.officialSite,source.endpoint),assetRightsReviewRequired:typeof status.assetRightsReviewRequired==='boolean'?status.assetRightsReviewRequired:null,changes,localeCoverage,sourceSnapshot:source};
  }
  function parseSyncReport(input){
    const report=object(input);
    return {available:!!input,snapshotDate:first(report.snapshotDate),capturedAt:first(report.capturedAt,report.generatedAt,report.syncedAt),mode:first(report.mode),health:first(report.sourceHealth),blocked:typeof report.blocked==='boolean'?report.blocked:null,canonicalCards:number(report.canonicalCards),printings:number(report.printings),warnings:strings(report.warnings),conflicts:Array.isArray(report.conflicts)?report.conflicts:[]};
  }
  function normalizeCandidate(config={},documents={},resolution={}){
    const manifest=object(documents.manifest),db=object(documents.databaseManifest),coverage=object(documents.coverage),multilingual=object(documents.multilingualCoverage);
    const update=parseUpdateReport(documents.candidateReport),staging=parseSyncReport(documents.syncReport);
    const reportDate=first(update.snapshotDate,update.capturedAt);
    const snapshotDate=first(reportDate,db.activeSnapshot,coverage.snapshotDate);
    const snapshotSource=reportDate?PATHS.candidateReport:db.activeSnapshot?PATHS.databaseManifest:coverage.snapshotDate?PATHS.coverage:null;
    const validManifest=manifest.game_id==='cyberpunk-tcg'&&typeof manifest.database_version==='string';
    const locales=strings(first(manifest.availableLocales,object(db.locales).availableLocales,multilingual.availableLocales,config.locales));
    const localeCoverage=Object.keys(object(multilingual.localizationCoverage)).length?object(multilingual.localizationCoverage):Object.keys(update.localeCoverage).length?update.localeCoverage:object(coverage.localizationCoverage);
    const runtimeReady=typeof manifest.runtime_ready==='boolean'?manifest.runtime_ready:typeof db.runtimeReady==='boolean'?db.runtimeReady:null;
    const runtimeBlockers=strings(first(manifest.runtime_blockers,db.runtimeBlockers,[]));
    const status=first(manifest.status,db.status,config.status,'inconnu');
    const candidateSha=sha(resolution.sha)||sha(config.fallbackSha)||sha(config.sha)||FALLBACK_SHA;
    const badges=['CANDIDATE'];
    if(String(status).toLowerCase()==='development')badges.unshift('DEVELOPMENT');
    if(validManifest&&runtimeReady===true&&!runtimeBlockers.length)badges.push('READY FOR LAB');
    if(runtimeReady===false||runtimeBlockers.length)badges.push('BLOCKED');
    if(validManifest&&['qualified','candidate-qualified'].includes(String(status).toLowerCase()))badges.push('QUALIFIED');
    let displayAssets=null,visionAssets=null;
    const localeRows=Object.entries(localeCoverage).map(([locale,raw])=>{
      const item=object(raw);return {locale,canonicalCards:number(item.canonicalCards),printings:number(item.printings),displayAssets:number(item.displayAssets),visionAssets:number(item.visionAssets),missingAssets:listSummary(item.missingAssets),missingMetadata:listSummary(item.missingMetadata)};
    });
    if(localeRows.length&&localeRows.every(row=>row.displayAssets!==null))displayAssets=localeRows.reduce((sum,row)=>sum+row.displayAssets,0);
    if(localeRows.length&&localeRows.every(row=>row.visionAssets!==null))visionAssets=localeRows.reduce((sum,row)=>sum+row.visionAssets,0);
    const metadataLists=localeRows.filter(row=>row.missingMetadata.available);
    if(!update.changes.missingMetadata.available&&metadataLists.length){update.changes.missingMetadata={count:metadataLists.reduce((sum,row)=>sum+row.missingMetadata.count,0),items:metadataLists.flatMap(row=>row.missingMetadata.items.map(item=>row.locale+' : '+item)),available:true};}
    return {game:first(manifest.game_id,object(db.game).id),runtimeScope:first(manifest.runtime_scope,db.runtimeScope),version:first(manifest.database_version,db.databaseVersion,config.version),sha:candidateSha,branch:config.branch||BRANCH,status,schema:first(db.schemaVersion,config.schema),locales,badges,validManifest,runtimeReady,runtimeBlockers,
      snapshotDate,snapshotSource,capturedAt:reportDate?update.capturedAt:null,update,staging,localeCoverage:localeRows,
      canonicalCards:first(number(coverage.canonicalCards),number(update.sourceSnapshot.canonicalCards)),printings:first(number(coverage.officialPrintings),number(coverage.expectedOfficialPrintings),number(update.sourceSnapshot.expectedOfficialPrintings)),
      displayAssets,visionAssets,runtimePrintings:number(coverage.runtimeEligiblePrintings),runtimeDisplayAssets:number(coverage.runtimeDisplayAssets),runtimeVisionAssets:number(coverage.runtimeVisionAssets),visionEligible:number(coverage.visionEligible),visionMissing:number(coverage.visionMissing),futureAssetsMissing:number(coverage.futureAssetsMissing),
      urls:candidateUrls(candidateSha),headSource:resolution.headSource||'fallback configuré — HEAD non vérifié',headResolvedAt:resolution.headResolvedAt||null,lastRead:resolution.lastRead||null,errors:Array.isArray(resolution.errors)?resolution.errors:[],fallbackOnly:!validManifest,knownDetail:config.detail||null,knownBlockers:strings(config.blockers)};
  }
  async function readJson(url,{fetchImpl,timeoutMs=8000}={}){
    const get=fetchImpl||(typeof fetch==='function'?fetch:null);if(!get)throw Error('Lecture réseau indisponible');
    const controller=typeof AbortController==='function'?new AbortController():null;
    const timer=controller?setTimeout(()=>controller.abort(),timeoutMs):null;
    try{
      const response=await get(url,{method:'GET',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',cache:'no-store',...(controller?{signal:controller.signal}:{})});
      if(!response.ok)throw Error('HTTP '+response.status);
      const text=await response.text();if(text.length>3000000)throw Error('Document trop volumineux');
      const data=JSON.parse(text);if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Objet JSON attendu');return data;
    }finally{if(timer)clearTimeout(timer);}
  }
  async function resolveCandidate(config={},options={}){
    const branch=config.branch||BRANCH;if(branch!==BRANCH)throw Error('Branche Candidate non configurée');
    const fallback=sha(config.fallbackSha)||sha(config.sha)||FALLBACK_SHA;
    const readAt=(options.now||(()=>new Date().toISOString()))();
    try{
      const data=await readJson('https://api.github.com/repos/'+REPOSITORY+'/commits/'+encodeURIComponent(branch),options);
      const resolved=sha(data.sha);if(!resolved)throw Error('SHA HEAD invalide');
      return {sha:resolved,headSource:'GitHub API publique · HEAD de '+branch,headResolvedAt:readAt,errors:[]};
    }catch(error){return {sha:fallback,headSource:'fallback configuré — HEAD non vérifié',headResolvedAt:null,errors:['HEAD Candidate : '+error.message]};}
  }
  async function loadCandidate(config={},options={}){
    const resolution=await resolveCandidate(config,options),urls=candidateUrls(resolution.sha),documents={};
    const outcomes=await Promise.allSettled(Object.entries(urls).map(async([key,url])=>[key,await readJson(url,options)]));
    outcomes.forEach((outcome,index)=>{const key=Object.keys(urls)[index];if(outcome.status==='fulfilled')documents[key]=outcome.value[1];else resolution.errors.push(PATHS[key]+' : '+outcome.reason.message);});
    resolution.lastRead=(options.now||(()=>new Date().toISOString()))();
    return normalizeCandidate(config,documents,resolution);
  }
  return Object.freeze({REPOSITORY,BRANCH,FALLBACK_SHA,WORKFLOW_URL,PATHS,activeFrom,candidateUrls,listSummary,parseUpdateReport,parseSyncReport,normalizeCandidate,resolveCandidate,loadCandidate});
});
