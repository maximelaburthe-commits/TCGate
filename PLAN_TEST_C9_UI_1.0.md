# Plan de test — C9 UI 1.0

## 1. Parcours de base

1. Créer une partie Cyberpunk sur PC A.
2. Rejoindre le salon sur PC B.
3. Activer caméra et micro sur les deux postes.
4. Vérifier que les deux joueurs passent correctement en partie.
5. Vérifier que le flux adverse reste prioritaire et que le flux local apparaît en petit.

## 2. Aperçu local

1. Cliquer sur l’œil du flux local.
2. Vérifier que seul l’aperçu local disparaît : la caméra doit rester active chez l’adversaire.
3. Cliquer sur l’œil barré pour réafficher l’aperçu.
4. Répéter en plein écran.

## 3. Gig Dice — Cyberpunk

1. Vérifier la présence des 12 dés au total, répartis entre les deux zones.
2. Vérifier les formes D4/D6/D8/D10/D12/D20 issues du kit SVG.
3. Survoler un dé : les boutons `+` et `-` doivent rester cliquables.
4. Modifier plusieurs valeurs et vérifier le Street Cred.
5. Glisser un dé vers l’autre zone :
   - il change de contrôleur ;
   - il conserve sa couleur d’origine ;
   - le Street Cred des deux zones se recalcule.
6. Vérifier que le changement est reproduit sur l’autre PC.
7. Voler plusieurs dés d’un même côté et vérifier que les boîtes se redimensionnent sans entassement.
8. Déplacer le tracker avec la poignée.

## 4. Plein écran

1. Passer le flux adverse en plein écran.
2. Vérifier que le tracker reste visible et fonctionnel.
3. Glisser un dé : le dé en cours de déplacement doit rester visible.
4. Vérifier micro / caméra / sortie plein écran en haut de l’interface.
5. Déplacer le tracker et vérifier qu’il reste dans les limites de la fenêtre.

## 5. Vision / carte HD

1. Survoler une carte reconnue.
2. Vérifier le délai de 1,2 s après sortie de la carte physique.
3. Ouvrir le zoom depuis le panneau HD.
4. Vérifier que le bas de la carte n’est jamais rogné.
5. Répéter en plein écran.

## 6. Mode Sans jeu

1. Créer une partie `Sans jeu`.
2. Vérifier que :
   - le tracker Gig Dice est totalement absent ;
   - Vision reste désactivée ;
   - les flux vidéo, micro/caméra et plein écran continuent de fonctionner.

## 7. Régression technique

- Exécuter `npm run smoke`.
- Exécuter `node smoke-test-ui-integration.js`.
- Exécuter `node smoke-test-ui-v1.js`.
- Effectuer ensuite un test réel PC A / PC B avant de considérer cette UI comme candidate de déploiement public.
