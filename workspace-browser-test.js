'use strict';
// Optional browser test: WORKSPACE_PLAYWRIGHT_PATH points to a temporary Playwright install.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const {chromium}=require(process.env.WORKSPACE_PLAYWRIGHT_PATH||'playwright');
const {fixture}=require('./workspace-lab-fixture.js');
async function run(){
 const server=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'4388',HOST:'127.0.0.1'},stdio:'ignore'});
 let browser;try{
  for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:4388/api/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
  const context=await browser.newContext({permissions:['camera'],viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push({url:r.url(),method:r.method()}));
  const data=fixture(),prefix='https://raw.githubusercontent.com/example/test-db/main/';
  await page.route('https://raw.githubusercontent.com/**',async route=>{
   const url=route.request().url();if(url.includes('/workspace-state/'))return route.fulfill({json:{meta:{workspaceVersion:'3.0',generatedAt:'fixture'},session:{},items:[]}});
   if(!url.startsWith(prefix))return route.continue();const item=data[url.slice(prefix.length)];
   if(item!==undefined)return route.fulfill({json:item});
   if(url.includes('/assets/')){const image=fs.readFileSync(path.join(__dirname,'public/assets/card-db/cyberpunk/0.7.0-6d3a296/assets/vision',fs.readdirSync(path.join(__dirname,'public/assets/card-db/cyberpunk/0.7.0-6d3a296/assets/vision'))[0]));return route.fulfill({contentType:'image/webp',body:image});}
   return route.fulfill({status:404,body:'missing'});
  });
  await page.goto('http://127.0.0.1:4388/workspace.html');await page.getByRole('tab',{name:'BDD',exact:true}).click();
  assert(await page.getByRole('heading',{name:'Cyberpunk',exact:true}).isVisible());assert(await page.getByRole('heading',{name:'SWU',exact:true}).isVisible());assert.equal(await page.getByRole('button',{name:'Aucune Candidate',exact:true}).isDisabled(),true);
  assert((await page.locator('#databaseCards').innerText()).includes('56402636a77af9c8b5dc4e3b61c509a185f3c834'));
  await page.getByRole('tab',{name:'Vision Lab',exact:true}).click();await page.selectOption('#labSource','test');await page.fill('#labManifestUrl',prefix+'missing-manifest.json');await page.click('#labInspect');await page.waitForFunction(()=>document.querySelector('#labStatus').textContent.includes('BDD invalide'));
  assert(await page.locator('#labStart').isDisabled());await page.fill('#labManifestUrl',prefix+'manifest.json');await page.click('#labInspect');await page.waitForFunction(()=>!document.querySelector('#labStart').disabled);
  const diagnostic=JSON.parse(await page.locator('#labDatabase').textContent());assert.deepEqual(diagnostic.locales,['en','fr']);assert.equal(diagnostic.printings,2);
  await page.click('#labStart');await page.waitForFunction(()=>window.TCGIdentificationLab?.getSnapshot().matcherWorker.ready,{},{timeout:45000});
  assert.equal(await page.evaluate(()=>window.TCGIdentificationLab.getSnapshot().librarySize),2);assert.equal(await page.evaluate(()=>window.TCGateGameDatabases.get('cyberpunk').expectedVersion),'1.1.0');
  await page.click('#visionCameraButton');await page.waitForFunction(()=>document.querySelector('#remoteVideo').videoWidth>0);assert(await page.locator('#visionDetectButton').isEnabled());
  // Synthetic geometry exercises the real crop + matcher and retained Top 5 after pointer leaves.
  await page.evaluate(()=>{const s=window.TCGDetectionLab.state,v=document.querySelector('#remoteVideo');s.tracks=[{uid:900,displayId:1,confirmed:true,misses:0,conf:.99,cx:v.videoWidth/2,cy:v.videoHeight/2,w:160,h:240,angle:0}];});
  const feed=await page.locator('#opponentFeed').boundingBox();await page.mouse.move(feed.x+feed.width/2,feed.y+feed.height/2);
  await page.waitForFunction(()=>window.TCGIdentificationLab.getSnapshot().identification?.candidates.length>0,{},{timeout:15000});
  await page.waitForFunction(()=>document.querySelectorAll('#labTop5 tr').length>0);assert(await page.locator('#labCrop').isVisible());
  await page.click('#visionCaptureButton');await page.waitForFunction(()=>window.TCGDetectionLab.state.captures.length===1);
  await page.fill('#recognizedAs','Wrong Card');await page.fill('#visionCaseNote','browser fixture feedback');await page.click('[data-feedback=wrong_identification]');assert.equal(await page.locator('#labFeedbackCount').textContent(),'1 feedback');
  const downloadPromise=page.waitForEvent('download');await page.click('#labExport');const download=await downloadPromise;const payload=JSON.parse(fs.readFileSync(await download.path(),'utf8'));assert.equal(payload.feedback[0].recognizedAs,'Wrong Card');assert(payload.feedback[0].top5.length>0);assert(payload.feedback[0].crop.startsWith('data:image/'));assert(payload.feedback[0].observationTimestamp);assert(payload.captures[0].raw.startsWith('data:image/'));assert(payload.captures[0].meta.settings);
  // Real ONNX detector and fake webcam; no fabricated detector results.
  await page.click('#visionDetectButton');await page.waitForFunction(()=>window.TCGDetectionLab.state.workerReady&&window.TCGDetectionLab.state.lastTotalMs>0,{},{timeout:90000});
  const detector=await page.evaluate(()=>window.TCGVisionEngine.getSnapshot());assert(detector.modelReady);assert(detector.inference.inferenceMs>0);console.log('REAL_DETECTOR',JSON.stringify({provider:detector.provider,inference:detector.inference,shape:detector.inference.outputShape}));
  await page.click('#visionDetectButton');if(process.env.WORKSPACE_SCREENSHOT_DIR){await page.screenshot({path:path.join(process.env.WORKSPACE_SCREENSHOT_DIR,'workspace-lab.png'),fullPage:true});await page.getByRole('tab',{name:'BDD',exact:true}).click();await page.screenshot({path:path.join(process.env.WORKSPACE_SCREENSHOT_DIR,'workspace-databases.png'),fullPage:true});await page.getByRole('tab',{name:'Vision Lab',exact:true}).click();}await page.click('#visionCameraButton');await page.waitForFunction(()=>!window.TCGDetectionLab.state.stream);
  assert.equal(requests.some(r=>r.method!=='GET'),false);assert.equal(requests.some(r=>['/api/rooms','/api/join','/api/create','/api/events'].some(p=>r.url.includes(p))),false);assert.deepEqual(errors,[]);
  console.log('WORKSPACE_BROWSER_OK · real engines/matcher, fake webcam, real detector, DB errors, export, isolation');
 }finally{await browser?.close();server.kill();}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
