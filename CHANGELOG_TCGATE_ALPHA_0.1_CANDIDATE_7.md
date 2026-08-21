# TCGate Alpha 0.1 — Candidate 7

## Objectif
Transformer le socle C6 en plateforme réellement utilisable sans intégration Vision et terminer le comportement du lobby.

## Changements

### Mode « Sans jeu »
- nouveau choix `Sans jeu · webcam uniquement` lors de la création du salon ;
- le joueur qui rejoint hérite obligatoirement du mode choisi par le créateur ;
- aucun script Vision n'est chargé au chargement de la page ;
- les scripts Vision sont chargés dynamiquement uniquement lorsqu'un salon Cyberpunk en a besoin ;
- en mode Sans jeu : aucun modèle ONNX, aucune base de cartes, aucun worker de détection/identification, aucune calibration et aucune analyse du flux ;
- les éléments d'interface propres à Vision sont masqués ;
- le rapport indique explicitement `enabledForGame=false`, `assetsLoaded=false` sur une session Sans jeu fraîche.

### Lobby / prêt
- `Je suis prêt` devient immédiatement `Attente de l’adversaire…` ;
- l'état d'attente est gris, sans hover et réellement désactivé ;
- le statut local passe de `Préparation` à `Prêt` ;
- ajout d'un polling HTTP de secours toutes les 500 ms uniquement pendant l'attente du second joueur ;
- ce polling contourne les retards éventuels de propagation SSE/proxy observés sur Railway ;
- le polling s'arrête dès que l'adversaire est prêt, que la partie démarre ou que le salon est quitté.

### Réseau / vidéo / Vision
- logique WebRTC et adaptation vidéo de Candidate 6 conservées ;
- modèle, detection worker, Vision Core, identification et Table State inchangés ;
- aucune optimisation supplémentaire de latence dans cette candidate.
