# V0.6.3.3 — Pointer Ownership / Overlap Hover Arbitration

- Détection/tracking et Overlap Probe V0.6.3.2 inchangés.
- En zone où deux vraies cartes se chevauchent, le pointeur conserve la carte primaire déjà suivie au lieu de basculer selon la confiance YOLO.
- Si le pointeur arrive directement dans une zone ambiguë, arbitrage par proximité normalisée du centre puis confiance en départage.
- Un Overlap Probe ne peut être survolé que sur sa bande physiquement exposée ; sa zone estimée cachée sous la carte supérieure ne peut plus prendre le pointeur.
- Nouveaux compteurs de diagnostic dans le rapport complet.
