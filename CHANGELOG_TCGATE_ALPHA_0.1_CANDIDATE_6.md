# Changelog — TCGate Alpha 0.1 Candidate 6

## Salon / prêt
- UX optimiste : `Je suis prêt` devient immédiatement `Attente de l’adversaire…`.
- Double clic impossible une fois prêt.
- La réponse de `/api/ready` est appliquée immédiatement ; plus besoin d’attendre le prochain `room-state` SSE.
- Protection contre un snapshot SSE obsolète pendant la requête de prêt.

## Démarrage de partie
- Pré-chauffage du `RTCPeerConnection` dans le lobby lorsque les deux joueurs sont présents et que la caméra locale est prête.
- Le préchauffage ne négocie rien et n’envoie aucun média avant le lancement réel de la partie.
- Le host reste l’unique offerer lorsque les deux joueurs sont prêts.

## Télémétrie
- `ready-click`
- `ready-ack` avec durée de la requête
- `ready-error`
- `rtc-prewarm-start` / `rtc-prewarm-end` / `rtc-prewarm-error`

## Inchangé
- capture adaptative C5 ;
- modèle ONNX ;
- detection worker ;
- Vision Core ;
- identification ;
- Table State 0.1.6.
