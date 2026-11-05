'use strict';
// Scalar automated vectors: none of these are observations of physical cards.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const api = require('./public/vision-real-game-campaign.js');
const profile = JSON.parse(fs.readFileSync(path.join(__dirname,'public/vision-real-game-profile.json'),'utf8'));
let assertions=0;
const eq=(actual,expected,why)=>{assertions++;assert.deepEqual(actual,expected,why);};
const ok=(value,why)=>{assertions++;assert.ok(value,why);};
const throws=(action,expected)=>{assertions++;assert.throws(action,expected);};
const copy=value=>JSON.parse(JSON.stringify(value));
const jobs=api.planJobs(profile), A=jobs[0].expectedCardId, B=jobs[1].expectedCardId;
const context={productSha:'a'.repeat(40),databaseSha:'b'.repeat(40),gameId:'cyberpunk',locale:'en',referenceCount:229,referencesSha256:'c'.repeat(64),scope:'SOLO_LAB_NORMAL_HOVER',identificationPath:'NORMAL_HOVER',capabilities:{tableStateMemory:false,identityMemory:'NATIVE_TEMPORAL_HOLD_EVENTS',localCamera:true,normalHover:true}};
function session(extra={}){return api.createSession({profile,context,provenance:'automated',clockId:'clock-test',now:()=>0,...extra});}
function event(s,kind,atMs,extra={}){return s.observe({kind,atMs,clockId:'clock-test',...extra});}
function request(s,n,atMs=10,trackUid=1,extra={}){return event(s,'REQUEST',atMs,{consultationId:n,trackUid,requestOrigin:'HUMAN_POINTER',genuineHover:true,...extra});}
function result(s,n,atMs,cardId=A,extra={}){return event(s,'RESULT',atMs,{consultationId:n,trackUid:1,cardId,accepted:true,identityCurrent:true,tracked:true,nativeStatus:'ACTIVE',decisionFresh:true,source:'NEW_ANALYSIS',...extra});}
function display(s,n,atMs,cardId=A,extra={}){return event(s,'DISPLAY',atMs,{consultationId:n,trackUid:1,cardId,accepted:true,identityCurrent:true,displayConfirmed:true,decisionFresh:true,source:'NEW_ANALYSIS',...extra});}
function finished(s,at=10010){s.endObservation('COMPLETED',at);return s.exportReport();}
eq(profile.id,'VISION_SOLO_LAB_1_0');eq(profile.scope,'SOLO_LAB_NORMAL_HOVER');eq(profile.environment.operatorCount,1);eq(profile.environment.webrtcRequired,false);eq(profile.environment.roomRequired,false);eq(profile.environment.readyRequired,false);eq(jobs.length,98);eq(new Set(jobs.map(job=>job.id)).size,98);
for(const [phase,count]of Object.entries({RELIABILITY:20,STABILITY:8,TRANSITION:16,ROBUSTNESS:12,NEGATIVE:5,LATENCY:36,FREE_PLAY:1}))eq(jobs.filter(job=>job.phase===phase).length,count,phase);
eq(jobs.filter(job=>job.phase==='LATENCY' && job.consultationOrdinal===1).length,18);
eq(jobs.filter(job=>job.phase==='LATENCY' && job.consultationOrdinal===2).length,18);
eq(jobs.filter(job=>job.phase==='STABILITY').map(job=>job.durationMs),Array(8).fill(20000));
eq(jobs.filter(job=>job.phase==='NEGATIVE').map(job=>job.durationMs),Array(5).fill(30000));
throws(()=>api.planJobs({...profile,id:'NOMINAL'}),/Distinct/);
throws(()=>session({clockId:null}),/clockId/);throws(()=>session({provenance:undefined}),/provenance/);
const selection=profile.cards.map(card=>({...card,available:card.id!=='C2'}));eq(api.planJobs(profile,selection).find(job=>job.cardRef==='C2').available,false);
throws(()=>api.planJobs(profile,[selection[0]]),/exactly ten/);throws(()=>api.planJobs(profile,selection.map(card=>({...card,cardId:A}))),/distinct canonical/);
{
 const s=session();s.startObservation(jobs[0],0);s.markPresence(true,1);request(s,'q1');result(s,'q1',75);display(s,'q1',90);const r=finished(s);
 eq(r.consultations[0].trackUid,'1');eq(r.consultations[0].outcome,'CORRECT');eq(r.consultations[0].responseMs,80);eq(r.consultations[0].correctResponseMs,80);eq(r.consultations[0].firstRecognitionAtMs,75);eq(r.observations[0].outcome,'CORRECT');eq(r.metrics.reliability.correctRate,100);eq(r.qualification.status,'NOT_EVALUATED');eq(r.evidence,'AUTOMATED_TEST_ONLY');eq(r.nominalBaseline,null);eq(r.metrics.latency.groups[0].response.n,1);
}
{
 const s=session();s.startObservation(jobs[0],0);request(s,'q1');result(s,'q1',20,B);display(s,'q1',25,B);result(s,'q1',40,A);display(s,'q1',45,A);const r=finished(s);
 eq(r.consultations[0].outcome,'WRONG');ok(r.consultations[0].wrongAccepted>0,'A later correct display must not mask a wrong identity');eq(r.consultations[0].responseMs,15);eq(r.consultations[0].correctResponseMs,35);eq(r.metrics.reliability.wrongRate,100);eq(r.observations[0].outcome,'WRONG');
}
{
 const s=session();s.startObservation(jobs[0],0);request(s,'q1');result(s,'q1',20,A,{printingId:'other-printing',definitivePrinting:true});display(s,'q1',25,A,{printingId:'other-printing',definitivePrinting:true});const r=finished(s);eq(r.consultations[0].outcome,'WRONG');ok(r.consultations[0].wrongPrintingAccepted>0);eq(r.observations[0].outcome,'WRONG');
}
for(const source of ['HOVER_CACHE','IDENTITY_MEMORY','TABLE_MEMORY','PREEXISTING','UNKNOWN']){
 const s=session();s.startObservation(jobs[0],0);request(s,'q1',10,1,{preexisting:true});result(s,'q1',20,A,{source,preexisting:true,decisionFresh:false});display(s,'q1',30,A,{source});const r=finished(s);eq(r.consultations[0].source,source);eq(r.consultations[0].firstRecognitionAtMs,null);eq(r.consultations[0].outcome,'CORRECT');eq(r.consultations[0].responseMs,20);
}
{
 const s=session();s.startObservation(jobs[0],0);event(s,'TRACK_STATE',5,{trackUid:1,cardId:A,tracked:true,identityCurrent:true,nativeStatus:'ACTIVE',nativeIdentityAtMs:2});request(s,'q1',10,1,{preexisting:true,alreadyVisibleAtRequest:true});display(s,'q1',20,A,{source:'PREEXISTING',alreadyVisibleAtRequest:true});const r=finished(s);
 eq(r.consultations[0].outcome,'CORRECT');eq(r.consultations[0].responseMs,null,'Already visible preview is not a new zero-latency confirmation');eq(r.consultations[0].correctResponseMs,null);eq(r.observations[0].firstNativeCorrectObservedAtMs,5);eq(r.observations[0].nativeIdentityAtMs,2);
}
{
 const s=session();s.startObservation(jobs[0],0);request(s,'q1');display(s,'q1',20,B,{retainedPreview:true});const r=finished(s);eq(r.consultations[0].outcome,'NO_RESPONSE');eq(r.consultations[0].responseMs,null);eq(r.consultations[0].wrongAccepted,0);eq(r.observations[0].wrongAccepted,0);
}
{
 const s=session();s.startObservation(jobs[0],0);event(s,'TRACK_STATE',4,{trackUid:1,cardId:A,tracked:true,identityCurrent:true,nativeStatus:'ACTIVE'});result(s,null,5,A);display(s,null,6,A);const r=finished(s);eq(r.consultations.length,0);eq(r.limits.unattributedResults,1);eq(r.observations[0].outcome,'NON_CONCLUSIVE');eq(r.observations[0].observedOutcome,'NATIVE_CORRECT_NOT_DISPLAYED');eq(r.metrics.reliability.total,0);eq(r.metrics.latency.groups.length,0);
}
{
 const s=session();s.startObservation(jobs[0],0);request(s,'q1',10,1,{requestOrigin:'STATIONARY_POINTER',genuineHover:false});result(s,'q1',20);display(s,'q1',30);const r=finished(s);eq(r.consultations[0].outcome,'CORRECT');eq(r.metrics.consultations.stationaryPointerRequests,1);eq(r.metrics.consultations.humanRequests,0);eq(r.metrics.latency.groups.length,0,'A stationary retarget is not measured as a new human hover');
}
{
 const s=session();s.startObservation(jobs[0],0);request(s,'q1');eq(request(s,'q1',11).reason,'DUPLICATE_REQUEST');display(s,'q1',20,A,{trackUid:2});const r=finished(s);eq(r.consultations.length,1);eq(r.consultations[0].outcome,'NO_RESPONSE');eq(r.consultations[0].lateEvents,1);
}
{
 const s=session();s.startObservation(jobs[0],0);request(s,'q1');event(s,'CANCEL',20,{consultationId:'q1'});display(s,'q1',30);const r=finished(s);eq(r.consultations[0].outcome,'CANCELLED');eq(r.consultations[0].responseMs,null);eq(r.consultations[0].lateEvents,1);eq(r.consultations[0].lateDisplayAtMs,30);
}
{
 const s=session();s.startObservation(jobs[0],0);request(s,'q1');display(s,'q1',20);event(s,'CANCEL',30,{consultationId:'q1'});const r=finished(s);eq(r.consultations[0].outcome,'CORRECT','Leaving after a successful consultation keeps its result');eq(r.consultations[0].cancelledAtMs,30);
}
{
 const s=session();s.startObservation(jobs[0],0);request(s,'q1');event(s,'TIMEOUT',10010,{consultationId:'q1'});result(s,'q1',11000);display(s,'q1',11010);const r=finished(s,12000);eq(r.consultations[0].outcome,'NO_RESPONSE');eq(r.consultations[0].lateResultAtMs,11000);eq(r.consultations[0].lateDisplayAtMs,11010);eq(r.consultations[0].responseMs,null);
}
{
 const s=session();s.startObservation(jobs[0],0);request(s,'q1');result(s,'q1',20,A,{accepted:false,reason:'SCORE_INSUFFICIENT'});const r=finished(s);eq(r.consultations[0].outcome,'REJECTED');eq(r.consultations[0].rejections,1);eq(r.consultations[0].responseMs,null);
}
{
 const s=session();const a=jobs.find(job=>job.phase==='TRANSITION'&&job.stage==='A'),b=jobs.find(job=>job.sequenceId===a.sequenceId&&job.stage==='B');s.startObservation(a,0);s.markPresence(true,1);request(s,'qa',10);result(s,'qa',20,a.expectedCardId);display(s,'qa',30,a.expectedCardId);s.markPresence(false,100);s.endObservation('COMPLETED',110);s.startObservation(b,200);s.markPresence(true,201);request(s,'qb',210,2);const stale=result(s,'qa',220,a.expectedCardId);eq(stale.reason,'LATE_EVENT');display(s,'qa',230,a.expectedCardId);result(s,'qb',240,b.expectedCardId,{trackUid:2});display(s,'qb',250,b.expectedCardId,{trackUid:2});const r=finished(s,10210);eq(r.observations[1].wrongAccepted,0);eq(r.observations[1].outcome,'CORRECT');eq(r.consultations.find(value=>value.id==='qb').wrongAccepted,0);eq(r.metrics.transitions[0].bMisidentifiedAsA,false);eq(r.metrics.transitions[0].complete,true);
}
{
 const s=session();const a=jobs.find(job=>job.phase==='TRANSITION'&&job.stage==='A'),b=jobs.find(job=>job.sequenceId===a.sequenceId&&job.stage==='B');s.startObservation(a,0);s.markPresence(true,1);request(s,'qa');result(s,'qa',20,a.expectedCardId);display(s,'qa',30,a.expectedCardId);s.markPresence(false,100);s.endObservation('COMPLETED',110);s.startObservation(b,200);s.markPresence(true,201);request(s,'qb',210,2);result(s,'qb',220,a.expectedCardId,{trackUid:2});display(s,'qb',230,a.expectedCardId,{trackUid:2});const r=finished(s,10210);eq(r.metrics.transitions[0].bMisidentifiedAsA,true);eq(r.observations[1].outcome,'WRONG');
}
{
 const s=session();s.startObservation(jobs.find(job=>job.phase==='STABILITY'),0);s.markPresence(true,0);event(s,'TRACK_STATE',100,{trackUid:1,tracked:true,detected:true,identityCurrent:true,nativeStatus:'ACTIVE',cardId:A,source:'TABLE_MEMORY',decisionFresh:false});event(s,'TRACK_STATE',10100,{trackUid:1,tracked:true,identityCurrent:true,nativeStatus:'ACTIVE',cardId:A,source:'TABLE_MEMORY',decisionFresh:false});const r=finished(s,20100);eq(r.metrics.stability.correctNativeMs,20000,'Native memory stays admissible under product policy without a forced freshness threshold');eq(r.metrics.stability.nativeIdentityRetentionRate,100);eq(r.metrics.stability.unknownTrackingMs,100);eq(r.observations[0].trackLosses,0);
}
{
 const s=session();s.startObservation(jobs[0],0);s.markPresence(true,0);event(s,'TRACK_STATE',0,{trackUid:1,tracked:true,identityCurrent:true,nativeStatus:'ACTIVE',cardId:A});event(s,'TRACK_STATE',1000,{trackUid:1,tracked:true,identityCurrent:false,nativeStatus:'SUSPENDED'});event(s,'TRACK_STATE',2000,{trackUid:1,tracked:false,identityCurrent:false,nativeStatus:'LOST'});event(s,'TRACK_STATE',3000,{trackUid:2,tracked:true,identityCurrent:true,nativeStatus:'ACTIVE',cardId:A});event(s,'TRACK_STATE',4000,{trackUid:2,tracked:true,identityCurrent:false,nativeStatus:'ACTIVE'});event(s,'TRACK_STATE',5000,{trackUid:2,tracked:true,identityCurrent:true,nativeStatus:'ACTIVE',cardId:A});s.markPresence(false,6000);event(s,'TRACK_STATE',7000,{trackUid:2,tracked:false,nativeStatus:'LOST'});const r=finished(s,8000);
 eq(r.metrics.stability.declaredPresenceMs,6000);eq(r.metrics.stability.suspendedMs,1000);eq(r.metrics.stability.trackLostMs,1000);eq(r.metrics.stability.identityUnavailableMs,1000);eq(r.metrics.stability.maximumIdentityLossMs,1000);eq(r.metrics.stability.trackLosses,1);eq(r.metrics.stability.trackReacquisitions,1);eq(r.metrics.stability.admissibleNativeMs,4000);eq(r.metrics.stability.correctNativeMs,3000);eq(r.metrics.stability.nativeIdentityRetentionRate,75);
}
{
 const s=session();s.startObservation(jobs.find(job=>job.phase==='NEGATIVE'),0);s.markPresence(false,0);event(s,'TRACK_STATE',5,{trackUid:1,detected:true,identityCurrent:false,tracked:true});event(s,'RESULT',10,{trackUid:1,cardId:A,accepted:true,decisionFresh:false,retainedPreview:true});let r=s.exportReport();eq(r.observations[0].freshFalsePositiveAcceptances,0);event(s,'RESULT',20,{trackUid:1,cardId:A,accepted:true,decisionFresh:true,identityCurrent:true});r=finished(s,30000);eq(r.observations[0].freshFalsePositiveAcceptances,1);eq(r.observations[0].outcome,'FALSE_POSITIVE');eq(r.metrics.negativeScenes.observedMs,30000);eq(r.metrics.reliability.total,0);
}
{
 const s=session();s.startObservation(jobs[0],0);request(s,'q1');eq(event(s,'RESULT',20,{clockId:'other-clock',consultationId:'q1',accepted:true,cardId:A}).reason,'CLOCK_MISMATCH');eq(event(s,'RESULT',9,{consultationId:'q1',accepted:true,cardId:A}).reason,'NON_MONOTONIC_CLOCK');eq(event(s,'RESULT',null).reason,'INVALID_EVENT');const r=finished(s);eq(r.limits.clockMismatchEvents,1);eq(r.limits.nonMonotonicEvents,1);eq(r.limits.invalidEvents,1);eq(r.consultations[0].responseMs,null);
}
{
 const s=session();s.startObservation(jobs[0],0);request(s,'q1');event(s,'CONTEXT_INVALIDATED',20);const r=s.exportReport();eq(r.observations[0].validity,'NON_CONCLUSIVE');eq(r.qualification.contextInvalid,true);eq(r.metrics.reliability.total,0);eq(r.consultations[0].validity,'NON_CONCLUSIVE');
}
{
 const b={source:'QUALIFICATION_RECEIPT',productSha:'d'.repeat(40),receiptId:'nominal-receipt',valid:45,correct:43,wrong:0,observations:[{image:'secret'}]};const s=session({nominalBaseline:b});const r=s.exportReport();eq(r.nominalBaseline.valid,45);eq(r.nominalBaseline.correct,43);eq(r.nominalBaseline.includedInCurrentDenominators,false);eq(r.observations.length,0);eq(r.consultations.length,0);eq(r.metrics.reliability.correctRate,null);eq(r.nominalBaseline.observations,undefined);eq(session({nominalBaseline:{...b,correct:44}}).exportReport().nominalBaseline,null);
}
{
 const sensitive={image:'data:image/png;base64,SECRET',video:'secret',audio:'secret',crop:'secret',room:'secret',name:'secret',email:'secret',token:'secret',url:'https://secret',arbitrary:{secret:true}};
 const s=session({context:{...context,...sensitive},installation:{framingValidated:true,fixed:true,lighting:'ordinary',...sensitive}});s.startObservation({...jobs[0],...sensitive},0);request(s,'q1',10,1,sensitive);result(s,'q1',20,A,sensitive);display(s,'q1',30,A,sensitive);s.addIncident('free text secret',31);s.addIncident('UI_STALL',32);const r=finished(s);const json=JSON.stringify(r);ok(!json.includes('secret'));ok(!json.includes('data:image'));eq(r.context,context);eq(r.installation,{framingValidated:true,fixed:true,lighting:'ordinary'});eq(r.incidents.length,1);eq(r.incidents[0].code,'UI_STALL');
 const forbidden=new Set(['image','video','audio','crop','media','url','email','token','room','name']);function inspect(value){if(value&&typeof value==='object')for(const[k,v]of Object.entries(value)){ok(!forbidden.has(k),'Forbidden export key '+k);inspect(v);}}inspect(r);
}
{
 const limited=copy(profile);limited.limits={maxEvents:3,maxObservations:1,maxConsultations:1,maxIncidents:1};const s=session({profile:limited});s.startObservation(jobs[0],0);request(s,'q1',1);request(s,'q2',2);s.addIncident('UI_STALL',3);s.addIncident('UI_STALL',4);for(let t=5;t<12;t++)event(s,'TRACK_STATE',t,{trackUid:1,tracked:true});s.endObservation('COMPLETED',20);throws(()=>s.startObservation(jobs[1],21),/limit/);const r=s.exportReport();eq(r.events.length,3);eq(r.observations.length,1);eq(r.consultations.length,1);eq(r.incidents.length,1);ok(r.limits.truncated);ok(r.limits.droppedEvents>0);eq(r.limits.droppedConsultations,1);eq(r.limits.droppedIncidents,1);eq(r.limits.droppedObservations,1);eq(r.qualification.incompleteEvidence,true);
}
{
 const s=session();throws(()=>s.startObservation({...jobs[0],expectedCardId:B},0),/cannot be changed/);s.startObservation(jobs[0],0);throws(()=>s.startObservation(jobs[1],1),/previous/);s.finish(10);eq(s.getState().finished,true);eq(event(s,'TRACK_STATE',11).reason,'SESSION_FINISHED');throws(()=>s.startObservation(jobs[1],12),/finished/);eq(s.exportReport().durationMs,10);
}
{
 const s=session();s.startObservation(jobs[0],0);s.markPresence(true,0);event(s,'TRACK_STATE',0,{trackUid:1,tracked:true,identityCurrent:true,nativeStatus:'ACTIVE',cardId:A});event(s,'OBSERVATION_GAP',5000,{previousAtMs:1000,durationMs:4000,reason:'CALLBACK_GAP'});event(s,'TRACK_STATE',6000,{trackUid:1,tracked:true,identityCurrent:true,nativeStatus:'ACTIVE',cardId:A});const r=finished(s,7000);eq(r.metrics.stability.correctNativeMs,2000);eq(r.metrics.stability.unknownTrackingMs,5000);eq(r.metrics.stability.declaredPresenceMs,7000);eq(r.metrics.stability.trackLostMs,0,'Missing observations must not invent a tracking loss');
}
{
 const s=session();s.startObservation(jobs[0],0);request(s,'q1');result(s,'q1',20,A,{source:'HOVER_CACHE'});display(s,'q1',30,A,{source:'HOVER_CACHE'});result(s,'q1',40,A,{source:'NEW_ANALYSIS'});const r=finished(s);eq(r.consultations[0].source,'HOVER_CACHE');eq(r.consultations[0].displaySource,'HOVER_CACHE');eq(r.metrics.latency.groups[0].source,'HOVER_CACHE','Later analysis cannot relabel an already displayed cached response');
}
{
 const ctx=copy(context);const base={source:'QUALIFICATION_RECEIPT',productSha:'d'.repeat(40),receiptId:'immutable',valid:45,correct:43,wrong:0};const installation={framingValidated:true,fixed:true,lighting:'ordinary'};const s=session({context:ctx,nominalBaseline:base,installation});ctx.productSha='e'.repeat(40);base.correct=0;installation.fixed=false;const r=s.exportReport();eq(r.context.productSha,context.productSha,'Caller mutation cannot relabel a session build');eq(r.nominalBaseline.correct,43);eq(r.installation.fixed,true);
}
{
 const s=session();const job=jobs.find(value=>value.phase==='FREE_PLAY');s.startObservation(job,0);eq(s.markReplacement({cardId:A,printingId:jobs[0].expectedPrintingId},1),true);request(s,'qa',10);eq(s.markReplacement(B,11),true);result(s,'qa',20,A);display(s,'qa',30,A);request(s,'qb',40,2);result(s,'qb',50,B,{trackUid:2});display(s,'qb',60,B,{trackUid:2});eq(s.markReplacement('card-outside-selected-corpus',70),false);eq(s.markReplacement(null,71),true);request(s,'qunknown',80,3);display(s,'qunknown',90,A,{trackUid:3});const r=finished(s,100);eq(r.consultations[0].expectedCardId,A,'Changing free-play annotation cannot rewrite the pending request');eq(r.consultations[1].expectedCardId,B);eq(r.consultations[0].outcome,'CORRECT');eq(r.consultations[1].outcome,'CORRECT');eq(r.consultations[2].expectedCardId,null);eq(r.consultations[2].outcome,'DISPLAYED_UNASSESSED');eq(r.consultations[2].responseMs,10);eq(r.metrics.consultations.displayedUnassessed,1);eq(r.metrics.reliability.total,0,'Free-play consultations do not inflate the reliability twenty');
}
{
 const s=session();s.startObservation(jobs.find(value=>value.phase==='STABILITY'),0);request(s,'q',10);display(s,'q',1000);let r=finished(s,20000);eq(r.observations[0].windowComplete,true);eq(r.observations[0].stabilityWindowAfterAcquisitionMs,19000);eq(r.observations[0].stabilityWindowComplete,false,'Twenty total seconds are not twenty seconds after acquisition');
 const t=session();t.startObservation(jobs.find(value=>value.phase==='STABILITY'),0);request(t,'q',10);display(t,'q',1000);r=finished(t,21000);eq(r.observations[0].stabilityWindowComplete,true);
}
{
 for(const code of ['CONDITION_UNAVAILABLE','PROTOCOL_ERROR','OCCLUSION','VIDEO_FREEZE','VIDEO_INTERRUPTION']) {
  const s=session();s.startObservation(jobs[0],0);request(s,'q1');result(s,'q1',20,B);display(s,'q1',30,B);s.addIncident(code,40);const r=finished(s);eq(r.observations[0].validity,'NON_CONCLUSIVE');eq(r.observations[0].observedOutcome,'WRONG');ok(r.observations[0].nonConclusiveReasons.includes(code));eq(r.metrics.reliability.total,0);eq(r.metrics.reliability.nonConclusiveWrongObservations,1);eq(r.metrics.consultations.wrongObservedIncludingNonConclusive,1);
 }
 const s=session();s.startObservation(jobs[0],0);s.addIncident('INSTALLATION_CHANGED',1);s.endObservation('COMPLETED',10);eq(s.getState().invalidContext,true);throws(()=>s.startObservation(jobs[1],20),/new session/);
}
{
 const s=session();s.startObservation(jobs[0],0);const r=finished(s);eq(r.metrics.reliability.total,0);eq(r.observations[0].observedOutcome,'NO_CONSULTATION');ok(r.observations[0].nonConclusiveReasons.includes('NO_HUMAN_CONSULTATION'));
 const p=session({provenance:'physical'});p.startObservation(jobs[0],0);request(p,'q1');display(p,'q1',20);const pr=finished(p);eq(pr.observations[0].validity,'NON_CONCLUSIVE');ok(pr.observations[0].nonConclusiveReasons.includes('PHYSICAL_EXPOSURE_NOT_DECLARED'));
 const q=session();q.startObservation(jobs[0],0);request(q,'q1');result(q,'q1',20);const qr=finished(q);eq(qr.observations[0].validity,'VALID');eq(qr.observations[0].observedOutcome,'NOT_IDENTIFIED');eq(qr.metrics.reliability.notIdentified,1,'Native recognition without a displayed answer remains a real observed response failure when a human requested it');
}
{
 const s=session();const a=jobs.find(job=>job.phase==='TRANSITION'&&job.stage==='A'),b=jobs.find(job=>job.sequenceId===a.sequenceId&&job.stage==='B');s.startObservation(a,0);s.markPresence(false,1);s.markPresence(true,2);request(s,'qa',10);display(s,'qa',20,a.expectedCardId);s.endObservation('COMPLETED',30);s.startObservation(b,40);request(s,'qb',50,2);display(s,'qb',60,b.expectedCardId,{trackUid:2});const r=finished(s,70);eq(r.metrics.transitions[0].emptyIntervalDeclared,false);eq(r.metrics.transitions[0].complete,false,'An empty scene before A acquisition does not prove its later removal');
}
{
 const s=session();s.startObservation(jobs[0],0);s.markPresence(true,1);request(s,'qa',10);result(s,'qa',20,A);display(s,'qa',30,A);s.endObservation('COMPLETED',40);s.startObservation(jobs[1],50);s.markPresence(true,51);
 result(s,null,55,A);const early=s.getState().activeObservation;eq(early.wrongAccepted,0);eq(early.correctAcquired,false);eq(early.firstNativeCorrectObservedAtMs,null);eq(result(s,'qa',56,A).reason,'LATE_EVENT');
 request(s,'qb',60,2);event(s,'TRACK_STATE',70,{trackUid:2,cardId:B,tracked:true,identityCurrent:true,nativeStatus:'ACTIVE'});result(s,'qb',80,B,{trackUid:2});display(s,'qb',90,B,{trackUid:2});const r=finished(s,100);eq(r.observations[1].outcome,'CORRECT');eq(r.observations[1].wrongAccepted,0);eq(r.observations[1].firstNativeCorrectObservedAtMs,70);eq(r.consultations[1].wrongAccepted,0);eq(r.limits.unattributedResults,1);ok(r.events.some(value=>value.kind==='RESULT'&&value.atMs===55),'Unattributable late evidence is preserved');
}
{
 const s=session();s.startObservation(jobs[0],0);request(s,'qa',10);result(s,'qa',20,A);display(s,'qa',30,A);s.endObservation('COMPLETED',40);s.startObservation(jobs.find(value=>value.phase==='NEGATIVE'),50);s.markPresence(false,51);result(s,null,55,A);eq(s.getState().activeObservation.freshFalsePositiveAcceptances,0,'Old requested UID without current native correlation is not a new false-positive proof');
 result(s,null,60,B,{trackUid:2});eq(s.getState().activeObservation.freshFalsePositiveAcceptances,1,'A genuine fresh unrequested result remains counted in a negative scene');
 event(s,'TRACK_STATE',70,{trackUid:2,cardId:B,tracked:true,identityCurrent:true,nativeStatus:'ACTIVE',decisionFresh:null});event(s,'TRACK_STATE',80,{trackUid:2,cardId:B,tracked:true,identityCurrent:true,nativeStatus:'ACTIVE',decisionFresh:null});event(s,'TRACK_STATE',90,{trackUid:2,tracked:false,identityCurrent:false,nativeStatus:'LOST'});event(s,'TRACK_STATE',100,{trackUid:2,cardId:B,tracked:true,identityCurrent:true,nativeStatus:'ACTIVE',decisionFresh:null});event(s,'TRACK_STATE',110,{trackUid:3,cardId:A,tracked:true,identityCurrent:true,nativeStatus:'ACTIVE',decisionFresh:null});const r=finished(s,30050);eq(r.metrics.negativeScenes.nativeIdentityAppearances,3);eq(r.metrics.negativeScenes.preexistingOrFreshUnknownIdentityAppearances,3);eq(r.metrics.negativeScenes.freshFalsePositiveAcceptances,1);eq(r.metrics.negativeScenes.nativeFreshness,'UNKNOWN_UNLESS_EXPLICIT_NATIVE_DECISION');
}
{
 const s=session();s.startObservation(jobs.find(value=>value.phase==='NEGATIVE'),0);s.markPresence(false,1);event(s,'TRACK_STATE',10,{trackUid:1,cardId:A,tracked:true,identityCurrent:true,nativeStatus:'ACTIVE',decisionFresh:null,accepted:true});const r=finished(s,30000);eq(r.observations[0].outcome,'NATIVE_IDENTITY_OBSERVED_FRESHNESS_UNKNOWN');eq(r.metrics.negativeScenes.freshFalsePositiveAcceptances,0);eq(r.metrics.negativeScenes.nativeIdentityAppearances,1);eq(r.metrics.negativeScenes.preexistingOrFreshUnknownIdentityAppearances,1,'Native identity existence is visible even without a provably fresh decision');
}
{
 const s=session();s.startObservation(jobs[0],0);event(s,'TRACK_STATE',1,{trackUid:1,cardId:A,tracked:true,identityCurrent:true,nativeStatus:'ACTIVE',decisionFresh:null});const r=s.exportReport();const logged=r.events[0];eq(logged.kind,'TRACK_STATE');eq(logged.trackUid,'1');eq(logged.identityCurrent,true);eq(Object.hasOwn(logged,'matcherMs'),false);eq(Object.hasOwn(logged,'decisionFresh'),false);eq(r.eventEncoding,'SPARSE_SCALARS_OPTIONAL_ABSENT_MEANS_UNKNOWN');eq(r.observations[0].firstCorrectDisplayAtMs,null);eq(r.metrics.reliability.correctRate,null);ok(JSON.stringify(logged).length<400,'Sparse logs avoid retaining dozens of unknown scalar fields per sample');
}
{
 const s=session();s.startObservation(jobs.find(value=>value.phase==='FREE_PLAY'),0);s.markReplacement(A,1);request(s,'q',10);result(s,'q',20,A,{printingId:jobs[0].expectedPrintingId,definitivePrinting:true});display(s,'q',30,A,{printingId:jobs[0].expectedPrintingId,definitivePrinting:true});const r=finished(s,40);eq(r.consultations[0].outcome,'CORRECT');eq(r.consultations[0].wrongPrintingAccepted,0,'Unknown expected printing cannot produce a wrong-printing accusation');eq(r.observations[0].wrongPrintingAccepted,0);
}
{
 const s=session(),a=jobs.find(value=>value.phase==='TRANSITION'&&value.stage==='A'),b=jobs.find(value=>value.sequenceId===a.sequenceId&&value.stage==='B');s.startObservation(b,0);request(s,'qb',10,2);display(s,'qb',20,b.expectedCardId,{trackUid:2});s.endObservation('COMPLETED',30);s.startObservation(a,40);s.markPresence(true,41);request(s,'qa',50);display(s,'qa',60,a.expectedCardId);s.markPresence(false,70);const r=finished(s,80);eq(r.metrics.transitions[0].aAcquired,true);eq(r.metrics.transitions[0].emptyIntervalDeclared,true);eq(r.metrics.transitions[0].bOutcome,'CORRECT');eq(r.metrics.transitions[0].complete,false,'B measured before A cannot complete an A-to-B transition');
}
{
 const s=session();s.startObservation(jobs[0],0);s.markPresence(true,1);event(s,'TRACK_STATE',5,{trackUid:1,cardId:A,detected:true,tracked:true,identityCurrent:true,nativeStatus:'ACTIVE'});request(s,'qa',10);display(s,'qa',20,A);s.endObservation('COMPLETED',30);
 s.startObservation(jobs[1],40);s.markPresence(true,41);s.endObservation('COMPLETED',10040);const r=s.exportReport(),m=r.metrics.reliability;eq(m.correctRate,100);eq(m.total,1);eq(m.performed,2);eq(m.nonConclusive,1);eq(m.denominators.rateScope,'VALID_PRESENTATIONS_WITH_CORRELATED_HUMAN_CONSULTATION_ONLY');eq(m.denominators.validPresentations,1);eq(m.denominators.excludedPresentations,1);eq(m.denominators.declaredPresentWithoutCorrelatedHumanRequest,1);eq(m.denominators.declaredPresentWithoutDetectionObservation,1);eq(m.denominators.uncorrelatableHumanPointerAttempts,null,'A pointer attempt without a native track is not silently reported as zero');ok(m.denominators.exclusionReasons.some(value=>value.reason==='NO_HUMAN_CONSULTATION'&&value.observations===1));eq(m.denominators.ratesRequireReviewOfExcludedObservations,true);eq(m.denominators.ratesDoNotEstablishUndetectedPresentationSuccess,true);eq(r.observations[1].observedOutcome,'NO_CONSULTATION');eq(r.observations[1].validity,'NON_CONCLUSIVE');eq(r.qualification.status,'NOT_EVALUATED');
}
eq(api.stats([]),{n:0,minMs:null,medianMs:null,maxMs:null,p95Ms:null});eq(api.stats([1,3]),{n:2,minMs:1,medianMs:2,maxMs:3,p95Ms:null});eq(api.stats(Array.from({length:20},(_,n)=>n+1)).p95Ms,19);
{
 const sandbox={globalThis:{}};vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.join(__dirname,'public/vision-real-game-campaign.js'),'utf8'),sandbox);ok(sandbox.globalThis.TCGVisionRealGameCampaign);eq(JSON.parse(JSON.stringify(sandbox.globalThis.TCGVisionRealGameCampaign.planJobs(profile))),jobs,'Browser and Node pure planners agree');
}

// Solo Lab observes native holds, not the retained HD after pointer departure.
{
 const s=session({context:{...context,scope:'SOLO_LAB_NORMAL_HOVER',identificationPath:'NORMAL_HOVER',capabilities:{tableStateMemory:false,identityMemory:'NATIVE_TEMPORAL_HOLD_EVENTS',localCamera:true,normalHover:true}}});s.startObservation(jobs[0],0);s.markPresence(true,0);request(s,'solo',0);event(s,'TRACK_STATE',0,{trackUid:1,cardId:A,tracked:true,identityCurrent:true,identityObservationAvailable:true,nativeStatus:'ACTIVE',source:'IDENTITY_MEMORY',decisionFresh:false});event(s,'TRACK_STATE',1000,{trackUid:1,tracked:true,identityCurrent:false,identityObservationAvailable:false,nativeStatus:'UNKNOWN',retainedPreview:true});event(s,'TRACK_STATE',3000,{trackUid:1,tracked:true,identityCurrent:false,identityObservationAvailable:true,nativeStatus:'UNKNOWN'});const r=finished(s,4000);eq(r.metrics.stability.correctNativeMs,1000);eq(r.metrics.stability.unknownIdentityObservationMs,2000);eq(r.metrics.stability.identityUnavailableMs,1000);eq(r.metrics.stability.admissibleNativeMs,2000);eq(r.metrics.stability.nativeIdentityRetentionRate,50);eq(r.context.scope,'SOLO_LAB_NORMAL_HOVER');eq(r.context.capabilities.tableStateMemory,false);eq(r.events.find(e=>e.source==='IDENTITY_MEMORY').decisionFresh,false);eq(r.consultations[0].firstRecognitionAtMs,null);
}
{const legacy={...profile,id:'VISION_REAL_GAME_1_0',scope:'NORMAL_OPPONENT_STREAM_HUMAN_CONSULTATIONS'};eq(api.planJobs(legacy).length,98,'Previous profile vectors remain readable without reclassifying historical exports');}

{
 const s=session({provenance:'physical'});s.startObservation(jobs.find(j=>j.phase==='STABILITY'),0);s.markPresence(true,0);
 event(s,'TRACK_STATE',0,{trackUid:1,tracked:true,identityObservationAvailable:true,identityCurrent:false});
 event(s,'TRACK_STATE',3000,{trackUid:1,tracked:true,identityObservationAvailable:true,identityCurrent:true,cardId:A,nativeStatus:'ACTIVE'});
 event(s,'TRACK_STATE',5000,{trackUid:1,tracked:true,identityObservationAvailable:true,identityCurrent:false});
 const r=finished(s,6000);eq(r.evidence,'OPERATOR_DECLARED_SOLO_LAB_REAL_CARDS');eq(r.metrics.stability.acquisitionIdentityUnavailableMs,3000);eq(r.metrics.stability.postAcquisitionIdentityLossMs,1000);eq(r.metrics.stability.identityUnavailableMs,4000);eq(r.metrics.stability.maximumIdentityLossMs,1000,'First acquisition wait is not a post-acquisition loss');eq(r.metrics.stability.postAcquisitionAdmissibleNativeMs,3000);ok(Math.abs(r.metrics.stability.postAcquisitionNativeIdentityRetentionRate-2000/3000*100)<1e-9);
}
{
 const s=session();s.startObservation(jobs[0],0);request(s,'r',1);event(s,'CANCEL',2,{consultationId:'r',reason:'POINTER_LEFT_VIDEO'});event(s,'TIMEOUT',3,{reason:'NO_DISPLAY_WITHIN_OBSERVATION_WINDOW'});event(s,'RESULT',4,{reason:'glare-high'});event(s,'RESULT',5,{reason:'temporal-unstable'});event(s,'RESULT',6,{reason:'private arbitrary error'});const r=finished(s,10);eq(r.events.find(e=>e.kind==='CANCEL').reason,'POINTER_LEFT');eq(r.events.find(e=>e.kind==='TIMEOUT').reason,'TIMEOUT');eq(r.events.find(e=>e.atMs===4).reason,'QUALITY_REJECTED');eq(r.events.find(e=>e.atMs===5).reason,'TEMPORAL_STABILITY');ok(!JSON.stringify(r).includes('private arbitrary'));
}

console.log('PASS vision-real-game-campaign: '+assertions+' assertions (automated scalar vectors, no physical qualification)');
