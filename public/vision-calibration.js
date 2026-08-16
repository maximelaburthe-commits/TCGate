
'use strict';

(() => {
  const state={
    status:'idle',
    startedAt:null,
    completedAt:null,
    width:null,
    height:null,
    samples:0,
    meanBrightness:null,
    brightnessStd:null,
    meanDetail:null,
    baselineBrightness:null,
    reasons:[],
    runId:0,
    lastMonitorAt:null,
    automaticRecalibrations:0,
    monitorTimer:null
  };

  const canvas=document.createElement('canvas');
  canvas.width=160;
  canvas.height=90;
  const ctx=canvas.getContext('2d',{willReadFrequently:true,alpha:false});

  const mean=xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;
  const std=(xs,m=mean(xs))=>xs.length?Math.sqrt(mean(xs.map(v=>(v-m)*(v-m)))):0;

  function sample(video){
    if (!video?.videoWidth || !video?.videoHeight) return null;
    ctx.drawImage(video,0,0,canvas.width,canvas.height);
    const px=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    const gray=new Float32Array(canvas.width*canvas.height);

    let sum=0;
    for(let p=0,i=0;p<gray.length;p++,i+=4){
      const g=(.299*px[i]+.587*px[i+1]+.114*px[i+2])/255;
      gray[p]=g;
      sum+=g;
    }

    let detail=0,n=0;
    for(let y=1;y<canvas.height;y+=2){
      for(let x=1;x<canvas.width;x+=2){
        const p=y*canvas.width+x;
        detail+=Math.abs(gray[p]-gray[p-1])+Math.abs(gray[p]-gray[p-canvas.width]);
        n+=2;
      }
    }
    return {brightness:sum/gray.length,detail:detail/Math.max(1,n)};
  }

  function snapshot(){
    return {
      version:'0.6-calibration-v1',
      status:state.status,
      startedAt:state.startedAt,
      completedAt:state.completedAt,
      video:{width:state.width,height:state.height},
      samples:state.samples,
      meanBrightness:Number.isFinite(state.meanBrightness)?Number(state.meanBrightness.toFixed(4)):null,
      brightnessStd:Number.isFinite(state.brightnessStd)?Number(state.brightnessStd.toFixed(4)):null,
      meanDetail:Number.isFinite(state.meanDetail)?Number(state.meanDetail.toFixed(4)):null,
      reasons:[...state.reasons],
      automaticRecalibrations:state.automaticRecalibrations,
      lastMonitorAt:state.lastMonitorAt
    };
  }

  function emit(){
    window.dispatchEvent(new CustomEvent('tcg-calibration-updated',{detail:snapshot()}));
  }

  async function run(video,reason='initial'){
    const runId=++state.runId;
    state.status='calibrating';
    state.startedAt=new Date().toISOString();
    state.reasons=[];
    emit();

    const brightness=[],detail=[];
    const started=performance.now();

    while(performance.now()-started<3200 && runId===state.runId){
      const s=sample(video);
      if(s){brightness.push(s.brightness);detail.push(s.detail);}
      await new Promise(r=>setTimeout(r,120));
    }

    if(runId!==state.runId) return snapshot();

    state.width=video?.videoWidth || null;
    state.height=video?.videoHeight || null;
    state.samples=brightness.length;
    state.meanBrightness=mean(brightness);
    state.brightnessStd=std(brightness,state.meanBrightness);
    state.meanDetail=mean(detail);
    state.completedAt=new Date().toISOString();

    if(reason!=='initial') state.automaticRecalibrations+=1;

    if(!state.width || !state.height || state.samples<8){
      state.status='error';
      state.reasons.push('flux vidéo insuffisant');
    }else{
      if(Math.min(state.width,state.height)<480) state.reasons.push('résolution faible');
      if(state.meanBrightness<.12) state.reasons.push('image trop sombre');
      if(state.meanBrightness>.92) state.reasons.push('image surexposée');
      if(state.meanDetail<.018) state.reasons.push('image peu détaillée / floue');

      state.status=state.reasons.length?'partial':'ok';
      state.baselineBrightness=state.meanBrightness;
    }

    emit();
    monitor(video);
    return snapshot();
  }

  function monitor(video){
    clearInterval(state.monitorTimer);
    state.monitorTimer=setInterval(()=>{
      if(!video?.videoWidth || state.status==='calibrating') return;
      const s=sample(video);
      if(!s) return;
      state.lastMonitorAt=new Date().toISOString();

      if(Number.isFinite(state.baselineBrightness) &&
         Math.abs(s.brightness-state.baselineBrightness)>.24){
        const last=state.completedAt?Date.parse(state.completedAt):0;
        if(Date.now()-last>30000) run(video,'lighting-change').catch(()=>{});
      }
    },5000);
  }

  function stop(){
    state.runId+=1;
    clearInterval(state.monitorTimer);
    state.monitorTimer=null;
    state.status='idle';
    emit();
  }

  window.TCGVisionCalibration={start:run,stop,getSnapshot:snapshot};
})();
