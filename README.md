# TCG Webcam — V0.6.2 Stabilité d’identité anti-reflet

Évolution ciblée de V0.6.1. Aucun changement du réseau, du seuil général YOLO, du modèle V5.3/512 ni de la logique de chevauchement.

Chaîne :
`flux adverse -> YOLO V5.3/512 -> tracking -> matcher alpha15/16 -> validation temporelle -> image HD`

Le flux local n'est jamais analysé.

## V0.6.2

Objectif : empêcher une mauvaise identification très brève, notamment sous reflet, de remplacer immédiatement une carte déjà reconnue.

Comportement :
- première identification : immédiate comme en V0.6.1 ;
- même identité retrouvée : validation immédiate ;
- nouvelle identité sur une piste déjà stable : 2 confirmations consécutives ;
- nouvelle identité sous risque de reflet modéré : 3 confirmations consécutives ;
- frame incertaine/reflet fort : l'ancienne carte reste affichée pendant une courte fenêtre de grâce ;
- si l'incertitude persiste au-delà de cette fenêtre, l'identification est retirée plutôt que de conserver une carte potentiellement fausse ;
- les validations/suppressions sont ajoutées au rapport complet.

## Ce qui reste gelé

- réseau / WebRTC ;
- modèle YOLO `card_detector_v53_512.onnx` ;
- seuil général de détection ;
- filtres Table-Aware ;
- logique de chevauchement / masque ;
- UI existante.

## Railway
Même méthode que V0.6.1.

Healthcheck : `/api/health` doit retourner `version: 0.6.2`.

## Test
Lire `PLAN_TEST_V0.6.2.md`.
