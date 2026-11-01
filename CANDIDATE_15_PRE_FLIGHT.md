# Candidate 15 — pre-flight après Maintenance 1.2D

Préparation uniquement, 1er novembre 2026. Aucun merge C14, promotion, modification Railway ou changement produit effectué. **Candidate 15 reste bloquée** par les réconciliations et qualifications ci-dessous ; le succès du jalon documentaire 1.2D ne constitue pas une qualification Candidate 15.

## Git

Snapshot après `git fetch origin --prune`, worktree propre, avant intervention :

| Branche distante | SHA vérifié |
| --- | --- |
| `main` | `f5f2ba00e178f58c011c87f788c9c56064d8c32a` |
| `candidate/alpha-0.1-c14` | `c4adb95bacfe137d9f3f07cae0d3540e1aabf5c3` |
| `update/next` | `e1455cbff845baf90e3fb8a027b5f59c33d571cf` |
| `workspace-state` | `1ac77efebd86d1e5bc14c5cc18771de4456f2587` |

Le commit `chore(project): prepare legacy infrastructure decommission` ajoute cette préparation sur `update/next` seulement. Son SHA final est celui du commit contenant ce document, communiqué dans le reçu de livraison ; le snapshot ci-dessus reste volontairement daté avant ce commit, sans SHA auto-référentiel. Avant une future promotion, refaire le fetch, les diffs et toute la qualification sur le SHA alors gelé.

## Diff mesuré

Comparaisons directes des arbres, au SHA de départ `e1455cbff845baf90e3fb8a027b5f59c33d571cf` :

| Comparaison | Fichiers | Ajouts / modifications / suppressions | Lignes + / − | Commits exclusifs gauche / droite |
| --- | ---: | --- | --- | --- |
| `main → update/next` | 81 | 56 / 23 / 2 | 5061 / 735 | 0 / 18 |
| `C14 → update/next` | 87 | 56 / 26 / 5 | 5071 / 911 | 1 / 18 |

Merge-base commun : `f5f2ba00e178f58c011c87f788c9c56064d8c32a`. Mesures obtenues avec `git diff --numstat`, `git diff --name-status` et `git rev-list --left-right --count`. Les ajouts documentaires/tests 1.2D viennent en supplément ; leurs métriques finales sont consignées dans `PROJECT_DECOMMISSION_1_2D_VALIDATION.txt`.

## C14 : changements réels à réconcilier

Un seul commit C14 n'est pas dans `update/next` : `c4adb95bacfe137d9f3f07cae0d3540e1aabf5c3`, `release: prepare TCGate Alpha 0.1 Candidate 14` (10 fichiers, +182/−16). Ne pas fusionner ce commit aveuglément : il contient aussi un ancien parcours de qualification Control Center retiré en 1.2A.

| Différence C14 réelle | Fichiers | Travail Candidate 15 attendu |
| --- | --- | --- |
| Privacy Report Schema renforcée | `public/report-diagnostics-v2.js`, `report-schema-v2-test.js` | Réconcilier sanitation des URLs HTTP/WSS complètes, cookies/credentials, IPv4 avec ports, IPv6 compressées, SDP et ICE ; reprendre les 58 lignes de cas adversariaux et leurs garanties |
| Purge du cache TURN | `server.js`, `turn-cache-test.js` | Reprendre la purge des entrées expirées et des pairs de rooms expirées ; conserver les tests dédiés, absents de cette branche |
| Qualification globale | `ALPHA_QUALIFICATION.md`, `package.json` | Adapter `qualify:alpha` au runtime actuel ; il appelle encore `test:control-center-forwarder`, supprimé en 1.2A. Inclure les nouvelles suites UI, mail, Phone et hygiène |
| Identification de release | `package.json`, `package-lock.json`, `server.js`, `public/app.js`, `README.md`, `RELEASE_TCGATE_ALPHA_0.1_CANDIDATE_14.md` | Préparer l'identité Candidate 15 de manière cohérente. Le runtime update reste C13/UI 1.2 pour ce chantier |

Report Schema V2 et ses tests restent présents ; leur succès actuel ne prouve pas que les renforcements C14 manquants sont déjà intégrés. Aucune de ces réconciliations n'est implémentée par Maintenance 1.2D.

## Infrastructure

Inventaire Railway obtenu en lecture seule au jalon. Aucun outil d'écriture, déploiement manuel, variable ou secret lu/modifié. Aucun changement en attente n'était signalé dans les sept environnements inventoriés.

| Ressource | État actuel vérifié | Condition / cible |
| --- | --- | --- |
| `TCGate_platform / production / TCGate` | Source `candidate/alpha-0.1-c14`, dernier déploiement observé SUCCESS | Bloquant Candidate 15 : **Production source must be realigned to main during Candidate 15 promotion.** |
| `TCGate_platform / Test / TCGate` | Source `update/next`, dernier déploiement observé SUCCESS | Conserver la branche ; le push normal peut déclencher le déploiement automatique Test |
| `report-schema-v2-qualification / TCGate-report-schema-v2` | Service historique encore présent, source non renseignée par l'inventaire, sans volume | **SAFE TO DECOMMISSION** pour les dépendances du dépôt actuel ; tests Report Schema V2 conservés |
| `TCGate_Control_Center` | Trois environnements, trois apps, trois Postgres, six volumes, un bucket encore présents | Décommissionnement préparé ; Production C14 contient encore le bridge. Attendre retrait effectif de ce consommateur lors de Candidate 15 et vérification des autres consommateurs |
| `TCGate-camera-phone / TCGate-Phone-Camera-Lab` | Standalone historique présent, sans volume | **Legacy standalone — superseded by integrated Phone Camera 1.2C** ; attendre le PASS Chrome Android physique |
| `tcgate-volume /data` | Montage déclaré dans Production et Test | Aucun besoin runtime update ; ne pas appliquer ce verdict au code C14. Retrait manuel ultérieur après réalignement Production et contrôle de la portée du volume et des données historiques |

La même identité de volume `d98102d5-9a88-4b7d-9623-8ffc8c1d4587` est renvoyée pour les deux environnements : ne pas supposer deux suppressions indépendantes à partir de ce seul inventaire. Aucun contenu de volume n'a été lu.

Le détail des ressources et leurs conditions individuelles figure dans [PROJECT_DECOMMISSION_1_2D.md](PROJECT_DECOMMISSION_1_2D.md). `railway.json` reste inchangé.

## Conditions avant promotion

- Réconcilier les différences C14 ci-dessus, sans réintroduire runtime Control Center ni ancien pipeline.
- Geler un SHA Candidate 15 et exécuter une qualification globale adaptée, y compris privacy Report V2 et cache TURN.
- Qualifier le produit sur Railway Test ; les tests locaux ne certifient pas la livraison Resend réelle ou les équipements physiques.
- Conserver Phone standalone jusqu'à **physical Chrome Android qualification PASS** et décision de retrait séparée.
- Réaligner la source Production vers `main` **au moment de la promotion Candidate 15**, puis vérifier l'identité réellement déployée. Ne pas promouvoir dans 1.2D.
- Traiter les données et autres consommateurs des ressources legacy avant toute suppression ultérieure.
- Mettre à jour séparément le Workspace à partir du SHA final et des preuves réelles, sans merger ou déployer `workspace-state`.

Les langues physiques par joueur sont une décision d'architecture **post-Candidate 15**, documentée dans [PROJECT_ARCHITECTURE.md](PROJECT_ARCHITECTURE.md), pas une condition d'implémentation ajoutée à cette Candidate.
