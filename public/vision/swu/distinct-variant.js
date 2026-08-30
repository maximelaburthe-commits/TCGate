import { ReferenceEngine } from './reference-engine.js';
import { classifyVisualVariant } from './display-resolution.js';

export const VARIANT_STATUS=Object.freeze({NOT_APPLICABLE:'NOT_APPLICABLE',CANONICAL:'CANONICAL',CANDIDATE:'DISTINCT_CANDIDATE',CONFIRMED:'DISTINCT_CONFIRMED',UNRESOLVED:'UNRESOLVED',ERROR:'ERROR'});
export const VARIANT_DIAGNOSTIC_MARGIN=.04;
function defaultBitmapFactory(...args){return globalThis.createImageBitmap(...args);}

const sideKey=(cardId,side)=>`${cardId}\x1f${side||'front'}`;
const unique=values=>[...new Set(values.filter(Boolean))];
export function printingMetadataLabel(printings=[]){
  return printings.map(printing=>[
    printing.set&&`set ${printing.set}`,printing.cardNumber&&`#${printing.cardNumber}`,printing.variant,printing.foil,printing.treatment,printing.rarity
  ].filter(Boolean).join(' � ')).filter(Boolean).join(' / ')||null;
}
export function collectVariantCandidates(database,stage1Result){
  if(database?.gameId!=='star-wars-unlimited'||!stage1Result?.cardId||!stage1Result?.side)return[];
  const cardIds=unique([stage1Result.cardId,...(stage1Result.semanticCandidateCardIds||[])]),seen=new Set(),all=[];
  for(const cardId of cardIds)for(const group of database.groupsByCardSide.get(sideKey(cardId,stage1Result.side))||[]){
    if(seen.has(group.visualFamilyId))continue;seen.add(group.visualFamilyId);
    const ref=database.canonicalByGroup.get(group.recognitionGroupId);
    if(!ref)continue;
    const candidatePrintingIds=unique(group.candidatePrintingIds||[]),printings=candidatePrintingIds.map(id=>database.printingById?.get(id)).filter(Boolean);
    const visual=classifyVisualVariant(printings);
    all.push({visualFamilyId:group.visualFamilyId,recognitionGroupId:group.recognitionGroupId,cardId,side:stage1Result.side,recognitionClass:group.classification,candidatePrintingIds,ref,metadataLabel:printingMetadataLabel(printings),variantKind:visual.variantKind,isDistinct:visual.classification==='DISTINCT',isStandard:printings.some(p=>String(p?.variant||p?.variantKind||'').toLowerCase()==='standard')});
  }
  const distinct=all.filter(candidate=>candidate.isDistinct);if(!distinct.length)return[];
  const canonical=all.find(candidate=>candidate.cardId===stage1Result.cardId&&candidate.isStandard&&!candidate.isDistinct)||all.find(candidate=>candidate.cardId===stage1Result.cardId&&!candidate.isDistinct);
  if(!canonical)return[];
  return [Object.freeze({...canonical,variantKind:'Canonical',isCanonical:true}),...distinct.map(candidate=>Object.freeze({...candidate,isCanonical:false}))];
}

function statusFor(candidate){return candidate?.isDistinct?VARIANT_STATUS.CANDIDATE:VARIANT_STATUS.CANONICAL;}
function candidateDiagnostic(candidate){return{refId:candidate?.ref?.refId||null,visualFamilyId:candidate?.visualFamilyId||null,recognitionGroupId:candidate?.recognitionGroupId||null,recognitionClass:candidate?.recognitionClass||null,candidatePrintingIds:candidate?.candidatePrintingIds||[],metadataLabel:candidate?.metadataLabel||null};}
function resultFor(candidate,{status,phase='COMPLETE',errorMessage=null,ranked=[],bestScore=0,margin=0,runnerUpScore=0,latencyMs=0,stats={},expected=ranked.length||Number(Boolean(candidate)),loaded=expected,failedCandidates=[]}={}){
  return Object.freeze({status,phase,errorMessage,visualFamilyId:candidate?.visualFamilyId||null,recognitionGroupId:candidate?.recognitionGroupId||null,variantKind:candidate?.variantKind||null,displayAssetPath:candidate?.ref?.imageUrl||null,printingId:null,candidatePrintingIds:candidate?.candidatePrintingIds||[],bestScore,margin,runnerUpScore,candidateCount:expected,candidateCountExpected:expected,candidateCountLoaded:loaded,candidateCountFailed:failedCandidates.length,latencyMs,fetchMs:stats.detailFetchMs||0,buildMs:stats.detailBuildMs||0,cacheHits:stats.detailCacheHits||0,cacheMisses:stats.detailCacheMisses||0,failedCandidates,candidates:ranked});
}

export class VariantStage {
  constructor(database,descriptorProvider,{matcher=new ReferenceEngine(),bitmapFactory=defaultBitmapFactory}={}){this.database=database;this.provider=descriptorProvider;this.matcher=matcher;this.bitmapFactory=bitmapFactory;}
  candidates(stage1Result){return collectVariantCandidates(this.database,stage1Result);}
  async analyze({stage1Result,canvas,trackUid}){
    const started=performance.now(),stats={detailFetchMs:0,detailBuildMs:0,detailCacheHits:0,detailCacheMisses:0,detailMemoryHits:0};let phase='ENUMERATE',candidates=[];
    const unresolved=(error,failedCandidates=[],loaded=0,diagnostics=candidates.map(candidateDiagnostic))=>resultFor(null,{status:VARIANT_STATUS.UNRESOLVED,phase,errorMessage:error?.message||String(error),ranked:diagnostics,latencyMs:performance.now()-started,stats,expected:candidates.length,loaded,failedCandidates});
    try{candidates=this.candidates(stage1Result);}catch(error){return unresolved(error);}
    const diagnostics=candidates.map(candidateDiagnostic);
    if(!candidates.length)return resultFor(null,{status:VARIANT_STATUS.NOT_APPLICABLE,phase:'COMPLETE',ranked:[],latencyMs:performance.now()-started,expected:0,loaded:0});
    if(candidates.length===1){const candidate=candidates[0],ranked=[this.describe(candidate,1,0)];return resultFor(candidate,{status:statusFor(candidate),ranked,latencyMs:performance.now()-started,expected:1,loaded:1});}
    phase='DETAIL_LOAD';let settled;try{settled=await this.provider.ensureDetailedSettled(candidates.map(x=>x.ref),stats);}catch(error){return unresolved(error,[],0,diagnostics);}
    const failedCandidates=settled.failed.map(({entry,error})=>{const candidate=candidates.find(x=>x.ref.refId===entry.refId);return{refId:entry.refId,visualFamilyId:candidate?.visualFamilyId||null,recognitionGroupId:candidate?.recognitionGroupId||null,error:error?.message||String(error)}});
    if(failedCandidates.length||settled.loaded.length!==candidates.length)return unresolved(new Error('One or more Variant Stage candidates could not be loaded'),failedCandidates,settled.loaded.length,diagnostics);
    const refs=settled.loaded.map(x=>x.ref),matcherRefs=refs.map((ref,index)=>({...ref,type:candidates[index].recognitionGroupId})),rankedItems=[];
    // The frozen worker exports at most five ranked items. Small batches preserve
    // its scorer while allowing the Lab to merge a complete within-card ranking.
    for(let offset=0;offset<matcherRefs.length;offset+=5){const batch=matcherRefs.slice(offset,offset+5);phase='MATCHER_RESTORE';try{await this.matcher.restore(batch);}catch(error){return unresolved(error,[],candidates.length,diagnostics);}phase='BITMAP';let bitmap;try{bitmap=await this.bitmapFactory(canvas);}catch(error){return unresolved(error,[],candidates.length,diagnostics);}phase='MATCH';try{const match=await this.matcher.match(bitmap,{variantStage:true,trackUid});rankedItems.push(...(match.ranked||[]));}catch(error){return unresolved(error,[],candidates.length,diagnostics);}}
    phase='RANK';let ranked;try{rankedItems.sort((a,b)=>Number(b.score||0)-Number(a.score||0));const byRef=new Map(candidates.map(x=>[x.ref.refId,x]));ranked=rankedItems.map((item,index)=>this.describe(byRef.get(item.ref?.image||item.ref?.name),index+1,Number(item.score||0))).filter(x=>x.visualFamilyId);if(ranked.length!==candidates.length)throw new Error(`Incomplete Variant Stage ranking: ${ranked.length}/${candidates.length}`);}catch(error){return unresolved(error,[],candidates.length,diagnostics);}
    const best=ranked[0],runner=ranked[1],margin=Number(best?.score||0)-Number(runner?.score||0),candidate=candidates.find(x=>x.visualFamilyId===best?.visualFamilyId);
    return resultFor(candidate,{status:statusFor(candidate),phase:'COMPLETE',ranked,bestScore:Number(best?.score||0),margin,runnerUpScore:Number(runner?.score||0),latencyMs:performance.now()-started,stats,expected:candidates.length,loaded:candidates.length});
  }
  describe(candidate,rank,score){return Object.freeze({rank,visualFamilyId:candidate?.visualFamilyId||null,recognitionGroupId:candidate?.recognitionGroupId||null,candidatePrintingIds:candidate?.candidatePrintingIds||[],recognitionClass:candidate?.recognitionClass||null,variantKind:candidate?.variantKind||null,isCanonical:Boolean(candidate?.isCanonical),displayAssetPath:candidate?.ref?.imageUrl||null,score,metadataLabel:candidate?.metadataLabel||null,cardId:candidate?.cardId||null,side:candidate?.side||null});}
  clear(){this.matcher.stop?.();}
  stop(){this.clear();}
}
