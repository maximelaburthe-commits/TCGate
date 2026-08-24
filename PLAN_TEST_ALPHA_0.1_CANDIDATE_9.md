# Plan de test — TCGate Alpha 0.1 Candidate 9

## MAJEUR — non-régression
1. Partie Cyberpunk Chrome/Chrome 10 min : webcam, micro, Vision, hover HD, rapport.
2. Partie Sans jeu 10 min : aucun chargement Vision, flux fluide.
3. `TCGATE_ICE_TRANSPORT_POLICY=all` : P2P direct si disponible.
4. Test court `relay` : TURN Cloudflare doit encore fonctionner.

## MAJEUR — reprise de salon
1. En lobby : PC A crée, PC B rejoint, puis PC B actualise la page. Il doit revenir dans le même salon.
2. En partie : actualiser PC B. PC A doit être ramené au lobby de reprise ; PC B reprend le même salon. Réactiver les médias et cliquer de nouveau sur prêt.
3. Couper le réseau d'un PC 15–30 s puis le remettre. SSE doit revenir et WebRTC doit tenter une reprise.
4. Attendre plus de 5 min déconnecté : la session du joueur doit expirer et libérer sa place.

## MAJEUR — sécurité fonctionnelle
- les endpoints protégés sans `Authorization` doivent répondre 401 ;
- un peer ne doit pas pouvoir envoyer un signal au nom de l'autre ;
- un type de signal non autorisé doit être refusé ;
- spam rapide doit finir en 429 ;
- le rapport complet ne doit contenir aucun jeton de session/TURN longue durée.

## INTERMÉDIAIRE
- améliorer la reprise transparente sans retour lobby si l'ICE restart suffit ;
- protections infra anti-DDoS au niveau Railway/Cloudflare ;
- dépendances runtime Vision CDN à reconsidérer avant une phase plus large.
