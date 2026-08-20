# Plan de test — TCGate Alpha 0.1 Candidate 2

## Objectif
Valider les trois correctifs d'intégration révélés par les rapports Candidate 1 :
qualité vidéo sous charge CPU, récupération caméra/micro et déduplication de
l'Atomic Handoff.

## Test principal
1. Utiliser les mêmes deux PC que pour Candidate 1 si possible.
2. PC A crée un salon, PC B le rejoint.
3. Activer caméra et micro sur les deux postes.
4. Vérifier que caméra **et** micro sont présents des deux côtés.
5. Jouer normalement 20 à 30 minutes, Vision active sur le flux adverse.
6. Survoler seulement les cartes réellement consultées.
7. Observer la fluidité générale et surtout la lisibilité du flux adverse.
8. À la fin, générer un rapport complet sur les deux PC.

## À vérifier dans le rapport
- `network.qualityControl.senderPolicyApplied` : idéalement `true` ;
- `network.qualityControl.cpuEpisodes` : les épisodes CPU éventuels sont datés et
  mesurés ;
- `network.qualityControl.currentVisionThrottleMs` : peut monter pendant une
  pression CPU puis doit revenir à 0 après récupération ;
- `network.webrtc.outbound[*].qualityLimitationDurations` présent si exposé par
  le navigateur ;
- aucune dégradation progressive durable du flux jusqu'à 640×360 comme dans le
  test Candidate 1 ;
- `media.localAudio` présent lorsque le microphone fonctionne ;
- `vision.identification.imageHandoff.telemetry.clearDeduplicated` peut être
  élevé, mais `clearCommitted` doit rester nettement inférieur à
  `clearRequested` en cas de nombreux pointer moves hors carte ;
- absence de flash de l'ancienne carte HD.

## Succès Candidate 2
- WebRTC reste stable ;
- la vidéo privilégie la résolution plutôt que de s'effondrer progressivement
  sous charge CPU ;
- Vision ralentit temporairement si nécessaire et récupère automatiquement ;
- caméra et microphone ne se neutralisent plus mutuellement lors du fallback ;
- aucun spam de `visible-card-cleared` frame après frame ;
- comportement de détection/identification au moins équivalent à Candidate 1.
