'use strict';
// This smoke follows the actual camera-first flow, then loads the real production DB.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const {chromium}=require(process.env.WORKSPACE_PLAYWRIGHT_PATH||'playwright');
const origin='http://127.0.0.1:4389';
async function exported(page){const pending=page.waitForEvent('download');await page.click('#labExport');const d=await pending;return JSON.parse(fs.readFileSync(await d.path(),'utf8'));}
async function run(){
 const server=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'4389',HOST:'127.0.0.1'},stdio:'ignore'});let browser;
 try{
  for(let i=0;i<60;i++){try{if((await fetch(origin+'/api/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-device-for-media-stream=device-count=2','--use-fake-ui-for-media-stream']});
  const context=await browser.newContext({permissions:['camera'],viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push({url:r.url(),method:r.method()}));
  await page.addInitScript(()=>{
   window.__cameraCalls=[];window.__enumerations=0;
   const media=navigator.mediaDevices,nativeGet=media.getUserMedia.bind(media),nativeEnum=media.enumerateDevices.bind(media);
   media.getUserMedia=async constraints=>{window.__cameraCalls.push(constraints);if(window.__cameraFailure)throw new DOMException('Browser test failure',window.__cameraFailure);return nativeGet(constraints);};
   media.enumerateDevices=async()=>{window.__enumerations++;return nativeEnum();};
  });
  await page.route('https://raw.githubusercontent.com/example/invalid/**',route=>route.fulfill({status:404,body:'not found'}));
  await page.goto(origin+'/workspace.html');await page.getByRole('tab',{name:'Vision Lab',exact:true}).click();
  assert(await page.getByRole('button',{name:'Activer la caméra',exact:true}).isVisible());await page.waitForFunction(()=>!document.querySelector('#visionCameraButton').disabled);
  assert.equal(await page.evaluate(()=>window.__cameraCalls.length),0);assert.equal(await page.evaluate(()=>Boolean(window.TCGIdentificationLab)),false);
  assert.equal(requests.some(r=>r.url.includes('/identification.js')||r.url.includes('/identification-worker.js')||r.url.endsWith('/manifest.json')),false);
  assert(await page.locator('#identificationToggle').isDisabled());
  await page.click('#visionCameraButton');await page.waitForFunction(()=>document.querySelector('#remoteVideo').srcObject instanceof MediaStream&&document.querySelector('#remoteVideo').videoWidth>0);
  assert.match(await page.locator('#labCameraStatus').textContent(),/active/);assert.equal(await page.evaluate(()=>window.__cameraCalls[0].audio),false);
  assert((await page.evaluate(()=>window.__enumerations))>0);
  await page.click('#visionDetectButton');await page.waitForFunction(()=>window.TCGDetectionLab.state.detecting&&window.TCGDetectionLab.state.frameGate.snapshot().processed>=2,{},{timeout:90000});
  assert.equal(await page.evaluate(()=>Boolean(window.TCGIdentificationLab)),false);assert.match(await page.locator('#labStatus').textContent(),/non chargée/);
  assert.match(await page.locator('#labDetectionStatus').textContent(),/active/);
  console.log('CAMERA_FIRST_NO_DB',JSON.stringify(await page.evaluate(()=>({camera:document.querySelector('#labCameraStatus').textContent,detection:document.querySelector('#labDetectionStatus').textContent,identification:document.querySelector('#labStatus').textContent,provider:window.TCGVisionEngine.getSnapshot().provider,frames:window.TCGDetectionLab.state.frameGate.snapshot().processed}))));
  async function checkGeometry(){const g=await page.evaluate(()=>{const v=document.querySelector('#remoteVideo'),o=document.querySelector('#visionOverlay'),vr=v.getBoundingClientRect(),or=o.getBoundingClientRect();return {vw:v.videoWidth,vh:v.videoHeight,ow:o.width,oh:o.height,vrect:[vr.x,vr.y,vr.width,vr.height],orect:[or.x,or.y,or.width,or.height]};});assert.equal(g.vw,g.ow);assert.equal(g.vh,g.oh);for(let i=0;i<4;i++)assert(Math.abs(g.vrect[i]-g.orect[i])<2);assert(Math.abs(g.vrect[2]/g.vrect[3]-g.vw/g.vh)<.02);}
  await checkGeometry();await page.setViewportSize({width:560,height:900});await checkGeometry();await page.setViewportSize({width:1440,height:1000});
  await page.click('#visionCaptureButton');await page.waitForFunction(()=>window.TCGDetectionLab.state.captures.length===1);const noIdExport=await exported(page);assert.equal(noIdExport.source,null);assert.equal(noIdExport.identification,undefined);assert(noIdExport.captures[0].raw.startsWith('data:image/'));assert(noIdExport.captures[0].overlay.startsWith('data:image/'));assert(noIdExport.captures[0].meta.metrics);assert(noIdExport.captures[0].meta.settings);assert(noIdExport.captures[0].meta.detections);
  await page.evaluate(()=>{window.__beforeInvalidStream=window.TCGDetectionLab.state.stream;window.__beforeInvalidFrames=window.TCGDetectionLab.state.frameGate.snapshot().processed;});
  await page.selectOption('#labSource','test');await page.fill('#labManifestUrl','https://raw.githubusercontent.com/example/invalid/main/manifest.json');await page.click('#labInspect');await page.waitForFunction(()=>document.querySelector('#labStatus').textContent.includes('BDD invalide'));
  await page.waitForFunction(()=>window.TCGDetectionLab.state.frameGate.snapshot().processed>window.__beforeInvalidFrames);
  assert(await page.evaluate(()=>window.__beforeInvalidStream===window.TCGDetectionLab.state.stream&&window.TCGDetectionLab.state.detecting));assert(await page.locator('#labStart').isDisabled());
  // Real, unmocked production manifest and reference images. No test provider installed.
  await page.selectOption('#labSource','production');await page.click('#labInspect');await page.waitForFunction(()=>!document.querySelector('#labStart').disabled,{},{timeout:60000});
  await page.click('#labStart');await page.waitForFunction(()=>window.TCGIdentificationLab?.getSnapshot().libraryReady&&window.TCGIdentificationLab.getSnapshot().matcherWorker.ready,{},{timeout:120000});
  assert(await page.locator('#identificationToggle').isChecked());assert.match(await page.locator('#labStatus').textContent(),/active/);
  assert.equal(await page.evaluate(()=>window.TCGIdentificationLab.getSnapshot().librarySize),229);assert.equal(await page.evaluate(()=>Boolean(window.TCGWorkspaceLabProviderInstance)),false);
  assert(await page.evaluate(()=>window.TCGDetectionLab.state.detecting&&window.__beforeInvalidStream===window.TCGDetectionLab.state.stream));
  console.log('PRODUCTION_IDENTIFICATION',JSON.stringify(await page.evaluate(()=>({status:document.querySelector('#labStatus').textContent,db:window.TCGIdentificationLab.getSnapshot().database,worker:window.TCGIdentificationLab.getSnapshot().matcherWorker.ready}))));
  await page.click('#visionDetectButton');
  const devices=await page.locator('#visionCameraSelect option').evaluateAll(options=>options.filter(o=>o.value).map(o=>({id:o.value,label:o.textContent})));
  assert(devices.length>=2,'Expected two Chromium fake cameras for real deviceId switching test');
  await page.evaluate(()=>window.__previousStream=window.TCGDetectionLab.state.stream);await page.selectOption('#visionCameraSelect',devices[1].id);
  await page.waitForFunction(id=>window.TCGDetectionLab.state.stream?.getVideoTracks()[0].getSettings().deviceId===id,devices[1].id);
  assert(await page.evaluate(()=>window.__previousStream.getTracks().every(t=>t.readyState==='ended')));assert.equal(await page.evaluate(()=>window.__cameraCalls.at(-1).video.deviceId.exact),devices[1].id);
  await page.selectOption('#visionResolutionSelect','640x480');await page.waitForFunction(()=>document.querySelector('#remoteVideo').videoWidth===640);await checkGeometry();
  await page.evaluate(()=>window.__lastStream=window.TCGDetectionLab.state.stream);await page.click('#visionCameraButton');await page.waitForFunction(()=>!window.TCGDetectionLab.state.stream);
  assert(await page.evaluate(()=>window.__lastStream.getTracks().every(t=>t.readyState==='ended')));
  // Browser camera failure paths pass through the real Core handler, with actionable UI messages.
  for(const [name,phrase]of [['NotAllowedError','refusée'],['NotFoundError','Aucune caméra'],['NotReadableError','déjà utilisée']]){
    await page.evaluate(value=>window.__cameraFailure=value,name);await page.click('#visionCameraButton');await page.waitForFunction(value=>document.querySelector('#labCameraStatus').textContent.includes(value),phrase);
  }
  assert(await page.evaluate(()=>window.__cameraCalls.every(c=>c.audio===false)));assert.equal(requests.some(r=>r.method!=='GET'),false);assert.equal(requests.some(r=>['/api/rooms','/api/create','/api/join','/api/events'].some(p=>r.url.includes(p))),false);assert.deepEqual(errors,[]);
  if(process.env.WORKSPACE_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.WORKSPACE_SCREENSHOT_DIR,'workspace-camera-flow.png'),fullPage:true});
  console.log('WORKSPACE_CAMERA_BROWSER_OK · camera first without DB, real ONNX detection, invalid manifest while streaming, real production matcher, two-device switch, resize/resolution, track stop, audio:false, errors');
 }finally{await browser?.close();server.kill();}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
