
'use strict';

const REF_W=72;
const REF_H=108;

const NORMAL_ACCEPT=.235;
const NORMAL_MARGIN=.075;
const LOW_ACCEPT=.185;
const LOW_MARGIN=.135;

const COARSE_COLS=6;
const COARSE_ROWS=9;
const NORMAL_SHORTLIST=24;
const NORMAL_EXPANDED_SHORTLIST=44;
const MASK_SHORTLIST=18;
const MASK_NORMAL_BONUS=8;

let refs=[];

function clamp(v,lo,hi){ return Math.max(lo,Math.min(hi,v)); }
function mean(xs){
  if (!xs?.length) return 0;
  let s=0;
  for (let i=0;i<xs.length;i++) s+=xs[i];
  return s/xs.length;
}
function stddev(xs,m=mean(xs)){
  if (!xs?.length) return 0;
  let s=0;
  for (let i=0;i<xs.length;i++){ const d=xs[i]-m; s+=d*d; }
  return Math.sqrt(s/xs.length);
}
function normalizedCorrelation(a,b){
  if (!a||!b||a.length!==b.length||!a.length) return -1;
  const ma=mean(a),mb=mean(b);
  const sa=Math.max(1e-5,stddev(a,ma));
  const sb=Math.max(1e-5,stddev(b,mb));
  let acc=0;
  for(let i=0;i<a.length;i++) acc+=((a[i]-ma)/sa)*((b[i]-mb)/sb);
  return acc/a.length;
}

function drawCanonical(source,inset=.04,rotate180=false){
  const c=new OffscreenCanvas(REF_W,REF_H);
  const ctx=c.getContext('2d',{willReadFrequently:true,alpha:false});
  ctx.fillStyle='#777';
  ctx.fillRect(0,0,REF_W,REF_H);

  const sw=source.width||REF_W;
  const sh=source.height||REF_H;
  const sx=sw*inset,sy=sh*inset;
  const sww=Math.max(1,sw*(1-inset*2));
  const shh=Math.max(1,sh*(1-inset*2));

  if(rotate180){
    ctx.translate(REF_W/2,REF_H/2);
    ctx.rotate(Math.PI);
    ctx.translate(-REF_W/2,-REF_H/2);
  }
  ctx.drawImage(source,sx,sy,sww,shh,0,0,REF_W,REF_H);
  return c;
}
function buildGrayAndChroma(canvas){
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  const px=ctx.getImageData(0,0,REF_W,REF_H).data;
  const gray=new Float32Array(REF_W*REF_H);
  const chroma=new Float32Array(REF_W*REF_H*2);
  for(let p=0;p<REF_W*REF_H;p++){
    const i=p*4;
    const r=px[i]/255,g=px[i+1]/255,b=px[i+2]/255;
    const lum=.299*r+.587*g+.114*b;
    const sum=r+g+b+.15;
    gray[p]=lum;
    chroma[p*2]=(r-g)/sum;
    chroma[p*2+1]=(b-g)/sum;
  }
  return {gray,chroma};
}
function blurGray(src){
  const out=new Float32Array(src.length);
  for(let y=0;y<REF_H;y++){
    for(let x=0;x<REF_W;x++){
      let sum=0,n=0;
      for(let dy=-1;dy<=1;dy++){
        const yy=clamp(y+dy,0,REF_H-1);
        for(let dx=-1;dx<=1;dx++){
          const xx=clamp(x+dx,0,REF_W-1);
          sum+=src[yy*REF_W+xx];n++;
        }
      }
      out[y*REF_W+x]=sum/n;
    }
  }
  return out;
}
function gradientMagnitude(gray){
  const out=new Float32Array(gray.length);
  for(let y=1;y<REF_H-1;y++){
    for(let x=1;x<REF_W-1;x++){
      const i=y*REF_W+x;
      const gx=
        -gray[(y-1)*REF_W+x-1]+gray[(y-1)*REF_W+x+1]
        -2*gray[y*REF_W+x-1]+2*gray[y*REF_W+x+1]
        -gray[(y+1)*REF_W+x-1]+gray[(y+1)*REF_W+x+1];
      const gy=
        -gray[(y-1)*REF_W+x-1]-2*gray[(y-1)*REF_W+x]-gray[(y-1)*REF_W+x+1]
        +gray[(y+1)*REF_W+x-1]+2*gray[(y+1)*REF_W+x]+gray[(y+1)*REF_W+x+1];
      out[i]=Math.sqrt(gx*gx+gy*gy);
    }
  }
  return out;
}
function regionVector(arr,channels,x0,y0,x1,y1,step=1){
  const out=[];
  for(let y=y0;y<y1;y+=step){
    for(let x=x0;x<x1;x+=step){
      const base=(y*REF_W+x)*channels;
      for(let c=0;c<channels;c++) out.push(arr[base+c]);
    }
  }
  return out;
}
function patchCorrelations(aGray,bGray){
  const rows=6,cols=4,scores=[];
  for(let ry=0;ry<rows;ry++){
    const y0=Math.floor(ry*REF_H/rows);
    const y1=Math.floor((ry+1)*REF_H/rows);
    for(let cx=0;cx<cols;cx++){
      const x0=Math.floor(cx*REF_W/cols);
      const x1=Math.floor((cx+1)*REF_W/cols);
      const av=regionVector(aGray,1,x0,y0,x1,y1,1);
      const bv=regionVector(bGray,1,x0,y0,x1,y1,1);
      const corr=normalizedCorrelation(av,bv);
      if(Number.isFinite(corr)) scores.push(corr);
    }
  }
  scores.sort((a,b)=>b-a);
  const count=Math.max(1,Math.floor(scores.length*.60));
  return mean(scores.slice(0,count));
}
function chromaSimilarity(a,b){
  if(!a||!b||a.length!==b.length) return 0;
  let d=0,n=0;
  for(let p=0;p<REF_W*REF_H;p+=6){
    const i=p*2;
    d+=Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1]);
    n+=2;
  }
  return clamp(1-(d/Math.max(1,n))/.50,0,1);
}

function buildCoarseDescriptor(gray,gradient,chroma){
  const cells=[],lums=[];
  for(let row=0;row<COARSE_ROWS;row++){
    const y0=Math.floor(row*REF_H/COARSE_ROWS);
    const y1=Math.floor((row+1)*REF_H/COARSE_ROWS);
    for(let col=0;col<COARSE_COLS;col++){
      const x0=Math.floor(col*REF_W/COARSE_COLS);
      const x1=Math.floor((col+1)*REF_W/COARSE_COLS);
      let lum=0,edge=0,cr=0,cb=0,n=0;
      for(let y=y0;y<y1;y+=2){
        for(let x=x0;x<x1;x+=2){
          const idx=y*REF_W+x;
          lum+=gray[idx];edge+=gradient[idx];
          cr+=chroma[idx*2];cb+=chroma[idx*2+1];n++;
        }
      }
      n=Math.max(1,n);
      const c=[lum/n,edge/n,cr/n,cb/n];
      cells.push(c);lums.push(c[0]);
    }
  }
  const lm=mean(lums),ls=Math.max(.055,stddev(lums,lm));
  const out=[];
  for(const c of cells){
    out.push(
      clamp((c[0]-lm)/ls,-2.8,2.8)/2.8,
      clamp(c[1]*5,0,1),
      clamp(c[2],-.8,.8),
      clamp(c[3],-.8,.8)
    );
  }
  return out;
}
function descriptorFromBitmap(source,inset=.04,rotate180=false){
  const canonical=drawCanonical(source,inset,rotate180);
  const {gray,chroma}=buildGrayAndChroma(canonical);
  const blurred=blurGray(gray);
  const gradient=gradientMagnitude(gray);
  const ax0=Math.floor(REF_W*.05);
  const ax1=Math.floor(REF_W*.95);
  const ay0=Math.floor(REF_H*.08);
  const ay1=Math.floor(REF_H*.68);
  return {
    full:Array.from(blurred),
    art:regionVector(blurred,1,ax0,ay0,ax1,ay1,1),
    gradient:Array.from(gradient),
    chroma:Array.from(chroma),
    coarse:buildCoarseDescriptor(blurred,gradient,chroma)
  };
}
function compareDescriptors(obs,ref){
  const full=normalizedCorrelation(obs.full,ref.full);
  const art=normalizedCorrelation(obs.art,ref.art);
  const gradient=normalizedCorrelation(obs.gradient,ref.gradient);
  const patches=patchCorrelations(obs.full,ref.full);
  const color=chromaSimilarity(obs.chroma,ref.chroma);
  const total=.25*full+.35*art+.15*gradient+.20*patches+.05*color;
  return {total,full,art,gradient,patches,color};
}
function bestComparison(observations,ref){
  let best=null;
  for(const obs of observations){
    const parts=compareDescriptors(obs,ref);
    if(!best||parts.total>best.total) best=parts;
  }
  return best;
}
function coarseSimilarity(a,b){
  if(!a||!b||a.length!==b.length) return -1;
  let d=0;
  const cells=a.length/4;
  for(let i=0;i<a.length;i+=4){
    const dl=(a[i]-b[i])*.90;
    const de=(a[i+1]-b[i+1])*.48;
    const dr=(a[i+2]-b[i+2])*.62;
    const db=(a[i+3]-b[i+3])*.62;
    d+=dl*dl+de*de+dr*dr+db*db;
  }
  return Math.exp(-1.6*d/Math.max(1,cells));
}
function bestCoarseScore(observations,refDescriptor){
  let best=-1;
  for(const obs of observations){
    const score=coarseSimilarity(obs.coarse,refDescriptor.coarse);
    if(score>best) best=score;
  }
  return best;
}
function coarseRankReferences(observations,refsIn){
  return refsIn.map(ref=>({
    ref,
    coarseScore:bestCoarseScore(observations,ref.descriptor)
  })).sort((a,b)=>b.coarseScore-a.coarseScore);
}
function flipMask180(mask){
  const out=new Uint8Array(mask.length);
  const n=mask.length;
  for(let i=0;i<n;i++) out[n-1-i]=mask[i];
  return out;
}
function maskCellVisible(mask,row,col){
  const cx=Math.min(REF_W-1,Math.floor((col+.5)*REF_W/COARSE_COLS));
  const cy=Math.min(REF_H-1,Math.floor((row+.5)*REF_H/COARSE_ROWS));
  return Boolean(mask[cy*REF_W+cx]);
}
function maskedCoarseSimilarity(obs,ref,mask){
  if(!obs?.coarse||!ref?.coarse) return -1;
  let d=0,used=0;
  for(let row=0;row<COARSE_ROWS;row++){
    for(let col=0;col<COARSE_COLS;col++){
      if(!maskCellVisible(mask,row,col)) continue;
      const i=(row*COARSE_COLS+col)*4;
      const dl=(obs.coarse[i]-ref.coarse[i])*.90;
      const de=(obs.coarse[i+1]-ref.coarse[i+1])*.48;
      const dr=(obs.coarse[i+2]-ref.coarse[i+2])*.62;
      const db=(obs.coarse[i+3]-ref.coarse[i+3])*.62;
      d+=dl*dl+de*de+dr*dr+db*db;used++;
    }
  }
  if(used<8) return -1;
  return Math.exp(-1.6*d/used);
}
function maskedCoarseRank(observations,refsIn,maskInfo){
  return refsIn.map(ref=>{
    let best=-1;
    for(let i=0;i<observations.length;i++){
      const mask=(i%2)===1?flipMask180(maskInfo.mask):maskInfo.mask;
      const score=maskedCoarseSimilarity(observations[i],ref.descriptor,mask);
      if(score>best) best=score;
    }
    return {ref,coarseScore:best};
  }).sort((a,b)=>b.coarseScore-a.coarseScore);
}
function uniqueRefs(...groups){
  const seen=new Set(),out=[];
  for(const group of groups){
    for(const item of group){
      const ref=item.ref||item;
      const key=ref.image||ref.name;
      if(seen.has(key)) continue;
      seen.add(key);out.push(ref);
    }
  }
  return out;
}
function maskedCorrelation(obs,ref,mask,dx=0,dy=0){
  let n=0;
  let so=0,sr=0,soo=0,srr=0,sor=0;
  let sgo=0,sgr=0,sgoo=0,sgrr=0,sgor=0;
  let colorDiff=0,colorN=0;

  for(let y=2;y<REF_H-2;y+=2){
    const ry=y+dy;
    if(ry<1||ry>=REF_H-1) continue;
    for(let x=2;x<REF_W-2;x+=2){
      const idx=y*REF_W+x;
      if(!mask[idx]) continue;
      const rx=x+dx;
      if(rx<1||rx>=REF_W-1) continue;
      const ridx=ry*REF_W+rx;
      const o=obs.full[idx],r=ref.full[ridx];
      const go=obs.gradient[idx],gr=ref.gradient[ridx];

      so+=o;sr+=r;soo+=o*o;srr+=r*r;sor+=o*r;
      sgo+=go;sgr+=gr;sgoo+=go*go;sgrr+=gr*gr;sgor+=go*gr;

      const oi=idx*2,ri=ridx*2;
      colorDiff+=Math.abs(obs.chroma[oi]-ref.chroma[ri]);
      colorDiff+=Math.abs(obs.chroma[oi+1]-ref.chroma[ri+1]);
      colorN+=2;n++;
    }
  }
  if(n<115) return {score:0,gray:0,gradient:0,color:0,used:n};

  function corr(sumA,sumB,sumAA,sumBB,sumAB,count){
    const cov=sumAB-(sumA*sumB/count);
    const va=Math.max(1e-8,sumAA-(sumA*sumA/count));
    const vb=Math.max(1e-8,sumBB-(sumB*sumB/count));
    return clamp(cov/Math.sqrt(va*vb),-1,1);
  }
  const gray=(corr(so,sr,soo,srr,sor,n)+1)/2;
  const grad=(corr(sgo,sgr,sgoo,sgrr,sgor,n)+1)/2;
  const color=clamp(1-(colorDiff/Math.max(1,colorN))/.52,0,1);
  const score=.59*gray+.27*grad+.14*color;
  return {score,gray,gradient:grad,color,used:n};
}
function bestMaskedComparison(observations,ref,maskInfo){
  let best={score:0,gray:0,gradient:0,color:0,dx:0,dy:0,used:0,flipped:false};
  const shiftsX=[-4,-2,0,2,4];
  const shiftsY=[-6,-3,0,3,6];
  for(let vi=0;vi<observations.length;vi++){
    const obs=observations[vi];
    const flipped=(vi%2)===1;
    const mask=flipped?flipMask180(maskInfo.mask):maskInfo.mask;
    for(const dx of shiftsX){
      for(const dy of shiftsY){
        const r=maskedCorrelation(obs,ref,mask,dx,dy);
        if(r.score>best.score) best={...r,dx,dy,flipped};
      }
    }
  }
  return best;
}

function metaRef(ref){
  return {name:ref.name,type:ref.type||'',image:ref.image};
}
function packItem(item){
  if(!item) return null;
  return {
    ref:metaRef(item.ref),
    score:Number(item.score||0),
    parts:item.parts?{
      full:Number(item.parts.full||0),
      art:Number(item.parts.art||0),
      gradient:Number(item.parts.gradient||0),
      patches:Number(item.parts.patches||0),
      color:Number(item.parts.color||0),
      masked:Number(item.parts.masked||0)
    }:null,
    coarseScore:Number(item.coarseScore||0)
  };
}

function identify(bitmap,context){
  const timing={};
  const tStart=performance.now();

  const observations=[];
  for(const inset of [.02,.055,.095]){
    observations.push(
      descriptorFromBitmap(bitmap,inset,false),
      descriptorFromBitmap(bitmap,inset,true)
    );
  }
  timing.descriptorMs=performance.now()-tStart;

  const tCoarse=performance.now();
  const coarseRanked=coarseRankReferences(observations,refs);
  timing.coarseMs=performance.now()-tCoarse;

  const tNormal=performance.now();
  let normalPool=coarseRanked.slice(0,NORMAL_SHORTLIST);
  let normalRanked=normalPool.map(item=>{
    const parts=bestComparison(observations,item.ref.descriptor);
    return {ref:item.ref,score:parts.total,parts,coarseScore:item.coarseScore};
  }).sort((a,b)=>b.score-a.score);

  let ranked=normalRanked.slice(0,5);
  let best=ranked[0]||null;
  let second=ranked[1]||null;
  let margin=best?best.score-(second?.score||0):0;

  let accepted=Boolean(
    best&&(
      (best.score>=NORMAL_ACCEPT&&margin>=NORMAL_MARGIN)||
      (best.score>=LOW_ACCEPT&&margin>=LOW_MARGIN)
    )
  );

  if(!accepted&&!context?.overlapping){
    const already=new Set(normalPool.map(x=>x.ref.image||x.ref.name));
    const extra=coarseRanked.slice(NORMAL_SHORTLIST,NORMAL_EXPANDED_SHORTLIST)
      .filter(x=>!already.has(x.ref.image||x.ref.name));
    if(extra.length){
      const more=extra.map(item=>{
        const parts=bestComparison(observations,item.ref.descriptor);
        return {ref:item.ref,score:parts.total,parts,coarseScore:item.coarseScore};
      });
      normalRanked=[...normalRanked,...more].sort((a,b)=>b.score-a.score);
      ranked=normalRanked.slice(0,5);
      best=ranked[0]||null;
      second=ranked[1]||null;
      margin=best?best.score-(second?.score||0):0;
      accepted=Boolean(
        best&&(
          (best.score>=NORMAL_ACCEPT&&margin>=NORMAL_MARGIN)||
          (best.score>=LOW_ACCEPT&&margin>=LOW_MARGIN)
        )
      );
      normalPool=coarseRanked.slice(0,NORMAL_EXPANDED_SHORTLIST);
    }
  }
  timing.normalDetailMs=performance.now()-tNormal;

  let mode='normal';
  let maskDiagnostics=null;

  if(!accepted&&context?.maskInfo?.maskedBy>0&&context.maskInfo.visibleFraction>=.20){
    const tMaskCoarse=performance.now();
    const maskCoarse=maskedCoarseRank(observations,refs,context.maskInfo);
    const maskPool=uniqueRefs(
      maskCoarse.slice(0,MASK_SHORTLIST),
      coarseRanked.slice(0,MASK_NORMAL_BONUS)
    );
    timing.maskCoarseMs=performance.now()-tMaskCoarse;

    const tMaskDetail=performance.now();
    const maskRanked=maskPool.map(ref=>{
      const m=bestMaskedComparison(observations,ref.descriptor,context.maskInfo);
      return {
        ref,
        score:m.score,
        parts:{
          full:m.gray,art:0,gradient:m.gradient,
          patches:m.score,color:m.color,masked:m.score
        },
        masked:m
      };
    }).sort((a,b)=>b.score-a.score).slice(0,5);
    timing.maskDetailMs=performance.now()-tMaskDetail;

    const mb=maskRanked[0]||null;
    const ms=maskRanked[1]||null;
    const mm=mb?mb.score-(ms?.score||0):0;

    maskDiagnostics={
      visibleFraction:context.maskInfo.visibleFraction,
      maskedBy:context.maskInfo.maskedBy,
      maxOverlap:context.maskInfo.maxOverlap,
      bestScore:mb?.score||0,
      margin:mm,
      testedCandidates:maskPool.length,
      candidates:maskRanked.map(packItem)
    };

    if(mb&&mb.score>=.655&&mm>=.038){
      best=mb;second=ms;margin=mm;ranked=maskRanked;
      accepted=true;mode='masked';
    }else if(mb&&mm>margin+.035){
      best=mb;second=ms;margin=mm;ranked=maskRanked;
      mode='masked-uncertain';
    }
  }

  timing.totalMatcherMs=performance.now()-tStart;
  timing.workerComputeMs=timing.totalMatcherMs;
  timing.normalCandidatesTested=normalPool.length;
  timing.coarseLibrarySize=refs.length;
  timing.executionThread='worker';

  return {
    accepted,
    best:packItem(best),
    second:packItem(second),
    margin,
    ranked:ranked.slice(0,5).map(packItem),
    mode,
    overlap:context?.maxOverlap||0,
    normalCandidates:normalRanked.slice(0,5).map(packItem),
    maskDiagnostics,
    timing
  };
}

self.onmessage=(event)=>{
  const msg=event.data||{};
  if(msg.type==='init'){
    refs=Array.isArray(msg.refs)?msg.refs:[];
    self.postMessage({type:'ready',count:refs.length});
    return;
  }

  if(msg.type==='match'){
    const bitmap=msg.bitmap;
    try{
      const result=identify(bitmap,msg.context||{});
      bitmap?.close?.();
      self.postMessage({
        type:'match-result',
        requestId:msg.requestId,
        result
      });
    }catch(err){
      try{bitmap?.close?.();}catch{}
      self.postMessage({
        type:'match-error',
        requestId:msg.requestId,
        error:String(err?.stack||err?.message||err)
      });
    }
  }
};
