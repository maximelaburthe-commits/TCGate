# TCGate Alpha 0.1 Candidate 10 · UI 1.0.2 corrective

Correctifs mineurs regroupés sur la Candidate 10, sans modification du pipeline WebRTC/Vision.

## Correctifs

- Gig Dice : placement par défaut déplacé hors de la zone du PiP local en bas à gauche, notamment sur les portables à faible hauteur utile.
- Gig Dice : la position choisie par glisser-déposer est mémorisée séparément en mode normal et plein écran pour la session, puis re-clampée lors d'un redimensionnement.
- Zoom carte en plein écran : ajout d'un bouton visible « × » et fermeture possible par clic sur l'arrière-plan du zoom, sans quitter le plein écran.
- La touche Échap reste gérée nativement par le navigateur pour quitter le plein écran ; le zoom n'en dépend plus.

## Non modifié

- WebRTC / TURN
- reprise F5 / fermeture d'onglet
- hot-plug caméra/micro
- Vision Engine et ses hashes gelés
- logique Gig Dice réseau
- politiques de qualité vidéo

## Latence PC HP

Les rapports du 24/08 montrent une émission du PC HP tombant à ~9–10 fps alors que le réseau reste sain. Un épisode CPU est détecté et Vision se throttle. Aucun correctif vidéo n'est introduit ici : retest demandé avec le mode économie d'énergie Chrome désactivé avant toute modification de la politique média.
