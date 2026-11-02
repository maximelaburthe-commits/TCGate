# Player Locale 1.0

Jalon 3, après BDD Locale Core 1.0 et Site UI 2.0. Baseline produit :
`fa5ab9f38f8c541f5ca688befba7d1040c8a558b`, branche `update/next`.

## Contrat personnel

```text
Room game = shared
Player locale = personal
```

« Langue de mes cartes » indique la langue imprimée sur les cartes physiques du
joueur. Le champ est dans **Lobby → Mon installation**, avant caméra et micro.
Host et Guest disposent du même contrôle personnel. Il ne fait pas partie des
options Session contrôlées par le Host.

Exemple futur, lorsque FR aura sa propre qualification :

```text
Cyberpunk room
Host → fr
Guest → en
```

Cet exemple ne qualifie pas FR. Le descriptor Cyberpunk actif déclare uniquement
English (`en`), avec `dataReady=true` et `visionReady=true`. FR est absente de ce
descriptor et reste non sélectionnable ; des données FR seules ne suffisent pas.

## Source et normalisation

`public/player-locale.js` utilise le registry `TCGateGameDatabases` et
`TCGateDatabaseLocaleCore.normalizeDescriptor`. Aucune liste de langues n'est
codée dans le sélecteur. Pour les TCG Vision actuels, une langue est proposée
seulement si `dataReady === true && visionReady === true`.

Les helpers `getAvailablePlayerLocales`, `getPlayerLocale`, `setPlayerLocale` et
`normalizePlayerLocale` centralisent ce contrat. Le choix enregistré est utilisé
s'il est valide ; sinon le `defaultLocale` sélectionnable, puis la première
langue valide déclarée. Le premier choix est enregistré aussi : changer le
défaut d'un descriptor ne remplace pas une préférence personnelle existante.
Une ancienne valeur devenue indisponible est réparée automatiquement.

Le stockage local utilise `tcgate-player-locale-v1:<gameId canonique>`, soit
`tcgate-player-locale-v1:cyberpunk-tcg` pour Cyberpunk. L'alias de room
`cyberpunk` utilise cette même clé. Chaque TCG conserve sa propre préférence.
F5, fermeture/réouverture de la page et nouvelle room du même TCG la conservent.
Changer de jeu relit le contrat et la préférence de ce jeu.

La préférence appartient au profil navigateur et à cette origine. Deux profils
ou navigateurs sont indépendants ; les onglets de la même installation partagent
leur localStorage et actualisent le champ via l'événement `storage`. Si le
stockage est indisponible, le choix reste utilisable en mémoire pour la page,
sans promettre sa conservation après fermeture.

Sans jeu masque le champ et conserve les préférences des autres TCG. Un TCG
connu sans langue utilisable affiche un sélecteur désactivé et une explication.
Les helpers retournent une liste vide ou `null`, sans erreur ni langue inventée.
Aucune nouvelle condition Ready n'est introduite.

## Séparation réseau et Vision

La préférence n'est envoyée ni dans le Room state, ni dans les paramètres Host,
ni par HTTP, SSE ou WebRTC. Elle ne change pas le jeu partagé, le Ready adverse,
les médias, le Timer, Gig Dice ou les Reports.

```text
Vision filtering NOT IMPLEMENTED IN PLAYER LOCALE 1.0
```

Le sélecteur lit uniquement les métadonnées locales du descriptor. Il ne demande
aucun corpus ou index Vision et n'ajoute aucun chargement au clic Ready. Les
modules matcher, détection, identification, index, cache, références, scores,
seuils et fallback conservent leur fonctionnement. Choisir une langue ne donne
aucune permission de fallback visuel. Le branchement réel reste le futur
**Jalon 4 — Vision Locale 1.0** ; Vision Qualification 1.0 reste futur aussi.

## Vérification

`npm run test:player-locale` exécute la suite Node dédiée et la suite navigateur.
Le workflow `npm run qualify:alpha` conserve les 41 suites précédentes et ajoute
ces deux suites : **43 suites, dont 11 navigateur**, puis vérifications de
syntaxe et `git diff --check`. Le reçu externe `qualification.json` associe le
résultat complet au SHA et à l'arbre source figés.

Les tests couvrent le défaut, la persistance initiale et par TCG, les valeurs
obsolètes, les profils indépendants, les erreurs de stockage, Sans jeu et les
contrats sans langue utilisable. Le navigateur exerce le vrai serveur local,
Room/SSE/WebRTC et des médias synthétiques. Un descriptor bilingue intercepté
**uniquement dans le test** permet Host FR / Guest EN ; le descriptor produit
n'est pas modifié. Le corpus actif historique reste à 150 cartes et 229
références : 83 exactes et 146 partagées, même lors de ce choix FR de test.

Les contrôles d'interface couvrent 1366, 560 et 390 px : label natif associé,
navigation clavier, focus visible, état disabled, absence de débordement et Ready
visible. Les suites précédentes conservent leurs contrôles Room, recovery,
WebRTC, Phone, Timer, Gig Dice, Reports, Vision, Locale Core et Site UI 2.0.
Ces vérifications automatisées ne constituent pas une qualification physique FR
ni une validation humaine du rendu.

Le Workspace canonique est actualisé séparément après le SHA produit final.
Il ne doit pas être fusionné dans le produit. `main`, Railway et les BDD ne font
pas partie des modifications de ce jalon.
