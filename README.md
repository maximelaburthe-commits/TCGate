# TCG Webcam — V0.6.3 Occlusion / Overlap Robustness

Cette version part directement de la V0.6.2 anti-reflet validée.

## Objectif

Améliorer les cas de chevauchement sans modifier le modèle YOLO, le seuil général, le réseau ou l’UI.

## V0.6.3

- mémoire temporelle d’une carte confirmée lorsqu’une autre carte la recouvre ;
- maintien de sa géométrie tant qu’un occluder cohérent reste présent ;
- préservation de la géométrie connue lorsque YOLO ne renvoie plus qu’un crop partiel ;
- conservation prudente des secondes détections quasi alignées lorsqu’une carte stable ancre déjà la zone ;
- mémoire courte des nouvelles cartes détectées pendant leur insertion sous une carte connue (`partial-track birth`) ;
- identification masquée étendue jusqu’à 16 % de surface visible avec seuils plus stricts sous 20 % ;
- bonus visuel léger sur les zones de texte encore visibles (sans OCR externe) ;
- diagnostics d’occlusion ajoutés au rapport complet.

## Ce qui n’a pas changé

- modèle `card_detector_v53_512.onnx` ;
- `detection-worker.js` ;
- seuil général YOLO ;
- WebRTC / signalisation ;
- UI ;
- garde anti-reflet V0.6.2.

## Test

Lire `PLAN_TEST_V0.6.3.md`.

Healthcheck : `/api/health` doit retourner `version: 0.6.3`.
