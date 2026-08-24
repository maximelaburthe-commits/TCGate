# Déploiement Railway — TCGate Alpha 0.1 Candidate 10

Candidate 10 conserve la configuration TURN validée avec Candidates 8/9.

Variables recommandées :
- `CLOUDFLARE_TURN_KEY_ID`
- `CLOUDFLARE_TURN_KEY_API_TOKEN`
- `TCGATE_TURN_TTL_SECONDS=21600`
- `TCGATE_ICE_TRANSPORT_POLICY=all`

Ne jamais committer les secrets Cloudflare dans GitHub.

Après déploiement :
1. vérifier `/api/health` : version `tcgate-alpha-0.1-candidate-10` ;
2. faire un test Cyberpunk normal Chrome/Chrome ;
3. valider séparément F5 puis fermeture complète/réouverture d'onglet ;
4. valider débranchement/rebranchement de la même webcam puis remplacement par une autre webcam ;
5. faire les mêmes tests avec le micro ;
6. vérifier le PC HP : bouton `Je suis prêt` visible sans scroll ;
7. refaire une coupure réseau courte pour confirmer la non-régression C9 ;
8. faire un test court TURN `relay`, puis remettre immédiatement `all` ;
9. générer les deux rapports complets.
