# TCGate — Alpha fermée 0.1 · Candidate 8

Candidate 8 repart strictement de Candidate 5. Le cœur Vision et la stratégie vidéo de C5 sont gelés.

## Objectif

Supprimer la sensation d'attente dans le salon lorsque les joueurs se déclarent prêts, sans mélanger ce correctif avec de nouveaux changements Vision.

## Candidate 8

- le clic sur **Je suis prêt** bascule immédiatement le bouton en **Attente de l’adversaire…** ;
- le bouton est verrouillé après validation pour éviter les doubles clics ;
- l’état prêt est optimiste côté interface puis confirmé par le serveur ;
- un ancien événement SSE ne peut plus remettre brièvement le bouton dans son état précédent pendant la requête ;
- la réponse de `/api/ready` est utilisée immédiatement comme état autoritaire du salon ;
- la connexion WebRTC est préchauffée discrètement dans le lobby dès que l’adversaire et la caméra sont présents ;
- aucune offre WebRTC n’est envoyée avant que les deux joueurs soient prêts ;
- les rapports mesurent désormais `ready-click`, `ready-ack` et `rtc-prewarm-*`.

Le modèle, Vision State, Vision Core et l’identification sont inchangés par rapport à Candidate 5.


## Candidate 8
Ajoute le mode **Sans jeu** (WebRTC pur, Vision non chargé) et termine le flux de préparation du lobby avec un fallback de synchronisation HTTP rapide.


## Candidate 8

Ajout du fallback TURN Cloudflare côté serveur, segmentation des rapports par salon et nettoyage des codes temporaires.
