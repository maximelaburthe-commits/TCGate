# Phone Camera 1.2C — qualification physique à réaliser

Statut initial : **Chrome Android physique non qualifié**. Tous les points ci-dessous sont NON QUALIFIÉS ; aucun appareil réel n’a été utilisé par Codex. Les tests Chrome avec périphériques factices vérifient des contrats logiciels uniquement.

Consigner pour chaque campagne : date, SHA TCGate déployé, modèle téléphone, version Android/Chrome, modèle PC/navigateur, réseau, durée et observations. Distinguer succès, échec, non supporté et non testé. Le standalone doit rester disponible pendant cette qualification ; ne modifier aucune ressource Railway.

## Appareil et association

- [ ] Chrome Android réel, autorisations caméra et absence de demande micro téléphone.
- [ ] Connexion Wi-Fi ; tester séparément 4G/5G si disponible.
- [ ] QR généré dans Lobby → Mon installation → Utiliser mon téléphone.
- [ ] Association valide, jeton initial consommé une seule fois ; rejeu refusé.
- [ ] Expiration du QR avant association, puis création d’un nouveau QR.
- [ ] Reconnexion à une association existante sans privilège PC.

## Caméra, objectifs et commandes PC

- [ ] Caméra arrière principale ; image effectivement reçue et animée sur le PC.
- [ ] Ultra-wide et téléobjectif uniquement s’ils sont exposés ; noter non supporté sinon.
- [ ] Fallback caméra avant si aucun objectif arrière disponible.
- [ ] Sélection depuis le PC, ancienne caméra arrêtée et nouvelle image animée.
- [ ] Refus/perte d’objectif : erreur explicite, rollback et flux précédent si possible.
- [ ] Autofocus natif/continu selon capacités ; aucun focus manuel à attendre.
- [ ] Zoom matériel et champ maximum uniquement s’ils sont exposés.
- [ ] Rotation paysage/portrait, garde d’orientation et cadrage de la table physique.
- [ ] Résolution réelle et cadrage cohérents après chaque changement.

## Qualité, audio et énergie

- [ ] Auto / 720p : cible 1280 × 720 à 30 fps, mesurer le résultat réel.
- [ ] 1080p expérimental si proposé : résolution/FPS réels et repli en cas d’instabilité.
- [ ] Voix captée uniquement par le micro PC ; aucun écho provenant d’un micro téléphone.
- [ ] Partie réelle avec adversaire : vidéo Phone transmise à la place de la webcam PC, micro PC conservé.
- [ ] Endurance d’au moins 20 minutes, noter FPS, débit, codec et erreurs.
- [ ] Batterie si API disponible, conditions de charge et consommation observée.
- [ ] Chauffe ressentie et éventuelle baisse de cadence ; aucune température matérielle supposée.
- [ ] Écran maintenu allumé si Wake Lock supporté ; luminosité réglée manuellement.

## Recovery et arrêt

- [ ] F5 PC : conserver la page Phone, retrouver une vidéo réellement animée.
- [ ] Reprise PC par cookie/session récupérée : association conservée malgré rotation du bearer.
- [ ] Verrouillage puis réveil du téléphone, noter la reprise ou le geste nécessaire.
- [ ] Perte et retour réseau Wi-Fi, puis transition Wi-Fi ↔ 4G/5G si possible.
- [ ] Route directe puis relay TURN lorsque disponible ; noter RTT et stabilité sans copier de credentials.
- [ ] Arrêt depuis le téléphone puis retour à la webcam PC.
- [ ] Arrêt depuis le PC, puis webcam PC ; micro toujours utilisable.
- [ ] Dissociation et nouvelle association, sans réutilisation du jeton initial.

## Diagnostics et décision

- [ ] Export JSON Phone/PC lisible, avec métriques disponibles et limites clairement signalées.
- [ ] Aucun deviceId brut, IP, SDP, candidate brute, token ou credential dans l’export.
- [ ] Aucun média enregistré ou uploadé par la fonction Phone.
- [ ] Consigner les résultats séparément pour chaque appareil et réseau.
- [ ] Décision produit explicite après qualification avant tout décommissionnement standalone.

Ne cocher un point qu’après observation réelle et joindre une preuve appropriée. Ne publier aucun secret ou diagnostic brut non vérifié.
