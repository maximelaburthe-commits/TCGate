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
