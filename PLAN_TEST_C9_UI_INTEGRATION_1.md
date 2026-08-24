# Plan de test — C9 UI Integration 1

## 1. Accueil
- vérifier le logo seul dans le header ;
- vérifier la composition texte à gauche / deux tables + portail à droite ;
- tester « Créer une partie » et « Rejoindre une partie ».

## 2. Création / salon
- Cyberpunk : créer un salon, activer webcam + micro, copier le lien ;
- Sans jeu : créer un salon et vérifier que Vision ne se charge pas ;
- rejoindre depuis un second PC et valider le passage « Je suis prêt ».

## 3. Partie réseau
- confirmer que le grand flux est bien le flux adverse réel ;
- confirmer que le petit flux en bas à gauche est le flux local réel ;
- couper/réactiver micro et caméra depuis la barre supérieure ;
- vérifier que la reprise réseau Candidate 9 fonctionne comme avant.

## 4. Vision / carte HD
- survoler une carte adverse reconnue : elle doit apparaître uniquement dans le rail droit ;
- quitter la carte : elle doit rester environ 1,2 s ;
- déplacer le curseur vers le rail pendant ce délai : la disparition doit être annulée ;
- quitter ensuite le rail : le délai repart ;
- cliquer sur l'image HD : zoom modal ;
- vérifier qu'une nouvelle carte remplace proprement l'ancienne.

## 5. Plein écran
- passer le flux adverse en plein écran ;
- vérifier qu'il n'existe qu'un seul petit flux local ;
- vérifier qu'il n'existe qu'un seul bouton de sortie plein écran ;
- vérifier micro/caméra dans la barre interne du plein écran ;
- survoler une carte : le panneau HD doit apparaître à droite ;
- cliquer sur la carte HD : zoom interne ; recliquer pour revenir.

## 6. Diagnostic
- générer un rapport complet depuis le salon puis depuis la partie ;
- vérifier que les indicateurs Calibration / Vision / Mémoire restent présents pendant l'alpha.
