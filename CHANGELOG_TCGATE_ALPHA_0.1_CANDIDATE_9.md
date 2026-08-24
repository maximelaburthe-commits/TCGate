# TCGate Alpha 0.1 — Candidate 9

## Périmètre
Candidate MAJEURE de robustesse/sécurité basée sur Candidate 8. Aucun changement du modèle Vision, Detection Worker, Vision Core, Identification ou Table State.

## Sécurité
- jeton de session secret distinct du `peerId` public ;
- authentification obligatoire pour état, ready, signalisation, TURN et leave ;
- tickets SSE temporaires et à usage unique : le jeton de session n'est pas placé dans l'URL EventSource ;
- génération des codes de salon via `crypto.randomInt()` ;
- rate limiting création/join/session/signalisation ;
- validation stricte des types et tailles des messages WebRTC ;
- payload JSON limité à 64 Kio ;
- contrôle d'origine sur les POST navigateur ;
- headers CSP / anti-framing / nosniff / referrer / permissions / HSTS sous HTTPS ;
- `/api/health` réduit au minimum ;
- erreurs serveur internes non renvoyées au navigateur ;
- chemin des fichiers statiques durci contre la traversée de répertoires.

## Robustesse
- un rafraîchissement ou une coupure ne quitte plus automatiquement le salon ;
- conservation d'une session déconnectée pendant 5 minutes ;
- reprise du même salon grâce au jeton conservé dans `sessionStorage` ;
- lors d'une reprise, les deux joueurs reviennent proprement au lobby et reconfirment leur état prêt ;
- reconnexion SSE avec nouveau ticket ;
- tentative d'ICE restart WebRTC après déconnexion/échec.

## À valider
- tests réels Chrome/Chrome P2P + TURN ;
- rafraîchissement d'un joueur en lobby puis en partie ;
- coupure réseau courte puis retour ;
- vérification qu'un client sans jeton ne peut pas piloter une session ;
- revue externe de sécurité toujours recommandée avant ouverture publique.
