# V0.6.3 — Occlusion / Overlap Robustness

## Ajouts

- mémoire d’occlusion pour les tracks confirmés ;
- conservation de la géométrie amodale lorsqu’un crop se réduit sous chevauchement ;
- `partial-track birth` pour les cartes glissées directement sous une carte déjà connue ;
- assouplissement local et historique de la suppression de doublons pour les cartes quasi alignées ;
- matcher masqué autorisé à partir de 16 % de zone visible avec garde renforcée ;
- signature visuelle faible des zones titre/texte comme aide au matcher masqué ;
- métriques d’occlusion et de chevauchement dans le rapport complet.

## Invariants conservés

Aucun changement du modèle YOLO, du seuil général, du worker de détection, du réseau ni de l’UI.
