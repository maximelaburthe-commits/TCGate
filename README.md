# TCGate — Alpha 0.1 · Candidate 14 · UI 1.1.0

Cette Candidate corrective durcit la confidentialité du Report Schema V2 et borne le cache de credentials TURN. Elle conserve intégralement les fonctions réseau, WebRTC, Vision, Phone Camera, Future UX et Cyberpunk DB déjà qualifiées.

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
- frontend : `TCGate Alpha 0.1 Candidate 14 · UI 1.1.0`
- health : `tcgate-alpha-0.1-candidate-14`

Voir `RELEASE_TCGATE_ALPHA_0.1_CANDIDATE_14.md`, `REPORT_SCHEMA_V2.md` et `ALPHA_QUALIFICATION.md`.
