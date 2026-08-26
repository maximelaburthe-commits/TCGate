# TCGate — Alpha 0.1 · Candidate 11 · UI 1.0.3

Candidate corrective basée sur **Candidate 10 · UI 1.0.2 corrective**.

## Objectif

Fermer les derniers problèmes observés avant la baseline Alpha privée :
- reprise F5 qui restaurait la salle mais pouvait perdre le flux webcam ;
- création concurrente de nombreuses PeerConnections pendant la reprise ;
- reprise Vision hésitante après hot-plug caméra ;
- derniers défauts d'affichage accueil / Gig Dice / plein écran.

## Correctifs Candidate 11

- création WebRTC atomique et génération unique par reprise ;
- candidats ICE mis en attente/filtrés sans créer de PeerConnection concurrente ;
- callbacks d'anciennes PeerConnections ignorés ;
- lecture vidéo distante stabilisée pendant la reprise ;
- Vision reste en pause jusqu'à réception de nouvelles frames après hot-plug puis se recalibre ;
- accueil responsive sur écrans courts ;
- Gig Dice ne chevauche plus le PiP au départ et sa poignée reste fixe au hover ;
- plein écran bord-à-bord sans contour hérité.

## Baseline Vision gelée

Les fichiers suivants ne sont pas modifiés :
- `models/card_detector_v53_512.onnx`
- `public/detection-worker.js`
- `public/vision-core.js`
- `public/identification.js`
- `public/table-state-engine.js`

## Validation

Voir :
- `PLAN_TEST_ALPHA_0.1_CANDIDATE_11.md`
- `CHANGELOG_TCGATE_ALPHA_0.1_CANDIDATE_11.md`
- `SECURITY_REVIEW_ALPHA_C9.md`
- `SECURITY_REVIEW_ALPHA_C10_DELTA.md`
- `DEPLOY_RAILWAY.md`

Si Candidate 11 passe le test ciblé, elle devient la baseline pour la préparation **Alpha privée + rapports automatiques par mail**.
