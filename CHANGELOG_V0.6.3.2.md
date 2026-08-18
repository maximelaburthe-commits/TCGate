# V0.6.3.2 — Non-Destructive Overlap Probe

- Le tracker principal reste celui de la Recovery/V0.6.2.
- Ajout d’une sonde secondaire non destructive autour d’une carte confirmée pour repérer une deuxième carte presque parfaitement alignée qui dépasse par le haut ou le bas.
- Une sonde ne peut ni supprimer, ni fusionner, ni déplacer une piste YOLO normale.
- Survol de la partie visible d’une sonde : identification masquée à partir des zones encore visibles.
- Si la carte du dessus devient difficile à identifier à cause du bord contaminé, un seul crop de secours tronque uniquement le bord orienté vers la carte suspectée.
- Première identification d’un crop chevauché/probe : 2 confirmations, 3 pour une famille possédant plusieurs variantes (ex. plusieurs Panam Palmer) ou sous reflet.
- Correction du numéro de version dans les rapports complets.
- Page de préparation compacte sur Chrome desktop afin d’éviter le scroll vertical sur les viewports bas.
