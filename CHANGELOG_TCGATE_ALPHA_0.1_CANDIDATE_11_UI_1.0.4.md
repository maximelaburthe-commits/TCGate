# TCGate Alpha 0.1 Candidate 11 · UI 1.0.4 corrective

## Pourquoi cette corrective

Les tests physiques de Candidate 11 ont validé la reprise/réseau, mais les correctifs visuels UI 1.0.3 n'ont pas produit l'effet attendu sur le poste HP et en plein écran.

Cette révision est **UI-only**. Elle ne modifie ni le signaling, ni WebRTC, ni la récupération C11, ni le pipeline vidéo, ni les fichiers du moteur Vision gelé.

## Correctifs

### Accueil / faible hauteur
- mise en page basée sur `100dvh` pour les écrans desktop avec faible hauteur utile ;
- variante dédiée <= 710 px de hauteur CSS (le rapport HP observé est ~695 px) ;
- réduction contrôlée du header, du titre, des actions et des étapes ;
- suppression des descriptions d'étapes dans ce mode afin d'éviter les collisions ;
- prise en compte compacte de la carte « Reprendre la partie ».

### Gig Dice
- nouvelle clé de position `v3` : les anciennes positions C10/C11 ne sont plus réutilisées ;
- validation de chevauchement uniquement lorsque le panneau a une taille réelle (plus de validation à `offsetWidth=0`) ;
- placement différé sur plusieurs `requestAnimationFrame` après rendu ;
- position par défaut calculée depuis les rectangles réels du panneau, du conteneur et du PiP ;
- recalcul sur resize et `visualViewport.resize`.

### Poignée de déplacement
- les six points sont maintenant dessinés par un unique pseudo-élément CSS ;
- états hover/active/focus neutralisés pour position, transform, bordure et shadow ;
- le survol ne doit plus faire bouger les points.

### Plein écran
- root fullscreen forcé bord à bord ;
- suppression explicite du `box-shadow !important` hérité par la carte agrandie ;
- backdrop, radius, outline, clip et shadow neutralisés.

## Non modifié
- Candidate 11 réseau/recovery ;
- gestion caméra/micro ;
- orchestration Vision C11 ;
- fichiers Vision gelés ;
- Phone Camera Lab ;
- rapports par mail (réservés à l'alpha privée).
