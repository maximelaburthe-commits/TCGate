# Vision Locale 1.0

Jalon 4 sur `update/next`, baseline
`217b0c476a6f615c97b608932b09c5623e675dec`. Il relie Locale Core 1.0 et Player
Locale 1.0 au corpus candidat, sans changer les algorithmes de reconnaissance.

```text
shared:
gameId

personal:
playerLocale

Vision corpus:
gameId + playerLocale

NO CROSS-LOCALE FALLBACK
```

La préférence reste celle de `TCGatePlayerLocale.getPlayerLocale(gameId)`,
persistée par TCG dans le navigateur. Aucune langue n'entre dans le Room state,
les paramètres Host, SSE ou WebRTC. Le sélecteur et Site UI 2.0 restent identiques.

## Entrée du corpus

Le module `TCGateVisionLocale.prepare({gameId, playerLocale})` vérifie le
descriptor Core et exige `dataReady=true` et `visionReady=true`. Il demande les
candidats exclusivement à
`TCGateDatabaseSource.getVisionReferences(gameId, playerLocale)`. Le chargement DB
brut reste utilisé pour les noms canoniques, la provenance et les métriques,
jamais pour choisir les candidats du matcher.

Chaque référence est contrôlée avant construction, lecture du cache et envoi aux
workers : `reference.locale === playerLocale`. Le filtrage Core conserve le
`cardId`, l'impression physique, ses assets et ses candidats dans la bonne langue.
Une reconnaissance partagée ne devient pas une impression exacte inventée.

```text
Cyberpunk EN → active / 229 references
Cyberpunk FR → not visionReady
```

Le descriptor actif ne déclare qu'EN. Les 229 références portent `locale=en` via
la normalisation du corpus historique immuable prévue par Locale Core : 150
cartes, 83 références exactes et 146 partagées. Le test espionne l'appel Core et
compare les identités filtrées au payload du véritable worker. L'égalité
229 → 229 ne repose donc pas sur la conservation de l'ancien chargement global.

FR n'est ni sélectionnable, ni chargée, ni fusionnée avec EN. Aucune BDD distante
n'est modifiée. Les exemples Host FR / Guest EN utilisent uniquement des
descriptors et corpus de test, sans qualification physique ou activation FR.

## Index, caches et invalidation

Le cache de descripteurs utilise le préfixe `tcgate-vision-locale-v1:`, suivi du
jeu canonique, de la langue et de l'identité source/version encodés. EN et FR
possèdent des clés distinctes. Son empreinte inclut toutes les identités des
références physiques ; chaque entrée relue doit correspondre exactement à la
source filtrée. Une clé EN ne peut satisfaire une demande FR, même si le nombre
de références ou le `cardId` sont identiques. L'ancien cache global est ignoré.

`TCGIdentificationLab.setContext(context|null)` invalide immédiatement le corpus,
le worker foreground, les tâches en attente, les caches de survol, les identités,
les images HD et les résultats précédents. La mémoire de table possède un second
worker : il est arrêté, ses références sont libérées et il est reconstruit avec
le même corpus filtré. Les générations et identités de workers empêchent les
anciennes réponses asynchrones de réactiver un index ou une identité périmés.

Le cycle existant `prepareVision` traite automatiquement les changements de
langue et de jeu, y compris pendant un chargement. Aucun bouton ni étape Ready
n'est ajouté. Caméra, microphone, PeerConnection et Ready adverse restent
indépendants de ce changement de corpus. Sans jeu ne prépare aucun corpus ni
index ; une transition depuis un TCG décharge les anciens index et mémoires.

## Erreurs et anciens chemins

Une préférence inconnue ou devenue indisponible est normalisée par Player Locale
avant Vision. À la frontière Vision, une langue inconnue ou non qualifiée est
refusée avant tout accès source. Corpus vide, références mélangées, source ou
assets indisponibles donnent un échec contrôlé ; aucun corpus global n'est ajouté.
Le fallback de production vers l'ancien snapshot non localisé a été retiré.

| Classement | Chemins audités |
| --- | --- |
| LOCALE-AWARE | API Core, préparation Vision, cache de descripteurs, index foreground, bridge et worker de mémoire de table |
| LEGACY BUT SAFE | Snapshots DB bruts et cache de téléchargement par jeu : métadonnées immuables, pas des index actifs |
| LEGACY BUT SAFE | Statistiques d'inspection Workspace utilisant les références brutes ; son matcher de production reçoit explicitement la préférence Player Locale et passe par le même adaptateur filtré |
| LEGACY BUT SAFE | Manifest de test du Vision Lab : provider isolé, marqué non qualifié, hors room et sans cache de production |
| LEGACY BUT SAFE | Caches d'images par URL exacte et modèle ONNX indépendant du corpus ; assets historiques conservés pour provenance et tests |
| REMOVE | Ancien `loadFallbackSnapshotCardList` et catch de production vers snapshot global/local, désormais sans appel actif |

## Diagnostics et mesures

`TCGIdentificationLab.getSnapshot()` expose `gameId`, `playerLocale`,
`visionReferenceCount`, `visionIndexKey` et `visionLocales`. Les performances
existantes indiquent `referenceCountBeforeLocale`, `referenceCountAfterLocale`,
`descriptorBuildMs`, `totalReadyMs` et le statut du cache. Ces détails restent
dans les diagnostics, sans affichage du nombre de références au joueur.
Ils n'ajoutent ni token, ni identifiant de périphérique, ni SDP ou candidat ICE.

Le navigateur mesure le véritable index EN (229 → 229) et la fixture bilingue
(2 → 1 par langue), puis sa reprise depuis le cache. Les durées réelles figurent
dans le journal `vision-locale-browser-test.js.log` du reçu de qualification.
Aucune instrumentation mémoire supplémentaire ou affirmation de gain n'est
introduite.

## Vérification

`npm run test:vision-locale` lance la suite Node et le navigateur dédié.
`npm run qualify:alpha` conserve les 43 suites précédentes et ajoute ces deux
suites : 45 au total, dont 12 navigateur. Le reçu externe `qualification.json`
porte le SHA et l'arbre source figés.

Les preuves couvrent le vrai corpus immuable EN et ses images, des indices EN/FR
sans mélange, une même carte avec impressions différentes, les clés de cache,
les échecs sans fallback, les chargements et callbacks obsolètes, deux profils
Host/Guest, le cycle Ready réel, F5 et Sans jeu. Les médias navigateur sont
synthétiques ; aucune qualification physique FR n'est déduite.

Les gardes protègent 79 fonctions d'identification, 47 fonctions Table State et
les constantes de reconnaissance avec les empreintes pré-Jalon-4. Scoring,
seuils, similarité, ranking, détection, preprocessing, homographie, temporal
smoothing et backpressure restent inchangés. Les adaptations autorisées portent
sur les sources de candidats, la validité des caches et le cycle de leurs workers.

Le Workspace canonique est actualisé séparément après le SHA produit final.
Locale Core, Site UI, Player Locale et Vision Locale sont READY au statut
technique `reported`. Vision Qualification 1.0 et qualification Cyberpunk FR
restent FUTURE. Aucune fusion, action Railway ou modification de `main`.
