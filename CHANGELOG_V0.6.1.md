# V0.6.1 — Vision robustness

Correctifs issus du premier test V0.6 réel.

## 1. Changement de résolution WebRTC
Le rapport V0.6 a montré un flux adverse démarrant en 640×360 puis passant en
1280×720. La géométrie Vision était auparavant initialisée une seule fois.

V0.6.1 :
- écoute l'événement `resize` du HTMLVideoElement distant ;
- resynchronise immédiatement le canvas/coordonnées Vision ;
- remet le tracking à zéro lors d'un changement de dimensions ;
- revérifie aussi la géométrie avant chaque inférence ;
- déclenche une nouvelle calibration après 900 ms de stabilité ;
- journalise tous les changements de géométrie.

## 2. Reflets
Ajout d'un garde anti-reflet sur le crop canonique :
- mesure de pixels proches de la saturation blanche ;
- mesure de concentration locale de la zone brillante ;
- risque `normal`, `moderate`, `high`.

Politique :
- risque high : identification refusée ;
- risque moderate : seuils score/marge renforcés ;
- priorité à une absence d'identification plutôt qu'à une mauvaise carte.

Le garde n'altère pas le matcher alpha15 lui-même.

## 3. Bords de l'image
Pas de baisse globale du seuil.
Une faible détection solitaire proche du bord peut être récupérée uniquement si :
- géométrie de carte stricte ;
- confiance proche du seuil ;
- centre dans les 14 % de bord ;
- confirmations supplémentaires.

## 4. Calibration
Une frame noire transitoire pendant un changement WebRTC ne provoque plus
une recalibration immédiate. Trois changements lumineux persistants sont requis.

## 5. Diagnostic spatial
Le rapport contient maintenant des grilles 3×3 :
- candidats YOLO bruts ;
- détections filtrées ;
- pistes confirmées ;
- zones survolées avec/sans piste.

Cela permettra d'identifier une vraie zone morte systématique.
