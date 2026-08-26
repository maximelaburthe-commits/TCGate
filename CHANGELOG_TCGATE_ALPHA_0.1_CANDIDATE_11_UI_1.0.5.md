# TCGate Alpha 0.1 Candidate 11 · UI 1.0.5 — Visual Pass

## Base
Cette corrective part de `Candidate 11 · UI 1.0.4 corrective`.

## Portée
Strictement UI. Aucun changement prévu dans :
- WebRTC / signaling / ICE ;
- récupération F5 ;
- gestion caméra / micro ;
- Vision Engine ;
- identification / Table State ;
- modèles ONNX ;
- logique du Gig Dice.

## Correctifs
- Hero accueil réorienté vers la proposition de valeur TCGate, sans illustration de table.
- Nouveau message : « La plateforme webcam conçue pour les TCG ».
- Trois bénéfices courts : direct, cartes HD, interface pensée TCG.
- Illustration abstraite CSS : deux flux joueurs, portail TCGate et cartes.
- Poignée Gig : six points figés géométriquement, aucun déplacement au hover.
- Panneau Gig : nettoyage visuel léger, emplacement/drag inchangés.
- Zoom carte normal : suppression du panneau noir lourd.
- Zoom plein écran : suppression du fond noir opaque / contour parasite.
- Croix de fermeture repositionnée en haut à droite.

## Intégration
1. Ajouter `public/tcgate-alpha-ui-1.0.5.css`.
2. Appliquer `PATCH_INDEX_UI_1.0.5.diff` à `public/index.html`.
3. Ne modifier aucun autre fichier applicatif.
