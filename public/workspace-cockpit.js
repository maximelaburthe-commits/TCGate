'use strict';
(()=>{
  const $=id=>document.getElementById(id),model=window.TCGWorkspaceCockpit;
  const rawStateUrl='https://raw.githubusercontent.com/maximelaburthe-commits/TCGate/workspace-state/tcgate_workspace_state.json';
  const labels={stable:'Stable',qualified:'Qualifié',attention:'Attention',experimental:'Expérimental',prototype:'Prototype','in-progress':'En cours',planned:'Planifié',spec:'SPEC',abandoned:'Abandonné',active:'Actif',next:'Suivant',later:'Plus tard',paused:'En pause',open:'Ouverte',deferred:'Différée',reference:'Référence'};
  function node(tag,value,parent,className){const e=document.createElement(tag);if(value!=null)e.textContent=String(value);if(className)e.className=className;parent?.append(e);return e;}
  function badge(value,parent){return node('span',labels[value]||value||'Non renseigné',parent,'badge '+(Object.hasOwn(labels,value)?value:''));}
  function card(title,parent,className=''){const e=node('article',null,parent,'card '+className);node('h3',title,e);return e;}
  function row(parent,label,value){node('dt',label,parent);node('dd',value??'Non renseigné',parent);}
  function referenceCards(meta,parent){
    const grid=node('div',null,parent,'reference-grid');
    for(const[key,label]of [['production','Production'],['candidate','Candidate disponible'],['development','Développement']]){
      const ref=meta[key]||{},e=card(label,grid,'reference-card');e.dataset.testid='ref-'+key;
      node('strong',ref.label||ref.branch||'Non renseigné',e,'reference-label');node('code',ref.sha||'SHA non renseigné',e,'reference-sha');
      if(ref.branch)node('small',ref.branch,e);
      if(ref.status)badge(ref.status,e);if(ref.sync)badge(ref.sync,e);
      if(Number.isFinite(ref.ahead)&&Number.isFinite(ref.behind))node('small',ref.ahead+' devant / '+ref.behind+' derrière · état enregistré',e);
      if(ref.note)node('p',ref.note,e,'muted');
    }
  }
  function sessionCard(title,items,parent){
    const e=card(title,parent),list=node('div',null,e,'session-list');
    for(const item of items||[]){const entry=node('div',null,list,'session-item'),head=node('div',null,entry,'session-item-head');node('strong',item.title,head);if(item.status)badge(item.status,head);node('p',item.detail||'',entry);}
    if(!items?.length)node('p','Aucun élément enregistré.',list,'muted');
  }
  function renderResume(state){
    const container=$('content-reprise');container.replaceChildren();
    node('h2','Références',container,'section-title');referenceCards(state.meta||{},container);
    const sync=card('Synchronisation du workspace',container);const list=node('dl',null,sync);row(list,'Source',rawStateUrl);row(list,'Version',state.meta?.workspaceVersion);row(list,'État daté du',state.meta?.generatedAt);row(list,'Mode',state.sync?.remoteStateMode||'canonique');node('p','État canonique chargé indépendamment de la caméra et du Vision Lab.',sync,'muted');
    node('h2','Pilotage',container,'section-title');const lists=node('div',null,container,'session-grid');
    sessionCard('En cours actuellement',state.session.activeWork,lists);sessionCard('Prochaines priorités',state.session.priorities,lists);sessionCard('Décisions à prendre',state.session.decisions,lists);
    const bottom=node('div',null,container,'two-columns');const notes=card('Notes de reprise',bottom);node('p',state.session.notes||'Aucune note enregistrée.',notes,'resume-notes');
    const verified=card('État vérifié',bottom),v=state.verification||{},dl=node('dl',null,verified);
    row(dl,'Date',v.verifiedAt);row(dl,'Source',v.source);row(dl,'main',v.main);row(dl,'Candidate',v.candidate14);row(dl,'update/next',v.updateNext);
    node('p','Vérification enregistrée dans le workspace-state ; ces références ne sont pas une vérification Git en temps réel.',verified,'muted');
  }
  function functionsTable(items,parent){
    if(!items.length){node('p','Aucune fonction enregistrée.',parent,'muted');return;}
    const wrap=node('div',null,parent,'function-table-wrap');const table=node('table',null,wrap,'function-table');
    const header=node('tr',null,node('thead',null,table));for(const name of ['Fonction','État / maturité','Piste / version','Avancement','Roadmap'])node('th',name,header);
    const body=node('tbody',null,table);
    for(const item of items){
      const tr=node('tr',null,body);tr.dataset.itemId=item.id;
      const title=node('td',null,tr),detail=node('details',null,title),summary=node('summary',item.name,detail);summary.className='function-name';node('p',item.summary||'',detail,'function-summary');
      const info=node('dl',null,detail);for(const[key,label]of [['maturity','Maturité'],['efficiency','Efficacité'],['dbState','État BDD'],['coverage','Couverture']])if(item[key])row(info,label,item[key]);
      if(item.notes)node('p',item.notes,detail);if(item.history?.length){node('h4','Historique',detail);const timeline=node('div',null,detail,'timeline');for(const event of item.history){const line=node('div',null,timeline);node('time',event.date,line);node('span',event.text,line);}}
      const status=node('td',null,tr);badge(item.status,status);node('small',item.maturity||'',status);
      const track=node('td',null,tr);node('code',item.track||'—',track);node('small',item.version||'',track);
      const progress=node('td',null,tr);const bar=node('progress',null,progress);bar.max=100;bar.value=+item.progress||0;bar.setAttribute('aria-label','Avancement de '+item.name);node('small',(+item.progress||0)+' %',progress);
      node('td',item.roadmap?'Incluse':'Hors périmètre',tr,'muted');
    }
  }
  function renderCategory(state,id,label){
    const parent=$('content-'+id),category=state.categories?.find(c=>c.id===id);parent.replaceChildren();
    const heading=node('div',null,parent,'section-heading');node('h2',category?.label||label,heading);
    if(id==='vision'){const open=node('button','Ouvrir Vision Lab',heading,'primary');open.addEventListener('click',()=>$('tab-lab').click());}
    if(category?.description)node('p',category.description,parent,'muted');
    if(id==='vision'&&state.visionLab){const lab=card('Référence Vision Lab',parent);node('strong',[state.visionLab.version,state.visionLab.qualification].filter(Boolean).join(' · '),lab);if(state.visionLab.role)node('p',state.visionLab.role,lab);}
    functionsTable(model.category(state.items,id),parent);
  }
  function renderGeneral(state){
    const parent=$('content-general');parent.replaceChildren();const m=model.metrics(state.items),grid=node('div',null,parent,'kpi-grid');
    for(const[id,label,value,hint]of [['overall','Avancement global roadmap',m.overall+' %','Moyenne pondérée du périmètre roadmap'],['count','Fonctions suivies',m.count,'Toutes les catégories'],['stableCount','Qualifiées / stables',m.stableCount,'Stable ou qualifié'],['attentionCount','Points d’attention',m.attentionCount,'Attention, expérimental ou prototype']]){
      const e=card(label,grid,'kpi');const val=node('div',value,e,'kpi-value');val.id=id;node('small',hint,e);
    }
    const maturity=card('Score de maturité global',parent),bar=node('progress',null,maturity);bar.id='overallBar';bar.max=100;bar.value=m.overall;bar.setAttribute('aria-label','Score de maturité global');
    node('p',m.overall+' % · '+m.roadmapCount+' fonctions pondérées. Les fonctions hors roadmap, abandonnées ou de poids nul sont exclues.',maturity,'muted');
    referenceCards(state.meta||{},parent);
    const category=state.categories?.find(c=>c.id==='general');node('h2',category?.label||'Fonctions générales',parent,'section-title');if(category?.description)node('p',category.description,parent,'muted');functionsTable(model.category(state.items,'general'),parent);
  }
  function render(state){
    renderResume(state);renderGeneral(state);for(const[id,label]of [['vision','Vision'],['bdd','BDD'],['uiux','UI / UX'],['annex','Fonctions annexes']])renderCategory(state,id,label);
    $('workspaceVersion').textContent='Workspace '+(state.meta?.workspaceVersion||'—');
  }
  let loading=false;
  async function loadState(){
    if(loading)return;loading=true;$('workspaceSync').disabled=true;$('workspaceStateStatus').textContent='Synchronisation de l’état canonique…';
    try{
      const response=await fetch(rawStateUrl,{credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('HTTP '+response.status);
      const state=await response.json();if(!Array.isArray(state.items)||!state.session)throw Error('État canonique invalide');render(state);
      $('workspaceStateStatus').textContent='État canonique · Workspace '+(state.meta?.workspaceVersion||'—')+' · données du '+(state.meta?.generatedAt||'date inconnue');$('workspaceStateStatus').className='workspace-notice good';
    }catch(error){$('workspaceStateStatus').textContent='État canonique indisponible : '+error.message+'. Le Vision Lab reste indépendant. Les données déjà affichées sont conservées.';$('workspaceStateStatus').className='workspace-notice error';}
    finally{loading=false;$('workspaceSync').disabled=false;}
  }
  $('workspaceSync').addEventListener('click',loadState);loadState();
})();
