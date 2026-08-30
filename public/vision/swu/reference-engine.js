// Isolated extraction of TCGate Alpha's v5-fast descriptor pipeline.
// Matcher execution remains byte-for-byte in vendor/tcgate-identification-worker.js.
const REF_W=72, REF_H=108, COARSE_COLS=6, COARSE_ROWS=9, REF_BACKGROUND='#777';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mean=xs=>xs.reduce((a,b)=>a+b,0)/Math.max(1,xs.length);
function stddev(xs,m=mean(xs)){let s=0;for(const x of xs)s+=(x-m)**2;return Math.sqrt(s/Math.max(1,xs.length));}
function drawCanonical(source,inset=.04,rotate180=false){
  const c=new OffscreenCanvas(REF_W,REF_H),ctx=c.getContext('2d',{willReadFrequently:true,alpha:false});
  ctx.fillStyle=REF_BACKGROUND;ctx.fillRect(0,0,REF_W,REF_H);
  const sw=source.width||REF_W,sh=source.height||REF_H,sx=sw*inset,sy=sh*inset,sww=Math.max(1,sw*(1-inset*2)),shh=Math.max(1,sh*(1-inset*2));
  if(rotate180){ctx.translate(REF_W/2,REF_H/2);ctx.rotate(Math.PI);ctx.translate(-REF_W/2,-REF_H/2);}
  ctx.drawImage(source,sx,sy,sww,shh,0,0,REF_W,REF_H);return c;
}
function grayChroma(source){const px=source.getContext('2d',{willReadFrequently:true}).getImageData(0,0,REF_W,REF_H).data,gray=new Float32Array(REF_W*REF_H),chroma=new Float32Array(REF_W*REF_H*2);for(let p=0;p<gray.length;p++){const i=p*4,r=px[i]/255,g=px[i+1]/255,b=px[i+2]/255,lum=.299*r+.587*g+.114*b,sum=r+g+b+.15;gray[p]=lum;chroma[p*2]=(r-g)/sum;chroma[p*2+1]=(b-g)/sum;}return{gray,chroma};}
function blur(src){const out=new Float32Array(src.length);for(let y=0;y<REF_H;y++)for(let x=0;x<REF_W;x++){let sum=0,n=0;for(let dy=-1;dy<=1;dy++){const yy=clamp(y+dy,0,REF_H-1);for(let dx=-1;dx<=1;dx++){sum+=src[yy*REF_W+clamp(x+dx,0,REF_W-1)];n++;}}out[y*REF_W+x]=sum/n;}return out;}
function gradient(gray){const out=new Float32Array(gray.length);for(let y=1;y<REF_H-1;y++)for(let x=1;x<REF_W-1;x++){const i=y*REF_W+x,gx=-gray[(y-1)*REF_W+x-1]+gray[(y-1)*REF_W+x+1]-2*gray[y*REF_W+x-1]+2*gray[y*REF_W+x+1]-gray[(y+1)*REF_W+x-1]+gray[(y+1)*REF_W+x+1],gy=-gray[(y-1)*REF_W+x-1]-2*gray[(y-1)*REF_W+x]-gray[(y-1)*REF_W+x+1]+gray[(y+1)*REF_W+x-1]+2*gray[(y+1)*REF_W+x]+gray[(y+1)*REF_W+x+1];out[i]=Math.sqrt(gx*gx+gy*gy);}return out;}
function region(arr,ch,x0,y0,x1,y1,step=1){const out=[];for(let y=y0;y<y1;y+=step)for(let x=x0;x<x1;x+=step){const b=(y*REF_W+x)*ch;for(let c=0;c<ch;c++)out.push(arr[b+c]);}return out;}
function coarse(gray,grad,chroma){const cells=[],lums=[];for(let row=0;row<COARSE_ROWS;row++){const y0=Math.floor(row*REF_H/COARSE_ROWS),y1=Math.floor((row+1)*REF_H/COARSE_ROWS);for(let col=0;col<COARSE_COLS;col++){const x0=Math.floor(col*REF_W/COARSE_COLS),x1=Math.floor((col+1)*REF_W/COARSE_COLS);let lum=0,edge=0,cr=0,cb=0,n=0;for(let y=y0;y<y1;y+=2)for(let x=x0;x<x1;x+=2){const i=y*REF_W+x;lum+=gray[i];edge+=grad[i];cr+=chroma[i*2];cb+=chroma[i*2+1];n++;}const c=[lum/n,edge/n,cr/n,cb/n];cells.push(c);lums.push(c[0]);}}const lm=mean(lums),ls=Math.max(.055,stddev(lums,lm)),out=[];for(const c of cells)out.push(clamp((c[0]-lm)/ls,-2.8,2.8)/2.8,clamp(c[1]*5,0,1),clamp(c[2],-.8,.8),clamp(c[3],-.8,.8));return out;}
export function descriptorFromBitmap(bitmap,inset=.04){const {gray,chroma}=grayChroma(drawCanonical(bitmap,inset,false)),blurred=blur(gray),grad=gradient(gray);return{full:Array.from(blurred),art:region(blurred,1,Math.floor(REF_W*.05),Math.floor(REF_H*.08),Math.floor(REF_W*.95),Math.floor(REF_H*.68)),gradient:Array.from(grad),chroma:Array.from(chroma),coarse:coarse(blurred,grad,chroma)};}
export function coarseDescriptorFromBitmap(bitmap,inset=.04,rotate180=false){const {gray,chroma}=grayChroma(drawCanonical(bitmap,inset,rotate180)),blurred=blur(gray),grad=gradient(gray);return coarse(blurred,grad,chroma);}
export function coarseObservationSetFromBitmap(bitmap){const out=[];for(const inset of [.02,.055,.095]){out.push(coarseDescriptorFromBitmap(bitmap,inset,false),coarseDescriptorFromBitmap(bitmap,inset,true));}return out;}
export function coarseSimilarity(a,b){if(!a||!b||a.length!==b.length)return -1;let d=0;const cells=a.length/4;for(let i=0;i<a.length;i+=4){const dl=(a[i]-b[i])*.90,de=(a[i+1]-b[i+1])*.48,dr=(a[i+2]-b[i+2])*.62,db=(a[i+3]-b[i+3])*.62;d+=dl*dl+de*de+dr*dr+db*db;}return Math.exp(-1.6*d/Math.max(1,cells));}
function coarseSimilarityAt(a,values,offset,dimension){if(!a||a.length!==dimension)return -1;let d=0;const cells=dimension/4;for(let i=0;i<dimension;i+=4){const dl=(a[i]-values[offset+i])*.90,de=(a[i+1]-values[offset+i+1])*.48,dr=(a[i+2]-values[offset+i+2])*.62,db=(a[i+3]-values[offset+i+3])*.62;d+=dl*dl+de*de+dr*dr+db*db;}return Math.exp(-1.6*d/Math.max(1,cells));}
export function rankCoarseIndex(observations,values,references,dimension=216){if(!Array.isArray(observations)||!observations.length)throw new Error('Missing coarse observations');if(!(values instanceof Float32Array))throw new Error('Coarse index must be Float32Array');if(!Array.isArray(references)||values.length!==references.length*dimension)throw new Error('Coarse index cardinality mismatch');const ranked=new Array(references.length);for(let row=0;row<references.length;row++){let best=-1,offset=row*dimension;for(const obs of observations){const score=coarseSimilarityAt(obs,values,offset,dimension);if(score>best)best=score;}ranked[row]={ref:references[row],coarseScore:best,coarseRank:0};}ranked.sort((a,b)=>(b.coarseScore-a.coarseScore)||(a.ref.index-b.ref.index));for(let i=0;i<ranked.length;i++)ranked[i].coarseRank=i+1;return ranked;}
function coarseSimilarityAtRows(a,values,offset,dimension,rowStart=1,rowEnd=6){if(!a||a.length!==dimension)return -1;const cols=COARSE_COLS,channels=4,totalRows=dimension/(cols*channels);const start=clamp(Math.floor(rowStart),0,totalRows),end=clamp(Math.ceil(rowEnd),start,totalRows);let d=0,used=0;for(let row=start;row<end;row++)for(let col=0;col<cols;col++){const i=(row*cols+col)*channels;const dl=(a[i]-values[offset+i])*.90,de=(a[i+1]-values[offset+i+1])*.48,dr=(a[i+2]-values[offset+i+2])*.62,db=(a[i+3]-values[offset+i+3])*.62;d+=dl*dl+de*de+dr*dr+db*db;used++;}return used?Math.exp(-1.6*d/used):-1;}
export function rankCoarseIndexRows(observations,values,references,dimension=216,{rowStart=1,rowEnd=6}={}){if(!Array.isArray(observations)||!observations.length)throw new Error('Missing coarse observations');if(!(values instanceof Float32Array))throw new Error('Coarse index must be Float32Array');if(!Array.isArray(references)||values.length!==references.length*dimension)throw new Error('Coarse index cardinality mismatch');const ranked=new Array(references.length);for(let row=0;row<references.length;row++){let best=-1,offset=row*dimension;for(const obs of observations){const score=coarseSimilarityAtRows(obs,values,offset,dimension,rowStart,rowEnd);if(score>best)best=score;}ranked[row]={ref:references[row],coarseScore:best,coarseRank:0};}ranked.sort((a,b)=>(b.coarseScore-a.coarseScore)||(a.ref.index-b.ref.index));for(let i=0;i<ranked.length;i++)ranked[i].coarseRank=i+1;return ranked;}
export const PROFILE=Object.freeze({id:'cyberpunk-v5-fast-72x108',refWidth:REF_W,refHeight:REF_H,referenceBackground:REF_BACKGROUND,normalAccept:.235,normalMargin:.075,lowAccept:.185,lowMargin:.135,shortlist:24,expandedShortlist:44});

export class ReferenceEngine {
  constructor(){this.worker=null;this.pending=new Map();this.seq=0;this.metrics={librarySize:0,sourceReferences:0,failedReferences:[],descriptorBuildMs:0};}
  async build(references,assetUrl,onProgress=()=>{},meta=ref=>({name:ref.name,type:ref.cardId,image:ref.cardId})){
    const start=performance.now(),refs=[],failedReferences=[];let done=0;
    for(const ref of references){
      const assetPath=ref.visionAssetPath||ref.referenceImageUrl,asset=assetUrl(assetPath);
      try{
        const response=await fetch(asset);
        if(!response.ok)throw new Error(`HTTP ${response.status}`);
        const bitmap=await createImageBitmap(await response.blob());
        refs.push({...meta(ref),descriptor:descriptorFromBitmap(bitmap)});
        bitmap.close();
      }catch(error){
        const failure={cardId:ref.cardId||null,name:ref.name||null,assetPath,assetUrl:asset,error:error?.message||String(error)};
        failedReferences.push(failure);
        console.warn('Vision Lab reference skipped',failure);
      }finally{
        done++;onProgress(done,references.length);
      }
    }
    if(!refs.length)throw new Error('No usable reference assets');
    this.metrics={librarySize:refs.length,sourceReferences:references.length,failedReferences,descriptorBuildMs:performance.now()-start};
    await this.init(refs);this.refs=refs;return this.metrics;
  }
  async restore(refs){const start=performance.now();await this.init(refs);this.refs=refs;this.metrics={librarySize:refs.length,sourceReferences:refs.length,failedReferences:[],descriptorBuildMs:0,restoreMs:performance.now()-start};return this.metrics;}
  async init(refs){this.worker?.terminate();this.worker=new Worker('/identification-worker.js');await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Worker init timeout')),12000);this.worker.onmessage=e=>{if(e.data.type==='ready'){clearTimeout(timer);resolve();return;}const task=this.pending.get(e.data.requestId);if(task){this.pending.delete(e.data.requestId);e.data.type==='match-result'?task.resolve(e.data.result):task.reject(new Error(e.data.error));}};this.worker.onerror=reject;this.worker.postMessage({type:'init',refs});});}
  match(bitmap,context={}){const requestId=++this.seq;return new Promise((resolve,reject)=>{this.pending.set(requestId,{resolve,reject});this.worker.postMessage({type:'match',requestId,bitmap,context},[bitmap]);});}
  stop(){this.worker?.terminate();this.worker=null;}
}
