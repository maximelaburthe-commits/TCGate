(function(root,factory){
  const api=factory();
  if(typeof module==='object' && module.exports) module.exports=api;
  else root.TCGVisionFrameGate=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  function percentile(values,p){
    const sorted=values.filter(Number.isFinite).slice().sort((a,b)=>a-b);
    if(!sorted.length) return 0;
    const index=Math.min(sorted.length-1,Math.max(0,Math.ceil(sorted.length*p)-1));
    return sorted[index];
  }

  class LatestFrameGate {
    constructor({sampleLimit=240}={}){
      this.sampleLimit=Math.max(1,Number(sampleLimit)||240);
      this.reset();
    }

    reset(){
      this.inFlight=false;
      this.activeId=null;
      this.sequence=0;
      this.requested=0;
      this.processed=0;
      this.dropped=0;
      this.maxQueueDepth=0;
      this.durations=[];
    }

    tryAcquire(meta=null,now=performance.now()){
      this.requested+=1;
      if(this.inFlight){
        this.dropped+=1;
        return null;
      }
      this.inFlight=true;
      this.maxQueueDepth=Math.max(this.maxQueueDepth,1);
      const token={id:++this.sequence,meta,startedAt:now};
      this.activeId=token.id;
      return token;
    }

    complete(token,now=performance.now()){
      if(!token || !this.inFlight || token.id!==this.activeId) return false;
      this.inFlight=false;
      this.activeId=null;
      this.processed+=1;
      const duration=Math.max(0,now-token.startedAt);
      this.durations.push(duration);
      if(this.durations.length>this.sampleLimit) this.durations.splice(0,this.durations.length-this.sampleLimit);
      return true;
    }

    cancel(token){
      if(!token || !this.inFlight || token.id!==this.activeId) return false;
      this.inFlight=false;
      this.activeId=null;
      return true;
    }

    snapshot(){
      return {
        requested:this.requested,
        processed:this.processed,
        dropped:this.dropped,
        maxQueueDepth:this.maxQueueDepth,
        inFlight:this.inFlight?1:0,
        p50:percentile(this.durations,.50),
        p95:percentile(this.durations,.95)
      };
    }
  }

  return {LatestFrameGate,percentile};
});
