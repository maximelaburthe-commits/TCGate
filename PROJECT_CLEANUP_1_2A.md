# TCGate — Maintenance 1.2A

Branche exclusive : `update/next`. Checkpoint précédent et point de rollback : `5d808633b2793dc33e1f859f04ae56a10779db01` (UI 1.2). Ce checkpoint reste un commit distinct ; aucun squash ni merge.

## Retrait du Control Center

Le runtime ne dépend plus du Control Center historique : suppression du forwarder, de l’inbox privée sur disque, de son token, de ses routes HTTP et de ses variables. Le bridge n’intercepte plus aucune ancienne route `/api/control-center/*` ; elles suivent le serveur TCGate normal et retournent 404, sans redirection.

Fichiers supprimés :

- `control-center-forwarder.js` : dépendance de forwarding retirée ;
- `control-center-forwarder-test.js` : suite exclusivement liée à cette fonction retirée.

Script npm supprimé : `test:control-center-forwarder`. Nouveaux scripts : `test:project-cleanup` et `test:report-email-browser`. Aucun autre script historique applicable n’est supprimé.

Dans `report-mail-server.js`, les fonctions inboxConfigured, validInboxId, tokenMatches, ensureInbox, persistInboxReport, listInboxReports, getInboxReport et handleControlCenter sont retirées, ainsi que les constantes et imports fs/path devenus inutiles. Aucun code commenté de l’ancien bridge n’est conservé.

## Fonctions conservées

Le parcours est désormais frontend → `POST /api/report-email` → validation → Resend → e-mail avec ZIP. `GET /api/report-email/status` expose uniquement ok/configured ; le succès POST expose uniquement ok/messageId. L’audit de `public/report-mail-ui.js` confirme que le frontend utilise response.ok, result.ok et result.error, sans dépendre des champs retirés. Aucun changement visuel de la fenêtre ou des boutons Rapport.

Les onze fonctions conservées du bridge restent identiques au checkpoint, notamment même origine, empreinte de limitation, dix tentatives par heure, limite corps 8 Mio, pièce jointe 5 Mio, contrôle base64 et signature ZIP, assainissement de la note/code/contexte/nom, HTML échappé, pièce jointe et clé d’idempotence Resend. L’appel sendViaResend devient direct. Le bridge ne réalise aucune écriture disque.

Report Schema V2, les diagnostics indépendants, les protections de confidentialité, la génération ZIP, les boutons Lobby/Table et le frontend mail sont conservés. `REPORT_SCHEMA_V2.md`, `report-schema-v2-test.js`, `fixtures/report-v2-redacted.json` et `public/report-diagnostics-v2.js` restent intacts. Tous les fichiers de public/, server.js, les modèles et la configuration Railway restent identiques au checkpoint : UI 1.2, Ready, Room, Timer, Gig Dice, WebRTC, recovery, Phone, Vision, identification, Table State, BDD et Workspace ne sont pas refactorisés.

## Documentation

README présente désormais Report Schema V2 + envoi e-mail des rapports Alpha. RAILWAY_REPORT_EMAIL_SETUP.md décrit uniquement le bridge actuel et les trois variables mail nécessaires. Les notes Candidate 13, le changelog Home 1.0.6 et le journal UI 1.2 sont explicitement marqués comme archives pour conserver le contexte historique de qualification, sans consigne active de déploiement Control Center.

Une chaîne de nom similaire est conservée dans `public/workspace-database-maintenance-model.js:7` : `data/control-center-update-candidate.json`. Il s’agit d’un artefact BDD externe lu sur GitHub à un SHA fixé, avec credentials omis, et non d’un appel au service Control Center. Sa fixture dans workspace-maintenance-journal-browser-test.js conserve ce contrat. La supprimer casserait la maintenance BDD ; ce jalon n’autorise pas cette modification.

## Audit général et suppressions supplémentaires

Aucune suppression hors Control Center. Recherches effectuées sur les fichiers suivis avec git grep/rg, références HTML/CSS/JS, imports/requires, scripts npm, noms d’assets et hash de contenu. Aucun temporaire suivi de type tmp/bak/old/orig/rej, doublon exact d’asset hors BDD, ou JS public sans référence runtime/test/documentation n’a été identifié par cet audit. Les références dynamiques empêchent de conclure qu’une simple absence d’import rend un fichier inutile.

Exemples conservés avec preuves :

| Fichier ou groupe | Référence ou raison de conservation |
| --- | --- |
| public/assets/home-alpha-orbit-hero-approved.webp | Aucun usage produit ; nom encore référencé par les tests négatifs tcgate-ui-1.2-contract.js:8 et tcgate-ui-1.2-browser-test.js:135. La règle demandée impose de conserver un asset encore référencé. |
| public/assets/home-alpha-orbit-hero.svg | Pas de référence littérale active retrouvée ; ancienne maquette vectorielle liée à l’historique Home 1.0.6, conservée faute de nécessité de supprimer cette preuve historique. |
| public/assets/home-portal-art-crop.png | Références dans PATCH_INDEX_UI_1.0.5.diff:34/38 et HASHES_C9_UI_INTEGRATION_1.txt:4 ; le patch reste cité par le changelog UI 1.0.5. |
| public/assets/dice/D*.svg et self/opponent | Références dynamiques dans smoke-test-ui-v1.js:30 et smoke-test-ui-v1-0-1.js:9–10. |
| public/cards-fallback.json | Runtime identification.js:23. |
| public/table-state-bridge.js | Chargement app.js:683. |
| public/assets/tcgate-mark.svg | Référence CSS tcgate-alpha-ui-1.0.5.css:99. |

Dette restante : makeZone() dans future-ux-v3.7.js:7 n’a plus d’appel depuis le montage statique UI 1.2 ; il est conservé pour garder ce frontend intégralement inchangé. Les anciens CSS et fixtures historiques restent référencés et ne sont pas retirés par ancienneté. Le contrôle ZIP historique vérifie la signature PK, sans validation exhaustive d’archive ; un corps dépassant 8 Mio peut entraîner la fermeture de connexion plutôt qu’une réponse JSON. Les comportements existants de Resend sont conservés, y compris un succès HTTP fournisseur sans JSON exploitable donnant messageId:null. Ces limites ne sont pas élargies dans ce chantier de nettoyage.

## Volume et Railway

**VOLUME /data : probablement orphelin**, selon le code de cette branche après retrait de l’inbox. Aucun usage restant du montage absolu /data ni d’une variable de volume n’a été trouvé dans le runtime. Les lectures de server.js:13–14/592 concernent public/ et models/ à côté du code ; rooms, sessions, Phone et cache TURN sont en mémoire. Le chemin relatif distant data/control-center-update-candidate.json n’utilise pas le volume.

Cette conclusion ne vérifie ni les fichiers historiques présents ni les usages hors dépôt. Le volume tcgate-volume, son contenu, toutes les variables et tous les services Railway restent intacts. Le projet séparé TCGate_Control_Center n’est ni modifié ni supprimé.

Après un déploiement et une validation réussis sur Railway Test, les quatre anciennes variables suivantes ne sont plus utilisées par ce code et pourront être retirées manuellement de Test : CONTROL_CENTER_URL, CONTROL_CENTER_INGEST_KEY, TCGATE_CC_SYNC_TOKEN, TCGATE_REPORT_INBOX_DIR. Aucune n’est retirée ici. Production reste hors périmètre tant que main utilise l’ancien code. RESEND_API_KEY, TCGATE_REPORT_TO_EMAIL, TCGATE_REPORT_FROM_EMAIL et les variables TURN sont conservées ; aucune valeur n’est reproduite.

## Validation

Le contrat de retrait et les tests HTTP utilisent le vrai serveur local avec un mock Resend dans un processus enfant isolé. Aucune requête e-mail externe ne peut sortir de ce mock. Le smoke navigateur utilise les vrais boutons Lobby/Table, la génération ZIP et le bridge HTTP ; il vérifie le contenu Report Schema V2 et que les octets du ZIP arrivent inchangés au mock Resend. Les médias de ce smoke sont simulés ; ni webcams physiques, ni téléphone réel, ni TURN distant, ni livraison e-mail réelle ne sont qualifiés.

Les suites applicables UI 1.2, Room/Ready/Timer/Gig Dice, Phone, Vision, BDD, Workspace et Report Schema V2 restent exécutées. Les commandes, codes de sortie et limites sont consignés dans [PROJECT_CLEANUP_1_2A_VALIDATION.txt](PROJECT_CLEANUP_1_2A_VALIDATION.txt). Le logo est contrôlé à SHA-256 56660fac88d53f7fc9e6056725a4067f89f5cc0079f70407cb79180bb7d92515, PNG RGBA 2048 × 682.

Résultats : **31 suites distinctes réussies**. Bridge : 344 assertions ; navigateur mail : 47 assertions ; navigateur UI 1.2 : 366 assertions. `npm run check` : code 0, 82 fichiers JavaScript ; `git diff --check` : code 0. Le contrôle de diff contre le checkpoint confirme public/, server.js, models/, railway.json et les fichiers Report Schema V2 intégralement inchangés. Le contrat final couvre aussi le propriétaire public/report-mail-ui.js.
