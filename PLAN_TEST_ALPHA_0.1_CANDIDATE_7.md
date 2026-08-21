# Plan de test — TCGate Alpha 0.1 Candidate 7

## Test A — lobby Cyberpunk
1. Ouvrir TCGate sur deux PC, idéalement Chrome/Chrome.
2. Créer un salon Cyberpunk et le rejoindre.
3. Activer caméra + micro sur les deux PC.
4. Cliquer `Je suis prêt` sur le premier PC.
5. Vérifier immédiatement : bouton gris, non cliquable, texte `Attente de l’adversaire…`.
6. Attendre 2 à 3 secondes puis cliquer `Je suis prêt` sur le second PC.
7. Le premier PC doit entrer en partie en moins d'environ 1 seconde, sans l'attente de plusieurs secondes observée en C6.
8. Vérifier le flux et Vision sans chercher à optimiser davantage la latence.

## Test B — Sans jeu
1. Créer un nouveau salon avec `Sans jeu · webcam uniquement`.
2. Le deuxième joueur rejoint uniquement avec le code : aucun choix de jeu ne doit lui être demandé.
3. Vérifier que le salon affiche `Sans jeu · webcam uniquement`.
4. Lancer la partie.
5. Vérifier webcam, micro, plein écran et sortie de salon.
6. Vérifier que les panneaux Vision / carte survolée ne sont pas affichés.
7. Générer un rapport complet sur les deux PC.

### Critère technique Sans jeu
Dans un rapport d'une page fraîche ouverte directement en Sans jeu :
- `vision.enabledForGame = false`
- `vision.assetsLoaded = false`
- `calibration.status = disabled`
- `vision.detector = null`
- `vision.identification = null`
- `vision.tableState = null`

## Rapports à fournir
- deux rapports du test lobby Cyberpunk ;
- deux rapports du test Sans jeu.
