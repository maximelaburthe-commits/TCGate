'use strict';
// Consolidation contracts: production functions in a VM and real local Phone HTTP/SSE.
// Hardware capabilities are fixtures; no physical Android or remote TURN is qualified.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),net=require('node:net');
const {spawn}=require('node:child_process');
const root=process.env.TCGATE_PHONE_TEST_ROOT||process.cwd();
const read=file=>fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n');
const mobile=read('public/phone-camera-client.js'),app=read('public/app.js');
const devices=require(path.join(root,'public/phone-camera-devices.js'));
const diagnostics=require(path.join(root,'public/phone-camera-diagnostics.js'));
let assertions=0;
function check(value,label){assert(value,label);assertions++;}
function equal(actual,expected,label){assert.deepEqual(JSON.parse(JSON.stringify(actual)),expected,label);assertions++;}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function functionSource(source,name){
  const expression=new RegExp('^(?:async )?function '+name+'\\(', 'm'),match=expression.exec(source);
  assert(match,'Missing production function '+name);
  const remaining=source.slice(match.index),next=/\n(?:async )?function [\w$]+\(/.exec(remaining);
  return next?remaining.slice(0,next.index):remaining;
}
function subject(source,name,globals){
  const privacyPath=path.join(root,'public/phone-camera-privacy.js'),privacy=fs.existsSync(privacyPath)?require(privacyPath):undefined;
  const window={TCGatePhoneCameraDevices:devices,TCGatePhoneCameraControl:require(path.join(root,'public/phone-camera-control.js')),TCGatePhoneCameraPrivacy:privacy};
  const context=vm.createContext({window,...globals,console});vm.runInContext(functionSource(source,name)+'\nthis.subject='+name+';',context);return context.subject;
}
function element(){const classes=new Set(['hidden']);return {value:'',textContent:'',classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)}};}
async function unitContracts(){
  const elements=Object.fromEntries(['resolution','camera','zoomWrap','zoom','zoomValue'].map(id=>[id,element()]));
  elements.resolution.value='auto';elements.camera.value='';
  const state={autoProfile:'1280x720',cameraCapabilities:null},events=[],$=id=>elements[id];
  const currentProfile=subject(mobile,'currentProfile',{$,st:state});
  const capture=subject(mobile,'captureConstraints',{$,st:state,currentProfile});
  const constraints=capture();
  equal(constraints.audio,false,'Phone never requests microphone');equal(constraints.video.facingMode,{ideal:'environment'},'Default camera asks for rear-facing hardware');
  equal(constraints.video.width,{ideal:1280,max:1280});equal(constraints.video.height,{ideal:720,max:720});equal(constraints.video.frameRate,{ideal:30,max:30});
  const hd=capture('private-device-fixture','1920x1080');equal(hd.audio,false);equal(hd.video.width,{ideal:1920,max:1920});equal(hd.video.height,{ideal:1080,max:1080});
  equal(hd.video.deviceId,{exact:'private-device-fixture'},'Raw hardware ID is used only locally for acquisition');
  const log=(type,data)=>events.push({type,data});
  const autofocus=subject(mobile,'ensureContinuousAutofocus',{log});let applied=[];
  await autofocus({getCapabilities:()=>({}),getSettings:()=>({}),applyConstraints:async value=>applied.push(value)});
  equal(applied,[],'Absent autofocus capability does not force unsupported constraints');
  await autofocus({getCapabilities:()=>({focusMode:['continuous','manual']}),getSettings:()=>({focusMode:'continuous'}),applyConstraints:async value=>applied.push(value)});
  equal(applied,[{advanced:[{focusMode:'continuous'}]}],'Continuous AF is requested only when advertised');
  await autofocus({getCapabilities:()=>({focusMode:['continuous']}),applyConstraints:async()=>{throw Error('unsupported');}});
  check(events.some(e=>e.type==='autofocus-native-error'),'Refused autofocus is diagnostic, not fatal');
  await autofocus(null);check(true,'Missing track is tolerated');
  await autofocus({});check(true,'A browser without getCapabilities does not receive forced focus constraints');
  const describe=subject(mobile,'describeZoom',{$,st:state,cleanCapabilities:caps=>{const clean={...caps};delete clean.deviceId;delete clean.groupId;return clean;}});
  describe({getCapabilities:()=>({zoom:{min:1,max:3,step:.25},deviceId:'private-device-fixture'}),getSettings:()=>({zoom:1.5})});
  check(!elements.zoomWrap.classList.contains('hidden'),'Supported zoom is exposed');equal(elements.zoom.min,'1');equal(elements.zoom.max,'3');equal(elements.zoom.step,'0.25');
  check(!JSON.stringify(state.cameraCapabilities).includes('private-device-fixture'),'Camera capability diagnostics exclude raw ID');
  describe({getCapabilities:()=>({})});check(elements.zoomWrap.classList.contains('hidden'),'Unsupported zoom stays hidden');
  let values=[];state.stream={getVideoTracks:()=>[{getCapabilities:()=>({zoom:{min:1,max:3}}),applyConstraints:async c=>values.push(c.advanced[0].zoom)}]};
  const zoom=subject(mobile,'setZoomRemote',{$,st:state,log,pushControlState:async()=>{},controlSnapshot:()=>({})});
  await zoom(.2);await zoom(4);await zoom(2);equal(values,[1,3,2],'Mobile clamps zoom to the actual track capability');
  const before=values.length;await assert.rejects(()=>zoom(NaN));assertions++;
  equal(values.length,before,'Non-finite zoom never reaches applyConstraints');
  state.stream={getVideoTracks:()=>[{getCapabilities:()=>({})}]};await assert.rejects(()=>zoom(2));assertions++;
  const batteryState={energy:{batterySupported:null}},batteryEvents=[];
  const batteryNoApi=subject(mobile,'initBatteryTelemetry',{navigator:{},st:batteryState,updateBatteryUi:()=>{},log:(type)=>batteryEvents.push(type)});
  await batteryNoApi();equal(batteryState.energy.batterySupported,false);check(batteryEvents.includes('battery-api-unavailable'),'Battery API is optional');
  const batteryRejected=subject(mobile,'initBatteryTelemetry',{navigator:{getBattery:async()=>{throw Error('denied');}},st:batteryState,updateBatteryUi:()=>{},log:()=>{}});
  await batteryRejected();equal(batteryState.energy.batterySupported,false,'Battery refusal does not break capture');
  const listeners=[],manager={addEventListener:name=>listeners.push(name)};
  const batteryPresent=subject(mobile,'initBatteryTelemetry',{navigator:{getBattery:async()=>manager},st:batteryState,updateBatteryUi:()=>{},log:()=>{},recordBatterySample:()=>({levelPct:50,charging:false}),pushControlState:async()=>{}});
  await batteryPresent();equal(batteryState.energy.batterySupported,true);equal(listeners,['levelchange','chargingchange','chargingtimechange','dischargingtimechange']);
  await pcMicrophoneContract();await pcMicrophoneRecoveryContract();await cameraSwitchContracts();await profileContracts();await energyContract();await policyAndPrivacyContracts();await remoteCommandRegressions();
  const publicCameras=devices.publicCameraList([{kind:'videoinput',deviceId:'secret-front',label:'Front Camera'},{kind:'videoinput',deviceId:'secret-rear',label:'Back Camera'},{kind:'videoinput',deviceId:'secret-ultra',label:'Ultra Wide'},{kind:'videoinput',deviceId:'secret-tele',label:'Telephoto'}],'secret-rear');
  equal(publicCameras.map(c=>c.id),['camera-1','camera-2','camera-3']);check(!JSON.stringify(publicCameras).includes('secret-'),'Opaque camera list exposes no deviceId');
  equal(publicCameras.map(c=>c.kind),['rear','ultrawide','tele']);equal(devices.publicCameraList([{kind:'videoinput',deviceId:'front',label:'Front Camera'}])[0].kind,'front','Front camera remains a fallback when no rear input exists');
  const stats=new Map([['a',{id:'a',type:'local-candidate',candidateType:'relay',protocol:'udp',ip:'203.0.113.1'}],['b',{id:'b',type:'remote-candidate',candidateType:'host',protocol:'udp',address:'2001:db8::1'}],['p',{id:'p',type:'candidate-pair',state:'succeeded',nominated:true,localCandidateId:'a',remoteCandidateId:'b',currentRoundTripTime:.05}],['out',{id:'out',type:'outbound-rtp',kind:'video',framesEncoded:20,totalEncodeTime:.2}],['in',{id:'in',type:'inbound-rtp',kind:'video',framesDecoded:15,framesDropped:2,totalDecodeTime:.03,jitter:.01}]]);
  const result=diagnostics.collect(stats);equal(result.route.usingRelay,true);equal(result.sender.averageEncodeMsPerFrame,10);equal(result.receiver.averageDecodeMsPerFrame,2);
  check(!/203\.0\.113|2001:db8|"(?:ip|address|sdp|deviceId|token)"/i.test(JSON.stringify(result)),'ICE diagnostics expose route categories, not raw network data');
  stats.set('codec',{id:'codec',type:'codec',mimeType:'video/VP8 203.0.113.27 Bearer fixture-private-token'});
  stats.get('out').codecId='codec';stats.get('out').encoderImplementation='encoder at [2001:db8::55]';
  check(!/203\.0\.113|2001:db8|fixture-private-token/.test(JSON.stringify(diagnostics.collect(stats))),'Arbitrary codec/encoder diagnostic strings are sanitized too');
}
async function pcMicrophoneContract(){
  const stopped=[];const video={kind:'video',readyState:'live',stop:()=>stopped.push('webcam')},audio={kind:'audio',readyState:'live',stop:()=>stopped.push('microphone')},phone={kind:'video',readyState:'live'};
  class Stream{constructor(tracks){this.tracks=tracks;}getTracks(){return this.tracks;}getAudioTracks(){return this.tracks.filter(t=>t.kind==='audio');}getVideoTracks(){return this.tracks.filter(t=>t.kind==='video');}}
  const state={localStream:new Stream([video,audio]),videoTransceiver:{sender:{track:video,async replaceTrack(track){this.track=track;}}}};
  const preview={play:async()=>{}};
  const adopt=subject(app,'usePhoneVideoTrack',{state,MediaStream:Stream,currentVideoTrack:()=>video,currentAudioTrack:()=>audio,$:()=>preview,attachLocalTrackLifecycle:()=>{},configureVideoSenderPolicy:async()=>{},updateMediaUi:()=>{},updateGameDeviceStatus:()=>{},sendCurrentMediaState:async()=>{},logEvent:()=>{},safeTrackSettings:()=>({})});
  await adopt(phone,new Stream([phone]));equal(state.localStream.getAudioTracks().length,1);check(state.localStream.getAudioTracks()[0]===audio,'PC microphone identity is retained');check(state.videoTransceiver.sender.track===phone,'Phone replaces the video sender only');equal(stopped,['webcam'],'Only the obsolete webcam track is stopped');equal(state.videoSource,'phone');
}
async function pcMicrophoneRecoveryContract(){
  class Stream{constructor(tracks){this.tracks=tracks;}getTracks(){return this.tracks;}getAudioTracks(){return this.tracks.filter(track=>track.kind==='audio');}getVideoTracks(){return this.tracks.filter(track=>track.kind==='video');}}
  for(const [selectedCameraId,savedCameraId,expectedCameraId]of [[null,'saved-webcam','saved-webcam'],['current-webcam','saved-webcam','current-webcam'],[null,null,null]]){
    let acquisition,saved;const stopped=[],audio={kind:'audio',readyState:'live',getSettings:()=>({deviceId:'runtime-pc-microphone'}),stop:()=>stopped.push('new-microphone')};
    const state={selectedCameraId,selectedMicrophoneId:null,localStream:new Stream([{kind:'video',stop:()=>stopped.push('old-video')},{kind:'audio',stop:()=>stopped.push('old-audio')}]),audioTransceiver:{sender:{async replaceTrack(track){this.track=track;}}}};
    const elements={lobbyPreview:{},localVideo:{}};
    const start=subject(app,'startPcMicrophoneOnly',{state,MediaStream:Stream,navigator:{mediaDevices:{getUserMedia:async constraints=>{acquisition=constraints;return new Stream([audio]);}}},$:id=>elements[id],readMediaPreferences:()=>({cameraId:savedCameraId,microphoneId:'saved-microphone'}),saveMediaPreferences:()=>{saved={cameraId:state.selectedCameraId,microphoneId:state.selectedMicrophoneId};},attachLocalTrackLifecycle:()=>{},updateMediaUi:()=>{},logEvent:()=>{},safeTrackSettings:()=>({})});
    equal(await start('saved-microphone'),true);equal(acquisition.video,false,'Phone recovery asks for no PC webcam');equal(acquisition.audio.deviceId,{exact:'saved-microphone'});
    equal(saved.cameraId,expectedCameraId,'Microphone-only setup preserves the saved or active webcam preference');equal(state.selectedCameraId,expectedCameraId);
    equal(state.localStream.getVideoTracks().length,0);equal(state.localStream.getAudioTracks().length,1,'Microphone-only recovery has exactly one PC audio source');
    check(state.localStream.getAudioTracks()[0]===audio&&state.audioTransceiver.sender.track===audio,'Recovered microphone is the PC sender track');
    equal(stopped,['old-video','old-audio'],'Old media is released without stopping the new PC microphone');
    check(elements.lobbyPreview.srcObject===state.localStream&&elements.localVideo.srcObject===state.localStream,'Both local previews follow the recovered PC microphone stream');
  }
  const order=[],state={roomCode:'ROOM42',peerId:'fixture-pc-peer'};
  const current={pairId:'fixture-pair',connected:true,cameraActive:true,state:{cameraDevices:[]}};
  const restore=subject(app,'restorePhoneCameraAfterRecovery',{state,api:async()=>{},window:{TCGatePhoneCamera:{findCurrent:async()=>current,restoreCurrent:async()=>{order.push('phone-restored');return current;}}},readMediaPreferences:()=>({cameraId:null,microphoneId:'saved-microphone'}),startPcMicrophoneOnly:async id=>{equal(id,'saved-microphone');order.push('microphone');},phoneCameraBindings:()=>({}),enumerateDevices:async()=>{order.push('enumerate-start');await Promise.resolve();order.push('enumerate-complete');},updatePhoneCameraUi:info=>{check(info.recovered===true,'Restored Phone UI is marked as recovered');order.push('ui');},logEvent:()=>{}});
  equal(await restore(),true);equal(order,['microphone','phone-restored','enumerate-start','enumerate-complete','ui'],'Device choices finish populating before the recovered Phone UI is updated');
}
async function cameraSwitchContracts(){
  const calls=[];let releaseLate,lateStopped=0,targetActivated=0;
  const target=new Promise(resolve=>releaseLate=resolve);
  const pending=devices.runCameraSwitch({stopCurrent:()=>calls.push('stop'),acquireTarget:()=>target,activateTarget:async()=>targetActivated++,acquirePrevious:async()=>{calls.push('reacquire');return {stream:{getTracks:()=>[]},track:{}};},activatePrevious:async()=>calls.push('rollback'),acquisitionTimeoutMs:12}).catch(e=>e);
  await sleep(25);releaseLate({stream:{getTracks:()=>[{stop:()=>lateStopped++}]},track:{}});const error=await pending;await sleep(0);
  equal(error.name,'CameraAcquisitionTimeoutError');equal(error.rollbackRestored,true);equal(calls,['stop','reacquire','rollback']);equal(lateStopped,1,'Late stream is stopped after timeout');equal(targetActivated,0,'Late track is never activated');
  let mismatchedStopped=0;const mismatch=await devices.runCameraSwitch({stopCurrent:()=>{},acquireTarget:async()=>({stream:{getTracks:()=>[{stop:()=>mismatchedStopped++}]},track:{}}),verifyTarget:()=>false,activateTarget:async()=>assert.fail('Mismatched lens activated'),acquirePrevious:async()=>({stream:{getTracks:()=>[]},track:{}}),activatePrevious:async()=>{}}).catch(e=>e);
  equal(mismatch.name,'CameraMismatchError');equal(mismatch.rollbackRestored,true);equal(mismatchedStopped,1);
  const doubleFailure=await devices.runCameraSwitch({stopCurrent:()=>{},acquireTarget:async()=>{throw Object.assign(Error('target failed'),{name:'NotReadableError'});},activateTarget:async()=>{},acquirePrevious:async()=>{throw Object.assign(Error('rollback failed'),{name:'NotFoundError'});},activatePrevious:async()=>{}}).catch(e=>e);
  equal(doubleFailure.rollbackRestored,false);equal(doubleFailure.rollbackErrorName,'NotFoundError');
}
async function profileContracts(){
  const elements={resolution:{value:'1920x1080'}},state={stream:{getVideoTracks:()=>[{getSettings:()=>({width:1920,height:1080,frameRate:30})}]},captureBusy:false,recoveryActive:false,pc:{connectionState:'connected'},lastConnectedAt:0,lastCaptureChangeAt:0,lowFpsStreak:0,autoDowngrades:0,lowResolutionStreak:0,qualityFloorBreaches:0};
  const changes=[],adapt=subject(mobile,'maybeAutoAdapt',{$:id=>elements[id],st:state,log:()=>{},status:()=>{},applyCaptureProfile:async(profile,reason)=>{changes.push({profile,reason});return true;}});
  for(let i=0;i<3;i++)await adapt({fps:20,width:1920,height:1080});equal(changes.length,0,'1080p experimental fallback waits for sustained low FPS');await adapt({fps:20,width:1920,height:1080});equal(changes,[{profile:'1280x720',reason:'1080-low-fps'}]);equal(state.autoDowngrades,1);
  elements.resolution.value='auto';state.lowResolutionStreak=0;
  for(let i=0;i<4;i++)await adapt({fps:20,width:640,height:360});equal(state.qualityFloorBreaches,1);equal(changes.length,1,'720p reference is observed without an invented lower auto profile');
}
async function energyContract(){
  const state={performanceHistory:Array.from({length:6},(_,index)=>({framesEncoded:index*30,totalEncodeTime:index*.3,fps:30,qualityLimitationReason:'none'})),metrics:{qualityLimitationDurations:{cpu:0}},energy:{manualThermalFeel:'hot'},autoDowngrades:0,qualityFloorBreaches:0};
  const analyze=subject(mobile,'thermalAnalysis',{st:state,median:subject(mobile,'median',{})});
  const stable=analyze();equal(stable.status,'stable');equal(stable.userFeel,'hot','Manual thermal feel remains separate from measured performance');
  check(!Object.keys(stable).some(key=>/temperature|celsius/i.test(key)),'Performance proxy fabricates no hardware temperature');
  check(/Proxy|proxy/.test(stable.note),'Thermal interpretation identifies itself as an indirect estimate');
  state.metrics.qualityLimitationDurations.cpu=60;state.performanceHistory.forEach(sample=>{sample.fps=20;sample.qualityLimitationReason='cpu';});
  equal(analyze().status,'throttling-suspected','Observed CPU limitation and low FPS drive the indirect warning');
}
function assertSanitized(value,label){
  const text=JSON.stringify(value);
  check(!/203\.0\.113\.27|198\.51\.100\.91|2001:db8|fixture-private-token|raw-device-fixture|v=0|candidate:987|data:image|blob:private/i.test(text),label+' strips private values');
  check(!/"(?:ip|address|sdp|candidate|deviceId|groupId|token|authorization|sessionToken|image|frame|screenshot)"\s*:/i.test(text),label+' strips private keys');
  check(text.includes('camera-1'),label+' retains opaque camera metadata');
}
async function policyAndPrivacyContracts(){
  const policy=require(path.join(root,'public/phone-camera-control.js')),privacy=require(path.join(root,'public/phone-camera-privacy.js'));
  check(typeof policy.validatePhoneControlPayload==='function','Command validation is shared with the product server');
  check(typeof policy.availableCaptureProfiles==='function','Supported profiles derive from reported hardware capabilities');
  const state=maliciousDiagnostics(),payload=(action,args)=>({requestId:'unit-command',action,args});
  check(policy.validatePhoneControlPayload(payload('set-quality',{mode:'1920x1080'}),state),'Advertised 1080p30 is supported');
  check(!policy.validatePhoneControlPayload(payload('set-quality',{mode:'1920x1080'}),{captureCapabilities:{width:{min:640,max:1280},height:{min:360,max:720},frameRate:{min:15,max:30}}}),'1080p is rejected when camera cannot provide it');
  check(!policy.validatePhoneControlPayload(payload('set-quality',{mode:'1280x720'}),{captureCapabilities:{width:{min:640,max:1920},height:{min:360,max:1080},frameRate:{min:15,max:24}}}),'Manual 30fps profile requires advertised 30fps');
  check(policy.validatePhoneControlPayload(payload('set-quality',{mode:'auto'}),{}),'Automatic baseline is available when ranges are absent');
  check(!policy.validatePhoneControlPayload(payload('set-quality',{mode:'1280x720'}),{}),'Missing capability is never inferred as manual support');
  check(policy.validatePhoneControlPayload(payload('set-zoom',{value:1.5}),{zoom:{min:1,max:3,step:.5}}),'Valid zoom step is supported');
  check(!policy.validatePhoneControlPayload(payload('set-zoom',{value:1.3}),{zoom:{min:1,max:3,step:.5}}),'Invalid zoom step is rejected');
  check(!policy.validatePhoneControlPayload(payload('set-zoom',{value:2}),{}),'Zoom without a reported range is rejected');
  assertSanitized(privacy.sanitize(state),'Shared Phone privacy serialization');
  const withSecret=privacy.sanitize({message:'Error with opaque-private-value',fps:30,selectedCameraId:'camera-1'},{secrets:['opaque-private-value']});
  check(!JSON.stringify(withSecret).includes('opaque-private-value'),'Explicit local secrets are redacted from arbitrary strings');
  equal(withSecret.fps,30);equal(withSecret.selectedCameraId,'camera-1');
  const escaped=privacy.sanitize({message:'{"sdp":"v=0\\r\\no=- 1 2 IN IP4 203.0.113.27\\r\\nm=video 9 UDP/TLS/RTP/SAVPF 96"}',note:'candidate:987 1 udp 1 203.0.113.27 1000 typ host',username:'sensitive-username',credential:'sensitive-password',iceUfrag:'sensitive-ufrag',icePwd:'sensitive-ice-password',iceServers:[{urls:'turn:example.invalid',username:'sensitive-username',credential:'sensitive-password'}],selectedCameraId:'camera-1'});
  check(!/v=0|203\.0\.113|candidate:987|sensitive-|iceUfrag|icePwd|iceServers|username|credential/.test(JSON.stringify(escaped)),'Escaped SDP and ICE credentials are excluded from arbitrary diagnostic payloads');
  const prototype=privacy.sanitize(JSON.parse('{"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}},"fps":30}'));
  equal(Object.keys(prototype),['fps'],'Sanitizer drops prototype mutation keys');check({}.polluted===undefined,'Diagnostic sanitation never alters object prototypes');
  const batteryHistory=privacy.sanitize({report:{energy:{battery:{history:[{levelPct:80,charging:false,token:'bad'}]}}}});
  equal(batteryHistory.report.energy.battery.history[0],{levelPct:80,charging:false},'Nested PC report keeps useful battery history while excluding its secret');
  const deep={};let cursor=deep;for(let level=0;level<1000;level++){cursor.next={};cursor=cursor.next;}cursor.marker='deep-untrusted-payload';
  const bounded=JSON.stringify(privacy.sanitize(deep));check(bounded.length<1000&&!bounded.includes('deep-untrusted-payload'),'Excessively deep untrusted diagnostics remain bounded');
  const freeText=privacy.sanitize({message:'TURN credential=private-turn-secret',details:JSON.stringify({token:'private-unknown-token',credential:'private-credential'})});
  check(!freeText.message.includes('private-turn-secret'),'Unquoted credential assignment is redacted in free text');
  check(!/private-unknown-token|private-credential/.test(freeText.details),'Quoted JSON secrets inside diagnostic text are redacted');
}
async function remoteCommandRegressions(){
  const privacy=require(path.join(root,'public/phone-camera-privacy.js'));
  function fixture({busy=false,zoomFails=false,qualityFails=false}={}){
    const elements={resolution:{value:'auto'},camera:{value:'private-device-fixture'},zoom:{value:'2'},zoomValue:{textContent:'2.0×'}};
    const state={remoteCommandCount:0,captureBusy:busy,autoProfile:'1280x720',cameraDevices:[],stream:{getVideoTracks:()=>[{getCapabilities:()=>({zoom:{min:1,max:3,step:.1}}),applyConstraints:async()=>{if(zoomFails)throw Error('hardware zoom denied');}}]}};
    const replies=[],calls=[],snapshot={...maliciousDiagnostics(),captureCapabilities:{width:{min:640,max:1920},height:{min:360,max:1080},frameRate:{min:15,max:30}}};
    const globals={$:id=>elements[id],st:state,log:()=>{},pushControlState:async()=>{},controlSnapshot:()=>privacy.sanitize(snapshot),cleanPhoneError:error=>({name:error.name||'Error',message:error.message}),signal:async(type,payload)=>replies.push({type,payload}),currentProfile:()=>elements.resolution.value==='auto'?state.autoProfile:elements.resolution.value,changeResolution:async()=>{calls.push('quality');if(qualityFails)throw Error('hardware quality denied');},applyCaptureProfile:async(profile,reason)=>{calls.push(profile+':'+reason);return true;},cameraPublicId:()=> 'camera-1',switchCamera:async()=>{calls.push('switch');return{};},stopCamera:async()=>{calls.push('stop');}};
    globals.setZoomRemote=subject(mobile,'setZoomRemote',globals);
    return {state,elements,replies,calls,execute:subject(mobile,'executeRemoteControl',globals)};
  }
  for(const [action,args]of [['set-quality',{mode:'1920x1080'}],['select-camera',{cameraId:'camera-1'}],['wide',{}],['set-zoom',{value:2}]]){
    const f=fixture({busy:true});await f.execute({requestId:'busy-command',action,args});
    equal(f.replies.length,1);equal(f.replies[0].payload.ok,false,'Busy mutation never acknowledges success: '+action);equal(f.elements.resolution.value,'auto','Busy quality request cannot mutate the selected mode');equal(f.calls,[],'Busy mutation never applies capture changes');
  }
  const wide=fixture({zoomFails:true});await wide.execute({requestId:'wide-command',action:'wide',args:{}});
  equal(wide.replies.at(-1).payload.ok,false,'Wide reports hardware refusal instead of false success');equal(wide.elements.zoom.value,'2','Refused wide zoom leaves its confirmed UI value');equal(wide.state.captureBusy,false,'Refused zoom releases its busy guard');
  const quality=fixture({qualityFails:true});await quality.execute({requestId:'quality-command',action:'set-quality',args:{mode:'1920x1080'}});
  equal(quality.replies.at(-1).payload.ok,false,'Quality failure is explicit');equal(quality.replies.at(-1).payload.rollbackRestored,true,'Quality failure reports a confirmed restoration');equal(quality.elements.resolution.value,'auto');equal(quality.state.autoProfile,'1280x720');equal(quality.calls,['quality','1280x720:quality-rollback']);
}
function maliciousDiagnostics(){return {cameraActive:true,fps:30,deviceId:'raw-device-fixture',groupId:'raw-device-fixture',ip:'203.0.113.27',address:'2001:db8::55',sdp:'v=0\r\no=- 7 2 IN IP4 203.0.113.27\r\nm=video 9 UDP/TLS/RTP/SAVPF 96',candidate:'candidate:987 1 udp 1 203.0.113.27 5000 typ host',sessionToken:'fixture-private-token',authorization:'Bearer fixture-private-token',message:'camera failure at 198.51.100.91 and [2001:db8::55]; token=fixture-private-token deviceId=raw-device-fixture',nested:{image:'data:image/png;base64,AA==',frame:'blob:private',note:'Bearer fixture-private-token'},cameraDevices:[{id:'camera-1',label:'Caméra principale',kind:'rear',active:true}],zoom:{min:1,max:3,step:.1,value:1},captureCapabilities:{width:{min:640,max:1920,step:1},height:{min:360,max:1080,step:1},frameRate:{min:15,max:30,step:1}}};}
async function freePort(){return new Promise((resolve,reject)=>{const listener=net.createServer();listener.on('error',reject);listener.listen(0,'127.0.0.1',()=>{const port=listener.address().port;listener.close(()=>resolve(port));});});}
async function httpContracts(){
  const port=await freePort(),origin='http://127.0.0.1:'+port,child=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:String(port),HOST:'127.0.0.1',TCGATE_PHONE_PAIRING_TTL_MS:'500'},stdio:['ignore','pipe','pipe'],windowsHide:true});let logs='',reader,abort;
  child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);
  async function request(route,{method='GET',token,body,cookie}={}){const response=await fetch(origin+route,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {status:response.status,json:await response.json().catch(()=>null),headers:response.headers};}
  try{
    let ready=false;for(let i=0;i<80;i++){try{if((await fetch(origin+'/api/health')).ok){ready=true;break;}}catch{}await sleep(40);}check(ready,'Phone contract server starts');
    const page=await fetch(origin+'/phone');equal(page.status,200);check((await page.text()).includes('/phone-camera-client.js'),'Integrated /phone serves its product client');
    const phoneHtml=read('public/phone.html'),indexHtml=read('public/index.html');
    check(phoneHtml.indexOf('/phone-camera-privacy.js')>=0&&phoneHtml.indexOf('/phone-camera-privacy.js')<phoneHtml.indexOf('/phone-camera-diagnostics.js'),'Phone loads shared privacy before diagnostic serialization');
    check(indexHtml.indexOf('/phone-camera-privacy.js')>=0&&indexHtml.indexOf('/phone-camera-privacy.js')<indexHtml.indexOf('/phone-camera.js'),'PC loads shared privacy before the receiver');
    const ownerResult=await request('/api/rooms',{method:'POST',body:{name:'Consolidation PC',game:'no-game'}}),owner=ownerResult.json,cookie=ownerResult.headers.get('set-cookie').split(';')[0];equal(ownerResult.status,201);
    const created=await request('/api/phone/pairs',{method:'POST',token:owner.sessionToken,body:{room:owner.code,peerId:owner.peerId}}),pair=created.json;equal(created.status,201);
    check(pair.qrSvg.includes('<svg')&&pair.phoneUrl.includes('/phone?'),'QR points at the integrated phone page');check(!pair.phoneUrl.includes(owner.sessionToken)&&!pair.qrSvg.includes(owner.sessionToken),'Pairing link contains no PC bearer');equal(pair.expiresInMs,500,'Pair token TTL remains bounded and configurable');
    const oneTime=new URL(pair.phoneUrl).searchParams.get('token'),joined=await request('/api/phone/pairs/'+pair.pairId+'/join',{method:'POST',token:oneTime});equal(joined.status,200);const phoneToken=joined.json.phoneToken;
    check(phoneToken!==oneTime&&phoneToken!==owner.sessionToken,'Phone and pairing tokens are distinct from PC privileges');equal((await request('/api/phone/pairs/'+pair.pairId+'/join',{method:'POST',token:oneTime})).status,409,'Pair token is one-shot');
    equal((await request('/api/ready',{method:'POST',token:phoneToken,body:{room:owner.code,peerId:owner.peerId,ready:true}})).status,401,'Phone cannot Ready a PC peer');
    equal((await request('/api/rooms/'+owner.code,{method:'PATCH',token:phoneToken,body:{peerId:owner.peerId,name:'Forbidden rename'}})).status,401,'Phone cannot alter room metadata');
    const route='/api/phone/pairs/'+pair.pairId;
    equal((await request(route+'/events-ticket',{method:'POST',token:phoneToken,body:{role:'pc'}})).status,401,'Phone cannot mint PC event tickets');
    const poisoned=maliciousDiagnostics();
    equal((await request(route+'/state',{method:'POST',token:phoneToken,body:{state:poisoned}})).status,200);
    const state=await request(route+'/state',{token:owner.sessionToken});assertSanitized(state.json.state,'Stored state');equal(state.json.state.fps,30);
    equal((await request(route+'/report',{method:'POST',token:phoneToken,body:{report:poisoned}})).status,200);assertSanitized((await request(route+'/report',{token:owner.sessionToken})).json.report,'Stored report');
    const ticket=(await request(route+'/events-ticket',{method:'POST',token:owner.sessionToken,body:{role:'pc'}})).json.ticket;abort=new AbortController();const stream=await fetch(origin+'/api/phone/events?ticket='+encodeURIComponent(ticket),{signal:abort.signal});equal(stream.status,200);reader=stream.body.getReader();
    let buffer='';const queue=[];
    async function nextSignal(type){const timeout=AbortSignal.timeout(5000);while(!timeout.aborted){const matching=queue.findIndex(e=>e.event==='signal'&&e.data.type===type);if(matching>=0)return queue.splice(matching,1)[0].data;const {value,done}=await Promise.race([reader.read(),new Promise((_,reject)=>timeout.addEventListener('abort',()=>reject(Error('Signal wait timed out')),{once:true}))]);if(done)throw Error('Phone SSE closed');buffer+=new TextDecoder().decode(value);let end;while((end=buffer.indexOf('\n\n'))>=0){const block=buffer.slice(0,end);buffer=buffer.slice(end+2);const event=/^event:\s*(.+)$/m.exec(block)?.[1],data=/^data:\s*(.+)$/m.exec(block)?.[1];if(event&&data)queue.push({event,data:JSON.parse(data)});}}throw Error('Signal wait timed out');}
    for(const type of ['control-state','control-result']){const payload=type==='control-state'?poisoned:{requestId:'sanitizer-1',action:'request-state',ok:true,state:poisoned,error:'request at 198.51.100.91 token=fixture-private-token'};equal((await request(route+'/signal',{method:'POST',token:phoneToken,body:{role:'phone',type,payload}})).status,200);assertSanitized((await nextSignal(type)).payload,'Relayed '+type);}
    const pcSignal=payload=>request(route+'/signal',{method:'POST',token:owner.sessionToken,body:{role:'pc',type:'control',payload}});
    for(const [action,args]of [['select-camera',{cameraId:'camera-1'}],['request-state',{}],['wide',{}],['stop-camera',{}],['set-quality',{mode:'auto'}],['set-quality',{mode:'1280x720'}],['set-quality',{mode:'1920x1080'}],['set-zoom',{value:1}],['set-zoom',{value:2}],['set-zoom',{value:3}]])equal((await pcSignal({requestId:'allowed-command',action,args})).status,200,'Explicit command accepted: '+action);
    for(const payload of [
      {requestId:'badcmd',action:'select-camera',args:{cameraId:'raw-device-fixture'}},
      {requestId:'badcmd',action:'select-camera',args:{cameraId:'camera-0'}},
      {requestId:'badcmd',action:'set-quality',args:{mode:'3840x2160'}},
      {requestId:'badcmd',action:'set-quality',args:{mode:'auto',constraints:{audio:true}}},
      {requestId:'badcmd',action:'set-zoom',args:{value:'2'}},
      {requestId:'badcmd',action:'set-zoom',args:{value:null}},
      {requestId:'badcmd',action:'set-zoom',args:{value:.5}},
      {requestId:'badcmd',action:'set-zoom',args:{value:4}},
      {requestId:'badcmd',action:'set-zoom',args:{value:101}},
      {requestId:'badcmd',action:'set-focus',args:{mode:'manual',distance:2}},
      {requestId:'badcmd',action:'request-state',args:{constraints:{video:true}}},
      {requestId:'badcmd',action:'wide',args:[]},
      {requestId:'short',action:'request-state',args:{}},
      {requestId:'x'.repeat(81),action:'request-state',args:{}},
      {requestId:'badcmd',action:'request-state',args:{},extra:'not allowed'}
    ])equal((await pcSignal(payload)).status,400,'Noncanonical or unsupported command refused');
    equal((await request(route+'/signal',{method:'POST',token:phoneToken,body:{role:'pc',type:'control',payload:{requestId:'badprivilege',action:'set-zoom',args:{value:2}}}})).status,401,'Phone cannot issue PC commands');
    equal((await request(route+'/rtc-config?role=pc',{token:phoneToken})).status,401,'Phone token cannot read the PC RTC role');
    const rtc=await request(route+'/rtc-config?role=phone',{token:phoneToken});equal(rtc.status,200);check(Array.isArray(rtc.json.iceServers),'Phone uses the existing ICE/TURN configuration route');
    const recovered=await request('/api/recover',{method:'POST',cookie});equal(recovered.status,200);check(recovered.json.sessionToken!==owner.sessionToken,'PC cookie recovery rotates bearer');const recoveredToken=recovered.json.sessionToken;
    const current=await request('/api/phone/pairs/current?room='+owner.code+'&peer='+owner.peerId,{token:recoveredToken});equal(current.status,200);equal(current.json.pairId,pair.pairId,'Rotated PC identity recovers the same pair');check(!JSON.stringify(current.json).includes(phoneToken),'Pair lookup never exposes phone authentication token');
    equal((await request(route+'/state',{method:'POST',token:phoneToken,body:{state:{cameraActive:true,fps:30}}})).status,200,'Phone token remains valid after PC bearer rotation');
    for(const upload of ['/api/phone/upload','/api/phone/image','/api/phone/frame','/api/phone/screenshot'])equal((await request(upload,{method:'POST',token:phoneToken,body:{}})).status,404,'No media upload API '+upload);
    check(!/MediaRecorder|api\/phone\/(?:upload|image|frame|screenshot)/.test(read('server.js')+mobile+read('public/phone-camera.js')),'Phone runtime introduces no recording or upload mechanism');
    const owners=['server.js','public/phone.html','public/phone-camera-client.js','public/phone-camera.js','public/phone-camera-control.js','public/phone-camera-devices.js','public/phone-camera-diagnostics.js','public/phone-camera.css'].map(read).join('\n');
    check(!owners.includes('tcgate-phone-camera-lab-production.up.railway.app'),'Product Phone has no dependency on the standalone deployment');
    check(!logs.includes(oneTime)&&!logs.includes(phoneToken)&&!logs.includes(owner.sessionToken),'Server logs contain no pairing or session secrets');
  }finally{abort?.abort();await reader?.cancel().catch(()=>{});child.kill('SIGTERM');}
}
(async()=>{await unitContracts();await httpContracts();console.log('PHONE_CONSOLIDATION_1_2C_OK '+JSON.stringify({assertions,realHttpAndSse:true,fakeHardwareCapabilities:true,physicalAndroidQualified:false}));})().catch(error=>{console.error(error);process.exitCode=1;});
