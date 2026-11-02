# BDD Locale Core 1.0 — Jalon 1

Le contrat commun suit `TCG → canonical card → printing physique → locale → Vision reference`. Une carte conserve son `cardId` de gameplay entre les langues. Langues, sets, éditions et illustrations distinguent des `printingId`, sans créer de nouvelles cartes canoniques.

Ce jalon ajoute une projection de données opt-in. Il ne sélectionne aucune langue de joueur et ne change ni interface, ni matcher actif, ni seuil Vision, ni source de BDD en Production.

## Descripteur et printings

`public/database-locale-core.js` expose `normalizeDescriptor` et `createDatabaseView`, en Node comme dans le navigateur. Exemple de futur descripteur bilingue, **pas une activation FR** :

```js
{
  gameId: 'example-tcg', databaseVersion: '1.0.0',
  locales: {
    en: { label: 'English', dataReady: true, visionReady: true },
    fr: { label: 'Français', dataReady: true, visionReady: false }
  },
  defaultLocale: 'en'
}
```

La normalisation ajoute `code` à chaque locale et calcule `visionReadyLocales` à partir des seuls booléens `visionReady === true` explicitement déclarés. Une locale Vision prête exige aussi `dataReady === true`. Ni traduction, URL d'image, `availableLocales`, `fallbackLocale`, `runtimeReady` global ou valeur truthy ne qualifie un corpus. La déclaration reste une décision de qualification externe au module.

Les codes BCP 47 sont normalisés, sans assimilation régionale : `fr-FR` ne retombe pas sur `fr`. Une locale absente ou inconnue est rejetée. `defaultLocale`, optionnel, reste une métadonnée de compatibilité et ne devient jamais une sélection implicite.

```js
cards: [{ cardId: 'cp-001', name: 'Canonical gameplay identity' }]
printings: [
  { printingId: 'cp-001-en-standard', cardId: 'cp-001', locale: 'en', setId: 'set-1', variantKind: 'standard' },
  { printingId: 'cp-001-fr-standard', cardId: 'cp-001', locale: 'fr', setId: 'set-1', variantKind: 'standard' }
]
```

Les données complémentaires de printing sont conservées, dont les chemins visuels lorsqu'ils existent. Les identifiants dupliqués, les printings orphelins et les références incohérentes sont refusés. Aucune convention de suffixe n'est imposée aux identifiants historiques. Les copies récursives figées et les index privés isolent les entrées et le corpus actif des projections.

## API et index Vision

```js
const view = await TCGateDatabaseSource.getLocaleDatabase('cyberpunk-tcg');
view.descriptor;                   // descripteur normalisé et readiness
view.getPrintings('en');           // impressions physiques EN
await TCGateDatabaseSource.getVisionReferences('cyberpunk-tcg', 'en');
```

L'alias applicatif `cyberpunk` est également accepté par ces nouvelles API. Le module commun est chargé à la demande, via `require` en Node ou import navigateur de même origine. Aucun ajout de script dans les pages actives et aucun branchement Lobby/matcher. `load`, `validate`, le cache et les objets du corpus historique conservent leur comportement.

L'invalidation historique reste `clear('cyberpunk')` (clé du registre) ou `clear()` ; une recharge `force` produit une nouvelle vue indépendante. Les alias de la nouvelle API ne changent pas le contrat de `clear`.

Chaque référence est rattachée à son printing physique par `referencePrintingId`, ou `printingId` si celui-ci désigne directement l'impression. Ses éventuels `locale` et `sourceLocale` doivent correspondre au printing. Le filtrage porte aussi sur `candidatePrintingIds` : aucun candidat EN ne subsiste dans une projection FR. Une référence shared conserve son mode et `printingId: null`, même si le filtrage laisse un seul candidat. Plusieurs faces/références peuvent partager un printing.

Une locale déclarée avec `visionReady: false` renvoie un tableau Vision vide, figé. Une locale inconnue échoue. Une requête FR ne tente jamais une image EN. Les printings FR peuvent rester consultables via `getPrintings` alors que leur Vision est indisponible. La projection ne transforme pas une disponibilité d'assets en qualification.

## Cyberpunk : preuve et compatibilité bornée

Audit Git en lecture seule des sources suivantes, sans reconstruction, migration ni promotion :

| Source | SHA audité |
| --- | --- |
| Cyberpunk `main` — 1.1.0 | `56402636a77af9c8b5dc4e3b61c509a185f3c834` |
| Cyberpunk `develop-cyberpunk-db-v1.2` | `425e0198610cd0a746c4e2d1fc3094b3823340e4` |
| SWU `main` | `7eaba0779e6542b9b9d44e8737d634389c708499` |
| SWU `develop-swu-db-v0.4` | `d3e96571892ddf852d4b7ff284466ee6da00e19c` |

Le registre actif reste limité à Cyberpunk 1.1.0, au manifest immuable ci-dessous et au scope qualifié `cyberpunk-beta-2026` : 150 cartes, 229 printings/références, 83 références exact et 146 shared. Le descripteur actif ne déclare que EN, `dataReady: true`, `visionReady: true`. Il ne décrit pas comme qualifié l'ensemble du catalogue Candidate.

`https://raw.githubusercontent.com/maximelaburthe-commits/tcgate_db_cyberpunk/56402636a77af9c8b5dc4e3b61c509a185f3c834/manifest.json`

Ces 229 printings historiques n'ont pas de champ locale. Chacun correspond dans les données de la Candidate au même `printingId`, `cardId`, `visionAssetPath` et `visionSha256`, avec `locale: en` et `sourceLocale: en`. Les fichiers runtime restent identiques entre les deux sources :

| Fichier | SHA-256 |
| --- | --- |
| `runtime/printings.min.json` | `33ebae2ef35c796541d55fe33d9f8ca6b5e53d93a38997a7473012ec7d6a6fcb` |
| `runtime/vision-index.json` | `9524b1b8e364aabb501af7069b714c4f4021d5968e9629c9b3d64899be339d93` |

La normalisation legacy EN est donc limitée par le module à cette URL exacte, `gameId: cyberpunk-tcg`, version `1.1.0`. Elle ajoute la locale seulement dans la nouvelle vue. Tout autre corpus sans locale est refusé. Ce mécanisme n'est pas un fallback visuel.

La Candidate de conception déclare EN/FR et un `fallbackLocale: en` textuel : ce dernier n'est pas repris pour Vision. Elle contient 700 printings (550 EN, 150 FR), 291 localisations (151 EN, 140 FR). Les 150 printings FR n'ont aucun asset display/Vision disponible : FR reste non qualifié. Le catalogue EN complet dispose de 447 assets sur 550 ; il ne faut pas lui attribuer la qualification du seul runtime bêta de 229. Aucune Candidate BDD n'est activée.

## SWU et autres TCG

SWU reste absent du registre actif. Ses identifiants historiques `id` pourront être adaptés explicitement en `cardId`/`printingId` par un futur adaptateur, en préservant `cardId`, set et variante. Les faces possèdent leurs propres identifiants, `printingId`, `side` et image : le contrat accepte plusieurs références par impression. Les futures locales devront être déclarées et qualifiées ; aucune langue n'est déduite d'un nom ou d'une URL. La branche SWU de développement annonce encore `runtimeReady: false` et une qualification physique en attente.

Ce jalon vérifie cette compatibilité de forme avec des fixtures, sans adapter, reconstruire, qualifier ou activer SWU. Riftbound reste **ARCHIVE CANDIDATE**, sans intervention.

## Personal locale — FUTURE

```text
Room game: Cyberpunk
Host installation: FR
Guest installation: EN
```

**NOT IMPLEMENTED IN JALON 1**. Player Locale, sélection Vision Locale par installation, persistance des préférences, interface et qualification physique FR restent des travaux futurs. Chaque installation utilisera à terme uniquement le corpus physique de sa langue qualifiée ; le jeu et l'identité canonique peuvent être communs.

## Validation

Les deux nouvelles suites sont intégrées au workflow courant `npm run qualify:alpha` : contrat Node et chargement navigateur opt-in. Les 37 suites historiques restent présentes. Le reçu externe `qualification.json` enregistre le SHA produit exact, les résultats et les appels Node assert comptés. Le contrôle syntaxique et `git diff --check` font partie de la campagne. Ces résultats techniques ne constituent aucune nouvelle qualification de cartes physiques FR ou SWU.
