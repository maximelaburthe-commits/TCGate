# TCGate — Alpha fermée 0.1 · Candidate 4

Candidate 4 repart strictement de Candidate 3 après analyse des deux rapports du 20/08/2026 (salon RP6VSP).

## Motif du correctif

Le PC qui rejoint recevait le flux adverse en 1920×1080 mais seulement à ~12 fps.
Le poste host encodait son 1080p à ~13 fps avec `qualityLimitationReason: cpu`
pendant plus de 4 minutes cumulées, alors que le RTT était de 5–6 ms et les pertes
réseau quasi nulles. La latence perçue est donc liée à la saturation de l'encodeur,
pas au réseau.

## Candidate 4

- conserve le 1080p natif tant que l'encodeur tient la charge ;
- après 6 s de limitation CPU persistante, réduit explicitement le sender vers une
  classe 1280×720 plutôt que de conserver un 1080p lent ;
- ne descend jamais automatiquement sous 720p ;
- conserve le throttle Vision comme protection secondaire ;
- garde le profil 720p pour le reste de la session après une adaptation afin
  d'éviter les oscillations ;
- ajoute au rapport les statistiques de jitter buffer / délai de traitement
  lorsque le navigateur les expose ;
- ne modifie pas le détecteur, le matcher, Table State ni les seuils Vision.

Le principe produit reste : la vidéo fluide et lisible est prioritaire sur la cadence
de détection.
