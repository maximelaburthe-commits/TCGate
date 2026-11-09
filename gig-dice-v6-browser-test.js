'use strict';
// Two independent browser contexts, real local Room/SSE/WebRTC, synthetic devices.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require(process.env.WORKSPACE_PLAYWRIGHT_PATH || 'playwright');
const { startBridgeFixture } = require('./report-email-bridge-fixture');
const root = process.cwd();
const evidence = process.env.WORKSPACE_SCREENSHOT_DIR;
const observations = { assertions: 0, errors: [], signals: [], geometry: [], transfers: [], syntheticCamera: true, physicalHardware: 'NOT TESTED', remoteTURN: 'NOT TESTED' };
const check = (value, label) => { assert(value, label); observations.assertions++; };
const equal = (actual, expected, label) => { assert.deepEqual(actual, expected, label); observations.assertions++; };
let phase = 'init';
function step(value) { phase = value; console.log('GIG_V6_STEP ' + value); }
async function createPair(browser, origin, mode, enabled = true) {
  const contexts = await Promise.all([0, 1].map(() => browser.newContext({ viewport: { width: 1366, height: 900 }, permissions: ['camera', 'microphone'] })));
  const pages = await Promise.all(contexts.map(context => context.newPage())); const [host, guest] = pages;
  for (let index = 0; index < pages.length; index++) {
    pages[index].on('pageerror', error => observations.errors.push(mode + '/' + index + ': ' + error.message));
    pages[index].on('request', request => { if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/signal') observations.signals.push({ mode, role: index ? 'guest' : 'host', type: request.postDataJSON().type }); });
  }
  await host.goto(origin + '/'); await host.locator('#goCreate').click(); await host.locator('#setupContinue').click();
  await host.waitForFunction(() => /^[A-Z0-9]{6}$/.test(document.querySelector('#lobbyCode').textContent.trim()));
  const code = (await host.locator('#lobbyCode').innerText()).trim();
  await host.locator('#playerName').fill('Host Gig'); await host.locator('#playerName').press('Tab');
  if (!enabled) await host.locator('#gigDiceToggle').click();
  await guest.goto(origin + '/'); await guest.locator('#goJoin').click(); await guest.locator('#playerName').fill('Guest Gig'); await guest.locator('#roomCodeInput').fill(code); await guest.locator('#setupContinue').click();
  await host.waitForFunction(() => document.querySelector('#lobbyOpponentName').textContent.startsWith('Guest Gig'));
  for (const page of pages) {
    await page.locator('[data-lobby-page="installation"]').click(); await page.locator('#enableMedia').click();
    await page.waitForFunction(() => document.querySelector('#lobbyPreview').videoWidth > 0 && document.querySelector('#lobbyPreview').srcObject?.getAudioTracks().some(track => track.readyState === 'live'), {}, { timeout: 45000 });
    await page.waitForFunction(() => !document.querySelector('#startGame').disabled);
  }
  await host.locator('#startGame').click(); await guest.locator('#startGame').click();
  for (const page of pages) await page.waitForFunction(() => document.querySelector('#screenGame').classList.contains('active') && ['localVideo', 'remoteVideo'].every(id => { const video = document.getElementById(id); return video.videoWidth > 0 && video.srcObject?.getVideoTracks().some(track => track.readyState === 'live'); }), {}, { timeout: 90000 });
  return {host, guest, pages, close: () => Promise.all(contexts.map(context => context.close()))};
}
async function snapshot(pair) { return Promise.all(pair.pages.map(page => page.evaluate(() => ({ dice: serializeGigState(), self: streetCred('self'), opponent: streetCred('opponent'), role: state.role })))); }
async function synchronized(pair, label) {
  const wanted = await pair.host.evaluate(() => JSON.stringify(serializeGigState()));
  await pair.guest.waitForFunction(expected => JSON.stringify(serializeGigState()) === expected, wanted, { timeout: 20000 });
  const [host, guest] = await snapshot(pair); equal(host.dice, guest.dice, label + ': canonical dice synchronized'); equal(host.self, guest.opponent, label + ': host Street Cred mirrored'); equal(host.opponent, guest.self, label + ': guest Street Cred mirrored');
  for (const page of pair.pages) equal(await page.locator('#gigSelfCred').innerText(), String(await page.evaluate(() => streetCred('self'))), label + ': displayed own Street Cred');
  return [host, guest];
}
async function capture(page, mode, name) { if (evidence) { const dir = path.join(evidence, mode); fs.mkdirSync(dir, {recursive:true}); await page.screenshot({ path: path.join(dir, name + '.png') }); } }
async function expanded(page, value) { if ((await page.locator('#gigTotem').getAttribute('aria-expanded') === 'true') !== value) await page.locator('#gigTotem').click(); await page.waitForTimeout(120); }
async function geometry(page, width, label) {
  const data = await page.evaluate(() => {
    const panel = document.getElementById('gigDicePanel'), box = panel.getBoundingClientRect(), container = gigPanelContainer(panel), rootBox = container.getBoundingClientRect();
    const obstacles = window.TCGateGigDiceV6?.obstacles(container) || [];
    const blocked = obstacles.filter(rect => box.right - rootBox.left > rect.left && box.left - rootBox.left < rect.right && box.bottom - rootBox.top > rect.top && box.top - rootBox.top < rect.bottom);
    const video = document.getElementById('remoteVideo').getBoundingClientRect();
    return { width: innerWidth, box: {x:box.x,y:box.y,width:box.width,height:box.height}, blocked, overflow: document.documentElement.scrollWidth - innerWidth, video: {width:video.width,height:video.height}, cameraLive: document.getElementById('remoteVideo').srcObject?.getVideoTracks().some(t => t.readyState === 'live') };
  });
  observations.geometry.push({label, ...data});
  check(data.overflow <= 1, label + ': no page horizontal overflow'); check(data.cameraLive, label + ': remote camera stays live'); check(data.video.width * data.video.height >= width * 700 * .6, label + ': webcam remains principal surface');
  if (label.startsWith('after')) { check(data.blocked.length === 0, label + ': no PIP / Vision / camera controls overlap ' + JSON.stringify(data)); check(data.box.x >= 0 && data.box.x + data.box.width <= width + 1, label + ': Gig inside horizontal viewport'); check(data.box.y >= 0 && data.box.y + data.box.height <= 900 + 1, label + ': Gig inside vertical viewport'); }
}
async function views(pair, mode, off = false) {
  for (const width of [1366, 1920, 900, 390]) {
    await pair.host.setViewportSize({width, height:900}); await pair.host.waitForTimeout(220);
    if (!off) {
      await expanded(pair.host, true); await geometry(pair.host, width, mode + '-open-' + width); await capture(pair.host, mode, 'gig-open-' + width);
      await expanded(pair.host, false); await geometry(pair.host, width, mode + '-collapsed-' + width); await capture(pair.host, mode, 'gig-collapsed-' + width);
      for (const id of ['gigSelfCred', 'gigOpponentCred']) check(await pair.host.locator('#' + id).isVisible(), mode + ': both Street Cred totals visible when collapsed');
    } else { check(!await pair.host.locator('#gigDicePanel').isVisible(), mode + ': disabled room option hides Gig'); await capture(pair.host, mode, 'gig-off-' + width); }
  }
  await pair.host.setViewportSize({width:1366,height:900}); if (!off) await expanded(pair.host, true);
}
async function dragDie(page, id, targetOwner) {
  const token = page.locator('[data-die-id="' + id + '"] .die-token2'), target = page.locator('.gig-side2.' + targetOwner);
  const from = await token.boundingBox(), to = await target.boundingBox();
  await page.mouse.move(from.x + from.width/2, from.y + from.height/2); await page.mouse.down();
  await page.mouse.move(to.x + to.width/2, to.y + to.height/2, {steps:12}); await page.mouse.up();
}
async function afterTests(pair) {
  step('native hover, original SVG, one visible numeric value');
  await pair.host.waitForFunction(() => window.TCGateGigDiceV6?.version === '6.0');
  await expanded(pair.host, true);
  for (const sides of [4,6,8,10,12,20]) {
    const token = pair.host.locator('[data-die-id="host-d' + sides + '"] .die-token2');
    await pair.host.mouse.move(1,1); await pair.host.waitForTimeout(30);
    equal(await token.evaluate(element => getComputedStyle(element, '::after').opacity), '0', 'D' + sides + ': type hidden at rest');
    await token.hover(); await pair.host.waitForTimeout(30);
    const visual = await token.evaluate(element => ({ type: element.dataset.dieType, tooltip: getComputedStyle(element,'::after').opacity, title: element.getAttribute('title'), sourceNumber: getComputedStyle(element.querySelector('.die-score2')).visibility, zoomNumber: getComputedStyle(document.querySelector('.die-zoom-layer .die-score2')).visibility, svg: element.querySelector('svg').outerHTML, key: element.dataset.dieType }));
    equal(visual.type, 'D' + sides, 'Hover type label'); equal(visual.tooltip, '1', 'Type visible only on hover'); equal(visual.title, null, 'No native duplicate tooltip'); equal(visual.sourceNumber, 'hidden', 'Source number hidden under zoom'); equal(visual.zoomNumber, 'visible', 'Exactly one zoom number visible');
    if (sides === 12) await capture(pair.host, 'after', 'gig-hover-D12-1366');
    check(await token.evaluate((element, key) => { const probe = document.createElement('div'); probe.innerHTML = GIG_DICE_ICONS[key]; return probe.firstElementChild.outerHTML === element.querySelector('svg').outerHTML; }, 'D' + sides), 'Exact native SVG DOM for D' + sides);
  }
  if (process.env.GIG_V6_FOCUSED !== '1') {
  step('native mouse controls and min/max of every die in both roles');
  for (const [page, prefix] of [[pair.host,'host'], [pair.guest,'guest']]) {
    await expanded(page, true);
    for (const sides of [4,6,8,10,12,20]) {
      const slot = page.locator('[data-die-id="' + prefix + '-d' + sides + '"]');
      await slot.locator('.die-token2').hover();
      for (let index=0; index<sides+2; index++) await slot.locator('[data-action="increment"]').click({delay:0});
      equal(await page.evaluate(id => state.gigDice.find(die => die.id === id).value, prefix+'-d'+sides), sides, prefix + ' D' + sides + ': upper bound by real controls');
      for (let index=0; index<sides+2; index++) await slot.locator('[data-action="decrement"]').click({delay:0});
      equal(await page.evaluate(id => state.gigDice.find(die => die.id === id).value, prefix+'-d'+sides), 0, prefix + ' D' + sides + ': lower bound by rapid real controls');
    }
    await synchronized(pair, prefix + '-bounds');
  }
  step('nonzero pointer transfers with identity/color/Street Cred synchronization');
  const id = 'host-d12';
  const slot = pair.host.locator('[data-die-id="'+id+'"]'); await slot.locator('.die-token2').hover();
  for (let index=0; index<7; index++) await slot.locator('[data-action="increment"]').click({delay:0});
  await synchronized(pair, 'value-seven');
  const before = await pair.host.evaluate(id => ({die:{...state.gigDice.find(d => d.id===id)},color:getComputedStyle(document.querySelector('[data-die-id="'+id+'"] .die-token2')).color}), id);
  await dragDie(pair.host, id, 'opponent');
  await pair.host.waitForFunction(id => state.gigDice.find(d => d.id===id).owner==='guest', id); let states = await synchronized(pair, 'host-to-guest');
  const moved = states[0].dice.find(d=>d.id===id); equal({...moved,owner:'host'},before.die,'Transfer preserves die ID/origin/value/sides');
  equal(await pair.host.locator('[data-die-id="'+id+'"] .die-token2').evaluate(element=>getComputedStyle(element).color),before.color,'Transfer preserves original color'); equal(states[0].self,0,'Host Cred released'); equal(states[0].opponent,7,'Guest Cred receives nonzero die');
  observations.transfers.push({direction:'host-to-guest', states});
  await dragDie(pair.guest,id,'opponent'); await pair.guest.waitForFunction(id=>state.gigDice.find(d=>d.id===id).owner==='host',id);
  states=await synchronized(pair,'guest-to-host'); equal(states[0].dice.find(d=>d.id===id),before.die,'Round trip restores exact die'); observations.transfers.push({direction:'guest-to-host',states});
  }
  step('collapse, drag, obstacles, resolutions and restoration');
  const saved=await pair.host.evaluate(()=>JSON.stringify(serializeGigState())); await expanded(pair.host,false); await expanded(pair.host,true); equal(await pair.host.evaluate(()=>JSON.stringify(serializeGigState())),saved,'Collapse preserves state');
  const handle=pair.host.locator('#gigDiceDragHandle'), h=await handle.boundingBox(), start=await pair.host.locator('#gigDicePanel').boundingBox();
  await pair.host.mouse.move(h.x+h.width/2,h.y+h.height/2); await pair.host.mouse.down(); await pair.host.mouse.move(170,300,{steps:12}); await pair.host.mouse.up();
  const end=await pair.host.locator('#gigDicePanel').boundingBox(); check(Math.hypot(start.x-end.x,start.y-end.y)>50,'Module genuinely draggable'); await geometry(pair.host,1366,'after-drag-safe'); await capture(pair.host,'after','gig-drag-safe-1366');
  // Attempt to place directly over the visible local PIP; placement must stay safe.
  const pip=await pair.host.locator('.tcgate-local-pip').boundingBox(), hh=await handle.boundingBox();
  await pair.host.mouse.move(hh.x+hh.width/2,hh.y+hh.height/2); await pair.host.mouse.down(); await pair.host.mouse.move(pip.x+20,pip.y+20,{steps:12}); await pair.host.mouse.up(); await geometry(pair.host,1366,'after-drag-pip-guard');
  await views(pair,'after');
  step('real fullscreen relocation and safe drag');
  await pair.host.evaluate(() => document.querySelector('#fullscreenOpponent').click());
  await pair.host.waitForFunction(() => document.fullscreenElement === document.querySelector('.opponent-feed-card'));
  await pair.host.waitForTimeout(200); await expanded(pair.host, true);
  check(await pair.host.locator('#gigDicePanel').evaluate(element => element.parentElement === document.fullscreenElement), 'Fullscreen uses existing native panel relocation');
  await geometry(pair.host, 1366, 'after-fullscreen'); await capture(pair.host, 'after', 'gig-fullscreen-1366');
  const fullHandle = await pair.host.locator('#gigDiceDragHandle').boundingBox();
  await pair.host.mouse.move(fullHandle.x+fullHandle.width/2,fullHandle.y+fullHandle.height/2); await pair.host.mouse.down(); await pair.host.mouse.move(200,320,{steps:12}); await pair.host.mouse.up();
  await geometry(pair.host,1366,'after-fullscreen-drag');
  await pair.host.evaluate(() => document.exitFullscreen()); await pair.host.waitForFunction(() => !document.fullscreenElement);
  await pair.host.waitForTimeout(150); check(await pair.host.locator('#gigDicePanel').evaluate(element => element.parentElement.id === 'gigDiceMount'), 'Exit fullscreen restores existing mount');
  await pair.host.reload(); await pair.host.waitForFunction(()=>state.gameActive&&document.querySelector('#remoteVideo').videoWidth>0,{}, {timeout:90000}); equal(await pair.host.evaluate(()=>JSON.stringify(serializeGigState())),saved,'F5 restores saved canonical dice'); await synchronized(pair,'F5-restoration');
}
(async()=>{
  let browser, fixture;
  try {
    browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-device-for-media-stream=device-count=3,fps=30','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required']}); observations.browserVersion=browser.version();
    if(process.env.GIG_V6_BASELINE_ROOT){ step('before screenshots on frozen original baseline'); fixture=await startBridgeFixture({root:path.resolve(process.env.GIG_V6_BASELINE_ROOT),bridgePath:path.join(process.env.GIG_V6_BASELINE_ROOT,'report-mail-server.js')}); const pair=await createPair(browser,fixture.origin,'before'); try{await views(pair,'before');}finally{await pair.close();} const off=await createPair(browser,fixture.origin,'before-off',false);try{await views(off,'before',true);}finally{await off.close();} await fixture.close(); fixture=null; }
    step('after two-context real local Room/WebRTC'); fixture=await startBridgeFixture({root}); const pair=await createPair(browser,fixture.origin,'after'); try{await afterTests(pair);}finally{await pair.close();} const off=await createPair(browser,fixture.origin,'after-off',false);try{await views(off,'after',true);}finally{await off.close();}
    equal(observations.errors,[],'No uncaught browser errors'); check(observations.signals.filter(item=>item.mode==='after').some(item=>item.type==='gig-state'),'Native Gig-state sync observed'); equal(fixture.requests.length,0,'No real email sent');
    console.log('GIG_DICE_V6_BROWSER_RESULT '+JSON.stringify({assertions:observations.assertions,contexts:2,realLocalWebRTC:true,syntheticCamera:true,boundsAllSides:process.env.GIG_V6_FOCUSED==='1'?'NOT RUN IN FOCUSED RECHECK':'PASS',nonzeroRoundTrip:process.env.GIG_V6_FOCUSED==='1'?'NOT RUN IN FOCUSED RECHECK':'PASS',streetCredHostGuest:'PASS',originalSVG:'PASS',safePlacement:'PASS',resolutions:[1366,1920,900,390],restoration:'PASS'}));
  } finally { if(evidence){fs.mkdirSync(evidence,{recursive:true});fs.writeFileSync(path.join(evidence,'gig-dice-v6-results.json'),JSON.stringify({...observations,phase},null,2));} await browser?.close(); await fixture?.close(); }
})().catch(error=>{console.error('GIG_DICE_V6_BROWSER_FAILURE phase='+phase+'\n'+error.stack);process.exitCode=1;});