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
