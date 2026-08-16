# Plan de test V0.6.1

## Déploiement
Remplacer V0.6 sur GitHub par V0.6.1 puis attendre le redéploiement Railway.

Vérifier :
`/api/health`
→ version `0.6.1`

## Test ciblé
1. Lancer une partie entre les deux PC.
2. Attendre Vision active + calibration terminée.
3. Déplacer UNE même carte Cyberpunk dans une grille mentale 3×3 :
   - haut gauche / haut centre / haut droite
   - milieu gauche / centre / milieu droite
   - bas gauche / bas centre / bas droite
4. À chaque position, essayer de la survoler sur le PC adverse.
5. Répéter avec 2–3 cartes.
6. Produire ensuite volontairement :
   - léger reflet ;
   - reflet important qui rend une partie de la carte blanche.
7. Vérifier que sous reflet important le système préfère refuser plutôt que montrer
   une mauvaise carte.
8. Tester plein écran et carte HD.
9. Laisser tourner 5 à 10 min.
10. Générer les deux rapports complets.

## À me dire
- positions encore problématiques ;
- mauvaise carte malgré le garde reflet ;
- carte simplement refusée sous fort reflet (acceptable) ;
- éventuel changement de statut calibration ;
- fluidité générale.

Les grilles 3×3 du rapport permettront ensuite de savoir si un problème est
réellement lié à une zone de l'image.
