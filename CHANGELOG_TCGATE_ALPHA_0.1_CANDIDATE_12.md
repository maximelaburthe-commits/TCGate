# TCGate Alpha 0.1 Candidate 12

- Active Star Wars Unlimited comme deuxième jeu jouable.
- Consomme la DB GitHub SWU indépendante `tcgate_db_star_wars_unlimited` sur `develop-swu-db-v0.3`.
- Intègre Vision R14 : identification `cardId + side`, affichage canonique immédiat et variante Showcase optionnelle.
- Standard, Hyperspace et Foil affichent volontairement l'image Standard canonique.
- Showcase est promue uniquement après trois observations unanimes ; `printingId` reste `null`.
- Préserve le runtime, le matcher et les Gig Dice Cyberpunk.
- Corrige le fallback d'affichage Cyberpunk pour `SHARED` et `CANONICAL_ONLY` sans inventer de printing.
- Conserve Sans jeu sans DB, sans Vision et sans Gig Dice.
- Ajoute uniquement `cdn.starwarsunlimited.com` aux directives CSP `connect-src` et `img-src`.
- Aucun crop, frame, flux vidéo ou audio n'est téléversé par Vision ou inclus dans les rapports.
- Limite connue : certaines prises SWU difficiles peuvent volontairement produire `NO_MATCH`.

Statut : **SWU PRODUCT-INTEGRATION CANDIDATE**. Un test physique à deux navigateurs reste requis avant toute déclaration production-ready.
