# Revue interne sécurité — Candidate 9

## MAJEUR — traité dans C9
- **Usurpation de peer** : auparavant le `peerId` public suffisait pour appeler les API ; C9 introduit un secret de session 256 bits hashé côté serveur.
- **Signalisation non contrainte** : allowlist des messages WebRTC et limites de taille.
- **Bruteforce / spam API** : rate limiting par origine réseau et par session.
- **SSE** : jetons à usage unique et courte durée au lieu d'un secret durable dans l'URL.
- **Headers navigateur** : CSP, anti-frame, permissions caméra/micro, nosniff, referrer et HSTS sous HTTPS.
- **Erreurs / healthcheck** : réduction des informations opérationnelles exposées.
- **Traversal statique** : résolution et vérification `path.relative`.

## MAJEUR — reste avant Public Alpha
- revue indépendante par un développeur sécurité/web ;
- test dynamique de la Candidate déployée ;
- vérification des secrets Railway/GitHub et rotation de tout secret ayant pu être exposé ;
- politique de logs et conservation côté hébergeur ;
- contrôle des quotas/coûts TURN et scénarios d'abus.

## INTERMÉDIAIRE
- le serveur de salon est en mémoire : un redéploiement Railway supprime les salons ; acceptable en alpha, à rendre persistant si le besoin apparaît ;
- OnnxRuntime est chargé depuis jsDelivr par le worker Vision. Version épinglée, mais une distribution locale pourra réduire la dépendance supply-chain ;
- les bases/images de cartes sont chargées depuis GitHub/CDN : vérifier plus tard cache, intégrité et politique de disponibilité.

## MINEUR
- renforcer encore les métriques de rate-limit dans les rapports administratifs ;
- ajouter un écran utilisateur dédié à la reprise/expiration au lieu des toasts actuels.
