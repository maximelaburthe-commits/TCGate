'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),{execFileSync}=require('node:child_process'),contract=require('./tcgate-ui-1.2-contract.js');
const html=fs.readFileSync('public/index.html','utf8'),app=fs.readFileSync('public/app.js','utf8'),ux=fs.readFileSync('public/future-ux-v3.7.js','utf8'),css=fs.readFileSync('public/tcgate-ui-1.2.css','utf8'),ui=fs.readFileSync('public/tcgate-ui-1.2.js','utf8');
contract.assertHome(html);contract.assertGame(html,ux);
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size,'Controls must not be duplicated');
for(const id of ['enableMedia','mediaStatus','cameraSelect','microSelect','lobbyPreview','lobbyPreviewPlaceholder','lobbyToggleCam','lobbyToggleMic','usePhoneCamera','phoneCameraPanel','timerToggle','timerMinutes','timerCfg','gigDiceToggle','startGame'])assert.equal(ids.filter(i=>i===id).length,1,'Existing single control '+id);
const lobby=contract.section(html,'screenLobby');for(const page of ['session','installation','players']){assert(lobby.includes('data-lobby-page="'+page+'"'));assert(!contract.section(html,'ui12-lobby-'+page).includes('id="startGame"'),'Ready must stay outside hidden panels');}
assert(lobby.includes('id="ui12LobbyReady"'));assert(lobby.includes('id="timerHubConfig"'));assert(lobby.includes('id="gigDiceHubConfig"'));assert(html.indexOf('href="/tcgate-ui-1.2.css"')>html.indexOf('href="/future-ux-v3.7.css"'));
assert(!/cloneNode|\.innerHTML\s*=/.test(ui+ux));assert(!/fetch\(|RTCPeerConnection|state\.\w+\s*=(?!=)/.test(ui),'Presentation script must not own network or state mutations');assert(!css.includes('#screenGame'));
for(const color of ['#070b13','#0d1420','#111a29','#27324a','#1b2436','#f4f6fb','#8f9bb0','#7c5cff','#9b86ff','#67d9a2','#f06a75'])assert(css.includes(color));
const baseline=execFileSync('git',['show','25cd174c2bd4952fd8d0d317ad543d7b720cf3a0:public/app.js'],{encoding:'utf8'});
function part(s,start,end){const a=s.indexOf(start),b=s.indexOf(end,a+start.length);assert(a>=0&&b>a);return contract.lf(s.slice(a,b));}
assert.equal(part(app,'async function setReady(','async function enterNetworkGame('),part(baseline,'async function setReady(','async function enterNetworkGame('),'Ready mechanism unchanged');assert.equal(part(app,"$('startGame').addEventListener","$('leaveLobby').addEventListener"),part(baseline,"$('startGame').addEventListener","$('leaveLobby').addEventListener"),'Ready handler unchanged');
const logo=fs.readFileSync('public/assets/tcgate-logo-final.png');assert.equal(contract.hash(logo),'56660fac88d53f7fc9e6056725a4067f89f5cc0079f70407cb79180bb7d92515');assert.equal(logo.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(logo.readUInt32BE(16),2048);assert.equal(logo.readUInt32BE(20),682);assert.equal(logo[25],6,'PNG RGBA');
assert(app.includes("state.game === 'cyberpunk' && state.gigDiceEnabled === true"));assert(app.includes("$('gigDiceToggle')?.addEventListener"));
console.log('TCGATE_UI_1_2_CONTRACT_OK · five Home pages, static single-control Lobby, exact logo, original Ready and full Table HTML/presentation');

assert.match(html, /id="timerToggle"[^>]*aria-label="Minuteur partagé"/, "Timer switch has an accessible name");
assert.match(html, /<label for="timerMinutes">Durée initiale \(minutes\)<\/label>/, "Timer duration has an associated label");
