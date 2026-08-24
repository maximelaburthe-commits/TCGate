# TCGate — Alpha 0.1 · Candidate 9

Candidate MAJEURE de **robustesse et sécurité** basée sur Candidate 8.

## Socle conservé
- parties 2 joueurs webcam/micro ;
- mode Cyberpunk avec Vision sur le flux adverse ;
- mode Sans jeu sans chargement Vision ;
- WebRTC P2P avec fallback Cloudflare TURN ;
- adaptation vidéo 1080p → 720p sous pression d'encodage ;
- rapports complets alpha.

Le modèle ONNX, Detection Worker, Vision Core, Identification et Table State 0.1.6 restent gelés.

## Candidate 9
- authentification secrète des sessions distincte du peer ID ;
- validation et limitation des API / messages de signalisation ;
- headers de sécurité navigateur ;
- tickets SSE temporaires ;
- reprise d'un salon pendant 5 minutes après perte/rafraîchissement ;
- tentative d'ICE restart après interruption WebRTC.

Voir :
- `SECURITY_REVIEW_ALPHA_C9.md`
- `PLAN_TEST_ALPHA_0.1_CANDIDATE_9.md`
- `CHANGELOG_TCGATE_ALPHA_0.1_CANDIDATE_9.md`
- `DEPLOY_RAILWAY.md`
