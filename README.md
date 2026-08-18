# TCG Webcam — V0.6.4.0 Clean Baseline

Cette version repart directement de la V0.6.2 validée comme référence comportementale.

## Modifications autorisées
- correction ciblée : un résultat visuel très décisif peut être accepté malgré `glare-high` si la marge sur le candidat n°2 est forte ;
- page de préparation/lobby compacte selon la hauteur du viewport afin d'éviter le scroll sur Chrome desktop ;
- numéros de version / rapports mis à jour.

## Strictement inchangé depuis V0.6.2
- `public/vision-core.js` ;
- `public/detection-worker.js` ;
- modèle `card_detector_v53_512.onnx` ;
- logique de tracking ;
- logique de hover ;
- temporalité d'identification hors exception reflet ci-dessus ;
- réseau / WebRTC.

Il n'y a aucun `Overlap Probe`, aucun arbitrage de pointeur V0.6.3.x et aucun changement du backend WebGPU/WASM.

## Test
Voir `PLAN_TEST_V0.6.4.0.md`.
