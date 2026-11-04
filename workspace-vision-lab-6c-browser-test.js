'use strict';
// UI-only synthetic observations remain AUTOMATED; they never qualify cards.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require(process.env.WORKSPACE_PLAYWRIGHT_PATH || 'playwright');
const helper = require('./workspace-vision-qualification-browser-test.js');
const { startBridgeFixture } = require(path.join(helper.root, 'report-email-bridge-fixture.js'));
let assertions = 0;
function check(value, message) { assert(value, message); assertions++; }
function equal(actual, expected, message) { assert.deepEqual(actual, expected, message); assertions++; }
async function geometry(page) {
  return page.evaluate(() => {
    const rect = selector => { const value = document.querySelector(selector).getBoundingClientRect(); return { x: value.x, y: value.y, right: value.right, bottom: value.bottom, width: value.width, height: value.height }; };
    const primary = [...document.querySelectorAll('#vqActions button')].find(button => !button.hidden);
    return { viewport: { width: innerWidth, height: innerHeight }, console: rect('#vqWorkflow'), camera: rect('#opponentFeed'), card: rect('#vqCardName'), action: rect('#' + primary.id), bar: rect('#vqControlBar'), details: rect('#vqDetailsScroll'), scrollY, horizontal: document.documentElement.scrollWidth > innerWidth, count: document.querySelectorAll('#remoteVideo').length };
  });
}
function inside(rect, viewport) { return rect.width > 0 && rect.height > 0 && rect.x >= 0 && rect.y >= 0 && rect.right <= viewport.width + 1 && rect.bottom <= viewport.height + 1; }
async function viewportCase(browser, fixture, pinned, actualContext, width, height) {
  const context = await browser.newContext({ permissions: ['camera'], viewport: { width, height } }), control = helper.controls(), errors = [];
  try {
    await helper.installRoutes(context, fixture, pinned, control);
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      window.__stationCameraCalls = 0;
      const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = constraints => { window.__stationCameraCalls++; return real(constraints); };
    });
    await page.clock.install({ time: new Date('2026-11-03T13:00:00Z') });
    await helper.openLab(page, fixture.origin);
    await page.waitForFunction(() => !document.querySelector('#visionCameraButton').disabled);
    const videoHandle = await page.$('#remoteVideo');
    await page.click('#visionCameraButton');
    await page.waitForFunction(() => document.querySelector('#remoteVideo').videoWidth > 0);
    await page.evaluate(() => { window.__stationStream = document.querySelector('#remoteVideo').srcObject; });
    let normal = await page.evaluate(() => {
      const rect = id => { const r = document.getElementById(id).getBoundingClientRect(); return { x:r.x, y:r.y, right:r.right, bottom:r.bottom, width:r.width, height:r.height }; };
      return { viewport:{width:innerWidth,height:innerHeight}, camera:rect('opponentFeed'), result:rect('identEmpty'), action:rect('labStart'), bar:rect('labNormalBar'), scrollY, horizontal:document.documentElement.scrollWidth > innerWidth };
    });
    for (const key of ['camera','result','action','bar']) check(inside(normal[key],normal.viewport), width + ': normal Lab ' + key + ' is visible without page scroll');
    check(!normal.horizontal, width + ': normal Lab has no horizontal overflow');
    check(!(await helper.state(page)).prepared, width + ': normal Lab does not prepare qualification');
    check(await videoHandle.evaluate(video => video === document.querySelector('#labCameraMount #remoteVideo')), width + ': normal Lab uses original video in shared station');
    equal(await page.locator('#labNormalBar #labStart').count(), 1, width + ': original identification action occupies the persistent normal bar');
    check((await page.locator('#labNormalBar #labStatus').innerText()).includes('Identification'), width + ': original identification status occupies the normal bar');
    const videoGeometry = await page.evaluate(() => { const v = document.querySelector('#remoteVideo'), o = document.querySelector('#visionOverlay'), r = v.getBoundingClientRect(), c = o.getBoundingClientRect(); return { ratio: r.width/r.height, native: v.videoWidth/v.videoHeight, video:[r.x,r.y,r.width,r.height], overlay:[c.x,c.y,c.width,c.height] }; });
    check(Math.abs(videoGeometry.ratio - videoGeometry.native) < .02, width + ': normal camera preserves native video aspect ratio');
    check(videoGeometry.video.every((value,index) => Math.abs(value-videoGeometry.overlay[index]) < 2), width + ': normal detection canvas shares video geometry');
    if (width === 1366) await screenshot(page, 'normal-lab-1366x768');
    await helper.installIdentityFixture(page, actualContext);
    await page.evaluate(() => { window.__stationEngine = window.TCGVisionEngine; });
    await page.check('#vqPhysicalConfirm'); await page.click('#vqPrepare');
    await page.waitForFunction(() => window.TCGWorkspaceVisionQualification.getState().prepared);
    await helper.advance(page, 1250);
    let layout = await geometry(page), initial = await helper.state(page);
    if (width === 1366) await screenshot(page, 'qualification-ready-1366x768');
    if (width === 390) await screenshot(page, 'mobile-qualification-390x844');
    if (process.env.WORKSPACE_SCREENSHOT_DIR) {
      fs.mkdirSync(process.env.WORKSPACE_SCREENSHOT_DIR, { recursive: true });
      await page.screenshot({ path: path.join(process.env.WORKSPACE_SCREENSHOT_DIR, 'vision-6c-console-' + width + '.png') });
    }
    equal(layout.count, 1, width + ': exactly one existing camera element');
    check(await videoHandle.evaluate(video => video === document.querySelector('#vqCameraMount #remoteVideo')), width + ': original live video node is reused');
    for (const key of ['console', 'camera', 'card', 'action', 'bar']) check(inside(layout[key], layout.viewport), width + ': ' + key + ' is visible within viewport');
    check(!layout.horizontal, width + ': no page horizontal overflow');
    equal(await page.locator('#vqActions button.primary:not([hidden])').count(), 1, width + ': exactly one visible primary action');
    check(layout.details.bottom <= layout.bar.y, width + ': the action palette reserves its own space');
    if (width > 680) check(layout.camera.right <= layout.card.x, width + ': desktop card is beside the camera');
    else check(layout.camera.bottom <= layout.details.y + 1, width + ': small-screen camera stays above details');
    const bodyY = layout.scrollY;
    await page.evaluate(() => { document.querySelector('#vqDetailsScroll').scrollTop = 1e7; });
    layout = await geometry(page);
    check(inside(layout.camera, layout.viewport), width + ': camera stays visible while details scroll');
    check(inside(layout.action, layout.viewport), width + ': primary action stays visible while details scroll');
    const tail = await page.evaluate(() => {
      const area = document.querySelector('#vqDetailsScroll'), last = area.lastElementChild;
      return { bottom: last.getBoundingClientRect().bottom, limit: area.getBoundingClientRect().bottom, padding: parseFloat(getComputedStyle(area).paddingBottom), scrollAtEnd: area.scrollHeight - area.scrollTop <= area.clientHeight + 1 };
    });
    check(tail.scrollAtEnd && tail.bottom <= tail.limit && tail.padding > 0, width + ': final detail remains reachable above the palette');
    await page.evaluate(() => { document.querySelector('#vqDetailsScroll').scrollTop = 0; });
    const firstCard = initial.currentJob.card.cardId;
    for (let attempt = 1; attempt <= 3; attempt++) {
      await page.focus('#vqWorkflow'); await page.keyboard.press('Space');
      let state = await helper.state(page);
      check(Boolean(state.session.active), width + ': Space starts nominal ' + attempt);
      check(await page.locator('#vqReturnLab').isDisabled(), width + ': active trial disables return to normal Lab');
      equal(state.session.active.identityMeasurement, 'PINNED_CANONICAL_TRACK', width + ': UI observation explicitly measures the selected canonical track');
      equal(state.session.active.observations[0].identifiedCardId, null, width + ': T0 is neutral');
      if (width === 1366 && attempt === 1) { await helper.setIdentity(page, firstCard); await helper.advance(page, 1250); await screenshot(page, 'qualification-active-1366x768'); }
      await helper.setIdentity(page, firstCard); await helper.advance(page, 10250);
      await page.focus('#vqWorkflow'); await page.keyboard.press('Space');
      state = await helper.state(page);
      equal(state.session.active, null, width + ': Space ends nominal ' + attempt);
      check(/Correct/.test(await page.locator('#vqCompactResult').textContent()), width + ': immediate result is beside action');
      check(await page.locator('#vqNext').isDisabled(), width + ': retained previous identity blocks next');
      if (width === 1366 && attempt === 1) await screenshot(page, 'qualification-result-neutral-guard-1366x768');
      const before = JSON.stringify({ count: state.session.trials.length, job: state.currentJob.key });
      await page.keyboard.press('Space');
      state = await helper.state(page);
      equal(JSON.stringify({ count: state.session.trials.length, job: state.currentJob.key }), before, width + ': blocked Space never arms B');
      await helper.setIdentity(page, null); await helper.advance(page, 500);
      check(await page.locator('#vqNext').isDisabled(), width + ': short empty window is insufficient');
      await helper.advance(page, 750);
      check(await page.locator('#vqNext').isEnabled(), width + ': confirmed empty state unlocks next');
      await page.focus('#vqWorkflow'); await page.keyboard.press('Space');
      const after = await geometry(page);
      equal(after.scrollY, bodyY, width + ': sequential actions preserve page scroll');
      check(inside(after.camera, after.viewport) && inside(after.action, after.viewport), width + ': camera and action remain visible after next');
    }
    let state = await helper.state(page);
    check(state.currentJob.card.cardId !== firstCard, width + ': third trial advances to the next card');
    equal(state.session.trials.length, 3, width + ': exactly three append-only observations');
    check(!state.nominalGate.ready, width + ': synthetic nominal trials never pass physical gate');
    check(await page.locator('#vqCondition option[value="ANGLE"]').evaluate(option => option.disabled), width + ': degraded campaign stays blocked');
    // The new card B cannot inherit A, even through a direct synthetic click.
    await helper.setIdentity(page, firstCard); await helper.advance(page, 250);
    check(await page.locator('#vqStart').isDisabled(), width + ': residual A blocks B start');
    await page.locator('#vqStart').dispatchEvent('click');
    equal((await helper.state(page)).session.active, null, width + ': runtime also rejects a bypassed disabled button');
    await helper.setIdentity(page, null); await helper.advance(page, 1250);
    await page.focus('#vqWorkflow'); await page.keyboard.press('Space');
    const cardB = (await helper.state(page)).currentJob.card.cardId;
    await helper.setIdentity(page, cardB); await helper.advance(page, 10250);
    await page.focus('#vqWorkflow'); await page.keyboard.press('Space');
    state = await helper.state(page);
    const trialB = state.session.trials.at(-1);
    check(!trialB.observations.some(observation => observation.identifiedCardId === firstCard), width + ': no A event is attributed to B');
    check(trialB.observations.some(observation => observation.identifiedCardId === cardB), width + ': B uses its own measured identity');
    await helper.setIdentity(page, null); await helper.advance(page, 1250);
    await page.focus('#vqWorkflow');
    const nextVisible = await page.locator('#vqNext').isVisible();
    await page.evaluate(() => document.querySelector('#vqWorkflow').dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', repeat: true, bubbles: true })));
    equal((await helper.state(page)).session.trials.length, 4, width + ': repeated keydown cannot trigger another action');
    equal(await page.locator('#vqNext').isVisible(), nextVisible, width + ': repeated Space cannot advance the workflow');
    await page.evaluate(() => document.querySelector('#vqWorkflow').dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', ctrlKey: true, bubbles: true })));
    equal(await page.locator('#vqNext').isVisible(), nextVisible, width + ': modified Space cannot advance the workflow');
    const summary = page.locator('details:has(> #vqSampleList) > summary'); await summary.click();
    await page.focus('#vqSetupCard'); await page.keyboard.press('Space');
    equal((await helper.state(page)).session.active, null, width + ': Space in select never starts or advances a trial');
    equal(await page.locator('#vqNext').isVisible(), nextVisible, width + ': Space in select preserves the visible next action');
    const preserved = JSON.stringify((await helper.state(page)).session.trials);
    await page.click('#vqReturnLab');
    check(await videoHandle.evaluate(video => !video.closest('#vqCameraMount')), width + ': return restores the original feed to Lab');
    check(await page.locator('#labNormalBar').isVisible(), width + ': normal actions return in the same station');
    await page.click('#vqResume');
    equal(JSON.stringify((await helper.state(page)).session.trials), preserved, width + ': return/resume preserve session evidence');
    equal(await page.locator('#remoteVideo').count(), 1, width + ': resume still has one camera');
    check(await page.evaluate(() => window.__stationCameraCalls === 1 && document.querySelector('#remoteVideo').srcObject === window.__stationStream), width + ': prepare/return/resume never request another stream');
    check(await page.evaluate(() => window.TCGVisionEngine === window.__stationEngine), width + ': prepare/return/resume keep the same engine');
    await page.click('#vqReturnLab'); await page.click('#labWorkspaceReturn');
    check(await page.locator('#panel-reprise').isVisible(), width + ': shared normal station provides a visible exit to Workspace');
    check(await page.evaluate(() => !document.body.classList.contains('lab-station-open')), width + ': leaving Lab restores normal Workspace scrolling');
    equal(errors, [], width + ': no browser exception');
    console.log('WORKSPACE_VISION_LAB_6C_VIEWPORT_OK ' + width + 'x' + height + ' SHARED_STATION_NO_REPEATED_SCROLL_REQUIRED');
  } finally { await context.close(); }
}
async function screenshot(page, name) {
  if (!process.env.WORKSPACE_SCREENSHOT_DIR) return;
  fs.mkdirSync(process.env.WORKSPACE_SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({ path:path.join(process.env.WORKSPACE_SCREENSHOT_DIR, 'vision-6c-' + name + '.png') });
}
async function main() {
  const old = process.env.RAILWAY_GIT_COMMIT_SHA; process.env.RAILWAY_GIT_COMMIT_SHA = helper.sha;
  const fixture = await startBridgeFixture({ root: helper.root });
  if (old === undefined) delete process.env.RAILWAY_GIT_COMMIT_SHA; else process.env.RAILWAY_GIT_COMMIT_SHA = old;
  let browser;
  try {
    const pinned = await helper.pinnedDocuments();
    browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
    const context = await helper.realWorkspaceSmoke(browser, fixture, pinned);
    for (const [width, height] of [[1920, 1080], [1366, 768], [900, 768], [560, 844], [390, 844]]) await viewportCase(browser, fixture, pinned, context, width, height);
    console.log('WORKSPACE_VISION_LAB_6C_BROWSER_OK ' + assertions + ' assertions; UI fixtures AUTOMATED; physical NOT TESTED');
  } finally { await browser?.close(); await fixture.close(); }
}
main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
