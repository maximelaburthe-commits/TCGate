(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;if(root)root.TCGWorkspaceDatabases=api;})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  const base='https://github.com/maximelaburthe-commits/';
  return Object.freeze([
    Object.freeze({gameId:'cyberpunk',label:'Cyberpunk',repositoryUrl:base+'tcgate_db_cyberpunk',actionsUrl:base+'tcgate_db_cyberpunk/actions',updateWorkflowUrl:null,
      candidateUrl:base+'tcgate_db_cyberpunk/tree/develop-cyberpunk-db-v1.2',
      candidate:{status:'development',version:'1.2.0',schema:'2.1.0',sha:'425e0198610cd0a746c4e2d1fc3094b3823340e4',locales:['en','fr'],
        detail:'Checkpoint connu : 151 cartes canoniques · 700 printings · 140 cartes FR · 150 printings FR · fallback FR → EN. Retail préparé, non actif.',
        blockers:['Asset rights review','Assets Retail à ingérer','Qualification physique Vision EN/FR','Validation du scope Retail']},
      source:'Snapshots versionnés du repository DB ; aucune source externe en partie.'}),
    Object.freeze({gameId:'swu',label:'SWU',repositoryUrl:base+'tcgate_db_star_wars_unlimited',actionsUrl:base+'tcgate_db_star_wars_unlimited/actions',updateWorkflowUrl:null,candidateUrl:null,candidate:null,
      source:'Source et snapshot à qualifier ; aucune DB SWU active configurée dans TCGate.'})
  ]);
});
