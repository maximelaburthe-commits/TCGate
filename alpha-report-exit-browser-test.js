'use strict';
// Real Host/Guest UI and report ZIP. All outbound Resend calls are intercepted by the existing local fixture.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require(process.env.WORKSPACE_PLAYWRIGHT_PATH || 'playwright');
const { startBridgeFixture } = require('./report-email-bridge-fixture.js');
let assertions = 0;
const check = (value, label) => { assert(value, label); assertions++; };
const artifacts = process.env.UI21_EXIT_ARTIFACT_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'tcgate-alpha-exit-'));
fs.mkdirSync(artifacts, { recursive: true });
function zipEntries(zip) {
  const entries = new Map(); let offset = 0;
  while (offset + 30 <= zip.length && zip.readUInt32LE(offset) === 0x04034b50) {
    assert.equal(zip.readUInt16LE(offset + 8), 0, 'Real stored report ZIP');
    const size = zip.readUInt32LE(offset + 18), nameLength = zip.readUInt16LE(offset + 26), extraLength = zip.readUInt16LE(offset + 28);
    const name = zip.subarray(offset + 30, offset + 30 + nameLength).toString('utf8');
    const start = offset + 30 + nameLength + extraLength;
    entries.set(name, zip.subarray(start, start + size)); offset = start + size;
  }
  return entries;
}
async function room(page) {
  await page.waitForFunction(() => document.querySelector('#screenLobby').classList.contains('active') && /^[A-Z0-9]{6}$/.test(document.querySelector('#lobbyCode').textContent.trim()));
  return (await page.locator('#lobbyCode').innerText()).trim();
}
async function create(page, origin) {
  await page.goto(origin + '/'); await page.locator('#goCreate').click(); await page.locator('#setupContinue').click();
  const code = await room(page); await page.locator('#gameSelect').selectOption('no-game'); return code;
}
async function clickGameExit(page) {
  const box = await page.locator('#opponentFeed').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForFunction(() => !document.querySelector('#controls').classList.contains('hidden-ui'));
  await page.locator('#leaveGame').click();
}
async function reminder(page) { await page.locator('#alphaReportExitOverlay.show').waitFor(); }
async function cancel(page) { await page.locator('#alphaExitCancel').click(); await page.locator('#alphaReportExitOverlay.show').waitFor({ state: 'hidden' }); }
async function send(page, fixture, { fail = false, note = '' } = {}) {
  await page.locator('#reportOverlay.show').waitFor(); await page.locator('#reportText').fill(note);
  const before = fixture.requests.length;
  const response = page.waitForResponse(response => new URL(response.url()).pathname === '/api/report-email' && response.request().method() === 'POST');
  await page.locator('#sendReport').click(); const received = await response;
  check(received.status() === (fail ? 502 : 200), 'Existing report bridge handles ' + (fail ? 'provider failure' : 'success'));
  const body = received.request().postDataJSON();
  await page.waitForFunction(expected => document.querySelector('#sendReport').dataset.status === expected, fail ? 'error' : 'success');
  check(fixture.requests.length === before + 1, 'One report attempt uses the existing provider bridge');
  return body;
}
async function run() {
  const fixture = await startBridgeFixture({ root: __dirname }); let browser;
  const errors = [], leaveRequests = [];
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
    const contexts = await Promise.all([1, 2].map(() => browser.newContext({ viewport: { width: 1366, height: 768 }, permissions: ['camera', 'microphone'] })));
    const [host, guest] = await Promise.all(contexts.map(context => context.newPage()));
    for (const page of [host, guest]) {
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => { if (new URL(request.url()).pathname === '/api/leave') leaveRequests.push(request.url()); });
    }
    const firstCode = await create(host, fixture.origin);
    await host.locator('#leaveLobby').click(); await reminder(host);
    check(await host.locator('#quitOverlay').evaluate(element => !element.classList.contains('show')), 'Lobby offers one reminder dialog');
    check(leaveRequests.length === 0, 'Opening reminder preserves joined session');
    await host.setViewportSize({ width: 390, height: 844 });
    check(await host.locator('#alphaReportExitOverlay').evaluate(element => element.scrollWidth <= innerWidth), 'Mobile reminder fits viewport');
    await host.screenshot({ path: path.join(artifacts, 'exit-reminder-mobile.png') });
    await cancel(host);
    check(await room(host) === firstCode, 'Cancel returns to unchanged Lobby');
    await host.setViewportSize({ width: 1366, height: 768 });
    await host.locator('#leaveLobby').click(); await reminder(host); await host.locator('#alphaExitReport').click();
    await host.locator('#reportOverlay.show').waitFor(); await host.locator('#closeReport').click(); await reminder(host);
    check(leaveRequests.length === 0, 'Closing report returns to exit choice without leaving');
    await host.locator('#alphaExitReport').click(); await fixture.setMode('server-error');
    await send(host, fixture, { fail: true, note: 'Fixture failure note' });
    check(await host.locator('#reportOverlay').evaluate(element => element.classList.contains('show')), 'Send failure never closes form');
    check(await host.locator('#reportText').inputValue() === 'Fixture failure note', 'Failure preserves note');
    check(leaveRequests.length === 0 && await room(host) === firstCode, 'Send failure never leaves session');
    check(await host.locator('#reportMailStatus').isVisible(), 'Provider failure is visible without hover or developer tools');
    await host.locator('#closeReport').click(); await reminder(host); await cancel(host); await fixture.setMode('success');
    await host.locator('#generateReportLobby').click();
    const body = await send(host, fixture, { note: 'Fixture voluntary note' });
    const entries = zipEntries(Buffer.from(body.zipBase64, 'base64'));
    check([...entries.keys()].sort().join(',') === 'README.txt,rapport.txt,report.json', 'Actual uploaded ZIP contains only diagnostic text files');
    const actual = JSON.parse(entries.get('report.json').toString('utf8'));
    check(actual.reportSchemaVersion === 2 && actual.session.roomCode === firstCode, 'Real report keeps historical schema and room context');
    check(Boolean(actual.envelope.sessionId) && !Object.hasOwn(actual.session, 'playerName'), 'Report carries pseudonymous session ID, no dedicated player-name field');
    check(!/(data:image|data:audio|data:video|cropDataUrl|lastAnalyzedCropDataUrl)/i.test(entries.get('report.json').toString('utf8')), 'Uploaded fixture report contains no captured media payload');
    fs.writeFileSync(path.join(artifacts, 'report-data-audit.json'), JSON.stringify({ fixtureOnly: true, actualZipFiles: [...entries.keys()], postedFields: Object.keys(body), reportFields: Object.keys(actual), sessionFields: Object.keys(actual.session), envelopeFields: Object.keys(actual.envelope), explicitPlayerNameField: false, capturedMediaPayload: false, provider: 'Resend intercepted locally', externalEmailsSent: 0 }, null, 2));
    await host.locator('#reportOverlay.show').waitFor({ state: 'hidden' });
    await host.reload();
    check(await room(host) === firstCode, 'A successful report remains associated with the resumed session after F5');
    check(!(await host.locator('#alphaReportExitOverlay').evaluate(element => element.classList.contains('show'))), 'Reload itself never opens reminder');
    await host.locator('#leaveLobby').click(); await host.locator('#screenHome.active').waitFor();
    check(!(await host.locator('#alphaReportExitOverlay').evaluate(element => element.classList.contains('show'))), 'A successful manual report suppresses reminder for session');
    check(leaveRequests.length === 1, 'Native Lobby exit executes exactly once');
    const code = await create(host, fixture.origin);
    await host.locator('#leaveLobby').click(); await reminder(host); await cancel(host);
    check(code !== firstCode, 'A new session again offers the report reminder');
    await guest.goto(fixture.origin + '/'); await guest.locator('#goJoin').click(); await guest.locator('#roomCodeInput').fill(code); await guest.locator('#setupContinue').click();
    check(await room(guest) === code, 'Independent Guest joins real room');
    for (const page of [host, guest]) {
      await page.locator('[data-lobby-page="installation"]').click(); await page.locator('#enableMedia').click();
      await page.waitForFunction(() => document.querySelector('#lobbyPreview').videoWidth > 0 && document.querySelector('#lobbyPreview').srcObject?.getVideoTracks().some(track => track.readyState === 'live'));
      await page.waitForFunction(() => !document.querySelector('#startGame').disabled);
    }
    await host.locator('#startGame').click(); await guest.locator('#startGame').click();
    for (const page of [host, guest]) await page.locator('#screenGame.active').waitFor({ timeout: 60000 });
    await host.evaluate(() => document.querySelector('#quitOverlay').classList.add('show'));
    await host.locator('#confirmQuit').click(); await reminder(host); await cancel(host);
    await host.locator('#quitOverlay.show').waitFor(); await host.locator('#cancelQuit').click();
    check(true, 'Direct historical confirmQuit also gets the optional report and restores its confirmation on cancel');
    // The historical endOverlay currently has no automatic opening trigger. Exercise its existing actions with that presentation explicitly opened.
    await guest.evaluate(() => document.querySelector('#endOverlay').classList.add('show'));
    await guest.locator('#endReport').click(); await guest.locator('#reportOverlay.show').waitFor(); await guest.locator('#closeReport').click();
    await guest.locator('#endOverlay.show').waitFor();
    check(true, 'Closing finished-session report restores the existing end dialog');
    await guest.locator('#endQuit').click(); await reminder(guest);
    check(await guest.locator('#endOverlay').evaluate(element => !element.classList.contains('show')), 'Finished-session exit shows only one active dialog');
    await cancel(guest); await guest.locator('#endOverlay.show').waitFor();
    await guest.locator('#endHub').click(); await reminder(guest); await guest.locator('#alphaExitWithoutReport').click();
    const nextCode = await room(guest); check(nextCode !== code, 'Skip report preserves native return-to-Hub creation');
    check(!(await host.locator('#alphaReportExitOverlay').evaluate(element => element.classList.contains('show'))), 'Remote peer leaving never prompts remaining player');
    await clickGameExit(host); await reminder(host);
    check(await host.locator('#quitOverlay').evaluate(element => !element.classList.contains('show')), 'Game reminder replaces duplicate quit confirmation');
    await host.screenshot({ path: path.join(artifacts, 'exit-reminder-desktop-game.png') });
    await cancel(host); await host.locator('#screenGame.active').waitFor();
    await clickGameExit(host); await reminder(host); await host.locator('#alphaExitWithoutReport').click();
    await host.locator('#screenHome.active').waitFor();
    check(leaveRequests.length === 3, 'Game skip-report reaches native leave without a second confirmation');
    await guest.locator('#gameSelect').selectOption('no-game');
    await host.locator('#goJoin').click(); await host.locator('#roomCodeInput').fill(nextCode); await host.locator('#setupContinue').click();
    check(await room(host) === nextCode, 'Fresh reporting session after native Game exit');
    for (const page of [guest, host]) {
      await page.locator('[data-lobby-page="installation"]').click(); await page.locator('#enableMedia').click();
      await page.waitForFunction(() => document.querySelector('#lobbyPreview').videoWidth > 0 && !document.querySelector('#startGame').disabled);
    }
    await guest.locator('#startGame').click(); await host.locator('#startGame').click();
    for (const page of [host, guest]) await page.locator('#screenGame.active').waitFor({ timeout: 60000 });
    await clickGameExit(host); await reminder(host); await host.locator('#alphaExitReport').click();
    await send(host, fixture, { note: 'Fixture game report' });
    await host.locator('#reportOverlay.show').waitFor({ state: 'hidden' }); await reminder(host);
    check(await host.locator('#alphaReportExitTitle').innerText() === 'Rapport envoy\u00e9', 'Success returns to exit choice without repeating Alpha reminder');
    check(!(await host.locator('#alphaExitReport').isVisible()), 'Success does not ask for another report');
    await cancel(host); await clickGameExit(host); await host.locator('#quitOverlay.show').waitFor();
    check(!(await host.locator('#alphaReportExitOverlay').evaluate(element => element.classList.contains('show'))), 'Already-reported Game retains its original confirmation');
    await host.locator('#cancelQuit').click(); await clickGameExit(host); await host.locator('#confirmQuit').click(); await host.locator('#screenHome.active').waitFor();
    check(leaveRequests.length === 4, 'Each voluntary exit executes native leave exactly once');
    const attempts = fixture.requests.length, leaves = leaveRequests.length;
    await guest.reload(); await guest.waitForLoadState('networkidle');
    check(!(await guest.locator('#alphaReportExitOverlay').evaluate(element => element.classList.contains('show'))), 'F5 never prompts for report');
    await guest.close();
    check(fixture.requests.length === attempts && leaveRequests.length === leaves, 'Reload and abrupt page closure neither send reports nor invoke voluntary leave');
    check(errors.length === 0, 'No uncaught errors: ' + errors.join('; '));
    const result = { assertions, fakeCamera: true, realRooms: true, realReportZip: true, outboundEmailProviderMocked: true, externalEmailsSent: 0, endedSessionPresentationExplicitlyOpened: true, artifacts };
    fs.writeFileSync(path.join(artifacts, 'browser-results.json'), JSON.stringify(result, null, 2));
    console.log('ALPHA_REPORT_EXIT_BROWSER_OK ' + JSON.stringify(result));
  } catch (error) {
    const pages = browser?.contexts().flatMap(context => context.pages()) || [];
    for (let index = 0; index < pages.length; index++) {
      const page = pages[index];
      await page.screenshot({ path: path.join(artifacts, 'failure-page-' + index + '.png') }).catch(() => {});
      const geometry = await page.evaluate(() => Object.fromEntries(['leaveGame', 'controls', 'remoteVideoPlaceholder', 'alphaReportExitOverlay', 'reportOverlay'].map(id => {
        const element = document.getElementById(id); const rect = element?.getBoundingClientRect();
        return [id, element ? { className: element.className, rect: rect?.toJSON(), pointerEvents: getComputedStyle(element).pointerEvents, opacity: getComputedStyle(element).opacity } : null];
      }))).catch(() => null);
      fs.writeFileSync(path.join(artifacts, 'failure-geometry-' + index + '.json'), JSON.stringify(geometry, null, 2));
    }
    fs.writeFileSync(path.join(artifacts, 'failure.json'), JSON.stringify({ message: error.message, stack: error.stack, assertions }, null, 2));
    throw error;
  } finally { await browser?.close(); await fixture.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });