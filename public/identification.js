
'use strict';

(() => {
  const lab = window.TCGDetectionLab;
  if (!lab) return;

  const REMOTE_DB = 'https://raw.githubusercontent.com/maximelaburthe-commits/cyberpunk_cards/main/cards.json';
  const REMOTE_IMAGE_BASE = 'https://raw.githubusercontent.com/maximelaburthe-commits/cyberpunk_cards/main/images/';
  const FALLBACK_DB = '/cards-fallback.json';

  // New cache key is intentional: alpha1/2 descriptors are incompatible.
  const CACHE_KEY = 'tcg-cyberpunk-ident-cache-template-v5-fast';

  // Reference resolution. Low enough for 120-card comparisons to remain immediate,
  // high enough to keep illustration structure and text/layout edges.
  const REF_W = 72;
  const REF_H = 108;

  // Acceptance is based on both absolute visual evidence and separation from #2.
  // These are matcher indices, NOT calibrated probabilities.
  const NORMAL_ACCEPT = 0.235;
  const NORMAL_MARGIN = 0.075;
  const LOW_ACCEPT = 0.185;
  const LOW_MARGIN = 0.135;

  // V0.6.2 — temporal identity stability.
  // First acquisition stays immediate. Once an identity is stable, a different
  // card must repeat before it is allowed to replace the current HD card.
  const IDENTITY_SWITCH_CONFIRMATIONS = 2;
  const IDENTITY_SWITCH_CONFIRMATIONS_GLARE = 3;
  const IDENTITY_SWITCH_WINDOW_MS = 1250;
  const IDENTITY_TRANSIENT_HOLD_MS = 1600;
  const IDENTITY_RECHECK_MS = 260;

  const $ = (id) => document.getElementById(id);
  const ui = {
    toggle: $('identificationToggle'),
    status: $('identLibraryStatus'),
    matcherStatus: $('identMatcherStatus'),
    refresh: $('identRefreshButton'),
    empty: $('identEmpty'),
    result: $('identResult'),
    image: $('identImage'),
    name: $('identName'),
    type: $('identType'),
    score: $('identScore'),
    margin: $('identMargin'),
    candidates: $('identCandidates')
  };

  const state = {
    loading: false,
    ready: false,
    cards: [],
    refs: [],
    lastTrackUid: null,
    lastIdentifiedAt: 0,
    hoverTimer: null,
    generation: 0,
    pointer: null,
    pointerInsideStage: false,
    hoveredTrack: null,
    lastResult: null,
    hoverGeneration: 0,
    lastAnalyzedCropDataUrl: null,
    lastAnalyzedTrackUid: null,
    lastMatcherMs: null,
    lastMatcherTiming: null,
    matcherWorker: null,
    matcherWorkerReady: false,
    matcherWorkerInitMs: null,
    matcherWorkerError: null,
    matcherWorkerBusy: false,
    matcherWorkerCurrent: null,
    matcherWorkerQueued: null,
    matcherWorkerSeq: 0,
    hoverCache: new Map(),
    hoverCacheHits: 0,
    hoverCacheMisses: 0,
    hoverCacheRejects: {
      absent: 0,
      expired: 0,
      geometry: 0,
      appearance: 0
    },
    qualityGuard: {
      moderate: 0,
      high: 0,
      rejected: 0,
      tightened: 0,
      last: null
    },
    identityStability: {
      tracks: new Map(),
      switchesSuppressed: 0,
      switchesConfirmed: 0,
      transientHolds: 0,
      holdsExpired: 0,
      rechecks: 0,
      stableRefreshes: 0,
      last: null
    },
    temporalRecheckTimer: null,
    pointerMissHeatmap: [0,0,0,0,0,0,0,0,0],
    pointerHitHeatmap: [0,0,0,0,0,0,0,0,0],
    lastPointerDiagnosticAt: 0
  };

  function imageUrl(card) {
    return REMOTE_IMAGE_BASE + encodeURIComponent(card.image).replace(/%2F/g, '/');
  }

  function setLibraryStatus(text) {
    if (ui.status) ui.status.textContent = text;
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function mean(xs) {
    return xs?.length ? xs.reduce((a,b) => a+b, 0) / xs.length : 0;
  }

  function stddev(xs, m = mean(xs)) {
    if (!xs?.length) return 0;
    return Math.sqrt(mean(xs.map(v => (v-m)*(v-m))));
  }

  function normalizedCorrelation(a, b) {
    if (!a || !b || a.length !== b.length || !a.length) return -1;
    const ma = mean(a), mb = mean(b);
    const sa = Math.max(1e-5, stddev(a, ma));
    const sb = Math.max(1e-5, stddev(b, mb));
    let acc = 0;
    for (let i=0;i<a.length;i++) {
      acc += ((a[i]-ma)/sa) * ((b[i]-mb)/sb);
    }
    return acc / a.length;
  }

  function drawCanonical(source, inset = 0.04, rotate180 = false) {
    const c = document.createElement('canvas');
    c.width = REF_W;
    c.height = REF_H;
    const ctx = c.getContext('2d', { willReadFrequently:true, alpha:false });

    ctx.fillStyle = '#777';
    ctx.fillRect(0,0,REF_W,REF_H);

    const sw = source.width || source.videoWidth || REF_W;
    const sh = source.height || source.videoHeight || REF_H;
    const sx = sw * inset;
    const sy = sh * inset;
    const sww = Math.max(1, sw * (1 - inset*2));
    const shh = Math.max(1, sh * (1 - inset*2));

    if (rotate180) {
      ctx.translate(REF_W/2, REF_H/2);
      ctx.rotate(Math.PI);
      ctx.translate(-REF_W/2, -REF_H/2);
    }
    ctx.drawImage(source, sx, sy, sww, shh, 0, 0, REF_W, REF_H);
    return c;
  }

  function rawRgb(canvas) {
    const ctx = canvas.getContext('2d', { willReadFrequently:true });
    return ctx.getImageData(0,0,REF_W,REF_H).data;
  }

  function buildGrayAndChroma(canvas) {
    const px = rawRgb(canvas);
    const gray = new Float32Array(REF_W * REF_H);
    const chroma = new Float32Array(REF_W * REF_H * 2);

    for (let p=0;p<REF_W*REF_H;p++) {
      const i=p*4;
      const r=px[i]/255, g=px[i+1]/255, b=px[i+2]/255;
      const lum=.299*r+.587*g+.114*b;
      const sum=r+g+b+.15;
      gray[p]=lum;
      chroma[p*2]=(r-g)/sum;
      chroma[p*2+1]=(b-g)/sum;
    }
    return { gray, chroma };
  }

  function blurGray(src) {
    const out = new Float32Array(src.length);
    // Lightweight 3x3 blur. Border is copied from nearest valid coordinate.
    for (let y=0;y<REF_H;y++) {
      for (let x=0;x<REF_W;x++) {
        let sum=0, n=0;
        for (let dy=-1;dy<=1;dy++) {
          const yy=clamp(y+dy,0,REF_H-1);
          for (let dx=-1;dx<=1;dx++) {
            const xx=clamp(x+dx,0,REF_W-1);
            sum += src[yy*REF_W+xx]; n++;
          }
        }
        out[y*REF_W+x]=sum/n;
      }
    }
    return out;
  }

  function gradientMagnitude(gray) {
    const out=new Float32Array(gray.length);
    for (let y=1;y<REF_H-1;y++) {
      for (let x=1;x<REF_W-1;x++) {
        const i=y*REF_W+x;
        const gx =
          -gray[(y-1)*REF_W+x-1] + gray[(y-1)*REF_W+x+1]
          -2*gray[y*REF_W+x-1] + 2*gray[y*REF_W+x+1]
          -gray[(y+1)*REF_W+x-1] + gray[(y+1)*REF_W+x+1];
        const gy =
          -gray[(y-1)*REF_W+x-1] -2*gray[(y-1)*REF_W+x] -gray[(y-1)*REF_W+x+1]
          +gray[(y+1)*REF_W+x-1] +2*gray[(y+1)*REF_W+x] +gray[(y+1)*REF_W+x+1];
        out[i]=Math.sqrt(gx*gx+gy*gy);
      }
    }
    return out;
  }

  function regionVector(arr, channels, x0, y0, x1, y1, step = 1) {
    const out=[];
    for (let y=y0;y<y1;y+=step) {
      for (let x=x0;x<x1;x+=step) {
        const base=(y*REF_W+x)*channels;
        for (let c=0;c<channels;c++) out.push(arr[base+c]);
      }
    }
    return out;
  }

  function patchCorrelations(aGray, bGray) {
    const rows=6, cols=4;
    const scores=[];
    for (let ry=0;ry<rows;ry++) {
      const y0=Math.floor(ry*REF_H/rows);
      const y1=Math.floor((ry+1)*REF_H/rows);
      for (let cx=0;cx<cols;cx++) {
        const x0=Math.floor(cx*REF_W/cols);
        const x1=Math.floor((cx+1)*REF_W/cols);
        const av=regionVector(aGray,1,x0,y0,x1,y1,1);
        const bv=regionVector(bGray,1,x0,y0,x1,y1,1);
        const corr=normalizedCorrelation(av,bv);
        if (Number.isFinite(corr)) scores.push(corr);
      }
    }
    scores.sort((a,b)=>b-a);
    // Keep 60% strongest matching patches: gives some tolerance to an occluding hand/card,
    // but far less than alpha1/2's coarse color-grid method.
    const count=Math.max(1,Math.floor(scores.length*.60));
    return mean(scores.slice(0,count));
  }

  function chromaSimilarity(a, b) {
    if (!a || !b || a.length!==b.length) return 0;
    // Downsample by sampling one in 6 pixels; chroma is secondary evidence.
    let d=0, n=0;
    for (let p=0;p<REF_W*REF_H;p+=6) {
      const i=p*2;
      d += Math.abs(a[i]-b[i]) + Math.abs(a[i+1]-b[i+1]);
      n += 2;
    }
    const mad=d/Math.max(1,n);
    return clamp(1 - mad/.50, 0, 1);
  }


  const LOCAL_COLS = 6;
  const LOCAL_ROWS = 9;

  function localPatchSignature(gray, gradient, chroma, col, row) {
    const x0=Math.floor(col*REF_W/LOCAL_COLS);
    const x1=Math.floor((col+1)*REF_W/LOCAL_COLS);
    const y0=Math.floor(row*REF_H/LOCAL_ROWS);
    const y1=Math.floor((row+1)*REF_H/LOCAL_ROWS);
    const sig=[];

    // 4x4 local luminance pattern, normalized inside the patch.
    const lum=[];
    for (let sy=0;sy<4;sy++) {
      for (let sx=0;sx<4;sx++) {
        const px=Math.min(REF_W-1,Math.floor(x0+(sx+.5)*(x1-x0)/4));
        const py=Math.min(REF_H-1,Math.floor(y0+(sy+.5)*(y1-y0)/4));
        lum.push(gray[py*REF_W+px]);
      }
    }
    const lm=mean(lum), ls=Math.max(.035,stddev(lum,lm));
    for (const v of lum) sig.push(clamp((v-lm)/ls,-2.5,2.5)/2.5);

    let gm=0, gr=0, gb=0, n=0;
    for (let y=y0;y<y1;y+=2) {
      for (let x=x0;x<x1;x+=2) {
        const idx=y*REF_W+x;
        gm += gradient[idx];
        gr += chroma[idx*2];
        gb += chroma[idx*2+1];
        n++;
      }
    }
    n=Math.max(1,n);
    sig.push(clamp((gm/n)*5,0,1));
    sig.push(clamp((gr/n),-.8,.8));
    sig.push(clamp((gb/n),-.8,.8));
    return sig;
  }

  function buildLocalPatches(gray, gradient, chroma) {
    const out=[];
    for (let row=0;row<LOCAL_ROWS;row++) {
      for (let col=0;col<LOCAL_COLS;col++) {
        out.push({
          col,row,
          sig:localPatchSignature(gray,gradient,chroma,col,row)
        });
      }
    }
    return out;
  }

  function patchSignatureSimilarity(a,b) {
    if (!a || !b || a.length!==b.length) return 0;
    const lumA=a.slice(0,16), lumB=b.slice(0,16);
    const corr=normalizedCorrelation(lumA,lumB);
    const edge=1-Math.min(1,Math.abs(a[16]-b[16])/.55);
    const color=1-Math.min(1,(Math.abs(a[17]-b[17])+Math.abs(a[18]-b[18]))/.85);
    return clamp(.72*((corr+1)/2)+.18*edge+.10*color,0,1);
  }

  function pointerFragmentScore(obs, ref, pointer) {
    if (!obs?.localPatches || !ref?.localPatches || !pointer) return 0;

    const pc=clamp(Math.floor(pointer.u*LOCAL_COLS),0,LOCAL_COLS-1);
    const pr=clamp(Math.floor(pointer.v*LOCAL_ROWS),0,LOCAL_ROWS-1);

    // Use patches around the actual cursor. This makes the fragment matcher prefer
    // the visible card under the pointer instead of the card covering another area.
    const selected=obs.localPatches.filter(p=>{
      const dx=p.col-pc,dy=p.row-pr;
      return dx*dx + (dy*.78)*(dy*.78) <= 7.2;
    });

    if (selected.length<5) return 0;

    let best=0;
    // The detected amodal box can be vertically shifted by overlap.
    // Slide the pointer neighbourhood over the reference grid and keep a
    // translation-consistent group of matching patches.
    for (let anchorRow=0;anchorRow<LOCAL_ROWS;anchorRow++) {
      for (let anchorCol=0;anchorCol<LOCAL_COLS;anchorCol++) {
        const dc=anchorCol-pc, dr=anchorRow-pr;
        const scores=[];
        for (const op of selected) {
          const rc=op.col+dc, rr=op.row+dr;
          if (rc<0||rc>=LOCAL_COLS||rr<0||rr>=LOCAL_ROWS) continue;
          const rp=ref.localPatches[rr*LOCAL_COLS+rc];
          scores.push(patchSignatureSimilarity(op.sig,rp.sig));
        }
        if (scores.length<5) continue;
        scores.sort((a,b)=>b-a);
        // Ignore boundary/occluder contamination while still requiring several
        // neighbouring patches to agree on the same translation.
        const keep=Math.max(5,Math.ceil(scores.length*.62));
        const score=mean(scores.slice(0,keep));
        if (score>best) best=score;
      }
    }
    return best;
  }

  function bestFragmentComparison(observationVariants, ref) {
    let best={score:0,variant:null};
    for (const item of observationVariants) {
      const score=pointerFragmentScore(item.descriptor,ref.descriptor,item.pointer);
      if (score>best.score) best={score,variant:item};
    }
    return best;
  }

  function aabb(track) {
    const pts=lab.corners(track);
    const xs=pts.map(p=>p[0]), ys=pts.map(p=>p[1]);
    return {x0:Math.min(...xs),y0:Math.min(...ys),x1:Math.max(...xs),y1:Math.max(...ys)};
  }

  function overlapFraction(a,b) {
    const A=aabb(a),B=aabb(b);
    const iw=Math.max(0,Math.min(A.x1,B.x1)-Math.max(A.x0,B.x0));
    const ih=Math.max(0,Math.min(A.y1,B.y1)-Math.max(A.y0,B.y0));
    const inter=iw*ih;
    const aa=Math.max(1,(A.x1-A.x0)*(A.y1-A.y0));
    const ba=Math.max(1,(B.x1-B.x0)*(B.y1-B.y0));
    return inter/Math.min(aa,ba);
  }

  function overlapContext(track) {
    const others=lab.activeTracks().filter(t=>t.uid!==track.uid && (t.misses||0)===0);
    let max=0;
    for (const other of others) max=Math.max(max,overlapFraction(track,other));
    return {overlapping:max>=.16,maxOverlap:max};
  }


  function videoPointToCanonical(track, point) {
    if (!track || !point) return null;
    let shortSide,longSide,theta;
    if (track.w<=track.h) {
      shortSide=Math.max(2,track.w);
      longSide=Math.max(2,track.h);
      theta=track.angle||0;
    } else {
      shortSide=Math.max(2,track.h);
      longSide=Math.max(2,track.w);
      theta=(track.angle||0)+Math.PI/2;
    }
    const dx=point[0]-track.cx,dy=point[1]-track.cy;
    const c=Math.cos(-theta),sn=Math.sin(-theta);
    const lx=dx*c-dy*sn;
    const ly=dx*sn+dy*c;
    return {
      x:(lx/shortSide+.5)*REF_W,
      y:(ly/longSide+.5)*REF_H
    };
  }

  function buildOcclusionMask(track, pointer) {
    const mc=document.createElement('canvas');
    mc.width=REF_W; mc.height=REF_H;
    const ctx=mc.getContext('2d',{willReadFrequently:true,alpha:false});
    ctx.fillStyle='#fff';
    ctx.fillRect(0,0,REF_W,REF_H);

    // Ignore a thin detector-border band. It often contains sleeve/background.
    ctx.strokeStyle='#000';
    ctx.lineWidth=4;
    ctx.strokeRect(0,0,REF_W,REF_H);

    let maskedBy=0;
    let maxOverlap=0;
    const others=lab.activeTracks().filter(t=>t.uid!==track.uid && (t.misses||0)===0);

    for (const other of others) {
      const ov=overlapFraction(track,other);
      if (ov<.10) continue;
      maxOverlap=Math.max(maxOverlap,ov);

      // If the pointer is inside the other card too, z-order is ambiguous.
      // Do not guess which card is on top in that region.
      if (pointer && contains(other,pointer)) continue;

      const pts=lab.corners(other)
        .map(pt=>videoPointToCanonical(track,pt))
        .filter(Boolean);
      if (pts.length!==4) continue;

      ctx.save();
      ctx.fillStyle='#000';
      ctx.strokeStyle='#000';
      ctx.lineWidth=6; // expand the mask around the physical overlap boundary
      ctx.beginPath();
      ctx.moveTo(pts[0].x,pts[0].y);
      for (let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x,pts[i].y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      maskedBy++;
    }

    const data=ctx.getImageData(0,0,REF_W,REF_H).data;
    const mask=new Uint8Array(REF_W*REF_H);
    let visible=0;
    for (let i=0;i<mask.length;i++) {
      const v=data[i*4]>127 ? 1 : 0;
      mask[i]=v;
      visible+=v;
    }
    return {
      mask,
      visibleFraction:visible/mask.length,
      maskedBy,
      maxOverlap
    };
  }

  function flipMask180(mask) {
    const out=new Uint8Array(mask.length);
    const n=mask.length;
    for (let i=0;i<n;i++) out[n-1-i]=mask[i];
    return out;
  }

  function maskedCorrelation(obs,ref,mask,dx=0,dy=0) {
    let n=0;
    let so=0,sr=0,soo=0,srr=0,sor=0;
    let sgo=0,sgr=0,sgoo=0,sgrr=0,sgor=0;
    let colorDiff=0,colorN=0;

    for (let y=2;y<REF_H-2;y+=2) {
      const ry=y+dy;
      if (ry<1||ry>=REF_H-1) continue;
      for (let x=2;x<REF_W-2;x+=2) {
        const idx=y*REF_W+x;
        if (!mask[idx]) continue;
        const rx=x+dx;
        if (rx<1||rx>=REF_W-1) continue;
        const ridx=ry*REF_W+rx;

        const o=obs.full[idx], r=ref.full[ridx];
        const go=obs.gradient[idx], gr=ref.gradient[ridx];

        so+=o; sr+=r; soo+=o*o; srr+=r*r; sor+=o*r;
        sgo+=go; sgr+=gr; sgoo+=go*go; sgrr+=gr*gr; sgor+=go*gr;

        const oi=idx*2,ri=ridx*2;
        colorDiff += Math.abs(obs.chroma[oi]-ref.chroma[ri]);
        colorDiff += Math.abs(obs.chroma[oi+1]-ref.chroma[ri+1]);
        colorN+=2;
        n++;
      }
    }

    if (n<115) return {score:0,gray:0,gradient:0,color:0,used:n};

    function corr(sumA,sumB,sumAA,sumBB,sumAB,count) {
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

  function bestMaskedComparison(observations,ref,maskInfo) {
    let best={score:0,gray:0,gradient:0,color:0,dx:0,dy:0,used:0,flipped:false};

    const shiftsX=[-4,-2,0,2,4];
    const shiftsY=[-6,-3,0,3,6];

    for (let vi=0;vi<observations.length;vi++) {
      const obs=observations[vi];
      const flipped=(vi%2)===1;
      const mask=flipped ? flipMask180(maskInfo.mask) : maskInfo.mask;

      for (const dx of shiftsX) {
        for (const dy of shiftsY) {
          const r=maskedCorrelation(obs,ref,mask,dx,dy);
          if (r.score>best.score) {
            best={...r,dx,dy,flipped};
          }
        }
      }
    }
    return best;
  }

  function pointerInCanonical(track,pointer) {
    if (!track || !pointer) return null;
    let shortSide,longSide,theta;
    if (track.w<=track.h) {
      shortSide=Math.max(2,track.w);
      longSide=Math.max(2,track.h);
      theta=track.angle||0;
    } else {
      shortSide=Math.max(2,track.h);
      longSide=Math.max(2,track.w);
      theta=(track.angle||0)+Math.PI/2;
    }
    const dx=pointer.x-track.cx,dy=pointer.y-track.cy;
    const c=Math.cos(-theta),sn=Math.sin(-theta);
    const lx=dx*c-dy*sn;
    const ly=dx*sn+dy*c;
    return {
      u:clamp(lx/shortSide+.5,0,1),
      v:clamp(ly/longSide+.5,0,1)
    };
  }


  const COARSE_COLS = 6;
  const COARSE_ROWS = 9;
  const NORMAL_SHORTLIST = 24;
  const NORMAL_EXPANDED_SHORTLIST = 44;
  const MASK_SHORTLIST = 18;
  const MASK_NORMAL_BONUS = 8;

  function buildCoarseDescriptor(gray,gradient,chroma) {
    const cells=[];
    const lums=[];

    for (let row=0;row<COARSE_ROWS;row++) {
      const y0=Math.floor(row*REF_H/COARSE_ROWS);
      const y1=Math.floor((row+1)*REF_H/COARSE_ROWS);
      for (let col=0;col<COARSE_COLS;col++) {
        const x0=Math.floor(col*REF_W/COARSE_COLS);
        const x1=Math.floor((col+1)*REF_W/COARSE_COLS);
        let lum=0,edge=0,cr=0,cb=0,n=0;
        for (let y=y0;y<y1;y+=2) {
          for (let x=x0;x<x1;x+=2) {
            const idx=y*REF_W+x;
            lum+=gray[idx];
            edge+=gradient[idx];
            cr+=chroma[idx*2];
            cb+=chroma[idx*2+1];
            n++;
          }
        }
        n=Math.max(1,n);
        const c=[lum/n,edge/n,cr/n,cb/n];
        cells.push(c);
        lums.push(c[0]);
      }
    }

    const lm=mean(lums);
    const ls=Math.max(.055,stddev(lums,lm));
    const out=[];
    for (const c of cells) {
      out.push(
        clamp((c[0]-lm)/ls,-2.8,2.8)/2.8,
        clamp(c[1]*5,0,1),
        clamp(c[2],-.8,.8),
        clamp(c[3],-.8,.8)
      );
    }
    return out;
  }

  function coarseSimilarity(a,b) {
    if (!a || !b || a.length!==b.length) return -1;
    let d=0;
    const cells=a.length/4;
    for (let i=0;i<a.length;i+=4) {
      const dl=(a[i]-b[i])*.90;
      const de=(a[i+1]-b[i+1])*.48;
      const dr=(a[i+2]-b[i+2])*.62;
      const db=(a[i+3]-b[i+3])*.62;
      d += dl*dl + de*de + dr*dr + db*db;
    }
    return Math.exp(-1.6*d/Math.max(1,cells));
  }

  function bestCoarseScore(observations,refDescriptor) {
    let best=-1;
    for (const obs of observations) {
      const score=coarseSimilarity(obs.coarse,refDescriptor.coarse);
      if (score>best) best=score;
    }
    return best;
  }

  function coarseRankReferences(observations,refs) {
    return refs.map(ref=>({
      ref,
      coarseScore:bestCoarseScore(observations,ref.descriptor)
    })).sort((a,b)=>b.coarseScore-a.coarseScore);
  }

  function maskCellVisible(mask,row,col) {
    const cx=Math.min(REF_W-1,Math.floor((col+.5)*REF_W/COARSE_COLS));
    const cy=Math.min(REF_H-1,Math.floor((row+.5)*REF_H/COARSE_ROWS));
    return Boolean(mask[cy*REF_W+cx]);
  }

  function maskedCoarseSimilarity(obs,ref,mask) {
    if (!obs?.coarse || !ref?.coarse) return -1;
    let d=0,used=0;
    for (let row=0;row<COARSE_ROWS;row++) {
      for (let col=0;col<COARSE_COLS;col++) {
        if (!maskCellVisible(mask,row,col)) continue;
        const i=(row*COARSE_COLS+col)*4;
        const dl=(obs.coarse[i]-ref.coarse[i])*.90;
        const de=(obs.coarse[i+1]-ref.coarse[i+1])*.48;
        const dr=(obs.coarse[i+2]-ref.coarse[i+2])*.62;
        const db=(obs.coarse[i+3]-ref.coarse[i+3])*.62;
        d += dl*dl + de*de + dr*dr + db*db;
        used++;
      }
    }
    if (used<8) return -1;
    return Math.exp(-1.6*d/used);
  }

  function maskedCoarseRank(observations,refs,maskInfo) {
    return refs.map(ref=>{
      let best=-1;
      for (let i=0;i<observations.length;i++) {
        const mask=(i%2)===1 ? flipMask180(maskInfo.mask) : maskInfo.mask;
        const score=maskedCoarseSimilarity(observations[i],ref.descriptor,mask);
        if (score>best) best=score;
      }
      return {ref,coarseScore:best};
    }).sort((a,b)=>b.coarseScore-a.coarseScore);
  }

  function uniqueRefs(...groups) {
    const seen=new Set();
    const out=[];
    for (const group of groups) {
      for (const item of group) {
        const ref=item.ref || item;
        const key=ref.image || ref.name;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(ref);
      }
    }
    return out;
  }

  function descriptorFromCanvas(source, inset=0.04, rotate180=false) {
    const canonical=drawCanonical(source,inset,rotate180);
    const {gray,chroma}=buildGrayAndChroma(canonical);
    const blurred=blurGray(gray);
    const gradient=gradientMagnitude(gray);

    // The illustration is the most discriminating part of the Cyberpunk card.
    // Keep title / top icons and most art, exclude much of the generic rules box.
    const ax0=Math.floor(REF_W*.05);
    const ax1=Math.floor(REF_W*.95);
    const ay0=Math.floor(REF_H*.08);
    const ay1=Math.floor(REF_H*.68);

    return {
      full: Array.from(blurred),
      art: regionVector(blurred,1,ax0,ay0,ax1,ay1,1),
      gradient: Array.from(gradient),
      chroma: Array.from(chroma),
      patchGray: Array.from(blurred),
      localPatches: buildLocalPatches(blurred,gradient,chroma),
      coarse: buildCoarseDescriptor(blurred,gradient,chroma)
    };
  }

  function compareDescriptors(obs, ref) {
    const full=normalizedCorrelation(obs.full, ref.full);
    const art=normalizedCorrelation(obs.art, ref.art);
    const gradient=normalizedCorrelation(obs.gradient, ref.gradient);
    const patches=patchCorrelations(obs.patchGray, ref.patchGray);
    const color=chromaSimilarity(obs.chroma,ref.chroma);

    // Color helps but is intentionally weak; global/art structure must dominate.
    const total =
      .25*full +
      .35*art +
      .15*gradient +
      .20*patches +
      .05*color;

    return { total, full, art, gradient, patches, color };
  }

  function bestComparison(observationVariants, ref) {
    let best=null;
    for (const obs of observationVariants) {
      const parts=compareDescriptors(obs,ref);
      if (!best || parts.total>best.total) best=parts;
    }
    return best;
  }

  async function fetchBitmap(url) {
    const r=await fetch(url,{cache:'force-cache'});
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const blob=await r.blob();
    return createImageBitmap(blob);
  }

  function fingerprint(cards) {
    if (!cards.length) return 'empty';
    return `v5-fast:${cards.length}:${cards[0]?.image||''}:${cards[cards.length-1]?.image||''}`;
  }

  function loadCache(fp) {
    try {
      const raw=localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const data=JSON.parse(raw);
      if (data?.fingerprint!==fp || !Array.isArray(data.refs)) return null;
      return data.refs;
    } catch { return null; }
  }

  function saveCache(fp, refs) {
    try {
      localStorage.setItem(CACHE_KEY,JSON.stringify({fingerprint:fp,refs}));
    } catch {}
  }

  async function loadCardList() {
    try {
      const r=await fetch(REMOTE_DB,{cache:'no-cache'});
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data=await r.json();
      if (!Array.isArray(data) || !data.length) throw new Error('Liste vide');
      return {cards:data,source:'GitHub'};
    } catch (err) {
      const r=await fetch(FALLBACK_DB,{cache:'no-cache'});
      if (!r.ok) throw err;
      return {cards:await r.json(),source:'fallback local'};
    }
  }

  async function buildLibrary(force=false) {
    if (state.loading) return;
    state.loading=true;
    state.ready=false;
    const generation=++state.generation;
    setLibraryStatus('Bibliothèque : construction des références visuelles…');

    try {
      const {cards,source}=await loadCardList();
      state.cards=cards.filter(c=>c?.name&&c?.image);
      const fp=fingerprint(state.cards);

      if (!force) {
        const cached=loadCache(fp);
        if (cached?.length===state.cards.length) {
          state.refs=cached;
          state.ready=true;
          state.loading=false;
          setLibraryStatus(`Bibliothèque : ${cached.length} cartes · cache alpha15`);
          return;
        }
      }

      const refs=new Array(state.cards.length);
      let cursor=0,done=0;
      const workers=Math.min(6,state.cards.length);

      async function work() {
        while (cursor<state.cards.length && generation===state.generation) {
          const i=cursor++;
          const card=state.cards[i];
          try {
            const bitmap=await fetchBitmap(imageUrl(card));
            refs[i]={
              name:card.name,
              type:card.type||'',
              image:card.image,
              descriptor:descriptorFromCanvas(bitmap,.04,false)
            };
            bitmap.close?.();
          } catch {
            refs[i]=null;
          }
          done++;
          if (done===1 || done%5===0 || done===state.cards.length) {
            setLibraryStatus(`Bibliothèque : ${done}/${state.cards.length} · ${source}`);
          }
        }
      }

      await Promise.all(Array.from({length:workers},work));
      if (generation!==state.generation) return;

      state.refs=refs.filter(Boolean);
      saveCache(fp,state.refs);
      state.ready=state.refs.length>0;
      setLibraryStatus(`Bibliothèque : ${state.refs.length} cartes prêtes · moteur alpha15`);
    } catch (err) {
      setLibraryStatus(`Bibliothèque indisponible : ${err?.message||err}`);
    } finally {
      if (generation===state.generation) state.loading=false;
    }
  }



  const HOVER_CACHE_TTL_MS = 60000;

  function cacheGeometry(track) {
    return {
      cx:Number(track.cx||0), cy:Number(track.cy||0),
      w:Number(track.w||0), h:Number(track.h||0),
      angle:Number(track.angle||0)
    };
  }

  function cacheGeometryDistance(a,b) {
    if (!a||!b) return Infinity;
    const ref=Math.max(30,(a.w+a.h+b.w+b.h)/4);
    const pos=Math.hypot(a.cx-b.cx,a.cy-b.cy)/ref;
    const scale=Math.abs(a.w-b.w)/Math.max(1,a.w)+Math.abs(a.h-b.h)/Math.max(1,a.h);
    let da=Math.abs(a.angle-b.angle)%(Math.PI*2);
    da=Math.min(da,Math.PI*2-da);
    return pos + scale*.7 + da*.28;
  }

  function cloneAppearance(track) {
    const a=track?.appearanceRecent || track?.appearanceAnchor;
    if (!a || !a.length) return null;
    return Array.from(a);
  }

  function appearanceCosine(a,b,flip180=false) {
    if (!a||!b||a.length!==b.length||a.length<3) return null;
    const pixels=Math.floor(a.length/3);
    let dot=0,aa=0,bb=0;
    for(let p=0;p<pixels;p++){
      const q=flip180?(pixels-1-p):p;
      for(let c=0;c<3;c++){
        const av=a[p*3+c],bv=b[q*3+c];
        dot+=av*bv; aa+=av*av; bb+=bv*bv;
      }
    }
    if(aa<1e-6||bb<1e-6) return null;
    return (Math.max(-1,Math.min(1,dot/Math.sqrt(aa*bb)))+1)/2;
  }

  function appearanceSimilarity(a,b) {
    const d=appearanceCosine(a,b,false);
    const f=appearanceCosine(a,b,true);
    if(d==null) return f;
    if(f==null) return d;
    return Math.max(d,f);
  }

  function getHoverCache(track) {
    const item=state.hoverCache.get(track.uid);
    if(!item) {
      state.hoverCacheMisses++;
      state.hoverCacheRejects.absent++;
      return null;
    }

    const now=performance.now();

    if(now-item.at>HOVER_CACHE_TTL_MS) {
      state.hoverCache.delete(track.uid);
      state.hoverCacheMisses++;
      state.hoverCacheRejects.expired++;
      return null;
    }

    if(cacheGeometryDistance(item.geometry,cacheGeometry(track))>.15) {
      state.hoverCache.delete(track.uid);
      state.hoverCacheMisses++;
      state.hoverCacheRejects.geometry++;
      return null;
    }

    const currentAppearance=cloneAppearance(track);
    if(item.appearance && currentAppearance) {
      const sim=appearanceSimilarity(item.appearance,currentAppearance);
      if(!Number.isFinite(sim) || sim<.82) {
        state.hoverCache.delete(track.uid);
        state.hoverCacheMisses++;
        state.hoverCacheRejects.appearance++;
        return null;
      }
    }

    // Sliding cache: a genuinely unchanged card remains instant while it continues
    // to be used. Geometry + appearance are revalidated on every hit.
    item.at=now;
    item.lastHitAt=now;
    item.geometry=cacheGeometry(track);
    if(currentAppearance) item.appearance=currentAppearance;

    state.hoverCacheHits++;
    return item;
  }

  function putHoverCache(track,result,cropDataUrl) {
    if(!track || !result?.accepted) return;
    // Masked identifications are more viewpoint/occlusion dependent. Cache them
    // briefly but require the same geometry and visual fingerprint on reuse.
    state.hoverCache.set(track.uid,{
      result,
      cropDataUrl:cropDataUrl||null,
      geometry:cacheGeometry(track),
      appearance:cloneAppearance(track),
      createdAt:performance.now(),
      at:performance.now(),
      lastHitAt:null
    });
  }

  function purgeHoverCache() {
    const active=new Set(lab.activeTracks().map(t=>t.uid));
    const now=performance.now();
    for(const [uid,item] of state.hoverCache) {
      if(!active.has(uid)||now-item.at>HOVER_CACHE_TTL_MS) state.hoverCache.delete(uid);
    }
  }

  function renderHoverCache(track,item) {
    if(!item?.result?.accepted) return false;
    state.lastAnalyzedCropDataUrl=item.cropDataUrl||null;
    state.lastAnalyzedTrackUid=track.uid;
    state.lastTrackUid=track.uid;
    state.lastIdentifiedAt=performance.now();
    state.lastMatcherMs=0;
    state.lastMatcherTiming={
      executionThread:'hover-cache',
      workerComputeMs:0,
      roundTripMs:0,
      queueMs:0,
      cacheAgeMs:performance.now()-item.at
    };
    renderResult({...item.result,mode:item.result.mode==='normal'?'cached-normal':item.result.mode});
    if(ui.matcherStatus) {
      ui.matcherStatus.textContent=`Matcher cache : 0 ms · ${item.result.mode||'normal'}`;
    }
    return true;
  }

  function matcherWorkerPayload() {
    return state.refs.map(ref=>({
      name:ref.name,
      type:ref.type||'',
      image:ref.image,
      descriptor:{
        full:ref.descriptor.full,
        art:ref.descriptor.art,
        gradient:ref.descriptor.gradient,
        chroma:ref.descriptor.chroma,
        coarse:ref.descriptor.coarse
      }
    }));
  }

  function closeQueuedBitmap(task) {
    try { task?.bitmap?.close?.(); } catch {}
  }

  function failWorkerTasks(reason) {
    if (state.matcherWorkerCurrent) {
      state.matcherWorkerCurrent.resolve({cancelled:true,reason});
      state.matcherWorkerCurrent=null;
    }
    if (state.matcherWorkerQueued) {
      closeQueuedBitmap(state.matcherWorkerQueued);
      state.matcherWorkerQueued.resolve({cancelled:true,reason});
      state.matcherWorkerQueued=null;
    }
    state.matcherWorkerBusy=false;
  }

  function sendWorkerTask(task) {
    if (!state.matcherWorker || !state.matcherWorkerReady) {
      closeQueuedBitmap(task);
      task.resolve({cancelled:true,reason:'worker-not-ready'});
      return;
    }
    state.matcherWorkerBusy=true;
    state.matcherWorkerCurrent=task;
    task.sentAt=performance.now();

    try {
      state.matcherWorker.postMessage({
        type:'match',
        requestId:task.requestId,
        bitmap:task.bitmap,
        context:task.context
      },[task.bitmap]);
    } catch (err) {
      state.matcherWorkerBusy=false;
      state.matcherWorkerCurrent=null;
      closeQueuedBitmap(task);
      task.reject(err);
      if (state.matcherWorkerQueued) {
        const next=state.matcherWorkerQueued;
        state.matcherWorkerQueued=null;
        sendWorkerTask(next);
      }
    }
  }

  function queueWorkerTask(bitmap,context,generation,trackUid) {
    return new Promise((resolve,reject)=>{
      const task={
        requestId:++state.matcherWorkerSeq,
        bitmap,context,generation,trackUid,resolve,reject,
        queuedAt:performance.now(),
        sentAt:null
      };

      if (!state.matcherWorkerReady) {
        closeQueuedBitmap(task);
        resolve({cancelled:true,reason:'worker-not-ready'});
        return;
      }

      if (state.matcherWorkerBusy) {
        // Keep only the latest hover request. An older queued card can never become
        // useful again once the pointer has already moved elsewhere.
        if (state.matcherWorkerQueued) {
          closeQueuedBitmap(state.matcherWorkerQueued);
          state.matcherWorkerQueued.resolve({cancelled:true,reason:'replaced-by-newer-hover'});
        }
        state.matcherWorkerQueued=task;
        return;
      }

      sendWorkerTask(task);
    });
  }

  async function initMatcherWorker() {
    if (!window.Worker || !window.OffscreenCanvas || !window.createImageBitmap) {
      state.matcherWorkerReady=false;
      state.matcherWorkerError='Web Worker / OffscreenCanvas indisponible';
      if (ui.matcherStatus) ui.matcherStatus.textContent='Matcher : fallback thread principal';
      return false;
    }

    try {
      if (state.matcherWorker) {
        try { state.matcherWorker.terminate(); } catch {}
        state.matcherWorker=null;
      }
      failWorkerTasks('worker-reinit');

      const worker=new Worker('/identification-worker.js?v=alpha13-worker-20260815');
      state.matcherWorker=worker;
      state.matcherWorkerReady=false;
      state.matcherWorkerError=null;

      const readyPromise=new Promise((resolve,reject)=>{
        const timeout=setTimeout(()=>reject(new Error('Timeout initialisation matcher worker')),12000);

        worker.onmessage=(event)=>{
          const msg=event.data||{};

          if (msg.type==='ready') {
            clearTimeout(timeout);
            state.matcherWorkerReady=true;
            if (ui.matcherStatus) ui.matcherStatus.textContent=`Matcher worker : prêt · ${msg.count} cartes`;
            resolve(true);
            return;
          }

          if (msg.type==='match-result' || msg.type==='match-error') {
            const task=state.matcherWorkerCurrent;
            if (!task || task.requestId!==msg.requestId) return;

            state.matcherWorkerCurrent=null;
            state.matcherWorkerBusy=false;

            const roundTripMs=performance.now()-task.sentAt;
            const queueMs=Math.max(0,task.sentAt-task.queuedAt);

            if (msg.type==='match-error') {
              task.reject(new Error(msg.error||'Erreur matcher worker'));
            } else {
              const result=msg.result||null;
              if (result?.timing) {
                result.timing.roundTripMs=roundTripMs;
                result.timing.queueMs=queueMs;
                result.timing.mainThreadBlockedMs=0;
              }
              task.resolve(result);
            }

            if (state.matcherWorkerQueued) {
              const next=state.matcherWorkerQueued;
              state.matcherWorkerQueued=null;
              sendWorkerTask(next);
            }
          }
        };

        worker.onerror=(event)=>{
          clearTimeout(timeout);
          state.matcherWorkerReady=false;
          state.matcherWorkerError=event.message||'Erreur matcher worker';
          failWorkerTasks('worker-error');
          if (ui.matcherStatus) ui.matcherStatus.textContent='Matcher worker : erreur';
          reject(new Error(state.matcherWorkerError));
        };
      });

      const payload=matcherWorkerPayload();
      const t=performance.now();
      worker.postMessage({type:'init',refs:payload});
      state.matcherWorkerInitMs=performance.now()-t;
      if (ui.matcherStatus) ui.matcherStatus.textContent='Matcher worker : initialisation…';

      await readyPromise;
      return true;
    } catch (err) {
      state.matcherWorkerReady=false;
      state.matcherWorkerError=String(err?.message||err);
      if (ui.matcherStatus) ui.matcherStatus.textContent='Matcher : fallback thread principal';
      return false;
    }
  }

  function identifyCanvas(canvas, context=null) {
    if (!canvas || !state.ready) return null;

    const timing={};
    const tStart=performance.now();

    const observations=[];
    for (const inset of [.02,.055,.095]) {
      observations.push(
        descriptorFromCanvas(canvas,inset,false),
        descriptorFromCanvas(canvas,inset,true)
      );
    }
    timing.descriptorMs=performance.now()-tStart;

    // --------------------------------------------------------------
    // Fast coarse pass across the full library.
    // --------------------------------------------------------------
    const tCoarse=performance.now();
    const coarseRanked=coarseRankReferences(observations,state.refs);
    timing.coarseMs=performance.now()-tCoarse;

    // --------------------------------------------------------------
    // Detailed alpha3 matcher on only the best coarse candidates.
    // --------------------------------------------------------------
    const tNormal=performance.now();
    let normalPool=coarseRanked.slice(0,NORMAL_SHORTLIST);
    let normalRanked=normalPool.map(item=>{
      const parts=bestComparison(observations,item.ref.descriptor);
      return {ref:item.ref,score:parts.total,parts,coarseScore:item.coarseScore};
    }).sort((a,b)=>b.score-a.score);

    let ranked=normalRanked.slice(0,5);
    let best=ranked[0]||null;
    let second=ranked[1]||null;
    let margin=best ? best.score-(second?.score||0) : 0;

    let accepted=Boolean(
      best && (
        (best.score>=NORMAL_ACCEPT && margin>=NORMAL_MARGIN) ||
        (best.score>=LOW_ACCEPT && margin>=LOW_MARGIN)
      )
    );

    // Rare conservative expansion if a normal isolated card was not convincing.
    // Still avoids the old 120-card exhaustive pass.
    if (!accepted && !context?.overlapping) {
      const already=new Set(normalPool.map(x=>x.ref.image||x.ref.name));
      const extra=coarseRanked.slice(NORMAL_SHORTLIST,NORMAL_EXPANDED_SHORTLIST)
        .filter(x=>!already.has(x.ref.image||x.ref.name));

      if (extra.length) {
        const more=extra.map(item=>{
          const parts=bestComparison(observations,item.ref.descriptor);
          return {ref:item.ref,score:parts.total,parts,coarseScore:item.coarseScore};
        });
        normalRanked=[...normalRanked,...more].sort((a,b)=>b.score-a.score);
        ranked=normalRanked.slice(0,5);
        best=ranked[0]||null;
        second=ranked[1]||null;
        margin=best ? best.score-(second?.score||0) : 0;
        accepted=Boolean(
          best && (
            (best.score>=NORMAL_ACCEPT && margin>=NORMAL_MARGIN) ||
            (best.score>=LOW_ACCEPT && margin>=LOW_MARGIN)
          )
        );
        normalPool=coarseRanked.slice(0,NORMAL_EXPANDED_SHORTLIST);
      }
    }
    timing.normalDetailMs=performance.now()-tNormal;

    let mode='normal';
    let maskDiagnostics=null;

    // --------------------------------------------------------------
    // Geometry-aware masked fallback.
    // First shortlist cheaply with the visible cells, then run the
    // expensive shift search on a small union of candidates.
    // --------------------------------------------------------------
    if (!accepted && context?.maskInfo?.maskedBy>0 && context.maskInfo.visibleFraction>=.20) {
      const tMaskCoarse=performance.now();
      const maskCoarse=maskedCoarseRank(observations,state.refs,context.maskInfo);
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
            full:m.gray,
            art:0,
            gradient:m.gradient,
            patches:m.score,
            color:m.color,
            masked:m.score
          },
          masked:m
        };
      }).sort((a,b)=>b.score-a.score).slice(0,5);
      timing.maskDetailMs=performance.now()-tMaskDetail;

      const mb=maskRanked[0]||null;
      const ms=maskRanked[1]||null;
      const mm=mb ? mb.score-(ms?.score||0) : 0;

      maskDiagnostics={
        visibleFraction:context.maskInfo.visibleFraction,
        maskedBy:context.maskInfo.maskedBy,
        maxOverlap:context.maskInfo.maxOverlap,
        bestScore:mb?.score||0,
        margin:mm,
        testedCandidates:maskPool.length,
        candidates:maskRanked
      };

      if (mb && mb.score>=.655 && mm>=.038) {
        best=mb;
        second=ms;
        margin=mm;
        ranked=maskRanked;
        accepted=true;
        mode='masked';
      } else if (mb && mm>margin+.035) {
        best=mb;
        second=ms;
        margin=mm;
        ranked=maskRanked;
        mode='masked-uncertain';
      }
    }

    // The alpha7 pointer-fragment fallback is deliberately no longer executed.
    // Real tests showed zero successful takeovers while it added substantial work.

    timing.totalMatcherMs=performance.now()-tStart;
    timing.normalCandidatesTested=normalPool.length;
    timing.coarseLibrarySize=state.refs.length;

    return {
      accepted,best,second,margin,ranked,
      mode,
      overlap:context?.maxOverlap||0,
      normalCandidates:normalRanked.slice(0,5),
      maskDiagnostics,
      timing
    };
  }

  function visualIndex(score) {
    // Human-readable matcher index, not probability.
    return Math.round(clamp((score + .15) / .70, 0, 1) * 100);
  }

  function clearResult(message='Survole une carte détectée.') {
    ui.result?.classList.add('hidden');
    ui.candidates?.classList.add('hidden');
    if (ui.empty) {
      ui.empty.classList.remove('hidden');
      ui.empty.textContent=message;
    }
    window.dispatchEvent(new CustomEvent('tcg-identification-result',{
      detail:{accepted:false,message,at:performance.now()}
    }));
  }

  function clearCurrentIdentification(message='Survole une carte détectée.') {
    state.lastResult = null;
    state.lastTrackUid = null;
    state.lastAnalyzedCropDataUrl = null;
    state.lastAnalyzedTrackUid = null;
    if (ui.matcherStatus) ui.matcherStatus.textContent='Matcher : —';
    clearResult(message);
  }

  function renderResult(result) {
    state.lastResult = result || null;
    if (!result?.best) return clearResult('Aucune correspondance.');

    const bestIndex=visualIndex(result.best.score);
    const marginIndex=Math.round(result.margin*100);
    const ranked=result.ranked.map((x,i)=>{
      const p=x.parts||{};
      const detail=result.mode?.startsWith('fragment')
        ? `fragment ${Math.round((p.fragment||x.score)*100)}`
        : result.mode?.startsWith('masked')
          ? `masqué ${Math.round((p.masked||x.score)*100)} · structure ${Math.round((p.full||0)*100)}`
          : `art ${Math.round((p.art||0)*100)} · structure ${Math.round((p.full||0)*100)}`;
      return `${i+1}. ${x.ref.name} · indice ${visualIndex(x.score)} · ${detail}`;
    }).join('<br>');

    if (!result.accepted) {
      ui.result?.classList.add('hidden');
      ui.empty?.classList.remove('hidden');
      const glare=result.rejectionReason?.startsWith('glare')
        ? ' · reflet détecté'
        : '';
      ui.empty.textContent=`Identification incertaine${glare} · meilleur indice ${bestIndex}/100`;
      ui.candidates.innerHTML=ranked;
      ui.candidates.classList.remove('hidden');

      window.dispatchEvent(new CustomEvent('tcg-identification-result',{
        detail:{
          accepted:false,
          reason:result.rejectionReason || 'uncertain',
          visualIndex:bestIndex,
          margin:Number(result.margin || 0),
          mode:result.mode || 'normal',
          quality:result.quality || null,
          trackUid:state.hoveredTrack?.uid ?? null,
          at:performance.now()
        }
      }));
      return;
    }

    ui.empty?.classList.add('hidden');
    ui.candidates?.classList.add('hidden');
    ui.result?.classList.remove('hidden');
    ui.name.textContent=result.best.ref.name;
    ui.type.textContent=result.best.ref.type||'Carte';
    const modeLabel=result.mode==='fragment'?' · fragment visible':result.mode==='masked'?' · zones visibles masquées':result.mode==='cached-normal'?' · cache instantané':'';
    ui.score.textContent=`Indice visuel : ${bestIndex}/100${modeLabel}`;
    ui.margin.textContent=`Écart brut avec le 2e candidat : ${marginIndex} points · mode ${result.mode||'normal'} · ce score n'est pas une probabilité`;
    const hdUrl=imageUrl(result.best.ref);
    ui.image.src=hdUrl;
    ui.image.alt=result.best.ref.name;

    window.dispatchEvent(new CustomEvent('tcg-identification-result',{
      detail:{
        accepted:true,
        name:result.best.ref.name,
        type:result.best.ref.type || 'Carte',
        image:result.best.ref.image,
        imageUrl:hdUrl,
        visualIndex:bestIndex,
        margin:Number(result.margin || 0),
        mode:result.mode || 'normal',
        matcherMs:Number(state.lastMatcherMs || 0),
        quality:result.quality || null,
        trackUid:state.hoveredTrack?.uid ?? null,
        at:performance.now()
      }
    }));
  }

  function stagePoint(event) {
    const rect=lab.els.videoStage.getBoundingClientRect();
    const vw=lab.els.video.videoWidth || lab.els.overlay.width || 1;
    const vh=lab.els.video.videoHeight || lab.els.overlay.height || 1;

    // Product remote video uses object-fit: contain: compensate for black bars.
    const scale=Math.min(rect.width/vw,rect.height/vh);
    const dw=vw*scale, dh=vh*scale;
    const ox=(rect.width-dw)/2, oy=(rect.height-dh)/2;
    const lx=event.clientX-rect.left-ox;
    const ly=event.clientY-rect.top-oy;

    if (lx<0 || ly<0 || lx>dw || ly>dh) return null;
    return {x:lx/scale,y:ly/scale};
  }

  function contains(track,p) {
    const a=-(track.angle||0),c=Math.cos(a),s=Math.sin(a);
    const dx=p.x-track.cx,dy=p.y-track.cy;
    const x=dx*c-dy*s,y=dx*s+dy*c;
    return Math.abs(x)<=track.w/2 && Math.abs(y)<=track.h/2;
  }


function pointerCell(point) {
  const w=Math.max(1,lab.els.video.videoWidth || lab.els.overlay.width || 1);
  const h=Math.max(1,lab.els.video.videoHeight || lab.els.overlay.height || 1);
  const nx=Math.max(0,Math.min(.999999,point.x/w));
  const ny=Math.max(0,Math.min(.999999,point.y/h));
  return Math.min(2,Math.floor(ny*3))*3+Math.min(2,Math.floor(nx*3));
}

function recordPointerDiagnostic(point,hit) {
  const now=performance.now();
  if(now-state.lastPointerDiagnosticAt<220) return;
  state.lastPointerDiagnosticAt=now;
  const i=pointerCell(point);
  (hit?state.pointerHitHeatmap:state.pointerMissHeatmap)[i]+=1;
}

function analyzeCropQuality(canvas) {
  const sample=document.createElement('canvas');
  sample.width=72;
  sample.height=104;
  const ctx=sample.getContext('2d',{willReadFrequently:true,alpha:false});
  ctx.drawImage(canvas,0,0,sample.width,sample.height);
  const px=ctx.getImageData(0,0,sample.width,sample.height).data;

  const x0=Math.floor(sample.width*.10), x1=Math.ceil(sample.width*.90);
  const y0=Math.floor(sample.height*.08), y1=Math.ceil(sample.height*.92);

  const blockCols=6,blockRows=8;
  const clippedByBlock=new Array(blockCols*blockRows).fill(0);
  const pixelsByBlock=new Array(blockCols*blockRows).fill(0);

  let n=0,clipped=0,bright=0,detail=0,detailN=0;
  const gray=new Float32Array(sample.width*sample.height);

  for(let y=0;y<sample.height;y++){
    for(let x=0;x<sample.width;x++){
      const i=(y*sample.width+x)*4;
      const r=px[i]/255,g=px[i+1]/255,b=px[i+2]/255;
      gray[y*sample.width+x]=.299*r+.587*g+.114*b;
    }
  }

  for(let y=y0;y<y1;y++){
    for(let x=x0;x<x1;x++){
      const i=(y*sample.width+x)*4;
      const r=px[i]/255,g=px[i+1]/255,b=px[i+2]/255;
      const max=Math.max(r,g,b),min=Math.min(r,g,b);
      const lum=gray[y*sample.width+x];
      const sat=max>1e-4?(max-min)/max:0;
      const isClip=lum>.965 && sat<.14;
      const isBright=lum>.91;

      const bx=Math.min(blockCols-1,Math.floor((x-x0)/(x1-x0)*blockCols));
      const by=Math.min(blockRows-1,Math.floor((y-y0)/(y1-y0)*blockRows));
      const bi=by*blockCols+bx;
      pixelsByBlock[bi]+=1;
      if(isClip) clippedByBlock[bi]+=1;

      clipped+=Number(isClip);
      bright+=Number(isBright);
      n+=1;

      if(x>x0 && y>y0){
        detail+=Math.abs(lum-gray[y*sample.width+x-1]);
        detail+=Math.abs(lum-gray[(y-1)*sample.width+x]);
        detailN+=2;
      }
    }
  }

  const clippedFraction=clipped/Math.max(1,n);
  const brightFraction=bright/Math.max(1,n);
  const meanDetail=detail/Math.max(1,detailN);
  let maxBlockClip=0;
  for(let i=0;i<clippedByBlock.length;i++){
    if(pixelsByBlock[i]){
      maxBlockClip=Math.max(maxBlockClip,clippedByBlock[i]/pixelsByBlock[i]);
    }
  }

  let risk='normal';
  if(
    clippedFraction>=.16 ||
    (clippedFraction>=.06 && maxBlockClip>=.72)
  ){
    risk='high';
  }else if(
    clippedFraction>=.08 ||
    (clippedFraction>=.035 && maxBlockClip>=.56)
  ){
    risk='moderate';
  }

  return {
    risk,
    clippedFraction:Number(clippedFraction.toFixed(4)),
    brightFraction:Number(brightFraction.toFixed(4)),
    maxBlockClip:Number(maxBlockClip.toFixed(4)),
    detail:Number(meanDetail.toFixed(4))
  };
}

function applyQualityGuard(result,quality) {
  if(!result || !quality) return result;
  result.quality=quality;
  state.qualityGuard.last={...quality};

  if(quality.risk==='high') state.qualityGuard.high+=1;
  if(quality.risk==='moderate') state.qualityGuard.moderate+=1;

  if(!result.accepted) return result;

  if(quality.risk==='high'){
    result.accepted=false;
    result.rejectionReason='glare-high';
    result.mode=`${result.mode || 'normal'}-glare-rejected`;
    state.qualityGuard.rejected+=1;
    return result;
  }

  if(quality.risk==='moderate'){
    // Prefer no result to a confident-looking wrong card under glare.
    // Moderate glare needs stronger separation from the second candidate.
    const strongEnough=
      Number(result.best?.score || 0)>=.28 &&
      Number(result.margin || 0)>=.16;

    if(!strongEnough){
      result.accepted=false;
      result.rejectionReason='glare-moderate';
      result.mode=`${result.mode || 'normal'}-glare-rejected`;
      state.qualityGuard.rejected+=1;
    }else{
      result.mode=`${result.mode || 'normal'}-glare-guarded`;
      state.qualityGuard.tightened+=1;
    }
  }

  return result;
}

  function identityKey(result) {
    if (!result?.accepted || !result.best?.ref) return null;
    return result.best.ref.image || result.best.ref.name || null;
  }

  function emitIdentityStability(type, track, extra={}) {
    const detail={
      type,
      trackUid:track?.uid ?? null,
      displayId:track?.displayId ?? null,
      at:performance.now(),
      ...extra
    };
    state.identityStability.last={...detail};
    window.dispatchEvent(new CustomEvent('tcg-identification-stability',{detail}));
  }

  function temporalEntry(track) {
    let entry=state.identityStability.tracks.get(track.uid);
    if(!entry){
      entry={
        stableKey:null,
        stableName:null,
        stableResult:null,
        stableAt:0,
        lastConfirmedAt:0,
        pendingKey:null,
        pendingName:null,
        pendingCount:0,
        pendingFirstAt:0,
        pendingLastAt:0,
        uncertainSince:0
      };
      state.identityStability.tracks.set(track.uid,entry);
    }
    return entry;
  }

  function clearPendingIdentity(entry) {
    entry.pendingKey=null;
    entry.pendingName=null;
    entry.pendingCount=0;
    entry.pendingFirstAt=0;
    entry.pendingLastAt=0;
  }

  function purgeIdentityStability() {
    const active=new Set(lab.activeTracks().map(t=>t.uid));
    for(const uid of state.identityStability.tracks.keys()) {
      if(!active.has(uid)) state.identityStability.tracks.delete(uid);
    }
  }

  function scheduleTemporalRecheck(trackUid,generation,delay=IDENTITY_RECHECK_MS) {
    clearTimeout(state.temporalRecheckTimer);
    state.temporalRecheckTimer=setTimeout(()=>{
      if(generation!==state.hoverGeneration) return;
      if(state.hoveredTrack?.uid!==trackUid) return;
      const liveTrack=lab.activeTracks().find(t=>t.uid===trackUid && (t.misses||0)===0);
      if(!liveTrack) return;
      state.identityStability.rechecks+=1;
      identifyTrack(liveTrack,generation);
    },delay);
  }

  function temporalIdentityGuard(track,result) {
    if(!track) return {action:'render',result};

    const now=performance.now();
    const entry=temporalEntry(track);
    const key=identityKey(result);

    // Initial acquisition remains immediate. The temporal guard only protects a
    // card that has already been established on this track.
    if(!entry.stableKey) {
      if(key) {
        entry.stableKey=key;
        entry.stableName=result.best.ref.name || key;
        entry.stableResult=result;
        entry.stableAt=now;
        entry.lastConfirmedAt=now;
        entry.uncertainSince=0;
        clearPendingIdentity(entry);
        emitIdentityStability('stable-established',track,{
          stableKey:key,
          stableName:entry.stableName
        });
      }
      return {action:'render',result};
    }

    // A repeated observation of the current identity immediately cancels any
    // suspicious switch that may have been caused by glare.
    if(key && key===entry.stableKey) {
      entry.stableResult=result;
      entry.lastConfirmedAt=now;
      entry.uncertainSince=0;
      clearPendingIdentity(entry);
      state.identityStability.stableRefreshes+=1;
      return {action:'render',result};
    }

    if(!entry.uncertainSince) entry.uncertainSince=now;
    const uncertainAge=now-entry.uncertainSince;

    // No accepted identity (including glare-high / glare-moderate rejection):
    // preserve the last stable card for a short grace period instead of making
    // it flicker away on a single damaged frame.
    if(!key) {
      clearPendingIdentity(entry);
      if(uncertainAge<IDENTITY_TRANSIENT_HOLD_MS) {
        state.identityStability.transientHolds+=1;
        emitIdentityStability('stable-held',track,{
          stableKey:entry.stableKey,
          stableName:entry.stableName,
          reason:result?.rejectionReason || 'uncertain',
          quality:result?.quality || null,
          holdAgeMs:Math.round(uncertainAge)
        });
        return {action:'hold',result,recheck:true};
      }

      state.identityStability.holdsExpired+=1;
      state.hoverCache.delete(track.uid);
      emitIdentityStability('hold-expired',track,{
        stableKey:entry.stableKey,
        stableName:entry.stableName,
        reason:result?.rejectionReason || 'uncertain',
        holdAgeMs:Math.round(uncertainAge)
      });
      state.identityStability.tracks.delete(track.uid);
      return {action:'render',result};
    }

    // Accepted but different identity: it is a candidate switch, not an
    // immediate replacement. Consecutive confirmations are required.
    const withinWindow=
      entry.pendingKey===key &&
      entry.pendingLastAt>0 &&
      now-entry.pendingLastAt<=IDENTITY_SWITCH_WINDOW_MS;

    if(withinWindow) {
      entry.pendingCount+=1;
    } else {
      entry.pendingKey=key;
      entry.pendingName=result.best.ref.name || key;
      entry.pendingCount=1;
      entry.pendingFirstAt=now;
    }
    entry.pendingLastAt=now;

    const glareRisk=result?.quality?.risk || 'normal';
    const guardedMode=String(result?.mode || '').includes('glare');
    const required=(glareRisk==='moderate' || guardedMode)
      ? IDENTITY_SWITCH_CONFIRMATIONS_GLARE
      : IDENTITY_SWITCH_CONFIRMATIONS;

    if(entry.pendingCount>=required) {
      const previousKey=entry.stableKey;
      const previousName=entry.stableName;
      entry.stableKey=key;
      entry.stableName=result.best.ref.name || key;
      entry.stableResult=result;
      entry.stableAt=now;
      entry.lastConfirmedAt=now;
      entry.uncertainSince=0;
      clearPendingIdentity(entry);
      state.identityStability.switchesConfirmed+=1;
      emitIdentityStability('switch-confirmed',track,{
        previousKey,
        previousName,
        stableKey:key,
        stableName:entry.stableName,
        required
      });
      return {action:'render',result};
    }

    if(uncertainAge>=IDENTITY_TRANSIENT_HOLD_MS) {
      // If observations never converge, do not keep a stale identity forever.
      // Drop the old card and let the next clean observation reacquire normally.
      state.identityStability.holdsExpired+=1;
      state.hoverCache.delete(track.uid);
      const rejected={
        ...result,
        accepted:false,
        rejectionReason:'temporal-unstable',
        mode:`${result.mode || 'normal'}-temporal-unstable`
      };
      emitIdentityStability('switch-expired',track,{
        stableKey:entry.stableKey,
        stableName:entry.stableName,
        pendingKey:key,
        pendingName:result.best.ref.name || key,
        pendingCount:entry.pendingCount,
        required,
        holdAgeMs:Math.round(uncertainAge)
      });
      state.identityStability.tracks.delete(track.uid);
      return {action:'render',result:rejected};
    }

    state.identityStability.switchesSuppressed+=1;
    emitIdentityStability('switch-pending',track,{
      stableKey:entry.stableKey,
      stableName:entry.stableName,
      candidateKey:key,
      candidateName:result.best.ref.name || key,
      count:entry.pendingCount,
      required,
      quality:result?.quality || null
    });
    return {action:'hold',result,recheck:true,count:entry.pendingCount,required};
  }

  async function identifyTrack(track, generation) {
    if (!ui.toggle?.checked) return clearCurrentIdentification('Identification désactivée.');
    if (!state.ready) return clearCurrentIdentification('Bibliothèque encore en préparation…');
    if (!track || track.misses>0) return clearCurrentIdentification();

    if (generation !== state.hoverGeneration) return;

    const canvas=lab.captureCanonicalTrackCanvas(track,216,312);
    if (!canvas) return clearCurrentIdentification('Capture de carte impossible.');
    const cropQuality=analyzeCropQuality(canvas);

    const overlap=overlapContext(track);
    const pointerCanonical=pointerInCanonical(track,state.pointer);
    const maskInfo=buildOcclusionMask(track,state.pointer);
    const context={
      ...overlap,
      pointerCanonical,
      maskInfo
    };

    // Capture the exact source immediately for diagnostics. This is intentionally
    // done before transferring the bitmap to the worker.
    try {
      state.lastAnalyzedCropDataUrl=canvas.toDataURL('image/jpeg',.94);
      state.lastAnalyzedTrackUid=track.uid;
    } catch {
      state.lastAnalyzedCropDataUrl=null;
      state.lastAnalyzedTrackUid=null;
    }

    let result=null;

    if (state.matcherWorkerReady) {
      try {
        const bitmap=await createImageBitmap(canvas);

        // Pointer may already have moved while createImageBitmap yielded.
        if (generation !== state.hoverGeneration ||
            !state.hoveredTrack || state.hoveredTrack.uid !== track.uid) {
          bitmap.close?.();
          return;
        }

        result=await queueWorkerTask(bitmap,context,generation,track.uid);
        if (result?.cancelled) return;
      } catch (err) {
        state.matcherWorkerError=String(err?.message||err);
        if (ui.matcherStatus) ui.matcherStatus.textContent='Matcher worker : erreur · fallback';
      }
    }

    // Emergency fallback only. Firefox/desktop should normally never use this path.
    if (!result) {
      const fallbackStart=performance.now();
      result=identifyCanvas(canvas,context);
      if (result?.timing) {
        result.timing.executionThread='main-fallback';
        result.timing.roundTripMs=performance.now()-fallbackStart;
        result.timing.mainThreadBlockedMs=result.timing.roundTripMs;
      }
    }

    result=applyQualityGuard(result,cropQuality);

    state.lastMatcherMs=Number(
      result?.timing?.roundTripMs ??
      result?.timing?.totalMatcherMs ??
      0
    );
    state.lastMatcherTiming=result?.timing ? { ...result.timing } : null;

    if (ui.matcherStatus) {
      const compute=Math.round(Number(result?.timing?.workerComputeMs ?? result?.timing?.totalMatcherMs ?? 0));
      const rt=Math.round(Number(result?.timing?.roundTripMs ?? compute));
      const thread=result?.timing?.executionThread==='worker'?'worker':'fallback';
      ui.matcherStatus.textContent=`Matcher ${thread} : ${compute} ms · RT ${rt} ms · ${result?.mode || 'normal'}`;
    }

    // Crucial alpha13 behavior: because the heavy work no longer blocks the main
    // thread, hoverGeneration can change while the worker is calculating.
    // Obsolete results are therefore discarded before touching the DOM.
    if (generation !== state.hoverGeneration) return;
    if (!state.hoveredTrack || state.hoveredTrack.uid !== track.uid) return;

    const temporal=temporalIdentityGuard(track,result);

    if(temporal.action==='hold') {
      // Keep the current accepted HD card untouched while the new observation is
      // being validated. Do not dispatch a rejection to the product UI.
      const entry=state.identityStability.tracks.get(track.uid);
      if(ui.matcherStatus) {
        const suffix=temporal.required
          ? ` · changement ${temporal.count}/${temporal.required}`
          : ' · reflet/transitoire';
        ui.matcherStatus.textContent+=` · identité stable conservée${suffix}`;
      }
      if(temporal.recheck) scheduleTemporalRecheck(track.uid,generation);
      purgeHoverCache();
      purgeIdentityStability();
      return;
    }

    result=temporal.result;
    renderResult(result);
    state.lastTrackUid=track.uid;
    state.lastIdentifiedAt=performance.now();
    putHoverCache(track,result,state.lastAnalyzedCropDataUrl);
    purgeHoverCache();
    purgeIdentityStability();
  }

  function onPointerMove(event) {
    if (event.target?.closest?.('.fullscreen-card-preview')) return;

    const point=stagePoint(event);
    if (!point) {
      state.pointerInsideStage=true;
      state.hoveredTrack=null;
      state.hoverGeneration+=1;
      clearTimeout(state.hoverTimer);
      return clearCurrentIdentification();
    }

    state.pointerInsideStage = true;
    state.pointer = {
      x: point.x,
      y: point.y,
      normalizedX: point.x / Math.max(1, lab.els.overlay.width),
      normalizedY: point.y / Math.max(1, lab.els.overlay.height),
      clientX: event.clientX,
      clientY: event.clientY,
      updatedAt: new Date().toISOString()
    };

    if (!ui.toggle?.checked) {
      state.hoveredTrack = null;
      state.hoverGeneration += 1;
      clearTimeout(state.hoverTimer);
      return clearCurrentIdentification('Identification désactivée.');
    }

    const tracks=lab.activeTracks()
      .filter(t=>(t.misses||0)===0)
      .sort((a,b)=>(b.conf||0)-(a.conf||0));
    const track=tracks.find(t=>contains(t,point));

    if (!track) {
      recordPointerDiagnostic(point,false);
      state.hoveredTrack = null;
      state.hoverGeneration += 1;
      clearTimeout(state.hoverTimer);
      return clearCurrentIdentification();
    }

    recordPointerDiagnostic(point,true);

    const previousUid = state.hoveredTrack?.uid ?? null;
    const isNewTrack = previousUid !== track.uid;

    state.hoveredTrack = {
      uid: track.uid,
      displayId: track.displayId,
      conf: track.conf,
      cx: track.cx,
      cy: track.cy,
      w: track.w,
      h: track.h,
      angle: track.angle,
      misses: track.misses || 0
    };

    clearTimeout(state.hoverTimer);

    let usedCache=false;
    if (isNewTrack) {
      // Never leave the previous card visible.
      state.hoverGeneration += 1;
      state.lastResult = null;
      state.lastTrackUid = null;

      const cached=getHoverCache(track);
      if(cached?.result?.accepted) {
        usedCache=renderHoverCache(track,cached);
      } else {
        clearResult('Analyse de la carte survolée…');
      }
    }

    const generation = state.hoverGeneration;
    const same = !isNewTrack && state.lastTrackUid===track.uid;

    // Cache is on-demand only: no background work. If a valid cached result was
    // displayed, verify it only if the user keeps hovering for a while.
    const delay = usedCache
      ? 1400
      : same && performance.now()-state.lastIdentifiedAt<1100
        ? 700
        : 40;

    state.hoverTimer=setTimeout(()=>identifyTrack(track,generation),delay);
  }


  function currentTrackUnderStoredPointer() {
    if (!state.pointerInsideStage || !state.pointer) return null;
    const point={x:state.pointer.x,y:state.pointer.y};
    return lab.activeTracks()
      .filter(t=>(t.misses||0)===0)
      .sort((a,b)=>(b.conf||0)-(a.conf||0))
      .find(t=>contains(t,point)) || null;
  }

  function refreshStationaryPointerHover() {
    if (!state.pointerInsideStage || !state.pointer) return;

    const track=currentTrackUnderStoredPointer();
    const currentUid=state.hoveredTrack?.uid ?? null;
    const nextUid=track?.uid ?? null;

    // Same semantic target: only refresh its current geometry/confidence.
    // Do NOT touch the hover timer, otherwise 3 Hz tracking updates could keep
    // postponing an identification forever.
    if (currentUid===nextUid) {
      if (track && state.hoveredTrack) {
        state.hoveredTrack={
          uid:track.uid,
          displayId:track.displayId,
          conf:track.conf,
          cx:track.cx,
          cy:track.cy,
          w:track.w,
          h:track.h,
          angle:track.angle,
          misses:track.misses||0
        };
      }
      return;
    }

    // The scene changed under a stationary mouse. Re-run the normal hover path
    // using the last real pointer coordinates.
    onPointerMove({
      clientX:state.pointer.clientX,
      clientY:state.pointer.clientY
    });
  }

  window.addEventListener('tcg-tracks-updated',refreshStationaryPointerHover);

  lab.els.videoStage.classList.add('ident-hover');
  lab.els.videoStage.addEventListener('pointermove',onPointerMove);
  lab.els.videoStage.addEventListener('pointerleave',()=>{
    state.pointerInsideStage=false;
    state.hoveredTrack=null;
    state.hoverGeneration+=1;
    clearTimeout(state.hoverTimer);
    clearTimeout(state.temporalRecheckTimer);
    // Keep the last accepted HD card visible so the player can move to the
    // inspector and enlarge it without losing the result.
  });

  ui.toggle?.addEventListener('change',()=>{
    state.hoverGeneration += 1;
    clearTimeout(state.hoverTimer);
    clearTimeout(state.temporalRecheckTimer);
    state.hoveredTrack = null;
    if (!ui.toggle.checked) clearCurrentIdentification('Identification désactivée.');
    else clearCurrentIdentification();
  });

  ui.refresh?.addEventListener('click',async()=>{
    try { localStorage.removeItem(CACHE_KEY); } catch {}
    state.hoverCache.clear();
    state.identityStability.tracks.clear();
    clearTimeout(state.temporalRecheckTimer);
    await buildLibrary(true);
    await initMatcherWorker();
  });

  function serializeRanked(result) {
    if (!result?.ranked) return [];
    return result.ranked.slice(0,5).map((item, index) => ({
      rank: index + 1,
      name: item.ref?.name || null,
      type: item.ref?.type || null,
      image: item.ref?.image || null,
      matcherScore: Number(item.score || 0),
      visualIndex: visualIndex(Number(item.score || 0)),
      parts: item.parts ? {
        full: Number(item.parts.full || 0),
        art: Number(item.parts.art || 0),
        gradient: Number(item.parts.gradient || 0),
        patches: Number(item.parts.patches || 0),
        color: Number(item.parts.color || 0)
      } : null
    }));
  }

  let productStartPromise=null;

  async function startProductIdentification() {
    if (state.ready && state.matcherWorkerReady) {
      return {ready:true,cards:state.refs.length,workerReady:true};
    }
    if (productStartPromise) return productStartPromise;

    productStartPromise=(async()=>{
      await buildLibrary(false);
      if (state.ready) await initMatcherWorker();

      const detail={
        ready:Boolean(state.ready),
        cards:state.refs.length,
        workerReady:Boolean(state.matcherWorkerReady),
        error:state.matcherWorkerError || null
      };
      window.dispatchEvent(new CustomEvent('tcg-identification-library',{detail}));
      return detail;
    })().finally(()=>{productStartPromise=null;});

    return productStartPromise;
  }

  window.TCGIdentificationLab = {
    version: '0.2.1-alpha16-temporal-identity-guard',
    start: startProductIdentification,
    getAnalyzedCropDataUrl() {
      if (!state.hoveredTrack || state.lastAnalyzedTrackUid !== state.hoveredTrack.uid) return null;
      return state.lastAnalyzedCropDataUrl;
    },
    getSnapshot() {
      const result = state.lastResult;
      return {
        enabled: Boolean(ui.toggle?.checked),
        libraryReady: state.ready,
        librarySize: state.refs.length,
        matcherMs: Number(state.lastMatcherMs || 0),
        matcherTiming: state.lastMatcherTiming ? { ...state.lastMatcherTiming } : null,
        matcherWorker: {
          ready: Boolean(state.matcherWorkerReady),
          busy: Boolean(state.matcherWorkerBusy),
          queued: Boolean(state.matcherWorkerQueued),
          initPostMs: Number(state.matcherWorkerInitMs || 0),
          error: state.matcherWorkerError || null
        },
        hoverCache: {
          size: state.hoverCache.size,
          hits: state.hoverCacheHits,
          misses: state.hoverCacheMisses,
          ttlMs: HOVER_CACHE_TTL_MS,
          rejects: { ...state.hoverCacheRejects }
        },
        pointerInsideStage: state.pointerInsideStage,
        pointer: state.pointer ? { ...state.pointer } : null,
        spatialPointer: {
          grid: '3x3 row-major',
          hits: [...state.pointerHitHeatmap],
          misses: [...state.pointerMissHeatmap]
        },
        qualityGuard: {
          moderate: state.qualityGuard.moderate,
          high: state.qualityGuard.high,
          rejected: state.qualityGuard.rejected,
          tightened: state.qualityGuard.tightened,
          last: state.qualityGuard.last ? { ...state.qualityGuard.last } : null
        },
        identityStability: {
          activeTracks: state.identityStability.tracks.size,
          switchConfirmations: IDENTITY_SWITCH_CONFIRMATIONS,
          glareSwitchConfirmations: IDENTITY_SWITCH_CONFIRMATIONS_GLARE,
          switchWindowMs: IDENTITY_SWITCH_WINDOW_MS,
          transientHoldMs: IDENTITY_TRANSIENT_HOLD_MS,
          recheckMs: IDENTITY_RECHECK_MS,
          switchesSuppressed: state.identityStability.switchesSuppressed,
          switchesConfirmed: state.identityStability.switchesConfirmed,
          transientHolds: state.identityStability.transientHolds,
          holdsExpired: state.identityStability.holdsExpired,
          rechecks: state.identityStability.rechecks,
          stableRefreshes: state.identityStability.stableRefreshes,
          last: state.identityStability.last ? { ...state.identityStability.last } : null
        },
        hoveredTrack: state.hoveredTrack ? { ...state.hoveredTrack } : null,
        identification: (result?.best && state.hoveredTrack && state.lastTrackUid === state.hoveredTrack.uid) ? {
          accepted: Boolean(result.accepted),
          best: {
            name: result.best.ref?.name || null,
            type: result.best.ref?.type || null,
            image: result.best.ref?.image || null,
            matcherScore: Number(result.best.score || 0),
            visualIndex: visualIndex(Number(result.best.score || 0))
          },
          second: result.second ? {
            name: result.second.ref?.name || null,
            image: result.second.ref?.image || null,
            matcherScore: Number(result.second.score || 0),
            visualIndex: visualIndex(Number(result.second.score || 0))
          } : null,
          margin: Number(result.margin || 0),
          mode: result.mode || 'normal',
          rejectionReason: result.rejectionReason || null,
          quality: result.quality ? { ...result.quality } : null,
          overlap: Number(result.overlap || 0),
          mask: result.maskDiagnostics ? {
            visibleFraction: Number(result.maskDiagnostics.visibleFraction || 0),
            maskedBy: Number(result.maskDiagnostics.maskedBy || 0),
            maxOverlap: Number(result.maskDiagnostics.maxOverlap || 0),
            bestScore: Number(result.maskDiagnostics.bestScore || 0),
            margin: Number(result.maskDiagnostics.margin || 0),
            testedCandidates: Number(result.maskDiagnostics.testedCandidates || 0),
            candidates: result.maskDiagnostics.candidates.slice(0,5).map((x,index)=>({
              rank:index+1,
              name:x.ref?.name || null,
              image:x.ref?.image || null,
              matcherScore:Number(x.score || 0)
            }))
          } : null,
          candidates: serializeRanked(result)
        } : null
      };
    }
  };

  clearResult('Vision inactive · en attente de la partie.');
})();
