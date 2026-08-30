import { VARIANT_STATUS } from './distinct-variant.js';

export const MAX_VARIANT_SAMPLES=3;
export const VARIANT_CONSENSUS_STATUS=Object.freeze({PENDING:'DISTINCT_CANDIDATE',CONFIRMED:'DISTINCT_CONFIRMED',CANONICAL:'CANONICAL',NOT_APPLICABLE:'NOT_APPLICABLE'});
export const variantIdentityKey=(trackUid,cardId,side)=>`${trackUid??''}\x1f${cardId??''}\x1f${side??''}`;
export const variantResultForIdentity=(result,identityKey)=>result?.identityKey===identityKey?result:null;

export class VariantConsensus {
  constructor({trackUid,cardId,side}){this.trackUid=trackUid;this.cardId=cardId;this.side=side;this.identityKey=variantIdentityKey(trackUid,cardId,side);this.samples=[];this.final=false;this.snapshotResult=null;}
  snapshot(status=VARIANT_CONSENSUS_STATUS.PENDING,reason='collecting',winner=null){return Object.freeze({status,reason,identityKey:this.identityKey,trackUid:this.trackUid,cardId:this.cardId,side:this.side,sampleCount:this.samples.length,maxSamples:MAX_VARIANT_SAMPLES,displayVariantFamilyId:winner?.visualFamilyId||null,displayRecognitionGroupId:winner?.recognitionGroupId||null,displayVariantKind:winner?.variantKind||null,displayAssetPath:winner?.displayAssetPath||null,printingId:null,samples:this.samples.map(sample=>({...sample}))});}
  add(result){
    if(this.final)return this.snapshotResult;
    if(result?.identityKey!==this.identityKey||result?.phase!=='COMPLETE'||Number(result?.candidateCountFailed||0)!==0||result?.status===VARIANT_STATUS.UNRESOLVED||result?.status===VARIANT_STATUS.ERROR)return this.snapshot();
    if(result.status===VARIANT_STATUS.NOT_APPLICABLE){this.final=true;return this.snapshotResult=this.snapshot(VARIANT_CONSENSUS_STATUS.NOT_APPLICABLE,'no-distinct-variant');}
    const winner=result.status===VARIANT_STATUS.CANDIDATE?{visualFamilyId:result.visualFamilyId,recognitionGroupId:result.recognitionGroupId,variantKind:result.variantKind,displayAssetPath:result.displayAssetPath}:null;
    this.samples.push({index:this.samples.length+1,visualFamilyId:winner?.visualFamilyId||null,recognitionGroupId:winner?.recognitionGroupId||null,variantKind:winner?.variantKind||null});
    if(this.samples.length<MAX_VARIANT_SAMPLES)return this.snapshot();
    this.final=true;const ids=this.samples.map(sample=>sample.visualFamilyId),unanimous=ids[0]&&ids.every(id=>id===ids[0]);
    return this.snapshotResult=unanimous?this.snapshot(VARIANT_CONSENSUS_STATUS.CONFIRMED,'unanimous-distinct-3',winner):this.snapshot(VARIANT_CONSENSUS_STATUS.CANONICAL,'distinct-not-unanimous');
  }
}
