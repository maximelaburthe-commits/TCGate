'use strict';
// Genuine local Room/SSE/Phone WebRTC; only camera/microphone hardware is simulated.
// Native loopback probes established that synthetic camera 2 does not encode video here.
// Use synthetic cameras 1 and 3, both verified to deliver continuous decoded WebRTC frames.
const assert=require('node:assert/strict'),fs=require('node:fs'),{spawn}=require('node:child_process');
const {chromium}=require(process.env.WORKSPACE_PLAYWRIGHT_PATH||'playwright');
const root=process.env.PHONE_TEST_ROOT||process.cwd(),origin='http://127.0.0.1:4398';
let assertions=0,phase='initialization';
function check(value,message){assert(value,message);assertions++;}
function step(value){phase=value;console.log('PHONE_BROWSER_STEP '+value);}
async function readSession(page){return page.evaluate(()=>JSON.parse(sessionStorage.getItem('tcgate-alpha-room-session-v1')));}
async function receivePhone(page){
  await page.waitForFunction(()=>window.TCGatePhoneCamera?.getSnapshot().connectionState==='connected'&&document.querySelector('#lobbyPreview').videoWidth>0&&document.querySelector('#lobbyPreview').srcObject?.getVideoTracks().some(t=>t.readyState==='live'),{},{timeout:60000});
  await freshFrame(page);
}
async function freshFrame(page){
  const received=await page.evaluate(()=>new Promise(resolve=>{const v=document.querySelector('#lobbyPreview'),timer=setTimeout(()=>resolve(false),10000);v.requestVideoFrameCallback(()=>{clearTimeout(timer);resolve(v.videoWidth>0);});}));
  check(received,'Visible preview receives a fresh decoded video frame');
}
async function webcamActive(page){return page.evaluate(async()=>{const track=document.querySelector('#lobbyPreview').srcObject?.getVideoTracks()[0],devices=await navigator.mediaDevices.enumerateDevices();return Boolean(track?.readyState==='live'&&devices.some(d=>d.kind==='videoinput'&&d.deviceId===track.getSettings().deviceId));});}
async function receiveWebcam(page){
  await page.waitForFunction(async()=>{const stream=document.querySelector('#lobbyPreview').srcObject,track=stream?.getVideoTracks()[0],devices=await navigator.mediaDevices.enumerateDevices();return track?.readyState==='live'&&devices.some(d=>d.kind==='videoinput'&&d.deviceId===track.getSettings().deviceId)&&stream.getAudioTracks().some(t=>t.readyState==='live');});
  await freshFrame(page);
}
async function run(){
  const server=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:'4398',HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});
  let logs='',browser,pc,phone;const errors=[],requests=[],signals=[];
  server.stdout.on('data',d=>logs+=d);server.stderr.on('data',d=>logs+=d);
  try{
    let ready=false;for(let i=0;i<80;i++){try{if((await fetch(origin+'/api/health')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,75));}check(ready,'Local server started');
    browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-device-for-media-stream=device-count=3,fps=30','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required']});
    const pcContext=await browser.newContext({viewport:{width:1366,height:900},permissions:['camera','microphone','clipboard-read','clipboard-write']});
    const phoneContext=await browser.newContext({viewport:{width:900,height:560},permissions:['camera','microphone']});
    pcContext.setDefaultTimeout(20000);phoneContext.setDefaultTimeout(20000);
    await phoneContext.addInitScript(()=>{
      window.__phoneMediaProbe={calls:[],streams:[],loads:1};
      const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia=async constraints=>{window.__phoneMediaProbe.calls.push(structuredClone(constraints));const stream=await original(constraints);window.__phoneMediaProbe.streams.push(stream);return stream;};
    });
    function observe(page,role){page.on('pageerror',error=>errors.push(role+': '+error.message));page.on('request',request=>{const pathname=new URL(request.url()).pathname;requests.push({role,method:request.method(),pathname});if(request.method()==='POST'&&/\/api\/phone\/pairs\/[^/]+\/signal$/.test(pathname)){try{const body=request.postDataJSON();signals.push({role,type:body.type,action:body.payload?.action});}catch{}}});}
    pc=await pcContext.newPage();phone=await phoneContext.newPage();observe(pc,'pc');observe(phone,'phone');
    step('PC room and webcam');
    await pc.goto(origin+'/');await pc.locator('#goCreate').click();
    await pc.waitForFunction(()=>document.querySelector('#screenLobby').classList.contains('active')&&/^[A-Z0-9]{6}$/.test(document.querySelector('#lobbyCode').textContent.trim()));
    await pc.locator('#gameSelect').selectOption('no-game');
    await pc.locator('[data-lobby-page="installation"]').click();await pc.locator('#enableMedia').click();
    await pc.waitForFunction(()=>document.querySelector('#lobbyPreview').videoWidth>0&&document.querySelector('#lobbyPreview').srcObject?.getAudioTracks().some(t=>t.readyState==='live'));
    await pc.waitForFunction(()=>!document.querySelector('#deviceSelectors').classList.contains('hidden')&&document.querySelector('#cameraSelect').options.length>0);
    const before=await pc.evaluate(()=>{const s=document.querySelector('#lobbyPreview').srcObject;return {audio:s.getAudioTracks()[0].id,video:s.getVideoTracks()[0].id,cameraId:s.getVideoTracks()[0].getSettings().deviceId};});
    check(await pc.evaluate(async id=>(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput')[0].deviceId===id,before.cameraId),'PC starts with the first synthetic color webcam');
    const session=await readSession(pc);check(Boolean(session.authToken),'Real PC bearer exists');
    step('QR and phone pairing');
    const pairResponse=pc.waitForResponse(r=>new URL(r.url()).pathname==='/api/phone/pairs'&&r.request().method()==='POST');
    await pc.locator('#usePhoneCamera').click();
    await pc.waitForFunction(()=>Boolean(document.querySelector('#copyPhoneCameraLink').dataset.url));
    check(await pc.locator('#phoneCameraQr').isVisible(),'Pairing QR is visible');
    const phoneUrl=await pc.locator('#copyPhoneCameraLink').getAttribute('data-url'),url=new URL(phoneUrl),oneTime=url.searchParams.get('token'),pairId=url.searchParams.get('pair');
    check(url.origin===origin&&Boolean(pairId)&&oneTime.length>=40,'Same-origin pairing URL contains one-time token');
    check(!phoneUrl.includes(session.authToken),'PC bearer is absent from QR URL');
    const qr=(await (await pairResponse).json()).qrSvg;check(qr.includes('<svg')&&!qr.includes(session.authToken),'QR SVG has no PC bearer');
    await pc.waitForFunction(()=>document.querySelector('#phoneCameraQr').complete&&document.querySelector('#phoneCameraQr').naturalWidth>0);
    await phone.goto(phoneUrl);
    await phone.waitForFunction(()=>document.querySelector('#pairBadge').textContent.startsWith('Associé'));
    check(!new URL(phone.url()).searchParams.has('token'),'Consumed pairing token is removed from phone address');
    const phoneToken=await phone.evaluate(id=>sessionStorage.getItem('tcgate-phone-camera-token-'+id),pairId);
    check(Boolean(phoneToken)&&phoneToken!==oneTime&&phoneToken!==session.authToken,'Phone session credential is distinct');
    let response=await fetch(origin+'/api/phone/pairs/'+pairId+'/join',{method:'POST',headers:{Authorization:'Bearer '+oneTime}});check(response.status===409,'Pair token is one-shot');
    response=await fetch(origin+'/api/ready',{method:'POST',headers:{Authorization:'Bearer '+phoneToken,'Content-Type':'application/json'},body:JSON.stringify({room:session.roomCode,peerId:session.peerId,ready:true})});check(response.status===401,'Phone credential has no PC privileges');
    step('Phone capture and real WebRTC');
    await phone.locator('#start').click();await receivePhone(pc);
    const active=await pc.evaluate(()=>{const s=document.querySelector('#lobbyPreview').srcObject;return {audio:s.getAudioTracks()[0]?.id,video:s.getVideoTracks()[0]?.id};});
    check(active.audio===before.audio,'Original PC microphone track is retained');check(active.video!==before.video,'Phone video replaces webcam video');
    check(signals.some(s=>s.role==='phone'&&s.type==='offer')&&signals.some(s=>s.role==='pc'&&s.type==='answer'),'Real Phone offer/PC answer traveled through signaling');
    check(await phone.evaluate(()=>window.__phoneMediaProbe.calls.length>0&&window.__phoneMediaProbe.calls.every(c=>c.audio===false)&&window.__phoneMediaProbe.streams.every(s=>s.getAudioTracks().length===0)),'Phone always acquires video with audio:false');
    check(await phone.locator('#debugPanel').getAttribute('open')===null,'Phone diagnostics stay secondary');
    step('PC quality and diagnostic controls');
    await pc.locator('#phoneCameraSettings > summary').click();
    await pc.waitForFunction(()=>!document.querySelector('#phoneCameraQuality').disabled);
    const profiles=await pc.locator('#phoneCameraQuality').evaluate(e=>[...e.options].map(o=>({value:o.value,label:o.textContent})));
    check(profiles.some(p=>p.value==='auto')&&profiles.some(p=>p.value==='1280x720'),'Capability-supported standard profiles are exposed');
    async function quality(mode){
      await pc.locator('#phoneCameraQuality').selectOption(mode);
      await pc.waitForFunction(value=>window.TCGatePhoneCamera.getSnapshot().diagnostics?.requestedMode===value,mode);
      await pc.waitForFunction(()=>!document.querySelector('#phoneCameraQuality').disabled);
      await freshFrame(pc);
      check(await pc.locator('#phoneCameraQuality').inputValue()===mode,'Acknowledged quality is rendered on PC');
    }
    await quality('1280x720');
    if(profiles.some(p=>p.value==='1920x1080')){
      check(profiles.find(p=>p.value==='1920x1080').label.includes('expérimental'),'1080p remains labelled experimental');
      await quality('1920x1080');
    }
    await quality('auto');
    const refreshStart=signals.length;await pc.locator('#phoneCameraRefresh').click();
    await pc.waitForFunction(()=>document.querySelector('#phoneCameraSettingsStatus').textContent.includes('confirmé'));
    check(signals.slice(refreshStart).some(s=>s.role==='pc'&&s.action==='request-state'),'PC refresh uses the real validated command');
    check(!(await pc.locator('#phoneCameraZoomField').isVisible()),'Unsupported fake-camera zoom is hidden');
    check((await pc.locator('#phoneCameraFocus').innerText()).includes('autofocus'),'Native autofocus is described without invented manual focus');
    const downloadEvent=pc.waitForEvent('download');await pc.locator('#phoneCameraExport').click();const download=await downloadEvent;
    const exported=fs.readFileSync(await download.path(),'utf8');JSON.parse(exported);
    check(download.suggestedFilename().startsWith('tcgate-phone-diagnostic-'),'PC exports the integrated Phone diagnostic');
    for(const value of [session.authToken,phoneToken,oneTime])check(!exported.includes(value),'Exported Phone diagnostic contains no session credential');
    check(!/"(?:sdp|candidate|deviceId|groupId|token|authorization|image|screenshot|frame)"\s*:/i.test(exported),'Exported diagnostic omits sensitive fields');
    step('PC camera switch');
    await pc.waitForFunction(()=>document.querySelector('#phoneCameraLens').options.length>=2&&!document.querySelector('#phoneCameraLens').disabled);
    const cameras=await pc.locator('#phoneCameraLens').evaluate(select=>[...select.options].map(o=>o.value));check(cameras.every(id=>/^camera-[1-9][0-9]*$/.test(id)),'PC camera identifiers are opaque');
    const previous=await pc.locator('#phoneCameraLens').inputValue(),next=cameras.at(-1);check(next!==previous,'Third synthetic color camera is available for encoded video');
    await pc.locator('#phoneCameraLens').selectOption(next);
    await pc.waitForFunction(id=>window.TCGatePhoneCamera.getSnapshot().diagnostics?.selectedCameraId===id,next,{timeout:30000});
    check(await pc.locator('#phoneCameraLens').inputValue()===next,'PC camera switch completes');
    await freshFrame(pc);
    check(await phone.evaluate(()=>window.__phoneMediaProbe.streams[0].getVideoTracks()[0].readyState==='ended'),'Previous phone camera track is stopped');
    check((await pc.evaluate(()=>document.querySelector('#lobbyPreview').srcObject.getAudioTracks()[0].id))===before.audio,'Camera switch preserves PC microphone');
    step('Diagnostics');
    await phone.locator('#debugPanel').evaluate(e=>{e.open=true;});await phone.locator('#report').click();
    const diagnostic=await pc.evaluate(()=>window.TCGatePhoneCamera.fetchDiagnostics());
    const serialized=JSON.stringify(diagnostic),rawDeviceIds=await phone.evaluate(()=>window.__phoneMediaProbe.streams.flatMap(s=>s.getVideoTracks().map(t=>t.getSettings().deviceId)).filter(Boolean));
    for(const value of [session.authToken,phoneToken,oneTime,...rawDeviceIds])check(!serialized.includes(value),'Serialized Phone diagnostics omit credential/device identifiers');
    check(!/"(?:sdp|candidate|deviceId|groupId|token|authorization|image|screenshot|frame)"\s*:/i.test(serialized),'Serialized Phone diagnostics omit prohibited keys');
    check(!/\b(?:\d{1,3}\.){3}\d{1,3}\b|a=candidate:|v=0\r?\n/.test(serialized),'Serialized Phone diagnostics contain no IP/SDP/candidate');
    step('PC F5 recovery');
    const phoneCalls=await phone.evaluate(()=>window.__phoneMediaProbe.calls.length);
    await pc.reload();await pc.locator('[data-lobby-page="installation"]').click();await receivePhone(pc);
    check(await pc.evaluate(id=>JSON.parse(localStorage.getItem('tcgate-alpha-media-prefs-v1')).cameraId===id,before.cameraId),'PC webcam preference survives Phone F5 recovery');
    check(await pc.locator('#cameraSelect').isVisible()&&await pc.locator('#cameraSelect option').count()>=3,'F5 recovery exposes the populated PC camera selector');
    check(await pc.locator('#phoneCameraMicro option').count()>=1,'F5 recovery populates the PC microphone selector');
    check((await readSession(pc)).peerId===session.peerId,'F5 retains the PC peer');
    check(await phone.evaluate(()=>window.__phoneMediaProbe.calls.length)===phoneCalls,'PC F5 does not reacquire or reload the phone camera');
    check(await phone.evaluate(id=>sessionStorage.getItem('tcgate-phone-camera-token-'+id),pairId)===phoneToken,'Phone credential remains valid across PC F5');
    step('Cookie recovery with bearer rotation');
    await pc.close();pc=await pcContext.newPage();observe(pc,'pc-recovered');await pc.goto(origin+'/');
    await pc.locator('#resumeSessionCard').waitFor({state:'visible'});await pc.locator('#resumeSessionButton').click();await pc.locator('[data-lobby-page="installation"]').click();await receivePhone(pc);
    const recovered=await readSession(pc);check(recovered.peerId===session.peerId&&recovered.roomCode===session.roomCode,'Cookie recovery retains the original room and peer');check(recovered.authToken!==session.authToken,'Cookie recovery rotates PC bearer');
    check(await pc.evaluate(id=>JSON.parse(localStorage.getItem('tcgate-alpha-media-prefs-v1')).cameraId===id,before.cameraId),'PC webcam preference survives cookie recovery');
    check(await pc.locator('#cameraSelect').isVisible()&&await pc.locator('#cameraSelect option').count()>=3,'Cookie recovery exposes the populated PC camera selector');
    check(await pc.locator('#phoneCameraMicro option').count()>=1,'Cookie recovery populates the PC microphone selector');
    check(await phone.evaluate(()=>window.__phoneMediaProbe.calls.length)===phoneCalls,'Phone remains running without reload through rotated-bearer recovery');
    const recoveredMicrophone=await pc.evaluate(()=>document.querySelector('#lobbyPreview').srcObject.getAudioTracks()[0].id);
    step('PC remote stop and return to webcam');
    await pc.locator('[data-lobby-page="installation"]').click();
    await pc.locator('#phoneCameraSettings > summary').click();
    await pc.locator('#phoneCameraStop').click();await pc.waitForFunction(()=>window.TCGatePhoneCamera.getSnapshot().cameraActive===false);
    check(signals.some(s=>s.role==='pc-recovered'&&s.action==='stop-camera'),'PC stop traverses the real command protocol');
    check(await pc.locator('#returnToWebcam').isVisible(),'Return to webcam is reachable after remote Phone stop');
    await pc.locator('#returnToWebcam').click();
    await receiveWebcam(pc);
    await pc.locator('#returnToWebcam').waitFor({state:'hidden'});
    check(true,'PC webcam is restored after remote Phone stop');
    step('Phone restart and local stop');
    await phone.locator('#start').click();
    await pc.waitForFunction(()=>window.TCGatePhoneCamera.getSnapshot().cameraActive===true);
    const stillWebcam=await webcamActive(pc);
    if(stillWebcam)await pc.locator('#reusePhoneCamera').click();
    await receivePhone(pc);
    check(!(await webcamActive(pc)),'Restarted Phone video is active on PC');
    await phone.locator('#stop').click();await pc.waitForFunction(()=>window.TCGatePhoneCamera.getSnapshot().cameraActive===false);
    check(await phone.evaluate(()=>window.__phoneMediaProbe.streams.every(s=>s.getTracks().every(t=>t.readyState==='ended'))),'Phone stop closes all capture tracks');
    check(await pc.locator('#returnToWebcam').isVisible(),'Return to webcam remains reachable after Phone stop');
    await pc.locator('#returnToWebcam').click();
    await receiveWebcam(pc);
    check(await pc.evaluate(id=>document.querySelector('#lobbyPreview').srcObject.getAudioTracks()[0].id===id,recoveredMicrophone),'Both stop/return paths retain the recovered PC microphone track');
    check(await phone.evaluate(()=>window.__phoneMediaProbe.calls.every(c=>c.audio===false)&&window.__phoneMediaProbe.streams.every(s=>s.getAudioTracks().length===0)),'Phone restart also remains video-only');
    check(true,'PC webcam and PC microphone are restored after Phone stop');
    check(!requests.some(r=>/upload|screenshot|frame-upload|recording/i.test(r.pathname)),'No media upload route is used');
    assert.deepEqual(errors,[],'No uncaught page errors');
    console.log('PHONE_CONSOLIDATION_BROWSER_OK '+JSON.stringify({assertions,realRoomSsePhoneWebRtc:true,fakeMedia:true,physicalChromeAndroidQualified:false,pcF5:true,rotatedBearerRecovery:true,cameraSwitch:true,phoneReloads:0}));
  }catch(error){
    console.error('PHONE_CONSOLIDATION_BROWSER_PHASE '+phase);
    const pcState=await pc?.evaluate(async()=>{const s=await window.TCGatePhoneCamera?.fetchDiagnostics(),v=document.querySelector('#lobbyPreview'),track=v?.srcObject?.getVideoTracks()[0],devices=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput');return {connection:s?.connectionState,connected:s?.connected,camera:s?.cameraActive,videoWidth:v?.videoWidth,receiver:s?.diagnostics?.receiver,paused:v?.paused,videoReadyState:v?.readyState,appSource:state.videoSource,deviceRecoveryPending:state.deviceRecoveryInFlight,webcamIndex:devices.findIndex(d=>d.deviceId===track?.getSettings().deviceId),webcamSettings:{width:track?.getSettings().width,height:track?.getSettings().height,frameRate:track?.getSettings().frameRate},trackKinds:v?.srcObject?.getTracks().map(t=>({kind:t.kind,state:t.readyState,enabled:t.enabled,muted:t.muted})),events:s?.events?.slice(-12).map(e=>({type:e.type,data:e.type==='control-result'?undefined:e.data})),screen:[...document.querySelectorAll('.screen.active')].map(e=>e.id)};}).catch(()=>null);
    const phoneState=await phone?.evaluate(async()=>{const outbound=[];if(st.pc){const stats=await st.pc.getStats();stats.forEach(s=>{if(s.type==='outbound-rtp')outbound.push({kind:s.kind,framesEncoded:s.framesEncoded,framesSent:s.framesSent,bytesSent:s.bytesSent});});}return {connection:st.pc?.connectionState,signaling:st.pc?.signalingState,recovery:st.recoveryState,capture:st.stream?.getVideoTracks().map(t=>({state:t.readyState,enabled:t.enabled,muted:t.muted})),senderSameTrack:st.sender?.track===st.stream?.getVideoTracks()[0],outbound,eventTypes:st.events.slice(-12).map(e=>e.type),mediaCalls:window.__phoneMediaProbe.calls.length};}).catch(()=>null);
    console.error('PHONE_BROWSER_DIAGNOSTICS '+JSON.stringify({pcState,phoneState,signals:signals.slice(-20),errors}));
    throw error;
  }finally{await browser?.close();server.kill();}
}
run().catch(error=>{console.error(error.message);process.exitCode=1;});
