# TCG Webcam — V0.6.3.2 Non-Destructive Overlap Probe

Version expérimentale construite sur la Recovery V0.6.3.1.

Le chemin principal de détection reste celui de la V0.6.2 / Recovery : le modèle YOLO et `detection-worker.js` ne sont pas modifiés.

Chaîne principale :
`flux adverse -> YOLO V5.3/512 -> tracking principal -> identification -> validation temporelle -> image HD`

Couche secondaire :
`carte principale stable -> Overlap Probe -> hypothèse de carte alignée sous la carte -> identification masquée au survol`

## Règle de sécurité

L'Overlap Probe est strictement non destructif : une hypothèse secondaire ne peut ni supprimer, ni fusionner, ni déplacer une piste issue du détecteur principal.

## Identification

- carte isolée : acquisition rapide comme en V0.6.2 ;
- crop marqué comme chevauché / sonde secondaire : 2 confirmations avant validation ;
- plusieurs variantes du même personnage (ex. plusieurs Panam Palmer) : 3 confirmations en situation de crop risqué ;
- reflet + crop risqué : au moins 3 confirmations ;
- garde reflet Recovery conservée pour les résultats très décisifs ;
- si la carte du dessus devient difficile à identifier à cause d'un bord contaminé, un crop de secours tronque uniquement le bord orienté vers la carte suspectée.

## Chrome

La page de préparation a une mise en page responsive en hauteur (`100dvh` + mode compact sur petits viewports desktop) afin de limiter le scroll vertical sous Chrome.

## Rapport complet

Le rapport est maintenant correctement marqué `0.6.3.2` et inclut les statistiques `overlapProbe`.

## Test

Lire `PLAN_TEST_V0.6.3.2.md`.
