# TCGate Alpha 0.1 — Candidate 4

## Point de départ

Candidate 4 repart de Candidate 3, sans modification du coeur TCG Vision Engine.

## Diagnostic Candidate 3 — salon RP6VSP

Sur le poste host :
- capture locale : 1920×1080 @ 30 fps ;
- sortie WebRTC au moment du rapport : 1920×1080 @ 13 fps ;
- `qualityLimitationReason = cpu` ;
- limitation CPU cumulée : ~258 s ;
- throttle Vision déjà monté à 1000 ms ;
- RTT : ~6 ms ;
- débit sortant disponible : ~4,4 Mbit/s.

Sur le poste guest :
- réception du flux host : 1920×1080 @ 12 fps ;
- pertes vidéo : 0 paquet au moment du rapport ;
- RTT : ~5 ms.

Conclusion : la latence/chute de fluidité n'est pas réseau. Candidate 3 protège trop
fortement la résolution 1080p et laisse l'encodeur s'effondrer en cadence.

## Correctifs Candidate 4

1. **Adaptation contrôlée du sender**
   - départ en résolution native ;
   - si la limitation CPU persiste 6 secondes et que la source dépasse 1280 px de
     large, application de `scaleResolutionDownBy` vers une cible 1280 px ;
   - pour 1920×1080 : facteur 1,5, soit une sortie 1280×720 ;
   - aucune descente automatique sous 720p.

2. **Priorité à la fluidité réelle**
   - le throttle Vision reste progressif ;
   - la réduction du sender intervient avant de laisser un 1080p tourner durablement
     à 12–13 fps ;
   - après adaptation, le profil 720p reste actif jusqu'à la prochaine session afin
     d'éviter les oscillations.

3. **Télémétrie latence**
   - ajout des champs WebRTC `jitterBufferDelay`, `jitterBufferTargetDelay`,
     `jitterBufferMinimumDelay`, `jitterBufferEmittedCount`, `totalDecodeTime`,
     `totalProcessingDelay` et `estimatedPlayoutTimestamp` lorsque disponibles ;
   - ajout des événements `rtc-video-sender-adaptation` et
     `rtc-cpu-protect-video` ;
   - le rapport expose le mode sender, le facteur d'échelle et les adaptations.

## Invariants

- modèle ONNX inchangé ;
- `detection-worker.js` inchangé ;
- Table State 0.1.6 inchangé ;
- seuils de détection/identification/anti-reflet inchangés.
