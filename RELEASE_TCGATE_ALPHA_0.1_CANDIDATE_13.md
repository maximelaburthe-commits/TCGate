# TCGate Alpha 0.1 Candidate 13 · UI 1.1.0

Candidate coordonnée avec TCGate Control Center `0.3.1-rc.1` pour qualifier Report Schema V2.

## Périmètre

- émission additive de `reportSchemaVersion: 2` avec compatibilité Legacy ;
- enveloppe version, SHA, environnement, session pseudonymisée, rôle, navigateur, OS et TCG ;
- diagnostics Réseau, Vision et BDD collectés indépendamment ;
- erreurs de collecteur localisées, sans blocage de la partie ni du rapport ;
- limites de 64 événements réseau, 24 erreurs Vision, 32 problèmes BDD et 240 caractères par message ;
- cibles de taille 96 Kio par section, 384 Kio pour l’extension V2 et 768 Kio pour le rapport complet ;
- aucune collecte du parcours utilisateur, d’IP complète, de SDP, de candidat brut, de secret ou de média ;
- prise en charge des exports et de Report Intelligence par le Control Center ;
- observation `ACTIVE_DB_MISMATCH` sans activation, promotion ou restauration automatique de BDD.

## Réserves de qualification physique

- TURN réel non qualifié ;
- Host/Guest, F5, double F5, coupure réseau et ICE restart non rejoués avec deux navigateurs physiques ;
- Chromium et Firefox non qualifiés dans une session physique complète ;
- Safari non testé ;
- webcam et Vision physiques non testées ;
- seuils proches de 384 Kio et 768 Kio couverts automatiquement, sans longue session navigateur physique.
