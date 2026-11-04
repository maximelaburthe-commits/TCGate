'use strict';
// Automated integration against the real runtime, harness and controller. Native
// decisions below are explicitly injected scalar fixtures, not physical evidence.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=process.env.TCGATE_6C_TEST_ROOT||__dirname;
const corpusPath=process.env.TCGATE_6C_CORPUS_PATH||path.join(root,'fixtures/vision-canonical-corpus-229.json');
const corpus=JSON.parse(fs.readFileSync(corpusPath,'utf8'));
const harness=require(path.join(root,'public/vision-qualification-harness.js'));
const controller=require(path.join(root,'public/vision-qualification-track.js'));
const diagnostics=require(path.join(root,'public/vision-qualification-diagnostics.js'));
const copy=v=>JSON.parse(JSON.stringify(v)),flush=()=>new Promise(resolve=>setImmediate(resolve));
let assertions=0,archiveTrials=0,pinnedRaw=null,pinnedContext=null;
const equal=(a,b,why)=>{assertions++;assert.deepEqual(a,b,why);},check=(a,why)=>{assertions++;assert.ok(a,why);},throws=(f,r)=>{assertions++;assert.throws(f,r);};
const refs=corpus.references;
const exact=refs.find(r=>r.printingId&&r.cardId==='cp-saburo-arasaka-stubborn-patriarch')||refs.find(r=>r.printingId);
const other=refs.find(r=>r.printingId&&r.cardId!==exact.cardId);
const shared=refs.find(r=>r.cardId==='cp-mantis-blades'&&r.printingId===null)||refs.find(r=>r.printingId===null&&r.candidatePrintingIds.length>1);
const native=(ref=exact,extra={})=>({accepted:true,cardId:ref.cardId,refId:ref.refId,printingId:ref.printingId,candidatePrintingIds:ref.candidatePrintingIds,recognitionMode:ref.recognitionMode,score:.9,decision:'ACCEPTED',...extra});
async function world(pinned=true){
  let clock=0,clears=0,beginCalls=0,calls=0,handle=null,next=()=>native();
  const listeners=new Map(),intervals=new Set();
  const state={gameId:'cyberpunk',playerLocale:'en',libraryReady:true,matcherWorker:{ready:true,busy:false,queued:false},visionReferenceCount:229,librarySize:229,visionLocales:['en'],libraryIntegrity:{degraded:false},visionIndexKey:'authentic-EN-index',identification:null,visibleIdentity:null,hoveredTrack:null,pointerInsideStage:false};
  const local={detecting:true,stream:{getVideoTracks:()=>[{readyState:'live'}]},tracks:[],lostTracks:[],identityMemoryMs:8000,analysisSeq:0};
  const detector={active:true,modelReady:true,activeCards:0,rawDetections:0,tracking:{activeTracks:[]}},table={entries:[],workerBusy:false};
  const window={TCGateVisionQualification:harness,TCGVisionQualificationDiagnostics:diagnostics,TCGIdentificationLab:{getSnapshot:()=>copy(state),clearVisibleForHandoff:()=>{state.visibleIdentity=null;clears++;},beginQualificationTracking:()=>{beginCalls++;handle=controller.create({getTracks:()=>local.tracks,now:()=>clock,identify:track=>{calls++;return next(track);},onTarget:()=>{},setInterval:cb=>{intervals.add(cb);return cb;},clearInterval:cb=>intervals.delete(cb)});return handle;}},TCGVisionEngine:{getSnapshot:()=>copy(detector)},TCGDetectionLab:{state:local},TCGTableStateEngine:{getSnapshot:()=>copy(table)},TCGTableStateBridge:{getRefs:()=>refs.map(r=>({...r,image:r.refId}))},TCGateDatabaseSource:{getVisionReferences:async()=>copy(refs)},TCGateGameDatabases:{get:()=>({manifestUrl:'https://raw.githubusercontent.com/maximelaburthe-commits/tcgate_db_cyberpunk/'+harness.DATABASE_SHA+'/manifest.json'})},performance:{now:()=>clock,timeOrigin:123},crypto:crypto.webcrypto,addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name),setInterval:cb=>{intervals.add(cb);return cb;},clearInterval:cb=>intervals.delete(cb),queueMicrotask:fn=>fn()};
  const sandbox={window,console,TextEncoder};vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.join(root,'public/vision-qualification-runtime.js'),'utf8'),sandbox);
  const q=await window.TCGVisionQualificationRuntime.attach({productSha:'a'.repeat(40),environment:{execution:'AUTOMATED'},...(pinned?{trackSelection:'PINNED_CANONICAL_TRACK'}:{})});
  async function tick(n=1){for(let k=0;k<n;k++){clock+=250;local.analysisSeq++;for(const cb of [...intervals])cb();await flush();clock+=1;if(q.getProgress().active)q.sample();}}
  function tracks(values,activeCount=values.length){local.tracks=values.map(t=>({misses:0,...t}));detector.tracking.activeTracks=copy(local.tracks);detector.activeCards=activeCount;detector.rawDetections=activeCount;}
  function visible(ref,uid){state.visibleIdentity={accepted:true,refId:ref.refId,cardId:ref.cardId,trackUid:uid};state.hoveredTrack={uid};state.identification={accepted:true,best:{...ref,matcherScore:.9},candidates:[{...ref}]};}
  function empty(){tracks([]);state.hoveredTrack=null;state.identification=null;}
  function start(ref=exact,more={}){return q.startTrial({mode:'automated',expectedCardId:ref.cardId,expectedPrintingId:ref.printingId||ref.referencePrintingId,...more});}
  function finish(){q.endTrial();return q.exportReport().trials.at(-1);}
  async function dispose(){if(q.getProgress().active)q.endTrial();q.detach();equal(intervals.size,0,'Runtime/controller intervals cleaned');equal(listeners.size,0);}
  return {q,state,local,detector,table,listeners,tick,tracks,visible,empty,start,finish,dispose,setNext:v=>{next=typeof v==='function'?v:()=>v;},get handle(){return handle;},get beginCalls(){return beginCalls;},get calls(){return calls;},get clears(){return clears;},get clock(){return clock;}};
}
function extractFunction(source,name,nextName){const start=source.indexOf('  '+(name==='identifyTrack'?'async ':'')+'function '+name+'(');const end=source.indexOf('\n  '+(nextName==='identifyTrack'?'async ':'')+'function '+nextName+'(',start+1);if(start<0||end<0)throw Error('Cannot extract actual '+name);return source.slice(start,end);}
async function actualAdapter(){
  const source=fs.readFileSync(path.join(root,'public/identification.js'),'utf8');
  const chunks=[extractFunction(source,'qualificationDecision','beginQualificationTracking'),extractFunction(source,'beginQualificationTracking','identifyTrack'),extractFunction(source,'identifyTrack','onPointerMove'),extractFunction(source,'onPointerMove','currentTrackUnderStoredPointer')];
  const leaveStart=source.indexOf("lab.els.videoStage.addEventListener('pointerleave',()=>{");const leaveEnd=source.indexOf('\n  });',leaveStart);check(leaveStart>=0&&leaveEnd>leaveStart);
  const leave=source.slice(leaveStart,leaveEnd+'\n  });'.length);
  let tracks=[],clock=1000,blobs=0,renders=0,normalMoves=0;
  const intervals=new Set(),handlers={},pointerArguments=[];
  const state={ready:true,matcherWorkerReady:true,contextInput:{gameId:'cyberpunk',playerLocale:'en'},refs:copy(refs),hoverGeneration:0,hoveredTrack:null,hoverTimer:null,temporalRecheckTimer:null,lastAnalyzedCropDataUrl:'private-crop',lastAnalyzedTrackUid:1,pointer:{x:20,y:40},pointerInsideStage:true,cropCaptureSamples:[],cropBitmapSamples:[],identityStability:{tracks:new Map()},cropCapture:[],lastTrackUid:null};
  const ui={toggle:{checked:true},matcherStatus:null};
  const window={location:{pathname:'/workspace.html'},TCGVisionQualificationTracking:controller,setInterval:cb=>{intervals.add(cb);return cb;},clearInterval:cb=>intervals.delete(cb),TCGVisionQualificationDiagnostics:{observeAttempt:()=>{}}};
  const lab={activeTracks:()=>tracks,captureCanonicalTrackCanvas:()=>({toBlob:()=>{blobs++;}}),els:{videoStage:{addEventListener:(n,fn)=>{handlers[n]=fn;}},overlay:{width:100,height:100}}};
  const sandbox={window,state,ui,lab,performance:{now:()=>clock},console,setTimeout:()=>1,clearTimeout:()=>{},createImageBitmap:async()=>({close:()=>{}}),recordTiming:()=>{},applyQualityGuard:result=>result,analyzeCropQuality:()=>({risk:'normal'}),overlapContext:()=>({}),pointerInCanonical:(t,p)=>{pointerArguments.push(p);return null;},buildOcclusionMask:(t,p)=>{pointerArguments.push(p);return null;},queueWorkerTask:async()=>({accepted:true,best:{ref:exact,score:.9},ranked:[{ref:exact,score:.9}],mode:'normal'}),identifyCanvas:()=>{throw Error('unexpected fallback');},temporalIdentityGuard:(t,result)=>({action:'render',result}),renderResult:()=>{renders++;},putHoverCache:()=>{},purgeHoverCache:()=>{},purgeIdentityStability:()=>{},scheduleTemporalRecheck:()=>{},clearCurrentIdentification:()=>{},stagePoint:()=>{normalMoves++;return null;},NORMAL_ACCEPT:.235,NORMAL_MARGIN:.075,LOW_ACCEPT:.185,LOW_MARGIN:.135};
  vm.createContext(sandbox);vm.runInContext('let qualificationTracking=null;\n'+chunks.join('\n')+'\n'+leave+'\nglobalThis.extracted={beginQualificationTracking,onPointerMove,identifyTrack,getTracking:()=>qualificationTracking};',sandbox);
  const api=sandbox.extracted;
  for(const mutation of [()=>{window.location.pathname='/';},()=>{state.contextInput.playerLocale='fr';},()=>{state.contextInput.gameId='other';},()=>{state.ready=false;},()=>{state.matcherWorkerReady=false;},()=>{ui.toggle.checked=false;},()=>{state.refs=[];}]){mutation();throws(()=>api.beginQualificationTracking(),/Workspace Cyberpunk EN Lab/);window.location.pathname='/workspace.html';state.contextInput={gameId:'cyberpunk',playerLocale:'en'};state.ready=true;state.matcherWorkerReady=true;ui.toggle.checked=true;state.refs=copy(refs);}
  // Direct guarded API with a live track tests startup as well as later polls.
  tracks=[{uid:77,misses:0,cx:20,cy:30,w:40,h:60}];const handle=api.beginQualificationTracking();await flush();equal(handle.getState().lockedTrackUid,77);equal(handle.getState().identity?.cardId,exact.cardId);equal(blobs,0,'Qualification never invokes media serialization, including startup');
  const generation=state.hoverGeneration;api.onPointerMove({clientX:99,clientY:99});handlers.pointerleave();equal(state.hoverGeneration,generation,'Real pointer activity cannot cancel qualification');equal(state.hoveredTrack.uid,77);equal(handle.getState().identity.cardId,exact.cardId);equal(normalMoves,0);check(pointerArguments.every(p=>p===null),'Qualification matcher has no pointer mask');
  tracks=[{uid:77,misses:0,cx:70,cy:80,w:40,h:60}];clock+=250;handle.sample();await flush();equal(state.hoveredTrack.cx,70);equal(handle.getState().lockedTrackUid,77);equal(blobs,0);check(renders>=2);handle.stop();equal(intervals.size,0);
  // The same extracted real pointer and crop paths preserve ordinary behavior.
  const before=state.hoverGeneration;api.onPointerMove({clientX:10,clientY:10});equal(normalMoves,1);check(state.hoverGeneration>before);state.hoveredTrack={...tracks[0]};state.pointer={x:1,y:2};await api.identifyTrack(tracks[0],state.hoverGeneration);equal(blobs,1,'Ordinary path retains its existing optional diagnostic encoder');check(pointerArguments.slice(-2).every(p=>p===state.pointer),'Ordinary identification still receives the real pointer mask input');
}
async function main(){
  equal(refs.length,229);equal(new Set(refs.map(r=>r.cardId)).size,150);check(harness.validateContext({productSha:'a'.repeat(40),databaseSha:harness.DATABASE_SHA,gameId:'cyberpunk',locale:'en',referenceCount:229,references:refs}).valid);
  let w=await world();throws(()=>w.start(),/confirmed neutral/);await w.tick(4);equal(w.q.getNeutralState().ready,true);const first=w.start();equal(first.observations[0].identifiedCardId,null);equal(first.identityMeasurement,'PINNED_CANONICAL_TRACK');equal(w.beginCalls,1);w.tracks([{uid:1}]);w.visible(exact,1);await w.tick(2);w.state.visibleIdentity=null;w.state.identification=null;w.state.hoveredTrack=null;w.state.pointerInsideStage=false;await w.tick(6);const stable=w.finish();equal(stable.category,'CORRECT');equal(stable.wrongCardEvents,0);equal(stable.disappearances,0);equal(stable.identifiedCardId,exact.cardId);check(stable.identificationLatency>=1000);equal(w.handle.getState().active,false);pinnedRaw=w.q.getSession().trials.at(-1);pinnedContext=w.q.context();await w.dispose();
  w=await world();await w.tick(4);w.start(exact);w.setNext(native(other));w.tracks([{uid:2}],0);await w.tick(6);check(w.q.getActiveObservation().observations.some(o=>o.identifiedCardId===other.cardId));const wrong=w.finish();check(wrong.wrongCardEvents>0,'Wrong accepted native identities count even when detection flag is false');check(wrong.category!=='CORRECT');await w.dispose();
  w=await world();await w.tick(4);w.start();w.tracks([{uid:3}]);await w.tick(2);w.setNext(native(exact,{accepted:false,decision:'REJECTED'}));await w.tick(2);w.setNext(native());await w.tick(2);w.setNext(native(exact,{accepted:false,decision:'REJECTED'}));await w.tick(2);w.setNext(native());await w.tick(2);const unstable=w.finish();equal(unstable.category,'UNSTABLE');check(unstable.disappearances>=2);await w.dispose();
  w=await world();await w.tick(4);w.start();w.tracks([{uid:4}]);await w.tick(2);w.tracks([]);await w.tick();equal(w.handle.getState().identity,null);w.tracks([{uid:5}]);await w.tick(5);equal(w.handle.getState().lockedTrackUid,4);equal(w.handle.getState().identity,null);equal(w.q.getActiveObservation().observations.at(-1).identifiedCardId,null);check(w.finish().category!=='CORRECT');await w.dispose();
  w=await world();await w.tick(4);w.start(shared);w.setNext(native(shared));w.tracks([{uid:6}]);await w.tick(7);const common=w.finish();equal(common.category,'CORRECT');equal(common.identifiedCardId,shared.cardId);equal(common.identifiedPrintingId,null);equal(common.printingAssessment,'UNRESOLVED_SHARED_ART');equal(common.wrongPrintingEvents,0);await w.dispose();
  w=await world();await w.tick(4);w.start();w.tracks([{uid:7}]);await w.tick(2);w.state.playerLocale='fr';await w.tick(2);const changed=w.finish();equal(changed.category,'INVALID_TEST');check(changed.invalidReasons.includes('LOCALE_CONTAMINATION'));await w.dispose();
  w=await world();await w.tick(4);w.start();w.tracks([{uid:8}]);await w.tick(2);w.listeners.get('tcg-vision-geometry')({type:'tcg-vision-geometry'});await w.tick();equal(w.finish().category,'INVALID_TEST');equal(w.q.getNeutralState().ready,false);await w.dispose();
  w=await world();await w.tick(4);w.start();w.tracks([{uid:9}]);await w.tick(6);w.finish();throws(()=>w.start(other),/confirmed neutral/);w.empty();w.local.lostTracks=[{uid:9,lostAtMs:w.clock}];w.visible(exact,9);w.state.hoveredTrack=null;w.state.identification=null;const beforeLost=copy(w.local.lostTracks);await w.tick(30);equal(w.q.getNeutralState().ready,false);equal(w.clears,0);await w.tick(9);equal(w.q.getNeutralState().ready,true);equal(w.local.lostTracks,beforeLost);equal(w.local.identityMemoryMs,8000);check(w.clears>0);const b=w.start(other);equal(b.observations[0].identifiedCardId,null);w.setNext(native(exact));w.tracks([{uid:10}]);await w.tick(6);check(w.finish().wrongCardEvents>0,'New B-origin wrong match is not hidden by A quarantine');await w.dispose();
  w=await world(false);await w.tick(4);const legacy=w.start();equal(legacy.identityMeasurement,undefined);equal(w.beginCalls,0);w.tracks([{uid:11}]);w.visible(exact,11);await w.tick(6);equal(w.finish().category,'CORRECT');await w.dispose();
  // Missing, contradictory or discontinuous per-track evidence cannot certify
  // a new-mode trial, even if its UI identity history appears successful.
  let tampered=copy(pinnedRaw);tampered.observations.forEach(o=>delete o.qualificationTracking);equal(harness.classifyTrial(tampered,pinnedContext).category,'INVALID_TEST');
  tampered=copy(pinnedRaw);for(const o of tampered.observations)if(o.identifiedCardId)o.qualificationTracking.accepted=false;equal(harness.classifyTrial(tampered,pinnedContext).category,'INVALID_TEST');
  tampered=copy(pinnedRaw);tampered.observations.at(-1).qualificationTracking.lockedTrackUid+=1;equal(harness.classifyTrial(tampered,pinnedContext).category,'INVALID_TEST','A new track cannot replace the locked physical UID');
  tampered=copy(pinnedRaw);for(const o of tampered.observations)if(o.identifiedCardId)o.qualificationTracking.decisionAtMs=tampered.t0Ms-1;equal(harness.classifyTrial(tampered,pinnedContext).category,'INVALID_TEST','An accepted decision from before this trial is invalid evidence');
  tampered=copy(pinnedRaw);tampered.observations.forEach((o,i)=>{if(i>2)o.atMs+=1500;});tampered.endMs+=1500;equal(harness.classifyTrial(tampered,pinnedContext).category,'INVALID_TEST','A long missing sample interval is not a stable-identity certificate');
  tampered=copy(pinnedRaw);tampered.observations.forEach(o=>{o.qualificationTracking.privateImage='private-trace-payload';});check(!JSON.stringify(harness.classifyTrial(tampered,pinnedContext)).includes('private-trace-payload'),'Per-track evidence is sanitized before report output');
  w=await world();await w.tick(4);w.start(exact,{condition:'STABILITY'});w.tracks([{uid:61}]);await w.tick(7);w.tracks([]);await w.tick(2);check(w.finish().category!=='CORRECT','Unmarked real track loss cannot hide behind an earlier correct window');await w.dispose();
  w=await world();await w.tick(4);w.start();w.setNext(()=>Promise.reject(Error('private native error')));w.tracks([{uid:62}]);await w.tick(3);const crashed=w.finish();equal(crashed.category,'INVALID_TEST');check(crashed.invalidReasons.includes('CRASH'));check(!JSON.stringify(crashed).includes('private native error'));await w.dispose();
  w=await world();await w.tick(4);w.start(exact,{condition:'STABILITY'});w.tracks([{uid:63}]);await w.tick(7);w.setNext(native(exact,{accepted:false,decision:'REJECTED'}));await w.tick(6);equal(w.finish().category,'UNSTABLE','One sustained native loss after recognition is real instability');await w.dispose();
  w=await world();await w.tick(4);w.start(exact,{condition:'REMOVAL'});w.tracks([{uid:64}]);await w.tick(7);w.q.markRemoval();w.tracks([]);await w.tick(6);const removed=w.finish();equal(removed.category,'CORRECT','Explicit physical removal does not count as unmarked identity instability');equal(removed.removal.assessment,'CLEARED');await w.dispose();
  w=await world();await w.tick(4);w.start();w.tracks([{uid:65}]);await w.tick();w.setNext(()=>new Promise(()=>{}));await w.tick(8);check(w.finish().category!=='CORRECT','Polling one cached native acceptance cannot manufacture a 1000ms engine confirmation span');await w.dispose();
  w=await world();await w.tick(4);w.start(exact,{condition:'STABILITY'});w.tracks([{uid:66}]);await w.tick(7);w.setNext(()=>new Promise(()=>{}));await w.tick(8);equal(w.finish().category,'UNSTABLE','A qualifying native window followed by more than 1000ms without fresh completion is unstable');await w.dispose();
  w=await world();await w.tick(4);w.start();w.tracks([{uid:67}]);await w.tick(2);w.tracks([{uid:67},{uid:68}]);await w.tick(2);equal(w.handle.getState().identity,null);equal(w.finish().category,'INVALID_TEST','An extra live track after locking invalidates this single-card qualification');await w.dispose();
  const compact=JSON.parse(fs.readFileSync(path.join(root,'fixtures/vision-qualification-6c-replays.json'),'utf8'));
  equal(compact.visibleClearTransitions.length,85);
  for(const transition of compact.visibleClearTransitions){
    equal(transition.after.detected,true);equal(transition.after.activeTrackUids,transition.before.activeTrackUids);
    equal(transition.after.hoveredTrackUid,null);check(transition.before.identifiedCardId!==null&&transition.after.identifiedCardId===null);
  }
  for(const trace of compact.oldWrongTraces){
    const observations=trace.wrongObservations.map(value=>({...value,locale:'en',candidateIds:[],candidatePrintingIds:[],validityErrors:[]}));
    const trial={trialId:'legacy-wrong-'+trace.trialOrdinal,timestamp:'2026-11-04T00:00:00Z',provenance:'automated',
      condition:'NOMINAL',expectedCardId:trace.expectedCardId,expectedPrintingId:trace.expectedPrintingId,t0Ms:0,
      endMs:Math.max(1,observations.at(-1).atMs),observations};
    const outcome=harness.classifyTrial(trial,{...pinnedContext,productSha:'a'.repeat(40)});
    equal(outcome.wrongCardEvents,trace.wrongObservations.length,'Each selected old wrong acceptance remains counted; full historical counters are checked separately');
    check(outcome.category!=='CORRECT');
  }
  await actualAdapter();
  const archive=process.env.TCGATE_6C_ARCHIVE_ROOT;
  if(archive){
    const sharedReport=require(path.join(root,'public/vision-qualification-report.js'));
    const sampleDocument=JSON.parse(fs.readFileSync(process.env.TCGATE_6C_SAMPLE_PATH||path.join(root,'VISION_QUALIFICATION_SAMPLE.json'),'utf8'));
    for(const dir of ['physical-baseline-fail','physical-6b-nominal']){
      const s=JSON.parse(fs.readFileSync(path.join(archive,dir,'vision-qualification-session.json'),'utf8')),original=JSON.parse(fs.readFileSync(path.join(archive,dir,'vision-qualification-reading-report.json'),'utf8'));
      equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(archive,dir,'vision-qualification-session.json'))).digest('hex'),
        dir==='physical-baseline-fail'?'49f6c00a09ae40db4f6fa6d7b62827956b67af4f992b74161b9f69a98f0fa5f9':'da70fbce21f7ba1a99283ed6c51609883308780c011cdaf92502572cb9b1a6ac','Archived session bytes remain authentic');
      equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(archive,dir,'vision-qualification-reading-report.json'))).digest('hex'),
        dir==='physical-baseline-fail'?'593ee46ae23585e88a2d015aecee1088b040680832a873f927a28a3264c39541':'f9158f1daf5529c502d2b0bbff381fb26728ed8bcebb6e55f8b4bb47be9cfbb2','Archived report bytes remain authentic');
      const replay=sharedReport.generate({productSha:s.context.productSha,sampleProductSha:s.context.productSha,references:s.context.references,sampleDocument,sessions:[s]});
      equal(replay.trials.length,s.trials.length,'No invalid historical trial disappears');
      // 6C.1 changes only the interpretation of a valid NOMINAL acquisition.
      // These original reports and session bytes remain immutable; historical
      // counters and timings still match, with the explicit nominal-only delta.
      const acquired=t=>t.condition==='NOMINAL' && t.category!=='INVALID_TEST' && t.stableConfirmedAtMs!==null && !t.wrongCardEvents && !t.wrongPrintingEvents;
      const corrected=original.trials.filter(t=>acquired(t)&&t.category!=='CORRECT');
      equal(corrected.length,dir==='physical-baseline-fail'?4:24,'Historical semantics delta is explicit, not a rewrite of original FAIL evidence');
      const expectedMetrics=copy(original.metrics.physical);
      for(const t of corrected){expectedMetrics.categories[t.category]--;expectedMetrics.categories.CORRECT++;expectedMetrics.correct++;}
      expectedMetrics.correctIdentificationRate=expectedMetrics.correct/expectedMetrics.valid*100;
      equal(replay.metrics.physical,expectedMetrics,'Only nominal category/correct-rate aggregates change under 6C.1');
      for(const t of original.trials){const actual=replay.trials.find(x=>x.trialId===t.trialId);equal(actual.category,acquired(t)?'CORRECT':t.category);equal(actual.wrongCardEvents,t.wrongCardEvents);equal(actual.wrongPrintingEvents,t.wrongPrintingEvents);equal(actual.disappearances,t.disappearances);equal(actual.invalidReasons,t.invalidReasons);equal(actual.stableConfirmedAtMs,t.stableConfirmedAtMs);equal(actual.stableCorrectSinceMs,t.stableCorrectSinceMs);archiveTrials++;}
      equal(replay.metrics.physical.total,dir==='physical-baseline-fail'?45:46);equal(replay.metrics.physical.valid,dir==='physical-baseline-fail'?43:45);equal(replay.metrics.physical.invalid,dir==='physical-baseline-fail'?2:1);equal(replay.metrics.physical.wrongIdentification,dir==='physical-baseline-fail'?7:0);
    }
  }
  console.log('VISION_QUALIFICATION_STABLE_6C_PASS '+assertions+' assertions; '+archiveTrials+' historical trials with explicit 6C.1 nominal-only category deltas; original exports immutable; native scalar injections are automated tests only');
}
main().catch(error=>{console.error(error.stack||error.message);process.exitCode=1;});
