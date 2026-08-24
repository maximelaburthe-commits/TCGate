# TCGate Alpha 0.1 — Candidate 10

## Périmètre
Candidate **MAJEURE de résilience de session et de périphériques**, basée sur Candidate 9.

Aucun changement du modèle Vision, Detection Worker, Vision Core, Identification, Table State, ni du Phone Camera Lab.

## 1. Reprise après fermeture complète de l'onglet
- ajout d'un jeton de récupération **distinct du jeton Bearer de session** ;
- ce jeton est conservé dans un cookie `HttpOnly`, `SameSite=Strict`, `Secure` sous HTTPS ;
- le jeton Bearer principal reste en `sessionStorage` et n'est pas déplacé dans `localStorage` ;
- `/api/recovery-state` permet à la page d'accueil de savoir si une partie est récupérable ;
- `/api/recover` délivre un **nouveau jeton de session**, invalide l'ancien et fait tourner le jeton de récupération ;
- la récupération reste bornée par la grâce serveur de 5 minutes après déconnexion ;
- un bouton **Reprendre la partie** apparaît sur l'accueil lorsqu'une session récupérable existe ;
- si la salle était déjà en phase `game`, la reprise conserve la phase et les états prêts : aucun retour volontaire au lobby ;
- l'autre joueur reste dans la partie avec l'état **Adversaire en reconnexion…** pendant la reconstruction WebRTC ;
- le rôle host/guest est conservé et la négociation WebRTC est reconstruite de façon déterministe.

## 2. F5 / actualisation
- la reprise Candidate 9 via `sessionStorage` est conservée ;
- lorsqu'un F5 survient en partie, la phase `game` et les états prêts sont désormais conservés côté serveur ;
- caméra/micro sont redemandés automatiquement avec les derniers périphériques connus lorsque possible ;
- la reprise WebRTC reste dans la partie.

## 3. Hot-plug et remplacement caméra / micro
- écoute de `MediaStreamTrack.ended` et `navigator.mediaDevices.devicechange` ;
- si la **même caméra ou le même micro** revient, TCGate tente une reprise automatique par `deviceId`, puis par libellé si nécessaire ;
- caméra et micro sont remplacés **indépendamment** : une panne caméra ne redémarre pas inutilement le micro, et inversement ;
- utilisation de `RTCRtpSender.replaceTrack()` lorsque la PeerConnection existe ;
- si un nouveau périphérique est branché, les listes sont rafraîchies immédiatement ;
- ajout d'un menu **Périphériques** accessible dans la barre de jeu pour choisir une nouvelle caméra ou un nouveau micro en cours de partie ;
- cliquer sur l'icône caméra/micro alors que le périphérique est absent ouvre directement le menu de remplacement ;
- les derniers `deviceId` choisis sont mémorisés comme préférence média non secrète afin de faciliter une reprise après F5/fermeture d'onglet ;
- l'état média distant est mis à jour pendant la perte/reprise afin que Vision puisse rester en pause lorsqu'il n'y a plus de vidéo exploitable.

## 4. Correctif responsive mineur
- compression verticale du lobby sur les viewports courts de portable ;
- cible : bouton **Je suis prêt** visible sans scroll sur les hauteurs usuelles proches de 768 px, y compris avec mise à l'échelle système réduisant la hauteur CSS disponible.

## Sécurité
- aucun secret TURN supplémentaire côté client ;
- le cookie de récupération ne contient ni code de salon ni `peerId` en clair : uniquement une valeur aléatoire opaque ;
- récupération protégée par contrôle d'origine sur POST et rate limiting ;
- récupération réussie = rotation du Bearer et du cookie de récupération ;
- `Quitter` reste explicite et supprime la session ainsi que le cookie de récupération.

## Non-objectifs
- pas d'intégration Phone Camera dans cette Candidate ;
- pas de changement de codec / bitrate / résolution ;
- pas d'optimisation Vision ;
- pas de nouveau TCG.
