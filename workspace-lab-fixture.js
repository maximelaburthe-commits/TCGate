'use strict';
// Synthetic two-language corpus used only by Workspace tests. No production data changed.
function fixture(){
 const cards=[{cardId:'card-1',name:'Test Card',type:'Unit'}];
 const printings=['en','fr'].map(locale=>({printingId:'printing-'+locale,cardId:'card-1',locale,displayAssetPath:'assets/'+locale+'.png'}));
 const group={recognitionGroupId:'group-1',cardId:'card-1',candidatePrintingIds:printings.map(p=>p.printingId),mode:'ambiguous'};
 return {
  'manifest.json':{game_id:'test-game',database_version:'0.1-test',status:'development',runtime_scope:'lab',runtime_ready:false,availableLocales:['en','fr'],defaultLocale:'en',multilingual_coverage:'coverage.json',database_manifest:'db-manifest.json',runtime_cards:'cards.json',runtime_printings:'printings.json',canonical_vision_index:'canonical.json',printing_recognition_index:'printing-index.json',recognition_groups:'groups.json'},
  'db-manifest.json':{schemaVersion:'2.1.0',status:'development',activeSnapshot:'synthetic-test'},
  'cards.json':cards,'printings.json':printings,'canonical.json':{references:[{cardId:'card-1'}]},
  'printing-index.json':{cards:[{cardId:'card-1',recognitionGroups:[{...group,references:printings.map(p=>({printingId:p.printingId,visionAssetPath:'assets/'+p.locale+'.png'}))}]}]},
  'groups.json':{recognitionGroups:[group]},'coverage.json':{localizationCoverage:{en:{canonicalCards:1,visionAssets:1},fr:{canonicalCards:1,visionAssets:1}}}
 };
}
module.exports={fixture};
