# Test V0.6.3.2

Utiliser de préférence la même disposition benchmark que le test précédent.

1. Carte seule : détection + identification immédiates.
2. Deux cartes parfaitement alignées : la carte du dessus doit rester détectée et doit pouvoir être identifiée.
3. Survoler uniquement la bande visible de la carte du dessous : une sonde de chevauchement peut apparaître (overlay diagnostic) et tenter l’identification sans modifier la carte du dessus.
4. Deux cartes décalées : les deux détections YOLO normales restent prioritaires.
5. Crop important : vérifier qu’une mauvaise variante du même personnage n’est plus validée sur une seule observation.
6. Reflet : une identification réellement décisive reste acceptée selon la règle Recovery.
7. Chrome : la page de préparation doit tenir dans la hauteur de la fenêtre desktop sans scroll inutile.

À la fin, générer les deux rapports complets.
