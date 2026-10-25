'use strict';
// Real UI, ZIP generation and local email bridge. Resend is intercepted in a test-only child.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const {chromium}=require(process.env.WORKSPACE_PLAYWRIGHT_PATH||'playwright');
const {startBridgeFixture}=require('./report-email-bridge-fixture.js');
let assertions=0;
function check(value,label){assert(value,label);assertions++;}
function zipEntries(zip){
  const entries=new Map();let offset=0;
  while(offset+30<=zip.length&&zip.readUInt32LE(offset)===0x04034b50){
    const flags=zip.readUInt16LE(offset+6),method=zip.readUInt16LE(offset+8),size=zip.readUInt32LE(offset+18),nameLength=zip.readUInt16LE(offset+26),extraLength=zip.readUInt16LE(offset+28);
    check((flags&8)===0,'ZIP entries expose their lengths');
    const name=zip.subarray(offset+30,offset+30+nameLength).toString('utf8'),start=offset+30+nameLength+extraLength;
    check(start+size<=zip.length,'ZIP entry is within attachment');
    const bytes=zip.subarray(start,start+size);
    entries.set(name,method===0?bytes:method===8?zlib.inflateRawSync(bytes):assert.fail('Unsupported ZIP compression'));
    offset=start+size;
  }
  check(zip.readUInt32LE(offset)===0x02014b50,'ZIP includes its central directory');
  return entries;
}
async function waitRoom(page){
  await page.waitForFunction(()=>document.querySelector('#screenLobby').classList.contains('active')&&/^[A-Z0-9]{6}$/.test(document.querySelector('#lobbyCode').textContent.trim()));
  return (await page.locator('#lobbyCode').innerText()).trim();
}
async function report(page,fixture,button,note,phase,{fails=false}={}){
  const before=fixture.requests.length;
  await page.locator(button).click();
  await page.locator('#reportOverlay.show').waitFor();
  await page.locator('#reportText').fill(note);
  const responsePromise=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/report-email'&&r.request().method()==='POST');
  await page.locator('#sendReport').click();
  const response=await responsePromise,result=await response.json(),body=response.request().postDataJSON();
  check(response.status()===(fails?502:200),'Email bridge response reaches unchanged report UI');
  if(fails){
    check(result.ok===false,'Provider failure is reported');
    await page.waitForFunction(()=>document.querySelector('#sendReport').dataset.status==='error'&&!document.querySelector('#sendReport').disabled);
    check(await page.locator('#reportOverlay').evaluate(e=>e.classList.contains('show')),'Failure keeps notes available for retry');
    await page.locator('#closeReport').click();
    return;
  }
  check(JSON.stringify(Object.keys(result).sort())===JSON.stringify(['messageId','ok']),'Minimal success contract suffices for frontend');
  check(result.ok===true&&Boolean(result.messageId),'Mock Resend message identifier is returned');
  const zip=Buffer.from(body.zipBase64,'base64'),entries=zipEntries(zip);
  check(JSON.stringify([...entries.keys()].sort())===JSON.stringify(['README.txt','rapport.txt','report.json']),'Real report ZIP contains the three expected files');
  const diagnostics=JSON.parse(entries.get('report.json').toString('utf8'));
  check(diagnostics.reportSchemaVersion===2,'Actual browser-generated report retains Schema V2');
  check(diagnostics.format==='tcgate-alpha-complete-report','Legacy report format remains present');
  check(diagnostics.privacy.userJourneyCollected===false,'V2 privacy contract is retained');
  check(diagnostics.diagnostics.network&&diagnostics.diagnostics.vision&&diagnostics.diagnostics.database,'Independent diagnostic sections remain present');
  check(body.context.startsWith(phase+' ·'),'UI preserves report context '+phase);
  check(body.roomCode.length===6&&body.note===note,'UI preserves room and tester note');
  await page.waitForFunction(()=>document.querySelector('#sendReport').dataset.status==='success');
  await page.waitForFunction(()=>!document.querySelector('#reportOverlay').classList.contains('show'));
  check(fixture.requests.length===before+1,'Exactly one mocked Resend delivery occurred');
  const capture=fixture.requests.at(-1);
  check(capture.payload.attachments[0].sha256===crypto.createHash('sha256').update(zip).digest('hex'),'ZIP bytes reach Resend unchanged');
  check(capture.payload.attachments[0].size===zip.length,'Resend receives the entire ZIP');
}
async function run(){
  const fixture=await startBridgeFixture({root:__dirname});let browser;
  const errors=[];
  try{
    const status=await fetch(fixture.origin+'/api/report-email/status').then(r=>r.json());
    check(JSON.stringify(status)===JSON.stringify({ok:true,configured:true}),'Simplified public status works');
    browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required']});
    const contexts=await Promise.all([1,2].map(()=>browser.newContext({viewport:{width:1366,height:768},permissions:['camera','microphone']})));
    const [host,guest]=await Promise.all(contexts.map(c=>c.newPage()));
    for(const page of [host,guest])page.on('pageerror',e=>errors.push(e.message));
    await host.goto(fixture.origin+'/');await host.locator('#goCreate').click();const code=await waitRoom(host);
    await host.locator('#gameSelect').selectOption('no-game');
    await host.locator('#playerName').fill('Report Host');await host.locator('#playerName').press('Tab');
    await guest.goto(fixture.origin+'/');await guest.locator('#goJoin').click();await guest.locator('#playerName').fill('Report Guest');await guest.locator('#roomCodeInput').fill(code);await guest.locator('#setupContinue').click();
    check(await waitRoom(guest)===code,'Report smoke uses a real Host/Guest room');
    await guest.waitForFunction(()=>document.querySelector('#hubGameReadonlyValue').textContent.includes('Sans jeu'));
    await report(host,fixture,'#generateReportLobby','Rapport Lobby <test>\nContexte testeur','salon');
    for(const page of [host,guest]){
      await page.locator('[data-lobby-page="installation"]').click();await page.locator('#enableMedia').click();
      await page.waitForFunction(()=>{const v=document.querySelector('#lobbyPreview');return v.videoWidth>0&&v.srcObject?.getAudioTracks().some(t=>t.readyState==='live');});
      await page.waitForFunction(()=>!document.querySelector('#startGame').disabled);
    }
    await host.locator('#startGame').click();await guest.locator('#startGame').click();
    for(const page of [host,guest])await page.waitForFunction(()=>document.querySelector('#screenGame').classList.contains('active'),{},{timeout:60000});
    check(true,'Existing Ready launches the Table');
    async function menu(){const box=await host.locator('#opponentFeed').boundingBox();await host.mouse.move(box.x+box.width/2,box.y+box.height/2);await host.locator('#moreMenuToggle').click();}
    await menu();await report(host,fixture,'#generateReportGame','','partie');
    await fixture.setMode('server-error');
    await menu();await report(host,fixture,'#generateReportGame','Note conservée en cas d’erreur','partie',{fails:true});
    check(errors.length===0,'No uncaught browser errors: '+errors.join(';'));
    console.log('REPORT_EMAIL_BROWSER_OK '+JSON.stringify({assertions,realLobbyAndTableZip:true,reportSchemaVersion:2,unchangedZipToMockedResend:true,fakeMedia:true,externalEmailsSent:0}));
  }finally{await browser?.close();await fixture.close();}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
