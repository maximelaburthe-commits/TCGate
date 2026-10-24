'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),{spawn}=require('node:child_process');
const provider=require('./public/workspace-lab-provider.js'),source=require('./public/database-source.js'),registry=require('./public/game-databases.js'),dbs=require('./public/workspace-databases.js'),{fixture}=require('./workspace-lab-fixture.js');
const rootUrl='https://raw.githubusercontent.com/example/test-db/'+'a'.repeat(40)+'/';
async function run(){
 const before=JSON.stringify(registry.databases),data=fixture(),requests=[];
 const fetchImpl=async(url,options)=>{assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');assert(!options.method||options.method==='GET');requests.push(url);const item=data[url.slice(rootUrl.length)];return {ok:item!==undefined,status:item===undefined?404:200,text:async()=>JSON.stringify(item)};};
 const prepared=await provider.prepare(rootUrl+'manifest.json',{source,fetchImpl});
 assert.equal(prepared.diagnostic.version,'0.1-test');assert.equal(prepared.diagnostic.gameId,'test-game');assert.equal(prepared.diagnostic.schemaVersion,'2.1.0');assert.equal(prepared.diagnostic.cards,1);assert.equal(prepared.diagnostic.printings,2);assert.equal(prepared.diagnostic.visionReferences,2);assert.equal(prepared.diagnostic.recognitionGroups,1);assert.deepEqual(prepared.diagnostic.locales,['en','fr']);assert.equal(prepared.diagnostic.localeCoverage.fr.visionAssets,1);assert.equal(prepared.diagnostic.qualified,false);
 const corpus=await prepared.loadCardList();assert.equal(corpus.cards.length,2);assert(corpus.cards.some(c=>c.referencePrintingId==='printing-fr'));assert.equal(corpus.sourceImmutable,true);assert.equal(JSON.stringify(registry.databases),before);
 assert.equal(provider.normalizeUrl('https://github.com/example/test-db/blob/main/manifest.json'),'https://raw.githubusercontent.com/example/test-db/main/manifest.json');
 for(const bad of ['http://raw.githubusercontent.com/example/db/main/manifest.json','https://evil.example/manifest.json',rootUrl+'manifest.json?token=secret','https://user:pass@raw.githubusercontent.com/example/db/main/manifest.json'])assert.throws(()=>provider.normalizeUrl(bad));
 await assert.rejects(provider.prepare(rootUrl+'manifest.json',{source,fetchImpl:async()=>({ok:true,text:async()=>'not JSON'})}));
 const broken=fixture();broken['printings.json'][0].cardId='orphan';await assert.rejects(provider.prepare(rootUrl+'manifest.json',{source,fetchImpl:async url=>({ok:true,text:async()=>JSON.stringify(broken[url.slice(rootUrl.length)])})}),/orpheline/);
 const traversal=fixture();traversal['manifest.json'].runtime_cards='../secret.json';await assert.rejects(provider.prepare(rootUrl+'manifest.json',{source,fetchImpl:async url=>({ok:true,text:async()=>JSON.stringify(traversal[url.slice(rootUrl.length)])})}),/non autoris/);
 const ident={identification:{best:{matcherScore:.7},margin:.2,rejectionReason:null,candidates:[{rank:1,name:'Test Card',matcherScore:.7,visualIndex:70}]}};
 const record=provider.feedback('wrong_identification','Wrong Card','note',prepared.diagnostic,{},ident,'data:image/png;base64,test',{confidence:.55});assert.equal(record.recognizedAs,'Wrong Card');assert.equal(record.top5[0].name,'Test Card');assert.equal(record.score,.7);assert.equal(record.crop,'data:image/png;base64,test');assert.throws(()=>provider.feedback('wrong_identification','','',{}, {},ident,null,{}));
 assert.equal(dbs.length,2);assert.equal(dbs[0].candidate.status,'development');assert.deepEqual(dbs[0].candidate.locales,['en','fr']);assert.equal(dbs[1].candidateUrl,null);assert(dbs.every(db=>db.repositoryUrl.startsWith('https://github.com/')&&db.actionsUrl.endsWith('/actions')));assert.equal(dbs[0].updateWorkflowUrl,'https://github.com/maximelaburthe-commits/tcgate_db_cyberpunk/actions/workflows/build-database.yml');assert.equal(dbs[1].updateWorkflowUrl,null);
 const html=fs.readFileSync('public/workspace.html','utf8'),client=fs.readFileSync('public/workspace.js','utf8')+fs.readFileSync('public/workspace-cockpit.js','utf8'),hook=fs.readFileSync('public/identification.js','utf8');
 for(const label of ['Reprise','Général','Vision','BDD','UI / UX','Fonctions annexes','Vision Lab'])assert(html.includes(label));
 assert(client.includes('workspace-state/tcgate_workspace_state.json'));assert(client.includes('TCGIdentificationLab.start()'));assert(client.includes('TCGIdentificationLab.getSnapshot()'));assert(client.includes('getAnalyzedCropDataUrl()'));assert(html.includes('Top 5 candidats'));assert(html.includes('https://tcg-webcam-test-production.up.railway.app/'));
 assert(!/<iframe|app.js|phone-camera|table-state-engine/.test(html));assert(!/RTCPeerConnection|new Worker|audio\s*:\s*true/.test(client));assert(!client.includes('/api/rooms'));assert(!/Authorization|github_pat_|ghp_|method\s*:\s*['"](?:POST|PUT|PATCH|DELETE)/.test(client));
 assert(hook.includes('if (labProvider) return labProvider.loadCardList();'));assert(hook.includes('if (!force && !labProvider)'));assert(hook.includes('if (!labProvider) saveCache'));assert(!fs.readFileSync('public/game-databases.js','utf8').includes('1.2.0'));
 const server=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'4387',HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});let logs='';server.stdout.on('data',d=>logs+=d);server.stderr.on('data',d=>logs+=d);
 try{
  let ready=false;for(let i=0;i<60;i++){try{const r=await fetch('http://127.0.0.1:4387/api/health');if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert(ready,logs);
  const page=await fetch('http://127.0.0.1:4387/workspace.html');assert.equal(page.status,200);assert((await page.text()).includes('Vision Lab'));
  for(const file of ['workspace.js','workspace.css','workspace-databases.js','workspace-lab-provider.js'])assert.equal((await fetch('http://127.0.0.1:4387/'+file)).status,200);
  const model=await fetch('http://127.0.0.1:4387/api/model/card-detector-v53-512-alpha9p1.onnx',{headers:{Range:'bytes=0-63'}});assert([200,206].includes(model.status));await model.body.cancel();
 }finally{server.kill();}
 console.log('WORKSPACE_DATABASE_HUB_AND_LAB_OK · provider, languages, isolation, feedback, server/model routes');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
