'use strict';
// Deterministic UI regression: canonical state is mocked, Vision's real lazy runtime is retained.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {spawn} = require('node:child_process');
const {chromium} = require(process.env.WORKSPACE_PLAYWRIGHT_PATH || 'playwright');
const origin = 'http://127.0.0.1:4390';
const canonicalUrl = 'https://raw.githubusercontent.com/maximelaburthe-commits/TCGate/workspace-state/tcgate_workspace_state.json';
const productionUrl = 'https://tcg-webcam-test-production.up.railway.app/';
const xssText = '<img src=x onerror="window.__workspaceXss=true">';
const categories = [
  ['general', 'Général'], ['vision', 'Vision'], ['bdd', 'BDD'],
  ['uiux', 'UI / UX'], ['annex', 'Fonctions annexes']
];
function item(id, category, status, progress, weight, roadmap = true) {
  return {id, category, name:'Fonction ' + id, summary:'Résumé canonique ' + id,
    status, progress, weight, roadmap, maturity:'Maturité ' + id,
    track:'fixture/' + id, version:'Version ' + id, notes:'Notes ' + id,
    history:[{date:'2026-10-24', text:'Historique ' + id}]};
}
function fixture(revision = 1) {
  const state = {
    meta:{workspaceVersion:'3.0', generatedAt:'fixture-' + revision, project:'TCGate',
      production:{label:'Production témoin', branch:'main', sha:'a'.repeat(40)},
      candidate:{label:'Candidate témoin', branch:'candidate/alpha-0.1-c14', sha:'b'.repeat(40), note:'Candidate non promue'},
      development:{label:'Développement témoin', branch:'update/next', sha:'c'.repeat(40), sync:'diverged', ahead:3, behind:2, note:'État de développement témoin'},
      principle:'Principe du workspace canonique'},
    categories:categories.map(([id,label])=>({id,label,description:'Description ' + id})),
    items:[
      item('general-core','general','stable',90,4),
      {...item('vision-lab','vision','stable',60,2),name:'Vision Lab'},
      item('vision-detect','vision','experimental',40,1),
      item('bdd-runtime','bdd','qualified',80,3),
      item('bdd-registry','bdd','prototype',20,9,false),
      item('ui-attention','uiux','attention',20,1),
      item('annex-abandoned','annex','abandoned',100,100),
      item('annex-weightless','annex','planned',0,0)
    ],
    session:{
      activeWork:[{title:'Travail canonique ' + revision, detail:'Détail en cours ' + revision, status:'active'}],
      priorities:[{title:'Priorité canonique ' + revision, detail:'Détail priorité ' + revision, status:'next'}],
      decisions:[{title:'Décision canonique ' + revision, detail:'Détail décision ' + revision, status:'open'}],
      notes:'Notes de reprise ' + revision + ' · ' + xssText
    },
    verification:{verifiedAt:'2026-10-24',source:'Source témoin',main:'a'.repeat(40),candidate14:'b'.repeat(40),updateNext:'c'.repeat(40),
      updateVsMain:{status:'diverged',ahead:3,behind:2},candidate14VsMain:{status:'ahead',ahead:1,behind:0}},
    visionLab:{version:'0.5.1-r14.1',qualification:'R14.1 ERA',role:'Laboratoire témoin',productionIsolation:true,principles:[],campaigns:[]},
    sync:{remoteStateAutoSync:true,remoteStateMode:'canonical',remoteStateUrl:canonicalUrl}
  };
  if (revision === 2) {
    state.items[0].progress = 10;
    state.items.push(item('annex-new','annex','stable',100,1));
  }
  return state;
}
async function assertNoOverflow(page, label) {
  const geometry = await page.evaluate(()=>({
    width:innerWidth, scroll:document.documentElement.scrollWidth,
    offenders:[...document.querySelectorAll('body *')].filter(e=>{
      const r=e.getBoundingClientRect();return r.width>0 && (r.right>innerWidth+1 || r.left < -1);
    }).slice(0,8).map(e=>({id:e.id,tag:e.tagName,className:e.className}))
  }));
  assert(geometry.scroll <= geometry.width + 1, label + ' horizontal overflow: ' + JSON.stringify(geometry));
}
async function choose(page, name) {
  const tab = page.getByRole('tab',{name,exact:true});
  await tab.click();
  assert.equal(await tab.getAttribute('aria-selected'),'true',name + ' selected state');
  const controlled = await tab.getAttribute('aria-controls');
  assert(controlled,name + ' has a controlled panel');
  assert(await page.locator('#' + controlled).isVisible(),name + ' panel visible');
  assert.equal(await page.locator('[role=tabpanel]:visible').count(),1,name + ' is the sole visible panel');
}
async function assertMetrics(page, revision) {
  const expected = revision === 1 ? {overall:71,count:8,stable:3,attention:3} : {overall:47,count:9,stable:4,attention:3};
  await choose(page,'Général');
  assert.equal((await page.locator('#overall').innerText()).replace(/\s/g,''),expected.overall + '%');
  assert.equal(Number(await page.locator('#count').innerText()),expected.count);
  assert.equal(Number(await page.locator('#stableCount').innerText()),expected.stable);
  assert.equal(Number(await page.locator('#attentionCount').innerText()),expected.attention);
  const progress = await page.locator('#overallBar').evaluate(e=>Number.parseFloat(e.getAttribute('aria-valuenow') ?? e.getAttribute('value') ?? e.style.width));
  assert.equal(progress,expected.overall,'Roadmap indicator reflects the score');
}
async function screenshot(page, name) {
  if (!process.env.WORKSPACE_SCREENSHOT_DIR) return;
  fs.mkdirSync(process.env.WORKSPACE_SCREENSHOT_DIR,{recursive:true});
  await page.screenshot({path:path.join(process.env.WORKSPACE_SCREENSHOT_DIR,name + '.png'),fullPage:true});
}
async function assertLabReady(page, requests) {
  await choose(page,'Vision Lab');
  await page.waitForFunction(()=>!document.querySelector('#visionCameraButton').disabled);
  assert(await page.getByRole('button',{name:'Activer la caméra',exact:true}).isVisible());
  assert(await page.locator('#labControls').isVisible());
  assert(await page.locator('#labInspect').isVisible());
  assert(await page.locator('#labStart').isDisabled());
  assert(await page.locator('#identificationToggle').isDisabled());
  assert.equal(await page.evaluate(()=>window.__cameraCalls),0,'Navigation never requests a camera automatically');
  assert.equal(await page.evaluate(()=>Boolean(window.TCGIdentificationLab)),false,'Identification stays lazy');
  assert.equal(requests.some(r=>/\/identification(?:-worker)?\.js(?:$|\?)/.test(r.url)),false,'No matcher script is needed for camera controls');
}
async function run() {
  const server=spawn(process.execPath,['server.js'],{cwd:process.cwd(),env:{...process.env,PORT:'4390',HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});
  let browser,logs='';server.stdout.on('data',d=>logs+=d);server.stderr.on('data',d=>logs+=d);
  try {
    let ready=false;
    for(let i=0;i<60;i++){try{if((await fetch(origin+'/api/health')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
    assert(ready,'Workspace server ready: ' + logs);
    browser=await chromium.launch({channel:'chrome',headless:true});
    const context=await browser.newContext({viewport:{width:1920,height:1080}});
    await context.addInitScript(()=>{
      window.__workspaceXss=false;window.__cameraCalls=0;
      if(navigator.mediaDevices?.getUserMedia){const native=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=constraints=>{window.__cameraCalls++;return native(constraints);};}
    });
    const page=await context.newPage(),errors=[],requests=[],canonicalRequests=[];let revision=1;
    page.on('pageerror',e=>errors.push(e.message));
    page.on('request',r=>requests.push({url:r.url(),method:r.method()}));
    await page.route(canonicalUrl,route=>{canonicalRequests.push(route.request().url());return route.fulfill({json:fixture(revision)});});
    await page.goto(origin+'/workspace.html');
    await page.waitForFunction(()=>document.querySelector('#workspaceStateStatus').textContent.includes('fixture-1'));
    assert.equal(canonicalRequests.length,1);
    const labels=['Reprise','Général','Vision','BDD','UI / UX','Fonctions annexes','Vision Lab'];
    const sidebarTabs=page.locator('#workspaceSidebar [role=tab]');
    assert.equal(await sidebarTabs.count(),labels.length);
    for(const label of labels)assert.equal(await page.locator('#workspaceSidebar').getByRole('tab',{name:label,exact:true}).count(),1);
    assert.deepEqual(await sidebarTabs.evaluateAll(tabs=>tabs.map(tab=>tab.getAttribute('aria-controls'))),['panel-reprise','panel-general','panel-vision','panel-bdd','panel-uiux','panel-annex','panel-lab']);
    const production=page.getByRole('link',{name:'Production TCGate',exact:true});
    assert.equal(await production.getAttribute('href'),productionUrl);
    assert(await production.isVisible());
    await choose(page,'Reprise');
    for(const heading of ['Production','Candidate disponible','Développement','En cours actuellement','Prochaines priorités','Décisions à prendre','Notes de reprise','État vérifié'])assert(await page.locator('#content-reprise').getByRole('heading',{name:heading,exact:true}).isVisible(),heading);
    for(const [id,sha]of [['production','a'],['candidate','b'],['development','c']])assert((await page.locator('#content-reprise [data-testid=ref-' + id + ']').innerText()).includes(sha.repeat(40)));
    for(const text of ['Travail canonique 1','Priorité canonique 1','Décision canonique 1','Source témoin'])assert((await page.locator('#content-reprise').innerText()).includes(text));
    assert((await page.locator('#content-reprise').innerText()).includes(xssText),'State notes render as literal text');
    assert.equal(await page.locator('#content-reprise img[src=x]').count(),0);
    assert.equal(await page.evaluate(()=>window.__workspaceXss),false);
    await assertMetrics(page,1);
    for(const [id,label]of categories){
      await choose(page,label);
      const expected=fixture().items.filter(i=>i.category===id),content=page.locator('#content-'+id);
      assert.equal(await content.locator('[data-item-id]').count(),expected.length,label+' preserves every tracked state item');
      for(const row of expected){
        const rendered=content.locator('[data-item-id="'+row.id+'"]');
        assert((await rendered.innerText()).includes(row.name));
        await rendered.locator('summary').click();
        assert(await rendered.locator('details').evaluate(detail=>detail.open),'Function details expand');
        for(const value of [row.summary,row.maturity,row.version,row.notes,row.history[0].text])assert((await rendered.innerText()).includes(value),row.id+' expanded detail: '+value);
      }
    }
    await choose(page,'BDD');
    assert(await page.locator('#databaseCards').getByRole('heading',{name:'Cyberpunk',exact:true}).isVisible());
    assert(await page.locator('#databaseCards').getByRole('heading',{name:'SWU',exact:true}).isVisible());
    await choose(page,'Vision');
    await page.getByRole('button',{name:'Ouvrir Vision Lab',exact:true}).click();
    assert.equal(await page.getByRole('tab',{name:'Vision Lab',exact:true}).getAttribute('aria-selected'),'true');
    await assertLabReady(page,requests);
    for(const viewport of [{width:1920,height:1080},{width:1366,height:900},{width:900,height:900},{width:560,height:900}]){
      await page.setViewportSize(viewport);
      for(const label of labels){
        await choose(page,label);
        await assertNoOverflow(page,viewport.width+' '+label);
        assert(await production.isVisible(),viewport.width+' permanent production link');
        if(viewport.width>=1366 && ['Reprise','Général','Vision','Vision Lab'].includes(label))await screenshot(page,'workspace-cockpit-'+viewport.width+'-'+({'Reprise':'reprise','Général':'general','Vision':'vision','Vision Lab':'lab'}[label]));
      }
      const feed=await page.locator('#opponentFeed').boundingBox();
      const minimum=viewport.width>=1366?500:viewport.width===900?500:350;
      assert(feed&&feed.width>=minimum,viewport.width+' webcam stage remains large: '+JSON.stringify(feed));
      if(viewport.width>=1366){const side=await page.locator('#workspaceSidebar').boundingBox();assert(side.width<320,'Desktop sidebar stays compact');assert(feed.x>=side.x+side.width-1,'Desktop Lab appears alongside sidebar');}
    }
    // Refreshing canonical planning data neither starts nor rebuilds Vision.
    await page.setViewportSize({width:1366,height:900});
    await page.evaluate(()=>window.__beforeWorkspaceSync=window.TCGVisionEngine);
    revision=2;await page.click('#workspaceSync');
    await page.waitForFunction(()=>document.querySelector('#workspaceStateStatus').textContent.includes('fixture-2'));
    assert.equal(canonicalRequests.length,2);
    assert.equal(await page.evaluate(()=>window.__beforeWorkspaceSync===window.TCGVisionEngine),true);
    await choose(page,'Reprise');assert((await page.locator('#content-reprise').innerText()).includes('Notes de reprise 2'));
    await assertMetrics(page,2);
    await choose(page,'Fonctions annexes');assert(await page.locator('#content-annex [data-item-id=annex-new]').isVisible());
    await assertLabReady(page,requests);
    assert.equal(requests.some(r=>r.method!=='GET'),false);
    assert.equal(requests.some(r=>['/api/rooms','/api/create','/api/join','/api/events'].some(p=>r.url.includes(p))),false);
    assert.deepEqual(errors,[]);
    // A failed canonical state fetch must not hide or block the independent Lab.
    const failedPage=await context.newPage(),failedErrors=[],failedRequests=[];
    failedPage.on('pageerror',e=>failedErrors.push(e.message));
    failedPage.on('request',r=>failedRequests.push({url:r.url(),method:r.method()}));
    await failedPage.route(canonicalUrl,route=>route.fulfill({status:503,body:'canonical fixture unavailable'}));
    await failedPage.goto(origin+'/workspace.html');
    await failedPage.waitForFunction(()=>document.querySelector('#workspaceStateStatus').textContent.includes('indisponible'));
    await assertLabReady(failedPage,failedRequests);
    assert.deepEqual(failedErrors,[]);
    console.log('WORKSPACE_COCKPIT_BROWSER_OK · seven views; canonical references, weighted metrics, categories, safe text, sync and failure isolation; production link; 1920/1366/900/560 responsive; independent lazy camera controls');
  } finally {await browser?.close();server.kill();}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
