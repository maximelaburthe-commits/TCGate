function groupsForCard(database,cardId){return(database.recognitionGroups||[]).filter(group=>group.cardId===cardId);}
function allCandidates(groups){return[...new Set(groups.flatMap(group=>group.candidatePrintingIds||group.printingIds||[]))];}

export function representativeDisplayAssetPath(database,card){
  if(!card)return null;
  const primary=database.printings.find(printing=>printing.printingId===card.primaryPrintingId&&printing.cardId===card.cardId);
  if(primary?.displayAssetPath)return primary.displayAssetPath;
  return database.printings.find(printing=>printing.cardId===card.cardId&&printing.displayAssetPath)?.displayAssetPath||null;
}

export function resolvePrintingResult(database,cardId,recognitionGroupId=null){
  const card=database.cards.find(value=>value.cardId===cardId);
  if(!card)return Object.freeze({status:'NO_MATCH',cardId:null,printingId:null,recognitionGroupId:null,candidatePrintingIds:[]});
  const representativeAsset=representativeDisplayAssetPath(database,card),cardGroups=groupsForCard(database,cardId);
  if(!recognitionGroupId)return Object.freeze({status:'CANONICAL_ONLY',cardId,cardName:card.name,printingId:null,recognitionGroupId:null,candidatePrintingIds:allCandidates(cardGroups),displayAssetPath:representativeAsset});
  const group=cardGroups.find(value=>value.recognitionGroupId===recognitionGroupId);
  if(!group)return Object.freeze({status:'CANONICAL_ONLY',cardId,cardName:card.name,printingId:null,recognitionGroupId:null,candidatePrintingIds:allCandidates(cardGroups),displayAssetPath:representativeAsset});
  const candidates=[...(group.candidatePrintingIds||group.printingIds||[])],exact=group.mode==='exact'&&candidates.length===1,printing=exact?database.printings.find(value=>value.printingId===candidates[0]):null;
  return Object.freeze({status:exact?'EXACT':'SHARED',cardId,cardName:card.name,printingId:printing?.printingId||null,recognitionGroupId:group.recognitionGroupId,candidatePrintingIds:candidates,displayAssetPath:exact?(printing?.displayAssetPath||null):representativeAsset});
}
