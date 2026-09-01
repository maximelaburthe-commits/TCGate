(function initPhoneCameraDiagnostics(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TCGatePhoneCameraDiagnostics = api;
})(typeof window !== 'undefined' ? window : globalThis, function createPhoneCameraDiagnostics() {
  'use strict';
  const candidateTypes=new Set(['host','srflx','prflx','relay']);
  const protocols=new Set(['udp','tcp','tls']);
  const generic=(value,allowed)=>allowed.has(String(value||'').toLowerCase())?String(value).toLowerCase():null;
  const averageMs=(totalSeconds,frames)=>{const total=Number(totalSeconds),count=Number(frames);return Number.isFinite(total)&&Number.isFinite(count)&&total>=0&&count>0?total*1000/count:null;};

  function collect(report) {
    const byId=new Map();report?.forEach?.(stat=>byId.set(stat.id,stat));
    let pair=null,sender=null,receiver=null;
    report?.forEach?.(stat=>{
      if(stat.type==='candidate-pair'&&stat.state==='succeeded'&&stat.nominated)pair=stat;
      if(stat.type==='outbound-rtp'&&!stat.isRemote&&(stat.kind||stat.mediaType)==='video')sender=stat;
      if(stat.type==='inbound-rtp'&&!stat.isRemote&&(stat.kind||stat.mediaType)==='video')receiver=stat;
    });
    const local=pair?byId.get(pair.localCandidateId):null,remote=pair?byId.get(pair.remoteCandidateId):null;
    const codec=sender?.codecId?byId.get(sender.codecId):null;
    return {
      route:{localCandidateType:generic(local?.candidateType,candidateTypes),remoteCandidateType:generic(remote?.candidateType,candidateTypes),localProtocol:generic(local?.protocol,protocols),remoteProtocol:generic(remote?.protocol,protocols),relayProtocol:generic(local?.relayProtocol||remote?.relayProtocol,protocols),usingRelay:local?.candidateType==='relay'||remote?.candidateType==='relay'},
      sender:sender?{framesEncoded:sender.framesEncoded??null,framesSent:sender.framesSent??null,totalEncodeTime:sender.totalEncodeTime??null,averageEncodeMsPerFrame:averageMs(sender.totalEncodeTime,sender.framesEncoded),bitrateKbps:null,fps:sender.framesPerSecond??null,codec:codec?.mimeType||null,encoderImplementation:sender.encoderImplementation||null,powerEfficientEncoder:sender.powerEfficientEncoder??null,rttMs:pair?.currentRoundTripTime!=null?pair.currentRoundTripTime*1000:null}:null,
      receiver:receiver?{packetsReceived:receiver.packetsReceived??null,packetsLost:receiver.packetsLost??null,jitter:receiver.jitter??null,framesDecoded:receiver.framesDecoded??null,framesDropped:receiver.framesDropped??null,jitterBufferDelay:receiver.jitterBufferDelay??null,jitterBufferTargetDelay:receiver.jitterBufferTargetDelay??null,jitterBufferEmittedCount:receiver.jitterBufferEmittedCount??null,totalDecodeTime:receiver.totalDecodeTime??null,totalProcessingDelay:receiver.totalProcessingDelay??null,averageJitterBufferMsPerFrame:averageMs(receiver.jitterBufferDelay,receiver.jitterBufferEmittedCount),averageDecodeMsPerFrame:averageMs(receiver.totalDecodeTime,receiver.framesDecoded)}:null
    };
  }
  return Object.freeze({averageMs,collect});
});
