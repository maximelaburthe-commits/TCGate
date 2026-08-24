# TCGate — Alpha 0.1 · Candidate 10

Candidate **MAJEURE de résilience de session et de périphériques**, basée sur Candidate 9.

## Socle conservé
- parties 2 joueurs webcam/micro ;
- mode Cyberpunk avec Vision sur le flux adverse ;
- mode Sans jeu sans chargement Vision ;
- WebRTC P2P avec fallback Cloudflare TURN ;
- adaptation vidéo 1080p → 720p sous pression d'encodage ;
- rapports complets alpha ;
- sécurité Candidate 9 : Bearer secret, tickets SSE, rate limits, validation signalisation et headers navigateur.

Le modèle ONNX, Detection Worker, Vision Core, Identification et Table State 0.1.6 restent gelés.

## Candidate 10
- vraie reprise après **fermeture complète d'onglet** via credential de récupération `HttpOnly` séparé ;
- reprise en phase de jeu sans retour volontaire au lobby ;
- F5 préservé et rendu compatible avec la phase `game` ;
- hot-plug caméra/micro ;
- récupération automatique du même périphérique lorsqu'il revient ;
- choix d'un **nouveau matériel en cours de partie** sans quitter la salle ;
- remplacement indépendant des tracks audio/vidéo ;
- menu Périphériques dans la barre de jeu ;
- correctif responsive pour les portables à faible hauteur utile.

Voir :
- `PLAN_TEST_ALPHA_0.1_CANDIDATE_10.md`
- `CHANGELOG_TCGATE_ALPHA_0.1_CANDIDATE_10.md`
- `SECURITY_REVIEW_ALPHA_C9.md`
- `SECURITY_REVIEW_ALPHA_C10_DELTA.md`
- `DEPLOY_RAILWAY.md`


## Base UI Candidate 10
Cette Candidate 10 corrective est basée sur **Candidate 9 · UI 1.0.1 corrective**.
