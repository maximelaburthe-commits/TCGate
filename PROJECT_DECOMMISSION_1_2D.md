# TCGate — préparation du décommissionnement 1.2D

Date : 1er novembre 2026. Dépôt `maximelaburthe-commits/TCGate`, branche exclusive `update/next`. SHA de départ vérifié après fetch : `e1455cbff845baf90e3fb8a027b5f59c33d571cf`, worktree propre. Ce jalon ajoute des contrôles et remet la documentation en accord avec le runtime. Aucune ressource Railway, BDD, branche protégée ou fonction produit n'est modifiée.

## Audit legacy

Recherche sur tout le dépôt suivi au SHA de départ des termes demandés : `Control Center`, `control-center`, `CONTROL_CENTER`, `TCGATE_CC`, `REPORT_INBOX`, `Phone Camera Lab`, `TCGate-camera-phone`, `TCGate-Phone-Camera-Lab`, `report-schema-v2-qualification`, `/data`, `Candidate 14` (sans distinction de casse). L'inventaire par occurrence est conservé dans `PROJECT_LEGACY_AUDIT_1_2D.md` ; les nouvelles mentions de ce rapport sont documentaires.

| Classe | Résultat et traitement |
| --- | --- |
| Runtime encore nécessaire | `data/control-center-update-candidate.json`, dans `public/workspace-database-maintenance-model.js:7`, est un **artefact BDD distant** lu sur GitHub à SHA fixé, pas un service Control Center. Conserver le chemin et sa fixture |
| Documentation historique | Changelogs, rapports de qualification et journaux de retrait CC/Phone/C14 conservés. Les anciens manuels Candidate 11 et références Phone standalone sont explicitement marqués historiques |
| Documentation devenue fausse | `UPDATE_WORKFLOW.md` présentait Production → main comme situation actuelle ; corrigé en distinguant Production C14 et cible Candidate 15. `DEPLOY_RAILWAY.md` présentait le health C11 sans statut d'archive ; contexte rétabli |
| Test historique / garde de non-régression | Les noms retirés restent dans les tests qui exigent leur absence ou leurs routes 404 ; conserver ces gardes |
| Référence supprimable | Aucun import, forwarder, route ou accès disque legacy restant à supprimer dans le runtime actuel |

Les occurrences `/database-*.js` sont des URLs de scripts, sans accès au montage `/data`. Un éventuel signal binaire du modèle ONNX n'est pas une référence source à une infrastructure ; le modèle livré est conservé.

## Control Center et rapports

Le runtime audité ne contient ni import Control Center, ni route `/api/control-center/*`, ni forwarder, ni inbox disque. Aucune lecture de `CONTROL_CENTER_URL`, `CONTROL_CENTER_INGEST_KEY`, `TCGATE_CC_SYNC_TOKEN` ou `TCGATE_REPORT_INBOX_DIR` n'est présente. Le nouveau test `project-hygiene-1.2d-test.js` interdit leur retour dans le périmètre runtime, avec contrôles négatifs du détecteur.

Les rapports passent uniquement par le bridge Resend pour leur envoi : frontend → ZIP Report Schema V2 → `POST /api/report-email` → validation → Resend. La génération/export local du ZIP reste possible indépendamment de l'envoi. Les tests V2, fixture redacted, diagnostics indépendants, UI Rapport et protections du bridge restent intacts.

**Limite Production :** le code `candidate/alpha-0.1-c14` contient encore les quatre variables legacy, l'import du forwarder et l'inbox dans `report-mail-server.js`. Les valeurs déployées ne sont pas consultées. L'absence de dépendance dans `update/next` ne permet pas de supprimer maintenant l'infrastructure susceptible de servir C14.

## Audit exact du filesystem runtime

Chaîne de démarrage : `railway.json` → `npm start` → `report-mail-server.js:405` → `server.js`. Imports locaux QRCode et Phone inclus dans l'audit ; aucune dépendance externe npm n'est déclarée.

| Accès runtime | Emplacement au départ | Nature | Besoin persistant |
| --- | --- | --- | --- |
| `fs.readFile(file)` | `server.js:577`, racine `public/` déclarée ligne 15 | Lecture d'assets, HTML/JS/CSS, JSON et corpus livrés avec le code | Aucun volume ; fichiers de l'image déployée |
| `fs.stat(MODEL_FILE)` | `server.js:768` | Métadonnées du modèle ONNX livré dans `models/` | Aucun volume |
| `fs.createReadStream(MODEL_FILE)` | `server.js:776` | Envoi du modèle ONNX suivi Git | Aucun volume |
| Rapports ZIP | Bridge : Buffer puis HTTPS Resend | Mémoire seulement, aucune inbox | Aucun |
| Rooms, sessions, recovery, Phone et TURN | Maps et objets de `server.js` | Mémoire volatile | Aucun |
| Préférences/cache Vision/brouillons et exports | Stockage navigateur, Blob et téléchargements client | Côté joueur, hors filesystem Railway | Aucun volume serveur |

Recherche des lectures/écritures et variantes sync, promises et alias : aucun `writeFile`, `appendFile`, `mkdir`, `createWriteStream`, écriture FS, stockage temporaire serveur ou `RAILWAY_VOLUME*` dans le runtime. Le seul import filesystem est `fs` dans `server.js`, avec les trois appels ci-dessus. Les scripts de test utilisent des fichiers temporaires pour leurs fixtures ; ils ne constituent pas le stockage du produit.

```text
TCGate persistent volume requirement: NONE
```

Ce verdict concerne le code `update/next` audité. Le volume Railway peut être retiré pour cette architecture, **après** vérification du contenu historique, de la portée de l'opération et de ses consommateurs. Le runtime Production C14 conserve l'ancien chemin inbox optionnel. Aucune donnée du volume n'est lue, migrée ou supprimée ici.

## Qualification Report Schema legacy

Aucune URL, commande, script runtime ou procédure courante de ce dépôt ne dépend de `TCGate-report-schema-v2` ou de son environnement dédié. Les références historiques éventuelles restent des archives. Les suites V2 du dépôt principal restent la base technique de qualification courante.

```text
report-schema-v2-qualification:
SAFE TO DECOMMISSION
```

Il s'agit du verdict de dépendance pour le dépôt courant, pas d'une suppression effectuée ni d'un audit des consommateurs extérieurs au dépôt. L'inventaire Railway confirme que le service historique existe encore, sans volume ; sa source n'est pas renseignée par cet inventaire.

## Matrice des ressources

Inventaire Railway en lecture seule : `list_projects`, `list_services`, `describe_environment` pour les sept environnements TCGate concernés. Aucun secret, valeur de variable, contenu de volume, écriture ou déploiement manuel. Les ressources ci-dessous sont présentes (`live`) et aucun changement staged n'est signalé à l'instant de l'audit. Les noms désignent l'état observé, sans instruction de suppression automatique.

| Resource | Current state | Needed? | Removal condition | Target state |
| --- | --- | --- | --- | --- |
| `TCGate_platform / production / TCGate` | Source `candidate/alpha-0.1-c14`, dernier déploiement SUCCESS | Oui | Ne pas supprimer ; réaligner lors de Candidate 15 | Production → main |
| `TCGate_platform / Test / TCGate` | Source `update/next`, dernier déploiement SUCCESS | Oui | Conserver | Test → update/next |
| `TCGate_platform / report-schema-v2-qualification / TCGate-report-schema-v2` | Legacy, sans volume | Non pour le dépôt courant | SAFE TO DECOMMISSION ; retrait ultérieur distinct, conserver preuves utiles | Environnement/service retirables |
| `TCGate_platform / tcgate-volume`, montage `/data` en Test et Production | 5000 Mio déclarés ; même ID renvoyé dans les deux environnements | Non pour update ; C14 à traiter | Attendre réalignement Production et fin du bridge legacy ; vérifier portée environnementale, données historiques et autres consommateurs | Aucun volume applicatif requis |
| `TCGate_Control_Center / production / TCGate-Control-Center` | App legacy source main, avec volume | Pas pour update ; consommateur C14 possible | Attendre retrait du bridge Production lors de C15 et vérification des autres consommateurs | Retirable après extinction des dépendances |
| `TCGate_Control_Center / production / Postgres` | Base legacy, volume `postgres-volume` | Pas pour update | Après arrêt de l'app consommatrice et conservation des données utiles | Retirable |
| `TCGate_Control_Center / production / tcgate-control-center-volume-eGJj` | Volume app `/data` | Pas pour update | Même condition que l'app, données historiques vérifiées | Retirable |
| `TCGate_Control_Center / production / postgres-volume` | Volume Postgres | Pas pour update | Après base et conservation des données utiles | Retirable |
| `TCGate_Control_Center / control-center-0-3-0-staging / TCGate-Control-Center-staging` | App source candidate-control-center-0.3.0-rc.1 | Non pour update | Vérifier consommateurs et préserver historiques avant retrait séparé | Retirable |
| `TCGate_Control_Center / control-center-0-3-0-staging / Postgres-ntXz` | Base legacy | Non pour update | Après app et conservation des données utiles | Retirable |
| `TCGate_Control_Center / control-center-0-3-0-staging / tcgate-control-center-staging-volume` | Volume app `/data` | Non pour update | Après app, contrôle des données et consommateurs | Retirable |
| `TCGate_Control_Center / control-center-0-3-0-staging / postgres-volume-knil` | Volume Postgres | Non pour update | Après base et conservation des données utiles | Retirable |
| `TCGate_Control_Center / cc-0-4-0-a1-staging / cc-040-a1-app` | App source develop-control-center-db-0.5.0-prepare | Non pour update | Vérifier aussi les consommateurs de préparation BDD hors dépôt | Retirable si aucun autre consommateur |
| `TCGate_Control_Center / cc-0-4-0-a1-staging / Postgres-GgkH` | Base legacy | Non pour update | Après app et conservation des données utiles | Retirable |
| `TCGate_Control_Center / cc-0-4-0-a1-staging / cc-040-a1-app-volume` | Volume app `/data` | Non pour update | Après app, contrôle des données et consommateurs | Retirable |
| `TCGate_Control_Center / cc-0-4-0-a1-staging / postgres-volume-QsXX` | Volume Postgres | Non pour update | Après base et conservation des données utiles | Retirable |
| `TCGate_Control_Center / cc-0-4-0-a1-staging / cc-prepare-artifacts-staging` | Bucket présent | Non pour runtime update ; autres consommateurs non audités | Vérifier préparation BDD externe et conserver artefacts utiles avant retrait | Retirable sous cette condition |
| `TCGate-camera-phone / production / TCGate-Phone-Camera-Lab` | Standalone historique source main, sans volume | Temporairement pour qualification/comparaison | physical Chrome Android qualification PASS | Retirable après qualification physique |
| GitHub `TCGate` | Dépôt produit actif | Oui | Conserver | Source de vérité technique intégrée |
| GitHub `tcgate_db_cyberpunk` | Dépôt BDD actif, runtime 1.1.0 fixé | Oui | Conserver | BDD Cyberpunk qualifiée selon scopes |
| GitHub `tcgate_db_star_wars_unlimited` | Dépôt BDD de développement actif, pas activé en production | Oui | Conserver | Qualification séparée avant toute activation |
| GitHub `tcgate_db_riftbound` | **ARCHIVE CANDIDATE** | Aucune reprise décidée | Décision produit ultérieure ; aucun archivage/suppression dans ce jalon | Archive candidate conservée |

Les trois environnements Control Center, leurs apps, leurs trois Postgres, leurs six volumes et le bucket sont tous conservés dans 1.2D. Aucun arrêt de service ou suppression de projet n'est effectué.

## Phone standalone

`TCGate-camera-phone` / `TCGate-Phone-Camera-Lab` : **Legacy standalone — superseded by integrated Phone Camera 1.2C**. Toute évolution produit utilise les propriétaires Phone intégrés au dépôt TCGate.

```text
Decommission condition:
physical Chrome Android qualification PASS
```

Le PASS n'est pas acquis : [checklist physique 1.2C](PHONE_PHYSICAL_QUALIFICATION_1_2C.md). Le standalone et son projet Railway restent disponibles. Aucun test local à caméras factices ne peut lever cette condition.

## Ce qui est retirable et ce qui doit attendre

Le service et l'environnement `report-schema-v2-qualification` sont supprimables du point de vue des dépendances actuelles du dépôt. Les ressources des deux staging Control Center sont candidates au retrait après contrôle des consommateurs externes et conservation des données ; leur absence de dépendance produit n'atteste pas l'absence d'un usage BDD externe.

Le Control Center Production, sa base, ses volumes et le volume applicatif `tcgate-volume` doivent attendre l'extinction effective du bridge C14 au moment de Candidate 15. Phone standalone attend le PASS physique Chrome Android, indépendamment du calendrier C15. Les dépôts actifs TCGate, Cyberpunk et SWU sont conservés ; Riftbound reste ARCHIVE CANDIDATE.

Dette bloquante Candidate 15 : **Production source must be realigned to main during Candidate 15 promotion.** Le [pre-flight](CANDIDATE_15_PRE_FLIGHT.md) décrit aussi la privacy Report Schema, la purge TURN et le pipeline C14 restant à réconcilier.

## Transfert vers la prochaine mise à jour Workspace

Fiche préparée sans modifier `workspace-state` ou le JSON canonique. La mise à jour séparée documentée pour un ancien jalon ne vaut pas opération couplée systématique à chaque maintenance.

- UI 1.2 intégrée : Home cinq pages, Lobby trois onglets, Ready visible ; Gig Dice option de room.
- Control Center retiré du runtime update depuis 1.2A ; rapports V2 par Resend.
- Phone Camera consolidé depuis 1.2C ; standalone legacy conservé jusqu'au PASS physique.
- Nettoyage des branches BDD déjà réalisé dans le chantier 1.2B ; aucune branche BDD modifiée ici. Ne pas confondre ce constat historique avec un nouvel inventaire distant des dépôts BDD.
- BDD du programme actives : Cyberpunk et SWU ; runtime produit Cyberpunk seul. Riftbound ARCHIVE CANDIDATE.
- Langue physique personnelle par joueur décidée pour les futures BDD, post-Candidate 15 ; aucun fallback Vision EN quand FR choisi, exposition seulement si `visionReady = true`.
- `update/next` au début du jalon : `e1455cbff845baf90e3fb8a027b5f59c33d571cf`. Au transfert, utiliser le SHA final du commit `chore(project): prepare legacy infrastructure decommission`, à lire avec `git log -1 --format=%H --grep='^chore(project): prepare legacy infrastructure decommission$' origin/update/next`, puis mesurer l'avance réelle.
- Production demeure sur C14 ; réalignement vers main bloquant pour sa promotion C15. La qualification physique Phone reste pending.

L'état canonique reste sur `workspace-state` à `1ac77efebd86d1e5bc14c5cc18771de4456f2587`. Ne jamais merger ou déployer cette branche. Préserver Vision Lab, campagnes, historiques et la distinction qualification technique / validation physique.

## Contrôle et portée

`npm run test:project-hygiene` exécute le nouveau contrôle. Le runtime, les assets UI, les fichiers Vision, les BDD, Report Schema V2, les moteurs Phone et `railway.json` restent identiques au checkpoint. Les résultats, commandes et métriques sont consignés dans `PROJECT_DECOMMISSION_1_2D_VALIDATION.txt`. Aucune livraison Resend réelle ni qualification Android physique n'est revendiquée.
