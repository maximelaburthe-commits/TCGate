import { DatabaseSource } from './database-source.js';

const EXPECTED=Object.freeze({cards:3048,canonical:7180,front:6719,back:461});

function cardDisplayName(card){return card?.subtitle?`${card.name} - ${card.subtitle}`:(card?.name||'Unknown card');}
function assertArray(name,value){if(!Array.isArray(value))throw new Error(`${name}: expected array`);return value;}
function requireCount(name,value,expected){if(value!==expected)throw new Error(`${name}: expected ${expected}, got ${value}`);}
function unique(values){return [...new Set(values)].sort();}
function sideKey(cardId,side){return `${cardId}\x1f${side||'front'}`;}
function norm(value){return String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
export function expectedSwuLayout(card,side='front'){const type=norm(card?.type);return type==='base'||(type==='leader'&&side==='front')?'landscape':'portrait';}
export function swuSemanticIdentityKey(card,side='front'){return `${norm(card?.name)}\x1f${norm(card?.subtitle)}\x1f${norm(card?.type)}\x1f${side||'front'}`;}

export function resolveSwuRecognition({ref,group,card}){
  if(!ref||!group||!card)return Object.freeze({status:'NO_MATCH',cardId:null,printingId:null,recognitionGroupId:null,candidatePrintingIds:[]});
  const candidates=[...(group.candidatePrintingIds||[])],status=group.classification==='shared'?'SHARED':'CANONICAL_ONLY';
  return Object.freeze({status,cardId:ref.cardId,cardName:cardDisplayName(card),printingId:null,side:ref.side,visualFamilyId:ref.visualFamilyId,recognitionGroupId:ref.recognitionGroupId,recognitionClassification:group.classification,candidatePrintingIds:candidates,displayAssetPath:ref.imageUrl});
}
export function resolveSwuCanonicalStage1({ref,card,groups=[]}){
  if(!ref||!card)return Object.freeze({status:'NO_MATCH',cardId:null,printingId:null,recognitionGroupId:null,candidatePrintingIds:[]});
  const ordered=[...groups].sort((a,b)=>String(a.recognitionGroupId).localeCompare(String(b.recognitionGroupId)));
  if(ordered.length===1)return resolveSwuRecognition({ref,group:ordered[0],card});
  // Multiple visual families for the same canonical card+side are intentionally
  // NOT resolved by Stage 1. R8 accepts the card identity while preserving all
  // physical printing candidates for the future dedicated Stage 2.
  const candidates=unique(ordered.flatMap(group=>group.candidatePrintingIds||[]));
  return Object.freeze({
    status:'CANONICAL_ONLY',cardId:ref.cardId,cardName:cardDisplayName(card),printingId:null,side:ref.side,
    visualFamilyId:null,recognitionGroupId:null,recognitionClassification:'multiple_visual_families',candidatePrintingIds:candidates,
    matchedVisualFamilyId:ref.visualFamilyId,matchedRecognitionGroupId:ref.recognitionGroupId,displayAssetPath:ref.imageUrl
  });
}

export function normalizeStarWarsUnlimited({source,manifest,cards,canonical,printingIndex,coarseManifest,coarseBuffer,descriptorManifest,printings=[]}){
  if(manifest.game!=='star-wars-unlimited')throw new Error('Not a Star Wars Unlimited database');
  assertArray('cards',cards);assertArray('canonical Vision index',canonical);assertArray('printing recognition cards',printingIndex?.cards);
  requireCount('cards',cards.length,EXPECTED.cards);requireCount('canonical references',canonical.length,EXPECTED.canonical);
  const front=canonical.filter(x=>x.side==='front').length,back=canonical.filter(x=>x.side==='back').length;
  requireCount('canonical front',front,EXPECTED.front);requireCount('canonical back',back,EXPECTED.back);
  if(coarseManifest?.referenceCount!==EXPECTED.canonical||coarseManifest?.dimension!==216)throw new Error('Invalid SWU coarse manifest cardinality');
  if(coarseManifest?.byteLength!==EXPECTED.canonical*216*4)throw new Error('Invalid SWU coarse byteLength');
  if(!(coarseBuffer instanceof ArrayBuffer)||coarseBuffer.byteLength!==coarseManifest.byteLength)throw new Error('Invalid SWU coarse binary');
  const coarseValues=new Float32Array(coarseBuffer);
  if(coarseValues.length!==EXPECTED.canonical*216)throw new Error('Invalid SWU coarse Float32 length');
  for(let i=0;i<coarseValues.length;i++)if(!Number.isFinite(coarseValues[i]))throw new Error(`SWU coarse contains non-finite value at ${i}`);
  const mapping=assertArray('coarse references',coarseManifest.references);
  requireCount('coarse reference mapping',mapping.length,EXPECTED.canonical);
  const canonicalByRef=new Map(canonical.map(x=>[x.refId,x]));
  const groupById=new Map(),groupsByCardSide=new Map();
  for(const cardEntry of printingIndex.cards){for(const sideEntry of cardEntry.sides||[]){for(const group of sideEntry.recognitionGroups||[]){
    const normalized={...group,cardId:cardEntry.cardId,side:sideEntry.side};groupById.set(group.recognitionGroupId,normalized);
    const key=sideKey(cardEntry.cardId,sideEntry.side);if(!groupsByCardSide.has(key))groupsByCardSide.set(key,[]);groupsByCardSide.get(key).push(normalized);
  }}}
  const normalizedPrintings=printings.map(printing=>Object.freeze({...printing,printingId:printing.id}));
  const firstStandardByCard=new Map();for(const printing of normalizedPrintings)if(!firstStandardByCard.has(printing.cardId)&&String(printing.variant||'').toLowerCase()==='standard')firstStandardByCard.set(printing.cardId,printing.printingId);
  const normalizedCards=cards.map(card=>Object.freeze({...card,cardId:card.id,primaryPrintingId:card.primaryPrintingId||firstStandardByCard.get(card.id)||null}));
  const cardById=new Map(normalizedCards.map(card=>[card.id,card]));
  const printingById=new Map(normalizedPrintings.map(printing=>[printing.id,printing]));
  const seen=new Set();
  const refs=mapping.map((item,index)=>{
    if(item.index!==index)throw new Error(`SWU coarse mapping index mismatch at ${index}`);
    if(seen.has(item.refId))throw new Error(`Duplicate SWU refId: ${item.refId}`);seen.add(item.refId);
    const canonicalRef=canonicalByRef.get(item.refId);if(!canonicalRef)throw new Error(`SWU coarse orphan ref: ${item.refId}`);
    if(canonicalRef.cardId!==item.cardId||canonicalRef.side!==item.side||canonicalRef.visualFamilyId!==item.visualFamilyId||canonicalRef.recognitionGroupId!==item.recognitionGroupId)throw new Error(`SWU mapping mismatch: ${item.refId}`);
    if(!groupById.has(item.recognitionGroupId))throw new Error(`SWU recognition group missing: ${item.recognitionGroupId}`);
    if(!cardById.has(item.cardId))throw new Error(`SWU card missing: ${item.cardId}`);
    const card=cardById.get(item.cardId);
    return Object.freeze({...canonicalRef,index,name:cardDisplayName(card),cardName:card?.name||'',subtitle:card?.subtitle||'',cardType:card?.type||'',physicalLayout:expectedSwuLayout(card,item.side),semanticIdentityKey:swuSemanticIdentityKey(card,item.side)});
  });
  const decoratedByRef=new Map(refs.map(x=>[x.refId,x]));
  const canonicalByGroup=new Map(refs.map(x=>[x.recognitionGroupId,x]));
  const semanticCardIdsByKey=new Map();
  for(const ref of refs){if(!semanticCardIdsByKey.has(ref.semanticIdentityKey))semanticCardIdsByKey.set(ref.semanticIdentityKey,new Set());semanticCardIdsByKey.get(ref.semanticIdentityKey).add(ref.cardId);}
  const database={
    gameId:'star-wars-unlimited',databaseVersion:manifest.databaseVersion,visionProfile:manifest.recognitionProfileId,
    descriptorVersion:manifest.descriptorVersion||descriptorManifest?.descriptorVersion,engineMode:'scalable',manifest,cards:normalizedCards,printings:normalizedPrintings,
    canonicalReferences:refs,printingRecognition:printingIndex.cards,recognitionGroups:[...groupById.values()],
    coarseIndex:Object.freeze({values:coarseValues,manifest:coarseManifest}),descriptorManifest,
    assetUrl:path=>source.url(path),cardById,printingById,groupById,groupsByCardSide,canonicalByRef:decoratedByRef,canonicalByGroup,semanticCardIdsByKey
  };
  database.resolveCanonicalResult=(refId)=>{
    const ref=decoratedByRef.get(refId),card=ref?cardById.get(ref.cardId):null;
    const semanticCardIds=ref?[...(semanticCardIdsByKey.get(ref.semanticIdentityKey)||new Set([ref.cardId]))].sort():[];
    const groups=ref?semanticCardIds.flatMap(cardId=>groupsByCardSide.get(sideKey(cardId,ref.side))||[]):[];
    const result=resolveSwuCanonicalStage1({ref,card,groups});
    return Object.freeze({...result,semanticCandidateCardIds:semanticCardIds});
  };
  return Object.freeze(database);
}

export class StarWarsUnlimitedAdapter {
  async load({baseUrl='/db-local/star-wars-unlimited'}={}){
    const source=new DatabaseSource({baseUrl});
    const manifest=await source.json('manifest.json');
    if(manifest.game!=='star-wars-unlimited')throw new Error('Not a Star Wars Unlimited database');
    const [cards,canonical,printingIndex,coarseManifest,descriptorManifest,printings]=await Promise.all([
      source.json(manifest.entrypoint||'runtime/cards.min.json'),
      source.json(manifest.canonicalVisionIndex||'runtime/canonical-vision-index.json'),
      source.json(manifest.printingRecognitionIndex||'runtime/printing-recognition-index.json'),
      source.json(manifest.coarseVisionManifest||'runtime/vision-coarse-index.json'),
      source.json(manifest.descriptorManifest||'runtime/vision-descriptor-manifest.json'),
      source.json('data/printings.json')
    ]);
    const coarseBuffer=await source.arrayBuffer(manifest.coarseVisionIndex||'runtime/vision-coarse-index.bin');
    return normalizeStarWarsUnlimited({source,manifest,cards,canonical,printingIndex,coarseManifest,coarseBuffer,descriptorManifest,printings});
  }
}
