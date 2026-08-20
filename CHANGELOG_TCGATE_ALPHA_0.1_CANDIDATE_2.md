# TCGate Alpha 0.1 — Candidate 2

Candidate 2 est une passe de durcissement de l'intégration à partir de Candidate 1.
Elle ne modifie ni le modèle de détection, ni les seuils d'identification, ni la
logique Vision State validée.

## WebRTC / qualité vidéo
- préférence d'encodage `maintain-resolution` appliquée au sender vidéo lorsque
  le navigateur l'accepte : pour TCGate, préserver la lisibilité d'une carte est
  prioritaire sur le maintien absolu des 30 fps ;
- détection des périodes `qualityLimitationReason = cpu` ;
- limitation adaptative de la cadence d'inférence Vision uniquement lorsque
  l'encodeur WebRTC signale une pression CPU persistante : 90 ms, 160 ms puis
  250 ms selon la durée ;
- retour automatique à la cadence normale après trois échantillons hors pression
  CPU ;
- rapport enrichi avec les durées WebRTC de limitation qualité, les changements
  de résolution et les épisodes CPU observés.

## Caméra / microphone
- le fallback après échec `getUserMedia(audio+video)` récupère désormais vidéo
  et audio indépendamment ;
- un échec d'allocation caméra ne doit donc plus transformer automatiquement une
  session en `video-only` lorsque le microphone est disponible ;
- fallback caméra 1080p puis 720p conservé.

## Atomic HD Handoff
- les demandes répétées de clear sur un état déjà vide sont dédupliquées ;
- un événement `tcg-identification-visible-cleared` n'est émis que lors d'un vrai
  changement d'état ;
- compteurs ajoutés au rapport : handoff demandés/validés et clear
  demandés/validés/dédupliqués.

## Inchangé
- `models/card_detector_v53_512.onnx` ;
- `public/detection-worker.js` ;
- seuils et filtres du détecteur ;
- seuils du matcher / anti-reflet ;
- Vision State `0.1.6-facewebcam-memory-hover` ;
- analyse uniquement du flux adverse ;
- philosophie precision-first.
