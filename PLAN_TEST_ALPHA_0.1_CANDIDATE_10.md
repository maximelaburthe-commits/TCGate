# Plan de test — TCGate Alpha 0.1 Candidate 10

## 🔴 MAJEUR — non-régression de base
1. Chrome/Chrome, Cyberpunk, partie normale 10 min : webcam, micro, Vision, hover HD, plein écran, rapport.
2. Chrome/Chrome, Sans jeu, partie normale 10 min : aucun chargement Vision et flux fluide.
3. Coupure réseau d'un PC 15–30 s puis retour : la reprise déjà validée en C9 doit rester fonctionnelle.
4. `TCGATE_ICE_TRANSPORT_POLICY=all` en usage normal puis test court `relay`, avant retour immédiat à `all`.

## 🔴 MAJEUR — F5
1. En lobby : F5 d'un joueur → même salon repris.
2. En partie : F5 d'un joueur → retour direct à la partie, sans recréer de salon.
3. Vérifier que l'autre joueur reste dans la partie et voit seulement une phase de reconnexion.
4. Vérifier caméra, micro et WebRTC après la reprise.

## 🔴 MAJEUR — fermeture complète de l'onglet
1. Démarrer une partie puis fermer complètement l'onglet du PC B.
2. PC A doit rester dans la partie avec **Adversaire en reconnexion…**.
3. Rouvrir TCGate sur PC B dans les 5 minutes.
4. L'accueil doit proposer **Reprendre la partie**.
5. Cliquer sur le bouton : même code, même rôle, même pseudo, même partie.
6. Caméra/micro doivent être redemandés et WebRTC doit reprendre sans clic « prêt ».
7. Répéter lorsque le joueur fermé est host puis lorsqu'il est guest.
8. Répéter en fermant complètement le navigateur.
9. Test explicite **Quitter** : en revenant sur l'accueil, aucune reprise ne doit être proposée.
10. Après plus de 5 minutes déconnecté : la place doit être libérée et la reprise refusée.

## 🔴 MAJEUR — caméra / micro en cours de partie
### Même périphérique
1. Débrancher la webcam active : micro et salle restent actifs ; état caméra indisponible visible.
2. Rebrancher la même webcam : reprise automatique attendue, sans quitter la partie.
3. Débrancher le micro actif : vidéo et salle restent actifs.
4. Rebrancher le même micro : reprise automatique attendue.

### Nouveau périphérique
5. Débrancher la webcam A et brancher une webcam B.
6. Ouvrir **Périphériques** dans la barre de jeu et choisir webcam B.
7. Le flux doit reprendre via `replaceTrack()` sans retour lobby et sans couper inutilement le micro.
8. Faire l'équivalent micro A → micro B ; la vidéo ne doit pas être reconstruite inutilement.
9. Changer volontairement caméra puis micro alors que les anciens périphériques fonctionnent encore.
10. Vérifier que les listes se mettent à jour après branchement/débranchement (`devicechange`).

## 🟢 MINEUR — viewport portable
1. Chrome sur le PC HP réel : bouton **Je suis prêt** visible sans scroll.
2. Refaire à une hauteur CSS proche de 768 px puis proche de 610–650 px (cas typique de mise à l'échelle Windows).
3. Vérifier que le preview reste lisible et qu'aucun élément ne se superpose.

## Sécurité fonctionnelle
- `/api/recovery-state` sans cookie valide → `available:false` ;
- `/api/recover` sans cookie valide → 401 ;
- après récupération, l'ancien Bearer doit être refusé ;
- après `Quitter`, le cookie de récupération doit être supprimé ;
- le rapport complet ne doit contenir ni Bearer, ni cookie de récupération, ni secret TURN longue durée.

## Critère de promotion
Candidate 10 peut remplacer Candidate 9 lorsque :
- F5 reste vert ;
- fermeture/réouverture d'onglet est verte host **et** guest ;
- hot-plug même caméra et même micro est vert ;
- remplacement par nouveau matériel est vert ;
- reconnexion réseau C9 n'a pas régressé ;
- aucune régression du flux / Vision / Sans jeu n'est observée.
