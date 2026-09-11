# TCGate — Future UX v3.7 Hub checkpoint

## Identification

- Base : `9422b052d34a999e1aec4a0f6be6124a86ad5f31`
- Branche : `lab/future-ux-v3.7-integration`
- Périmètre : Hub de préparation uniquement
- Statut : Lab non commité, non poussé et non mergé

## Parcours

- La Home Candidate reste inchangée.
- Créer ouvre le Hub et crée immédiatement une room avec `Joueur` et `cyberpunk`.
- Rejoindre ouvre le même Hub en pré-connexion, puis l'enrichit sur place.
- Les vrais contrôles Setup/Lobby Candidate sont déplacés avec `append` dans une vue unique : aperçu caméra, Session, Mon installation et Joueurs.
- Aucun ID fonctionnel n'est cloné ou recréé.

## Backend minimal

`PATCH /api/rooms/:code` réutilise l'authentification Bearer existante. Avant la phase `game`, chaque pair peut modifier son propre pseudo et seul le Host peut modifier le jeu. Le jeu reste validé par `ALLOWED_GAMES`. Le snapshot et la diffusion `room-state` SSE existants propagent les changements.

La création immédiate hydrate exactement les informations de session Candidate : `roomCode`, `peerId`, `authToken`, rôle, snapshot et recovery state.

## Contrats Candidate conservés

- Ready est explicitement non modifié : mêmes conditions adversaire/média, même `startGame.disabled`, même handler, même `setReady()`, même `POST /api/ready`, même `applyRoomState()` et même transition `game`.
- Caméra, micro et Phone Camera réutilisent les contrôles et fonctions Candidate.
- WebRTC, signaling, TURN/ICE et recovery ne sont pas modifiés.
- Vision, Table State, workers et modèles ne sont pas modifiés.
- La Table et Gig Dice ne sont pas redesignés dans ce checkpoint.
- Rapports, DB et dépendances restent inchangés.

## Tests automatisés

- `npm.cmd run test:future-ux` : Home, structure du Hub, IDs uniques, conservation byte/source des fonctions Ready, API metadata et propagation SSE réelle.
- `npm.cmd run test:c11`
- `node offer-delivery-retry-test.js`
- `npm.cmd run test:phone-camera`
- `npm.cmd run test:phone-diagnostics`
- `npm.cmd run test:vision-integrity`
- `npm.cmd run test:vision-source`
- syntaxe JavaScript, `git diff --check` et smoke HTTP.

## Validation Railway HTTPS restante

- Create : Hub immédiat, code et lien disponibles.
- Join : même Hub avant et après connexion.
- Modification Host du pseudo et du TCG ; lecture seule du TCG côté Guest.
- Caméra, micro, sélecteurs et Phone Camera.
- Ready Candidate avec ses conditions média inchangées, puis passage en Table.
- F5 Host/Guest et reprise persistante.
- Responsive desktop 1920×1080, tablette et mobile.

## Checkpoint B — Table immersive

### Fichiers modifiés

- `public/future-ux-v3.7.css` : composition immersive et responsive de la Table.
- `public/future-ux-v3.7.js` : visibilité contextuelle du dock média existant.
- `future-ux-v3.7-test.js` : gardes Checkpoint A et contrats fonctionnels, plus structure du Checkpoint B.
- `IMPLEMENTATION_FUTURE_UX_v3.7.md` : présent chapitre.

### Éléments Candidate réutilisés

- `screenGame`, `opponentFeed`, `remoteVideo`, `localFeed` et `localVideo` pour les flux existants.
- `toggleCam`, `toggleMic` et `deviceMenuToggle` dans un dock vertical contextuel.
- `gameDeviceMenu` inchangé, maintenu visible pendant l'interaction.
- `generateReportGame` et `leaveGame` conservent leurs handlers Candidate dans le même dock discret.
- `displayCardPanel` reste disponible comme aperçu compact ; aucune logique Vision n'est modifiée.
- `gigDiceMount` et `gigDicePanel` restent fonctionnellement et visuellement sous leur contrat Candidate.

### Comportement

La vidéo adverse occupe la surface utile de la fenêtre. Le rail droit ne consomme plus une colonne fixe : l'aperçu de carte existant devient un élément compact superposé. Le dock apparaît au survol, au focus, au clic ou à l'approche des bords droit/bas, reste ouvert avec le menu de périphériques et se replie après 2,6 secondes d'inactivité.

### Contrats non modifiés

Le Checkpoint B ne modifie aucun HTML Candidate ni `app.js`. Les flux, handlers média, Ready, WebRTC, signaling, TURN/ICE, recovery, Phone Camera, Vision, Gig Dice et rapports utilisent donc strictement leurs fonctions existantes. Aucun Timer, Host Launch, deck, langue ou nouvelle action n'est ajouté.

### Validation Railway du Checkpoint B

- Passage Hub vers Table avec Host et Guest.
- Audio/vidéo dans les deux sens ; PiP local.
- Apparition et repli du dock après 2–3 secondes.
- Caméra, micro et menu de périphériques depuis le dock.
- Rapport et sortie de partie via leurs handlers existants.
- Vision : hover, aperçu et zoom inchangés fonctionnellement.
- Gig Dice : interaction, synchronisation et reset inchangés.
- F5 Host/Guest et recovery réseau.
- Desktop 1920×1080, tablette et mobile.

## Checkpoint C — Vision UX

### Interaction

- Le survol physique utilise exclusivement `TCGTableStateEngine.getSnapshot().lastHover` pour savoir si le pointeur se trouve sur une carte reconnue.
- L'image Candidate `displayCardImage` est présentée seule près du pointeur. Sa position bascule automatiquement à gauche ou au-dessus près des bords du viewport.
- L'aperçu est informatif, sans interaction et sans bouton d'agrandissement visible.
- La zone physique reconnue utilise un curseur `cell`, visuellement assimilable à un petit signe plus.
- Le clic sur cette zone déclenche programmatiquement le bouton Candidate `displayCardButton`, qui ouvre la carte déjà identifiée. Aucune nouvelle reconnaissance n'est lancée.

### Zoom

La modale Candidate `cardModal` et son image `modalCardImage` sont conservées. La présentation masque le nom et tous les panneaux pour ne montrer que la carte, avec la croix placée dans son coin supérieur droit. Les handlers Candidate ferment toujours par croix, Escape ou clic sur l'overlay extérieur.

### Contrats inchangés

- Aucun changement dans `app.js`.
- Aucun changement dans `vision-engine.js`, `detection-worker.js`, `identification.js` ou `table-state-engine.js`.
- Aucun changement de détection, tracking, identification, candidats, seuil, cadence, ONNX ou DB.
- Home, Hub et composition Table B sont protégés par comparaison avec le checkpoint précédent.
- Aucun sélecteur Gig Dice n'est ajouté ou modifié.

### Validation Railway du Checkpoint C

- Hover de cartes physiques au centre et près des quatre bords.
- Aperçu image seul, suffisamment lisible, non interactif et sans sortie du viewport.
- Curseur plus uniquement sur une hitbox reconnue.
- Clic sur la carte physique ouvrant immédiatement le bon zoom.
- Fermeture par croix, Escape et clic hors carte.
- Retour immédiat à la Table et maintien des flux audio/vidéo.
- Validation desktop 1920×1080, tablette et mobile.

## Checkpoint D — Gig Dice horizontal

### Éléments Candidate réutilisés

- `gigDicePanel`, `gigSelfDice` et `gigOpponentDice` restent reliés directement au rendu de `app.js`.
- Les vrais compteurs `gigSelfCred` et `gigOpponentCred` sont placés dans le `gig-core` du prototype sans duplication.
- Le vrai bouton `gigDiceReset` est déplacé dans `gameDeviceMenu` et conserve son handler Candidate.
- Les boutons contextuels `increment`/`decrement` et les hitboxes de drag existants sont conservés.

### Disposition et interaction

Le module porte directement la structure du prototype v3.7 : `gig-totem`, `gig-shell`, `gig-side2`, `dice-line2`, `gig-core`, `street-core` et `gig-trigger2`. L'ordre adverse est `d20` à `d4`; l'ordre local est `d4` à `d20`. L'algorithme `orderedGigDice()` reprend le placement native/volé de `orderedDice()` du prototype.

Le D20 circulaire central ouvre ou replie les deux lignes via la classe `open`. Aucun listener de clic extérieur n'est ajouté. Les deux Street Cred restent visibles de part et d'autre du D20 replié.

### Mécanique inchangée

`app.js` demeure l'unique propriétaire de l'état Gig : création des 12 dés, valeurs, `origin`, `owner`, Street Cred, transfert, persistance, recovery et synchronisation `gig-state`. Seuls le tri visuel et le markup de `renderGigLane()` portent le prototype. Le transfert change toujours seulement `owner`; la valeur et `origin` ne sont pas réécrits, ce qui conserve la couleur d'origine.

### Validation Railway du Checkpoint D

- Ouvrir/replier deux fois via le totem et cliquer hors widget.
- Vérifier les deux Street Cred dans les deux états.
- Survol de chaque type, tooltip et commandes +/-.
- Drag Host vers Guest et Guest vers Host, avec valeur et couleur conservées.
- Plusieurs vols successifs et ordre miroir stable.
- Reset depuis le menu secondaire et synchronisation sur les deux clients.
- F5 Host/Guest et recovery avec valeurs/propriétaires conservés.
- Absence de chevauchement avec dock, preview Vision, zoom et PiP.
- Desktop 1920×1080, tablette et mobile.
