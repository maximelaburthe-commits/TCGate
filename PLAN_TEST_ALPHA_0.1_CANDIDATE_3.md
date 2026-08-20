# Plan de test — TCGate Alpha 0.1 Candidate 3

## But

Vérifier que Candidate 3 conserve les gains de C2 tout en supprimant le travail Vision inutile lorsque la caméra adverse est coupée et en réduisant davantage la pression CPU persistante.

## Test recommandé

1. Déployer Candidate 3 sur Railway.
2. Refaire un test à deux PC de 15 à 20 minutes.
3. Garder les deux caméras actives au moins 5 minutes et manipuler/survoler plusieurs cartes.
4. Sur le PC B, couper la caméra pendant 60 à 90 secondes puis la réactiver.
5. Vérifier côté PC A que Vision affiche sa pause puis reprend après la réactivation.
6. Refaire quelques détections/survols après reprise.
7. Exporter un rapport complet sur les deux PC.

## Points à contrôler dans les rapports

- `network.webrtc.outbound.video.frameWidth/frameHeight` : pas de chute de résolution.
- `network.qualityControl.cpuEpisodes` : durée plus courte ou récupération observée.
- `vision.detector.performanceBudget.productThrottleMs` : peut monter jusqu'à 1000 ms sous pression prolongée.
- `vision.detector.performanceBudget.inputPaused` / `inputPauseReason` : pause sur `remote-camera-off`.
- `media.remoteMediaState` : état caméra/micro adverse reçu correctement.
- `vision.identification.imageHandoff.telemetry.handoffDeduplicated` : compteur supérieur à 0 lors de survols stables.
- audio local et distant toujours présents après fallback média.

## Critère de passage

Candidate 3 est acceptable pour poursuivre l'alpha si la résolution reste stable, si Vision cesse réellement d'inférer pendant une coupure caméra adverse, si la reprise fonctionne sans reset du moteur complet, et si aucun nouveau clignotement de carte HD n'apparaît.
