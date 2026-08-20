# Plan de test — TCGate Alpha 0.1 Candidate 4

## Objectif principal

Vérifier que le PC qui rejoint ne subit plus la latence du flux adverse lorsque le
poste host capture en 1920×1080.

## Test court recommandé

1. Déployer Candidate 4 sur Railway.
2. Reproduire les mêmes rôles :
   - PC host avec la EMEET en 1920×1080 ;
   - PC guest qui rejoint.
3. Laisser les deux webcams et microphones actifs.
4. Pendant 8 à 10 minutes :
   - déplacer régulièrement une main ou une carte devant la webcam host afin de
     voir immédiatement toute latence ;
   - utiliser normalement Vision sur le flux adverse ;
   - ne pas couper les webcams pendant ce premier test.
5. Vérifier visuellement :
   - fluidité du flux host vu depuis le guest ;
   - délai entre un geste réel et son apparition chez le guest ;
   - lisibilité lorsque la sortie passe éventuellement de 1080p à 720p.
6. Générer un rapport complet sur les deux PC.

## Résultat attendu

Si le host devient CPU-limité, Candidate 4 doit :
- détecter la pression CPU ;
- réduire le sender 1920×1080 vers ~1280×720 après environ 6 s ;
- remonter la cadence vers une valeur proche de 30 fps ;
- conserver la connexion directe et un RTT faible ;
- ne jamais tomber automatiquement sous 720p.

Le rapport guest doit idéalement montrer une réception proche de 1280×720 @ 25–30 fps
et permettre de mesurer le jitter buffer.

## Ne pas valider Candidate 4 si

- la latence reste nettement perceptible après le passage en 720p ;
- le flux tombe sous 720p ;
- Vision provoque une régression fonctionnelle ;
- la connexion WebRTC devient instable.
