'use strict';
// Decision-path regression tests: execute the real worker and complete browser
// matcher through VM. Only image feature extraction is replaced by observed or
// controlled scalar scores. These tests are never physical qualification.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=process.env.TCGATE_6C_TEST_ROOT||__dirname;
const production=process.env.TCGATE_6C_PRODUCTION_ROOT||root;
const corpus=JSON.parse(fs.readFileSync(path.join(root,'fixtures/vision-canonical-corpus-229.json'),'utf8'));
const replays=JSON.parse(fs.readFileSync(path.join(root,'fixtures/vision-canonical-real-replays.json'),'utf8'));
let assertions=0,scenarios=0;
const equal=(a,b,why)=>{assertions++;assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)),why);};
const check=(value,why)=>{assertions++;assert.ok(value,why);};
const close=(a,b,why)=>{assertions++;assert.ok(Math.abs(a-b)<1e-12,why+' '+a+' != '+b);};
const clone=value=>JSON.parse(JSON.stringify(value));
const byCard=id=>corpus.references.filter(ref=>ref.cardId===id);
function element(){return {dataset:{},style:{},classList:{add(){},remove(){},contains(){return false;}},addEventListener(){},textContent:'',innerHTML:'',checked:true};}
function makeMatcher(thread){
  let now=100;
  const context={console,performance:{now:()=>++now},setTimeout:()=>0,clearTimeout(){},requestAnimationFrame(){},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},Image:class{}};
  context.globalThis=context;
  const featureHooks=`
    function setScenario(library){
      ${thread==='worker'?'refs=library;':'state.refs=library;state.cards=library;state.ready=true;'}
      ${thread==='worker'?'descriptorFromBitmap':'descriptorFromCanvas'}=()=>({});
      coarseRankReferences=(observations,library)=>library.map(ref=>({ref,coarseScore:ref.descriptor.coarseScore})).sort((a,b)=>b.coarseScore-a.coarseScore);
      bestComparison=(observations,descriptor)=>({total:descriptor.score,full:descriptor.score,art:descriptor.score,gradient:descriptor.score,patches:descriptor.score,color:descriptor.score});
      maskedCoarseRank=(observations,library)=>library.map(ref=>({ref,coarseScore:ref.descriptor.maskScore})).sort((a,b)=>b.coarseScore-a.coarseScore);
      bestMaskedComparison=(observations,descriptor)=>({score:descriptor.maskScore,gray:descriptor.maskScore,gradient:descriptor.maskScore,color:descriptor.maskScore});
    }
    globalThis.matcherTest={setScenario,identify:${thread==='worker'?'identify':'identifyCanvas'},canonicalRankCandidates${thread==='worker'?'':',state,identityKey,temporalIdentityGuard,matcherWorkerPayload,rehydrateWorkerResult'}};
  `;
  let source=fs.readFileSync(path.join(root,'public',thread==='worker'?'identification-worker.js':'identification.js'),'utf8');
  if(thread==='worker'){
    context.self={postMessage(){}};source+='\n'+featureHooks;
  }else{
    const els=new Map();
    context.document={getElementById:id=>{if(!els.has(id))els.set(id,element());return els.get(id);},addEventListener(){}};
    context.window={TCGDetectionLab:{els:{videoStage:element(),video:element(),overlay:element()},activeTracks:()=>[]},addEventListener(){},dispatchEvent(){}};
    const end=source.lastIndexOf('})();');check(end>=0,'browser matcher closure exists');
    source=source.slice(0,end)+featureHooks+source.slice(end);
  }
  vm.createContext(context);vm.runInContext(source,context,{filename:thread+'-actual-matcher.js'});
  return context.matcherTest;
}
const worker=makeMatcher('worker'),fallback=makeMatcher('fallback');
const matchers=[['worker',worker],['fallback',fallback]];
function libraryFor(items,{locale='en',coarseOrder=null,normalDefault=-.5,maskDefault=0}={}){
  const scores=new Map(items.map(item=>[item.refId,{score:item.score,maskScore:item.maskScore??0}]));
  const order=coarseOrder?new Map(coarseOrder.map((id,i)=>[id,coarseOrder.length-i])):null;
  return corpus.references.map(ref=>({...clone(ref),locale,descriptor:{score:scores.get(ref.refId)?.score??normalDefault,maskScore:scores.get(ref.refId)?.maskScore??maskDefault,coarseScore:order?(order.get(ref.refId)??-1):(scores.get(ref.refId)?.score??normalDefault)}}));
}
function run(items,options={},context={}){
  scenarios++;
  const results=matchers.map(([thread,matcher])=>{matcher.setScenario(libraryFor(items,options));return matcher.identify({},context);});
  const projection=r=>({accepted:r.accepted,best:r.best?.ref.refId,second:r.second?.ref.refId,margin:r.margin,marginScope:r.marginScope,mode:r.mode,ranked:r.ranked.map(x=>x.ref.refId),physical:r.physicalCandidates.map(x=>x.ref.refId),normal:r.normalCandidates.map(x=>x.ref.refId),mask:r.maskDiagnostics&&{margin:r.maskDiagnostics.margin,candidates:r.maskDiagnostics.candidates.map(x=>x.ref.refId)}});
  equal(projection(results[0]),projection(results[1]),'worker/fallback actual decision parity');
  return results;
}
// This fixture is projected from the real immutable DB through database-source.validate.
equal(corpus.databaseSha,'56402636a77af9c8b5dc4e3b61c509a185f3c834');
equal(corpus.references.length,229);equal(new Set(corpus.references.map(r=>r.cardId)).size,150);
equal(new Set(corpus.references.map(r=>r.refId)).size,229);
const harness=require(path.join(production,'public/vision-qualification-harness.js'));
check(harness.validateContext({productSha:'7082e92a66b50d0e0654ef44a6bdba89b0715e2b',databaseSha:corpus.databaseSha,gameId:'cyberpunk',locale:'en',referenceCount:229,references:corpus.references}).valid,'real 229 corpus passes existing context validator');
const knownRefs=new Map(corpus.references.map(ref=>[ref.refId,ref]));
const six=['cp-mantis-blades','cp-arasaka-emergency-radioport','cp-jackie-welles-mama-s-favorite','cp-alt-cunningham-soulkiller-architect','cp-industrial-assembly','cp-adam-smasher-ender-of-legends'];
for(const cardId of six){
  const replay=replays.cases.find(value=>value.expectedCardId===cardId&&value.purpose==='SAME_CANONICAL_PHYSICAL_SIBLING_MARGIN');
  check(replay,'explicit named real scalar replay '+cardId);
  const items=replay.candidates.map(candidate=>{
    equal(knownRefs.get(candidate.refId)?.cardId,candidate.cardId,'real scalar candidate belongs to official corpus');
    return {refId:candidate.refId,score:candidate.matcherScore};
  });
  const other=replay.candidates.find(c=>c.cardId!==cardId);
  check(other,'recorded different canonical competitor exists');
  const bytes=JSON.stringify(replay);
  for(const result of run(items)){
    equal(result.best.ref.cardId,cardId);equal(result.second.ref.cardId,other.cardId);
    close(result.margin,items[0].score-other.matcherScore,'margin uses highest OTHER canonical');
    equal(result.marginScope,'CANONICAL_CARD_ID');equal(result.accepted,true,'selected real sibling replay clears unchanged thresholds');
    equal(result.best.ref.printingId,null,'shared art never invents exact printing');
    equal(result.best.ref.recognitionMode,'shared');check(result.best.ref.candidatePrintingIds.length>1);
    check(result.physicalCandidates[0].ref.cardId===result.physicalCandidates[1].ref.cardId,'physical sibling evidence retained');
    equal(new Set(result.ranked.map(x=>x.ref.cardId)).size,result.ranked.length,'displayed EN ranking is canonical');
  }
  equal(JSON.stringify(replay),bytes,'real evidence remains immutable');
}
const mantis=byCard(six[0]),padre=byCard('cp-padre-man-of-the-cross'),alt=byCard(six[3]);
check(mantis.length===3&&padre.length===2,'actual rank1/2/3 sibling fixture exists');
// Mandatory rank1/2/3 same card, rank4 competitor. No top-two shortcut.
const mandatory=[...mantis.map((r,i)=>({refId:r.refId,score:.91-i*.01})),{refId:padre[0].refId,score:.51}];
for(const r of run(mandatory)){
  close(r.margin,.91-.51,'rank1 minus physical rank4');equal(r.second.ref.refId,padre[0].refId);equal(r.accepted,true);
}
// Group maximum, not sum/mean/count, on deliberately unsorted inputs.
for(const [,m] of matchers){
  const items=[{ref:mantis[0],score:.2},{ref:padre[0],score:.3},{ref:mantis[1],score:.6}];
  const copy=JSON.stringify(items),ranked=m.canonicalRankCandidates(items);
  equal(ranked[0].ref.refId,mantis[1].refId);close(ranked[0].score,.6,'maximum score per card');equal(ranked.length,2);equal(JSON.stringify(items),copy,'grouping does not mutate physical evidence');
}
// Same physical scores in FR retain the original sibling margin and rejection.
for(const r of run(mandatory,{locale:'fr'})){
  equal(r.marginScope,'PHYSICAL_REFERENCE');close(r.margin,.01,'FR physical rank2 retained');equal(r.accepted,false);equal(r.second.ref.cardId,six[0]);
}
for(const [,m] of matchers){
  const items=mandatory.map(item=>({ref:{...knownRefs.get(item.refId),cardId:null},score:item.score}));
  equal(m.canonicalRankCandidates(items).length,items.length,'missing cardId keeps legacy independent references');
}
// A genuine different-card ambiguity remains rejected, including recorded Alt.
const ambiguous=replays.cases.find(c=>c.purpose==='DISTINCT_CANONICAL_AMBIGUITY_MUST_REMAIN_REJECTED');
check(ambiguous,'real ambiguous competitor case exists');
for(const r of run(ambiguous.candidates.map(c=>({refId:c.refId,score:c.matcherScore})))){
  equal(r.accepted,false,'real different-canonical ambiguity stays rejected');equal(r.best.ref.cardId,ambiguous.expectedCardId);check(r.margin<.075);
}
// Wrong card competition must not boost an expected card with several siblings.
for(const r of run([{refId:mantis[0].refId,score:.70},{refId:mantis[1].refId,score:.69},{refId:mantis[2].refId,score:.68},{refId:padre[0].refId,score:.75}])){
  equal(r.best.ref.cardId,padre[0].cardId);equal(r.accepted,false,'close wrong competing card remains uncertain');close(r.margin,.05,'competing cards retain narrow margin');
}
// No universal expected-card veto exists: keep a strongly wrong visual winner
// wrong in the regression report rather than inventing a correction.
for(const r of run([{refId:mantis[0].refId,score:.30},{refId:mantis[1].refId,score:.29},{refId:padre[0].refId,score:.60}])){
  equal(r.best.ref.cardId,padre[0].cardId);equal(r.accepted,true,'strong actual winner remains winner, never relabelled expected');
}
const negatives=[
 {label:'absolute below low threshold',best:.184,other:0,accepted:false},
 {label:'normal margin insufficient',best:.50,other:.43,accepted:false},
 {label:'low score margin insufficient',best:.20,other:.07,accepted:false},
 {label:'normal threshold and margin allowed',best:.24,other:.16,accepted:true},
 {label:'low path remains allowed',best:.19,other:.05,accepted:true}
];
for(const n of negatives) for(const r of run([{refId:mantis[0].refId,score:n.best},{refId:mantis[1].refId,score:n.best-.001},{refId:padre[0].refId,score:n.other}])) equal(r.accepted,n.accepted,n.label);
// A competitor beyond physical top5 must still define runner-up.
const sibling=corpus.references.filter(r=>r.cardId!==mantis[0].cardId).slice(0,4);
for(const [,m] of matchers){
  const refs=mantis.map((ref,i)=>({ref,score:.9-i*.01}));
  // Use actual refs plus duplicate physical observations to put other beyond5.
  refs.splice(1,0,{ref:mantis[1],score:.899},{ref:mantis[2],score:.898},{ref:mantis[0],score:.897});
  refs.push({ref:sibling[0],score:.5});
  const ranked=m.canonicalRankCandidates(refs);equal(ranked[1].ref.cardId,sibling[0].cardId);close(ranked[0].score-ranked[1].score,.4,'group before top5');
}
// Expanded shortlist really executes; different canonical winner at rank25.
const filler=corpus.references.filter(r=>![...mantis,...padre].some(x=>x.refId===r.refId)).slice(0,21);
const order=[mantis[0].refId,mantis[1].refId,padre[0].refId,...filler.map(r=>r.refId),padre[1].refId];
for(const r of run([{refId:mantis[0].refId,score:.19},{refId:mantis[1].refId,score:.189},{refId:padre[0].refId,score:.1},{refId:padre[1].refId,score:.4}],{coarseOrder:order})){
  equal(r.timing.normalCandidatesTested,44,'rare expanded pool actually executed');equal(r.best.ref.cardId,padre[1].cardId);equal(r.accepted,true);close(r.margin,.21,'expanded pool uses canonical maximum');
}
// Masked matching uses exactly the same canonical competition, with existing
// masked thresholds .655/.038 and no feature/pool change.
const maskContext={maskInfo:{maskedBy:1,visibleFraction:.60,maxOverlap:.4,mask:[]},overlapping:true};
const masked=mandatory.map((item,i)=>({...item,score:.1-i*.001,maskScore:i<3?.82-i*.01:.60}));
for(const r of run(masked,{},maskContext)){
  equal(r.mode,'masked');equal(r.accepted,true);close(r.margin,.22,'masked margin uses other card');equal(r.second.ref.cardId,padre[0].cardId);equal(r.maskDiagnostics.physicalCandidates[0].ref.cardId,r.maskDiagnostics.physicalCandidates[1].ref.cardId,'masked physical siblings retained');check(r.maskDiagnostics.candidates[0].ref.cardId!==r.maskDiagnostics.candidates[1].ref.cardId,'masked canonical competitors distinct');
}
for(const r of run([{refId:mantis[0].refId,score:.1,maskScore:.67},{refId:mantis[1].refId,score:.099,maskScore:.669},{refId:padre[0].refId,score:.09,maskScore:.66}],{},maskContext)) equal(r.accepted,false,'masked close other-card competitor rejected');
for(const r of run(masked,{locale:'fr'},maskContext)){
  equal(r.accepted,false,'masked FR physical sibling still rejected');equal(r.marginScope,'PHYSICAL_REFERENCE');close(r.maskDiagnostics.margin,.01,'FR mask threshold semantics unchanged');
}
for(const r of run([{refId:mantis[0].refId,score:.1,maskScore:.654},{refId:mantis[1].refId,score:.099,maskScore:.653},{refId:padre[0].refId,score:.09,maskScore:.40}],{},maskContext)) equal(r.accepted,false,'masked score below existing .655 threshold stays rejected');
const exact=corpus.references.find(r=>r.recognitionMode==='exact');
for(const r of run([{refId:exact.refId,score:.8},{refId:mantis[0].refId,score:.4}])) equal(r.best.ref.printingId,exact.printingId,'genuine exact singleton printing survives transport');
const context229={productSha:'7082e92a66b50d0e0654ef44a6bdba89b0715e2b',databaseSha:corpus.databaseSha,gameId:'cyberpunk',locale:'en',referenceCount:229,references:corpus.references};
const observations=[];
for(let at=0;at<=harness.DEFAULT_STABLE_WINDOW_MS;at+=100) observations.push({atMs:at,detected:true,identifiedCardId:mantis[0].cardId,identifiedPrintingId:null,referenceIds:[mantis[0].refId],candidatePrintingIds:mantis[0].candidatePrintingIds,locale:'en'});
const classified=harness.classifyTrial({trialId:'automated-canonical-shared-art',timestamp:'2026-11-04T00:00:00Z',provenance:'automated',condition:'NOMINAL',expectedCardId:mantis[0].cardId,expectedPrintingId:mantis[0].referencePrintingId,t0Ms:0,endMs:harness.DEFAULT_STABLE_WINDOW_MS+100,observations},context229);
equal(classified.printingAssessment,'UNRESOLVED_SHARED_ART','existing classification never promotes canonical identity to exact printing');equal(classified.category,'CORRECT');equal(classified.provenance,'automated','synthetic regression remains separate from physical evidence');
// Metadata transport keeps canonical vs physical printing identities separate.
fallback.setScenario(libraryFor(mandatory));
const payload=fallback.matcherWorkerPayload();equal(payload.length,229);
for(const key of ['locale','cardId','printingId','referencePrintingId','recognitionMode','candidatePrintingIds','variantKind']) equal(payload.find(x=>x.refId===mantis[0].refId)[key],mantis[0][key],'payload transports '+key);
const hydrate={best:{ref:{image:mantis[0].image}},second:null,ranked:[],normalCandidates:[],physicalCandidates:[{ref:{image:mantis[1].image}}],normalPhysicalCandidates:[{ref:{image:mantis[2].image}}],maskDiagnostics:{candidates:[{ref:{image:padre[0].image}}],physicalCandidates:[{ref:{image:padre[1].image}}]}};
fallback.rehydrateWorkerResult(hydrate);equal(hydrate.physicalCandidates[0].ref.cardId,mantis[0].cardId);equal(hydrate.maskDiagnostics.physicalCandidates[0].ref.cardId,padre[0].cardId);
// Alternating shared printings of one EN card refreshes canonical identity.
const result=ref=>({accepted:true,best:{ref},margin:.4,mode:'normal'});
const track={uid:10};
equal(fallback.temporalIdentityGuard(track,result(mantis[0])).action,'render');
equal(fallback.temporalIdentityGuard(track,result(mantis[1])).action,'render');
equal(fallback.state.identityStability.switchesSuppressed,0);equal(fallback.state.identityStability.stableRefreshes,1);equal(fallback.state.identityStability.tracks.get(10).stableKey,'card:'+mantis[0].cardId);
equal(fallback.temporalIdentityGuard(track,result(padre[0])).action,'hold','different canonical still requires repeated confirmations');
equal(fallback.temporalIdentityGuard(track,result(padre[1])).action,'render','second observation confirms canonical replacement');equal(fallback.state.identityStability.switchesConfirmed,1);
const fr0={...mantis[0],locale:'fr'},fr1={...mantis[1],locale:'fr'};
equal(fallback.temporalIdentityGuard({uid:11},result(fr0)).action,'render');equal(fallback.temporalIdentityGuard({uid:11},result(fr1)).action,'hold','FR keeps physical identity switch guard');
equal(fallback.identityKey({accepted:false,best:{ref:mantis[0]}}),null);
equal(fallback.identityKey(result({...mantis[0],cardId:null})),mantis[0].image,'legacy image identity unchanged');
{
 const diagnostic=require(path.join(root,'public/vision-qualification-diagnostics.js'));
 const a=mantis[0],b=mantis[1],other=padre[0];
 const entry=(ref,score)=>({refId:ref.refId,cardId:ref.cardId,printingId:ref.printingId,matcherScore:score});
 const raw={atMs:200,requestStartedAtMs:100,expectedCardId:a.cardId,candidates:[entry(a,.9),entry(other,.7)],
   physicalCandidates:[entry(a,.9),entry(b,.88),entry(other,.7)],bestScore:.9,secondScore:.7,margin:.2,
   marginScope:'CANONICAL_CARD_ID',matcherAccepted:true,finalAccepted:true,mode:'normal'};
 const result=diagnostic.sanitizeAttempt(raw,{expectedCardId:a.cardId,references:corpus.references,t0Ms:0,endMs:300});
 equal(result.marginScope,'CANONICAL_CARD_ID');close(result.canonicalMargin,.2,'canonical diagnostic margin');
 close(result.physicalMargin,.02,'sibling physical diagnostic margin');equal(result.physicalCandidates.length,3);
 equal(result.candidates.length,2);equal(result.expectedRank,1);equal(result.expectedScore,.9);
 const old=diagnostic.sanitizeAttempt({...raw,marginScope:undefined,physicalCandidates:undefined},{references:corpus.references});
 equal(old.marginScope,null,'legacy diagnostic scope never retroactively canonical');equal(old.canonicalMargin,null);equal(old.physicalCandidates,[]);
}
{
 const physical=JSON.parse(fs.readFileSync(path.join(root,'fixtures/vision-qualification-6c-replays.json'),'utf8'));
 equal(physical.attempts.length,123,'all completed scalar attempts are replayed');
 let changed=0,remainingMarginRejects=0,wrongAccepted=0;
 for(const attempt of physical.attempts){
   for(const item of attempt.ranked) equal(knownRefs.get(item.refId)?.cardId,item.cardId,'observed reference matches authentic corpus');
   const grouped=worker.canonicalRankCandidates(attempt.ranked.map(item=>({ref:knownRefs.get(item.refId),score:item.score})));
   check(grouped.length>1,'recorded best OTHER card is available, not fabricated');
   const expectedMargin=grouped[0].score-grouped[1].score;
   const results=run(attempt.ranked.map(item=>({refId:item.refId,score:item.score})));
   for(const result of results){
     close(result.margin,expectedMargin,'full matcher reproduces canonical scalar margin');
     equal(result.best.ref.cardId,attempt.ranked[0].cardId,'grouping never relabels a wrong leading card');
     if(result.accepted){equal(result.best.ref.cardId,attempt.expectedCardId,'no wrong canonical acceptance in the 123 recorded attempts');wrongAccepted+=Number(result.best.ref.cardId!==attempt.expectedCardId);}
   }
   if(!attempt.matcherAccepted&&results[0].accepted)changed++;
   if(attempt.rejectionCauses.includes('MARGIN_INSUFFICIENT')&&!results[0].accepted)remainingMarginRejects++;
 }
 equal(wrongAccepted,0);equal(remainingMarginRejects,11,'the eleven true canonical-margin ambiguities remain rejected');
 equal(changed,56,'56 sibling-margin rejections change in scalar replay, not physical qualification');
 console.log('REAL_SCALAR_REPLAY_6C 123 attempts; 56 corrected sibling margins; 11 remaining margin rejects; 0 wrong accepted canonical cards');
}
console.log('VISION_CANONICAL_6C_PASS '+assertions+' assertions; '+scenarios+' scalar scenarios through real worker + fallback; authentic EN 150/229 metadata; no physical qualification');
