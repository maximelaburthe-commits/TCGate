'use strict';
(() => {
  const phases = { RELIABILITY: 'Fiabilit\u00e9', STABILITY: 'Stabilit\u00e9', TRANSITION: 'Retrait et remplacement', ROBUSTNESS: 'Robustesse ordinaire', NEGATIVE: 'Sc\u00e8nes n\u00e9gatives', LATENCY: 'D\u00e9lai apr\u00e8s survol', FREE_PLAY: 'Partie spontan\u00e9e' };
  const scenes = { EMPTY_TABLE: 'Table vide', PLAYMAT: 'Playmat seul', VISIBLE_HAND: 'Main visible', CLOSED_PACK_OR_CARD_BACKS: 'Paquet ferm\u00e9 / dos visibles', DESK_OBJECTS: 'Objets de bureau' };
  const situations = { USUAL_SLEEVE: 'Sleeve habituelle', USUAL_GLARE: 'Reflet habituel r\u00e9ellement pr\u00e9sent', NATURAL_ORIENTATION: 'Orientation naturelle' };
  const $ = id => document.getElementById(id);
  let profile, session, observer, context, baseline, selection, jobs = [], jobIndex = 0, paused = false, exported = true, stopped = false, startedAt = null;
  let campaignVersion = 0, exportVersion = 0, pending = false, lastContextError = null, renderFrame = null;
  const shell = document.createElement('aside'); shell.id = 'vrg-panel'; shell.setAttribute('aria-label', 'Campagne Vision en jeu r\u00e9el');
  shell.innerHTML = `<details id="vrg-open"><summary>Campagne Vision en jeu r\u00e9el <span id="vrg-badge">non d\u00e9marr\u00e9e</span></summary><div class="vrg-body">
    <h2>Vision en jeu r\u00e9el</h2><p>Fiabilit\u00e9, stabilit\u00e9, puis confort de r\u00e9ponse. L'observation est passive : seuls vos survols habituels consultent Vision.</p>
    <p id="vrg-status" role="status" aria-live="polite">Cr\u00e9ez ou rejoignez une partie Cyberpunk EN avec un partenaire. Activez vos appareils, puis chacun clique Je suis pr\u00eat. Attendez la vid\u00e9o adverse et Vision pr\u00eate.</p>
    <p id="vrg-nominal">Nominal historique : v\u00e9rification lors de la pr\u00e9paration. Ses 45 essais ne sont jamais ajout\u00e9s \u00e0 cette campagne.</p>
    <section id="vrg-setup"><h3>1. Installation et cartes</h3>
      <p>Le pr\u00e9sentateur manipule ses cartes ; le consultant utilise cette page et survole la vid\u00e9o adverse. Choisissez librement le cadrage, puis gardez cam\u00e9ra et \u00e9clairage fixes.</p>
      <label><input id="vrg-framing" type="checkbox"> J'ai valid\u00e9 le cadrage depuis la vid\u00e9o re\u00e7ue ; l'installation restera fixe.</label>
      <label><input id="vrg-corpus" type="checkbox"> J'ai v\u00e9rifi\u00e9 les cartes physiques et leurs impressions EN.</label>
      <label>Origine de cette session<select id="vrg-provenance"><option value="physical">Essais physiques \u00e0 r\u00e9aliser par le testeur</option><option value="automated">Test automatis\u00e9 / synth\u00e9tique (aucune qualification physique)</option></select></label>
      <label>\u00c9clairage<select id="vrg-light"><option value="ordinary">Habituel, stable</option><option value="variable">Variable : \u00e0 consigner comme limite</option></select></label>
      <details><summary>Disponibilit\u00e9 et s\u00e9lection des dix cartes avant la campagne</summary><p>Une carte absente reste indisponible. Toute substitution doit \u00eatre choisie et son impression v\u00e9rifi\u00e9e avant le d\u00e9but, jamais apr\u00e8s un \u00e9chec.</p><div id="vrg-cards"></div></details>
      <button id="vrg-prepare" type="button">V\u00e9rifier le jeu et pr\u00e9parer la campagne</button>
    </section>
    <section id="vrg-campaign" hidden><h3>2. Observations en partie</h3><label>Phase<select id="vrg-phase"></select></label><label>Observation pr\u00e9vue<select id="vrg-job"></select></label>
      <p id="vrg-instruction"></p><p id="vrg-counter" role="status"></p><p id="vrg-limits" class="vrg-warning"></p><div id="vrg-free-target" hidden><label>Carte attendue pour les prochains survols (facultatif)<select id="vrg-target"></select></label><button id="vrg-declare-target" type="button">D\u00e9clarer la nouvelle carte attendue</button><p>Choisissez avant la consultation, uniquement si cela ne perturbe pas le tour. Sans d\u00e9claration, identit\u00e9 correcte ou erron\u00e9e reste non \u00e9valuable pour cette consultation.</p></div>
      <div class="vrg-actions"><button id="vrg-start" type="button">D\u00e9marrer l'observation</button><button id="vrg-present" type="button" disabled>Carte pr\u00e9sente dans la vid\u00e9o re\u00e7ue</button><button id="vrg-removed" type="button" disabled>Carte retir\u00e9e / sc\u00e8ne vide</button><button id="vrg-end" type="button" disabled>Terminer cette observation</button></div>
      <p>Ne cliquez pas sur la vid\u00e9o pour mesurer : survolez naturellement la carte. Un aper\u00e7u conserv\u00e9 ne confirme pas une identit\u00e9 actuelle. Retirez le pointeur avant chaque nouvelle pr\u00e9sentation.</p>
      <label>Incident / ressenti<select id="vrg-incident"><option value="VIDEO_FREEZE">Vid\u00e9o fig\u00e9e</option><option value="UI_STALL">Interface bloqu\u00e9e</option><option value="UNEXPECTED_IDENTITY">Mauvaise identit\u00e9 suspect\u00e9e</option><option value="IDENTITY_LOSS">Perte d'identit\u00e9 suspect\u00e9e</option><option value="NO_DISCOMFORT">Ne g\u00eane pas le tour</option><option value="NOTICEABLE_DELAY">G\u00eane perceptible</option><option value="TURN_INTERRUPTED">Interrompt une d\u00e9cision</option><option value="INSTALLATION_CHANGED">Installation modifi\u00e9e</option><option value="CONDITION_UNAVAILABLE">Situation indisponible (sleeve/reflet, etc.)</option><option value="PROTOCOL_ERROR">Erreur de manipulation</option></select></label>
      <button id="vrg-add-incident" type="button">Consigner ce constat</button><div class="vrg-actions"><button id="vrg-pause" type="button">Mettre en pause</button><button id="vrg-finish" type="button">Cl\u00f4turer la campagne</button></div>
    </section>
    <div class="vrg-actions"><button id="vrg-export" type="button" disabled>T\u00e9l\u00e9charger le JSON local</button><button id="vrg-new-segment" type="button" hidden disabled>Pr\u00e9parer un nouveau segment</button></div>
    <p class="vrg-warning">Exportez apr\u00e8s chaque phase et avant de recharger ou quitter. Aucune sauvegarde automatique. Le JSON contient uniquement des mesures et identifiants de cartes, aucun m\u00e9dia ni nom de joueur. Une session partielle reste exportable. Aucune r\u00e9ussite physique n'est d\u00e9clar\u00e9e automatiquement.</p>
    <p>La vitesse est descriptive, sans seuil bloquant. Angles extr\u00eames, distances syst\u00e9matiques et optimisation moteur sont hors de ce profil.</p>
    <a href="/vision-real-game-guide.html" target="_blank" rel="noopener">Guide complet de la campagne</a>
  </div></details>`;
  document.body.append(shell);
  function status(text, error = false) { $('vrg-status').textContent = text; $('vrg-status').classList.toggle('vrg-error', error); }
  function active() { return session?.getState()?.activeObservation || null; }
  function dirty() { exported = false; }
  function seconds(ms) { return Math.max(0, Math.round(Number(ms || 0) / 1000)); }
  function label(job) { return `${phases[job.phase] || job.phase} \u00b7 ${job.label || scenes[job.negativeScene] || job.negativeScene || 'Usage spontan\u00e9'}${job.stage ? ' \u00b7 ' + job.stage : ''}${job.consultationOrdinal ? ' \u00b7 survol ' + job.consultationOrdinal : ''}${job.delayBeforeHoverMs != null ? ' \u00b7 attente ' + seconds(job.delayBeforeHoverMs) + ' s' : ''}`; }
  function describe(job) {
    if (!job) return '';
    if (job.available === false) return 'Cette carte a \u00e9t\u00e9 d\u00e9clar\u00e9e indisponible avant la campagne. Ne simulez pas sa pr\u00e9sentation. Si vous consignez cette fen\u00eatre, elle reste indisponible et hors du d\u00e9nominateur exploitable.';
    const duration = seconds(job.durationMs);
    const normal = `Pr\u00e9sentez ${job.label || job.expectedCardId}. Quand la carte est visible dans le flux re\u00e7u, cliquez Carte pr\u00e9sente puis survolez-la normalement. `;
    if (job.phase === 'NEGATIVE') return `Pr\u00e9parez ${scenes[job.negativeScene] || job.negativeScene} sans face de carte cible. D\u00e9marrez, confirmez Carte retir\u00e9e / sc\u00e8ne vide et observez ${duration} s. Survolez naturellement les emplacements possibles. Un ancien aper\u00e7u ne prouve pas un faux positif. `;
    if (job.phase === 'FREE_PLAY') return `D\u00e9marrez puis jouez normalement 20 \u00e0 30 minutes. Survolez les cartes adverses uniquement lorsqu'une vraie question se pose. Aucun quota. Signalez les perturbations \u00e0 une pause naturelle. Les cartes attendues non d\u00e9clar\u00e9es restent non \u00e9valuables automatiquement.`;
    if (job.phase === 'STABILITY') return normal + `Observez environ 20 s continues apr\u00e8s un premier affichage correct, sans d\u00e9placer la carte. Si aucune acquisition correcte n'arrive, conservez ce constat. Le temps r\u00e9el et les pertes natives seront rapport\u00e9s, sans assimiler l'aper\u00e7u conserv\u00e9 \u00e0 une confirmation.`;
    if (job.phase === 'TRANSITION') return normal + (job.stage === 'A' ? `A est la pr\u00e9condition : apr\u00e8s consultation, retirez A, confirmez la sc\u00e8ne vide et sortez le pointeur. Terminez A puis choisissez B de la m\u00eame s\u00e9quence.` : `B suit A, son retrait et un intervalle vide observ\u00e9. Le pointeur doit \u00eatre sorti avant de pr\u00e9senter B. Observez environ ${duration} s. Une A jamais acquise reste une pr\u00e9condition manquante.`);
    if (job.phase === 'LATENCY') return normal + `Pour cette consultation ${job.consultationOrdinal || 1}, ${job.consultationOrdinal === 2 ? 'ne refaites pas l\u2019attente de pr\u00e9sentation. ' : 'gardez le pointeur hors vid\u00e9o et attendez ' + seconds(job.delayBeforeHoverMs) + ' s depuis la pr\u00e9sence visible avant de survoler. '}${job.consultationOrdinal === 2 ? 'Conservez la m\u00eame carte : sortez puis remettez le pointeur une fois, sans vider le cache.' : 'Le premier survol ne signifie pas cache froid ; une identit\u00e9 peut d\u00e9j\u00e0 exister.'} La latence commence au survol effectif, pas au bouton.`;
    return normal + `Observez environ ${duration} s${job.phase === 'ROBUSTNESS' ? ' dans la situation ' + (situations[job.condition] || situations[job.situation] || job.situation || job.condition || 'ordinaire pr\u00e9vue') : ''}. Ne repositionnez pas pour forcer un succ\u00e8s. Consignez une situation indisponible ; ne l'inventez pas.`;
  }
  function refreshJobs(phase) {
    const values = [...new Set(jobs.map(job => job.phase))]; $('vrg-phase').replaceChildren(...values.map(value => new Option(phases[value] || value, value)));
    $('vrg-phase').value = phase || jobs[jobIndex]?.phase || values[0];
    $('vrg-job').replaceChildren(...jobs.map((job, index) => ({ job, index })).filter(row => row.job.phase === $('vrg-phase').value).map(row => new Option(`${row.index + 1}. ${label(row.job)}`, String(row.index))));
    if (jobs[jobIndex]?.phase === $('vrg-phase').value) $('vrg-job').value = String(jobIndex); else jobIndex = Number($('vrg-job').value);
    $('vrg-instruction').textContent = describe(jobs[jobIndex]);
  }
  function render() {
    const a = active(), running = Boolean(a && !paused && !stopped);
    $('vrg-free-target').hidden = jobs[jobIndex]?.phase !== 'FREE_PLAY'; $('vrg-declare-target').disabled = !running;
    $('vrg-start').disabled = !session || Boolean(a) || paused || stopped || pending;
    for (const id of ['vrg-present', 'vrg-removed', 'vrg-end']) $(id).disabled = !running;
    $('vrg-job').disabled = Boolean(a) || stopped; $('vrg-phase').disabled = Boolean(a) || stopped;
    $('vrg-pause').disabled = stopped; $('vrg-pause').textContent = paused ? 'Reprendre l\u2019observation' : 'Mettre en pause'; $('vrg-finish').disabled = stopped;
    $('vrg-export').disabled = !session; $('vrg-new-segment').hidden = !stopped; $('vrg-new-segment').disabled = !stopped || !exported; $('vrg-add-incident').disabled = !session || stopped;
    const info = session?.getState();
    $('vrg-badge').textContent = stopped ? 'cl\u00f4tur\u00e9e' : paused ? 'en pause' : session ? 'pr\u00eate' : 'non d\u00e9marr\u00e9e';
    if (info) $('vrg-limits').textContent = info.limits.truncated ? 'Limite du journal atteinte : export partiel, donn\u00e9es manquantes signal\u00e9es. Exportez, cl\u00f4turez puis commencez un nouveau segment. Ne poursuivez pas ce journal partiel ; il ne permet aucune conclusion compl\u00e8te.' : `Journal born\u00e9 : ${info.limits.maxEvents} \u00e9v\u00e9nements, ${info.limits.maxConsultations} consultations, ${info.limits.maxObservations} fen\u00eatres. Exportez r\u00e9guli\u00e8rement.`;
    if (info) $('vrg-counter').textContent = `${info.observationsCompleted || 0} observations termin\u00e9es \u00b7 ${info.consultationsRecorded || 0} consultations r\u00e9elles${a ? ' \u00b7 ' + seconds(performance.now() - startedAt) + ' s dans cette observation' : ''}. Pr\u00e9vues : ${jobs.length} fen\u00eatres ; non faites et interrompues restent visibles.`;
  }
  function scheduleRender() { if (!$('vrg-open').open || renderFrame !== null) return; renderFrame = requestAnimationFrame(() => { renderFrame = null; render(); }); }
  function onEvent(event) {
    if (!session || stopped || paused) return;
    session.observe(event); dirty();
    if (event.kind === 'CONTEXT_INVALIDATED') {
      if (active()) session.endObservation('CONTEXT_CHANGED'); observer?.stop(); paused = true; lastContextError = true;
      status('Contexte de jeu, corpus ou build modifi\u00e9. Observation interrompue : exportez ce segment. Aucune poursuite dans un contexte diff\u00e9rent.', true);
    }
    scheduleRender();
  }
  function selectionRows(refs) {
    const unique = new Map(); for (const ref of refs) { if (ref.cardId && (ref.printingId || ref.referencePrintingId)) unique.set(ref.cardId + '|' + (ref.printingId || ref.referencePrintingId), ref); }
    $('vrg-cards').replaceChildren(...profile.cards.map(card => {
      const row = document.createElement('div'); row.className = 'vrg-card';
      const available = document.createElement('input'); available.type = 'checkbox'; available.checked = true; available.id = 'vrg-available-' + card.id;
      const text = document.createElement('label'); text.htmlFor = available.id; text.append(available, document.createTextNode(card.id + ' disponible'));
      const select = document.createElement('select'); select.id = 'vrg-card-' + card.id; select.setAttribute('aria-label', 'Carte et impression ' + card.id);
      for (const ref of unique.values()) select.add(new Option(`${ref.name || ref.cardId} \u00b7 ${ref.printingId || ref.referencePrintingId}`, ref.cardId + '|' + (ref.printingId || ref.referencePrintingId)));
      const expected = card.cardId + '|' + card.printingId;
      if (![...select.options].some(option => option.value === expected)) { select.add(new Option(card.label + ' \u00b7 impression absente du corpus actif', expected)); available.checked = false; }
      select.value = expected; row.append(text, select); return row;
    }));
  }
  async function prepare() {
    if (pending || session) return;
    if (!$('vrg-framing').checked || !$('vrg-corpus').checked) { status('Confirmez le cadrage re\u00e7u et la v\u00e9rification des impressions avant de pr\u00e9parer.', true); return; }
    pending = true; $('vrg-prepare').disabled = true; status('V\u00e9rification du jeu normal, du build et du nominal historique\u2026');
    try {
      const health = await fetch('/api/health', { cache: 'no-store' }).then(response => { if (!response.ok) throw Error('Version du serveur indisponible'); return response.json(); });
      const productSha = health.buildSha || health.gitCommitSha || health.commitSha;
      context = await window.TCGVisionRealGameObserver.readContext({ targetWindow: window, productSha });
      if (!context?.ready && context?.ready !== undefined) throw Error((context.reasons || ['Vision normale non pr\u00eate']).join(' ; '));
      if (!profile) profile = await fetch('/vision-real-game-profile.json', { cache: 'no-store' }).then(response => { if (!response.ok) throw Error('Profil indisponible'); return response.json(); });
      if (!$('vrg-cards').children.length) { selectionRows(context.references || []); $('vrg-prepare').textContent = 'Pr\u00e9parer la campagne avec cette s\u00e9lection'; status('Jeu normal pr\u00eat. Ouvrez Disponibilit\u00e9 et s\u00e9lection, v\u00e9rifiez les dix cartes et leurs impressions, puis confirmez cette s\u00e9lection. Aucun enregistrement commenc\u00e9.'); return; }
      selection = profile.cards.map(card => { const value = $('vrg-card-' + card.id).value.split('|'); return { id: card.id, cardId: value[0], printingId: value[1], available: $('vrg-available-' + card.id).checked }; });
      const refPairs = new Set((context.references || []).map(ref => ref.cardId + '|' + (ref.printingId || ref.referencePrintingId)));
      if (selection.some(card => card.available && !refPairs.has(card.cardId + '|' + card.printingId))) throw Error('Une impression s\u00e9lectionn\u00e9e est absente du corpus EN actif');
      baseline = await window.TCGVisionRealGameBaseline.load({ productSha, context });
      $('vrg-nominal').textContent = baseline.ready ? 'Nominal historique pr\u00e9serv\u00e9 : 43/45 \u00b7 95,56 % \u00b7 z\u00e9ro mauvaise identification. Preuve historique s\u00e9par\u00e9e des observations de ce build.' : 'Nominal historique non attest\u00e9 dans ce contexte : ' + (baseline.reasons || []).join(' ; ');
      if (!baseline.ready) throw Error('Compatibilit\u00e9 de la preuve historique non confirm\u00e9e ; aucune campagne pr\u00e9par\u00e9e');
      context.referencesSha256 = baseline.compatibility.referencesSha256;
      const clockId = 'real-game-' + (crypto.randomUUID?.() || String(Date.now()) + '-' + String(Math.random()).slice(2));
      const nominalBaseline = { ...(baseline.summary || {}), source: 'QUALIFICATION_RECEIPT', productSha: baseline.physicalProductSha || baseline.receipt?.physicalProductSha || 'ce5be2ad9aeaa27df4c217dec99df7f6c7e47c94', receiptId: baseline.receipt?.receiptId || baseline.receiptId || null };
      session = window.TCGVisionRealGameCampaign.createSession({ profile, context, provenance: $('vrg-provenance').value, clockId, now: () => performance.now(), nominalBaseline, selection, installation: { framingValidated: true, fixed: true, lighting: $('vrg-light').value } });
      $('vrg-target').replaceChildren(new Option('Attendu inconnu / ne pas \u00e9valuer l\u2019identit\u00e9', ''), ...context.cards.map(card => new Option(card.name || card.cardId, card.cardId)));
      jobs = window.TCGVisionRealGameCampaign.planJobs(profile, selection).map(job => ({ ...job, label: context.cards.find(card => card.cardId === job.expectedCardId)?.name || job.label })); observer = window.TCGVisionRealGameObserver.create({ targetWindow: window, onEvent, clockId, context }); observer.start();
      campaignVersion++; dirty(); $('vrg-setup').hidden = true; $('vrg-campaign').hidden = false; refreshJobs(); status('Campagne pr\u00e9par\u00e9e. Choisissez la phase, d\u00e9marrez une observation puis utilisez le survol normal. Aucun essai physique n\u2019est encore valid\u00e9.'); render();
    } catch (error) { status(error.message || 'Pr\u00e9paration impossible', true); }
    finally { pending = false; $('vrg-prepare').disabled = Boolean(session); render(); }
  }
  $('vrg-prepare').addEventListener('click', prepare);
  $('vrg-phase').addEventListener('change', () => { refreshJobs($('vrg-phase').value); render(); });
  $('vrg-job').addEventListener('change', () => { jobIndex = Number($('vrg-job').value); $('vrg-instruction').textContent = describe(jobs[jobIndex]); });
  $('vrg-start').addEventListener('click', () => { try { startedAt = performance.now(); session.startObservation(jobs[jobIndex], startedAt); observer.sample({ force: true }); dirty(); status('Observation en cours. Pr\u00e9sence physique \u00e0 confirmer ; le survol r\u00e9el reste le seul d\u00e9part d\u2019une consultation.'); render(); } catch (error) { status(error.message, true); } });
  $('vrg-declare-target').addEventListener('click', () => { if (active()?.phase !== 'FREE_PLAY') return; session.markReplacement($('vrg-target').value || null); dirty(); status('Carte attendue d\u00e9clar\u00e9e pour les consultations suivantes. Les demandes ant\u00e9rieures gardent leur attendu initial ou inconnu.'); });
  $('vrg-present').addEventListener('click', () => { session.markPresence(true); observer.sample({ force: true }); dirty(); status('Pr\u00e9sence d\u00e9clar\u00e9e dans la vid\u00e9o re\u00e7ue. Survolez naturellement la carte ; le bouton ne demande aucune identification.'); });
  $('vrg-removed').addEventListener('click', () => { session.markPresence(false); observer.sample({ force: true }); dirty(); status('Retrait / absence de face cible d\u00e9clar\u00e9. Le maintien volontaire d\u2019un aper\u00e7u reste distinct du suivi natif.'); });
  $('vrg-end').addEventListener('click', () => { session.endObservation('COMPLETED'); jobIndex = Math.min(jobIndex + 1, jobs.length - 1); dirty(); refreshJobs(); status('Observation conserv\u00e9e avec sa dur\u00e9e r\u00e9elle. Exportez r\u00e9guli\u00e8rement ; ne r\u00e9p\u00e9tez pas un \u00e9chec jusqu\u2019au succ\u00e8s.'); render(); });
  $('vrg-add-incident').addEventListener('click', () => { session.addIncident($('vrg-incident').value); dirty(); if (session.getState().invalidContext) { observer.stop(); paused = true; lastContextError = true; status('Installation ou contexte modifi\u00e9 : exportez et cl\u00f4turez ce segment. Pr\u00e9parez une nouvelle session apr\u00e8s avoir valid\u00e9 la nouvelle installation.', true); render(); return; } status('Constat ajout\u00e9, sans modifier le r\u00e9sultat mesur\u00e9. Un soup\u00e7on ne devient pas une erreur moteur confirm\u00e9e.'); render(); });
  $('vrg-pause').addEventListener('click', () => {
    if (lastContextError) { status('Ce contexte a chang\u00e9 : cl\u00f4turez et exportez ce segment. Une reprise n\u2019est pas autoris\u00e9e.', true); return; }
    if (!paused) { if (active()) session.endObservation('INTERRUPTED'); observer.stop(); paused = true; dirty(); status('En pause. L\u2019observation active reste interrompue ; deux fragments ne forment pas une fen\u00eatre continue.'); }
    else { observer.start(); paused = false; status('Observation passive reprise. D\u00e9marrez une nouvelle fen\u00eatre ; les mesures interrompues sont conserv\u00e9es.'); }
    render();
  });
  $('vrg-finish').addEventListener('click', () => { if (active()) session.endObservation('INTERRUPTED'); observer.stop(); session.finish(); stopped = true; dirty(); status('Campagne cl\u00f4tur\u00e9e, sans verdict physique automatique. T\u00e9l\u00e9chargez le JSON local pour analyse.'); render(); });
  $('vrg-export').addEventListener('click', () => {
    const report = session.exportReport();
    const blob = new Blob([JSON.stringify(report, null, 2) + '\n'], { type: 'application/json' }); const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = 'vision-real-game-' + report.clockId + '-' + String(++exportVersion).padStart(3, '0') + '.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); exported = true; render(); status('JSON t\u00e9l\u00e9charg\u00e9 localement. Conservez chaque export, y compris partiel ou en \u00e9chec. Aucun envoi par e-mail.');
  });
  $('vrg-new-segment').addEventListener('click', () => {
    if (!stopped || !exported) return;
    observer?.dispose(); session = null; observer = null; context = null; baseline = null; jobs = []; jobIndex = 0; paused = false; stopped = false; lastContextError = null; startedAt = null;
    if (renderFrame !== null) { cancelAnimationFrame(renderFrame); renderFrame = null; }
    $('vrg-framing').checked = false; $('vrg-corpus').checked = false; $('vrg-setup').hidden = false; $('vrg-campaign').hidden = true; $('vrg-prepare').disabled = false; $('vrg-prepare').textContent = 'V\u00e9rifier le jeu et pr\u00e9parer le nouveau segment';
    $('vrg-nominal').textContent = 'Nominal historique : compatibilit\u00e9 \u00e0 rev\u00e9rifier pour le nouveau segment. Les preuves pr\u00e9c\u00e9dentes restent dans vos fichiers t\u00e9l\u00e9charg\u00e9s.';
    status('Nouveau segment sans couper la partie. Rev\u00e9rifiez le cadrage, les impressions et la s\u00e9lection conserv\u00e9e avant de pr\u00e9parer. Aucun enregistrement commenc\u00e9.'); render(); $('vrg-framing').focus();
  });
  window.addEventListener('beforeunload', event => { if (session && !exported) { event.preventDefault(); event.returnValue = ''; } });
  $('vrg-open').addEventListener('toggle', () => { if ($('vrg-open').open) render(); });
  setInterval(() => { if (session && !stopped && $('vrg-open').open) render(); }, 1000);
  // Read-only inspection for test receipts; it neither starts an observation nor calls Vision.
  window.TCGVisionRealGameUi = Object.freeze({ getState: () => ({ prepared: Boolean(session), paused, stopped, jobIndex, context: context ? { productSha: context.productSha, locale: context.locale, referenceCount: context.referenceCount } : null, observer: observer?.getDiagnostics?.() || null, campaign: session?.getState() || null }) });
  fetch('/vision-real-game-profile.json', { cache: 'no-store' }).then(response => response.ok ? response.json() : Promise.reject(Error('Profil indisponible'))).then(value => { profile = value; }).catch(error => status(error.message, true));
})();
