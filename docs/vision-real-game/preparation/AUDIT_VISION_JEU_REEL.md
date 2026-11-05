# Audit — campagne Vision 1.0 adaptée au jeu réel

Date : 5 novembre 2026 (Europe/Paris). Dépôt : maximelaburthe-commits/TCGate. Baseline lue : `update/next @ 6d08ad3fde309a6c38990ba82ef4e56aa2e21597`.

Document de préparation. Audit du code et des dispositifs existants, sans nouvelle observation physique. Aucun résultat historique n’est réécrit. Aucune instrumentation n’est développée ou déployée dans ce passage ; aucun moteur, cache, seuil, descripteur, tracking, BDD, main ou Railway Production n’est modifié.

## Conclusion opérationnelle

Le scénario proposé est pertinent pour une première campagne de confort en partie : installation choisie par le joueur, fiabilité d’abord, stabilité ensuite, délais observés en dernier. Les volumes sont raisonnables pour détecter des défauts reproductibles, sans constituer une garantie statistique sur tous les joueurs et toutes les cartes.

L’interface actuelle permet déjà des observations manuelles au survol et conserve le nominal historique 43/45. Elle ne permet pas encore de conduire et d’exporter formellement le nouveau plan complet. Le guide de qualification historique est automatique, figé et distinct du fonctionnement spontané en partie. Les phases proposées doivent donc être préparées et validées avant lancement ; il ne faut pas les annoncer comme des options déjà disponibles.

## 1. Comportement réel et périmètre

En partie, Vision analyse le flux adverse : le snapshot produit précise `scope: opponent-stream-only` (`public/app.js:4942`). Un essai local face à sa propre webcam dans Vision Lab ne démontre donc pas la chaîne complète transport vidéo → détection → survol → affichage du joueur. La phase de partie réelle devra utiliser le dispositif effectivement prévu pour les joueurs et identifier quel participant consulte quel flux.

Le survol demande l’affichage d’une carte ; il ne garantit pas qu’aucune reconnaissance n’a eu lieu auparavant. Table State peut identifier des cartes en arrière-plan (`public/table-state-engine.js:813`, `:869`). Les consultations immédiates, après 5 secondes et après 10 secondes doivent distinguer une nouvelle reconnaissance, une identité déjà disponible et une réponse de cache.

Lorsque le pointeur quitte la vidéo adverse, le dernier visuel HD accepté peut volontairement rester affiché pour être consulté ou agrandi (`public/identification.js:2457`). Sa présence ne prouve pas que la carte physique reste présente, suivie et correctement identifiée. L’observateur contrôlé distingue déjà l’identité native du track de cette présentation (`public/vision-qualification-runtime.js:316`).

Le bouton Rapport du produit ouvre une procédure d’envoi par e-mail ; il ne correspond pas à un téléchargement local immédiat (`public/report-mail-ui.js:45`, `:148`, `:163`). Ne pas promettre un export local chronologique de partie qui n’existe pas encore et ne pas envoyer de rapport dans cette préparation.

## 2. Mesures disponibles et lacunes

| Mesure demandée | État actuel et limite |
| --- | --- |
| Détection physique | Observations `detected`, tracks actifs et première détection après T0 disponibles. Ce n’est pas l’instant physique exact où la carte entre dans le champ. Les tracks actifs peuvent tolérer des analyses manquées : ce signal ne prouve pas une détection fraîche à chaque instant. |
| Première demande humaine | Le Lab utilise le survol, mais aucun enregistrement de campagne ne relie un premier geste humain à un identifiant de consultation. Les demandes matcher peuvent aussi venir de l’arrière-plan ou du guide automatique. |
| Première identité correcte | Les identités natives et horodatages sont présents dans les observations. Le résumé actuel expose surtout T2 : confirmation d’une fenêtre correcte stable de 1 000 ms. Il ne nomme pas séparément la première bonne identité acceptée. |
| Stabilité et pertes réelles | Le guide suit un track unique, compte changements et disparitions, et distingue `TRACK_LOST`. Il manque un résumé des durées totale/maximale de perte pendant la présence physique attendue et des causes observables. |
| Demande → résultat affiché | Non mesuré de bout en bout. L’horodatage d’une tentative matcher n’est ni le geste humain, ni la preuve que le résultat est déjà affiché. |
| Première reconnaissance/cache | Le moteur expose cache et modes, mais les rapports guidés ne les associent pas à chaque consultation humaine. Ne pas confondre cache de bibliothèque, cache de survol, mémoire Table State et aperçu HD conservé. |
| Mauvaise identité / impression | Comptées séparément. Une mauvaise identité peut être comptée dans un essai classé UNSTABLE : lire les compteurs, pas seulement la catégorie finale. |
| Non-identification | NO_DETECTION et NOT_IDENTIFIED distingués. Un essai invalide n’entre pas dans le dénominateur valide et doit rester visible. |
| Scènes négatives | Cinq types, détections de forme et apparitions d’identités acceptées disponibles. Détection de forme ≠ fausse identification. |
| Vidéo / interface | FPS et durées techniques instantanés visibles ; pas de journal de campagne complet des gels, latences d’affichage et incidents utilisateur. |

Références : `public/vision-qualification-runtime.js:22`, `:342`, `:440`, `:472` ; `public/vision-qualification-diagnostics.js:129` ; `public/vision-qualification-harness.js:264`, `:271`, `:301`, `:469`.

Précision et dénominateurs : l’observateur échantillonne toutes les 250 ms et sur événements ; la stabilité exige 1 000 ms continus, sans trou d’observation supérieur à 1 000 ms. `identificationLatency` = T2 − T0 manuel, fenêtre stable et délai de présentation compris ; ce n’est pas la vitesse perçue après survol. Les taux correct/incorrect utilisent les essais valides de carte, en excluant les scènes sans cible. Les scènes comptent les nouvelles apparitions d’identités, y compris une réapparition après disparition ; `shapeDetections` est un nombre d’observations détectées, pas un nombre d’objets. Le p95 n’est émis qu’avec au moins 20 valeurs valides (`public/vision-qualification-harness.js:47`).

Vingt présentations donnent des pas de 5 % : 19/20 vaut 95 %, mais 0/20 mauvaises identités ne prouve pas un taux réel inférieur à 1 %. Les 43/45 historiques restent une preuve distincte, non ajoutée au nouveau dénominateur.

Le produit dispose déjà de mesures de lecture vidéo (images perdues, écarts entre callbacks), de long tasks et de compteurs de queue/worker. En partie, des snapshots Vision sont échantillonnés toutes les cinq secondes (`public/app.js:1637`, `public/vision-core.js:1617`, `:1644`). Ils ne sont pas encore reliés à chaque demande humaine. Les journaux sont bornés ; le rapport peut réduire ses événements au-delà de sa limite de 768 Kio (`public/app.js:4973`). On ne peut donc pas annoncer une chronologie exhaustive de vingt à trente minutes à haute cadence.

## 3. Compatibilité des phases avec le dispositif actuel

| Phase préparée | Dispositif actuel | Adaptation nécessaire avant mesure formelle |
| --- | --- | --- |
| Installation libre puis fixe | Choix caméra/résolution, aperçu et métriques. | Validation du cadrage par le testeur et métadonnées contrôlées d’installation ; aucune recherche d’angle idéal. |
| Fiabilité 10 cartes × 2 | Nominal imposé 15 cartes × 3. | Profil distinct, sélection déclarée avant essais, 20 présentations sans réécrire le nominal historique. |
| Stabilité 8 cartes × environ 20 s | Trois cartes, 10 s automatiques dès première détection. | Huit fenêtres de 20 s et annotation de présence physique attendue ; distinguer identité native et aperçu. |
| Huit retraits/remplacements A → B | Deux paires imposées, retrait marqué, retour réel au neutre. | Huit séquences préannoncées, conservation des liens A/B et chronologie. Distinguer attente du harness et retrait naturel. |
| Sleeves/reflets/orientations | Six cartes par condition ; sleeve déclarable ; rotation légère. | Situations ordinaires explicites, installation fixe, pas d’angle extrême ni balayage systématique de distance. |
| Cinq scènes négatives | Table vide, playmat, main visible, paquet fermé, objets de bureau ; 30 s chacune. | Réutilisables, mais préciser les demandes de consultation : les scènes ne démarrent pas le suivi automatique des essais positifs. |
| Demandes immédiates/5 s/10 s | Qualification automatique sans survol. | Observer passivement le mode NORMAL, sans déclencher la reconnaissance pour les besoins du test. |
| Partie 20–30 min | Usage réel disponible, feedback ponctuel. | Session libre structurée, marquage d’incidents, export local scalaire et rapport distinct. |

Matrice : `VISION_QUALIFICATION_SAMPLE.json:2596`, `:2696`, `:2717`, `:2894`. Construction et limites UI : `public/workspace-vision-qualification.js:149`, `:453`, `:522`. Le menu « Carte concernée » sert aux substitutions préparées, pas à choisir librement la prochaine observation (`:290`).

La campagne historique exige aussi angles, distance, faible lumière, printings et trois initialisations à froid plus trois après rechargement. En les reportant, son rapport global restera incomplet : ce n’est pas automatiquement un défaut produit, ni un PASS du nouveau périmètre (`public/vision-qualification-harness.js:376`, `:448`).

## 4. Protéger le nominal et les preuves

Le reçu nominal reste 43 corrects, 2 NOT_IDENTIFIED Alt Cunningham, aucune mauvaise identité sur 45 ; aucune nouvelle campagne nominale n’est requise ici. Les essais historiques ne deviennent jamais des observations du nouveau build ou de la nouvelle partie.

Le validateur lie le reçu à l’empreinte du document SAMPLE entier, au corpus, au moteur et au harness (`public/vision-qualification-receipt.js:90`, `:137`). Modifier la matrice historique pour obtenir 10 × 2 ou 20 s invaliderait cette compatibilité. Conserver donc SAMPLE, harness, reçus, sessions et rapports historiques ; créer un nouveau protocole et un nouveau périmètre de rapport. Le générateur historique exige explicitement 15 cartes × 3 (`public/vision-qualification-report.js:194`) et sépare déjà la preuve nominale des observations courantes (`:55`).

## 5. Développement minimal proposé, non réalisé

1. Ajouter un profil de campagne réelle versionné, avec installation validée, cartes/situations choisies avant essais, durées, phases et périmètre reporté. Garder le protocole historique intact.
2. Ajouter un observateur passif du flux NORMAL : identifiant de consultation, origine humaine/arrière-plan/cache, track, identités acceptées, première bonne identité, confirmation stable, affichage effectif, perte et retrait. Aucun changement moteur/cache/seuil.
3. Utiliser des temps monotones avec `clockId`/session distincts : ne jamais soustraire des horloges de pages ou de participants différents. Une identité préexistante doit être décrite comme telle, pas comme une première reconnaissance apparue après le survol.
4. Ajouter export local de scalaires sans média et rapport du nouveau périmètre : fiabilité → stabilité → délais descriptifs → incidents. Distinguer mesures automatiques, synthétiques et physiques ; disponibilité inconnue reste inconnue.
5. Tester les contaminations A/B, résultat tardif de l’ancien track, cache/mémoire/aperçu, arrière-plan avant survol, affichage sans bonne identité native, horloges différentes, changements de build/corpus et séparation des dénominateurs. Vérifier que le reçu 43/45 reste valide et qu’aucun essai historique n’est dupliqué.

## 6. Exports et état de préparation

Les trois exports guidés existants sont « Exporter la session », « Télécharger le rapport » et « Télécharger vision-qualification-1.0.json » (`public/workspace.html:39`). La session nouvelle reste en mémoire : exporter avant F5 ; le retour automatique du reçu historique ne restaure pas les nouveaux essais (`:22`). « Exporter les cas du Lab (images + diagnostic) » est un autre flux, pouvant contenir des médias ; ce n’est pas le futur export scalaire de partie (`:45`, `public/workspace.js:123`).

Aujourd’hui : audit, critères et guide préparés ; observations manuelles possibles après intervention du testeur. Campagne formelle complète : pas encore prête, car instrumentation minimale et profil distinct restent à réaliser, tester et valider. Aucun déploiement, lancement physique ou modification du moteur n’est engagé.
