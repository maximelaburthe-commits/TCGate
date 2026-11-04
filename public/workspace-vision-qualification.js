(function initWorkspaceQualification(root) {
  'use strict';
  if (!root.document || root.TCGWorkspaceVisionQualification) return;
  const $ = id => root.document.getElementById(id);
  if (!$('visionQualificationPanel')) return;
  const RAW_ROOT = 'https://raw.githubusercontent.com/maximelaburthe-commits/TCGate/';
  const POSITION = { SLIGHT: 'Angle léger', MODERATE: 'Angle modéré', SLIGHTLY_CLOSER: 'Distance proche', SLIGHTLY_FARTHER: 'Distance éloignée', SLIGHTLY_ROTATED: 'Légère rotation' };
  const NOTE = { SLIGHT: 'ANGLE_SLIGHT', MODERATE: 'ANGLE_MODERATE', SLIGHTLY_CLOSER: 'DISTANCE_NEAR', SLIGHTLY_FARTHER: 'DISTANCE_FAR', SLIGHTLY_ROTATED: 'ROTATED_SLIGHT' };
  const LABEL = { NOMINAL: 'Nominal', ANGLE: 'Angle', LOW_LIGHT: 'Faible lumière', DISTANCE: 'Distance', ORIENTATION: 'Orientation', SLEEVE_GLARE: 'Sleeve / reflet', STABILITY: 'Stabilité', REMOVAL: 'Retrait', RAPID_SWITCH: 'Changement A → B', SIMILAR_PRINTINGS: 'Cartes proches / variantes', NEGATIVE: 'Faux positifs' };
  const SCENE = { EMPTY_TABLE: 'Table vide', PLAYMAT: 'Playmat', VISIBLE_HAND: 'Main visible', CLOSED_DECK: 'Paquet / pile', DESK_OBJECTS: 'Objets de bureau' };
  const RESULT = { CORRECT: 'Correct', NO_DETECTION: 'Non détectée', NOT_IDENTIFIED: 'Non identifiée', WRONG_IDENTIFICATION: 'Mauvaise identification', UNSTABLE: 'Instable', INVALID_TEST: 'Essai invalide' };
  let q = null, documentSample = null, productSha = null, sampleUrl = null, preparing = null, runPrefix = null;
  let immutableContext = null, activeJob = null, operating = false, cameraHome = null;
  let sessionNominalGate = { ready: false, status: 'PENDING' };
  let qualifiedNominalGate = { ready: false, status: 'PENDING', reasons: [] }, nominalReceiptUrl = null;
  const importedSessions = [], importedIndexes = [];
  let selection = 'NOMINAL', pendingAdvance = false, lastResultId = null, activeDeadline = null, autoStop = null, lastError = '';
  const scriptLoads = new Map();
  const empty = () => ({ active: null, trials: [], scenes: [], plan: { substitutions: [], variantAvailability: [] } });
  const session = () => q ? q.getProgress() : empty();
  function neutralState() {
    return q?.getNeutralState?.() || { ready: false, reason: 'NEUTRAL_GUARD_UNAVAILABLE', remainingMs: 750 };
  }
  // One station, one feed and the original Lab controls. Qualification changes
  // the guidance inside this station; it never creates a second camera UI.
  function buildStation() {
    const station = $('vqWorkflow'), camera = station.querySelector('.qualification-camera');
    $('labControls').prepend(station);
    const cameraArticle = $('labControls').querySelector('.lab-columns > div > article');
    const identification = $('labControls').querySelector('.lab-columns > article');
    const normalDetails = root.document.createElement('section');
    normalDetails.id = 'labNormalDetails'; normalDetails.className = 'qualification-details lab-normal-details';
    normalDetails.setAttribute('aria-label', 'Résultat et préparation du Vision Lab');
    station.querySelector('.qualification-desk').append(normalDetails);
    const current = root.document.createElement('section'); current.className = 'lab-current';
    current.innerHTML = '<h3>Identification en direct</h3>';
    for (const selector of ['#identEmpty', '.result-images']) current.append(identification.querySelector(selector));
    normalDetails.append(current);
    const database = root.document.createElement('details'); database.id = 'labDatabaseSetup'; database.open = true;
    database.innerHTML = '<summary>BDD et identification optionnelles</summary>';
    database.append(identification.querySelector('.card'));
    normalDetails.append(database, $('visionQualificationPanel'));
    database.querySelector('details > summary').after($('labDatabaseSummary'));
    const diagnostic = root.document.createElement('details'); diagnostic.id = 'labDiagnostics';
    diagnostic.innerHTML = '<summary>Résultat détaillé et performances</summary>';
    for (const id of ['labRecognitionSummary', 'identLibraryStatus', 'identMatcherStatus', 'identRefreshButton', 'identCandidates']) diagnostic.append($(id));
    for (const child of [...identification.children]) if (child.matches('details,h3,table')) diagnostic.append(child);
    diagnostic.append(cameraArticle.querySelector('.metrics'));
    normalDetails.append(diagnostic);
    const settings = root.document.createElement('details'); settings.id = 'labDetectorSettings';
    settings.innerHTML = '<summary>Réglages du détecteur</summary>';
    const settingsArticle = cameraArticle.nextElementSibling;
    settingsArticle.querySelector('h3').remove(); settings.append(...settingsArticle.childNodes); normalDetails.append(settings);
    const feedback = root.document.createElement('details'); feedback.id = 'labFeedbackDetails';
    feedback.innerHTML = '<summary>Cas de test et feedback du Lab</summary>';
    const feedbackArticle = $('visionCaseNote').closest('article');
    feedbackArticle.querySelector('h3').remove(); feedback.append(...feedbackArticle.childNodes); normalDetails.append(feedback);
    const normalBar = root.document.createElement('footer'); normalBar.id = 'labNormalBar'; normalBar.className = 'lab-normal-bar';
    const status = root.document.createElement('div'); status.className = 'lab-live-status';
    status.append($('labStatus'), $('identificationToggle').closest('label'));
    normalBar.append(status, $('labStart'));
    const controls = root.document.createElement('div'); controls.id = 'labCameraControls';
    for (const child of [...cameraArticle.children]) if (child.matches('h3,#labCameraStatus,#labDetectionStatus,.toolbar,#visionGlobalStatus')) controls.append(child);
    const normalMount = root.document.createElement('div'); normalMount.id = 'labCameraMount';
    normalMount.append($('opponentFeed'));
    camera.prepend(controls, normalMount);
    camera.append($('visionModelProgress'), $('visionRuntimeWarning'));
    cameraHome = normalMount;
    station.querySelector('.qualification-desk').append(normalDetails);
    station.append(normalBar);
    station.classList.add('lab-station'); station.setAttribute('aria-modal', 'false');
    const history = root.document.createElement('p'); history.id = 'vqBaselineHistory'; history.className = 'muted';
    $('vqProgress').after(history);
    const sectionDetails = $('vqCondition').closest('details');
    sectionDetails.querySelector('summary').after($('vqComplementaryLabel'), $('vqCondition').closest('label'), $('vqSectionProgress'));
    $('labControls').prepend(station);
    $('labControls').querySelector('.lab-columns').remove();
    feedbackArticle.remove();
    $('vqReturnLab').hidden = true;
    const workspaceReturn = root.document.createElement('button'); workspaceReturn.id = 'labWorkspaceReturn'; workspaceReturn.textContent = 'Workspace';
    workspaceReturn.addEventListener('click', () => $('tab-reprise').click());
    station.querySelector('.qualification-console-header').append(workspaceReturn);
    $('vqConsoleTitle').textContent = 'Vision Lab · session locale';
    $('vqDetailsScroll').hidden = true; $('vqControlBar').hidden = true;
    $('vqCameraMount').hidden = true; $('vqCameraCard').hidden = true;
    camera.querySelector('.muted').id = 'labCameraGuidance';
    camera.querySelector('.muted').textContent = 'Survolez une carte détectée pour lancer sa reconnaissance. Aucune room ni microphone.';
    const fitFeed = () => {
      const mount = operating ? $('vqCameraMount') : $('labCameraMount'), feed = $('opponentFeed'), video = $('remoteVideo');
      if (!mount || mount.hidden || !mount.clientWidth || !mount.clientHeight) return;
      const ratio = (video.videoWidth || 1280) / (video.videoHeight || 720);
      const width = Math.min(mount.clientWidth, mount.clientHeight * ratio);
      feed.style.width = width + 'px'; feed.style.height = width / ratio + 'px';
    };
    const feedLayout = new root.ResizeObserver(fitFeed);
    feedLayout.observe($('labCameraMount')); feedLayout.observe($('vqCameraMount'));
    $('remoteVideo').addEventListener('resize', fitFeed);
    root.addEventListener('resize', fitFeed);
    setLabVisible();
  }
  function setLabVisible() {
    const visible = !$('panel-lab').hidden;
    root.document.body.classList.toggle('lab-station-open', visible);
    root.document.documentElement.classList.toggle('lab-station-open', visible);
    $('vqWorkflow').hidden = !visible;
  }
  function setOperating(value) {
    if (!value && q?.getActiveObservation()) throw Error('Terminez l’essai avant de revenir au Lab.');
    operating = Boolean(value && q && !$('panel-lab').hidden);
    const feed = $('opponentFeed');
    if (feed) (operating ? $('vqCameraMount') : cameraHome).append(feed);
    root.document.body.classList.toggle('qualification-operating', operating);
    root.document.documentElement.classList.toggle('qualification-operating', operating);
    for (const id of ['labNormalDetails', 'labNormalBar', 'labCameraControls', 'labCameraMount', 'labWorkspaceReturn']) $(id).hidden = operating;
    for (const id of ['vqDetailsScroll', 'vqControlBar', 'vqCameraMount', 'vqCameraCard', 'vqReturnLab']) $(id).hidden = !operating;
    $('vqWorkflow').setAttribute('role', operating ? 'dialog' : 'region');
    $('vqWorkflow').setAttribute('aria-modal', String(operating));
    $('vqWorkflow').setAttribute('aria-label', operating ? 'Poste de qualification Vision' : 'Poste Vision Lab');
    if (!operating) $('vqConsoleTitle').textContent = 'Vision Lab · session locale';
    $('labCameraGuidance').textContent = operating ? 'Pendant l’essai, la reconnaissance est automatique. Gardez une seule carte visible ; retirez-la entre les essais.' : 'Survolez une carte détectée pour lancer sa reconnaissance. Aucune room ni microphone.';
    $('vqResume').hidden = !q || operating;
    setLabVisible();
    if (operating) { $('vqWorkflow').tabIndex = -1; $('vqWorkflow').focus({ preventScroll: true }); }
    root.dispatchEvent(new root.Event('resize'));
  }
  function detectorRunning(snapshot) {
    if (!snapshot?.modelReady) return false;
    if (snapshot.active === true) return true;
    const local = root.TCGDetectionLab?.state;
    return local?.detecting === true && Boolean(local.stream?.getVideoTracks?.().some(track => track.readyState === 'live'));
  }
  const node = (tag, value, parent) => { const e = root.document.createElement(tag); if (value != null) e.textContent = String(value); if (parent) parent.append(e); return e; };
  function fail(error) { lastError = error?.message || String(error); $('vqError').textContent = lastError; $('vqConsoleError').textContent = lastError; }
  function clearError() { lastError = ''; $('vqError').textContent = ''; $('vqConsoleError').textContent = ''; }
  function loadScript(src) {
    if (!scriptLoads.has(src)) scriptLoads.set(src, new Promise((resolve, reject) => {
      const s = root.document.createElement('script'); s.src = src;
      s.onload = resolve; s.onerror = () => { s.remove(); scriptLoads.delete(src); reject(Error('Chargement impossible : ' + src)); };
      root.document.head.append(s);
    }));
    return scriptLoads.get(src);
  }
  function activeCard(card, state = session()) {
    const substitution = state.plan.substitutions?.find(item => item.originalCardId === card.cardId);
    if (!substitution) return card;
    const alternative = card.substitution.eligibleAlternatives.find(item => item.cardId === substitution.replacementCardId && item.printingId === substitution.replacementPrintingId);
    return { ...card, ...alternative, cardId: substitution.replacementCardId, printingId: substitution.replacementPrintingId, profile: { ...card.profile, type: alternative?.type, color: alternative?.color }, originalCardId: card.cardId };
  }
  function buildJobs(state = session()) {
    if (!documentSample) return [];
    const jobs = [], byId = new Map(documentSample.sample.map(card => [card.sampleId, activeCard(card, state)]));
    const add = job => { jobs.push({ ...job, key: runPrefix + '-job-' + jobs.length }); };
    for (const row of documentSample.plan.matrix) {
      for (const sampleId of row.sampleIds || []) {
        const card = byId.get(sampleId);
        for (const position of row.positions?.length ? row.positions : [null]) {
          const total = row.repetitions || row.repetitionsPerPosition || 1;
          for (let repetition = 1; repetition <= total; repetition += 1) add({ condition: row.condition, card, sampleId, position, repetition, total, durationMs: row.durationMs || documentSample.plan.trialPolicy.recommendedPositiveObservationWindowMs, notes: position ? [NOTE[position]] : row.condition === 'SLEEVE_GLARE' ? ['SLEEVE_USED'] : [] });
        }
      }
      if (row.condition === 'RAPID_SWITCH') for (const [pairIndex, pair] of (row.pairs || []).entries()) {
        const a = { condition: row.condition, card: byId.get(pair[0]), phase: 'A', pairIndex, repetition: 1, total: 1, durationMs: documentSample.plan.trialPolicy.recommendedPositiveObservationWindowMs, notes: ['RAPID_SWITCH'] };
        add(a);
        add({ ...a, card: byId.get(pair[1]), phase: 'B', previousKey: jobs.at(-1).key });
      }
      if (row.condition === 'SIMILAR_PRINTINGS') {
        for (const pair of row.pairs || []) for (let side = 0; side < pair.cardIds.length; side += 1) {
          const original = documentSample.sample.find(card => card.cardId === pair.cardIds[side]);
          const card = { ...original, cardId: pair.cardIds[side], printingId: pair.printingIds[side] };
          for (let repetition = 1; repetition <= (row.repetitionsPerPrinting || 3); repetition += 1) add({ condition: row.condition, card, pairId: pair.pairId, repetition, total: row.repetitionsPerPrinting || 3, durationMs: documentSample.plan.trialPolicy.recommendedPositiveObservationWindowMs, notes: [] });
        }
        for (const variant of row.variantCases || []) for (const printing of variant.printings) {
          const original = documentSample.sample.find(card => card.cardId === variant.cardId);
          for (let repetition = 1; repetition <= (row.repetitionsPerPrinting || 3); repetition += 1) add({ condition: row.condition, card: { ...original, cardId: variant.cardId, printingId: printing.printingId }, variant, printing, repetition, total: row.repetitionsPerPrinting || 3, durationMs: documentSample.plan.trialPolicy.recommendedPositiveObservationWindowMs, notes: [] });
        }
      }
    }
    for (const scene of documentSample.plan.requiredScenes) add({ condition: 'NEGATIVE', scene: scene.scene, durationMs: scene.durationMs });
    return jobs;
  }
  const records = state => [...state.trials, ...state.scenes];
  const matches = (record, job) => (record.trialId || record.sceneId)?.startsWith(job.key + '-attempt-');
  function invalidated(record, state) { return Boolean(state.trialAnnotations?.some(item => item.trialId === record.trialId && item.action === 'INVALIDATE')); }
  function completed(job, state) {
    return records(state).some(record => matches(record, job) && (record.scene
      ? root.TCGateVisionQualification.classifyScene(record, immutableContext).valid && record.endMs - record.t0Ms >= job.durationMs
      : classify(record, state).category !== 'INVALID_TEST'));
  }
  function unavailable(job, state) {
    if (job.condition === 'SLEEVE_GLARE') return state.plan.sleeveAvailability === 'UNAVAILABLE';
    return job.variant && state.plan.variantAvailability?.some(item => item.caseId === job.variant.caseId && item.printingId === job.printing.printingId && item.availability === 'UNAVAILABLE');
  }
  function currentJob(state = session()) {
    const jobs = buildJobs(state);
    if (state.active) return jobs.find(job => matches(state.active, job)) || null;
    return jobs.find(job => job.condition === selection && !completed(job, state) && !unavailable(job, state)) || null;
  }
  function retrySwitchJob(job, state, jobs = buildJobs(state)) {
    if (!job || job.phase !== 'B' || state.active) return null;
    const previous = state.trials.filter(raw => raw.trialId.startsWith(job.previousKey + '-attempt-')).at(-1);
    return previous?.removal?.clearAtMs != null ? null : jobs.find(candidate => candidate.key === job.previousKey) || null;
  }
  function nominalProgress(state) {
    const jobs = buildJobs(state).filter(job => job.condition === 'NOMINAL');
    const count = jobs.filter(job => completed(job, state)).length;
    const cards = documentSample.sample.filter(card => jobs.filter(job => job.sampleId === card.sampleId).every(job => completed(job, state))).length;
    return { count, total: jobs.length, cards };
  }
  function nominalGate() {
    const ready = sessionNominalGate.ready || qualifiedNominalGate.ready;
    const official = !sessionNominalGate.ready && qualifiedNominalGate.ready;
    return { ...sessionNominalGate, ...(official ? qualifiedNominalGate : {}),
      ready, source: official ? 'QUALIFICATION_RECEIPT' : 'CURRENT_SESSION' };
  }
  function setReady(ready) {
    setLabVisible(); $('vqPrepare').disabled = ready || Boolean(preparing);
    $('vqPhysicalConfirm').disabled = ready || Boolean(preparing);
  }
  async function prepare() {
    if (q) return q;
    if (preparing) return preparing;
    if (!$('vqPhysicalConfirm').checked) throw Error('Confirmez que vous utiliserez de vraies cartes pour la session physique.');
    preparing = (async () => {
      clearError(); setReady(false); $('vqStatus').textContent = 'Préparation de la qualification…';
      const healthResponse = await root.fetch('/api/health', { cache: 'no-store' });
      if (!healthResponse.ok) throw Error('Impossible de lire le build déployé.');
      const health = await healthResponse.json();
      if (!/^[a-f0-9]{40}$/i.test(health.buildSha || '')) throw Error('Qualification indisponible : SHA du build absent ou invalide.');
      productSha = health.buildSha.toLowerCase(); $('vqBuildSha').textContent = productSha;
      const runtime = root.TCGIdentificationLab?.getSnapshot?.();
      const detector = root.TCGVisionEngine?.getSnapshot?.();
      if (!runtime?.libraryReady || !runtime.matcherWorker?.ready || !detectorRunning(detector)) throw Error('Démarrez la caméra, la détection et l’identification dans ce Vision Lab avant la qualification.');
      if (runtime.gameId !== 'cyberpunk' || runtime.playerLocale !== 'en' || runtime.visionReferenceCount !== 229 || runtime.librarySize !== 229 || runtime.visionLocales?.length !== 1 || runtime.visionLocales[0] !== 'en') throw Error('Qualification réservée au corpus actif Cyberpunk EN · 229 références.');
      for (const src of ['/vision-qualification-harness.js', '/vision-qualification-track.js', '/vision-qualification-diagnostics.js', '/vision-qualification-receipt.js', '/vision-qualification-report.js', '/vision-qualification-runtime.js']) await loadScript(src);
      sampleUrl = RAW_ROOT + productSha + '/VISION_QUALIFICATION_SAMPLE.json';
      let fetched;
      try { const response = await root.fetch(sampleUrl, { cache: 'no-store', redirect: 'error', credentials: 'omit' }); if (!response.ok) throw Error('Sample absent'); fetched = await response.json(); }
      catch { throw Error('Qualification indisponible : protocole absent pour ce build.'); }
      if (fetched.gameId !== 'cyberpunk' || fetched.locale !== 'en' || fetched.referenceCount !== 229 || fetched.sampleCount !== 15 || !Array.isArray(fetched.sample) || fetched.sample.length !== 15 || !Array.isArray(fetched.plan?.matrix)) throw Error('Protocole incompatible avec le corpus Cyberpunk EN · 229 références.');
      const finalHealthResponse = await root.fetch('/api/health', { cache: 'no-store' });
      if (!finalHealthResponse.ok || (await finalHealthResponse.json()).buildSha?.toLowerCase() !== productSha) throw Error('Le build a changé pendant la préparation. Rechargez avant de commencer une nouvelle qualification.');
      const attached = await root.TCGVisionQualificationRuntime.attach({ productSha, sampleDocument: fetched, trackSelection: 'PINNED_CANONICAL_TRACK', environment: { execution: 'RAILWAY_TEST', illumination: 'NORMAL', background: 'TABLE', sleeve: 'UNSPECIFIED' } });
      const attachedContext = attached.context();
      const loadedGate = await root.TCGVisionNominalQualificationReceipt.load({
        productSha, context: attachedContext, sampleDocument: fetched, fetchImpl: root.fetch.bind(root)
      });
      try {
        const preparedHealth = await root.fetch('/api/health', { cache: 'no-store' });
        if (!preparedHealth.ok || (await preparedHealth.json()).buildSha?.toLowerCase() !== productSha)
          throw Error('Le build a changé pendant la préparation. Rechargez avant de commencer une nouvelle qualification.');
      } catch (error) { attached.detach(); throw error; }
      q = attached; documentSample = fetched; immutableContext = attachedContext;
      nominalReceiptUrl = RAW_ROOT + productSha + '/VISION_NOMINAL_QUALIFICATION_RECEIPT.json';
      qualifiedNominalGate = loadedGate;
      if (qualifiedNominalGate.ready) selection = 'ANGLE';
      runPrefix = 'vq-' + [...root.crypto.getRandomValues(new Uint32Array(2))].map(value => value.toString(16).padStart(8, '0')).join('');
      buildSampleList(); buildConditions(); buildVariantAvailability();
      if (qualifiedNominalGate.ready) $('vqCondition').closest('details').open = true;
      $('vqStatus').textContent = 'Qualification prête'; $('vqCorpus').textContent = 'Cyberpunk · EN · 150 cartes · 229 références';
      setReady(true); setOperating(true); render(); return q;
    })();
    try { return await preparing; }
    catch (error) { fail(error); $('vqStatus').textContent = 'Qualification indisponible'; throw error; }
    finally { preparing = null; setReady(Boolean(q)); }
  }
  function buildSampleList() {
    const list = $('vqSampleList'), choices = $('vqSetupCard'); list.replaceChildren(); choices.replaceChildren();
    for (const card of documentSample.sample) {
      const li = node('li', card.name + ' · ' + card.profile.type + ' · ' + card.profile.color, list); li.dataset.sampleId = card.sampleId;
      const option = node('option', card.name, choices); option.value = card.sampleId;
    }
  }
  function buildConditions() {
    const select = $('vqCondition'); select.replaceChildren();
    for (const condition of [...new Set(buildJobs().map(job => job.condition))]) { const option = node('option', LABEL[condition], select); option.value = condition; }
  }
  function buildVariantAvailability() {
    const parent = $('vqVariantAvailability'); parent.replaceChildren();
    for (const variant of documentSample.plan.variantCases || []) {
      const group = node('fieldset', null, parent); node('legend', variant.name, group);
      for (const printing of variant.printings) {
        const label = node('label', printing.setId + ' · ' + printing.number + ' · ' + printing.variantKind, group);
        const select = node('select', null, label); select.dataset.caseId = variant.caseId; select.dataset.printingId = printing.printingId;
        for (const [value, title] of [['UNCONFIRMED', 'Disponibilité à confirmer'], ['AVAILABLE', 'Je possède cette impression'], ['UNAVAILABLE', 'Impression indisponible · NOT TESTED']]) { const option = node('option', title, select); option.value = value; }
        select.addEventListener('change', () => action(() => { if (select.value === 'UNCONFIRMED') throw Error('Choisissez disponible ou indisponible.'); q.setVariantAvailability(variant.caseId, printing.printingId, select.value); render(); }));
      }
    }
  }
  function showAlternatives() {
    const card = documentSample.sample.find(item => item.sampleId === $('vqSetupCard').value);
    const select = $('vqAlternative'); select.replaceChildren();
    for (const alternative of card.substitution.eligibleAlternatives) {
      const option = node('option', alternative.name + ' · ' + alternative.type + ' · ' + alternative.color, select); option.value = alternative.cardId + '|' + alternative.printingId;
    }
    $('vqSubstitution').hidden = false; $('vqSubstitutionLabel').textContent = 'Remplacer ' + card.name;
  }
  function applySubstitution() {
    const original = documentSample.sample.find(card => card.sampleId === $('vqSetupCard').value);
    const [replacementCardId, replacementPrintingId] = $('vqAlternative').value.split('|');
    q.setSubstitution(original.cardId, replacementCardId, replacementPrintingId);
    $('vqSubstitution').hidden = true; $('vqStatus').textContent = 'Substitution de même profil enregistrée avant les essais de cette carte.';
    render();
  }
  function classify(raw, state) {
    if (!raw) return null;
    const value = root.TCGateVisionQualification.classifyTrial(raw, immutableContext);
    if (invalidated(raw, state)) return { ...value, category: 'INVALID_TEST' };
    return value;
  }
  function showResult(raw, state = session()) {
    if (!raw) return;
    if (state.active) { $('vqResultPanel').hidden = true; $('vqInvalidate').disabled = true; return; }
    const value = raw.scene ? root.TCGateVisionQualification.classifyScene(raw, immutableContext) : classify(raw, state);
    $('vqResult').textContent = raw.scene ? (value.valid ? (value.falseIdentifications ? 'Faux positif observé' : 'Scène terminée · aucune fausse identification observée') : 'Essai invalide') : RESULT[value.category] || 'Essai enregistré';
    $('vqResult').className = value.category === 'CORRECT' ? 'good' : value.category === 'WRONG_IDENTIFICATION' ? 'error' : '';
    $('vqPrintingResult').textContent = value.printingAssessment === 'UNRESOLVED_SHARED_ART' ? (value.category === 'CORRECT' ? 'Carte correctement reconnue · impression exacte non résolue (art partagé).' : 'Impression exacte non résolue (art partagé).') : value.printingAssessment === 'UNRESOLVED_PRINTING' ? 'Impression exacte non résolue.' : '';
    const ms = n => typeof n === 'number' ? Math.round(n) + ' ms' : 'non observée';
    $('vqLatency').textContent = raw.scene ? 'Durée : ' + (value.durationMs / 1000).toFixed(1) + ' s' : 'Détection : ' + ms(value.detectionLatency) + ' · Identification : ' + ms(value.identificationLatency);
    const diagnostic = showAttemptDiagnostic(raw);
    $('vqResultDiagnostic').textContent = JSON.stringify({ ...value, identificationAttempts: diagnostic }, null, 2);
    $('vqInvalidate').disabled = Boolean(raw.scene || invalidated(raw, state));
    $('vqResultPanel').hidden = false;
    $('vqCompactResult').textContent = $('vqResult').textContent + ' · ' + $('vqLatency').textContent;
  }
  function showAttemptDiagnostic(raw) {
    const diagnostic = root.TCGVisionQualificationDiagnostics?.sanitizeTrialDiagnostics(raw, immutableContext) || { attempts: [] };
    const last = diagnostic.attempts.at(-1), score = value => typeof value === 'number' ? value.toFixed(3) : '—';
    $('vqCompactDiagnostic').textContent = last ? 'Score ' + score(last.bestScore) + ' · attendu ' + (last.expectedRank || 'hors candidats') + ' / ' + score(last.expectedScore) + ' · marge ' + score(last.margin) + ' · ' + (last.rejectionReason || (last.finalAccepted ? 'accepté' : 'en attente')) + (last.temporal?.action ? ' · ' + last.temporal.action : '') : '';
    return diagnostic;
  }
  function renderControls(activeOverride) {
    if (!q) return;
    const active = activeOverride === undefined ? q.getActiveObservation() : activeOverride;
    const neutral = active ? { ready: false } : neutralState();
    const needsNeutral = !active;
    const reset = neutral.reason === 'TRACKING_RESET_NEW_SESSION_REQUIRED' || neutral.blockers?.includes('TRACKING_RESET_NEW_SESSION_REQUIRED');
    const text = active ? 'Observation en cours' : reset ? 'Tracking réinitialisé — exportez la session puis rechargez et préparez une nouvelle session.' : neutral.ready ? 'Prêt pour l’essai suivant' : 'Retirez la carte précédente — attente de remise à zéro de Vision…';
    $('vqNeutralStatus').textContent = text;
    $('vqReturnLab').disabled = Boolean(active);
    for (const button of root.document.querySelectorAll('.workspace-sidebar [data-tab]')) button.disabled = Boolean(active) && button.dataset.tab !== 'lab';
    const tracking = active?.qualificationTracking;
    const trackingText = { WAITING_FOR_SINGLE_TRACK: 'Présentez une seule carte : sélection automatique en attente.', TRACKING: 'Carte suivie automatiquement pendant cet essai.', TRACK_LOST: 'Carte suivie perdue : aucune autre carte ne la remplace.', MULTIPLE_TRACKS: 'Plusieurs cartes visibles : aucun résultat individuel ne sera choisi.' };
    $('vqTrackingStatus').textContent = tracking ? trackingText[tracking.status] || '' : '';
    for (const id of ['vqStart', 'vqNext', 'vqRetrySwitch']) $(id).disabled = needsNeutral && !neutral.ready;
    for (const button of $('vqActions').querySelectorAll('button')) button.classList.remove('primary');
    const primary = [...$('vqActions').querySelectorAll('button')].find(button => !button.hidden);
    if (primary) primary.classList.add('primary');
    $('vqControlBar').dataset.neutralReady = String(Boolean(neutral.ready));
    $('vqControlBar').dataset.active = String(Boolean(active));
  }
  function render() {
    if (!q) return;
    const state = session(), jobs = buildJobs(state), nominal = nominalProgress(state), active = state.active;
    if (!active) sessionNominalGate = root.TCGVisionQualificationReport.nominalGate(q.exportReport());
    const nextJob = currentJob(state);
    const retryJob = pendingAdvance ? null : retrySwitchJob(nextJob, state, jobs);
    $('vqStatus').textContent = active ? 'Qualification en cours' : records(state).length ? 'Qualification en cours · observation terminée' : 'Qualification prête';
    $('vqProgress').textContent = qualifiedNominalGate.ready
      ? 'Nominal physique qualifié : ' + qualifiedNominalGate.correct + ' / ' + qualifiedNominalGate.valid + ' corrects dans la session physique d’origine. Aucun de ces essais n’a été rejoué dans cette session.'
      : 'Nominal · ' + nominal.count + ' / ' + nominal.total + ' essais — Cartes terminées · ' + nominal.cards + ' / ' + documentSample.sample.length;
    $('vqOverallProgress').value = qualifiedNominalGate.ready ? qualifiedNominalGate.valid : nominal.count; $('vqOverallProgress').max = nominal.total;
    $('vqSessionCount').textContent = state.trials.length + ' essais enregistrés · ' + state.scenes.length + ' scènes · aucun résultat supprimé';
    for (const row of $('vqSampleList').children) {
      const original = documentSample.sample.find(card => card.sampleId === row.dataset.sampleId), card = activeCard(original, state);
      row.textContent = card.name + ' · ' + card.profile.type + ' · ' + card.profile.color + (card.originalCardId ? ' (remplace ' + original.name + ')' : '');
    }
    const gate = nominalGate(state);
    $('vqComplementaryLabel').hidden = !gate.ready;
    const percent = value => typeof value === 'number' ? value.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' %' : 'NOT TESTED';
    if (qualifiedNominalGate.ready) {
      const official = qualifiedNominalGate;
      $('vqNominalGate').replaceChildren(
        root.document.createTextNode('Nominal physique qualifié · ' + official.correct + ' / ' + official.valid + ' · ' + percent(official.correctIdentificationRate) +
          ' · Mauvaises identifications : ' + percent(official.wrongIdentificationRate) + '. Conditions complémentaires débloquées. '));
      const provenance = node('a', 'Source : reçu officiel versionné', $('vqNominalGate'));
      provenance.href = nominalReceiptUrl; provenance.target = '_blank'; provenance.rel = 'noopener noreferrer';
      $('vqNominalGate').dataset.source = 'QUALIFICATION_RECEIPT';
    } else {
      $('vqNominalGate').textContent = gate.ready
        ? 'Nominal physique qualifié dans cette session. Conditions complémentaires débloquées.'
        : 'Conditions complémentaires bloquées : le nominal physique doit atteindre ≥ 95 % correct et ≤ 1 % de mauvaise identification. Reçu officiel indisponible ou incompatible (' + (qualifiedNominalGate.reasons || []).join(', ') + ').';
      $('vqNominalGate').dataset.source = gate.ready ? 'CURRENT_SESSION' : 'PENDING';
    }
    for (const option of $('vqCondition').options) option.disabled = Boolean(active) || (option.value !== 'NOMINAL' && !gate.ready);
    $('vqCondition').disabled = Boolean(active);
    $('vqCondition').value = selection;
    $('vqConsoleTitle').textContent = 'Qualification Vision 1.0 · ' + LABEL[selection];
    const remaining = jobs.filter(item => item.condition === selection && !unavailable(item, state)).length;
    const finished = jobs.filter(item => item.condition === selection && completed(item, state)).length;
    $('vqSectionProgress').textContent = LABEL[selection] + ' · ' + finished + ' / ' + remaining + ' observations';
    $('vqStart').hidden = Boolean(active) || pendingAdvance || !nextJob || Boolean(retryJob);
    $('vqStart').textContent = nextJob?.scene ? 'Démarrer les 30 secondes' : 'Démarrer l’essai';
    $('vqRetrySwitch').hidden = !retryJob;
    $('vqRetrySwitch').textContent = retryJob ? 'Recommencer A : ' + retryJob.card.name + ' — nouvel essai' : 'Nouvelle tentative A → B';
    $('vqRetrySwitchExplanation').hidden = !retryJob;
    $('vqEnd').hidden = !active || Boolean(active.scene);
    $('vqEnd').textContent = nextJob?.phase === 'A' ? 'Terminer A sans changement' : 'Terminer l’essai';
    $('vqNext').hidden = Boolean(active) || !pendingAdvance;
    const lastRaw = records(state).find(record => record.trialId === lastResultId || record.sceneId === lastResultId);
    const previousJob = lastRaw && jobs.find(item => matches(lastRaw, item));
    const job = pendingAdvance && previousJob ? previousJob : retryJob || nextJob;
    $('vqNext').textContent = lastRaw && !lastRaw.scene && classify(lastRaw, state).category === 'INVALID_TEST' ? 'Nouvelle tentative' : previousJob?.condition === 'NOMINAL' && previousJob.repetition === previousJob.total ? 'Carte suivante' : 'Essai suivant';
    $('vqCurrent').hidden = !job;
    $('vqComplete').hidden = Boolean(job) || pendingAdvance;
    $('vqComplete').textContent = selection === 'NOMINAL' ? gate.ready ? 'Nominal qualifié. Le reste de la qualification peut être repris.' : 'Nominal terminé. Exportez les preuves pour le diagnostic ; les conditions complémentaires restent bloquées.' : 'Section terminée ou indisponible. Choisissez la section suivante ; les cas indisponibles restent NOT TESTED.';
    $('vqSleeveSetup').hidden = selection !== 'SLEEVE_GLARE';
    $('vqVariantsSetup').hidden = selection !== 'SIMILAR_PRINTINGS';
    if (state.plan.sleeveAvailability) { $('vqSleeveAvailability').value = state.plan.sleeveAvailability; $('vqSleeveAvailability').disabled = true; }
    for (const select of $('vqVariantAvailability').querySelectorAll('select')) {
      const declared = state.plan.variantAvailability?.find(item => item.caseId === select.dataset.caseId && item.printingId === select.dataset.printingId);
      const observed = state.trials.some(trial => trial.expectedPrintingId === select.dataset.printingId);
      if (declared || observed) { select.value = declared?.availability || 'AVAILABLE'; select.disabled = true; }
    }
    for (const id of ['vqExportSession', 'vqReadingReport', 'vqCanonicalReport']) $(id).disabled = Boolean(active);
    const latest = active?.observations?.at(-1), recognized = latest?.identifiedCardId && latest.identifiedCardId === job?.card?.cardId;
    const stable = active && !active.scene && recognized && root.TCGateVisionQualification.classifyTrial({ ...active, endMs: Math.max(active.observations.at(-1).atMs, active.t0Ms + 0.01) }, immutableContext).stableConfirmedAtMs != null;
    const canRemove = Boolean(active && job && ['REMOVAL', 'RAPID_SWITCH'].includes(job.condition) && job.phase !== 'B');
    $('vqRemoval').hidden = !canRemove || Boolean(active.removal); $('vqRemoval').disabled = !stable;
    $('vqSwitch').hidden = !active || job?.phase !== 'A' || !active.removal;
    $('vqSwitch').disabled = !active?.removal || active.removal.clearAtMs == null;
    if (job) {
      const sampleIndex = documentSample.sample.findIndex(card => card.sampleId === job.card?.sampleId);
      $('vqPosition').textContent = job.scene ? 'Scène ' + (documentSample.plan.requiredScenes.findIndex(scene => scene.scene === job.scene) + 1) + ' / ' + documentSample.plan.requiredScenes.length : sampleIndex >= 0 ? 'Carte ' + (sampleIndex + 1) + ' / ' + documentSample.sample.length : 'Carte du sous-échantillon';
      $('vqCardName').textContent = job.scene ? SCENE[job.scene] : job.card.name;
      $('vqCardMeta').textContent = job.scene ? 'Aucune carte cible visible pendant toute la scène.' : [job.card.profile?.type, job.card.profile?.color, job.printing ? job.printing.setId + ' · ' + job.printing.number + ' · ' + job.printing.variantKind : null].filter(Boolean).join(' · ');
      $('vqTrialLabel').textContent = [POSITION[job.position] || LABEL[job.condition], job.phase ? 'Carte ' + job.phase : null, job.repetition ? 'Essai ' + job.repetition + ' / ' + job.total + (pendingAdvance ? ' terminé' : '') : null].filter(Boolean).join(' · ');
      $('vqCameraCard').textContent = [job.card?.name || SCENE[job.scene], $('vqPosition').textContent, $('vqTrialLabel').textContent].filter(Boolean).join(' · ');
      $('vqCompactCard').textContent = job.card?.name || SCENE[job.scene];
      $('vqCompactTrial').textContent = $('vqPosition').textContent + ' · ' + $('vqTrialLabel').textContent;
      $('vqSelectionReason').textContent = job.card?.selectionReason || '';
      $('vqCardDiagnostic').textContent = JSON.stringify({ testedBuildSha: productSha, sampleUrl, cardId: job.card?.cardId, printingId: job.card?.printingId, condition: job.condition, position: job.position, variantCase: job.variant?.caseId, pairId: job.pairId, jobKey: job.key, activeTrialId: active?.trialId, substitution: state.plan.substitutions?.find(item => item.originalCardId === job.card?.originalCardId) || null }, null, 2);
      $('vqInstruction').textContent = pendingAdvance ? 'Essai enregistré. Retirez la carte et attendez le retour à une scène vide avant de poursuivre.' : instructions(job, active, Boolean(stable));
      if (job.card?.sampleId && !pendingAdvance && !active) $('vqSetupCard').value = job.card.sampleId;
    }
    if (!active) { $('vqTimer').textContent = pendingAdvance ? 'Observation terminée' : 'Aucune observation active'; $('vqTrialProgress').value = pendingAdvance ? $('vqTrialProgress').max : 0; }
    if (lastRaw) showResult(lastRaw, state);
    $('vqCompactProgress').textContent = qualifiedNominalGate.ready
      ? 'Nominal physique qualifié · ' + qualifiedNominalGate.correct + ' / ' + qualifiedNominalGate.valid + ' · ' + percent(qualifiedNominalGate.correctIdentificationRate) + ' · Conditions complémentaires débloquées'
      : 'Nominal ' + nominal.count + ' / ' + nominal.total + ' essais · Cartes ' + nominal.cards + ' / ' + documentSample.sample.length;
    const rate = value => typeof value === 'number' ? (value * 100).toFixed(1) + ' %' : 'NOT TESTED';
    const baseline = gate.previousCampaign || gate.baseline;
    $('vqBaselineComparison').textContent = (baseline?.valid ? (gate.previousCampaign ? '6B FAIL' : 'Baseline FAIL') + ' : correct ' + rate(baseline.correct / baseline.valid) + ' · erreur ' + rate(baseline.wrong / baseline.valid) + ' — ' : '') +
      (qualifiedNominalGate.ready ? 'Preuve nominale ' + qualifiedNominalGate.receipt.sourcePhysicalProductSha.slice(0, 7) + ' conservée : ' : 'Nouvelle : ') +
      (gate.valid ? 'correct ' + rate(gate.correct / gate.valid) + ' · erreur ' + rate(gate.wrong / gate.valid) : 'NOT TESTED');
    $('vqBaselineHistory').textContent = (gate.baselines || [gate.baseline]).filter(Boolean).map(item => item.productSha.slice(0, 8) + ' · ' + item.trials + ' essais / ' + item.valid + ' valides · correct ' + rate(item.correct / item.valid) + ' · erreur ' + rate(item.wrong / item.valid)).join(' | ');
    renderControls();
    const errors = active?.observations?.at(-1)?.validityErrors || [];
    if (errors.length) fail('Runtime : ' + errors.join(' · '));
  }
  function instructions(job, active, stable) {
    if (job.scene) return 'Préparez la scène « ' + SCENE[job.scene] + ' », sans carte cible. Observez 30 secondes ; l’arrêt sera automatique.';
    if (job.condition === 'REMOVAL' || job.phase === 'A') return active?.removal ? active.removal.clearAtMs == null ? 'Retirez la carte immédiatement. Le retour à l’état vide est mesuré.' : job.phase === 'A' ? 'Carte A effacée. Cliquez « Présenter la carte B », puis présentez B immédiatement.' : 'Retour à l’état vide observé. Vous pouvez terminer l’essai.' : stable ? 'Carte identifiée. Cliquez « Retirer la carte », puis retirez-la immédiatement.' : '1. Présentez la carte. 2. Attendez son identification stable. 3. Cliquez « Retirer la carte ». 4. Retirez-la immédiatement.';
    if (job.condition === 'STABILITY') return 'Maintenez cette carte visible pendant 10 secondes. Le chronométrage et l’arrêt sont automatiques.';
    if (job.phase === 'B') return 'Présentez la carte B à la caméra. Son identification est mesurée séparément du retrait de A.';
    if (job.position) return 'Présentez la carte à la caméra : ' + POSITION[job.position].toLowerCase() + '. Gardez les autres conditions nominales.';
    if (job.condition === 'LOW_LIGHT') return 'Présentez la carte dans une lumière plus faible, encore jouable, à distance nominale.';
    if (job.condition === 'SLEEVE_GLARE') return 'Utilisez une vraie sleeve de jeu. Présentez la carte avec ses reflets réels ; aucune sleeve disponible doit rester NOT TESTED.';
    return 'Démarrez avant de présenter la carte. Présentez la carte à la caméra pendant la fenêtre conseillée de 10 secondes. Revenez à une scène vide entre les essais.';
  }
  function spec(job, state = session()) {
    const attempt = records(state).filter(record => matches(record, job)).length + 1;
    const common = { trialId: job.key + '-attempt-' + attempt, mode: 'physical', physicalConfirmation: root.TCGVisionQualificationRuntime.physicalConfirmation };
    if (job.scene) return { ...common, sceneId: common.trialId, scene: job.scene };
    return { ...common, condition: job.condition, expectedCardId: job.card.cardId, expectedPrintingId: job.card.printingId, notes: job.notes || [] };
  }
  function armTimer(job) {
    root.clearTimeout(autoStop);
    activeJob = job;
    activeDeadline = job.condition === 'STABILITY' ? null : q.getActiveObservation().t0Ms + job.durationMs;
    if (job.scene || job.condition === 'STABILITY') {
      scheduleStop();
    }
    render(); tick();
  }
  function scheduleStop() {
    if (activeDeadline == null) return;
    const expectedTrialId = q.getActiveObservation()?.trialId;
    const stopWhenDue = () => { if (q.getActiveObservation()?.trialId !== expectedTrialId) return; const remaining = activeDeadline - root.performance.now(); if (remaining > 0) autoStop = root.setTimeout(stopWhenDue, remaining); else action(() => endObservation(true)); };
    autoStop = root.setTimeout(stopWhenDue, Math.max(0, activeDeadline - root.performance.now()));
  }
  function startObservation() {
    const state = session(), job = currentJob(state);
    if (!job || state.active || pendingAdvance) return;
    if (selection !== 'NOMINAL' && !nominalGate(state).ready) throw Error('Les conditions complémentaires restent bloquées : le nominal physique doit être qualifié avant de poursuivre.');
    if (job.variant && !state.trials.some(trial => trial.expectedPrintingId === job.printing.printingId) && !state.plan.variantAvailability?.some(item => item.caseId === job.variant.caseId && item.printingId === job.printing.printingId && item.availability === 'AVAILABLE')) throw Error('Confirmez la disponibilité de cette impression avant l’essai.');
    if (job.condition === 'SLEEVE_GLARE' && state.plan.sleeveAvailability !== 'AVAILABLE') throw Error('Indiquez si vous possédez une vraie sleeve avant cet essai.');
    if (job.phase === 'B') {
      const previous = state.trials.filter(raw => raw.trialId.startsWith(job.previousKey + '-attempt-')).at(-1);
      if (previous?.removal?.clearAtMs == null) throw Error('Le changement A → B exige un retrait de A puis un retour réel à l’état vide. Utilisez « Recommencer A » pour ajouter une nouvelle tentative en conservant le résultat précédent, ou choisissez une autre section.');
      q.startTrial({ ...spec(job, state), previousTrialId: previous.trialId });
    } else if (job.scene) q.startScene(spec(job, state));
    else q.startTrial(spec(job, state));
    $('vqResultPanel').hidden = true; $('vqCompactResult').textContent = ''; $('vqCompactDiagnostic').textContent = ''; armTimer(job);
  }
  function endObservation(automatic = false) {
    const state = session(), active = state.active, job = currentJob(state); if (!active) return;
    root.clearTimeout(autoStop);
    const raw = active.scene ? q.endScene() : q.endTrial();
    lastResultId = raw.sceneId || raw.trialId; pendingAdvance = true;
    $('vqStatus').textContent = automatic ? 'Observation arrêtée automatiquement' : 'Observation terminée'; render();
  }
  function rapidSwitch() {
    const state = session(), a = currentJob(state);
    if (!a || a.phase !== 'A' || !state.active?.removal || state.active.removal.clearAtMs == null) throw Error('Attendez le retour réel à l’état vide avant B.');
    const b = buildJobs(state).find(job => job.previousKey === a.key);
    const result = q.switchTrial(spec(b, state));
    lastResultId = result.previous.trialId; pendingAdvance = false; armTimer(b);
  }
  function retrySwitch() {
    const state = session();
    if (state.active || pendingAdvance) return;
    const a = retrySwitchJob(currentJob(state), state);
    if (!a) throw Error('Une nouvelle tentative de A est proposée seulement quand son retrait ou son retour à l’état vide manque.');
    q.startTrial(spec(a, state));
    pendingAdvance = false; $('vqResultPanel').hidden = true; armTimer(a);
  }
  function tick() {
    if (!q) return;
    const active = q.getActiveObservation(), job = activeJob;
    renderControls(active);
    if (!active || !job || !matches(active, job)) return;
    if (job.condition === 'STABILITY' && activeDeadline == null) {
      const firstDetected = active.observations.find(observation => observation.detected);
      if (firstDetected) { activeDeadline = firstDetected.atMs + job.durationMs; scheduleStop(); }
      else $('vqTimer').textContent = 'En attente de détection · maintien de 10 secondes ensuite';
    }
    if (activeDeadline != null) {
      const remaining = Math.max(0, activeDeadline - root.performance.now()), total = job.durationMs;
      $('vqTimer').textContent = String(Math.floor(Math.ceil(remaining / 1000) / 60)).padStart(2, '0') + ':' + String(Math.ceil(remaining / 1000) % 60).padStart(2, '0') + (remaining === 0 && !active.scene ? ' · fenêtre atteinte' : '');
      $('vqTrialProgress').max = total; $('vqTrialProgress').value = Math.min(total, total - remaining);
    }
    renderLive(active, job);
  }
  function renderLive(active, job) {
    showAttemptDiagnostic(active);
    const latest = active.observations?.at(-1);
    const classified = active.scene ? null : root.TCGateVisionQualification.classifyTrial({ ...active, endMs: Math.max(active.observations.at(-1).atMs, active.t0Ms + 0.01) }, immutableContext);
    const stable = latest?.identifiedCardId === job.card?.cardId && classified?.stableConfirmedAtMs != null;
    const canRemove = ['REMOVAL', 'RAPID_SWITCH'].includes(job.condition) && job.phase !== 'B';
    $('vqRemoval').hidden = !canRemove || Boolean(active.removal); $('vqRemoval').disabled = !stable;
    $('vqSwitch').hidden = job.phase !== 'A' || !active.removal; $('vqSwitch').disabled = active.removal?.clearAtMs == null;
    $('vqInstruction').textContent = instructions(job, active, Boolean(stable));
    if (latest?.validityErrors?.length) fail('Runtime : ' + latest.validityErrors.join(' · '));
  }
  function download(name, payload) {
    const url = root.URL.createObjectURL(new root.Blob([payload], { type: 'application/json' }));
    const anchor = node('a'); anchor.href = url; anchor.download = name; anchor.click(); root.setTimeout(() => root.URL.revokeObjectURL(url), 1000);
  }
  function generateReport(sessions = [q.getSession(), ...importedSessions], indexes = importedIndexes) {
    return root.TCGVisionQualificationReport.generate({ productSha, sampleProductSha: productSha, references: immutableContext.references, sampleDocument: documentSample, sessions, indexInputs: indexes,
      ...(qualifiedNominalGate.ready ? { qualifiedNominalReceipt: qualifiedNominalGate.receipt,
        qualifiedBuildCompatibility: qualifiedNominalGate.compatibility } : {}) });
  }
  async function canonicalReport() {
    const response = await root.fetch('/api/health', { cache: 'no-store' });
    if (!response.ok || (await response.json()).buildSha?.toLowerCase() !== productSha) throw Error('Le build a changé ou ne peut plus être vérifié. Exportez la session et rechargez avant une nouvelle qualification.');
    const report = generateReport();
    download('vision-qualification-1.0.json', root.TCGVisionQualificationReport.stableStringify(report));
  }
  async function importReportInputs() {
    if (session().active) throw Error('Terminez l’observation active avant d’importer des preuves.');
    const files = [...$('vqImportInputs').files];
    if (files.length > 20 || importedSessions.length + importedIndexes.length + files.length > 20) throw Error('Maximum de 20 fichiers de preuves importés.');
    const sessions = [], indexes = [];
    for (const file of files) {
      if (file.size > 32 * 1024 * 1024) throw Error('Fichier trop volumineux (maximum 32 Mio).');
      const value = JSON.parse(await file.text());
      if (Array.isArray(value.trials) && Array.isArray(value.scenes)) sessions.push(value);
      else if (Array.isArray(value.indexMeasurements)) indexes.push(value);
      else throw Error('Ce fichier n’est pas une session ou une mesure d’index de qualification.');
    }
    generateReport([q.getSession(), ...importedSessions, ...sessions], [...importedIndexes, ...indexes]);
    importedSessions.push(...sessions); importedIndexes.push(...indexes);
    $('vqImportStatus').textContent = importedSessions.length + ' sessions et ' + importedIndexes.length + ' fichiers d’index ajoutés au rapport uniquement. Progression de la session actuelle inchangée.';
    $('vqImportInputs').value = '';
  }
  async function recordIndex() {
    const result = await q.recordIndexMeasurement($('vqIndexKind').value);
    $('vqIndexStatus').textContent = 'Initialisation réelle enregistrée une fois · ' + result.kind + ' · ' + Math.round(result.descriptorBuildMs) + ' ms. Les 3 mesures à froid et 3 après rechargement restent nécessaires.';
  }
  function action(fn) { clearError(); try { const result = fn(); if (result?.then) result.catch(fail); } catch (error) { fail(error); } }
  $('vqPrepare').addEventListener('click', () => action(prepare));
  $('vqResume').addEventListener('click', () => setOperating(true));
  $('vqReturnLab').addEventListener('click', () => action(() => { setOperating(false); $('vqResume').focus({ preventScroll: true }); }));
  $('vqStart').addEventListener('click', () => action(startObservation));
  $('vqEnd').addEventListener('click', () => action(() => endObservation()));
  $('vqNext').addEventListener('click', () => action(() => { if (!neutralState().ready) throw Error('Attendez la remise à zéro de Vision avant l’essai suivant.'); pendingAdvance = false; render(); }));
  $('vqUnavailable').addEventListener('click', () => action(showAlternatives));
  $('vqApplySubstitution').addEventListener('click', () => action(applySubstitution));
  $('vqSetupCard').addEventListener('change', () => { $('vqSubstitution').hidden = true; });
  $('vqCondition').addEventListener('change', () => action(() => { if (session().active) throw Error('Terminez l’observation active avant de changer de section.'); if ($('vqCondition').value !== 'NOMINAL' && !nominalGate(session()).ready) { $('vqCondition').value = selection; throw Error('Le nominal physique doit être qualifié avant toute condition complémentaire.'); } selection = $('vqCondition').value; pendingAdvance = false; render(); }));
  $('vqSleeveAvailability').addEventListener('change', () => action(() => { if ($('vqSleeveAvailability').value === 'UNCONFIRMED') throw Error('Choisissez disponible ou indisponible.'); q.setSleeveAvailability($('vqSleeveAvailability').value); render(); }));
  $('vqRemoval').addEventListener('click', () => action(() => { q.markRemoval(); render(); }));
  $('vqSwitch').addEventListener('click', () => action(rapidSwitch));
  $('vqRetrySwitch').addEventListener('click', () => action(retrySwitch));
  $('vqInvalidate').addEventListener('click', () => action(() => { q.invalidateTrial(lastResultId, 'OPERATOR_PROTOCOL_ERROR'); pendingAdvance = true; render(); }));
  $('vqExportSession').addEventListener('click', () => action(() => q.saveSession()));
  $('vqReadingReport').addEventListener('click', () => action(() => download('vision-qualification-reading-report.json', q.exportJson())));
  $('vqCanonicalReport').addEventListener('click', () => action(canonicalReport));
  $('vqImportInputs').addEventListener('change', () => action(importReportInputs));
  $('vqRecordIndex').addEventListener('click', () => action(recordIndex));
  root.addEventListener('beforeunload', event => { if (!q) return; const state = session(); if (state.active || records(state).length || state.indexMeasurements.length || importedSessions.length || importedIndexes.length) { event.preventDefault(); event.returnValue = ''; } });
  root.document.addEventListener('keydown', event => {
    if (operating && event.key === 'Tab') {
      const focusable = [...$('vqWorkflow').querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],summary,[tabindex="0"]')].filter(element => element.getClientRects().length);
      const first = focusable[0], last = focusable.at(-1), focused = root.document.activeElement;
      if (first && ((event.shiftKey && (focused === first || focused === $('vqWorkflow'))) || (!event.shiftKey && (focused === last || !$( 'vqWorkflow').contains(focused))))) {
        event.preventDefault(); (event.shiftKey ? last : first).focus({ preventScroll: true });
      }
    }
    if (!operating || event.code !== 'Space' || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.defaultPrevented) return;
    if (event.target?.closest?.('input,select,textarea,button,a,summary,[contenteditable="true"],[role="textbox"]')) return;
    // A waiting/disabled primary action must not turn Space into page scrolling.
    event.preventDefault();
    const button = $('vqActions').querySelector('button.primary:not([hidden]):not(:disabled)');
    if (button) button.click();
  });
  buildStation();
  new root.MutationObserver(() => { if (operating && $('panel-lab').hidden) setOperating(false); setLabVisible(); }).observe($('panel-lab'), { attributes: true, attributeFilter: ['hidden'] });
  root.setInterval(tick, 100);
  root.TCGWorkspaceVisionQualification = Object.freeze({ prepare, getState: () => ({ productSha, sampleUrl, prepared: Boolean(q), preparing: Boolean(preparing), operating, currentJob: currentJob(), session: session(), neutral: q ? neutralState() : null, nominalGate: q ? nominalGate(session()) : null,
    sessionNominalGate: q ? sessionNominalGate : null, qualifiedNominalGate: q ? qualifiedNominalGate : null,
    nominalReceiptUrl, lastError }) });
})(typeof window !== 'undefined' ? window : globalThis);
