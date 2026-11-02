'use strict';
const fs=require('fs');
const crypto=require('crypto');
const {assertCandidateMetadata}=require('./candidate-metadata-test-utils.js');
const metadata=assertCandidateMetadata();

const required=[
  'public/index.html','public/styles.css','public/tcgate-alpha.css','public/app.js',
  'public/assets/tcgate-logo-final.png','public/assets/tcgate-mark.svg',
  'public/vision-core.js','public/vision-calibration.js','public/detection-worker.js',
  'public/table-state-bridge.js','public/table-state-engine.js','public/identification.js',
  'public/identification-worker.js','public/cards-fallback.json','models/card_detector_v53_512.onnx',
  'server.js','railway.json','PLAN_TEST_ALPHA_0.1_CANDIDATE_11.md',
  'CHANGELOG_TCGATE_ALPHA_0.1_CANDIDATE_11.md','SECURITY_REVIEW_ALPHA_C9.md',
  'SECURITY_REVIEW_ALPHA_C10_DELTA.md'
];
for(const f of required) if(!fs.existsSync(f)) throw new Error(`Missing ${f}`);

const app=fs.readFileSync('public/app.js','utf8');
for(const token of [
  'authToken','SESSION_STORAGE_KEY','MEDIA_PREFS_KEY',
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
  'crypto.randomInt','sessionToken','timingSafeEqual',
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

// Freeze detector/model bytes and all pre-Jalon-4 recognition functions/constants.
// Only corpus adapters and worker lifecycle are covered by the locale-specific tests.
const hash=f=>{const bytes=fs.readFileSync(f);return crypto.createHash('sha256').update(f==='public/identification.js'?require('./workspace-production-contract.js').productionIdentification(bytes):f==='public/table-state-engine.js'?require('./workspace-production-contract.js').productionTableState(bytes):bytes).digest('hex');};
const expected={
  'models/card_detector_v53_512.onnx':'2db35aef3aceff955d7055180b3f21b33255920ab0a9a1fdcbb0e320a8276319',
  'public/detection-worker.js':'19d0e72eeb620f23742a9b8fe321f700c45cbd29ad41b952d115bca5fd983227',
  'public/table-state-engine.js':'0b7c8c813bac73f528b9938a9cc2aae9c1bd2fcdc81dfc4748d940f2e795fcb3',
  'public/vision-core.js':'f3cbd789476c92f86dd25292a67a0d0e96eee9888584a867c841b3b61e8650d1',
  'public/identification.js':'e5593e42a8dfd60a4d81850fb76c518c4212302906a1cd655fb3901cf9e18071'
};
for(const [file,want] of Object.entries(expected)) if(hash(file)!==want) throw new Error(`Vision baseline changed: ${file}`);

console.log(`SMOKE_OK_TCGATE_ALPHA_0.1_CANDIDATE_${metadata.candidate}_UI_${metadata.ui}`);
for(const file of Object.keys(expected)) console.log(`${file}=${hash(file)}`);
