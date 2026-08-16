# V0.4.2 — WebRTC negotiation fix

Correctifs issus des deux rapports V0.4.1 :

- verrouillage immédiat de l'entrée en partie (`gameEntering`);
- aucune récursion via `updateMediaUi -> applyRoomState -> enterNetworkGame`;
- une seule entrée `game-enter` par joueur;
- une seule offre WebRTC par partie;
- offre/réponse rendues idempotentes;
- offres/réponses dupliquées ignorées;
- hôte = unique offerer;
- seul l'hôte précrée les transceivers vidéo/audio;
- l'invité attache ses tracks aux transceivers créés par l'offre distante;
- réduction des risques d'incompatibilité de MID Firefox/Chrome;
- suppression de la double lecture vidéo lors des deux événements `ontrack`;
- conservation du layout Chrome V0.4.1;
- ajout `viewport.innerWidth/innerHeight` au rapport complet;
- ajout d'un état de négociation au rapport complet.

Les rapports V0.4.1 montraient ~2 422 entrées répétées côté invité
et ~4 929 erreurs d'offre côté hôte. Ce comportement ne doit plus exister.
