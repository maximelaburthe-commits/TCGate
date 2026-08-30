const DISTINCT_KINDS=new Set(['showcase','alternate_art','alt_art','full_art']);

const printingId=printing=>printing?.printingId||printing?.id||null;
const printingCardId=printing=>printing?.cardId||null;
const sideAsset=(printing,side='front')=>printing?.displayAssets?.[side]||printing?.displayAssetPath||
  (side==='back'?printing?.backImageUrl:printing?.frontImageUrl)||null;

export function classifyVisualVariant(printings=[]){
  for(const printing of printings){
    const structured=String(printing?.variantKind||printing?.variantType||printing?.variant||'').trim();
    const normalized=structured.toLowerCase().replace(/[ -]+/g,'_');
    if(DISTINCT_KINDS.has(normalized))return Object.freeze({classification:'DISTINCT',variantKind:normalized==='showcase'?'Showcase':structured});
  }
  // DB 0.3 has a structured `variant` field. This exact-label fallback is kept
  // only for older normalized fixtures that expose metadataLabel alone.
  if(!printings.some(p=>p?.variantKind||p?.variantType||p?.variant)&&printings.some(p=>String(p?.metadataLabel||'').split(/\s+/).includes('Showcase')))
    return Object.freeze({classification:'DISTINCT',variantKind:'Showcase'});
  return Object.freeze({classification:'NEAR_VARIANT',variantKind:null});
}
export function representativeDisplayAssetPath(database,card,side='front'){
  if(!card)return null;
  const printings=database?.printings||[];
  const primary=printings.find(printing=>printingId(printing)===card.primaryPrintingId&&printingCardId(printing)===card.cardId);
  const primaryAsset=sideAsset(primary,side);if(primaryAsset)return primaryAsset;
  const fallback=printings.find(printing=>printingCardId(printing)===card.cardId&&sideAsset(printing,side));
  return sideAsset(fallback,side);
}

export function resolveCanonicalDisplay(database,cardId,side='front'){
  const card=database?.cardById?.get?.(cardId)||(database?.cards||[]).find(value=>(value.cardId||value.id)===cardId);
  if(!card)return Object.freeze({mode:'canonical',cardId,side,displayAssetPath:null,printingId:null,sourcePrintingId:null,source:'primary-printing',distinctVariant:null});
  const normalizedCard={...card,cardId:card.cardId||card.id};
  const printings=database?.printings||[];
  const primary=printings.find(printing=>printingId(printing)===normalizedCard.primaryPrintingId&&printingCardId(printing)===cardId&&sideAsset(printing,side))||
    printings.find(printing=>printingCardId(printing)===cardId&&sideAsset(printing,side));
  return Object.freeze({mode:'canonical',cardId,side,displayAssetPath:sideAsset(primary,side),printingId:null,sourcePrintingId:printingId(primary),source:'primary-printing',distinctVariant:null});
}

export function resolveDistinctDisplay(canonical,candidate,sampleCount=3){
  const displayAssetPath=candidate?.displayAssetPath||candidate?.ref?.imageUrl||null;if(!displayAssetPath)return canonical;
  return Object.freeze({mode:'distinct-variant',cardId:canonical.cardId,side:canonical.side,displayAssetPath,printingId:null,sourcePrintingId:null,source:'distinct-variant',distinctVariant:{visualFamilyId:candidate.visualFamilyId,recognitionGroupId:candidate.recognitionGroupId,variantKind:candidate.variantKind,sampleCount,reason:'unanimous-distinct-3'}});
}
