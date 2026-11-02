# Cyberpunk Languages Qualification 1.0

Jalon 5 sur `update/next`, baseline produit
`dbfe6078734850a1ed11fdd626cfb5b67af91299`. Qualification documentaire et
structurelle ; aucun moteur, corpus actif, descriptor ou réglage UI modifié.

## Sources figées

Les références distantes ont été relues avec Git CLI avant audit :

| Branche Cyberpunk | SHA | Périmètre |
| --- | --- | --- |
| main | `56402636a77af9c8b5dc4e3b61c509a185f3c834` | BDD 1.1.0 ; source du corpus EN actif |
| develop-cyberpunk-db-v1.2 | `425e0198610cd0a746c4e2d1fc3094b3823340e4` | BDD 1.2.0 ; catalogue multilingue en développement |

Les archives proviennent de ces commits exacts dans un clone temporaire en
lecture seule. Les fichiers binaires sont reliés à leurs blobs Git ; les textes
tolèrent uniquement la conversion CRLF/LF de Git archive. Les assets sont
contrôlés par fichier, SHA-256, taille et signature image. L'audit indépendant
vérifie aussi le décodage WEBP et les dimensions avec Pillow. Aucun correctif BDD
objectivement nécessaire n'a été identifié ; aucune branche BDD n'est modifiée.

## Matrice de décision

Les données localisées importées, les assets et la qualification physique sont
trois preuves distinctes. `dataReady=true` ne suffit pas à `visionReady=true`.

| Locale / périmètre | Data coverage | Assets display / Vision | Références Vision | Physique Jalon 5 | dataReady | visionReady | Verdict |
| --- | --- | --- | ---: | --- | --- | --- | --- |
| EN, runtime bêta actif main | 150/150 cartes ; 229/229 impressions | 229/229 pour chaque type | 229 | NOT TESTED ; PASS historique propriétaire conservé | true | true | VISION READY |
| FR, snapshot officiel de développement | 140/140 cartes ; 150/150 impressions | 0/150 pour chaque type | 0 | NOT TESTED | true | false | PARTIAL / NOT VISION READY |

Le PASS physique EN est la confirmation du propriétaire pour Q16 lors de la
promotion Candidate 15. Il concerne le corpus historique conservé ; aucun test
physique nouveau ni relevé par carte n'est inventé ici. Le reçu lie sa conservation
au SHA immuable et à une empreinte fixe des identités et assets de ce corpus.

Le catalogue est plus large que le runtime qualifié : main contient 151 cartes
et 460 impressions EN ; développement contient 151 cartes, 550 impressions EN et
150 FR. Chaque snapshot possède 447 images display et 447 images Vision EN
valides. Les catalogues EN ont donc respectivement 13 et 103 impressions sans
ces assets, sans élargissement du corpus actif de 229 références. Les sept
fichiers runtime sont identiques entre les deux commits.

## EN : baseline conservée

Le corpus actif comprend 229 références physiques liées à des `cardId` valides :
83 références exactes et 146 références d'art partagé. Pour ces dernières,
`printingId=null` n'est pas un orphelin ; `referencePrintingId` et les candidats
identifient correctement les impressions physiques possibles. Aucun doublon
accidentel, référence orpheline ou candidat d'une autre carte n'a été trouvé.

Le JSON runtime historique n'a pas de champ `locale`. La vue Locale Core attribue
EN uniquement grâce au contrat historique explicite de cette source immuable.
Le rapport compare cette vue avec les impressions sources et confirme
`reference.locale === 'en'` pour les 229 références, sans référence FR.

## FR : manques constatés

Le snapshot officiel français attend 140 cartes et 150 impressions, toutes
présentes. Il ne déclare pas 150 cartes ou 229 impressions FR attendues.
Les 150 impressions FR se répartissent en 140 standard, 9 iconic et 1 alternate
art. Elles possèdent des identifiants distincts des impressions EN correspondantes
et partagent leurs `cardId` canoniques valides. Les 150 correspondances sont
uniques ; aucun doublon invalide ni orphelin n'a été trouvé.

Les manques réels sont :

- cartes et impressions attendues du snapshot FR : aucun manque ;
- images display : les 150 impressions FR ;
- images Vision : les mêmes 150 impressions FR ;
- références Vision FR : aucune disponible ;
- métadonnées FR : 140 noms et 140 textes de règles disponibles ; `flavorText`,
  `typeLabel`, `tagLabels` et `keywordLabels` restent absents/null selon la source.

Les 150 URL de provenance FR ne sont pas 150 images disponibles. Les fichiers et
chemins d'assets FR sont absents ; le statut source est
`asset_rights_review_pending`, avec reconnaissance désactivée. Aucune image EN
n'est substituée. La correspondance physique d'une image française ne peut donc
pas être validée dans ce jalon.

Les 11 cartes suivantes du catalogue global n'ont pas de localisation/impression
FR attestée dans ce snapshot ; ce sont des écarts de catalogue, pas 11 impressions
FR attendues inventées :

```text
cp-dexter-deshawn-one-last-chance
cp-goro-takemura-hands-unclean
cp-goro-takemura-losing-his-way
cp-jackie-welles-pour-one-out-for-me
cp-minotaur
cp-mt0d12-flathead
cp-rebecca-having-a-moment
cp-saburo-arasaka-stubborn-patriarch
cp-v-corporate-exile
cp-viktor-vektor-sit-down-and-relax
cp-yorinobu-arasaka-embracing-destruction
```

L'artefact JSON donne les listes exhaustives de `printingId` sous
`locales.fr.missing.displayImages`, `visionImages` et `referencePrintingIds`, les
champs manquants sous `locales.fr.metadata`, et les manques EN des catalogues sous
`sources.main.catalog` et `sources.develop.catalog`. Une image display et une
image Vision manquantes pour une impression ne représentent pas deux cartes.

```text
FR DATA QUALIFICATION: PARTIAL
FR VISION: NOT READY
FR PHYSICAL QUALIFICATION: NOT TESTED
FR VERDICT: NOT VISION READY
```

## Outil reproductible

`qualify-cyberpunk-locales.js` lit des snapshots locaux figés et produit un JSON
déterministe hors dépôt, sans écriture dans les sources. Il contrôle les
identités, locales, références, candidats, assets et empreintes. La liste de
langues vient des impressions et des sources officielles ; aucune langue n'est
inventée à partir d'un alias ou d'une présentation traduite.

```powershell
npm run qualify:cyberpunk-locales -- --main-root "C:\audit\main" --develop-root "C:\audit\develop" --main-sha 56402636a77af9c8b5dc4e3b61c509a185f3c834 --develop-sha 425e0198610cd0a746c4e2d1fc3094b3823340e4 --output "C:\audit\cyberpunk-locales-qualification.json"
```

Les racines doivent contenir les fichiers des commits indiqués. Conserver avec
le rapport les refs Git mesurées et la preuve de correspondance des archives.
L'outil refuse d'écraser un artefact et de produire son résultat dans une source
BDD ou dans le dépôt produit. Une nouvelle édition linguistique nécessite de
relancer cette qualification ; les données seules ne fabriquent jamais un PASS
physique.

## Protocole physique FR conditionnel

Ce protocole court est distinct du futur benchmark Vision Qualification 1.0.
Il ne sera applicable qu'après **structure PASS et assets PASS** sur le corpus
FR complet. Ces prérequis échouent aujourd'hui : aucune carte physique n'est
demandée et le résultat reste NOT TESTED.

Après satisfaction des prérequis, figer les SHA BDD/produit, le rapport et au plus
six vraies cartes FR couvrant plusieurs types et frames/couleurs, une carte simple,
une carte riche en texte et une variante artistique si elle existe. Les IDs
doivent provenir du corpus vérifié. Pour chaque carte, enregistrer les observations
réelles, immobile puis légèrement inclinée dans un éclairage ordinaire :

| cardId | printingId | locale | détectée ? | identifiée ? | correcte ? | latence observable | remarque |
| --- | --- | --- | --- | --- | --- | --- | --- |
| À renseigner après prérequis PASS | À renseigner | fr | — | — | — | — | — |

Une impression exacte doit être correcte ; un art partagé conserve son ambiguïté
explicite. Une observation manquante reste NOT TESTED ; une erreur observée donne
FAIL. Un PASS exige toutes les observations correctes et zéro référence EN dans
le corpus FR. Aucun résultat navigateur, fixture ou image synthétique ne remplace
cette passe physique.

```text
structure PASS + assets PASS + physique PASS = visionReady true
sinon visionReady false
```

## Produit et non-régression

Le descriptor actif reste inchangé : English seulement dans Mon installation,
FR non sélectionnable, Vision EN à 229 références. Player Locale et Vision
Locale continuent de fournir des corpus isolés ; aucun fallback inter-langue.
Les tests multilingues restent des fixtures, sans activation ni qualification FR.

Les 45 suites précédentes sont conservées et la nouvelle suite
`cyberpunk-languages-qualification-test.js` porte le workflow à **46 suites, dont
12 navigateur**. Elle couvre également les erreurs de locale, images EN utilisées
pour FR, impressions/références orphelines ou dupliquées, suppressions de données,
empreintes modifiées et stabilité du rapport. Les validateurs BDD natifs
`scripts/validate_db.py` et `scripts/test_assets.py` passent séparément sur les
deux snapshots ; leur succès porte sur leur périmètre bêta, pas sur FR.

Les mesures Jalon 4 restent les références historiques : EN 229 → 229,
construction initiale environ 8,27–8,33 s et F5 environ 6,61 s. Aucun réglage de
performance ni gain revendiqué au Jalon 5 ; les nouvelles durées des suites de
non-régression ne deviennent pas un benchmark FR.

Le Workspace est actualisé séparément après le SHA produit final, avec les
jalons 1–4 READY, le résultat réel de cette qualification et Vision Qualification
1.0 FUTURE. `main`, Railway Production et les BDD restent inchangés.
