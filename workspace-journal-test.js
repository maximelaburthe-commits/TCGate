'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const model=require('./public/workspace-journal-model.js');
const config=model.configuration();let assertions=0;
function equal(actual,expected,message){assert.deepEqual(actual,expected,message);assertions++;}
function check(value,message){assert(value,message);assertions++;}
const draft={type:'À tester',domain:'Vision',priority:'Intermédiaire',title:'Sleeves & reflets #1?',description:'Tester les cartes sous sleeves.\nSans régression.',context:'Reflets <script>observés</script> à 45°.',validation:'Les cartes sans sleeve fonctionnent.'};
equal(config.repository,'maximelaburthe-commits/TCGate');
equal(model.configuration({repository:'https://evil.invalid/path'}).repository,config.repository);
equal(model.configuration({repository:'owner/repo/../../../evil'}).repository,config.repository);
equal(model.configuration({repository:'owner/example',titlePrefix:'[OTHER]'}).titlePrefix,'[JOURNAL]');
equal(model.issueTitle(' sleeves '),'[JOURNAL] sleeves');equal(model.issueTitle('[JOURNAL] sleeves'),'[JOURNAL] sleeves');
equal(model.generateBody(draft),'<!-- tcgate-workspace-journal:v1 -->\n\nType: À tester\nDomaine: Vision\nPriorité: Intermédiaire\nCréé depuis: TCGate Workspace\n\n## Description\n\nTester les cartes sous sleeves.\nSans régression.\n\n## Contexte\n\nReflets <script>observés</script> à 45°.\n\n## Critère de validation\n\nLes cartes sans sleeve fonctionnent.');
check(!model.generateBody(model.emptyDraft()).includes('## Contexte'));check(!model.generateBody(model.emptyDraft()).includes('## Critère de validation'));
const url=new URL(model.issueUrl(draft));equal(url.origin,'https://github.com');equal(url.pathname,'/maximelaburthe-commits/TCGate/issues/new');equal(url.searchParams.get('title'),'[JOURNAL] '+draft.title);equal(url.searchParams.get('body'),model.generateBody(draft));
const raw={number:9,title:'[JOURNAL] '+draft.title,body:model.generateBody(draft),state:'open',created_at:'2026-10-24T08:00:00Z',html_url:'javascript:alert(1)'};
const parsed=model.parseIssue(raw);equal(parsed.type,'À tester');equal(parsed.domain,'Vision');equal(parsed.priority,'Intermédiaire');equal(parsed.state,'open');equal(parsed.summary,draft.description);equal(parsed.url,'https://github.com/maximelaburthe-commits/TCGate/issues/9');
equal(model.parseIssue({...raw,state:'closed'}).state,'closed');equal(model.parseIssue({...raw,pull_request:{url:'https://github.com/a'}}),null);equal(model.parseIssue({...raw,title:'Before [JOURNAL] note'}),null);equal(model.parseIssue({...raw,title:'[journal] note'}),null);equal(model.parseIssue({...raw,state:'draft'}),null);
equal(model.parseIssue({...raw,body:'Une note sans métadonnées'}).type,'Non renseigné');equal(model.parseIssue({...raw,body:'Une note sans métadonnées'}).summary,'Une note sans métadonnées');
equal(model.parseIssue({...raw,body:model.generateBody({...draft,description:'x'.repeat(500)})}).summary.length,240);
const entries=[
  {...parsed,number:1,priority:'Mineur',createdAt:'2026-01-01T10:00:00Z'},
  {...parsed,number:2,priority:'Majeur',createdAt:'2026-01-03T10:00:00Z'},
  {...parsed,number:3,priority:'Intermédiaire',createdAt:'2026-01-01T10:00:00Z'},
  {...parsed,number:4,priority:'Majeur',createdAt:'2026-01-01T10:00:00Z'},
  {...parsed,number:5,priority:'Majeur',state:'closed',createdAt:'2026-01-01T10:00:00Z'}
];
const original=JSON.stringify(entries);equal(model.sortIssues(entries).map(item=>item.number),[4,2,3,1,5]);equal(JSON.stringify(entries),original);
equal(model.filterIssues(entries,{type:'À tester',priority:'Majeur'}).map(item=>item.number),[2,4,5]);equal(model.filterIssues(entries,{type:'Bug'}),[]);equal(model.filterIssues(entries,{type:'all',priority:'all'}).length,5);
const memory=new Map(),storage={getItem:key=>memory.get(key)||null,setItem:(key,value)=>memory.set(key,value),removeItem:key=>memory.delete(key)};
equal(model.readDraft(storage),model.emptyDraft());equal(model.writeDraft(storage,draft),true);equal(model.readDraft(storage),draft);equal(model.clearDraft(storage),true);equal(model.readDraft(storage),model.emptyDraft());
storage.setItem(model.DRAFT_KEY,'not json');equal(model.readDraft(storage),model.emptyDraft());equal(model.writeDraft({setItem(){throw Error('denied');}},draft),false);equal(model.writeDraft(null,draft),false);equal(model.readDraft({getItem(){throw Error('denied');}}),model.emptyDraft());
const source=fs.readFileSync('public/workspace-journal.js','utf8'),modelSource=fs.readFileSync('public/workspace-journal-model.js','utf8');
check(!/innerHTML|insertAdjacentHTML|eval\(/.test(source),'Issue text must use safe text nodes');check(!/Authorization|Bearer|ghp_|github_pat_|method:\s*['"](?:POST|PUT|PATCH|DELETE)/i.test(source+modelSource),'No GitHub credential or API write');check(source.includes("publish.type='submit'")&&source.includes('form.reportValidity()'),'Publication validates a native form');check(source.includes('window.open(model.issueUrl(draft,config)'),'Publication opens a human-confirmed GitHub form');check(source.includes('Brouillon local')&&source.includes('Effacer le brouillon'));check(source.includes('Journal indisponible actuellement · ouvrir GitHub'));check(source.includes("event.detail?.journal"));
async function uiTests(){
  const elements=new Map();
  class Element{
    constructor(tag){this.tagName=tag;this.children=[];this.listeners={};this.attributes={};this.dataset={};this.value='';this.textContent='';this.hidden=false;this.disabled=false;}
    set id(value){this._id=value;elements.set(value,this);}get id(){return this._id;}
    append(child){this.children.push(child);child.parent=this;}
    replaceChildren(){this.children=[];}
    setAttribute(key,value){this.attributes[key]=value;}getAttribute(key){return this.attributes[key];}
    addEventListener(name,handler){(this.listeners[name]??=[]).push(handler);}
    emit(name,detail={}){const event={preventDefault(){this.defaultPrevented=true;},...detail};for(const handler of this.listeners[name]||[])handler(event);return event;}
    reportValidity(){const all=node=>[node,...node.children.flatMap(all)];return all(this).every(element=>!element.required||element.value!=='');}
  }
  const mount=new Element('main');mount.id='journalMount';const tab=new Element('button');tab.id='tab-journal';
  const values=new Map(),localStorage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
  const windowEvents={},calls=[],opened=[];let offline=false;
  const window={localStorage,addEventListener:(name,handler)=>{windowEvents[name]=handler;},open:(url,target,features)=>{opened.push({url,target,features});return {};},fetch:async(url,options)=>{calls.push({url,options});if(offline)throw Error('offline');return {ok:true,json:async()=>[raw,{...raw,number:10,state:'closed'}, {...raw,number:11,pull_request:{}},{...raw,title:'Other issue',number:12}],headers:{get:()=>null}};}};
  const context=vm.createContext({window,document:{getElementById:id=>elements.get(id),createElement:tag=>new Element(tag)},URL,AbortSignal,Date});
  vm.runInContext(modelSource,context);vm.runInContext(source,context);
  const get=id=>elements.get(id),settle=()=>new Promise(resolve=>setImmediate(resolve));
  equal(calls.length,0,'Journal API read is lazy');check(get('journalTitle').required&&get('journalDescription').required);check(get('journalDraftStatus').textContent.includes('brouillon'));
  get('journalTitle').value=draft.title;get('journalDescription').value=draft.description;get('journalContext').value=draft.context;get('journalValidation').value=draft.validation;get('journalType').value=draft.type;get('journalDomain').value=draft.domain;get('journalPriority').value=draft.priority;get('journalForm').emit('input');
  equal(model.readDraft(localStorage),draft);equal(new URL(get('journalPrefilledLink').href).searchParams.get('body'),model.generateBody(draft));
  const submitted=get('journalForm').emit('submit');equal(submitted.defaultPrevented,true);equal(opened.length,1);equal(new URL(opened[0].url).searchParams.get('title'),'[JOURNAL] '+draft.title);equal(opened[0].features,'noopener,noreferrer');equal(calls.length,0,'Opening the prefilled form never creates or reads an Issue automatically');
  tab.emit('click');await settle();equal(calls.length,1);equal(get('journalOpen').children[0].dataset.issueNumber,9);equal(get('journalClosed').children[0].dataset.issueNumber,10);check(get('journalStatus').textContent.includes('2 entrées Journal'));
  get('journalFilterType').value='Bug';get('journalFilterType').emit('change');check(get('journalOpen').children[0].textContent.includes('Aucune entrée ouverte'));get('journalFilterType').value='all';get('journalFilterType').emit('change');equal(get('journalOpen').children[0].dataset.issueNumber,9);
  get('journalDescription').value='Très long brouillon '.repeat(2000);get('journalForm').emit('input');equal(get('journalPublish').disabled,true);check(get('journalCopyBody').value.includes(get('journalDescription').value));equal(get('journalPrefilledLink').hidden,true);get('journalForm').emit('submit');equal(opened.length,1,'An oversized form cannot silently lose text through a URL');
  get('journalClearDraft').emit('click');equal(get('journalTitle').value,'');equal(values.has(model.DRAFT_KEY),false);equal(get('journalPublish').disabled,false);equal(get('journalForm').reportValidity(),false);
  offline=true;get('journalRefresh').emit('click');await settle();check(get('journalStatus').textContent.startsWith('Journal indisponible actuellement · ouvrir GitHub'));equal(get('journalOpen').children[0].dataset.issueNumber,9,'Read failure preserves the previous successful read');equal(get('journalRefresh').disabled,false);
  windowEvents['tcgate-workspace-state-loaded']({detail:{journal:{repository:'owner/another-repo'}}});equal(get('journalGitHub').href,model.issuesUrl({repository:'owner/another-repo'}));equal(get('journalOpen').children[0].dataset.issueNumber,undefined,'Changing repository clears entries from the previous source');
}
(async()=>{
  const calls=[];
  const response=(data,link='')=>({ok:true,status:200,json:async()=>data,headers:{get:name=>name==='link'?link:''}});
  const result=await model.fetchIssues(async(url,options)=>{calls.push({url,options});return calls.length===1?response([raw,{...raw,number:3,pull_request:{}}],'<https://api.github.com/repos/maximelaburthe-commits/TCGate/issues?page=2>; rel="next"'):response([{...raw,number:12,state:'closed'},{...raw,number:10,title:'Not a Journal issue'}]);});
  equal(result.issues.map(item=>item.number),[9,12]);equal(result.pages,2);equal(result.partial,false);check(Number.isFinite(Date.parse(result.readAt)));
  for(const call of calls){const requested=new URL(call.url);equal(requested.origin,'https://api.github.com');equal(requested.searchParams.get('state'),'all');equal(requested.searchParams.get('per_page'),'100');equal(call.options.method,'GET');equal(call.options.credentials,'omit');equal(Object.keys(call.options.headers),['Accept']);check(call.options.signal instanceof AbortSignal);}
  const partial=await model.fetchIssues(async()=>response([raw],'<https://api.github.com/next>; rel="next"'),config,{maxPages:1});equal(partial.partial,true);equal(partial.pages,1);
  await assert.rejects(()=>model.fetchIssues(async()=>({ok:false,status:403})),/GitHub HTTP 403/);assertions++;
  await assert.rejects(()=>model.fetchIssues(async()=>response({message:'Bad data'})),/Réponse GitHub invalide/);assertions++;
  await assert.rejects(()=>model.fetchIssues(async()=>{throw Error('offline');}),/offline/);assertions++;
  const huge={...draft,description:'Préserver intégralement ce brouillon. '.repeat(1000)},hugeUrl=model.issueUrl(huge);check(hugeUrl.length>model.MAX_FORM_URL);equal(new URL(hugeUrl).searchParams.get('body'),model.generateBody(huge),'Long drafts are never silently truncated');
  await uiTests();
  console.log('WORKSPACE_JOURNAL_OK · '+assertions+' assertions · structured Issues, safe form URLs, pagination, filters/order, local draft and read-only GitHub');
})().catch(error=>{console.error(error);process.exitCode=1;});
