'use strict';

const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const {performance}=require('perf_hooks');

const workerSource=fs.readFileSync('./public/identification-worker.js','utf8');
const sandbox={self:{postMessage(){}},performance,OffscreenCanvas:function(){}};
vm.createContext(sandbox);
vm.runInContext(`${workerSource}\nself.__bench={coarseRankReferences,bestComparison};`,sandbox);
const matcher=sandbox.self.__bench;

function values(length,seed){const out=new Float32Array(length);let value=seed|0;for(let i=0;i<length;i+=1){value=(value*1664525+1013904223)|0;out[i]=((value>>>8)&65535)/65535;}return out;}
function descriptor(seed){return{full:values(72*108,seed),art:values(64*65,seed+1),gradient:values(72*108,seed+2),chroma:values(72*108*2,seed+3),coarse:values(6*9*4,seed+4)};}
function percentile(values,p){const sorted=values.slice().sort((a,b)=>a-b);return sorted[Math.ceil(sorted.length*p)-1]||0;}
function matchOnce(refs,observations){const ranked=matcher.coarseRankReferences(observations,refs);for(const item of ranked.slice(0,24))matcher.bestComparison(observations,item.ref.descriptor);}
function bench(count){
  const initSamples=[];let refs;
  for(let run=0;run<7;run+=1){global.gc?.();const initStarted=performance.now();refs=Array.from({length:count},(_,index)=>({name:`ref-${index}`,image:`ref-${index}`,descriptor:descriptor(index+17)}));if(run>1)initSamples.push(performance.now()-initStarted);}
  const initMs=percentile(initSamples,.5);
  const observations=Array.from({length:6},()=>descriptor(73));
  const samples=[];
  for(let run=0;run<8;run+=1)matchOnce(refs,observations);
  for(let run=0;run<24;run+=1){const started=performance.now();matchOnce(refs,observations);samples.push(performance.now()-started);}
  const descriptorBytes=refs.reduce((total,ref)=>total+Object.values(ref.descriptor).reduce((sum,array)=>sum+array.byteLength,0),0);
  return{references:count,syntheticDescriptorInitializationMs:Number(initMs.toFixed(2)),descriptorMemoryMiB:Number((descriptorBytes/1048576).toFixed(2)),identificationAverageMs:Number((samples.reduce((a,b)=>a+b,0)/samples.length).toFixed(2)),identificationP95Ms:Number(percentile(samples,.95).toFixed(2)),samples:samples.length};
}

matchOnce(Array.from({length:30},(_,index)=>({name:`warm-${index}`,image:`warm-${index}`,descriptor:descriptor(index+1)})),Array.from({length:6},()=>descriptor(7)));
const baseline=bench(150),beta=bench(229);
assert(beta.references===229&&baseline.references===150);
const change={syntheticDescriptorInitializationPercent:Number(((beta.syntheticDescriptorInitializationMs/baseline.syntheticDescriptorInitializationMs-1)*100).toFixed(1)),descriptorMemoryPercent:Number(((beta.descriptorMemoryMiB/baseline.descriptorMemoryMiB-1)*100).toFixed(1)),identificationAveragePercent:Number(((beta.identificationAverageMs/baseline.identificationAverageMs-1)*100).toFixed(1)),identificationP95Percent:Number(((beta.identificationP95Ms/baseline.identificationP95Ms-1)*100).toFixed(1))};
console.log('CYBERPUNK_DB_MATCHER_PERFORMANCE_OK');
console.log(JSON.stringify({baselineCandidate:baseline,betaRuntime:beta,change},null,2));
