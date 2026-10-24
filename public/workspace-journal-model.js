(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;if(root)root.TCGWorkspaceJournal=api;})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  const DEFAULTS=Object.freeze({backend:'github-issues',repository:'maximelaburthe-commits/TCGate',titlePrefix:'[JOURNAL]',role:'Inbox opérationnel pour intégration, tests, vérifications, bugs, idées et décisions',principle:"Le journal alimente les futurs jalons mais ne remplace pas l'état canonique du workspace."});
  const TYPES=Object.freeze(['À intégrer','À tester','À vérifier','Bug','Idée','Décision']);
  const DOMAINS=Object.freeze(['Général','Vision','BDD','UI / UX','Réseau / WebRTC','Phone','Workspace','Autre']);
  const PRIORITIES=Object.freeze(['Majeur','Intermédiaire','Mineur']);
  const DRAFT_KEY='tcgate.workspace.journal.draft.v1',MARKER='<!-- tcgate-workspace-journal:v1 -->',MAX_FORM_URL=8192;
  function configuration(value){
    const source=value&&typeof value==='object'?value:{};
    // Configuration can select a public repository, never a different host or API.
    const repository=typeof source.repository==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(source.repository)?source.repository:DEFAULTS.repository;
    return {...DEFAULTS,repository,role:typeof source.role==='string'?source.role:DEFAULTS.role,principle:typeof source.principle==='string'?source.principle:DEFAULTS.principle};
  }
  function emptyDraft(){return {type:TYPES[0],domain:DOMAINS[0],priority:PRIORITIES[1],title:'',description:'',context:'',validation:''};}
  function normalizeDraft(value){
    const input=value&&typeof value==='object'?value:{},draft=emptyDraft();
    for(const [key,options] of [['type',TYPES],['domain',DOMAINS],['priority',PRIORITIES]])if(options.includes(input[key]))draft[key]=input[key];
    for(const key of ['title','description','context','validation'])if(typeof input[key]==='string')draft[key]=input[key];
    return draft;
  }
  function issueTitle(value){const title=String(value??'').trim().replace(/^\[JOURNAL\]\s*/,'');return DEFAULTS.titlePrefix+(title?' '+title:'');}
  function generateBody(value){
    const draft=normalizeDraft(value),lines=[MARKER,'','Type: '+draft.type,'Domaine: '+draft.domain,'Priorité: '+draft.priority,'Créé depuis: TCGate Workspace','','## Description','',draft.description];
    if(draft.context.trim())lines.push('','## Contexte','',draft.context);
    if(draft.validation.trim())lines.push('','## Critère de validation','',draft.validation);
    return lines.join('\n');
  }
  function repositoryUrl(config){return 'https://github.com/'+configuration(config).repository;}
  function issuesUrl(config){const url=new URL(repositoryUrl(config)+'/issues');url.searchParams.set('q','is:issue "[JOURNAL]" in:title');return url.href;}
  function issueUrl(value,config){const url=new URL(repositoryUrl(config)+'/issues/new');url.searchParams.set('title',issueTitle(normalizeDraft(value).title));url.searchParams.set('body',generateBody(value));return url.href;}
  function metadata(body,name,options){const expression=new RegExp('^'+name+':\\s*([^\\r\\n]*)$','m'),match=String(body??'').match(expression);const value=match?.[1]?.trim();return options.includes(value)?value:'Non renseigné';}
  function description(body){const text=String(body??''),match=text.match(/^## Description\s*\r?\n([\s\S]*?)(?=^## |$(?![\s\S]))/m);return (match?match[1]:text.replace(/<!--[\s\S]*?-->/g,'')).trim();}
  function parseIssue(issue,config){
    if(!issue||typeof issue!=='object'||issue.pull_request||typeof issue.title!=='string'||!issue.title.startsWith(DEFAULTS.titlePrefix)||!['open','closed'].includes(issue.state)||!Number.isInteger(issue.number)||issue.number<1)return null;
    const body=typeof issue.body==='string'?issue.body:'',date=typeof issue.created_at==='string'&&Number.isFinite(Date.parse(issue.created_at))?issue.created_at:null;
    const text=description(body),summary=text.length>240?text.slice(0,239)+'…':text;
    return {number:issue.number,title:issue.title,type:metadata(body,'Type',TYPES),domain:metadata(body,'Domaine',DOMAINS),priority:metadata(body,'Priorité',PRIORITIES),createdAt:date,closedAt:issue.closed_at||null,state:issue.state,summary,description:text,url:repositoryUrl(config)+'/issues/'+issue.number};
  }
  function filterIssues(issues,filters={}){return issues.filter(issue=>(!filters.type||filters.type==='all'||issue.type===filters.type)&&(!filters.priority||filters.priority==='all'||issue.priority===filters.priority));}
  function sortIssues(issues){return [...issues].sort((a,b)=>{
    if(a.state!==b.state)return a.state==='open'?-1:1;
    if(a.state==='open'){const ar=PRIORITIES.indexOf(a.priority),br=PRIORITIES.indexOf(b.priority),priority=(ar<0?3:ar)-(br<0?3:br);if(priority)return priority;return (Date.parse(a.createdAt)||0)-(Date.parse(b.createdAt)||0)||a.number-b.number;}
    return (Date.parse(b.closedAt||b.createdAt)||0)-(Date.parse(a.closedAt||a.createdAt)||0)||b.number-a.number;
  });}
  function readDraft(storage){try{return normalizeDraft(JSON.parse(storage?.getItem(DRAFT_KEY)||'null'));}catch{return emptyDraft();}}
  function writeDraft(storage,value){try{if(!storage)return false;storage.setItem(DRAFT_KEY,JSON.stringify(normalizeDraft(value)));return true;}catch{return false;}}
  function clearDraft(storage){try{storage?.removeItem(DRAFT_KEY);return true;}catch{return false;}}
  async function fetchIssues(fetcher,config,options={}){
    const repository=configuration(config).repository,maxPages=Number.isInteger(options.maxPages)&&options.maxPages>0?options.maxPages:20,issues=[];
    let pages=0,partial=false;
    for(let page=1;page<=maxPages;page++){
      const url=new URL('https://api.github.com/repos/'+repository+'/issues');for(const [key,value] of Object.entries({state:'all',per_page:'100',sort:'created',direction:'asc',page:String(page)}))url.searchParams.set(key,value);
      const response=await fetcher(url.href,{method:'GET',credentials:'omit',cache:'no-store',headers:{Accept:'application/vnd.github+json'},signal:options.signal||(typeof AbortSignal!=='undefined'&&AbortSignal.timeout?AbortSignal.timeout(15000):undefined)});
      if(!response.ok)throw Error('GitHub HTTP '+response.status);
      const data=await response.json();if(!Array.isArray(data))throw Error('Réponse GitHub invalide');pages++;
      for(const issue of data){const parsed=parseIssue(issue,config);if(parsed)issues.push(parsed);}
      const links=response.headers?.get?.('link')||'',more=/(?:^|,)\s*<[^>]+>\s*;\s*rel="next"/.test(links);
      if(!more)break;if(page===maxPages)partial=true;
    }
    return {issues:sortIssues(issues),pages,partial,readAt:new Date().toISOString()};
  }
  return Object.freeze({DEFAULTS,TYPES,DOMAINS,PRIORITIES,DRAFT_KEY,MARKER,MAX_FORM_URL,configuration,emptyDraft,normalizeDraft,issueTitle,generateBody,repositoryUrl,issuesUrl,issueUrl,parseIssue,filterIssues,sortIssues,readDraft,writeDraft,clearDraft,fetchIssues});
});
