# Vision Qualification 1.0 — Phase A

## Configuration

Branche produit : `update/next`. Baseline moteur :
`7baeb9844ac8a2a68b2c5a38011003514bab5f98` (Jalon 5). Le SHA réellement testé
figure dans le reçu externe `qualification.json` et dans chaque rapport Vision.
`main` reste `e26b2e09579be53452c1e631b1dc5230191d0250`.

Railway Test suit `update/next` ; Production reste sur `main`. Aucune configuration
Railway n'est modifiée. Le harness est un outil développeur chargé sur commande,
sans entrée dans l'interface normale ni nouvelle page produit.

`VISION_QUALIFICATION_ENGINE_BASELINE.json` fige les 228 fichiers publics et
modèles existants du Jalon 5 par leurs objets Git. Le CLI refuse une différence
sur ces fichiers. Scoring, seuils, détecteur, preprocessing, ranking, smoothing,
backpressure, filtres, références et corpus restent inchangés.

## Corpus

Cyberpunk, clé produit `cyberpunk`, identifiant canonique `cyberpunk-tcg`, locale
`en` : **150 cartes, 229 impressions/références**, dont 83 références exactes et
146 à art partagé. BDD immuable :
`56402636a77af9c8b5dc4e3b61c509a185f3c834`.

L'observateur exige l'index réellement prêt, ses 229 références EN, les 150
identités canoniques et le bon pin BDD. Chaque référence et candidat observé doit
appartenir à cette bibliothèque EN. Un changement de corpus, une référence
inconnue ou une contamination de locale invalide l'essai, sans fallback.

FR reste `dataReady=true`, `visionReady=false`, zéro asset Vision et zéro
référence ; aucune fixture FR n'est une preuve physique.

## Échantillon

`VISION_QUALIFICATION_SAMPLE.json` recommande **15 cartes canoniques distinctes**
et les impressions exactes du corpus actif. La sélection couvre quatre types,
quatre couleurs, textes courts/longs (20–251 caractères) et images centrales
claires/sombres mesurées sur les assets originaux. Trois couples proches sont
proposés par un proxy RGB indépendant ; ce proxy n'est pas un score Vision.
Trois groupes de variantes physiques partagées sont identifiés séparément.

La disponibilité physique reste inconnue. Une substitution se déclare avant les
essais avec `originalCardId`, `replacementCardId`, `replacementPrintingId` et
`reason: 'PHYSICAL_CARD_UNAVAILABLE'` dans `plan.substitutions`. Elle doit figurer
parmi les alternatives du même profil et conserver des cartes distinctes. Ne pas
remplacer silencieusement une édition beta par une édition retail hors corpus.
Le plan préparé vise 45 essais nominaux ; aucun essai échoué n'est retiré après
mesure pour améliorer le taux. La recommandation générale reste 12–15 cartes.

## Méthode

Utiliser le Vision Lab existant de `/workspace.html` sur Railway Test, source
active Cyberpunk EN, ou la partie de test avec Vision déjà en fonctionnement.
Ne pas utiliser la source Candidate/BDD expérimentale. Inspecter puis démarrer
le runtime existant et attendre ses 229 références avant d'attacher l'observateur.

Pour un environnement local, démarrer depuis un commit propre :

```powershell
$env:GIT_COMMIT_SHA = git rev-parse HEAD
$env:PORT = '8787'
npm.cmd start
```

Dans la console développeur de l'environnement de test, après démarrage normal
de Vision, charger les deux scripts explicitement. Le SHA vient du health réel :

```javascript
const health = await (await fetch('/api/health')).json();
if (!/^[0-9a-f]{40}$/.test(health.buildSha || '')) throw Error('SHA de build requis');
await import('/vision-qualification-harness.js');
await import('/vision-qualification-runtime.js');
const sample = await (await fetch(
  'https://raw.githubusercontent.com/maximelaburthe-commits/TCGate/' +
  health.buildSha + '/VISION_QUALIFICATION_SAMPLE.json'
)).json();
const q = await TCGVisionQualificationRuntime.attach({
  productSha: health.buildSha,
  plan: { ...sample.plan, sample: sample.sample, substitutions: [] },
  environment: {
    execution: 'RAILWAY_TEST', illumination: 'NORMAL', background: 'TABLE',
    sleeve: 'NO', cameraFacing: 'EXTERNAL', browserFamily: 'CHROMIUM'
  }
});
```

Pour un commit local non publié, fournir le même JSON versionné depuis un fichier
local avec un sélecteur de fichier développeur ; ne pas utiliser un autre SHA.
Adapter les catégories d'environnement à la situation réelle.

Chaque commande de début marque **T0**, juste avant la présentation physique.
T1 est la première détection observée. T2 confirme une identité correcte
consécutive pendant 1 000 ms, sans trou d'observation supérieur à 1 000 ms.
Cette règle de mesure ne modifie pas le moteur. La cadence d'observation est
250 ms, complétée par ses événements existants. Les latences incluent le décalage
du geste manuel et la résolution d'observation ; aucune précision supérieure
n'est revendiquée.

```javascript
const physical = { mode: 'physical', physicalConfirmation: 'REAL_CARDS_OPERATOR_CONFIRMED' };
q.startTrial({ ...physical, expectedCardId: sample.sample[0].cardId,
  expectedPrintingId: sample.sample[0].printingId, condition: 'NOMINAL' });
// Présenter la vraie carte environ 10 secondes, puis :
q.endTrial();
```

Revenir à une scène vide sans identité résiduelle entre essais. Répéter trois
présentations nominales par carte. Une interruption ou une mauvaise configuration
reste `INVALID_TEST`, sans être comptée comme réussite ni incluse dans les taux.

| Condition | Protocole préparé |
| --- | --- |
| NOMINAL | 15 cartes × 3 essais ; éclairage, distance et table de jeu ordinaires |
| ANGLE | Sous-échantillon de six cartes ; léger puis modéré, notes `ANGLE_SLIGHT` / `ANGLE_MODERATE` |
| LOW_LIGHT | Même sous-échantillon, éclairage faible mais jouable |
| DISTANCE | Plus proche puis plus éloignée, notes `DISTANCE_NEAR` / `DISTANCE_FAR` |
| ORIENTATION | Rotation légère ; aucune obligation arbitraire à 180° |
| SLEEVE_GLARE | Vraie sleeve si disponible ; sinon indisponibilité explicite, jamais PASS |
| STABILITY | Trois cartes maintenues 10 s ; changements d'identité et disparitions |
| REMOVAL | Après reconnaissance, `q.markRemoval()`, retrait réel puis `q.endTrial()` après retour sans identité |
| RAPID_SWITCH | A reconnue, `q.markRemoval()`, retrait et retour sans identité ; puis `q.switchTrial({...physical, expectedCardId: ..., expectedPrintingId: ..., condition:'RAPID_SWITCH'})` au passage vers B ; les deux essais sont liés par ID |
| SIMILAR_PRINTINGS | Couples proches et variantes disponibles présentés séparément ; exactitude canonique et impression distinguées |
| FALSE POSITIVE SCENES | Table vide, playmat, main, paquet fermé/pile, objets de bureau ; 30 s continues chacun |
| INDEX | Trois profils froids distincts puis un F5 dans chacun, mêmes 229 références |

Pour une scène sans carte cible :

```javascript
q.startScene({ ...physical, scene: 'EMPTY_TABLE' });
// Observer 30 secondes continues sans carte cible, puis :
q.endScene();
```

Les autres codes de scène sont `PLAYMAT`, `VISIBLE_HAND`, `CLOSED_DECK`,
`DESK_OBJECTS`. Un essai de retrait doit d'abord reconnaître la carte. Une simple
forme détectée dans une scène négative est distincte d'une fausse identification.

`await q.recordIndexMeasurement('COLD')` ou `await q.recordIndexMeasurement('WARM_RELOAD')` relève les durées déjà
exposées par l'index prêt. Une nouvelle session d'observateur est nécessaire après
F5. Conserver les sessions successives et réunir leurs mesures ; ne pas annoncer
trois exécutions en répétant trois fois la lecture d'une même initialisation.
L'identifiant de mesure est une empreinte opaque de cette initialisation ; les
doublons sont écartés avant les statistiques et contrôles de répétition.

Fin de session, sans essai actif : `q.saveSession()` télécharge uniquement le JSON
sanitisé. `q.downloadReport()` produit un rapport de lecture. Le CLI reconstruit
le rapport déterministe depuis la session et le corpus réel :

```powershell
npm.cmd run qualify:vision -- --input C:\preuves\vision-qualification-session.json --output C:\preuves\vision-qualification-1.0.json --fixture-root C:\audit\cyberpunk-main
```

Sans snapshot local, le CLI lit le pin public immuable. Il exige le même SHA
produit, un checkout propre, le moteur inchangé et une destination nouvelle hors
dépôt et hors BDD. Il recharge lui-même les références EN ; le JSON d'entrée ne
peut pas remplacer le corpus ni affaiblir le plan. Répéter `--input` pour réunir
plusieurs sessions du même SHA avec les mêmes déclarations préalables. Les IDs
d'essai sont uniques par session ; aucun résultat n'est écrasé. Répéter
`--index-input` pour réunir les séries froides/F5 exportées. Une phase physique doit
conserver ses essais et ses sessions d'origine, substitutions comprises.

Pour générer le rapport vierge de Phase A :

```powershell
npm.cmd run qualify:vision -- --template --output C:\preuves\vision-qualification-1.0.json --fixture-root C:\audit\cyberpunk-main
```

`--index-input CHEMIN` ajoute les mesures d'initialisation enregistrées, sous
`{"indexMeasurements":[...]}`. Le workflow automatisé fournit cette preuve
séparée ; elle ne qualifie jamais les cartes physiques.

## Résultats globaux

**PHYSICAL QUALIFICATION: NOT TESTED.** Zéro essai physique effectué en Phase A.
Les taux et latences physiques restent `null`, jamais des pourcentages simulés.
Le rapport distingue `metrics.physical` et `metrics.automated`. Les fixtures
valident le harness ; elles n'apportent aucune preuve de performance physique.

Chaque essai positif reçoit une seule catégorie : `CORRECT`, `NO_DETECTION`,
`NOT_IDENTIFIED`, `WRONG_IDENTIFICATION`, `UNSTABLE` ou `INVALID_TEST`. Les essais
invalides sont exclus des taux. Toute mauvaise identité observée est également
comptée dans le taux de mauvaise identification, même si l'essai est instable.

## Résultats par condition

Chaque condition conserve ses dénominateurs, catégories, taux et latences. Les
scènes sans cible ont leurs propres durées et compteurs ; elles ne diluent pas
le taux d'identification des essais positifs. Tous les résultats physiques sont
en attente. Le rapport liste explicitement les parties manquantes du plan.

## Faux positifs

Aucun résultat physique actuellement disponible. Toute identité produite sans
carte cible doit être enregistrée et documentée. Objectif produit : zéro fausse
identification sur les cinq scènes prévues, sans confondre détection de forme et
identification. Une scène trop courte ou discontinue ne valide pas ce gate.

## Latence

Statistiques : n, minimum, médiane et maximum. P95 par rang le plus proche
uniquement à partir de 20 valeurs valides. Les mesures froides et F5 restent
séparées, avec durée de construction et durée totale jusqu'à disponibilité.
Les journaux et JSON externes de la campagne au SHA exact contiennent les mesures
réelles répétées. Comparaison historique Jalon 4 : construction 8,27–8,33 s ;
F5 6,61 s. Le contexte local/automatisé est indiqué ; il ne prouve pas une
latence de reconnaissance physique ni un temps Railway identique.

Aucun seuil moteur ni gate arbitraire de latence n'est ajouté. Après essais
physiques, la latence sera classée acceptable, à surveiller ou problématique avec
justification d'usage. Une optimisation éventuelle fera l'objet d'un sous-jalon.

## Stabilité

Changements d'identité, disparitions/réapparitions, T2 stable et latence de retrait
sont mesurés. Une identité canonique correcte avec impression partagée reste
`UNRESOLVED_SHARED_ART` : aucune distinction exacte de variante n'est inventée.
Ces éléments sont en attente de tests physiques.

## Défauts

Les défauts observés sont classés MAJOR, INTERMEDIATE ou MINOR, avec les IDs
d'essai/scène. Mauvaise locale, mauvaise carte nominale et fausse identification
sans cible sont majeures. Un défaut est mesuré, reproduit et documenté ; aucun
ajustement du moteur n'est inclus dans cette qualification.

Le benchmark n'enregistre pas de vidéo, image, capture, visage, audio, SDP,
candidats ICE ni identifiant brut d'appareil. Les exports utilisent des champs
autorisés, des IDs du corpus et des notes codées ; les objets runtime et textes
libres ne sont pas exportés. Aucun enregistrement média n'est démarré.

## Verdict

**Phase A : HARNESS READY / PHYSICAL QUALIFICATION PENDING**, sous réserve du reçu
automatisé PASS au SHA final. Les jalons 1–5 restent techniquement READY.

Après le plan physique complet : gate nominal correct ≥95 %, mauvaises
identifications ≤1 %, zéro fausse identification sur les scènes négatives.
L'objectif dégradé de 85 % est indicatif. Les résultats incomplets ne deviennent
jamais un PASS ; l'ambiguïté d'impression reste explicitement documentée.

**TCGATE VISION QUALIFICATION 1.0 NOT YET QUALIFIED**
