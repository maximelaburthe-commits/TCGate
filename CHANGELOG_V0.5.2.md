# V0.5.2 — Local camera ratio fix

Correctif issu du test Railway Firefox/Chrome.

Chrome test :
- viewport : 1536 × 695
- caméra locale : 1280 × 720 / 30 FPS
- aucun overflow vertical

Le flux était bien 16:9, mais son conteneur local était forcé dans une ligne
trop basse.

Correctifs :
- la petite webcam locale conserve strictement un conteneur 16:9 ;
- la hauteur est dérivée de la largeur disponible ;
- `object-fit: contain` évite toute impression de recadrage/déformation ;
- la ligne locale de la sidebar devient `auto` ;
- adaptation supplémentaire pour les viewports desktop <= 760 px de haut ;
- aucune modification du grand flux adverse ni de WebRTC.
