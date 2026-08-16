# UI V0.2.1 — Fullscreen card fix

Bug corrigé :
- lorsqu'un flux adverse était déjà en plein écran, le bouton d'agrandissement de la carte
  ouvrait une modal située en dehors de l'élément fullscreen ;
- le navigateur ne l'affichait donc qu'après la sortie du plein écran webcam.

Nouveau comportement :
- en vue normale : le bouton carte ouvre toujours la grande modal ;
- en plein écran webcam : le bouton agrandit la carte directement DANS le fullscreen webcam ;
- un second clic referme cette grande carte sans quitter le plein écran webcam ;
- quitter le plein écran webcam réinitialise automatiquement l'état agrandi.
