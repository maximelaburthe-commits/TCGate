'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { LatestFrameGate } = require('./public/vision-frame-gate.js');

const root = __dirname;
const read = file => fs.readFileSync(path.join(root,file),'utf8');

async function overloadSimulation(){
  const gate=new LatestFrameGate();
  const processed=[];
  let active=null;

  for(let frame=1;frame<=100;frame+=1){
    if(active && frame%14===1){
      gate.complete(active,frame);
      active=null;
    }
    const token=gate.tryAcquire({frame},frame);
    if(token){
      processed.push(frame);
      active=token;
    }
  }
  if(active) gate.complete(active,101);

  const snapshot=gate.snapshot();
  assert(snapshot.maxQueueDepth<=1,'Vision queue depth must never exceed one');
  assert(snapshot.dropped>0,'overload must drop analysis frames');
  assert(processed.length<20,'slow Vision must not process the complete FIFO');
  assert(processed.some((frame,index)=>index>0 && frame-processed[index-1]>1),'old frames must be skipped');
  assert.strictEqual(snapshot.requested,100);
  assert.strictEqual(snapshot.processed,processed.length);
  assert.strictEqual(snapshot.inFlight,0);

  const staleGate=new LatestFrameGate();
  const stale=staleGate.tryAcquire({frame:'stale'});
  assert(staleGate.cancel(stale));
  const current=staleGate.tryAcquire({frame:'current'});
  assert.strictEqual(staleGate.complete(stale),false,'stale completion must not release current work');
  assert.strictEqual(staleGate.snapshot().inFlight,1);
  assert(staleGate.complete(current));
  return {processed,snapshot};
}

async function main(){
  const result=await overloadSimulation();
  const core=read('public/vision-core.js');
  const identification=read('public/identification.js');
  const app=read('public/app.js');

  assert(core.includes('state.frameGate.tryAcquire'),'detector must use explicit frame admission');
  assert(core.includes('videoFrameMeterGeneration'),'video-frame meters must be generation-bound');
  assert(!identification.includes("canvas.toDataURL('image/jpeg',.94)"),'hot path must not synchronously encode JPEG');
  assert(identification.includes("canvas.toBlob(blob=>"),'diagnostic crop encoding must be asynchronous');
  assert(app.includes("'/vision-frame-gate.js'"),'frame gate must load before Vision core');

  console.log('vision backpressure simulation: OK');
  console.log(JSON.stringify({
    requested:result.snapshot.requested,
    processed:result.snapshot.processed,
    dropped:result.snapshot.dropped,
    maxQueueDepth:result.snapshot.maxQueueDepth,
    sample:result.processed.slice(0,12)
  }));
}

main().catch(err=>{
  console.error(err);
  process.exitCode=1;
});
