# TCGate — configuration de l’envoi des rapports Alpha

Le service démarre avec `npm start`, qui lance `report-mail-server.js` puis le serveur TCGate. Le bridge assure uniquement le transport par e-mail des ZIP générés par l’application ; Report Schema V2, les diagnostics et la génération ZIP restent côté frontend.

## Variables nécessaires au mail

Configurer sur le service TCGate :

- `RESEND_API_KEY` : clé API Resend ;
- `TCGATE_REPORT_TO_EMAIL` : destinataire des rapports ;
- `TCGATE_REPORT_FROM_EMAIL` : expéditeur autorisé par Resend.

Ne jamais écrire leurs valeurs dans Git, le navigateur ou les rapports. Le statut public n’expose ni adresse ni secret. Ces trois variables ne remplacent pas les variables réseau et TURN du service.

## Contrat HTTP

`GET /api/report-email/status` retourne `{ "ok": true, "configured": true|false }` selon la présence des trois variables.

`POST /api/report-email` reçoit le JSON contenant `zipBase64`, `filename`, `note`, `roomCode` et `context`. Après validation, Resend reçoit le ZIP inchangé en pièce jointe, avec note et contexte assainis. La réponse de succès est `{ "ok": true, "messageId": "..." }` ; l’identifiant peut être null si le fournisseur ne le transmet pas.

Les contrôles existants restent appliqués : origine comparée au Host, dix tentatives par connexion et par heure, corps limité à 8 Mio, pièce jointe limitée à 5 Mio, contrôle base64 et signature ZIP, nom de fichier et textes assainis, HTML échappé et clé d’idempotence Resend dérivée du ZIP et de la note. Les erreurs fournisseur sont renvoyées sous forme d’erreur générique côté testeur.

Le bridge n’écrit aucun rapport sur disque. Aucun volume de rapports n’est nécessaire à ce parcours mail. Le volume Railway existant reste inchangé et son éventuel retrait exige une décision séparée.

## Parcours testeur et confidentialité

1. Cliquer sur Rapport dans le Lobby ou la Table.
2. Ajouter éventuellement une note puis cliquer sur Envoyer le rapport.
3. Le frontend génère le ZIP technique existant et le transmet au bridge.
4. Le bridge valide puis expédie le ZIP par Resend.

Le navigateur ne reçoit jamais la clé API ni l’adresse destinataire. La note figure dans le corps du mail. La génération conserve Report Schema V2 et ses protections : aucune vidéo, aucun audio, aucune capture d’écran automatique et aucun parcours utilisateur collecté par V2. Voir [REPORT_SCHEMA_V2.md](REPORT_SCHEMA_V2.md).

## Validation locale

`npm run test:project-cleanup` vérifie le bridge HTTP avec Resend mocké, ses protections et le retrait des dépendances supprimées. `npm run test:report-email-browser` vérifie la génération réelle de ZIP depuis les boutons de rapport et le transport jusqu’au mock Resend ; Playwright doit être disponible, éventuellement via WORKSPACE_PLAYWRIGHT_PATH.

Les tests n’envoient aucun e-mail externe. Le déploiement Railway Test et la livraison réelle à une boîte mail restent à valider séparément. Aucune variable, aucun volume ni aucun service Railway n’est modifié par ces tests.
