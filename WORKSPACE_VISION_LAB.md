# Workspace Vision Lab et cockpit BDD

Le Workspace est servi par le serveur TCGate existant à /workspace.html. Le Lab est dans l’onglet Vision Lab de cette même page. Aucune iframe et aucun nouveau serveur. Reprise, Général, Vision, BDD, UI / UX et Fonctions annexes chargent le JSON canonique de la branche workspace-state, indépendamment du démarrage Vision. Le lien Production conserve https://tcg-webcam-test-production.up.railway.app/.

## Utilisation

1. Vision Lab → choisir Cyberpunk · production ou Manifest de test (URL GitHub blob/raw publique).
2. Inspecter la BDD : version, schema/snapshot si exposés, locales, cartes, printings, groupes, références et couverture. Les champs non exposés restent explicitement inconnus. Les erreurs de manifest sont locales à cet écran.
3. Démarrer le Lab : construction des descripteurs puis démarrage du vrai matcher. Les images manquantes empêchent l’identification et figurent dans les diagnostics. Activer ensuite la caméra (sans microphone), puis la détection. Le démarrage et les changements caméra/résolution réutilisent vision-core.js.
4. Survoler une carte détectée : crop, meilleur candidat, score/indice, marge, acceptation/refus, qualité/glare et Top 5 proviennent exclusivement de TCGIdentificationLab.getSnapshot() et getAnalyzedCropDataUrl(). Les métriques ONNX et tracking sont celles du détecteur existant. Le score est un indice de matching, pas une probabilité.
5. Capturer les cas puis saisir un feedback (Correct, Mauvaise identification, Non-identification ou Faux positif). recognizedAs est requis pour une mauvaise identification. Le dernier résultat observé et son crop sont conservés lorsque le pointeur rejoint les boutons. L’export JSON contient source/version/ref ou URL, observation horodatée, paramètres, diagnostics, Top 5 et images des captures. Les données restent en mémoire jusqu’à export ; recharger efface la session. Limites : 40 captures existantes, 100 feedbacks.
6. Changer de BDD via Nouvelle session : la page est rechargée pour isoler totalement les corpus et workers.

## Contrat du provider Lab

workspace-lab-provider.js adapte les manifests runtime existants (database_manifest, cards, printings, canonical_vision_index, printing_recognition_index, recognition_groups), via le validateur existant database-source.js. Aucun TCG ajouté dans identification.js. Les localisations et leur couverture sont affichées si exposées ; aucune sélection de langue ne filtre les références Vision. Toutes les références du runtime déclaré, dont toutes ses langues présentes, vont au même matcher. cardId canonique, langue physique et langue d’affichage restent distincts. Les locales cataloguées ne prouvent pas une couverture Vision : les assets FR peuvent encore manquer.

Le provider est installé uniquement dans la page Lab, avant de charger identification.js, et capturé une seule fois. Aucun provider : chemin, seuils, intégrité, fallback et cache de production inchangés. Provider présent : source test sans fallback production, minimum technique d’une référence, bibliothèque complète requise, cache persistant production ni lu ni écrit ni effacé. Une branche mutable peut être testée, avec sourceImmutable=false et diagnostic non qualifié ; cela n’accorde aucun droit à la production. La disponibilité technique du matcher ne vaut pas qualification.

Le modèle ONNX et les workers de détection/identification sont inchangés. Réutilisation de vision-frame-gate, vision-analysis-frame, vision-appearance-sampler et vision-library-integrity. table-state-engine.js est audité mais n’est pas démarré : il appartient aux sessions de partie. La page ne charge ni app.js, ni room, ni WebRTC, ni code microphone. Aucun envoi des feedbacks.

Les quatre tests historiques gelant Vision conservent leur hash original de production. workspace-production-contract.js retire uniquement les huit raccords Lab explicites (avec cardinalités vérifiées), puis vérifie les mêmes octets de production ; toute autre modification continue de faire échouer les assertions. Les tests navigateur exercent en complément le chemin provider réel.

## Cockpit BDD

workspace-databases.js centralise les liens publics et permet un troisième jeu sans nouveau composant. Cyberpunk ACTIVE lit la configuration production inchangée : 1.1.0, SHA 56402636a77af9c8b5dc4e3b61c509a185f3c834, statut technique candidate-qualified. DEVELOPMENT affiche séparément le checkpoint connu 425e0198610cd0a746c4e2d1fc3094b3823340e4, version 1.2.0/schema 2.1.0, EN/FR, chiffres connus et blockers. Ces chiffres sont un checkpoint explicite, sans prétendre suivre le HEAD distant. SWU reste non configuré et sans candidate connue.

Vérifier / Mettre à jour ouvre seulement GitHub Actions dans un nouvel onglet. Aucun workflow de mise à jour répondant au cycle PR validé n’est configuré : l’UI l’indique. Les workflows build-database.yml présents localement ne sont pas assimilés à ce futur workflow. Candidate : branche de développement Cyberpunk ; SWU : bouton désactivé. Voir la DB GitHub ouvre le repository. Aucun token, secret, appel write GitHub ou backend d’administration.

Cycle cible : source fiable → fetch → snapshot immuable → diff → staging → build → tests → branche update/… → Pull Request → validation humaine → merge. DB main mise à jour ≠ SHA DB TCGate modifié. La prochaine étape sera Update Cyberpunk DB dans le repository DB, avec bilan cartes/printings avant-après, locales, assets, IDs modifiés, impact runtime actif et résultats de tests dans la PR. SWU suivra la même architecture ultérieurement. Aucun workflow ni changement de repository BDD dans cette étape.

## Validation

- npm run test:workspace : provider, langues, corpus invalide, traversal, isolation, feedback et routes du serveur/modèle.
- npm run test:workspace-browser : Playwright optionnel fourni par WORKSPACE_PLAYWRIGHT_PATH (aucune dépendance produit ajoutée), Chrome avec caméra simulée, vrai worker matcher, crop/Top 5 sur géométrie synthétique, capture/export, refus de BDD et vraie inférence ONNX/WebGPU. Les références et manifests de cette fixture sont synthétiques. Aucune reconnaissance physique ni qualification EN/FR réelle revendiquée.
- Le journal WORKSPACE_VISION_LAB_VALIDATION.txt détaille les commandes et résultats. npm run check n’existe pas dans ce dépôt ; vérification syntaxique Node des nouveaux scripts à la place.
- Les tests historiques BDD utilisent une extraction temporaire du SHA DB de production, et non le checkout de travail 1.2.0. Aucun repository externe modifié.

Le code est destiné à update/next et à Railway Test. Aucun merge main, aucune Candidate et aucune configuration Railway modifiée. Le déploiement Test et l’accès effectif HTTPS à /workspace.html sont à confirmer après le push ; les essais locaux ne constituent pas une qualification webcam physique.
