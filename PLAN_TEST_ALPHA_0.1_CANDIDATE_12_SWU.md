# Plan de test Candidate 12 — SWU

## A. Cyberpunk

1. Créer puis rejoindre une room Cyberpunk avec deux navigateurs.
2. Vérifier vidéo, audio, Vision, image identifiée et Gig Dice.
3. Vérifier les affichages `EXACT`, `SHARED` et `CANONICAL_ONLY` disponibles.

## B. Star Wars Unlimited

1. Créer puis rejoindre une room SWU et vérifier le titre du jeu des deux côtés.
2. Vérifier l'absence totale des Gig Dice.
3. Tester une Unit portrait, un Leader recto paysage et son verso portrait.
4. Vérifier l'affichage canonique immédiat, y compris avec une Hyperspace physique.
5. Si disponible, présenter une Showcase trois fois et vérifier sa promotion sans `printingId`.

## C. Sans jeu

1. Créer une room Sans jeu.
2. Vérifier que webcam/WebRTC fonctionnent sans DB ni runtime Vision.

## D. Recovery

1. Recharger une room SWU avec F5.
2. Vérifier que `star-wars-unlimited` est conservé et qu'aucun Gig Dice n'apparaît.
