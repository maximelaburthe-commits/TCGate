# Candidate 15 — checklist Q0 à Q16

Consigner le SHA gelé, date, navigateur/matériel et résultat de chaque passe. Les preuves automatisées portent leur propre SHA dans `qualification.json` ; les appareils de ces suites sont factices. Les cases ci-dessous servent à la passe humaine ultérieure et restent non cochées par Codex.

| Q | Parcours / critère | Couverture et état physique |
| --- | --- | --- |
| Q0 | Home cinq pages, navigation, logo et responsive | UI 1.2 browser ; humain [ ] |
| Q1 | Host crée une room | UI/C15 browser ; humain [ ] |
| Q2 | Guest rejoint la même room | UI/C15 browser ; humain [ ] |
| Q3 | Réglages partagés Host éditables, Guest lecture seule | UI/Room browser ; humain [ ] |
| Q4 | Ready des deux joueurs puis Start | UI/C15 browser ; humain [ ] |
| Q5 | Webcam et microphone, audio/vidéo reçus dans les deux sens | C15 browser : vrais RTP locaux, nouvelles frames, matériel simulé ; humain [ ] |
| Q6 | Timer ON puis OFF ; start/pause/reset et synchronisation | UI/Room/C15 browser ; humain [ ] |
| Q7 | Gig Dice ON/OFF et jeu supporté ; hover centre/bords, zone alignée, zoom centré | C15 browser : 180 sondes à 1366/900/560 ; humain [ ] |
| Q8 | Sans jeu : pas de Vision, pas de Gig, webcam/audio fonctionnels | C15 browser ; humain [ ] |
| Q9 | F5 Host : même room/peer/Ready, nouveaux médias reçus | C15 browser ; humain [ ] |
| Q10 | F5 Guest : mêmes invariants | C15 browser ; humain [ ] |
| Q11 | Double F5 : nouveaux médias reçus dans les deux sens | C15 browser ; humain [ ] |
| Q12 | Phone : QR/pairing, objectifs/qualité/zoom/autofocus, audio PC, recovery | **PHYSICAL QUALIFICATION PASS déclaré par le propriétaire pour Phone 1.2C** ; régression logicielle par suite Phone actuelle |
| Q13 | Arrêt Phone et retour webcam, microphone PC conservé | Phone consolidation browser ; validation physique globale Phone déclarée ; détails non fournis [ ] |
| Q14 | Génération ZIP puis envoi Resend | Mail browser : vrai ZIP → mock, livraison mail réelle [ ] |
| Q15 | TURN relay : forcer/observer route relay et médias reçus | Config/cache/policy mockés ; **relay distant NOT TESTED** sur C15 [ ] |
| Q16 | Quelques cartes Cyberpunk physiques : caméra → détection → identification | **NOT TESTED**, confirmation explicite du propriétaire. Passe courte à faire [ ] |

Ne pas transformer Q16 en benchmark complet ; Vision Qualification 1.0 reste un chantier séparé. Pour Q7, toute reproduction du problème de hover/zoom est **INTERMÉDIAIRE**, à consigner en follow-up sans correction improvisée pendant cette campagne.

Le PASS Phone est une déclaration de qualification physique reçue, pas une campagne matérielle exécutée par Codex. Les détails absents (SHA matériel, modèles et résultats individuels) ne sont pas inventés. Le [reçu Phone](PHONE_PHYSICAL_QUALIFICATION_1_2C.md) et l'historique restent conservés.
