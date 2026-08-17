# Plan de test V0.6.2

## But
Valider que les reflets naturels ne provoquent plus de changement instantané vers une mauvaise carte, sans dégrader les changements réels de carte.

## Installation
Remplacer V0.6.1 par V0.6.2 puis attendre le redéploiement. Vérifier `/api/health` :
- `version = 0.6.2`
- `vision.integrated = true`
- `vision.modelPresent = true`

## Test court anti-reflet (5 minutes maximum)
1. Poser une carte reconnue normalement.
2. La survoler jusqu’à obtenir son image HD.
3. Produire quelques reflets brefs et naturels en bougeant légèrement la carte / l’éclairage.
4. Vérifier que l’image HD ne bascule pas instantanément vers une autre carte.
5. Faire ensuite un vrai changement de carte au même emplacement et vérifier que la nouvelle identité finit bien par être acceptée.

Critère principal : **une mauvaise identité isolée ne doit jamais remplacer visuellement une identité stable.**

## Ensuite : vraie partie
Si le test court est bon, ne plus multiplier les tests artificiels. Faire une partie normale de 15 à 30 minutes avec :
- cartes posées normalement ;
- rotations ;
- déplacements ;
- équipements / chevauchements ;
- sleeves ;
- reflets naturels ;
- zoom/lecture HD ;
- réseau réel entre les deux joueurs.

À la fin, générer le **rapport complet**.

## Valeurs intéressantes dans le rapport
`vision.identification.identityStability` :
- `switchesSuppressed` : changements suspects bloqués ;
- `switchesConfirmed` : vrais changements validés ;
- `transientHolds` : frames incertaines absorbées sans faire disparaître la carte ;
- `holdsExpired` : cas où l’incertitude a duré trop longtemps ;
- `rechecks` : validations supplémentaires demandées ;
- `last` : dernier événement de stabilité.

## Décision
Si une partie de 15–30 minutes est jouable sans faux changement gênant, V0.6.2 peut servir de base à **Alpha Candidate 1**.
