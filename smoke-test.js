
'use strict';
const fs = require('fs');

for (const f of ['public/index.html','public/styles.css','public/app.js','server.js']) {
  if (!fs.existsSync(f)) throw new Error(`Missing ${f}`);
}
const html = fs.readFileSync('public/index.html','utf8');
for (const id of [
  'screenHome','screenSetup','screenLobby','screenGame',
  'opponentFeed','remoteVideo','localVideo','cardPreview',
  'fullscreenOpponent','fullscreenCardPreview','fullscreenExpandCard',
  'enableMedia','cameraSelect','microSelect',
  'generateReportLobby','generateReportGame','rtcStatus','networkStatus'
]) {
  if (!html.includes(`id="${id}"`)) throw new Error(`Missing ${id}`);
}

const app = fs.readFileSync('public/app.js','utf8');
for (const token of ['RTCPeerConnection','EventSource','generateCompleteReport','makeStoredZip','addTransceiver','snapshotRtcMetrics','gameEntering','bindAnswererTracks','offerInFlight','localCandidateType','verticalOverflowPx']) {
  if (!app.includes(token)) throw new Error(`Missing app token ${token}`);
}
console.log('SMOKE_OK');
