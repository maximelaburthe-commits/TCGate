# TCGate Alpha 0.1 Candidate 12.1

- Sérialise le Stage 1 SWU avec un latest-only single-flight, sans modification de Vision R14.
- Ignore les résultats et erreurs devenus stale après changement de track, génération ou sortie du pointeur.
- Déduplique les transitions `no-hovered-card`.
- Limite temporairement Table State à Cyberpunk ; SWU expose explicitement la mémoire comme désactivée.
- Sert les images d’affichage du CDN SWU via le proxy same-origin existant et journalise leur chargement ou échec.
- Ne modifie ni matcher, scoring, thresholds, descriptors, Stage 2, DB SWU, coarse index, K `[8,24,44]`, ni Cyberpunk Vision.
