# TCGate Alpha 0.1 Candidate 9 — UI Integration 1

## Objectif
Porter l'interface validée dans la vraie Candidate 9 sans modifier le cœur réseau ni le moteur Vision.

## Modifications visibles
- page d'accueil alignée sur la maquette TCGate validée ;
- header alpha réduit au logo sur l'accueil ;
- flux adverse prioritaire dans l'écran de partie ;
- webcam locale intégrée en bas à gauche comme un seul flux vidéo, y compris en plein écran ;
- micro et caméra déplacés dans la barre supérieure ;
- panneau latéral de carte réduit à l'emplacement HD + « Survolez une carte » ;
- l'image HD n'est plus dessinée dans le flux adverse normal ;
- délai de conservation de 1,2 s après sortie de la carte, annulé si le curseur entre dans le panneau HD ;
- clic sur la carte HD = zoom ;
- en plein écran : panneau HD interne au conteneur fullscreen, zoom interne, un seul flux local et un seul contrôle de sortie plein écran ;
- mode « Sans jeu » : rail Vision automatiquement masqué.

## Fichiers de cœur laissés inchangés
- `server.js`
- `public/vision-core.js`
- `public/vision-calibration.js`
- `public/detection-worker.js`
- `public/table-state-bridge.js`
- `public/table-state-engine.js`
- `public/identification.js`
- `public/identification-worker.js`
- modèle ONNX

L'intégration repose uniquement sur `public/index.html`, `public/tcgate-alpha.css`, `public/app.js` et un nouvel asset du hero.
