# TCGate Alpha 0.1 Candidate 9 — UI 1.0

Base technique : **Candidate 9 + UI Integration 1**.

## Intégration UI

- Conservation de la page d’accueil et du parcours Créer / Rejoindre déjà intégrés à C9.
- Polissage final de l’interface de partie en conservant le flux adverse comme surface principale.
- Aperçu local masquable/réaffichable avec une icône œil, sans désactiver la piste caméra WebRTC.
- Contrôles plein écran maintenus dans le chrome supérieur, hors de la zone du tracker.
- Zoom carte réadapté pour afficher l’image complète (`object-fit: contain`) en mode normal et plein écran.

## Module Cyberpunk — Gig Dice

Le tracker Gig Dice est **strictement spécifique à Cyberpunk TCG** :

- visible uniquement si `game === "cyberpunk"` ;
- absent en mode `no-game` / Sans jeu ;
- absent pour tout autre TCG futur tant qu’aucun module spécifique n’est prévu.

Fonctions intégrées :

- vrais assets SVG D4 / D6 / D8 / D10 / D12 / D20 issus du kit fourni ;
- deux zones de possession dynamiques qui se poussent selon le nombre de dés contrôlés ;
- couleur du dé liée à son propriétaire d’origine, et conservée après un vol ;
- modification de valeur via `+ / -` au survol ;
- vol/transfert par glisser-déposer vers l’autre zone ;
- recalcul immédiat du Street Cred ;
- tracker déplaçable ;
- tracker conservé en mode plein écran ;
- fantôme de glisser-déposer visible en plein écran.

## Synchronisation réseau des Gig Dice

Ajout d’un signal applicatif léger `gig-state` sur le canal de signalisation C9 existant.

- Le serveur ne stocke pas les dés.
- Les deux clients synchronisent les valeurs, la possession et l’origine des 12 dés en direct.
- L’hôte envoie l’état initial ; l’invité peut demander une resynchronisation.
- L’état est aussi conservé dans `sessionStorage` avec la session de salon pour faciliter une reprise de page.

Cette extension ne modifie pas la logique WebRTC de média, TURN/STUN, ICE, Vision, détection ou identification.

## Cœur Vision préservé

Les hashes de référence Candidate 9 restent identiques pour :

- `models/card_detector_v53_512.onnx`
- `public/detection-worker.js`
- `public/table-state-engine.js`
- `public/vision-core.js`
- `public/identification.js`
