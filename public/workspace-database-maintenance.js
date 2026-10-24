'use strict';
(()=>{
  const Model=window.TCGWorkspaceDatabaseMaintenanceModel,mount=document.getElementById('databaseCards');
  if(!Model||!mount)return;
  const configured=(window.TCGWorkspaceDatabases||[]),cyberpunk=configured.find(db=>db.gameId==='cyberpunk');
  if(!cyberpunk)return;
  let candidate=Model.normalizeCandidate(cyberpunk.candidate||{}),reading=false,attempted=false;
  const element=(tag,value,parent,className)=>{const node=document.createElement(tag);if(value!==null&&value!==undefined)node.textContent=String(value);if(className)node.className=className;parent.append(node);return node;};
  const show=value=>value===null||value===undefined?'Non exposé':typeof value==='boolean'?(value?'oui':'non'):String(value);
  const date=value=>{if(!value)return 'Non exposée';const parsed=new Date(value);return Number.isNaN(parsed.valueOf())?String(value):new Intl.DateTimeFormat('fr-FR',{dateStyle:'short',...(String(value).includes('T')?{timeStyle:'medium'}:{})}).format(parsed);};
  function link(label,url,parent){
    let parsed;try{parsed=new URL(url);}catch{return null;}
    if(parsed.protocol!=='https:'||parsed.search||parsed.username||parsed.password||!['github.com','raw.githubusercontent.com'].includes(parsed.hostname)||!parsed.pathname.startsWith('/maximelaburthe-commits/'))return null;
    const node=element('a',label,parent,'button');node.href=parsed.href;node.target='_blank';node.rel='noopener noreferrer';return node;
  }
  function badge(label,parent){const kind=label==='QUALIFIED'?'qualified':label==='BLOCKED'?'attention':label==='READY FOR LAB'?'stable':label==='ACTIVE'?'active':'experimental';element('span',label,parent,'badge '+kind);}
  function details(label,summary,parent){
    const count=summary?.available?summary.count:'Non exposé';
    if(!summary?.items?.length){element('p',label+' : '+count,parent);return;}
    const node=element('details',null,parent);element('summary',label+' : '+count,node);const list=element('ul',null,node);
    summary.items.forEach(item=>element('li',item,list));
  }
  function table(headers,parent){const node=element('table',null,parent),head=element('thead',null,node),row=element('tr',null,head);headers.forEach(label=>{const cell=element('th',label,row);cell.scope='col';});return element('tbody',null,node);}
  function row(body,label,...values){const node=element('tr',null,body),head=element('th',label,node);head.scope='row';values.forEach(value=>element('td',show(value),node));}
  function render(){
    mount.replaceChildren();
    const toolbar=element('div',null,mount,'toolbar database-maintenance-toolbar');
    const refresh=element('button',reading?'Lecture en cours…':'Rafraîchir l’état BDD',toolbar);refresh.id='databaseRefresh';refresh.disabled=reading;refresh.addEventListener('click',refreshState);
    const status=element('span',candidate.lastRead?'Dernière lecture : '+date(candidate.lastRead):'Dernière lecture : aucune · fallback connu non relu',toolbar,'muted');status.id='databaseMaintenanceStatus';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    const article=element('article',null,mount,'database-maintenance');article.id='databaseCyberpunk';
    element('h3','Cyberpunk',article);
    const badges=element('div',null,article,'toolbar');badge('ACTIVE',badges);candidate.badges.forEach(value=>badge(value,badges));
    const active=Model.activeFrom(window.TCGateGameDatabases,'cyberpunk');
    const body=table(['Champ','ACTIVE TCGATE','CANDIDATE CYBERPUNK'],article);
    row(body,'Version',active?.version,candidate.version);
    row(body,'SHA immuable',active?.sha,candidate.sha);
    row(body,'Statut',active?.status,candidate.status+(candidate.fallbackOnly?' · fallback non relu':''));
    row(body,'Jeu',active?.game,candidate.game);row(body,'Scope runtime',active?.runtimeScope,candidate.runtimeScope);
    row(body,'Schema',null,candidate.schema);row(body,'Locales',null,candidate.locales.join(' / ')||null);
    row(body,'Cartes canoniques',active?.canonicalCards,candidate.canonicalCards);
    row(body,'Printings catalogue',null,candidate.printings);
    row(body,'Printings runtime Vision',active?.runtimePrintings,candidate.runtimePrintings);
    row(body,'Recognition groups',active?.recognitionGroups,null);
    row(body,'Matcher references',active?.matcherReferences,null);
    row(body,'Assets d’affichage / Vision',null,candidate.displayAssets===null?null:candidate.displayAssets+' / '+show(candidate.visionAssets)+' · toutes locales');
    row(body,'Assets runtime affichage / Vision',null,candidate.runtimeDisplayAssets===null?null:candidate.runtimeDisplayAssets+' / '+show(candidate.runtimeVisionAssets));
    row(body,'Couverture Vision runtime',null,candidate.visionEligible===null?null:candidate.visionEligible+' éligibles · '+show(candidate.visionMissing)+' manquants');
    row(body,'Assets catalogue hors runtime manquants',null,candidate.futureAssetsMissing);
    row(body,'Runtime readiness',active?.runtimeReady,candidate.runtimeReady);
    element('p','ACTIVE est lu exclusivement dans public/game-databases.js. La branche main de la BDD ne détermine jamais la BDD utilisée.',article,'muted');
    if(active?.manifestUrl)link('Manifest actif',active.manifestUrl,article);
    const source=element('section',null,article,'database-source-notice');
    element('h4','Sources et dates',source);
    element('p','HEAD Candidate : '+candidate.headSource+(candidate.headResolvedAt?' · lu le '+date(candidate.headResolvedAt):''),source);
    element('p','Snapshot Candidate : '+date(candidate.snapshotDate)+(candidate.capturedAt?' · capturé le '+date(candidate.capturedAt):'')+' · '+(candidate.snapshotSource||'non relu'),source);
    element('p','Dernière synchronisation staging : '+date(candidate.staging.snapshotDate)+(candidate.staging.capturedAt?' · '+date(candidate.staging.capturedAt):'')+' · staging/latest/sync_report.json',source);
    element('p','Staging : '+show(candidate.staging.mode)+' · santé '+show(candidate.staging.health)+' · cartes '+show(candidate.staging.canonicalCards)+' · printings '+show(candidate.staging.printings)+'. Ces données décrivent le staging, pas le snapshot Candidate.',source,'muted');
    const summary=element('section',null,article);element('h4','Résumé des changements Candidate',summary);
    const labels={newCards:'Nouvelles cartes',newPrintings:'Nouveaux printings',newLocales:'Nouvelles locales',newAssets:'Nouveaux assets',changedAssets:'Assets modifiés',missingAssets:'Assets manquants (update report)',missingMetadata:'Metadata manquantes (champs par locale)'};
    for(const [key,label]of Object.entries(labels))details(label,candidate.update.changes[key],summary);
    element('p','Source utilisée : '+show(candidate.update.sourceAuthority)+(candidate.update.sourceUrl?' · '+candidate.update.sourceUrl:''),summary);
    element('p','Asset rights review : '+(candidate.update.assetRightsReviewRequired===null?'non exposé':candidate.update.assetRightsReviewRequired?'requis':'non requis'),summary);
    element('p','READY FOR LAB décrit le runtime disponible pour inspection ; ce badge ne qualifie pas la reconnaissance physique ni toutes les locales du catalogue.',summary,'muted');
    element('p','Runtime blockers : '+(candidate.runtimeBlockers.length?candidate.runtimeBlockers.join(' ; '):candidate.runtimeReady===null?'Non exposés':'aucun déclaré'),summary);
    if(candidate.fallbackOnly){element('p','Fallback connu : '+(candidate.knownDetail||'Version et SHA issus de la configuration. Les rapports n’ont pas été relus.'),summary,'muted');element('p','Points de vigilance connus : '+candidate.knownBlockers.join(' ; '),summary,'muted');}
    if(candidate.localeCoverage.length){
      const localeSection=element('section',null,article);element('h4','Couverture par locale',localeSection);
      for(const locale of candidate.localeCoverage){
        const node=element('details',null,localeSection);element('summary',locale.locale.toUpperCase()+' · '+show(locale.canonicalCards)+' cartes · '+show(locale.printings)+' printings · Vision '+show(locale.visionAssets)+' · assets manquants '+show(locale.missingAssets.count),node);
        const values=element('dl',null,node);
        for(const [label,value]of [['Cartes',locale.canonicalCards],['Printings',locale.printings],['Affichage',locale.displayAssets],['Vision',locale.visionAssets]]){element('dt',label,values);element('dd',show(value),values);}
        details('Assets manquants',locale.missingAssets,node);details('Metadata manquantes',locale.missingMetadata,node);
      }
    }
    const actions=element('div',null,article,'toolbar');
    const workflow=link('Vérifier les mises à jour',Model.WORKFLOW_URL,actions);if(workflow)workflow.id='databaseCheckUpdates';
    const test=element('button','Tester la Candidate dans Vision Lab',actions);test.id='databaseTestCandidate';test.disabled=!candidate.validManifest;test.addEventListener('click',()=>window.dispatchEvent(new CustomEvent('tcgate-workspace-test-candidate',{detail:{manifestUrl:candidate.urls.manifest,sha:candidate.sha}})));
    link('Voir la Candidate',cyberpunk.candidateUrl||'https://github.com/'+Model.REPOSITORY+'/tree/'+Model.BRANCH,actions);
    link('Manifest Candidate',candidate.urls.manifest,actions);link('Voir la DB GitHub',cyberpunk.repositoryUrl,actions);
    element('p','GitHub ouvre « Validate TCGate database ». Choisir Run workflow avec promote = false. Vérifie la source officielle et met à jour staging sans promouvoir les données dans la DB publiée.',article,'muted');
    element('p','Le test inspecte uniquement le manifest Candidate dans Vision Lab. L’identification reste une activation manuelle après inspection. Aucune promotion BDD ni écriture GitHub depuis le Workspace.',article,'muted');
    if(candidate.errors.length){const errors=element('details',null,article,'database-read-errors');element('summary','Lecture partielle ou indisponible · fallback conservé',errors);const list=element('ul',null,errors);candidate.errors.forEach(error=>element('li',error,list));}
    const swu=configured.find(db=>db.gameId==='swu');if(swu){const other=element('article',null,mount,'database-maintenance');element('h3','SWU',other);element('p','ACTIVE · non configurée',other);element('p','Aucune Candidate · source et snapshot à qualifier.',other);const actions=element('div',null,other,'toolbar');const noCandidate=element('button','Aucune Candidate',actions);noCandidate.disabled=true;link('Voir la DB GitHub',swu.repositoryUrl,actions);link('Ouvrir GitHub Actions',swu.actionsUrl,actions);}
  }
  async function refreshState(){
    if(reading)return;reading=true;attempted=true;render();
    try{candidate=await Model.loadCandidate(cyberpunk.candidate||{});}catch(error){candidate={...candidate,lastRead:new Date().toISOString(),errors:[...candidate.errors,error.message]};}
    finally{reading=false;render();}
  }
  document.getElementById('tab-bdd')?.addEventListener('click',()=>{if(!attempted)refreshState();});
  render();
  window.TCGWorkspaceDatabaseMaintenance=Object.freeze({refresh:refreshState,snapshot:()=>candidate});
})();
