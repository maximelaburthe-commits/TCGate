'use strict';
(()=>{
  const model=window.TCGWorkspaceJournal,mount=document.getElementById('journalMount');if(!model||!mount)return;
  const $=id=>document.getElementById(id);let config=model.configuration(),entries=[],loaded=false,loading=false,requestNumber=0;
  let storage;try{storage=window.localStorage;}catch{}
  let draft=model.readDraft(storage);
  function node(tag,text,parent,className){const element=document.createElement(tag);if(text!=null)element.textContent=String(text);if(className)element.className=className;parent?.append(element);return element;}
  function link(text,url,parent){const element=node('a',text,parent);element.href=url;element.target='_blank';element.rel='noopener noreferrer';return element;}
  function card(title,parent){const element=node('article',null,parent,'card');node('h3',title,element);return element;}
  function select(label,id,values,parent,initial){const wrap=node('label',label,parent),element=node('select',null,wrap);element.id=id;for(const value of values){const option=node('option',typeof value==='string'?value:value.label,element);option.value=typeof value==='string'?value:value.value;}element.value=initial;return element;}
  function input(label,id,tag,parent,required){const wrap=node('label',label,parent),element=node(tag,null,wrap);element.id=id;element.name=id;if(tag==='input')element.type='text';else element.rows=4;element.required=!!required;return element;}
  function time(value){return value?new Date(value).toLocaleString('fr-FR'):'Date non renseignée';}
  mount.replaceChildren();
  const intro=card('Journal de pilotage',mount);node('p',"Le Journal constitue l'inbox opérationnel du projet. Lors de la préparation d'un nouveau jalon, consulter les entrées ouvertes du Journal avec l'état canonique du Workspace avant de décider des priorités.",intro);
  node('p',"workspace-state conserve l'état consolidé. Les GitHub Issues [JOURNAL] rassemblent les choses à intégrer, tester, vérifier, décider ou investiguer.",intro,'muted');
  const role=node('p',config.role,intro,'muted'),principle=node('p',config.principle,intro,'muted');
  const controls=node('div',null,intro,'toolbar'),refresh=node('button','Rafraîchir le journal',controls);refresh.type='button';refresh.id='journalRefresh';
  const github=link('Ouvrir GitHub',model.issuesUrl(config),controls);github.id='journalGitHub';
  const status=node('p','Les entrées GitHub sont lues à l’ouverture de cet onglet.',intro,'muted');status.id='journalStatus';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const formCard=card('Nouvelle entrée',mount),form=node('form',null,formCard,'journal-form');form.id='journalForm';
  node('p','Brouillon local',form,'badge');const draftState=node('p','Ce brouillon reste dans ce navigateur. Il ne devient officiel qu’après confirmation de création sur GitHub.',form,'muted');draftState.id='journalDraftStatus';
  const fields=node('div',null,form,'journal-fields');
  const type=select('Type','journalType',model.TYPES,fields,draft.type),domain=select('Domaine','journalDomain',model.DOMAINS,fields,draft.domain),priority=select('Priorité','journalPriority',model.PRIORITIES,fields,draft.priority);
  const title=input('Titre','journalTitle','input',form,true),description=input('Description','journalDescription','textarea',form,true),context=input('Contexte optionnel','journalContext','textarea',form),validation=input('Critère de validation optionnel','journalValidation','textarea',form);
  for(const [element,key] of [[title,'title'],[description,'description'],[context,'context'],[validation,'validation']])element.value=draft[key];
  node('p','N’incluez pas de secrets ou de données sensibles. Aucun envoi automatique : GitHub vous demandera de confirmer la création.',form,'muted');
  const actions=node('div',null,form,'toolbar'),publish=node('button','Publier dans le journal',actions,'primary');publish.type='submit';publish.id='journalPublish';
  const clear=node('button','Effacer le brouillon',actions);clear.type='button';clear.id='journalClearDraft';
  const preview=link('Prévisualiser le formulaire GitHub',model.issueUrl(draft,config),actions);preview.id='journalPrefilledLink';
  const large=node('div',null,form,'journal-large-draft');large.hidden=true;node('p','Ce brouillon dépasse la taille conseillée pour une URL. Son contenu intégral est conservé ci-dessous : copiez le titre et le corps dans le formulaire GitHub.',large);
  const copyTitle=input('Titre GitHub à copier','journalCopyTitle','input',large),copyBody=input('Corps GitHub à copier','journalCopyBody','textarea',large);copyTitle.readOnly=true;copyBody.readOnly=true;copyBody.rows=10;
  const blankForm=link('Ouvrir un formulaire GitHub vide',model.repositoryUrl(config)+'/issues/new',large);blankForm.id='journalBlankForm';
  const filters=node('div',null,mount,'card toolbar'),filterType=select('Filtrer par type','journalFilterType',[{value:'all',label:'Tous'},...model.TYPES.map(value=>({value,label:({Bug:'Bugs',Idée:'Idées',Décision:'Décisions'})[value]||value}))],filters,'all'),filterPriority=select('Filtrer par priorité','journalFilterPriority',[{value:'all',label:'Toutes les priorités'},...model.PRIORITIES],filters,'all');
  const pending=card('À traiter',mount),pendingEntries=node('div',null,pending,'journal-entries');pendingEntries.id='journalOpen';
  const history=card('Historique',mount),historyEntries=node('div',null,history,'journal-entries');historyEntries.id='journalClosed';
  function collectDraft(){return model.normalizeDraft({type:type.value,domain:domain.value,priority:priority.value,title:title.value,description:description.value,context:context.value,validation:validation.value});}
  function updatePreview(){
    draft=collectDraft();const url=model.issueUrl(draft,config),tooLong=url.length>model.MAX_FORM_URL;
    preview.hidden=tooLong;preview.href=tooLong?model.repositoryUrl(config)+'/issues/new':url;publish.disabled=tooLong;large.hidden=!tooLong;copyTitle.value=model.issueTitle(draft.title);copyBody.value=model.generateBody(draft);blankForm.href=model.repositoryUrl(config)+'/issues/new';
  }
  function saveDraft(){updatePreview();const saved=model.writeDraft(storage,draft);draftState.textContent=saved?'Brouillon local enregistré dans ce navigateur. Confirmez la création sur GitHub pour publier une entrée officielle.':'Brouillon local en mémoire : le stockage navigateur est indisponible. Confirmez la création sur GitHub pour publier une entrée officielle.';}
  form.addEventListener('input',saveDraft);form.addEventListener('change',saveDraft);
  preview.addEventListener('click',event=>{if(!form.reportValidity()||!title.value.trim()||!description.value.trim()){event.preventDefault();status.textContent='Renseignez un titre et une description.';}});
  form.addEventListener('submit',event=>{
    event.preventDefault();if(!form.reportValidity()||!title.value.trim()||!description.value.trim()){status.textContent='Renseignez un titre et une description.';return;}
    updatePreview();if(publish.disabled)return;
    const opened=window.open(model.issueUrl(draft,config),'_blank','noopener,noreferrer');
    status.textContent='Formulaire GitHub prêt : confirmez la création sur GitHub, puis rafraîchissez le journal. Le brouillon reste local en attendant.';
    // With noopener, some browsers return null even when the form opens. The link remains available.
    if(!opened)status.textContent+=' Vous pouvez aussi utiliser « Prévisualiser le formulaire GitHub ».';
  });
  clear.addEventListener('click',()=>{model.clearDraft(storage);draft=model.emptyDraft();type.value=draft.type;domain.value=draft.domain;priority.value=draft.priority;for(const element of [title,description,context,validation])element.value='';updatePreview();draftState.textContent='Brouillon local effacé. Aucune entrée GitHub n’a été modifiée.';});
  function renderEntries(){
    pendingEntries.replaceChildren();historyEntries.replaceChildren();const filtered=model.sortIssues(model.filterIssues(entries,{type:filterType.value,priority:filterPriority.value}));
    for(const issue of filtered){const parent=issue.state==='open'?pendingEntries:historyEntries,entry=node('article',null,parent,'journal-entry'),heading=node('h4',null,entry);entry.dataset.issueNumber=issue.number;link(issue.title,issue.url,heading);
      const badges=node('div',null,entry,'toolbar');for(const text of [issue.type,issue.domain,issue.priority,issue.state.toUpperCase(),'#'+issue.number])node('span',text,badges,'badge');node('time','Créée le '+time(issue.createdAt),entry);node('p',issue.summary||'Aucune description.',entry);link('Ouvrir l’Issue GitHub',issue.url,entry);
    }
    if(!pendingEntries.children.length)node('p',loaded?'Aucune entrée ouverte correspondant aux filtres.':'Les entrées ouvertes seront lues depuis GitHub.',pendingEntries,'muted');
    if(!historyEntries.children.length)node('p',loaded?'Aucune entrée fermée correspondant aux filtres.':'Les entrées fermées seront lues depuis GitHub.',historyEntries,'muted');
  }
  async function refreshIssues(){
    if(loading)return;loading=true;refresh.disabled=true;status.textContent='Lecture des Issues publiques GitHub…';const request=++requestNumber;
    try{const result=await model.fetchIssues(window.fetch.bind(window),config);if(request!==requestNumber)return;entries=result.issues;loaded=true;renderEntries();status.textContent=(result.partial?'Lecture partielle : limite de '+result.pages+' pages GitHub atteinte. Des entrées peuvent manquer ; ouvrir GitHub pour consulter la liste complète. ':'')+'Dernière lecture : '+time(result.readAt)+' · '+entries.length+' entrées Journal · '+result.pages+' page(s) lue(s).';status.className=result.partial?'workspace-notice':'muted';}
    catch(error){if(request!==requestNumber)return;status.textContent='Journal indisponible actuellement · ouvrir GitHub'+(loaded?' · Les dernières entrées lues restent affichées.':'');status.className='workspace-notice error';}
    finally{if(request===requestNumber){loading=false;refresh.disabled=false;}}
  }
  refresh.addEventListener('click',refreshIssues);filterType.addEventListener('change',renderEntries);filterPriority.addEventListener('change',renderEntries);
  document.getElementById('tab-journal')?.addEventListener('click',()=>{if(!loaded&&!loading)refreshIssues();});
  window.addEventListener('tcgate-workspace-state-loaded',event=>{
    const next=model.configuration(event.detail?.journal),changed=next.repository!==config.repository;config=next;github.href=model.issuesUrl(config);role.textContent=config.role;principle.textContent=config.principle;updatePreview();
    if(changed){requestNumber++;loading=false;refresh.disabled=false;loaded=false;entries=[];renderEntries();if(document.getElementById('tab-journal')?.getAttribute('aria-selected')==='true')refreshIssues();}
  });
  updatePreview();renderEntries();
})();
