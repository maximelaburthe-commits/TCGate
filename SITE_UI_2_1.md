# TCGate — Site UI 2.1 et Alpha communautaire

Branche de travail : `feature/ui-2-1-community-alpha`, créée depuis `origin/update/next @ 6a5e15271d7339cb23167b93bc6e23c9c108404f` le 9 novembre 2026. Production reste Candidate 15 ; aucune nouvelle Candidate ni campagne physique Vision n'est créée.

## Évolutions ciblées

Home et Lobby gardent leurs parcours Créer, Rejoindre, Ready et reprise. Les titres décoratifs redondants sont retirés du HTML et de la présentation dynamique. Les options communes (jeu, minuteur, Gig Dice) restent séparées des réglages personnels (caméra, microphone, aperçu, langue physique des cartes). Les interrupteurs Minuteur/Gig Dice sont alignés. Le bouton Rapport, auparavant masqué par une règle mobile héritée, reste disponible sur petit écran.

L'interface est effectivement en français. La langue des cartes reste une préférence personnelle distincte, limitée aux langues réellement disponibles dans les métadonnées. Aucune interface anglaise ni langue de corpus supplémentaire n'est annoncée. Le logo officiel PNG 2048 × 682 RGBA reste strictement identique.

La communication Alpha communautaire indique l'état du projet, la finalité volontaire des rapports et leurs catégories réelles : diagnostics techniques, code de salon, identifiants techniques éventuels et note libre. Le ZIP transmis ne contient pas de média capturé. Les références d'images du catalogue sont distinctes des pixels de la webcam. Resend assure la transmission ; la conservation effective dans le compte fournisseur, les journaux et la boîte destinataire n'est pas vérifiée et aucune durée n'est inventée. L'audit détaillé est dans `docs/ui-2.1/AUDIT_RAPPORTS_ALPHA.md`.

## Gig Dice V6

La référence visuelle autonome fournie est présente sur le Bureau sous `gig-dice-v6.html`, titre « TCGate — Gig Dice V6 · icônes TCGate intégrées ». Son SHA-256 est `c6b9734359d98754bdf91c6d89d70bc4b36daaea08611a043ee7be3beab8cd29`. Le propriétaire l'identifie comme la maquette corrigée validée du 6 novembre 2026. Sa copie, son empreinte et son rendu sont archivés dans le dossier externe de preuves ; elle n'est pas ajoutée comme moteur au produit.

`gig-dice-v6.js` et sa feuille de style adaptent les fonctions de présentation existantes. Ils conservent les six SVG originaux de `GIG_DICE_ICONS`, l'état natif, les bornes, le calcul du Street Cred, les transferts, la persistance et la synchronisation. La disposition horizontale de référence est reprise sur ordinateur ; les deux rangées restent lisibles sur mobile. Le type D4/D6/D8/D10/D12/D20 est temporaire au survol/focus, et le chiffre source est masqué pendant son zoom pour éviter une valeur répétée. Les commandes et zones de destination sont plus lisibles.

Le module reste repliable, avec Street Cred visible, et déplaçable par une poignée accessible. Les aides natives de position/sauvegarde sont réutilisées. Le déplacement vérifie les obstacles vidéo/interface, y compris après Ready et en plein écran ; un seul contrôleur de déplacement est attaché. La logique métier du prototype n'est pas portée.

## Rapport facultatif avant départ

`alpha-report-exit.js` écoute seulement les clics volontaires de sortie. Un dialogue propose Envoyer un rapport, Quitter sans rapport et Annuler. Il réutilise ensuite la sortie native ; le rappel remplace la première confirmation en partie afin d'éviter deux fenêtres successives.

Le formulaire de rapport existant reste le seul mécanisme d'envoi. La Room et la note restent disponibles après erreur ; aucune navigation automatique n'intervient. Fermer le formulaire permet de revenir au choix de sortie ou à la partie. Seule une réponse HTTP réussie avec `result.ok` marque le rapport comme envoyé. Ce succès est mémorisé pour le salon dans l'onglet, y compris après F5 si `sessionStorage` est disponible, et effacé au changement de session. Aucun rappel ni envoi n'est déclenché par une déconnexion distante, F5 ou fermeture du navigateur.

`report-mail-ui.js` ajoute uniquement des notifications locales de succès/fermeture et un statut visible accessible. La génération ZIP, les octets transmis, l'endpoint, le fournisseur et les paramètres du serveur restent inchangés. Les tests historiques authentifient tout le reste du fichier, avec des insertions autorisées exactes et des tests négatifs ; ils ne retirent pas la protection du transport.

## Isolation et vérification

`public/app.js` appartient au périmètre de compatibilité du reçu nominal historique. Il est donc conservé byte pour byte ; les adaptations sont chargées après les contrôleurs existants. Les 24 chemins moteur, seuils, matcher, cache, tracking, modèles et corpus restent inchangés, de même que le reçu, SAMPLE et les preuves physiques. Le PASS nominal 43/45 garde son périmètre historique.

La qualification complète s'exécute sur un commit propre de la branche isolée avec `npm run check`, `npm run qualify:alpha -- --output-dir <dossier neuf hors worktree>` et `git diff --check`. Le registre conserve les 63 suites historiques et ajoute les quatre suites d'instrumentation solo ainsi que six suites UI 2.1 : 73 suites au total. Le seul élargissement de la garde de branche autorise la branche UI 2.1 exacte, sans déplacer la branche locale `update/next` ni nettoyer son worktree.

Les tests complémentaires couvrent les rappels de sortie et le vrai transport ZIP vers Resend simulé, les Gig Dice dans deux contextes Host/Guest indépendants, leurs valeurs/couleurs/transferts/Street Cred/repli/restauration, ainsi que Home/Lobby/Game à plusieurs résolutions. Les comparaisons avant/après et les codes réellement exécutés sont conservés dans le dossier externe `UI-2.1-Community-Alpha-20261109-zdFJpy`, avec sous-dossiers de tentatives distincts. Le bilan final y indique le SHA figé, les résultats et le SHA effectivement servi par Test.

Les périphériques navigateur et le fournisseur e-mail sont synthétiques. Aucune réussite sur webcam physique, deux réseaux distants ou livraison Resend réelle n'est déduite. L'ancien `endOverlay` ne possède actuellement pas de déclencheur automatique ; ses boutons sont vérifiés après ouverture explicite de sa présentation, sans revendiquer un nouveau cycle de fin de partie. Aucun secret, donnée de Production, dépôt BDD, Workspace canonique ou configuration Railway n'est modifié.
