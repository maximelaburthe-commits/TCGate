# TCGate — Alpha 0.1 · Candidate 13 · UI 1.2.0

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
- frontend : `TCGate Alpha 0.1 Candidate 13 · UI 1.2.0`
- health : `tcgate-alpha-0.1-candidate-13`

Voir `RELEASE_TCGATE_ALPHA_0.1_CANDIDATE_13.md` et `REPORT_SCHEMA_V2.md`.

## Workspace de pilotage et Vision Lab

Ouvrir `/workspace.html` sur le serveur TCGate. Pilotage canonique, cockpit BDD Cyberpunk/SWU et vrai Lab webcam isolé. Voir [utilisation et contrats](WORKSPACE_VISION_LAB.md). Tests : `npm run test:workspace` ; test Chrome optionnel : `npm run test:workspace-browser`.

Le Workspace propose aussi la [maintenance BDD et le Journal de pilotage](WORKSPACE_DATABASE_JOURNAL.md). Le Journal utilise les Issues GitHub `[JOURNAL]` ; leur création est confirmée par le propriétaire sur GitHub.
