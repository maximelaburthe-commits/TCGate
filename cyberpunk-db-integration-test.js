'use strict';

const assert=require('assert');
const crypto=require('crypto');
const fs=require('fs');
const path=require('path');
const gameDatabases=require('./public/game-databases.js');
const databaseSource=require('./public/database-source.js');

const DB_SHA='56402636a77af9c8b5dc4e3b61c509a185f3c834';
const MANIFEST_URL=`https://raw.githubusercontent.com/maximelaburthe-commits/tcgate_db_cyberpunk/${DB_SHA}/manifest.json`;
const DB_ROOT=process.env.TCGATE_DB_FIXTURE_ROOT||path.resolve(__dirname,'..','tcgate_db_cyberpunk');

function syntheticFixture(){
  const cards=Array.from({length:150},(_,index)=>({cardId:`card-${index}`,name:`Card ${index}`,type:'Unit',primaryPrintingId:`printing-${index}`}));
  const counts=Array.from({length:150},(_,index)=>index<83?1:index<95?3:2);
  const printings=[];
  counts.forEach((count,cardIndex)=>{for(let offset=0;offset<count;offset+=1){const index=printings.length;printings.push({printingId:`printing-${index}`,cardId:`card-${cardIndex}`,variantKind:offset?'iconic':'standard',displayAssetPath:`assets/display/printing-${index}.webp`,visionAssetPath:`assets/vision/printing-${index}.webp`});}});
  const recognitionGroups=cards.map((card,index)=>{const ids=printings.filter(printing=>printing.cardId===card.cardId).map(printing=>printing.printingId);return{recognitionGroupId:`group-${index}`,cardId:card.cardId,printingIds:ids,candidatePrintingIds:ids,mode:ids.length===1?'exact':'shared'};});
  const richGroups=recognitionGroups.map(group=>({...group,references:group.printingIds.map(printingId=>({printingId,visionAssetPath:`assets/vision/${printingId}.webp`,referenceImageUrl:`assets/vision/${printingId}.webp`}))}));
  return{
    'manifest.json':{game_id:'cyberpunk-tcg',database_version:'1.1.0',status:'candidate-qualified',runtime_scope:'cyberpunk-beta-2026',runtime_ready:true,database_manifest:'db-manifest.json',entrypoint:'runtime/cards.min.json',runtime_printings:'runtime/printings.min.json',vision_index:'runtime/vision-index.json',canonical_vision_index:'runtime/canonical-vision-index.json',printing_recognition_index:'runtime/printing-recognition-index.json',recognition_groups:'runtime/recognition-groups.json',asset_manifest:'runtime/asset-manifest.json'},
    'db-manifest.json':{databaseVersion:'1.1.0',status:'candidate-qualified',runtimeScope:'cyberpunk-beta-2026',runtimeReady:true},
    'runtime/cards.min.json':cards,
    'runtime/printings.min.json':printings,
    'runtime/canonical-vision-index.json':{references:cards.map(card=>({cardId:card.cardId,visionAssetPath:`assets/vision/${card.primaryPrintingId}.webp`}))},
    'runtime/printing-recognition-index.json':{cards:cards.map(card=>({cardId:card.cardId,recognitionGroups:richGroups.filter(group=>group.cardId===card.cardId)}))},
    'runtime/recognition-groups.json':{recognitionGroups},
    'runtime/vision-index.json':printings.map(printing=>({refId:`ref-${printing.printingId}`,printingId:printing.printingId,cardId:printing.cardId,visionAssetPath:printing.visionAssetPath,displayAssetPath:printing.displayAssetPath,recognition:{eligible:true}}))
  };
}

function fixture(){
  if(!fs.existsSync(path.join(DB_ROOT,'manifest.json')))return{data:syntheticFixture(),real:false};
  const manifest=JSON.parse(fs.readFileSync(path.join(DB_ROOT,'manifest.json'),'utf8')),read=relative=>JSON.parse(fs.readFileSync(path.join(DB_ROOT,relative),'utf8'));
  const data={'manifest.json':manifest,'db-manifest.json':read(manifest.database_manifest)};
  for(const key of ['entrypoint','runtime_printings','vision_index','canonical_vision_index','printing_recognition_index','recognition_groups','asset_manifest'])data[manifest[key]]=read(manifest[key]);
  return{data,real:true};
}

function fixtureFetch(data,counters,{fail=false}={}){
  return async url=>{
    counters.requests+=1;counters.urls.push(String(url));
    if(fail)return new Response('offline',{status:503});
    const marker=`/tcgate_db_cyberpunk/${DB_SHA}/`,relative=String(url).split(marker)[1],value=data[relative];
    return new Response(value===undefined?'not found':JSON.stringify(value),{status:value===undefined?404:200,headers:{'content-type':'application/json'}});
  };
}

async function run(){
  const config=gameDatabases.get('cyberpunk');
  assert.strictEqual(config.manifestUrl,MANIFEST_URL,'single public manifest URL');
  const live=await fetch(MANIFEST_URL,{cache:'no-cache'});assert.strictEqual(live.status,200,'public manifest HTTP 200');
  const liveManifest=await live.json();assert.strictEqual(liveManifest.database_version,'1.1.0');assert.strictEqual(liveManifest.status,'candidate-qualified');assert.strictEqual(liveManifest.runtime_scope,'cyberpunk-beta-2026');assert.strictEqual(liveManifest.runtime_ready,true);
  const liveUrl=relative=>new URL(relative,MANIFEST_URL).href;
  const [liveCards,livePrintings,liveVision,liveGroups]=await Promise.all([liveManifest.entrypoint,liveManifest.runtime_printings,liveManifest.vision_index,liveManifest.recognition_groups].map(async relative=>{const response=await fetch(liveUrl(relative),{cache:'no-cache'});assert.strictEqual(response.status,200,`${relative} HTTP 200`);return response.json();}));
  assert.strictEqual(liveCards.length,150,'public runtime exposes 150 canonical cards');
  assert.strictEqual(livePrintings.length,229,'immutable runtime exposes 229 printings');
  assert.strictEqual(liveVision.length,229,'immutable runtime exposes 229 Vision entries');
  assert.strictEqual(liveGroups.recognitionGroups.length,150,'immutable runtime exposes 150 recognition groups');
  assert.strictEqual(liveGroups.recognitionGroups.filter(group=>group.mode==='exact').length,83,'83 singleton exact groups');
  assert.strictEqual(liveGroups.recognitionGroups.filter(group=>group.mode==='shared').length,67,'67 multi-printing shared groups');
  const liveCardIds=new Set(liveCards.map(card=>card.cardId));assert(livePrintings.every(printing=>liveCardIds.has(printing.cardId)),'public runtime has no orphan printing');

  const source=fixture(),counters={requests:0,urls:[]};databaseSource.clear();
  const database=await databaseSource.load('cyberpunk',{fetchImpl:fixtureFetch(source.data,counters)});
  assert.strictEqual(database.manifest.databaseVersion,'1.1.0');
  assert.strictEqual(database.manifest.databaseStatus,'candidate-qualified');
  assert.strictEqual(database.manifest.runtimeScope,'cyberpunk-beta-2026');
  assert.strictEqual(database.manifest.runtimeReady,true);
  assert.strictEqual(database.cards.length,150,'150 canonical cards');
  assert.strictEqual(database.printings.length,229,'229 runtime printings');
  assert.strictEqual(database.references.length,229,'all 229 printing references reach matcher');
  assert.strictEqual(database.recognitionGroups.length,150,'150 recognition groups loaded');
  assert.strictEqual(database.references.filter(reference=>reference.recognitionMode==='exact').length,83,'83 exact matcher references');
  assert.strictEqual(database.references.filter(reference=>reference.recognitionMode==='shared').length,146,'146 matcher references remain shared');
  assert.strictEqual(new Set(database.cards.map(card=>card.cardId)).size,150,'unique cardIds');
  assert.strictEqual(new Set(database.printings.map(printing=>printing.printingId)).size,229,'229 unique printingIds');
  assert(database.printings.every(printing=>database.cardsById.has(printing.cardId)),'no orphan printing');
  assert(database.references.every(reference=>database.cardsById.has(reference.cardId)),'no orphan recognition group');
  assert.strictEqual(new Set(database.references.map(reference=>reference.referencePrintingId)).size,229,'229 unique Vision printing references');
  assert.deepStrictEqual(new Set(database.references.map(reference=>new URL(reference.referenceImageUrl).pathname)),new Set(database.printings.map(printing=>new URL(printing.visionAssetPath,MANIFEST_URL).pathname)),'every runtime visionAssetPath reaches matcher corpus');
  assert(database.references.every(reference=>reference.referenceImageUrl.startsWith('https://raw.githubusercontent.com/')),'Vision assets load directly from public DB');
  assert(database.references.every(reference=>reference.displayImageUrl.startsWith('https://raw.githubusercontent.com/')),'display assets load directly from public DB');
  const shared=database.references.find(reference=>reference.recognitionMode==='shared');assert(shared&&shared.printingId===null&&shared.candidatePrintingIds.length>1,'shared group never selects an arbitrary printing');
  assert(database.references.filter(reference=>reference.recognitionMode==='shared').every(reference=>reference.printingId===null&&!reference.candidatePrintingIds.includes(reference.printingId)),'shared references never expose a candidate as recognized printing');
  assert(database.references.every(reference=>reference.displayImageUrl.includes(`/assets/display/${reference.referencePrintingId}.webp`)),'winning reference keeps its own display artwork');
  const exact=database.references.find(reference=>reference.recognitionMode==='exact');if(exact)assert(exact.printingId&&exact.candidatePrintingIds.length===1,'exact group preserves printingId');
  assert.strictEqual(counters.requests,7,'manifest plus six declared runtime resources');
  assert(counters.urls.every(url=>url.startsWith(`https://raw.githubusercontent.com/maximelaburthe-commits/tcgate_db_cyberpunk/${DB_SHA}/`)),'all DB resources use immutable commit origin');
  await databaseSource.load('cyberpunk',{fetchImpl:fixtureFetch(source.data,counters)});assert.strictEqual(counters.requests,7,'corpus initialized once per session');
  assert.throws(()=>databaseSource.resolveUrl(MANIFEST_URL,'../private.json'),/non autorisé/,'path traversal rejected');
  assert.strictEqual(gameDatabases.get('no-game'),null,'no-game has no Cyberpunk source');

  const identification=fs.readFileSync(path.join(__dirname,'public/identification.js'),'utf8');
  const hotPath=identification.slice(identification.indexOf('function identifyCanvas'),identification.indexOf('function visualIndex'));
  assert(!/\bfetch\s*\(/.test(hotPath),'no network fetch in identification hot path');
  assert(identification.includes("const NORMAL_ACCEPT = 0.235;")&&identification.includes("const NORMAL_MARGIN = 0.075;")&&identification.includes("const LOW_ACCEPT = 0.185;")&&identification.includes("const LOW_MARGIN = 0.135;"),'Vision thresholds unchanged');
  assert(identification.includes("const retained=Boolean(state.visibleIdentity?.accepted&&ui.image?.dataset.cardUrl);"),'partial rejection retains valid HD image');
  assert(identification.includes("if(!loaded){ui.image.dataset.swapPending='0';return;}"),'failed replacement does not clear valid HD image');
  assert(identification.includes('const result=rehydrateWorkerResult(msg.result||null);'),'worker result is rehydrated with card/printing/artwork metadata');
  assert(identification.includes('const refsByImage=new Map(state.refs.map(ref=>[ref.image,ref]));'),'worker metadata lookup uses the initialized corpus without network');
  assert(identification.includes("fallbackCoverage:'legacy-cyberpunk-0.7-147-references'"),'legacy fallback is explicitly reported as degraded coverage');
  assert(identification.includes('recognitionMode:reference.recognitionMode||null'),'recognition mode reaches matcher metadata');

  const allSource=['server.js','public/app.js','public/database-source.js','public/game-databases.js','public/identification.js','DEPLOY_RAILWAY.md'].map(file=>fs.readFileSync(path.join(__dirname,file),'utf8')).join('\n');
  assert(!allSource.includes('TCGATE_DB_GITHUB_TOKEN'),'private GitHub token removed');
  assert(!allSource.includes('/api/db/cyberpunk'),'private DB gateway routes removed');
  assert(!allSource.includes('cyberpunk_cards'),'legacy mutable Cyberpunk source removed from active integration');

  const fallbackData=syntheticFixture(),fallbackCounters={requests:0,urls:[]};databaseSource.clear();
  await assert.rejects(databaseSource.load('cyberpunk',{fetchImpl:fixtureFetch(fallbackData,fallbackCounters,{fail:true})}),/DB HTTP 503/,'remote failure reaches lightweight fallback path');

  const criticalHashes={'public/detection-worker.js':'19d0e72eeb620f23742a9b8fe321f700c45cbd29ad41b952d115bca5fd983227','public/identification-worker.js':'306eafe4decdCCE26287683bc581cd8ca24a0c2f58cd299873b093942127a14a'.toLowerCase(),'models/card_detector_v53_512.onnx':'2db35aef3aceff955d7055180b3f21b33255920ab0a9a1fdcbb0e320a8276319'};
  for(const[file,expected]of Object.entries(criticalHashes)){const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,file))).digest('hex');assert.strictEqual(actual,expected,`critical component changed: ${file}`);}
  console.log(`PASS cyberpunk-db-integration (${source.real?'real DB v1 fixture':'synthetic CI fixture'})`);
  console.log(`150 canonical / 229 printings / ${database.references.length} matcher references / ${database.recognitionGroups.length} recognition groups / requests=${counters.requests} / bytes=${database.metrics.bytes}`);
}

run().catch(error=>{console.error(error);process.exitCode=1;});
