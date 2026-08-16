# TCG Webcam — V0.6.1 Vision robuste

Première intégration contrôlée de la Vision alpha15 dans la plateforme réseau.

Chaîne :
`flux adverse -> YOLO V5.3/512 -> tracking -> matcher alpha15 -> image HD`

Le flux local n'est jamais analysé.

## Railway
Même méthode que V0.5.2.
Ne pas oublier le nouveau fichier modèle :

`models/card_detector_v53_512.onnx`

## Healthcheck
`/api/health`

Doit retourner :
- version 0.6.1
- vision.integrated = true
- vision.modelPresent = true

## Test
Lire `PLAN_TEST_V0.6.md`.

## Sauvegardes
Les deux parents restent séparés :
- V0.5.2 réseau stable
- alpha15 Vision gelée

V0.6 est une branche d'intégration pré-alpha.


## V0.6.1
Correctif ciblé :
- synchronisation automatique des dimensions du flux WebRTC ;
- recalibration après changement de résolution ;
- garde anti-reflet ;
- rescue conservateur près des bords ;
- diagnostic spatial 3×3.

Lire `PLAN_TEST_V0.6.1.md`.
