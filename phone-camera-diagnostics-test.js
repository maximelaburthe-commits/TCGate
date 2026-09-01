'use strict';
const phone=require('./public/phone-camera-diagnostics.js');
const assert=(value,message)=>{if(!value)throw new Error(message);};
const stats=new Map([
  ['local',{id:'local',type:'local-candidate',candidateType:'relay',protocol:'udp',relayProtocol:'tcp',address:'192.0.2.1'}],
  ['remote',{id:'remote',type:'remote-candidate',candidateType:'srflx',protocol:'udp',ip:'198.51.100.2'}],
  ['pair',{id:'pair',type:'candidate-pair',state:'succeeded',nominated:true,localCandidateId:'local',remoteCandidateId:'remote',currentRoundTripTime:.072}],
  ['codec',{id:'codec',type:'codec',mimeType:'video/VP8'}],
  ['out',{id:'out',type:'outbound-rtp',kind:'video',codecId:'codec',framesEncoded:100,framesSent:99,totalEncodeTime:2,framesPerSecond:29,encoderImplementation:'libvpx',powerEfficientEncoder:false}],
  ['in',{id:'in',type:'inbound-rtp',kind:'video',packetsReceived:500,packetsLost:2,jitter:.01,framesDecoded:90,framesDropped:3,jitterBufferDelay:.9,jitterBufferTargetDelay:1.1,jitterBufferEmittedCount:90,totalDecodeTime:1.8,totalProcessingDelay:2.4}]
]);
const diagnostics=phone.collect(stats);
assert(diagnostics.route.localCandidateType==='relay'&&diagnostics.route.remoteCandidateType==='srflx'&&diagnostics.route.localProtocol==='udp'&&diagnostics.route.relayProtocol==='tcp'&&diagnostics.route.usingRelay,'generic ICE route missing');
assert(diagnostics.sender.framesEncoded===100&&diagnostics.sender.framesSent===99&&diagnostics.sender.averageEncodeMsPerFrame===20,'sender diagnostics incorrect');
assert(diagnostics.sender.codec==='video/VP8'&&diagnostics.sender.encoderImplementation==='libvpx'&&diagnostics.sender.powerEfficientEncoder===false&&diagnostics.sender.rttMs===72,'encoder diagnostics incorrect');
assert(diagnostics.receiver.averageJitterBufferMsPerFrame===10&&diagnostics.receiver.averageDecodeMsPerFrame===20,'receiver derived metrics incorrect');
assert(phone.averageMs(null,0)===null&&phone.averageMs(1,null)===null,'null-safe average invalid');
const serialized=JSON.stringify(diagnostics);
assert(!serialized.includes('192.0.2.1')&&!serialized.includes('198.51.100.2')&&!/sdp|address|candidate\s*:/i.test(serialized),'private WebRTC material leaked');
console.log('PHONE_CAMERA_DIAGNOSTICS_OK');
