(function initRealGameCampaign(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TCGVisionRealGameCampaign = api;
})(typeof window !== 'undefined' ? window : globalThis, function realGameCampaign() {
  'use strict';
  // Passive scalar accounting only: this module has no detector, matcher,
  // timers, DOM, network, cache or camera dependency.
  const SOURCES = ['NEW_ANALYSIS', 'HOVER_CACHE', 'IDENTITY_MEMORY', 'TABLE_MEMORY', 'PREEXISTING', 'UNKNOWN'];
  const PHASES = ['RELIABILITY', 'STABILITY', 'TRANSITION', 'ROBUSTNESS', 'NEGATIVE', 'LATENCY', 'FREE_PLAY'];
  const INCIDENTS = ['VIDEO_FREEZE', 'VIDEO_INTERRUPTION', 'UI_STALL', 'UNEXPECTED_IDENTITY', 'IDENTITY_LOSS', 'WRONG_PRINTING', 'NO_RESPONSE', 'NOTICEABLE_DELAY', 'TURN_INTERRUPTED', 'INSTALLATION_CHANGED', 'OCCLUSION', 'PROTOCOL_ERROR', 'CONDITION_UNAVAILABLE', 'NO_DISCOMFORT'];
  const REASON_ALIASES = {POINTER_LEFT_VIDEO:'POINTER_LEFT',POINTER_TARGET_CHANGED:'TRACK_CHANGED',NO_TRACK_UNDER_POINTER:'TRACK_LOST',NO_DISPLAY_WITHIN_OBSERVATION_WINDOW:'TIMEOUT',BUILD_OR_CORPUS_OR_MODE_CHANGED:'CONTEXT_CHANGED',OPERATOR_STOPPED:'CANCELLED',uncertain:'REJECTED','glare-high':'QUALITY_REJECTED','glare-moderate':'QUALITY_REJECTED','temporal-unstable':'TEMPORAL_STABILITY',UNSPECIFIED_NATIVE_REJECTION:'REJECTED'};
  const END_REASONS = ['COMPLETED', 'OPERATOR_CANCELLED', 'INTERRUPTED', 'UNAVAILABLE', 'PROTOCOL_ERROR', 'CONTEXT_CHANGED', 'FINISHED'];
  const KIND_ALIASES = { 'consultation-request':'REQUEST', 'consultation-cancelled':'CANCEL', 'consultation-timeout':'TIMEOUT', 'identification-result':'RESULT', 'identification-displayed':'DISPLAY', 'track-state':'TRACK_STATE', 'context-invalidated':'CONTEXT_INVALIDATED', 'performance-sample':'PERFORMANCE_SAMPLE', 'video-state':'VIDEO_STATE' };
  const KINDS = ['REQUEST', 'RESULT', 'DISPLAY', 'CANCEL', 'TIMEOUT', 'TRACK_STATE', 'CONTEXT_INVALIDATED', 'CONTEXT_INVALID', 'OBSERVATION_GAP', 'PERFORMANCE_SAMPLE', 'VIDEO_STATE'];
  const copy = value => JSON.parse(JSON.stringify(value));
  const list = value => Array.isArray(value) ? value : [];
  const number = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
  const bool = value => typeof value === 'boolean' ? value : null;
  const enumValue = (value, values, fallback = null) => values.includes(value) ? value : fallback;
  const id = value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9:_.-]{0,179}$/.test(value) ? value : null;
  const hash = (value, size) => typeof value === 'string' && new RegExp('^[a-f0-9]{' + size + '}$').test(value) ? value : null;
  function context(value) { value = value || {}; return { productSha:hash(value.productSha,40), databaseSha:hash(value.databaseSha,40), gameId:id(value.gameId), locale:enumValue(value.locale,['en','fr']), referenceCount:Number.isSafeInteger(value.referenceCount) && value.referenceCount >= 0 ? value.referenceCount : null, referencesSha256:hash(value.referencesSha256,64), scope:enumValue(value.scope,['SOLO_LAB_NORMAL_HOVER','opponent-stream-only']), identificationPath:enumValue(value.identificationPath,['NORMAL_HOVER']), capabilities:{tableStateMemory:bool(value.capabilities?.tableStateMemory),identityMemory:enumValue(value.capabilities?.identityMemory,['NATIVE_TEMPORAL_HOLD_EVENTS','UNAVAILABLE']),localCamera:bool(value.capabilities?.localCamera),normalHover:bool(value.capabilities?.normalHover)} }; }
  function baseline(value) {
    if (!value || value.source !== 'QUALIFICATION_RECEIPT' || value.valid !== 45 || value.correct !== 43 || value.wrong !== 0) return null;
    return { source:'QUALIFICATION_RECEIPT', scope:'HISTORICAL_NOMINAL_ONLY', productSha:hash(value.productSha || value.physicalProductSha,40), receiptId:id(value.receiptId), valid:45, correct:43, wrong:0, correctIdentificationRate:100*43/45, includedInCurrentDenominators:false };
  }
  function selectedCards(profile, selection) {
    if (!['VISION_REAL_GAME_1_0','VISION_SOLO_LAB_1_0'].includes(profile?.id) || profile?.schemaVersion !== '1.0' || list(profile.cards).length !== 10) throw Error('Distinct real-game profile required');
    const selected = list(selection);
    if (selected.length && (selected.length !== 10 || new Set(selected.map(card => card.id)).size !== 10)) throw Error('Predeclare exactly ten distinct card slots');
    const cards = profile.cards.map((card, n) => {
      if (card.id !== 'C' + (n+1) || !id(card.cardId) || !id(card.printingId)) throw Error('Invalid profile card');
      const replacement = selected.find(value => value.id === card.id);
      if (selected.length && !replacement) throw Error('Selection slot missing');
      const value = replacement || card;
      if (!id(value.cardId) || !id(value.printingId)) throw Error('Card and printing IDs required');
      return { id:card.id, cardId:value.cardId, printingId:value.printingId, available:value.available !== false, label:typeof card.label === 'string' ? card.label.slice(0,140) : card.id };
    });
    if (new Set(cards.map(card => card.cardId)).size !== 10) throw Error('Ten distinct canonical cards required');
    return cards;
  }
  function planJobs(profile, selection) {
    const cards = selectedCards(profile,selection), jobs=[];
    const get = n => { const card = cards[n-1]; if (!card) throw Error('Unknown profile card slot'); return card; };
    function add(phase, n, extra) {
      const card = n ? get(n) : null;
      jobs.push({ id:'RG-' + String(jobs.length+1).padStart(3,'0'), phase, cardRef:card?.id || null, label:card?.label || null, expectedCardId:card?.cardId || null, expectedPrintingId:card?.printingId || null, available:card ? card.available : true, durationMs:null, sequenceId:null, stage:null, negativeScene:null, condition:null, delayBeforeHoverMs:null, consultationOrdinal:null, presentationId:null, ...extra });
    }
    const phases = profile.phases || {};
    for (const n of list(phases.reliability?.order)) add('RELIABILITY',n,{durationMs:phases.reliability.observationMs});
    for (const n of list(phases.stability?.cards)) add('STABILITY',n,{durationMs:phases.stability.observationMs});
    list(phases.transitions?.pairs).forEach((pair,i) => pair.forEach((n,j)=>add('TRANSITION',n,{durationMs:phases.transitions.observationMs,sequenceId:'TRANSITION-'+(i+1),stage:j ? 'B' : 'A'})));
    for (const n of list(phases.robustness?.cards)) for (const condition of list(phases.robustness?.conditions)) add('ROBUSTNESS',n,{durationMs:phases.robustness.observationMs,condition});
    for (const negativeScene of list(phases.negatives?.scenes)) add('NEGATIVE',null,{durationMs:phases.negatives.observationMs,negativeScene});
    list(phases.latency?.cards).forEach((n,i)=>list(phases.latency.delayOrdersMs?.[i]).forEach((delay,j)=>[1,2].forEach(ordinal=>add('LATENCY',n,{durationMs:phases.latency.observationMs,delayBeforeHoverMs:delay,consultationOrdinal:ordinal,presentationId:'LATENCY-'+(i+1)+'-'+(j+1)}))));
    add('FREE_PLAY',null,{durationMs:phases.freePlay?.minimumMs});
    if (jobs.length !== 98 || jobs.some(job => !PHASES.includes(job.phase) || number(job.durationMs) === null)) throw Error('Invalid real-game profile plan');
    return jobs;
  }
  function stats(values) {
    const sorted = values.filter(value=>number(value)!==null).sort((a,b)=>a-b), n=sorted.length;
    return { n, minMs:n ? sorted[0] : null, medianMs:n ? (sorted[Math.floor((n-1)/2)]+sorted[Math.ceil((n-1)/2)])/2 : null, maxMs:n ? sorted[n-1] : null, p95Ms:n >= 20 ? sorted[Math.ceil(n*.95)-1] : null };
  }
  function sanitizeEvent(input) {
    const event = {kind:KIND_ALIASES[input?.kind] || input?.kind, atMs:number(input?.atMs), clockId:id(input?.clockId)};
    if (!KINDS.includes(event.kind)) return null;
    for (const key of ['consultationId','cardId','canonicalCardId','printingId']) event[key]=id(input[key]);
    event.trackUid=Number.isSafeInteger(input.trackUid) && input.trackUid>=0?String(input.trackUid):id(input.trackUid);
    event.source=enumValue(input.source === 'FOREGROUND' ? 'NEW_ANALYSIS' : input.source,SOURCES,'UNKNOWN');
    event.requestOrigin=enumValue(input.requestOrigin,['HUMAN_POINTER','STATIONARY_POINTER']);
    event.observationSource=enumValue(input.observationSource,['NATIVE_SNAPSHOT','NATIVE_EVENT','DOM','UNKNOWN'],'UNKNOWN');
    event.nativeStatus=enumValue(input.nativeStatus,['ACTIVE','SUSPENDED','LOST','UNKNOWN'],'UNKNOWN');
    for (const key of ['accepted','identityObservationAvailable','genuineHover','detected','tracked','identityCurrent','decisionFresh','retainedPreview','preexisting','alreadyVisibleAtRequest','displayConfirmed','definitivePrinting','videoPaused','documentHidden']) event[key]=bool(input[key]);
    for (const key of ['nativeIdentityAtMs','matcherMs','videoCurrentTimeSec','videoReadyState','tracksCount','misses','fps','longTaskMs','callbackGapMs','droppedFrames','framesDecoded','detectionFps','videoFps','longTaskCount','droppedVideoFrames','durationMs','previousAtMs']) event[key]=number(input[key]);
    // Reasons are controlled codes, never native error strings or user text.
    event.reason=enumValue(REASON_ALIASES[input.reason] || input.reason,['POINTER_LEFT','TRACK_CHANGED','TRACK_LOST','REJECTED','NO_RESULT','TIMEOUT','CONTEXT_CHANGED','SCORE_INSUFFICIENT','MARGIN_INSUFFICIENT','QUALITY_REJECTED','TEMPORAL_STABILITY','CANCELLED','DOCUMENT_HIDDEN','CALLBACK_GAP','UNKNOWN']);
    return event;
  }
  function createSession(options) {
    const profile=copy(options?.profile), cards=selectedCards(profile,options?.selection), jobs=planJobs(profile,options?.selection);
    const frozenContext=context(options?.context), frozenBaseline=baseline(options?.nominalBaseline), installation={framingValidated:bool(options?.installation?.framingValidated),fixed:bool(options?.installation?.fixed),lighting:enumValue(options?.installation?.lighting,['ordinary','variable'])};
    const allowedFreeReferences=(list(options?.context?.references).length?list(options.context.references):cards).map(ref=>({cardId:id(ref.cardId),printingId:id(ref.printingId || ref.referencePrintingId)}));
    const clockId=id(options?.clockId);
    if (!clockId) throw Error('A page-local monotonic clockId is required');
    const provenance=enumValue(options?.provenance,['physical','automated']);
    if (!provenance) throw Error('Explicit physical or automated provenance required');
    const now=typeof options.now === 'function' ? options.now : () => typeof performance === 'object' ? performance.now() : null;
    const limits={};
    for (const [key,maximum] of Object.entries({maxEvents:30000,maxObservations:300,maxConsultations:3000,maxIncidents:300})) {
      const requested=profile.limits?.[key]; limits[key]=Number.isSafeInteger(requested) && requested > 0 ? Math.min(requested,maximum) : maximum;
    }
    Object.assign(limits,{truncated:false,droppedEvents:0,droppedObservations:0,droppedConsultations:0,droppedIncidents:0,invalidEvents:0,clockMismatchEvents:0,nonMonotonicEvents:0,unattributedResults:0});
    const observations=[],consultations=[],events=[],incidents=[];
    let active=null,finished=false,lastAt=null,startAt=null,endAt=null,invalidContext=false;
    function stamp(value) { const at=number(value === undefined ? now() : value); if (at===null) return null; if (lastAt!==null && at < lastAt) {limits.nonMonotonicEvents++;return null;} lastAt=at; if(startAt===null)startAt=at; return at; }
    function push(collection,value,key,maxKey) { if(collection.length>=limits[maxKey]) {limits.truncated=true;limits[key]++;return false;} collection.push(value); return true; }
    function log(event) {
      // Sparse scalar history: omitted optional fields are unknown. Structured
      // consultation/metric fields retain explicit nulls for unavailable data.
      const compact={};for(const [key,value] of Object.entries(event))if(value!==null || ['kind','atMs','clockId','observationId'].includes(key))compact[key]=value;
      return push(events,compact,'droppedEvents','maxEvents');
    }
    function identityCorrect(cardId,printingId,definitive,expectedCardId,expectedPrintingId) { return expectedCardId===null ? null : cardId===expectedCardId && !(definitive===true && expectedPrintingId && printingId && printingId!==expectedPrintingId); }
    function advance(at) {
      if (!active || active.lastAtMs===null) return;
      const delta=at-active.lastAtMs;
      if (active.physicalPresence===true) {
        active.stability.declaredPresenceMs+=delta;
        if (active.native.tracked===true) active.stability.trackedPresenceMs+=delta;
        if (active.native.tracked===false) active.stability.trackLostMs+=delta;
        if (active.native.nativeStatus==='SUSPENDED') active.stability.suspendedMs+=delta;
        if (active.native.tracked===true && active.native.identityObservationAvailable===false) active.stability.unknownIdentityObservationMs+=delta;
        if (active.native.tracked===true && active.native.identityObservationAvailable!==false && (active.native.nativeStatus==='ACTIVE' || (active.native.nativeStatus==='UNKNOWN' && active.native.identityObservationAvailable===true))) {
          active.stability.admissibleNativeMs+=delta;
          if(active.correctAcquired)active.stability.postAcquisitionAdmissibleNativeMs+=delta;
          if (active.native.identityCurrent===true && active.native.correct===true) active.stability.correctNativeMs+=delta;
          if (active.native.identityCurrent===false || active.native.correct===false) {
            active.stability.identityUnavailableMs+=delta;
            if(active.correctAcquired){active.stability.postAcquisitionIdentityLossMs+=delta;active.lossRunMs+=delta;active.stability.maximumIdentityLossMs=Math.max(active.stability.maximumIdentityLossMs,active.lossRunMs);}
            else {active.stability.acquisitionIdentityUnavailableMs+=delta;active.lossRunMs=0;}
          } else active.lossRunMs=0;
        } else active.lossRunMs=0;
        if (active.native.tracked===null) active.stability.unknownTrackingMs+=delta;
      }
      active.lastAtMs=at;
    }
    function startObservation(job,atMs) {
      if(finished)throw Error('Session finished');
      if(invalidContext)throw Error('Context invalidated; export and prepare a new session');
      if(observations.length>=limits.maxObservations){limits.truncated=true;limits.droppedObservations++;throw Error('Observation limit reached; export and start a new session');}
      if(active)throw Error('End the previous observation first');
      const planned=jobs.find(value=>value.id===job?.id);
      if(!planned)throw Error('Observation must belong to predeclared plan');
      if(['phase','expectedCardId','expectedPrintingId'].some(key=>job[key]!==undefined && job[key]!==planned[key]))throw Error('Predeclared observation cannot be changed');
      const at=stamp(atMs); if(at===null)throw Error('Invalid observation clock');
      active={id:'OBS-'+String(observations.length+1).padStart(4,'0'),jobId:planned.id,phase:planned.phase,expectedCardId:planned.expectedCardId,expectedPrintingId:planned.expectedPrintingId,currentExpectedCardId:planned.expectedCardId,currentExpectedPrintingId:planned.expectedPrintingId,expectedDeclarations:[],durationTargetMs:planned.durationMs,sequenceId:planned.sequenceId,stage:planned.stage,negativeScene:planned.negativeScene,condition:planned.condition,delayBeforeHoverMs:planned.delayBeforeHoverMs,consultationOrdinal:planned.consultationOrdinal,presentationId:planned.presentationId,available:planned.available,provenance,startAtMs:at,endAtMs:null,durationMs:null,endReason:null,physicalPresence:null,presenceChanges:[],firstDetectedAtMs:null,firstNativeCorrectObservedAtMs:null,nativeIdentityAtMs:null,firstCorrectDisplayAtMs:null,wrongCardIds:[],wrongAccepted:0,wrongPrintingAccepted:0,freshFalsePositiveAcceptances:0,nativeIdentityAppearances:0,preexistingOrFreshUnknownIdentityAppearances:0,negativeNativeIds:{},identityChanges:0,trackLosses:0,trackReacquisitions:0,correctAcquired:false,emptyIntervalDeclared:false,emptyAfterAcquisitionAtMs:null,nonConclusiveReasons:[],stability:{declaredPresenceMs:0,trackedPresenceMs:0,trackLostMs:0,unknownTrackingMs:0,unknownIdentityObservationMs:0,suspendedMs:0,admissibleNativeMs:0,correctNativeMs:0,identityUnavailableMs:0,acquisitionIdentityUnavailableMs:0,postAcquisitionIdentityLossMs:0,postAcquisitionAdmissibleNativeMs:0,maximumIdentityLossMs:0},lastAtMs:at,lossRunMs:0,native:{trackUid:null,tracked:null,identityCurrent:null,identityObservationAvailable:null,nativeStatus:'UNKNOWN',correct:null,cardId:null,observedAtMs:null},validity:'PENDING',outcome:'PENDING'};
      return copy(publicObservation(active));
    }
    function publicObservation(observation) { const {native,lastAtMs,lossRunMs,negativeNativeIds,...value}=observation; return value; }
    function markPresence(present,atMs) {
      if(!active || typeof present!=='boolean')return false;
      const at=stamp(atMs);if(at===null)return false; advance(at);
      active.physicalPresence=present;if(active.presenceChanges.length<limits.maxEvents && events.length<limits.maxEvents)active.presenceChanges.push({atMs:at,present});else{limits.truncated=true;limits.droppedEvents++;}
      if(!present){active.emptyIntervalDeclared=true;if(active.correctAcquired)active.emptyAfterAcquisitionAtMs=at;active.lossRunMs=0;}
      log({kind:'PHYSICAL_PRESENCE_DECLARED',atMs:at,clockId,observationId:active.id,present});return true;
    }
    function markReplacement(expected,atMs,printingId) {
      if(!active)return false;
      const cardId=expected && typeof expected==='object'?id(expected.cardId):id(expected);
      const requestedPrinting=expected && typeof expected==='object'?id(expected.printingId):id(printingId);
      if(active.phase==='FREE_PLAY') {
        if(expected!==null && !cardId)return false;
        if(cardId && !allowedFreeReferences.some(ref=>ref.cardId===cardId && (!requestedPrinting || (ref.printingId || ref.referencePrintingId)===requestedPrinting)))return false;
      } else if(active.phase!=='TRANSITION' || active.stage!=='B' || cardId!==active.expectedCardId)return false;
      const at=stamp(atMs);if(at===null)return false;advance(at);
      if(active.phase==='FREE_PLAY') {
        active.currentExpectedCardId=cardId;active.currentExpectedPrintingId=requestedPrinting;
        if(active.expectedDeclarations.length<limits.maxEvents && events.length<limits.maxEvents)active.expectedDeclarations.push({atMs:at,expectedCardId:cardId,expectedPrintingId:requestedPrinting});else{limits.truncated=true;limits.droppedEvents++;}
      }
      log({kind:'REPLACEMENT_DECLARED',atMs:at,clockId,observationId:active.id,expectedCardId:cardId,expectedPrintingId:requestedPrinting});return true;
    }
    function addIncident(code,atMs) {
      if(finished || !INCIDENTS.includes(code))return false;
      const at=stamp(atMs);if(at===null)return false;advance(at);
      if(active && ['CONDITION_UNAVAILABLE','PROTOCOL_ERROR','OCCLUSION','VIDEO_FREEZE','VIDEO_INTERRUPTION','INSTALLATION_CHANGED'].includes(code) && !active.nonConclusiveReasons.includes(code))active.nonConclusiveReasons.push(code);
      if(code==='INSTALLATION_CHANGED')invalidContext=true;
      return push(incidents,{code,atMs:at,clockId,observationId:active?.id || null},'droppedIncidents','maxIncidents');
    }
    function updateNative(event) {
      if(!active)return;
      const cardId=event.canonicalCardId || event.cardId;
      if(active.phase==='NEGATIVE' && event.kind==='TRACK_STATE' && event.trackUid) {
        const previous=active.negativeNativeIds[event.trackUid];
        if(event.tracked===false || event.identityCurrent===false || event.nativeStatus==='LOST' || event.nativeStatus==='SUSPENDED')delete active.negativeNativeIds[event.trackUid];
        else if(event.identityCurrent===true && event.retainedPreview!==true && cardId && previous!==cardId) {
          if(Object.keys(active.negativeNativeIds).length<64 || previous){active.negativeNativeIds[event.trackUid]=cardId;active.nativeIdentityAppearances++;if(event.decisionFresh!==true)active.preexistingOrFreshUnknownIdentityAppearances++;}else{limits.truncated=true;limits.droppedEvents++;}
        }
      }
      if(event.detected===true && active.firstDetectedAtMs===null)active.firstDetectedAtMs=event.atMs;
      if(active.native.trackUid && event.trackUid && event.trackUid!==active.native.trackUid && event.tracked!==false) {
        if (!(active.native.tracked===false && cardId===active.expectedCardId)) return;
      }
      const old={...active.native};
      if(event.trackUid)active.native.trackUid=event.trackUid;
      if(event.kind==='TRACK_STATE')active.native.observedAtMs=event.atMs;
      if(event.tracked!==null)active.native.tracked=event.tracked;
      if(event.identityCurrent!==null)active.native.identityCurrent=event.identityCurrent;
      if(event.identityObservationAvailable!==null)active.native.identityObservationAvailable=event.identityObservationAvailable;
      if(event.nativeStatus!=='UNKNOWN' || event.identityObservationAvailable!==null)active.native.nativeStatus=event.nativeStatus;
      if(event.tracked===false || event.nativeStatus==='LOST') {active.native.tracked=false;active.native.identityCurrent=false;active.native.nativeStatus='LOST';}
      if(event.retainedPreview!==true && event.identityCurrent===true && cardId) {
        active.native.cardId=cardId;active.native.correct=identityCorrect(cardId,event.printingId,event.definitivePrinting,active.expectedCardId,active.expectedPrintingId);
        if(old.cardId && old.cardId!==cardId && active.physicalPresence===true)active.identityChanges++;
        if(active.native.correct===true) {active.correctAcquired=true;if(active.firstNativeCorrectObservedAtMs===null){active.firstNativeCorrectObservedAtMs=event.atMs;active.nativeIdentityAtMs=event.nativeIdentityAtMs;}}
      } else if(event.identityCurrent===false)active.native.correct=null;
      if(old.tracked===true && active.native.tracked===false && active.physicalPresence===true)active.trackLosses++;
      if(old.tracked===false && active.native.tracked===true && active.physicalPresence===true)active.trackReacquisitions++;
      if(event.accepted===true && event.decisionFresh===true && event.retainedPreview!==true && cardId && (active.phase==='NEGATIVE' || active.physicalPresence!==false)) {
        if(active.phase==='NEGATIVE')active.freshFalsePositiveAcceptances++;
        else if(active.expectedCardId && cardId!==active.expectedCardId){active.wrongAccepted++;if(!active.wrongCardIds.includes(cardId)){if(active.wrongCardIds.length<32)active.wrongCardIds.push(cardId);else{limits.truncated=true;limits.droppedEvents++;}};}
        else if(active.expectedPrintingId && cardId===active.expectedCardId && event.definitivePrinting===true && event.printingId && event.printingId!==active.expectedPrintingId)active.wrongPrintingAccepted++;
      }
    }
    function observe(input) {
      if(finished)return {recorded:false,reason:'SESSION_FINISHED'};
      const event=sanitizeEvent(input);
      if(!event || event.atMs===null || !event.clockId){limits.invalidEvents++;return {recorded:false,reason:'INVALID_EVENT'};}
      if(event.clockId!==clockId){limits.clockMismatchEvents++;return {recorded:false,reason:'CLOCK_MISMATCH'};}
      const at=stamp(event.atMs);if(at===null)return {recorded:false,reason:'NON_MONOTONIC_CLOCK'};
      if(event.kind==='OBSERVATION_GAP' && active){const boundary=event.previousAtMs!==null?event.previousAtMs:event.durationMs!==null?at-event.durationMs:active.lastAtMs;if(boundary>=active.lastAtMs && boundary<=at)advance(boundary);const gap=at-active.lastAtMs;if(active.physicalPresence===true){active.stability.declaredPresenceMs+=gap;active.stability.unknownTrackingMs+=gap;}active.lastAtMs=at;active.lossRunMs=0;}else advance(at);event.observationId=active?.id || null;log(event);
      if(event.kind==='CONTEXT_INVALIDATED' || event.kind==='CONTEXT_INVALID') {invalidContext=true;if(active)endObservation('CONTEXT_CHANGED',at);return {recorded:true,reason:'CONTEXT_INVALIDATED'};}
      if(event.kind==='OBSERVATION_GAP') {if(active){active.native.tracked=null;active.native.identityCurrent=null;active.native.identityObservationAvailable=null;active.native.nativeStatus='UNKNOWN';}return {recorded:true};}
      if(event.kind==='RESULT' && event.consultationId){const prior=consultations.find(value=>value.id===event.consultationId);if(prior && prior.observationId!==active?.id){prior.lateEvents++;return {recorded:true,reason:'LATE_EVENT'};}}
      if(event.kind==='TRACK_STATE')updateNative(event);
      if(event.kind==='RESULT' && active) {
        const linked=consultations.find(value=>value.id===event.consultationId && value.observationId===active.id);
        const linkedTarget=!!(linked && event.trackUid && linked.trackUid===event.trackUid);
        const observedTarget=!!(event.trackUid && active.native.trackUid===event.trackUid && active.native.tracked===true && active.native.observedAtMs!==null && active.native.observedAtMs>=active.startAtMs);
        const historicalTarget=!!(event.trackUid && consultations.some(value=>value.trackUid===event.trackUid && value.observationId!==active.id));
        if(linkedTarget || observedTarget || (active.phase==='NEGATIVE' && !historicalTarget))updateNative(event);
      }
      if(event.kind==='REQUEST') {
        if(!active || !event.consultationId)return {recorded:true,reason:'NO_ACTIVE_OBSERVATION'};
        if(consultations.some(value=>value.id===event.consultationId))return {recorded:true,reason:'DUPLICATE_REQUEST'};
        const human=event.requestOrigin==='HUMAN_POINTER' && event.genuineHover===true;
        const request={id:event.consultationId,observationId:active.id,phase:active.phase,clockId,requestAtMs:at,requestOrigin:human?'HUMAN_POINTER':event.requestOrigin==='STATIONARY_POINTER'?'STATIONARY_POINTER':'UNKNOWN',genuineHover:human,trackUid:event.trackUid,expectedCardId:active.currentExpectedCardId,expectedPrintingId:active.currentExpectedPrintingId,source:'UNKNOWN',firstResultSource:null,firstAcceptedSource:null,displaySource:null,correctDisplaySource:null,preexistingIdentity:event.preexisting,alreadyVisibleAtRequest:event.alreadyVisibleAtRequest,firstResultAtMs:null,firstAcceptedAtMs:null,firstCorrectAcceptedAtMs:null,firstDisplayAtMs:null,firstCorrectDisplayAtMs:null,firstRecognitionAtMs:null,responseMs:null,correctResponseMs:null,wrongAccepted:0,wrongPrintingAccepted:0,rejections:0,lateEvents:0,lateResultAtMs:null,lateDisplayAtMs:null,confirmedCorrectDisplay:false,confirmedAnyDisplay:false,cancelledAtMs:null,timedOutAtMs:null,endAtMs:null,outcome:'PENDING',validity:invalidContext?'NON_CONCLUSIVE':'PENDING',delayBeforeHoverMs:active.delayBeforeHoverMs,consultationOrdinal:active.consultationOrdinal};
        if(event.trackUid && event.trackUid!==active.native.trackUid)active.native={trackUid:event.trackUid,tracked:null,identityCurrent:null,identityObservationAvailable:null,nativeStatus:'UNKNOWN',correct:null,cardId:null,observedAtMs:null};
        if(!push(consultations,request,'droppedConsultations','maxConsultations'))return {recorded:false,reason:'CONSULTATION_LIMIT'};
        return {recorded:true,consultation:copy(request)};
      }
      if(['RESULT','DISPLAY','CANCEL','TIMEOUT'].includes(event.kind)) {
        const request=consultations.find(value=>value.id===event.consultationId);
        if(!request || !event.consultationId){if(event.kind==='RESULT')limits.unattributedResults++;return {recorded:true,reason:'UNATTRIBUTED'};}
        if(request.endAtMs!==null || request.observationId!==active?.id){request.lateEvents++;if(event.kind==='RESULT' && request.lateResultAtMs===null)request.lateResultAtMs=at;if(event.kind==='DISPLAY' && event.displayConfirmed===true && event.retainedPreview!==true && request.lateDisplayAtMs===null)request.lateDisplayAtMs=at;return {recorded:true,reason:'LATE_EVENT'};}
        if(request.trackUid && event.trackUid && request.trackUid!==event.trackUid){request.lateEvents++;return {recorded:true,reason:'TRACK_MISMATCH'};}
        if(event.kind==='CANCEL' || event.kind==='TIMEOUT') {request.endAtMs=at;if(event.kind==='CANCEL')request.cancelledAtMs=at;else request.timedOutAtMs=at;request.outcome=request.wrongAccepted?'WRONG':request.confirmedCorrectDisplay?'CORRECT':event.kind==='CANCEL'?'CANCELLED':request.confirmedAnyDisplay?'DISPLAYED_UNASSESSED':request.rejections?'REJECTED':'NO_RESPONSE';request.validity=invalidContext?'NON_CONCLUSIVE':'VALID';return {recorded:true};}
        const cardId=event.canonicalCardId || event.cardId;
        if(event.kind==='RESULT' && request.firstResultAtMs===null){request.firstResultAtMs=at;request.firstResultSource=event.source;}
        if(event.accepted===false)request.rejections++;
        const accepted=event.accepted===true && event.retainedPreview!==true && event.identityCurrent!==false;
        const matches=identityCorrect(cardId,event.printingId,event.definitivePrinting,request.expectedCardId,request.expectedPrintingId);
        if(accepted && cardId) {
          if(request.firstAcceptedAtMs===null){request.firstAcceptedAtMs=at;request.firstAcceptedSource=event.source;request.source=event.source;}
          if(matches===false){request.wrongAccepted++;if(active && cardId && !active.wrongCardIds.includes(cardId)){if(active.wrongCardIds.length<32)active.wrongCardIds.push(cardId);else{limits.truncated=true;limits.droppedEvents++;}}}
          if(request.expectedPrintingId && event.definitivePrinting===true && cardId===request.expectedCardId && event.printingId && event.printingId!==request.expectedPrintingId)request.wrongPrintingAccepted++;
          if(matches===true && request.firstCorrectAcceptedAtMs===null)request.firstCorrectAcceptedAtMs=at;

          if(event.kind==='RESULT' && event.source==='NEW_ANALYSIS' && event.preexisting!==true && event.decisionFresh===true && request.firstRecognitionAtMs===null)request.firstRecognitionAtMs=at;
        }
        if(event.kind==='DISPLAY' && event.displayConfirmed===true && accepted && cardId && request.trackUid && event.trackUid===request.trackUid)request.confirmedAnyDisplay=true;
        if(event.kind==='DISPLAY' && event.displayConfirmed===true && accepted && cardId && matches===true && request.trackUid && event.trackUid===request.trackUid){request.confirmedCorrectDisplay=true;request.correctDisplaySource=request.correctDisplaySource || event.source;if(active){active.correctAcquired=true;}if(active?.firstCorrectDisplayAtMs===null)active.firstCorrectDisplayAtMs=at;}
        if(event.kind==='DISPLAY' && event.displayConfirmed===true && accepted && cardId && event.alreadyVisibleAtRequest!==true && request.alreadyVisibleAtRequest!==true && request.trackUid && event.trackUid===request.trackUid) {
          if(request.firstDisplayAtMs===null){request.firstDisplayAtMs=at;request.responseMs=at-request.requestAtMs;request.displaySource=event.source;request.source=event.source;}
          if(matches===true && request.firstCorrectDisplayAtMs===null){request.firstCorrectDisplayAtMs=at;request.correctResponseMs=at-request.requestAtMs;if(active?.firstCorrectDisplayAtMs===null)active.firstCorrectDisplayAtMs=at;}
        }
        request.outcome=request.wrongAccepted?'WRONG':request.confirmedCorrectDisplay?'CORRECT':request.confirmedAnyDisplay?'DISPLAYED_UNASSESSED':request.rejections?'REJECTED':'PENDING';
        return {recorded:true,consultation:copy(request)};
      }
      return {recorded:true};
    }
    function endObservation(reason='COMPLETED',atMs) {
      if(!active)return null;
      const at=stamp(atMs);if(at===null)return null;advance(at);
      const code=enumValue(reason,END_REASONS,'INTERRUPTED');
      for(const request of consultations.filter(value=>value.observationId===active.id && value.endAtMs===null)) {request.endAtMs=at;request.outcome=request.wrongAccepted?'WRONG':request.confirmedCorrectDisplay?'CORRECT':request.confirmedAnyDisplay?'DISPLAYED_UNASSESSED':request.rejections?'REJECTED':code==='OPERATOR_CANCELLED'?'CANCELLED':'NO_RESPONSE';request.validity=code==='COMPLETED' && !invalidContext?'VALID':'NON_CONCLUSIVE';}
      active.endAtMs=at;active.durationMs=at-active.startAtMs;active.endReason=code;
      const own=consultations.filter(value=>value.observationId===active.id);
      active.windowComplete=active.durationMs>=active.durationTargetMs;
      active.stabilityWindowAfterAcquisitionMs=active.firstCorrectDisplayAtMs!==null?Math.max(0,at-active.firstCorrectDisplayAtMs):null;
      active.stabilityWindowComplete=active.phase==='STABILITY'?active.stabilityWindowAfterAcquisitionMs!==null && active.stabilityWindowAfterAcquisitionMs>=active.durationTargetMs:null;
      if(code!=='COMPLETED')active.nonConclusiveReasons.push(code);
      if(!active.available)active.nonConclusiveReasons.push('CARD_UNAVAILABLE');
      if(invalidContext)active.nonConclusiveReasons.push('CONTEXT_CHANGED');
      if(active.phase!=='NEGATIVE' && !own.some(value=>value.genuineHover))active.nonConclusiveReasons.push('NO_HUMAN_CONSULTATION');
      if(provenance==='physical' && active.phase!=='FREE_PLAY' && !active.presenceChanges.some(value=>value.present===(active.phase!=='NEGATIVE')))active.nonConclusiveReasons.push('PHYSICAL_EXPOSURE_NOT_DECLARED');
      if(active.phase==='STABILITY' && !active.stabilityWindowComplete)active.nonConclusiveReasons.push(active.firstCorrectDisplayAtMs===null?'ACQUISITION_NOT_OBTAINED':'INSUFFICIENT_STABILITY_WINDOW');
      active.nonConclusiveReasons=[...new Set(active.nonConclusiveReasons)];
      active.validity=active.nonConclusiveReasons.length?'NON_CONCLUSIVE':'VALID';
      active.observedOutcome=active.phase==='NEGATIVE'?active.freshFalsePositiveAcceptances?'FALSE_POSITIVE':active.nativeIdentityAppearances?'NATIVE_IDENTITY_OBSERVED_FRESHNESS_UNKNOWN':'NO_FRESH_IDENTITY_OBSERVED':active.wrongAccepted || own.some(value=>value.wrongAccepted)?'WRONG':own.some(value=>value.confirmedCorrectDisplay)?'CORRECT':active.correctAcquired && !own.length?'NATIVE_CORRECT_NOT_DISPLAYED':own.length?'NOT_IDENTIFIED':'NO_CONSULTATION';
      active.outcome=active.validity==='VALID'?active.observedOutcome:'NON_CONCLUSIVE';
      for(const request of own)if(active.validity!=='VALID')request.validity='NON_CONCLUSIVE';
      const value=publicObservation(active);push(observations,value,'droppedObservations','maxObservations');active=null;return copy(value);
    }
    function finish(atMs) {if(finished)return getState();const at=stamp(atMs);if(at===null)return getState();if(active)endObservation('FINISHED',at);finished=true;endAt=at;return getState();}
    function getState() {return {profileId:profile.id,clockId,provenance,activeObservation:active?copy(publicObservation(active)):null,observationsCompleted:observations.length,consultationsRecorded:consultations.length,incidentsRecorded:incidents.length,finished,invalidContext,limits:copy(limits)};}
    function exportReport() {
      const current=observations.concat(active?[publicObservation(active)]:[]), valid=current.filter(value=>value.validity==='VALID');
      const reliability=valid.filter(value=>value.phase==='RELIABILITY'), positive=valid.filter(value=>value.expectedCardId!==null), negative=valid.filter(value=>value.phase==='NEGATIVE');
      const completedConsultations=consultations.filter(value=>value.validity==='VALID'), human=completedConsultations.filter(value=>value.genuineHover);
      const metricSet=rows=>({total:rows.length,correct:rows.filter(value=>value.outcome==='CORRECT').length,wrong:rows.filter(value=>value.outcome==='WRONG').length,notIdentified:rows.filter(value=>value.outcome==='NOT_IDENTIFIED').length,noConsultation:rows.filter(value=>value.outcome==='NO_CONSULTATION').length});
      const reliabilityCounts=metricSet(reliability);
      const reliabilityPerformed=current.filter(value=>value.phase==='RELIABILITY');
      const excludedReliability=reliabilityPerformed.filter(value=>value.validity!=='VALID');
      const exclusionReasons=[...new Set(excludedReliability.flatMap(value=>value.nonConclusiveReasons || []))].map(reason=>({reason,observations:excludedReliability.filter(value=>value.nonConclusiveReasons?.includes(reason)).length}));
      const reliabilityDenominators={rateScope:'VALID_PRESENTATIONS_WITH_CORRELATED_HUMAN_CONSULTATION_ONLY',validPresentations:reliability.length,performedPresentations:reliabilityPerformed.length,excludedPresentations:excludedReliability.length,exclusionReasons,declaredPresentWithoutCorrelatedHumanRequest:reliabilityPerformed.filter(value=>value.presenceChanges.some(change=>change.present) && !consultations.some(request=>request.observationId===value.id && request.genuineHover)).length,declaredPresentWithoutDetectionObservation:reliabilityPerformed.filter(value=>value.presenceChanges.some(change=>change.present) && value.firstDetectedAtMs===null).length,uncorrelatableHumanPointerAttempts:null,uncorrelatableAttemptAvailability:'NOT_MEASURED_NO_REQUEST_EVENT_WITHOUT_NATIVE_TRACK',ratesRequireReviewOfExcludedObservations:true,ratesDoNotEstablishUndetectedPresentationSuccess:true};
      const sums=Object.fromEntries(Object.keys({declaredPresenceMs:0,trackedPresenceMs:0,trackLostMs:0,unknownTrackingMs:0,unknownIdentityObservationMs:0,suspendedMs:0,admissibleNativeMs:0,correctNativeMs:0,identityUnavailableMs:0,acquisitionIdentityUnavailableMs:0,postAcquisitionIdentityLossMs:0,postAcquisitionAdmissibleNativeMs:0}).map(key=>[key,current.reduce((sum,value)=>sum+value.stability[key],0)]));
      const groups=[];
      for(const source of SOURCES)for(const ordinal of [null,1,2])for(const delay of [null,0,5000,10000]) {
        const rows=human.filter(value=>value.source===source && value.consultationOrdinal===ordinal && value.delayBeforeHoverMs===delay);
        if(rows.length)groups.push({source,consultationOrdinal:ordinal,delayBeforeHoverMs:delay,requests:rows.length,successfulResponses:rows.filter(value=>value.outcome==='CORRECT').length,response:stats(rows.map(value=>value.responseMs)),correctResponse:stats(rows.map(value=>value.correctResponseMs))});
      }
      const transitions=list(profile.phases.transitions.pairs).map((pair,i)=>{
        const sequenceId='TRANSITION-'+(i+1), a=current.filter(value=>value.sequenceId===sequenceId && value.stage==='A'), b=current.filter(value=>value.sequenceId===sequenceId && value.stage==='B');
        const lastA=a.at(-1),lastB=b.at(-1);
        return {sequenceId,aObservations:a.length,bObservations:b.length,aAcquired:lastA?.correctAcquired || false,emptyIntervalDeclared:lastA?.emptyAfterAcquisitionAtMs!==null && lastA?.emptyAfterAcquisitionAtMs!==undefined,bOutcome:lastB?.outcome || 'NOT_OBSERVED',bMisidentifiedAsA:lastB && lastA ? lastB.wrongCardIds.includes(lastA.expectedCardId) : null,complete:!!(lastA?.validity==='VALID' && lastB?.validity==='VALID' && lastA.correctAcquired && lastA.emptyAfterAcquisitionAtMs!==null && lastB.startAtMs>=lastA.endAtMs)};
      });
      return copy({schemaVersion:'1.0',profileId:profile.id,profileVersion:profile.version,scope:profile.scope,provenance,evidence:provenance==='physical'?(profile.id==='VISION_SOLO_LAB_1_0'?'OPERATOR_DECLARED_SOLO_LAB_REAL_CARDS':'OPERATOR_DECLARED_REAL_GAME'):'AUTOMATED_TEST_ONLY',clockId,context:frozenContext,startedAtMs:startAt,finishedAtMs:endAt,durationMs:startAt!==null && endAt!==null?endAt-startAt:null,finished,nominalBaseline:frozenBaseline,installation,selection:cards.map(({label,...card})=>card),planned:jobs.map(({label,...job})=>job),observations:current,consultations,events,eventEncoding:'SPARSE_SCALARS_OPTIONAL_ABSENT_MEANS_UNKNOWN',incidents,limits,metrics:{reliability:{denominators:reliabilityDenominators,planned:20,performed:current.filter(value=>value.phase==='RELIABILITY').length,nonConclusive:current.filter(value=>value.phase==='RELIABILITY' && value.validity!=='VALID').length,...reliabilityCounts,correctRate:reliability.length?100*reliabilityCounts.correct/reliability.length:null,wrongRate:reliability.length?100*reliabilityCounts.wrong/reliability.length:null,wrongObservedIncludingNonConclusive:current.filter(value=>value.phase==='RELIABILITY' && value.observedOutcome==='WRONG').length,nonConclusiveWrongObservations:current.filter(value=>value.phase==='RELIABILITY' && value.validity!=='VALID' && value.observedOutcome==='WRONG').length},allPositivePhases:metricSet(positive),stability:{...sums,trackLosses:current.reduce((sum,value)=>sum+value.trackLosses,0),trackReacquisitions:current.reduce((sum,value)=>sum+value.trackReacquisitions,0),identityChanges:current.reduce((sum,value)=>sum+value.identityChanges,0),maximumIdentityLossMs:current.length?Math.max(...current.map(value=>value.stability.maximumIdentityLossMs)):null,nativeIdentityRetentionRate:sums.admissibleNativeMs?100*sums.correctNativeMs/sums.admissibleNativeMs:null,nativeIdentityRetentionIncludesAcquisition:true,postAcquisitionNativeIdentityRetentionRate:sums.postAcquisitionAdmissibleNativeMs?100*sums.correctNativeMs/sums.postAcquisitionAdmissibleNativeMs:null,trackingAvailabilityRate:sums.declaredPresenceMs?100*sums.trackedPresenceMs/sums.declaredPresenceMs:null,denominator:'OPERATOR_DECLARED_PHYSICAL_PRESENCE_AND_OBSERVED_NATIVE_TRACK_POLICY'},transitions,negativeScenes:{planned:5,performed:negative.length,observedMs:negative.reduce((sum,value)=>sum+value.durationMs,0),freshFalsePositiveAcceptances:negative.reduce((sum,value)=>sum+value.freshFalsePositiveAcceptances,0),nativeIdentityAppearances:negative.reduce((sum,value)=>sum+value.nativeIdentityAppearances,0),preexistingOrFreshUnknownIdentityAppearances:negative.reduce((sum,value)=>sum+value.preexistingOrFreshUnknownIdentityAppearances,0),nativeFreshness:'UNKNOWN_UNLESS_EXPLICIT_NATIVE_DECISION',requests:consultations.filter(value=>value.phase==='NEGATIVE').length},consultations:{recorded:consultations.length,valid:completedConsultations.length,nonConclusive:consultations.filter(value=>value.validity==='NON_CONCLUSIVE').length,wrongObservedIncludingNonConclusive:consultations.filter(value=>value.wrongAccepted>0).length,humanRequests:consultations.filter(value=>value.genuineHover).length,stationaryPointerRequests:consultations.filter(value=>value.requestOrigin==='STATIONARY_POINTER').length,correct:completedConsultations.filter(value=>value.outcome==='CORRECT').length,wrong:completedConsultations.filter(value=>value.wrongAccepted>0).length,cancelled:completedConsultations.filter(value=>value.outcome==='CANCELLED').length,noResponse:completedConsultations.filter(value=>value.outcome==='NO_RESPONSE').length,rejected:completedConsultations.filter(value=>value.outcome==='REJECTED').length,displayedUnassessed:completedConsultations.filter(value=>value.outcome==='DISPLAYED_UNASSESSED').length},latency:{humanOnly:true,groups,noBlockingSpeedThreshold:true}},qualification:{status:'NOT_EVALUATED',requiresPhysicalReview:true,historicalNominalUnchanged:true,syntheticIsNotPhysical:provenance==='automated',speedIsDescriptive:true,contextInvalid:invalidContext,incompleteEvidence:limits.truncated || invalidContext}});
    }
    return Object.freeze({startObservation,markPresence,markReplacement,addIncident,observe,endObservation,finish,getState,exportReport});
  }
  return Object.freeze({createSession,planJobs,stats,SOURCES:Object.freeze(SOURCES),PHASES:Object.freeze(PHASES),INCIDENTS:Object.freeze(INCIDENTS)});
});
