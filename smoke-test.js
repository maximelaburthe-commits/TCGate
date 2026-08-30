'use strict';
const fs=require('fs');
const crypto=require('crypto');
const childProcess=require('child_process');

const required=[
  'public/index.html','public/styles.css','public/tcgate-alpha.css','public/app.js',
  'public/assets/tcgate-logo-final.png','public/assets/tcgate-mark.svg',
  'public/vision-core.js','public/vision-calibration.js','public/detection-worker.js',
  'public/table-state-bridge.js','public/table-state-engine.js','public/identification.js',
  'public/identification-worker.js','public/cards-fallback.json','models/card_detector_v53_512.onnx',
  'server.js','railway.json','PLAN_TEST_ALPHA_0.1_CANDIDATE_12_SWU.md',
  'CHANGELOG_TCGATE_ALPHA_0.1_CANDIDATE_12.md','SECURITY_REVIEW_ALPHA_C9.md',
  'SECURITY_REVIEW_ALPHA_C10_DELTA.md'
];
for(const f of required) if(!fs.existsSync(f)) throw new Error(`Missing ${f}`);

const app=fs.readFileSync('public/app.js','utf8');
for(const token of [
  "TCGate Alpha 0.1 Candidate 12",'authToken','SESSION_STORAGE_KEY','MEDIA_PREFS_KEY',
  'tryResumeSavedSession','checkPersistentRecovery','recoverPersistentSession',
  '/api/recovery-state','/api/recover','room-recovery-in-place','waitForEventStreamOpen',
  'replaceMediaKind','handleLocalTrackEnded','handleMediaDeviceChange',"addEventListener('devicechange'",
  'gameCameraSelect','gameMicroSelect','openGameDeviceMenu','scheduleEventStreamReconnect',
  'rtc-recovery-scheduled','restart-request','visionEnabledForCurrentGame','loadRtcConfig',
  'resetReportSession','bitrateKbps'
]) if(!app.includes(token)) throw new Error(`Missing current app token ${token}`);

if (/localStorage\.setItem\([^\n]*authToken/i.test(app)) throw new Error('Bearer must not be stored in localStorage');
if (app.includes("localStorage.setItem(SESSION_STORAGE_KEY")) throw new Error('Room session must stay in sessionStorage');

const server=fs.readFileSync('server.js','utf8');
for(const token of [
  "const VERSION = 'tcgate-alpha-0.1-candidate-12'",'crypto.randomInt','sessionToken','timingSafeEqual',
  'RECOVERY_COOKIE_NAME','recoveryIndex','HttpOnly','SameSite=Strict','setRecoveryCookie','clearRecoveryCookie',
  '/api/recovery-state','/api/recover','persistent-recovery','room.phase','phase: room.phase',
  '/api/events-ticket','EVENT_TICKET_TTL_MS','DISCONNECTED_PEER_GRACE_MS','/api/resume',
  'Authorization','ALLOWED_SIGNAL_TYPES','rateLimit','sessionRateLimit','BODY_LIMIT_BYTES',
  'Content-Security-Policy','Permissions-Policy','Strict-Transport-Security','sameOriginRequest',
  "restart-request",'path.relative','cloudflare-realtime-turn'
]) if(!server.includes(token)) throw new Error(`Missing current server token ${token}`);

const html=fs.readFileSync('public/index.html','utf8');
for(const token of ['resumeSessionCard','resumeSessionButton','deviceMenuToggle','gameDeviceMenu','gameCameraSelect','gameMicroSelect']) {
  if(!html.includes(token)) throw new Error(`Missing current HTML token ${token}`);
}
if(!html.includes('autocomplete="off"')) throw new Error('Autocomplete protection missing');
for(const src of ['/vision-core.js','/vision-calibration.js','/table-state-bridge.js','/identification.js','/table-state-engine.js']){
  if(html.includes(`<script src="${src}"></script>`)) throw new Error(`Vision must stay dynamic: ${src}`);
}

const css=fs.readFileSync('public/tcgate-alpha.css','utf8');
for(const token of ['resume-session-card','game-device-menu','max-height: 820px']) {
  if(!css.includes(token)) throw new Error(`Missing current CSS token ${token}`);
}

const hash=(f,want=null)=>{const digest=value=>crypto.createHash('sha256').update(value).digest('hex'),raw=digest(fs.readFileSync(f));return !want||raw===want?raw:digest(childProcess.execFileSync('git',['show',`HEAD:${f}`],{maxBuffer:64*1024*1024}));};
const expected={
  'models/card_detector_v53_512.onnx':'2db35aef3aceff955d7055180b3f21b33255920ab0a9a1fdcbb0e320a8276319',
  'public/detection-worker.js':'e749551f11065a03bd2cfc75577f23c4ece893a2c7d08bc82a341b2a35619b7a',
  'public/table-state-engine.js':'7ad3e427e2ba2181d5ab74e4ad8d68b855144e5d6901c6fdf58cdc36263cdd04',
  'public/vision-core.js':'520981919521befdf9b80e7432ca3ac885c846768a274d4a5456f771e63f68e6',
  'public/identification.js':'d5ec154d9f79aa346a036210b096b0b10b461aa5cfaf9410ddb27df7e8eb6ec4'
};
for(const [file,want] of Object.entries(expected)) if(hash(file,want)!==want) throw new Error(`Vision baseline changed: ${file}`);

console.log('SMOKE_OK_TCGATE_ALPHA_0.1_CANDIDATE_12');
for(const file of Object.keys(expected)) console.log(`${file}=${hash(file)}`);
