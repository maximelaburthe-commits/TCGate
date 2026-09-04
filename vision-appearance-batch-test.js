'use strict';

const assert=require('assert');
const fs=require('fs');
const {performance}=require('perf_hooks');
const {descriptor,batch}=require('./public/vision-appearance-sampler.js');

const W=640,H=360;
const pixels=new Uint8ClampedArray(W*H*4);
for(let y=0;y<H;y+=1) for(let x=0;x<W;x+=1){
  const i=(y*W+x)*4;
  pixels[i]=(x*3+y)%256; pixels[i+1]=(x+y*2)%256;
  pixels[i+2]=(x*5+y*7)%256; pixels[i+3]=255;
}
const frame={data:pixels,width:W,height:H,sourceW:1920,sourceH:1080};
const detections=Array.from({length:10},(_,i)=>({
  cx:300+(i%5)*300,cy:220+Math.floor(i/5)*500,
  w:180+(i%3)*24,h:300+(i%4)*30,angle:(i-4)*.13
}));

function cosine(a,b,flip=false){
  let dot=0,aa=0,bb=0;const n=a.length/3;
  for(let p=0;p<n;p+=1){const q=flip?n-1-p:p;for(let c=0;c<3;c+=1){const av=a[p*3+c],bv=b[q*3+c];dot+=av*bv;aa+=av*av;bb+=bv*bv;}}
  return (Math.max(-1,Math.min(1,dot/Math.sqrt(aa*bb)))+1)/2;
}

for(const det of detections){
  const single=descriptor(det,frame);
  const fromBatch=batch([det],frame)[0];
  assert(single instanceof Float32Array && single.length===480);
  assert(cosine(single,fromBatch)>.999999,'batch and single descriptor must be equivalent');
  const rotated=descriptor({...det,angle:det.angle+Math.PI},frame);
  assert(cosine(single,rotated,true)>.995,'180-degree descriptor must remain flip-compatible');
}

function percentile(values,p){const xs=values.slice().sort((a,b)=>a-b);return xs[Math.ceil(xs.length*p)-1]||0;}
function bench(count,legacy){
  const samples=[];
  for(let warm=0;warm<10;warm+=1) batch(detections.slice(0,count),frame);
  for(let run=0;run<80;run+=1){
    const started=performance.now();
    if(legacy){
      for(const det of detections.slice(0,count)) descriptor(det,{...frame,data:pixels.slice()});
    }else batch(detections.slice(0,count),frame);
    samples.push(performance.now()-started);
  }
  return {p50:Number(percentile(samples,.5).toFixed(3)),p95:Number(percentile(samples,.95).toFixed(3))};
}

const results={};
for(const count of [1,2,4,6,10]) results[count]={legacyReadbackEmulation:bench(count,true),batch:bench(count,false)};

const core=fs.readFileSync(require.resolve('./public/vision-core.js'),'utf8');
const attach=core.slice(core.indexOf('function attachAppearance'),core.indexOf('function stripAppearance'));
assert.strictEqual((attach.match(/getImageData\(/g)||[]).length,1,'one pixel readback per appearance batch');
assert(attach.includes('batchAppearanceDescriptors'),'appearance descriptors must use shared pixels');

console.log('VISION_APPEARANCE_BATCH_OK readbacksForSix=1 descriptorSimilarity>=0.999999 flip180>=0.995');
console.log(JSON.stringify(results));
