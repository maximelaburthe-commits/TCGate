# Workspace Vision Lab et cockpit BDD

Le Workspace est servi par le serveur TCGate existant à /workspace.html. Le Lab est dans l’onglet Vision Lab de cette même page. Aucune iframe et aucun nouveau serveur. Reprise, Général, Vision, BDD, UI / UX et Fonctions annexes chargent le JSON canonique de la branche workspace-state, indépendamment du démarrage Vision. Le lien Production conserve https://tcg-webcam-test-production.up.railway.app/.

## Utilisation

1. Ouvrir Vision Lab : Caméra & détection sont immédiatement visibles. Les contrôles chargent les seuls scripts du détecteur, sans manifest ni matcher. Aucun accès webcam avant le clic utilisateur.
2. Activer la caméra, choisir la caméra et la résolution, puis Activer la détection. Ce parcours fonctionne sans BDD. Les métriques, boxes, tracking, réglages et captures sont ceux de vision-core.js ; audio:false.
3. Facultativement, dans Identification : choisir Cyberpunk · production ou Manifest de test (URL GitHub blob/raw publique), Inspecter la BDD, puis Activer l’identification. Les diagnostics version/schema/snapshot/locales/couverture restent disponibles. Une erreur de BDD affecte uniquement cette couche.
4. Survoler une carte détectée pour son crop, résultat et Top 5. Les résultats proviennent exclusivement des snapshots/crops du moteur existant, sans recalcul.
5. Capturer et exporter même sans identification : webcam, overlay, paramètres, métriques et détections. Avec identification : source BDD et dernière observation sont attachées au moment de la capture ; une identification activée ultérieurement ne réétiquette pas une capture antérieure. Feedback local et export JSON restent disponibles.
6. Nouvelle session recharge la page pour changer de corpus après initialisation. Les données sont en mémoire jusqu’à export (40 captures existantes, 100 feedbacks).

Voir [correctif du parcours caméra](WORKSPACE_CAMERA_FLOW.md) et [smoke caméra d’abord](WORKSPACE_CAMERA_FLOW_VALIDATION.txt). Aucune qualification webcam physique revendiquée.

## Contrat du provider Lab

workspace-lab-provider.js adapte les manifests runtime existants (database_manifest, cards, printings, canonical_vision_index, printing_recognition_index, recognition_groups), via le validateur existant database-source.js. Aucun TCG ajouté dans identification.js. Les localisations et leur couverture sont affichées si exposées ; aucune sélection de langue ne filtre les références Vision. Toutes les références du runtime déclaré, dont toutes ses langues présentes, vont au même matcher. cardId canonique, langue physique et langue d’affichage restent distincts. Les locales cataloguées ne prouvent pas une couverture Vision : les assets FR peuvent encore manquer.

Le provider est installé uniquement dans la page Lab, avant de charger identification.js, et capturé une seule fois. Aucun provider : chemin, seuils, intégrité, fallback et cache de production inchangés. Provider présent : source test sans fallback production, minimum technique d’une référence, bibliothèque complète requise, cache persistant production ni lu ni écrit ni effacé. Une branche mutable peut être testée, avec sourceImmutable=false et diagnostic non qualifié ; cela n’accorde aucun droit à la production. La disponibilité technique du matcher ne vaut pas qualification.

Le modèle ONNX et les workers de détection/identification sont inchangés. Réutilisation de vision-frame-gate, vision-analysis-frame, vision-appearance-sampler et vision-library-integrity. table-state-engine.js est audité mais n’est pas démarré : il appartient aux sessions de partie. La page ne charge ni app.js, ni room, ni WebRTC, ni code microphone. Aucun envoi des feedbacks.

Les quatre tests historiques gelant Vision conservent leur hash original de production. workspace-production-contract.js retire uniquement les huit raccords Lab explicites (avec cardinalités vérifiées), puis vérifie les mêmes octets de production ; toute autre modification continue de faire échouer les assertions. Les tests navigateur exercent en complément le chemin provider réel.

## Cockpit BDD

workspace-databases.js centralise les liens publics et permet un troisième jeu sans nouveau composant. Cyberpunk ACTIVE lit la configuration production inchangée : 1.1.0, SHA 56402636a77af9c8b5dc4e3b61c509a185f3c834, statut technique candidate-qualified. DEVELOPMENT affiche séparément le checkpoint connu 425e0198610cd0a746c4e2d1fc3094b3823340e4, version 1.2.0/schema 2.1.0, EN/FR, chiffres connus et blockers. Ces chiffres sont un checkpoint explicite, sans prétendre suivre le HEAD distant. SWU reste non configuré et sans candidate connue.

La vue BDD dispose désormais d’un tableau ACTIVE/CANDIDATE, d’une lecture du HEAD Candidate et de rapports séparés. Vérifier les mises à jour ouvre le workflow build-database.yml à lancer manuellement avec promote=false. Tester la Candidate dans Vision Lab préremplit et inspecte son manifest immuable sans démarrer l’identification. Le Journal utilise des Issues [JOURNAL] avec confirmation humaine de création. Voir [maintenance et Journal](WORKSPACE_DATABASE_JOURNAL.md).

Cycle cible : source fiable → fetch → snapshot immuable → diff → staging → build → tests → branche update/… → Pull Request → validation humaine → merge. DB main mise à jour ≠ SHA DB TCGate modifié. La prochaine étape sera Update Cyberpunk DB dans le repository DB, avec bilan cartes/printings avant-après, locales, assets, IDs modifiés, impact runtime actif et résultats de tests dans la PR. SWU suivra la même architecture ultérieurement. Aucun workflow ni changement de repository BDD dans cette étape.

## Validation

- npm run test:workspace : provider, langues, corpus invalide, traversal, isolation, feedback et routes du serveur/modèle.
- npm run test:workspace-browser : Playwright optionnel fourni par WORKSPACE_PLAYWRIGHT_PATH (aucune dépendance produit ajoutée), Chrome avec caméra simulée, vrai worker matcher, crop/Top 5 sur géométrie synthétique, capture/export, refus de BDD et vraie inférence ONNX/WebGPU. Les références et manifests de cette fixture sont synthétiques. Aucune reconnaissance physique ni qualification EN/FR réelle revendiquée.
- Le journal WORKSPACE_VISION_LAB_VALIDATION.txt détaille les commandes et résultats. npm run check n’existe pas dans ce dépôt ; vérification syntaxique Node des nouveaux scripts à la place.
- Les tests historiques BDD utilisent une extraction temporaire du SHA DB de production, et non le checkout de travail 1.2.0. Aucun repository externe modifié.

Le code est destiné à update/next et à Railway Test. Aucun merge main, aucune Candidate et aucune configuration Railway modifiée. Le déploiement Test et l’accès effectif HTTPS à /workspace.html sont à confirmer après le push ; les essais locaux ne constituent pas une qualification webcam physique.
