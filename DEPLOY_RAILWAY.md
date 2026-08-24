# Déploiement Railway — TCGate Alpha 0.1 Candidate 9

Candidate 9 conserve la configuration TURN validée avec Candidate 8.

Variables recommandées :
- `CLOUDFLARE_TURN_KEY_ID`
- `CLOUDFLARE_TURN_KEY_API_TOKEN`
- `TCGATE_TURN_TTL_SECONDS=21600`
- `TCGATE_ICE_TRANSPORT_POLICY=all`

Ne jamais committer les secrets Cloudflare dans GitHub.

Après déploiement :
1. vérifier `/api/health` : version `tcgate-alpha-0.1-candidate-9` ;
2. faire un test Cyberpunk normal Chrome/Chrome ;
3. tester un rafraîchissement de page pour la reprise du salon ;
4. faire un test court TURN `relay`, puis remettre immédiatement `all` ;
5. générer les deux rapports complets.
