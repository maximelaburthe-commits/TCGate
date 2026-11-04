'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = process.env.TCGATE_QUALIFICATION_TRACK_TEST_ROOT || __dirname;
const api = require(path.join(root, 'public/vision-qualification-track.js'));
let assertions = 0;
const equal = (a,b,why) => { assertions += 1; assert.deepEqual(a,b,why); };
const flush = () => new Promise(resolve => setImmediate(resolve));
const track = (uid, extra={}) => ({uid,misses:0,...extra});
const decision = (extra={}) => ({accepted:true,cardId:'cp-saburo-arasaka-stubborn-patriarch',refId:'cprg-test:cpp-test',printingId:null,candidatePrintingIds:['cpp-test'],recognitionMode:'shared',score:.9,atMs:100,decision:'ACCEPTED',...extra});
function setup(initial=[], identify=()=>decision()) {
  let tracks=initial, scheduled=null, cleared=[], calls=0, tick=100;
  const targets=[];
  const c=api.create({getTracks:()=>tracks,identify:t=>{calls+=1;return identify(t);},onTarget:t=>targets.push(t),now:()=>tick,setInterval:(fn,ms)=>{scheduled={fn,ms};return 17;},clearInterval:t=>cleared.push(t)});
  return {c,targets,cleared,get calls(){return calls;},get scheduled(){return scheduled;},setTracks:v=>{tracks=v;},setTime:v=>{tick=v;},poll:()=>scheduled.fn()};
}
async function main() {
  let h=setup(); equal(h.scheduled.ms,250); equal(h.c.getState().status,'WAITING_FOR_SINGLE_TRACK'); equal(h.calls,0);
  h.setTracks([track(4),track(5)]); h.poll(); equal(h.c.getState().lockedTrackUid,null);equal(h.c.getState().observedTrackCount,2);equal(h.calls,0);
  h.setTracks([track(4)]); h.poll();equal(h.c.getState().lockedTrackUid,4);equal(h.c.getState().busy,true);equal(h.calls,1);await flush();equal(h.c.getState().identity.cardId,decision().cardId);equal(h.c.getState().status,'TRACKING');equal(h.c.getState().busy,false);
  h.c.stop();equal(h.cleared,[17]);equal(h.targets.at(-1),null);equal(h.c.getState().active,false);equal(h.c.getState().identity,null);h.c.stop();equal(h.cleared,[17]);
  // Actual geometry remains owned by the detector; no pointer input exists.
  let resolve; h=setup([track(9,{cx:1,cy:2})],()=>new Promise(r=>{resolve=r;}));
  h.setTracks([track(9,{cx:30,cy:40})]);h.poll();h.poll();equal(h.calls,1,'No extra queue while matching');equal(h.targets.at(-1).cx,30);equal(h.c.getState().lockedTrackUid,9);
  resolve(decision());await flush();equal(h.c.getState().identity.cardId,decision().cardId,'Same UID motion does not invalidate native matching');h.c.stop();
  // A missing UID clears immediately and another card cannot inherit the trial.
  h=setup([track(12)]);await flush();h.setTracks([]);h.poll();equal(h.c.getState().status,'TRACK_LOST');equal(h.c.getState().identity,null);equal(h.targets.at(-1),null);equal(h.c.getState().lockedTrackUid,12);
  h.setTracks([track(13)]);h.poll();equal(h.c.getState().status,'TRACK_LOST');equal(h.c.getState().lockedTrackUid,12);equal(h.calls,1);
  h.setTracks([track(12)]);h.poll();await flush();equal(h.calls,2);equal(h.c.getState().status,'TRACKING');equal(h.c.getState().identity.cardId,decision().cardId);h.c.stop();
  // Missed tracks are not usable; malformed or ambiguous UIDs cannot lock.
  for(const input of [[track(1,{misses:1})],[track(NaN)],[track(-1)],[track(1.2)],[track('1')],[track(0)],[track(1),track(1)]]){h=setup(input);equal(h.c.getState().lockedTrackUid,null);equal(h.calls,0);h.c.stop();}
  // Losing and recovering the same UID while matching invalidates old work.
  h=setup([track(21)],()=>new Promise(r=>{resolve=r;}));h.setTracks([]);h.poll();h.setTracks([track(21)]);h.poll();equal(h.calls,1);resolve(decision());await flush();equal(h.c.getState().identity,null);h.poll();equal(h.calls,2);resolve(decision());await flush();equal(h.c.getState().identity.cardId,decision().cardId);h.c.stop();
  h=setup([track(22)],()=>new Promise(r=>{resolve=r;}));h.c.stop();resolve(decision());await flush();equal(h.c.getState().identity,null);equal(h.c.getState().active,false);equal(h.calls,1);
  // Completion rechecks live ownership even when no polling tick observed loss.
  h=setup([track(23)],()=>new Promise(r=>{resolve=r;}));h.setTracks([track(24)]);resolve(decision());await flush();equal(h.c.getState().identity,null);equal(h.c.getState().status,'TRACK_LOST');h.c.stop();
  h=setup([track(25)],()=>new Promise(r=>{resolve=r;}));h.setTracks([track(25),track(26)]);h.poll();equal(h.c.getState().status,'MULTIPLE_TRACKS');equal(h.c.getState().identity,null);resolve(decision());await flush();equal(h.c.getState().identity,null);h.c.stop();
  // A rejected or cancelled native decision does not borrow an earlier identity.
  let next=decision();h=setup([track(31)],()=>next);await flush();next=decision({accepted:false,decision:'REJECTED'});h.poll();await flush();equal(h.c.getState().identity,null);equal(h.c.getState().decisionAtMs,100);
  next=decision({accepted:true,decision:'HELD'});h.poll();await flush();equal(h.c.getState().identity.decision,'HELD','Only adapter-provided native held decisions survive');next=undefined;h.poll();await flush();equal(h.c.getState().identity,null);h.c.stop();
  h=setup([track(32)],()=>decision({trackUid:999}));await flush();equal(h.c.getState().identity,null);h.c.stop();
  h=setup([track(33)],()=>{throw Error('native rejected');});await flush();equal(h.c.getState().identity,null);equal(h.c.getState().busy,false);h.c.stop();
  h=setup([track(34)],()=>Promise.reject(Error('native failed')));await flush();equal(h.c.getState().identity,null);equal(h.c.getState().busy,false);h.c.stop();
  // State is a scalar whitelist and never exposes media, geometry or names.
  const original=decision({image:'data:image/png;base64,private',name:'private',deviceId:'private',cx:15,paths:['private']});h=setup([track(41,{image:'private'})],()=>original);await flush();const state=h.c.getState();
  equal(Object.keys(state).sort(),['active','lockedTrackUid','status','trackPresent','observedTrackCount','identity','decisionAtMs','busy','errors'].sort());
  equal(Object.keys(state.identity).sort(),['accepted','cardId','refId','printingId','candidatePrintingIds','recognitionMode','score','decision'].sort());equal(JSON.stringify(state).includes('private'),false);
  state.identity.candidatePrintingIds.push('poison');state.identity.cardId='poison';equal(h.c.getState().identity.cardId,decision().cardId);equal(h.c.getState().identity.candidatePrintingIds,['cpp-test']);equal(original.candidatePrintingIds,['cpp-test']);h.c.stop();
  for(const malformed of [decision({cardId:'C:\\private\\card'}),decision({refId:null}),decision({printingId:'private field'}),decision({candidatePrintingIds:['private field']}),decision({accepted:false,decision:'HELD'}),decision({decision:'synthetic-hold'})]){h=setup([track(42)],()=>malformed);await flush();equal(h.c.getState().identity,null);h.c.stop();}
  h=setup([track(50)],()=>decision({cardId:'cp-wild-in-the-streets'}));await flush();equal(h.c.getState().identity.cardId,'cp-wild-in-the-streets','Controller never substitutes an expected identity');h.c.stop();
  h=setup([track(51)],()=>decision({cardId:'cp.valid/card',refId:'ref.test:printing/one'}));await flush();equal(h.c.getState().identity.accepted,true);equal(h.c.getState().identity.cardId,'cp.valid/card');h.c.stop();
  h=setup([track(52)],()=>{throw Error('private message');});await flush();equal(h.c.getState().errors,['MATCHER_ERROR']);equal(h.c.getState().status,'MATCHER_ERROR');h.poll();equal(h.calls,1);h.c.getState().errors.push('poison');equal(h.c.getState().errors,['MATCHER_ERROR']);h.c.stop();
  h=setup([track(53)],()=>Promise.reject(Error('private rejection')));await flush();equal(h.c.getState().errors,['MATCHER_ERROR']);equal(h.c.getState().identity,null);equal(JSON.stringify(h.c.getState()).includes('private rejection'),false);h.c.stop();
  let clearedTrackTimer=false;const broken=api.create({getTracks:()=>{throw Error('private tracking message');},identify:()=>{throw Error('never');},setInterval:()=>19,clearInterval:()=>{clearedTrackTimer=true;}});equal(broken.getState().errors,['TRACKING_ERROR']);equal(broken.getState().status,'TRACKING_ERROR');equal(broken.getState().identity,null);broken.stop();equal(clearedTrackTimer,true);
  let deferredCalls=0;const deferred=api.create({deferFirstSample:true,getTracks:()=>[track(61)],identify:()=>{deferredCalls++;return decision();},setInterval:()=>61,clearInterval:()=>{}});equal(deferredCalls,0);equal(deferred.getState().lockedTrackUid,null);deferred.sample();await flush();equal(deferredCalls,1);equal(deferred.getState().identity.accepted,true);deferred.stop();
  // Browser loading exposes only the pure module and has no expected-card input.
  const vm=require('node:vm'),source=fs.readFileSync(path.join(root,'public/vision-qualification-track.js'),'utf8'),context={window:{}};vm.runInNewContext(source,context);equal(typeof context.window.TCGVisionQualificationTracking.create,'function');equal(source.includes('expectedCardId'),false);
  console.log('VISION_QUALIFICATION_TRACK_PASS '+assertions+' assertions; synthetic controller tests, no physical requalification');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
