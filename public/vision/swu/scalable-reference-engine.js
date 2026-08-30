import { descriptorFromBitmap,coarseObservationSetFromBitmap,rankCoarseIndex,rankCoarseIndexRows } from './reference-engine.js';
import { DescriptorCache,detailCacheNamespace } from './cache.js';
import { ReferenceEngine } from './reference-engine.js';

// R11: SWU Stage 1 is layout-aware and semantic-identity-aware. The frozen DB
// coarse index remains source-oriented: portrait cards are portrait, while Base and
// undeployed Leader fronts are landscape. The webcam detector canonicalizes every
// physical rectangle into portrait, so R11 evaluates both portrait and quarter-turn
// source views during coarse search, then normalizes fetched landscape references
// to the detector's portrait canonical orientation before the frozen detailed matcher.
// Semantic duplicate cardIds (same printed name/subtitle/type/side) are collapsed
// for Stage-1 margin only; DB IDs are never rewritten.
const PROGRESSIVE_K=Object.freeze([8,24,44]);
const COARSE_STABILITY=Object.freeze({consecutiveRequired:2,maxProbes:3,maxWaitMs:450});
const DESCRIPTOR_LENGTHS=Object.freeze({full:7776,art:4225,gradient:7776,chroma:15552,coarse:216});
const CDN_HOST='cdn.starwarsunlimited.com';
const DETAIL_LAYOUT_VERSION='physical-canonical-v1';

function displayCardName(card){return card?.subtitle?`${card.name} - ${card.subtitle}`:(card?.name||null);}

function validDescriptor(value){
  const d=value?.descriptor;if(!d)return false;
  return Object.entries(DESCRIPTOR_LENGTHS).every(([key,length])=>Array.isArray(d[key])&&d[key].length===length&&d[key].every(Number.isFinite));
}
function imageFetchUrl(url){
  try{const parsed=new URL(url,globalThis.location?.origin||'http://127.0.0.1');if(parsed.protocol==='https:'&&parsed.hostname===CDN_HOST)return `/api/image-proxy?url=${encodeURIComponent(parsed.href)}`;}catch{}
  return url;
}
async function mapLimit(values,limit,fn){
  const out=new Array(values.length);let cursor=0;
  async function worker(){while(true){const index=cursor++;if(index>=values.length)return;out[index]=await fn(values[index],index);}}
  await Promise.all(Array.from({length:Math.min(limit,Math.max(1,values.length))},worker));return out;
}

export function canonicalIdentityKey(ref){return ref?.semanticIdentityKey||`${ref?.cardId||''}\x1f${ref?.side||'front'}`;}
export function referencePhysicalLayout(ref){return ref?.physicalLayout==='landscape'?'landscape':'portrait';}
function makeCanvas(width,height){if(typeof OffscreenCanvas!=='undefined')return new OffscreenCanvas(width,height);const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;return canvas;}
export function quarterTurnCanvas(source){const sw=source?.width||0,sh=source?.height||0;if(!sw||!sh)throw new Error('Quarter-turn source has no dimensions');const out=makeCanvas(sh,sw),ctx=out.getContext('2d',{alpha:false});ctx.fillStyle='#777';ctx.fillRect(0,0,out.width,out.height);ctx.translate(out.width,0);ctx.rotate(Math.PI/2);ctx.drawImage(source,0,0);return out;}
export function filterCoarseLayout(ranked,layout){const out=[];for(const item of ranked){if(referencePhysicalLayout(item.ref)!==layout)continue;out.push({...item,sourceCoarseRank:item.coarseRank,layoutCoarseRank:out.length+1,queryLayout:layout});}return out;}
export function mergeLayoutCoarseRankings(portraitRanked,landscapeRanked){const out=[...portraitRanked,...landscapeRanked].sort((a,b)=>(b.coarseScore-a.coarseScore)||(a.ref.index-b.ref.index));for(let i=0;i<out.length;i++)out[i]={...out[i],coarseRank:i+1};return out;}

export function collapseCoarseByCanonical(ranked){
  const seen=new Set(),out=[];
  for(const item of ranked){
    const key=canonicalIdentityKey(item.ref);if(seen.has(key))continue;seen.add(key);
    out.push({...item,rawCoarseRank:item.coarseRank,canonicalCoarseRank:out.length+1});
  }
  return out;
}

const LANGUAGE_COARSE_ROWS=Object.freeze({rowStart:1,rowEnd:6});
function buildArtworkMask(){
  const width=72,height=108,mask=new Uint8Array(width*height);
  const x0=Math.floor(width*.06),x1=Math.ceil(width*.94),y0=Math.floor(height*.15),y1=Math.ceil(height*.59);
  let visible=0;for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){mask[y*width+x]=1;visible++;}
  return Object.freeze({mask,visibleFraction:visible/(width*height),maskedBy:1,maxOverlap:0,policy:'swu-language-artwork-v1',bounds:{x0,x1,y0,y1}});
}
const LANGUAGE_MASK_INFO=buildArtworkMask();
export function mergeCanonicalCoarseRankings(fullRanked,artRanked){
  const byKey=new Map();
  const add=(item,kind)=>{const key=canonicalIdentityKey(item.ref),entry=byKey.get(key)||{};entry[kind]=item;byKey.set(key,entry);};
  fullRanked.forEach(x=>add(x,'full'));artRanked.forEach(x=>add(x,'art'));
  const out=[];for(const [key,entry] of byKey){
    const fullRank=entry.full?.canonicalCoarseRank??Number.POSITIVE_INFINITY,artRank=entry.art?.canonicalCoarseRank??Number.POSITIVE_INFINITY;
    const chosen=(artRank<fullRank?entry.art:entry.full)||entry.art;
    out.push({...chosen,canonicalKey:key,canonicalCoarseRank:Math.min(fullRank,artRank),fullCanonicalCoarseRank:Number.isFinite(fullRank)?fullRank:0,artCanonicalCoarseRank:Number.isFinite(artRank)?artRank:0,coarseMode:artRank<fullRank?'art-zone':'full'});
  }
  out.sort((a,b)=>(a.canonicalCoarseRank-b.canonicalCoarseRank)||(b.coarseScore-a.coarseScore)||(String(a.ref.refId).localeCompare(String(b.ref.refId))));
  for(let i=0;i<out.length;i++)out[i].mergedCanonicalRank=i+1;
  return out;
}
export function artworkMaskInfo(){return LANGUAGE_MASK_INFO;}
export function createCoarseStability(now=null){return{probes:0,consecutiveTop:0,lastTopKey:null,initialTopKey:null,startedAt:Number.isFinite(now)?now:null,stabilized:false,reason:null,snapshot:null};}
export function advanceCoarseStability(state,probe,{now=performance.now(),warmShortlist=false}={}){
  if(state.stabilized&&state.snapshot)return{shouldMatch:true,...state.snapshot};
  if(!Number.isFinite(state.startedAt))state.startedAt=now;
  state.probes++;const top=probe?.topCanonicalKey||null;if(state.initialTopKey===null)state.initialTopKey=top;
  state.consecutiveTop=top&&top===state.lastTopKey?state.consecutiveTop+1:1;state.lastTopKey=top;
  const elapsed=Math.max(0,now-state.startedAt);let reason=null;
  if(state.probes===1&&warmShortlist)reason='warm-shortlist';
  else if(state.consecutiveTop>=COARSE_STABILITY.consecutiveRequired)reason='same-top-2';
  else if(state.probes>=COARSE_STABILITY.maxProbes)reason='max-probes';
  else if(elapsed>=COARSE_STABILITY.maxWaitMs)reason='timeout';
  state.stabilized=Boolean(reason);state.reason=reason;
  if(state.stabilized)state.snapshot=Object.freeze({reason,elapsedMs:elapsed,probes:state.probes,initialTopKey:state.initialTopKey,finalTopKey:top});
  return{shouldMatch:state.stabilized,...(state.snapshot||{reason,elapsedMs:elapsed,probes:state.probes,initialTopKey:state.initialTopKey,finalTopKey:top})};
}

export class ScalableReferenceEngine {
  constructor({detailCache=new DescriptorCache(),fetchImpl=globalThis.fetch}={}){
    this.detailCache=detailCache;this.fetch=fetchImpl?.bind(globalThis);this.memory=new Map();this.detailEngine=new ReferenceEngine();this.detailSignature='';this.database=null;
    this.cacheStatus='COARSE';this.cacheMetrics={status:'COARSE',bytes:0,rebuildMs:0};
    this.metrics={librarySize:0,sourceReferences:0,failedReferences:[],descriptorBuildMs:0};
  }
  async load(database){
    if(database?.engineMode!=='scalable')throw new Error('Scalable engine requires a scalable database');
    if(!(database.coarseIndex?.values instanceof Float32Array))throw new Error('Missing coarse Float32 index');
    this.database=database;this.references=database.canonicalReferences;this.values=database.coarseIndex.values;this.dimension=Number(database.coarseIndex.manifest.dimension||216);
    this.metrics={librarySize:this.references.length,sourceReferences:this.references.length,failedReferences:[],descriptorBuildMs:0,coarseBytes:this.values.byteLength};
    this.cacheMetrics={status:'COARSE',bytes:this.values.byteLength,rebuildMs:0};this.cacheStatus='COARSE + ON-DEMAND';return this.metrics;
  }
  detailKey(refId){return detailCacheNamespace({gameId:this.database.gameId,databaseVersion:this.database.databaseVersion,visionProfile:this.database.visionProfile,descriptorVersion:`${this.database.descriptorVersion}:${DETAIL_LAYOUT_VERSION}`,refId});}
  detailPrefix(){return detailCacheNamespace({gameId:this.database.gameId,databaseVersion:this.database.databaseVersion,visionProfile:this.database.visionProfile,descriptorVersion:`${this.database.descriptorVersion}:${DETAIL_LAYOUT_VERSION}`});}
  async hasWarmShortlist(entries){for(const entry of entries){if(this.memory.has(entry.refId))continue;if(!(await this.detailCache.has(this.detailKey(entry.refId))))return false;}return entries.length>0;}
  async clearDetailCache(){const deleted=await this.detailCache.deletePrefix(this.detailPrefix());this.memory.clear();this.detailSignature='';return deleted;}
  async fetchDescriptor(entry,stats){
    if(this.memory.has(entry.refId)){stats.detailCacheHits++;stats.detailMemoryHits++;return this.memory.get(entry.refId);}
    const key=this.detailKey(entry.refId),cached=await this.detailCache.get(key);
    if(cached&&cached.refId===entry.refId&&validDescriptor(cached)){
      stats.detailCacheHits++;const ref={name:entry.refId,type:canonicalIdentityKey(entry),image:entry.refId,descriptor:cached.descriptor};this.memory.set(entry.refId,ref);return ref;
    }
    stats.detailCacheMisses++;
    const asset=this.database.assetUrl(entry.imageUrl),fetchStart=performance.now();
    const response=await this.fetch(imageFetchUrl(asset),{cache:'force-cache'});stats.detailFetchMs+=performance.now()-fetchStart;
    if(!response.ok)throw new Error(`Detail asset HTTP ${response.status}: ${asset}`);
    const blob=await response.blob(),bitmap=await createImageBitmap(blob),buildStart=performance.now();
    let descriptor;try{descriptor=descriptorFromBitmap(referencePhysicalLayout(entry)==='landscape'?quarterTurnCanvas(bitmap):bitmap);}finally{bitmap.close?.();}
    const buildMs=performance.now()-buildStart;stats.detailBuildMs+=buildMs;
    const value={refId:entry.refId,descriptor};await this.detailCache.set(key,value,buildMs);
    // type carries the Stage-1 semantic identity. Duplicate historical cardIds
    // for the same printed card therefore cannot artificially collapse margin.
    const ref={name:entry.refId,type:canonicalIdentityKey(entry),image:entry.refId,descriptor};this.memory.set(entry.refId,ref);return ref;
  }
  async ensureDetailed(entries,stats){return mapLimit(entries,4,entry=>this.fetchDescriptor(entry,stats));}
  async ensureDetailedSettled(entries,stats){
    const results=await mapLimit(entries,4,async entry=>{try{return{entry,ref:await this.fetchDescriptor(entry,stats)}}catch(error){return{entry,error:error?.message||String(error)}}});
    return{loaded:results.filter(x=>x.ref),failed:results.filter(x=>x.error)};
  }
  async detailedMatch(canvas,refs,context,stats){
    const signature=refs.map(ref=>ref.image||ref.name).slice().sort().join('|');
    if(signature!==this.detailSignature){const initStart=performance.now();await this.detailEngine.restore(refs);stats.detailInitMs+=performance.now()-initStart;this.detailSignature=signature;}
    const bitmap=await createImageBitmap(canvas),start=performance.now();const match=await this.detailEngine.match(bitmap,context);stats.detailedMatchMs+=performance.now()-start;return match;
  }
  describeDetailedItem(item,rank=0){
    const refId=item?.ref?.image||item?.ref?.name||null;
    const ref=refId?this.database?.canonicalByRef?.get(refId):null;
    const card=ref?this.database?.cardById?.get(ref.cardId):null;
    return Object.freeze({rank:Number(rank||0),refId,cardId:ref?.cardId||null,cardName:displayCardName(card),side:ref?.side||null,visualFamilyId:ref?.visualFamilyId||null,recognitionGroupId:ref?.recognitionGroupId||null,physicalLayout:referencePhysicalLayout(ref),semanticIdentityKey:ref?.semanticIdentityKey||null,score:Number(item?.score||0),coarseScore:Number(item?.coarseScore||0)});
  }
  async probeCanvas(canvas){
    if(!this.database)throw new Error('Scalable engine not loaded');
    const coarseStart=performance.now(),landscapeCanvas=quarterTurnCanvas(canvas);
    const portraitBitmap=await createImageBitmap(canvas),landscapeBitmap=await createImageBitmap(landscapeCanvas);
    let portraitObservations,landscapeObservations;try{portraitObservations=coarseObservationSetFromBitmap(portraitBitmap);landscapeObservations=coarseObservationSetFromBitmap(landscapeBitmap);}finally{portraitBitmap.close?.();landscapeBitmap.close?.();}
    const fullStart=performance.now();
    const portraitFull=filterCoarseLayout(rankCoarseIndex(portraitObservations,this.values,this.references,this.dimension),'portrait');
    const landscapeFull=filterCoarseLayout(rankCoarseIndex(landscapeObservations,this.values,this.references,this.dimension),'landscape');
    const rawRanked=mergeLayoutCoarseRankings(portraitFull,landscapeFull),fullCoarseMs=performance.now()-fullStart;
    const artStart=performance.now();
    const portraitArt=filterCoarseLayout(rankCoarseIndexRows(portraitObservations,this.values,this.references,this.dimension,LANGUAGE_COARSE_ROWS),'portrait');
    const landscapeArt=filterCoarseLayout(rankCoarseIndexRows(landscapeObservations,this.values,this.references,this.dimension,LANGUAGE_COARSE_ROWS),'landscape');
    const rawArtRanked=mergeLayoutCoarseRankings(portraitArt,landscapeArt),artCoarseMs=performance.now()-artStart;
    const coarseMs=performance.now()-coarseStart,fullCanonical=collapseCoarseByCanonical(rawRanked),artCanonical=collapseCoarseByCanonical(rawArtRanked),ranked=mergeCanonicalCoarseRankings(fullCanonical,artCanonical),top=ranked[0]||null;
    return Object.freeze({ranked,rawRanked,rawArtRanked,fullCanonical,artCanonical,topCanonicalKey:top?.canonicalKey||canonicalIdentityKey(top?.ref),topRefId:top?.ref?.refId||null,timing:Object.freeze({coarseMs,fullCoarseMs,artCoarseMs,rawCoarseCandidates:rawRanked.length,canonicalCoarseCandidates:ranked.length})});
  }
  async matchCanvas(canvas,context={}){
    if(!this.database)throw new Error('Scalable engine not loaded');
    const totalStart=performance.now(),stats={coarseMs:0,detailFetchMs:0,detailBuildMs:0,detailInitMs:0,detailedMatchMs:0,detailCacheHits:0,detailCacheMisses:0,detailMemoryHits:0,shortlistK:0,firstSeen:false,coarseRank:0,canonicalCoarseRank:0,fullCanonicalCoarseRank:0,artCanonicalCoarseRank:0,artCoarseRank:0,coarseMode:'full',rawCoarseCandidates:0,canonicalCoarseCandidates:0,fullCoarseMs:0,artCoarseMs:0};
    const probe=context.coarseProbe||await this.probeCanvas(canvas),{coarseProbe:_coarseProbe,...matcherContext}=context,{ranked,rawRanked,rawArtRanked}=probe;
    stats.coarseMs=probe.timing.coarseMs;stats.fullCoarseMs=probe.timing.fullCoarseMs;stats.artCoarseMs=probe.timing.artCoarseMs;stats.rawCoarseCandidates=probe.timing.rawCoarseCandidates;stats.canonicalCoarseCandidates=probe.timing.canonicalCoarseCandidates;
    let match=null;const passDiagnostics=[];
    for(const requestedK of PROGRESSIVE_K){
      const k=Math.min(requestedK,ranked.length);if(k<=stats.shortlistK)continue;stats.shortlistK=k;
      const detailed=await this.ensureDetailed(ranked.slice(0,k).map(x=>x.ref),stats);
      const beforeMatch=stats.detailedMatchMs;
      match=await this.detailedMatch(canvas,detailed,{...matcherContext,maskInfo:LANGUAGE_MASK_INFO,languageArtworkFallback:true},stats);
      const bestRefId=match?.best?.ref?.image,secondRefId=match?.second?.ref?.image;
      if(bestRefId){const fullItem=rawRanked.find(x=>x.ref.refId===bestRefId),artItem=rawArtRanked.find(x=>x.ref.refId===bestRefId),canonicalItem=ranked.find(x=>x.ref.refId===bestRefId);stats.coarseRank=fullItem?.coarseRank||0;stats.canonicalCoarseRank=canonicalItem?.canonicalCoarseRank||0;stats.fullCanonicalCoarseRank=canonicalItem?.fullCanonicalCoarseRank||0;stats.artCanonicalCoarseRank=canonicalItem?.artCanonicalCoarseRank||0;stats.artCoarseRank=artItem?.coarseRank||0;stats.coarseMode=canonicalItem?.coarseMode||'full';if(fullItem)match.best.coarseScore=fullItem.coarseScore;}
      if(secondRefId){const item=rawRanked.find(x=>x.ref.refId===secondRefId);if(item)match.second.coarseScore=item.coarseScore;}
      passDiagnostics.push(Object.freeze({k,accepted:Boolean(match?.accepted),mode:match?.mode||'normal',languageFallbackAccepted:Boolean(match?.accepted&&match?.mode==='masked'),margin:Number(match?.margin||0),matchMs:Number(stats.detailedMatchMs-beforeMatch),best:this.describeDetailedItem(match?.best,1),second:this.describeDetailedItem(match?.second,2),maskDiagnostics:match?.maskDiagnostics||null}));
      if(match?.accepted)break;
    }
    stats.firstSeen=stats.detailCacheMisses>0;stats.totalVisionMs=performance.now()-totalStart;
    match=match||{accepted:false,best:null,second:null,margin:0,ranked:[],mode:'normal',timing:{}};
    const topCandidates=(match?.ranked||[]).slice(0,5).map((item,index)=>this.describeDetailedItem(item,index+1));
    match.timing={...(match.timing||{}),coarseGlobalMs:stats.coarseMs,fullCoarseMs:stats.fullCoarseMs,artCoarseMs:stats.artCoarseMs,detailFetchMs:stats.detailFetchMs,detailBuildMs:stats.detailBuildMs,detailInitMs:stats.detailInitMs,detailedMatchMs:stats.detailedMatchMs,detailCacheHits:stats.detailCacheHits,detailCacheMisses:stats.detailCacheMisses,detailMemoryHits:stats.detailMemoryHits,shortlistK:stats.shortlistK,coarseRank:stats.coarseRank,canonicalCoarseRank:stats.canonicalCoarseRank,fullCanonicalCoarseRank:stats.fullCanonicalCoarseRank,artCanonicalCoarseRank:stats.artCanonicalCoarseRank,artCoarseRank:stats.artCoarseRank,coarseMode:stats.coarseMode,firstSeen:stats.firstSeen,scalableTotalMs:stats.totalVisionMs,coarseLibrarySize:this.references.length,rawCoarseCandidates:stats.rawCoarseCandidates,canonicalCoarseCandidates:stats.canonicalCoarseCandidates,stage1Mode:'semantic-card-side+source-layout-dual-coarse+language-art-mask',languageArtworkFallback:true,detailLayoutVersion:DETAIL_LAYOUT_VERSION,languageFallbackAccepted:Boolean(match?.accepted&&match?.mode==='masked'),languageMaskPolicy:LANGUAGE_MASK_INFO.policy,languageMaskDiagnostics:match?.maskDiagnostics||null,passDiagnostics,topCandidates};
    return match;
  }
  stop(){this.detailEngine?.stop?.();this.detailSignature='';this.memory.clear();}
}

export { PROGRESSIVE_K,COARSE_STABILITY };
