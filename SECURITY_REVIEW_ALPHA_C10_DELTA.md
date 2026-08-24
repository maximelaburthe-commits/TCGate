# Security delta — TCGate Alpha Candidate 10

Ce document complète `SECURITY_REVIEW_ALPHA_C9.md` et décrit uniquement le delta introduit par Candidate 10.

## Nouveau mécanisme : reprise après fermeture d'onglet
Candidate 10 doit permettre de récupérer une salle alors que `sessionStorage` a disparu. Le jeton Bearer principal **n'est pas rendu persistant**.

### Choix retenu
- cookie de récupération opaque aléatoire 256 bits ;
- `HttpOnly` : non lisible par le JavaScript de la page ;
- `SameSite=Strict` ;
- `Secure` dès que la requête est servie en HTTPS ;
- durée maximale alignée sur la durée maximale d'un salon ;
- utilité effective bornée par la grâce de déconnexion serveur de 5 minutes ;
- stockage serveur uniquement sous forme d'empreinte SHA-256/index opaque ;
- rotation du jeton de récupération après une reprise réussie ;
- rotation du Bearer de session après une reprise réussie ;
- ancienne session API immédiatement invalidée ;
- suppression du cookie sur `Quitter` explicite.

### Endpoints
- `GET /api/recovery-state` : indique uniquement si le navigateur possède une session récupérable et ses métadonnées minimales ;
- `POST /api/recover` : contrôle d'origine + rate limit + cookie valide requis.

## Points à inclure dans la revue externe pré-alpha
- fixation / vol / rejeu du cookie de récupération ;
- comportement multi-onglets ;
- CSRF malgré `SameSite=Strict` et contrôle d'origine ;
- invalidation après `Quitter`, timeout et expiration du salon ;
- rotation des anciens Bearer ;
- absence du cookie et du Bearer dans les rapports et logs client ;
- comportement derrière proxy HTTPS Railway/Cloudflare (`Secure`).
