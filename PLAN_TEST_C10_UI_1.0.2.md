# Plan de test — Candidate 10 · UI 1.0.2 corrective

1. PC HP / Chrome / mise à l'échelle 125 % : entrer dans une partie Cyberpunk et vérifier que le panneau Gig ne chevauche plus le PiP local en bas à gauche.
2. Déplacer le panneau Gig, modifier des dés, puis vérifier que la position ne saute pas.
3. Passer en plein écran, déplacer le panneau, revenir au mode normal puis au plein écran : chaque contexte doit retrouver sa propre position.
4. En plein écran, survoler une carte puis agrandir l'image. Fermer le zoom avec le bouton × puis avec un clic sur le fond : le plein écran doit rester actif.
5. Vérifier que cliquer sur l'image agrandie la réduit également.
6. Retester le PC HP avec Chrome en économie d'énergie désactivée et comparer la fluidité. Exporter les deux rapports si la latence réapparaît.
7. Non-régression rapide : F5, coupure réseau, changement caméra/micro, Gig Dice synchronisés.
