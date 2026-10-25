'use strict';
// UI 1.2 smoke with real local Room/SSE/WebRTC paths and Chromium fake camera/audio.
// It does not qualify physical webcams, a phone handset, or remote TURN connectivity.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {chromium}=require(process.env.WORKSPACE_PLAYWRIGHT_PATH||'playwright');
const origin='http://127.0.0.1:4396';
const homePages=['accueil','fonctionnement','fonctions','jeux','alpha'];
const lobbyPages=['session','installation','players'];
const viewports=[{width:1920,height:1080},{width:1366,height:768},{width:900,height:900},{width:560,height:900}];
let assertions=0;
function check(value,message){assert(value,message);assertions++;}
async function capture(page,name){
  if(!process.env.WORKSPACE_SCREENSHOT_DIR)return;
  fs.mkdirSync(process.env.WORKSPACE_SCREENSHOT_DIR,{recursive:true});
  await page.screenshot({path:path.join(process.env.WORKSPACE_SCREENSHOT_DIR,'ui-1.2-'+name+'.png'),fullPage:true});
}
async function noOverflow(page,label){
  const g=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
  check(g.scroll<=g.width+1,label+' horizontal overflow '+JSON.stringify(g));
}
async function selectHome(page,name){
  const button=page.locator('[data-home-page="'+name+'"]');await button.click();
  check(await page.locator('#ui12-home-'+name).isVisible(),'Home '+name+' visible');
  check(await page.locator('[data-home-panel]:visible').count()===1,'Only one Home page is visible');
  check((await button.getAttribute('aria-selected'))==='true'||(await button.getAttribute('aria-pressed'))==='true','Home active tab has accessible selected state');
}
async function readyVisible(page,label){
  const button=page.locator('#startGame');check(await button.isVisible(),label+' Ready visible');
  check(await button.evaluate(e=>!e.closest('#ui12-lobby-session,#ui12-lobby-installation,#ui12-lobby-players')),label+' Ready is outside tab panels');
  const box=await button.boundingBox(),height=await page.evaluate(()=>innerHeight);
  check(box&&box.y>=-1&&box.y+box.height<=height+1,label+' Ready remains in the visible viewport '+JSON.stringify(box));
}
async function selectLobby(page,name){
  const button=page.locator('[data-lobby-page="'+name+'"]');await button.click();
  check(await page.locator('#ui12-lobby-'+name).isVisible(),'Lobby '+name+' visible');
  check(await page.locator('#ui12-lobby-session:visible,#ui12-lobby-installation:visible,#ui12-lobby-players:visible').count()===1,'Only one principal Lobby panel is visible');
  check((await button.getAttribute('aria-selected'))==='true'||(await button.getAttribute('aria-pressed'))==='true','Lobby active tab has accessible selected state');
  await readyVisible(page,name);
}
async function waitRoom(page){
  await page.waitForFunction(()=>{
    const code=document.querySelector('#lobbyCode')?.textContent?.trim();
    return document.querySelector('#screenLobby')?.classList.contains('active')&&/^[A-Z0-9]{4,12}$/.test(code||'')&&new URLSearchParams(location.search).get('room')===code;
  },{},{timeout:30000});
  return (await page.locator('#lobbyCode').innerText()).trim();
}
function observe(page,label,errors,signals,requests){
  page.on('pageerror',error=>errors.push({page:label,message:error.message}));
  page.on('request',request=>{
    const url=request.url(),method=request.method();requests.push({page:label,url,method});
    if(method==='POST'&&new URL(url).pathname==='/api/signal'){
      try{const body=request.postDataJSON();signals.push({page:label,type:body.type,time:Date.now()});}catch{}
    }
  });
}
async function makeContext(browser){
  return browser.newContext({viewport:{width:1366,height:768},permissions:['camera','microphone','clipboard-read','clipboard-write']});
}
async function createPair(browser,errors,signals,requests,suffix,options={}){
  const hostContext=await makeContext(browser),guestContext=await makeContext(browser);
  const host=await hostContext.newPage(),guest=await guestContext.newPage();
  observe(host,'host-'+suffix,errors,signals,requests);observe(guest,'guest-'+suffix,errors,signals,requests);
  await host.goto(origin+'/');await host.locator('#goCreate').click();const code=await waitRoom(host);
  check(await host.locator('#ui12-lobby-session').isVisible(),'Creating immediately opens the connected Session tab');
  await host.locator('#playerName').fill('Host UI12 '+suffix);
  await guest.goto(options.invite?origin+'/?room='+code:origin+'/');
  if(!options.invite)await guest.locator('#goJoin').click();
  check(await guest.locator('#ui12-lobby-session').isVisible(),'Joining uses the Lobby Session tab');
  await guest.locator('#playerName').fill('Guest UI12 '+suffix);
  await guest.locator('#roomCodeInput').fill(code);await guest.locator('#setupContinue').click();
  check(await waitRoom(guest)===code,'Guest joins the real Host room');
  await host.waitForFunction(()=>document.querySelector('#lobbyOpponentName').textContent.startsWith('Guest UI12'));
  await guest.waitForFunction(()=>document.querySelector('#lobbyOpponentName').textContent.startsWith('Host UI12'));
  return {hostContext,guestContext,host,guest,code};
}
async function activateMedia(page){
  await selectLobby(page,'installation');
  await page.locator('#enableMedia').click();
  await page.waitForFunction(()=>{
    const video=document.querySelector('#lobbyPreview'),stream=video.srcObject;
    return stream instanceof MediaStream&&video.videoWidth>0&&stream.getVideoTracks().some(t=>t.readyState==='live')&&stream.getAudioTracks().some(t=>t.readyState==='live');
  },{},{timeout:30000});
  await page.waitForFunction(()=>!document.querySelector('#deviceSelectors').classList.contains('hidden')&&document.querySelector('#cameraSelect').options.length>0&&document.querySelector('#microSelect').options.length>0);
  check(await page.locator('#cameraSelect').isVisible(),'Existing camera selector is reused');
  check(await page.locator('#microSelect').isVisible(),'Existing microphone selector is reused');
  check(await page.locator('#cameraSelect option').count()>=1,'Camera enumeration populated');
  check(await page.locator('#microSelect option').count()>=1,'Microphone enumeration populated');
  await page.locator('#lobbyToggleMic').click();
  await page.waitForFunction(()=>document.querySelector('#lobbyPreview').srcObject.getAudioTracks().every(t=>!t.enabled));
  await page.locator('#lobbyToggleMic').click();
  await page.waitForFunction(()=>document.querySelector('#lobbyPreview').srcObject.getAudioTracks().some(t=>t.enabled));
  await page.locator('#lobbyToggleCam').click();
  await page.waitForFunction(()=>document.querySelector('#lobbyPreview').srcObject.getVideoTracks().every(t=>!t.enabled));
  await page.locator('#lobbyToggleCam').click();
  await page.waitForFunction(()=>document.querySelector('#lobbyPreview').srcObject.getVideoTracks().some(t=>t.enabled));
  await readyVisible(page,'media enabled');
}
async function enterGame(pair){
  await Promise.all([activateMedia(pair.host),activateMedia(pair.guest)]);
  await selectLobby(pair.host,'players');await selectLobby(pair.guest,'players');
  await pair.host.waitForFunction(()=>!document.querySelector('#startGame').disabled);
  await pair.guest.waitForFunction(()=>!document.querySelector('#startGame').disabled);
  await pair.host.locator('#startGame').click();await pair.guest.locator('#startGame').click();
  for(const page of [pair.host,pair.guest]){
    await page.waitForFunction(()=>document.querySelector('#screenGame').classList.contains('active'),{},{timeout:60000});
    await page.waitForFunction(()=>{
      const video=document.querySelector('#remoteVideo');
      return video.srcObject instanceof MediaStream&&video.videoWidth>0&&video.currentTime>0;
    },{},{timeout:90000});
    check(await page.locator('#remoteVideo').isVisible(),'Real WebRTC remote video is visible');
    check(await page.locator('#localVideo').isVisible(),'Existing local PIP is retained');
  }
}
async function openGameMenu(page){
  const feed=await page.locator('#opponentFeed').boundingBox();await page.mouse.move(feed.x+feed.width/2,feed.y+feed.height/2);
  await page.locator('#moreMenuToggle').click();
  check(await page.locator('#moreMenu').isVisible(),'Existing Table secondary menu opens');
}
async function closePair(pair){await Promise.allSettled([pair.hostContext.close(),pair.guestContext.close()]);}
async function run(){
  const startedAt=Date.now(),errors=[],signals=[],requests=[];
  const server=spawn(process.execPath,['server.js'],{cwd:process.cwd(),env:{...process.env,PORT:'4396',HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});
  let browser,logs='';server.stdout.on('data',d=>logs+=d);server.stderr.on('data',d=>logs+=d);
  try{
    let serverReady=false;
    for(let i=0;i<60;i++){try{if((await fetch(origin+'/api/health')).ok){serverReady=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
    check(serverReady,'Local server ready '+logs);
    browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-device-for-media-stream=device-count=2','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required']});
    const homeContext=await makeContext(browser),home=await homeContext.newPage();observe(home,'home',errors,signals,requests);
    await home.goto(origin+'/');let homeLoads=0;home.on('load',()=>homeLoads++);
    check(await home.locator('[data-home-page]').count()===5,'Five internal Home navigation buttons');
    check(await home.locator('#screenHome img[src*="home-alpha-orbit-hero-approved.webp"]').count()===0,'Orbit illustration is absent from the homepage');
    for(const viewport of viewports){
      await home.setViewportSize(viewport);
      for(const name of homePages){await selectHome(home,name);await noOverflow(home,viewport.width+' Home '+name);}
      await selectHome(home,'accueil');
      for(const id of ['goCreate','goJoin'])check(await home.locator('#'+id).isVisible(),id+' remains directly available');
      check(await home.locator('#resumeSessionCard').count()===1&&await home.locator('#resumeSessionButton').count()===1,'Resume controls remain unique');
      if(viewport.width>=1366)await capture(home,'home-'+viewport.width);
    }
    await home.locator('[data-home-page="fonctionnement"]').focus();await home.keyboard.press('Enter');
    check(await home.locator('#ui12-home-fonctionnement').isVisible(),'Home navigation works with the keyboard');
    check(homeLoads===0,'Home navigation never reloads the document');
    await homeContext.close();
    const pair=await createPair(browser,errors,signals,requests,'disabled');
    try{
      check(await pair.host.locator('#timerToggle').isEnabled(),'Host can edit Timer');
      check(await pair.host.locator('#timerMinutes').isEnabled(),'Host can edit Timer duration');
      check(await pair.guest.locator('#timerToggle').isDisabled(),'Guest Timer switch is read-only');
      check(await pair.guest.locator('#timerMinutes').isDisabled(),'Guest Timer duration is read-only');
      await pair.host.locator('#timerMinutes').fill('37');await pair.host.locator('#timerMinutes').press('Tab');
      await pair.guest.waitForFunction(()=>document.querySelector('#timerMinutes').value==='37');
      await pair.host.locator('#timerToggle').click();
      await pair.guest.waitForFunction(()=>document.querySelector('#timerToggle').getAttribute('aria-pressed')==='false');
      check(!(await pair.host.locator('#timerCfg').isVisible())&&!(await pair.guest.locator('#timerCfg').isVisible()),'Disabled Timer hides duration on both peers');
      await pair.host.locator('#timerToggle').click();
      await pair.guest.waitForFunction(()=>document.querySelector('#timerToggle').getAttribute('aria-pressed')==='true');
      check(await pair.host.locator('#gigDiceToggle').isEnabled(),'Host can edit Gig Dice');
      check(await pair.guest.locator('#gigDiceToggle').isDisabled(),'Guest Gig Dice is read-only');
      check(await pair.host.locator('#gigDiceToggle').getAttribute('aria-pressed')==='true','Cyberpunk keeps historical Gig Dice enabled default');
      await pair.host.locator('#gigDiceToggle').click();
      await pair.guest.waitForFunction(()=>document.querySelector('#gigDiceToggle').getAttribute('aria-pressed')==='false');
      const disabledSignalStart=signals.length;
      await pair.host.locator('#copyCode').click();
      check(await pair.host.evaluate(()=>navigator.clipboard.readText())===pair.code,'Copy code retains the real room code');
      await pair.host.locator('#copyLink').click();
      check(await pair.host.evaluate(()=>navigator.clipboard.readText())===origin+'/?room='+pair.code,'Copy invitation retains the real room URL');
      for(const viewport of viewports){
        await pair.host.setViewportSize(viewport);
        for(const name of lobbyPages){await selectLobby(pair.host,name);await noOverflow(pair.host,viewport.width+' Lobby '+name);}
        await selectLobby(pair.host,'installation');
        const preview=await pair.host.locator('#lobbyPreviewShell').boundingBox();
        check(preview&&preview.width>=(viewport.width===560?300:350),'Camera preview stays usable at '+viewport.width+': '+JSON.stringify(preview));
        if(viewport.width>=1366){await capture(pair.host,'installation-'+viewport.width);await selectLobby(pair.host,'session');await capture(pair.host,'session-'+viewport.width);}
      }
      await pair.host.setViewportSize({width:1366,height:768});
      await selectLobby(pair.host,'installation');
      await pair.host.locator('#usePhoneCamera').click();
      await pair.host.waitForFunction(()=>!document.querySelector('#phoneCameraPanel').classList.contains('hidden')&&document.querySelector('#copyPhoneCameraLink').dataset.url);
      check(await pair.host.locator('#phoneCameraQr').isVisible(),'Existing Phone pairing QR UI opens');
      check(await pair.host.locator('#copyPhoneCameraLink').getAttribute('data-url').then(url=>new URL(url).origin===origin),'Phone pairing uses the real local API');
      await pair.host.locator('#cancelPhoneCamera').click();
      await pair.host.waitForFunction(()=>document.querySelector('#phoneCameraPanel').classList.contains('hidden'));
      await enterGame(pair);
      for(const page of [pair.host,pair.guest]){
        check(!(await page.locator('#gigDicePanel').isVisible())&&!(await page.locator('#gigTotem').isVisible()),'Gig Dice totem is absent when disabled');
        await openGameMenu(page);check(!(await page.locator('#gigDiceReset').isVisible()),'Gig Dice Reset is absent even with secondary menu open');await page.locator('#moreMenuToggle').click();
      }
      await capture(pair.host,'game-gig-disabled');
      const recovery=await pair.host.evaluate(()=>{const s=JSON.parse(sessionStorage.getItem('tcgate-alpha-room-session-v1'));return {room:s.roomCode,peer:s.peerId};});
      await pair.host.reload();
      await pair.host.waitForFunction(()=>document.querySelector('#screenGame').classList.contains('active')&&document.querySelector('#remoteVideo').videoWidth>0,{},{timeout:90000});
      const restored=await pair.host.evaluate(()=>{const s=JSON.parse(sessionStorage.getItem('tcgate-alpha-room-session-v1'));return {room:s.roomCode,peer:s.peerId};});
      check(restored.room===recovery.room&&restored.peer===recovery.peer,'F5 preserves the same real room and peer identity');
      check(!(await pair.host.locator('#gigDicePanel').isVisible()),'Disabled Gig Dice remains absent after recovery');
      check(signals.slice(disabledSignalStart).every(signal=>signal.type!=='gig-state'),'No Gig state/request signal is sent while the room option is false, including F5');
      check(signals.some(signal=>signal.type==='offer')&&signals.some(signal=>signal.type==='answer'),'Real offer/answer signaling occurred');
      console.log('UI12_DISABLED_ROOM_OK',JSON.stringify({assertions,roomCodeLength:pair.code.length,recovery:true,gigSignalsWhileDisabled:0}));
    }finally{await closePair(pair);}
    const enabled=await createPair(browser,errors,signals,requests,'enabled',{invite:true});
    try{
      check(await enabled.host.locator('#gigDiceToggle').getAttribute('aria-pressed')==='true','Fresh Cyberpunk room defaults to Gig Dice enabled');
      check(await enabled.guest.locator('#gigDiceToggle').getAttribute('aria-pressed')==='true','Guest hydrates enabled Gig Dice through the real room snapshot');
      await enterGame(enabled);
      for(const page of [enabled.host,enabled.guest]){check(await page.locator('#gigDicePanel').isVisible()&&await page.locator('#gigTotem').isVisible(),'Existing Gig Dice totem remains available when enabled');await openGameMenu(page);check(await page.locator('#gigDiceReset').isVisible(),'Existing Gig Reset remains available when enabled');await page.locator('#moreMenuToggle').click();}
      await capture(enabled.host,'game-gig-enabled');
    }finally{await closePair(enabled);}
    const noGame=await createPair(browser,errors,signals,requests,'no-game');
    try{
      await noGame.host.locator('#gameSelect').selectOption('no-game');
      await noGame.guest.waitForFunction(()=>document.querySelector('#hubGameReadonlyValue').textContent.includes('Sans jeu'));
      for(const page of [noGame.host,noGame.guest]){
        check(await page.locator('#gigDiceToggle').getAttribute('aria-pressed')==='false','No-game forces Gig Dice false');
        check(!(await page.locator('#gigDiceToggle').isVisible())||await page.locator('#gigDiceToggle').isDisabled(),'No-game never offers an editable Gig Dice switch');
      }
      await capture(noGame.host,'session-no-game');
    }finally{await closePair(noGame);}
    assert.deepEqual(errors,[],'No uncaught browser errors');
    console.log('TCGATE_UI_1_2_BROWSER_OK',JSON.stringify({assertions,homePages:5,lobbyTabs:3,viewports:viewports.map(v=>v.width+'x'+v.height),realRoomSseWebRtc:true,fakeCameraAndAudio:true,physicalDevicesValidated:false,elapsedSeconds:Math.round((Date.now()-startedAt)/1000)}));
  }finally{await browser?.close();server.kill();}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
