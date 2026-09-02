# Déploiement Railway — TCGate Alpha 0.1 Candidate 11

Candidate 11 conserve la configuration TURN validée avec les Candidates précédentes.

Variables recommandées :
- `CLOUDFLARE_TURN_KEY_ID`
- `CLOUDFLARE_TURN_KEY_API_TOKEN`
- `TCGATE_TURN_TTL_SECONDS=21600`
- `TCGATE_ICE_TRANSPORT_POLICY=all`

Ne jamais committer les secrets Cloudflare dans GitHub.

Après déploiement :
1. vérifier `/api/health` : version `tcgate-alpha-0.1-candidate-11` ;
2. suivre `PLAN_TEST_ALPHA_0.1_CANDIDATE_11.md` ;
3. priorité absolue au test F5 + récupération des deux flux ;
4. tester hot-plug webcam puis reprise Vision ;
5. vérifier accueil HP, position initiale Gig et plein écran bord-à-bord ;
6. faire une coupure réseau courte de non-régression ;
7. générer les rapports finaux.

Laisser `TCGATE_ICE_TRANSPORT_POLICY=all` en utilisation normale.

# Cyberpunk DB privée

Définir `TCGATE_DB_GITHUB_TOKEN` dans les variables du service Railway. Utiliser
un token GitHub en lecture seule limité au dépôt privé `tcgate_db_cyberpunk`.
Sa valeur ne doit jamais être ajoutée au dépôt ni exposée au navigateur.
