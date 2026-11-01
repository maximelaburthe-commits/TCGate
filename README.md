# TCGate — Alpha 0.1 · Candidate 15 · UI 1.2.0

Ce jalon UI 1.2 ajoute cinq pages internes à l’Accueil et trois onglets au Lobby, avec Ready toujours visible. Gig Dice devient une option de salon partagée, modifiable uniquement par le Host avant lancement. Le logo approuvé est copié sans transformation. La Table conserve sa présentation et ses mécanismes. Voir [le contrat et la validation UI 1.2](UI_1_2_HOME_LOBBY.md).

Le système de rapports Alpha utilise Report Schema V2 et l’envoi par e-mail avec ZIP via Resend. Les diagnostics et la génération des rapports restent indépendants de la messagerie. Voir [la configuration mail](RAILWAY_REPORT_EMAIL_SETUP.md) et [le rapport Maintenance 1.2A](PROJECT_CLEANUP_1_2A.md). Les fonctions réseau, WebRTC, Vision, Phone Camera, UI 1.2 et Cyberpunk DB sont conservées.

## Report Schema V2
- enveloppe versionnée et compatible avec les rapports Legacy ;
- diagnostics Réseau, Vision et BDD indépendants et tolérants aux erreurs ;
- aucune collecte de parcours utilisateur ou de contenu audiovisuel ;
- listes, messages et taille bornés avec troncature explicite ;
- diagnostic observationnel `ACTIVE_DB_MISMATCH`, sans activation automatique de BDD.

## Base technique conservée
- reprise F5 / WebRTC atomique ;
- reconnexion réseau et reprise média / hot-plug ;
- orchestration Vision existante ;
- baseline Vision gelée inchangée.

## Identification
- frontend : `TCGate Alpha 0.1 Candidate 15 · UI 1.2.0`
- health : `tcgate-alpha-0.1-candidate-15`

Voir `RELEASE_TCGATE_ALPHA_0.1_CANDIDATE_15.md` et `REPORT_SCHEMA_V2.md`.

## Workspace de pilotage et Vision Lab

Ouvrir `/workspace.html` sur le serveur TCGate. Pilotage canonique, cockpit BDD Cyberpunk/SWU et vrai Lab webcam isolé. Voir [utilisation et contrats](WORKSPACE_VISION_LAB.md). Tests : `npm run test:workspace` ; test Chrome optionnel : `npm run test:workspace-browser`.

Le Workspace propose aussi la [maintenance BDD et le Journal de pilotage](WORKSPACE_DATABASE_JOURNAL.md). Le Journal utilise les Issues GitHub `[JOURNAL]` ; leur création est confirmée par le propriétaire sur GitHub.

## Phone Camera produit

Phone Camera fait partie du produit TCGate. **Phone Camera engine → TCGate repository** : tout développement futur utilise les propriétaires Phone intégrés. Le standalone 0.6.4.1 reste une référence historique et ne constitue plus la source de développement.

Dans Lobby → Mon installation, associer le téléphone par QR puis utiliser les réglages Phone repliables sur le PC : qualité auto/720p30/1080p expérimental, zoom/champ maximum selon capacités, arrêt et diagnostic JSON. Le téléphone reste vidéo uniquement ; le microphone reste celui du PC. Autofocus natif selon navigateur, sans commande de focus manuel.

**Phone Lab : NOT NEEDED** : les contrôles utiles sont dans le panneau produit et les diagnostics utilisent le même moteur. Aucune vue Workspace ni serveur supplémentaire. Voir [la matrice et les preuves de consolidation](PHONE_CONSOLIDATION_1_2C.md), [la checklist physique](PHONE_PHYSICAL_QUALIFICATION_1_2C.md) et le journal PHONE_CONSOLIDATION_1_2C_VALIDATION.txt. Phone Camera integrated: QUALIFIED. PHYSICAL QUALIFICATION PASS déclaré par le propriétaire pour Phone 1.2C ; voir le reçu dans la checklist physique.

## Candidate 15 : réconciliation et gel

La Candidate 15 porte manuellement les garanties privacy C14 et la purge TURN, en conservant UI 1.2, Resend, Phone intégré, Vision et Cyberpunk. Aucun merge aveugle de C14, aucune nouvelle fonction produit. [Release et classification C14](RELEASE_TCGATE_ALPHA_0.1_CANDIDATE_15.md), [workflow de qualification](ALPHA_QUALIFICATION.md), [validation](CANDIDATE_15_VALIDATION.txt).

Production Railway reste sur `candidate/alpha-0.1-c14` ; Test suit `update/next` sans montage /data, redéploiement réussi. Report qualification : service retiré, environnement vide **SAFE TO DELETE ENVIRONMENT**. Phone standalone : **DECOMMISSIONABLE**, projet `TCGate-camera-phone` **SAFE TO DELETE** après le PASS physique déclaré. Aucune suppression ni modification Railway effectuée dans ce jalon.

Les dépôts BDD du programme sont Cyberpunk et SWU ; Cyberpunk seul est actif en partie. SWU reste en développement, inactif produit ; Riftbound est **ARCHIVE CANDIDATE**. [Architecture et décision langues post-Candidate 15](PROJECT_ARCHITECTURE.md). Aucun fallback visuel inter-langue ne sera autorisé ; aucune implémentation multilingue ici.

Qualification complète du SHA gelé : `npm run qualify:alpha`. Playwright/Chrome sont requis, aucune suite navigateur n'est optionnelle. Les preuves sont écrites hors dépôt. Les médias navigateur simulés, le PASS Phone déclaré, les cartes physiques et le relay WAN restent distingués. La promotion vers main et le réalignement Production sont ultérieurs.
