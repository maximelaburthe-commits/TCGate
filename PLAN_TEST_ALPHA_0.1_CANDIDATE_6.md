# Plan de test — TCGate Alpha 0.1 Candidate 6

## Test 1 — bouton prêt
1. Créer/rejoindre un salon.
2. Activer caméra et micro sur les deux PC.
3. Cliquer sur **Je suis prêt** sur un seul PC.
4. Vérifier que le bouton devient immédiatement **Attente de l’adversaire…** et reste verrouillé.

## Test 2 — lancement
1. Laisser le premier PC en attente.
2. Cliquer sur **Je suis prêt** sur le second PC.
3. Vérifier que les deux écrans passent presque immédiatement vers la partie.
4. Vérifier que le flux WebRTC s’établit normalement.

## Test 3 — vidéo de référence
- Chrome sur les deux PC.
- EMEET sur PC A et webcam intégrée sur PC B.
- Vérifier qu’aucune nouvelle latence perceptible n’apparaît.

## Rapport
Générer un rapport sur chaque PC. Les événements attendus incluent `ready-click`, `ready-ack` et `rtc-prewarm-end`.
