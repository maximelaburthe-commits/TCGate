# UI 2.1 — Rappel de rapport Alpha et audit des données

Branche : `feature/ui-2-1-community-alpha`, base produit `6a5e15271d7339cb23167b93bc6e23c9c108404f`.

## Changement réalisé

- `public/alpha-report-exit.js` intercepte uniquement les clics volontaires sur `leaveLobby`, `leaveGame`, `confirmQuit`, `endQuit`, `endHub`. Il présente les trois choix facultatifs demandés. Il réutilise ensuite le bouton natif de sortie ; depuis `leaveGame`, la continuation appelle directement `confirmQuit` pour ne pas empiler deux confirmations.
- Le contexte de Room reste actif pendant le formulaire. Fermer le formulaire revient au choix de sortie ; Annuler revient à la session ou à la présentation de fin précédente. Un échec laisse le formulaire et sa note disponibles ; aucune sortie automatique, y compris après succès.
- Une réponse HTTP réussie avec `result.ok === true` marque le rapport comme envoyé pour la session. Une entrée locale `sessionStorage` contenant uniquement le code du salon préserve cette information après F5 ; elle est effacée à la sortie/changement de salon. Aucun identifiant d'authentification nouveau n'est stocké ou transmis.
- `public/report-mail-ui.js` conserve la génération ZIP et l'envoi existants. Seules des notifications locales de succès/fermeture et une ligne de statut visible/accessibilité ont été ajoutées. Le rappel ne crée ni endpoint, ni fournisseur, ni envoi concurrent.
- Le rappel n'écoute ni fermeture du navigateur, ni F5, ni perte de connexion. Aucun changement de `app.js`, des moteurs Vision ou du serveur de mail.
- Le contenu explicatif de `endOverlay` est simplifié après montage afin d'éviter de répéter le paragraphe Alpha avant le rappel.

## Audit exact des rapports

Le rapport transmis par `POST /api/report-email` contient `filename`, `zipBase64`, la note volontaire, le code du salon et le contexte salon/partie. La note est limitée à 2 000 caractères. Le ZIP réellement généré par le navigateur et transmis au fournisseur comporte trois fichiers texte : `report.json`, `rapport.txt`, `README.txt`.

Catégories observées dans `buildCompleteReport` et les collecteurs appelés :

- code de salon, rôle Host/Guest, jeu, horodatages, durée, états des joueurs prêts, présence adverse et minuteur ;
- environnement navigateur, système/plateforme, langue/fuseau, capacités matérielles exposées, écran et fenêtre ;
- noms et paramètres techniques des périphériques, états caméra/micro, résolution/fréquence et métadonnées de pistes, sans flux ;
- WebRTC, état réseau, types de routes ICE/TURN et métriques agrégées ;
- état, versions et diagnostic Vision/BDD, noms/identifiants de cartes reconnues, références/URL des images du catalogue, événements techniques ;
- identifiant de session pseudonymisé V2 et, selon les événements disponibles, identifiants de pairs ou d'appairage Phone Camera.

Aucun champ consacré au pseudonyme utilisateur n'est ajouté par `buildCompleteReport`. Une note libre ou un message technique peut néanmoins comporter des données saisies : le rapport ne doit pas être présenté comme anonyme. Les champs Legacy restent présents à côté des collecteurs V2 ; le drapeau `privacy.userJourneyCollected = false` de V2 ne signifie pas absence de tout événement technique dans le ZIP.

Les snapshots exportés ne sérialisent pas les pixels des flux vidéo, l'audio ou les crops locaux du matcher. Les valeurs `image`/`imageUrl` observées désignent des ressources du catalogue. Le test navigateur a également décodé le ZIP réellement envoyé par la fixture : trois fichiers texte, aucun payload `data:image`, `data:audio`, `data:video`, `cropDataUrl` ou `lastAnalyzedCropDataUrl`.

Distinction nécessaire : le retour testeur « carte non détectée » peut appeler localement `TCGDetectionLab.captureCase`. Cela ne joint pas ce cas local au ZIP de rapport. La mention publique porte donc sur le contenu transmis, sans affirmer que l'application ne crée jamais d'image locale.

Le serveur de rapport reçoit nécessairement les informations réseau de la requête. Pour l'antiabus, `fingerprint()` utilise `X-Forwarded-For` et l'adresse de socket pour calculer une empreinte SHA-256 tronquée, gardée en mémoire dans une Map. Le compteur limite à dix tentatives par fenêtre d'une heure ; cela ne démontre pas une durée de conservation d'une heure des entrées de la Map. Les adresses des candidats WebRTC sont volontairement exclues des métriques du rapport.

Le bridge transmet la pièce jointe et la note à l'API Resend, vers l'adresse destinataire configurée, avec les catégories `tcgate-alpha` et `tester-report`. Il ne stocke pas le rapport sur disque. Le code ne permet pas de vérifier la conservation effective dans la boîte destinataire, les journaux d'hébergement ou le compte Resend : aucune durée ni garantie supplémentaire n'est annoncée. Aucun secret ou fournisseur de Production n'a été consulté et aucun mail réel n'a été envoyé pendant ces vérifications.

## Vérifications effectuées

- `node alpha-report-exit-test.js` : PASS, 11 assertions (séparation des sessions, succès confirmé uniquement, réponses tardives, nouvelle session, absence d'écouteurs de fermeture et d'envoi concurrent).
- `node alpha-report-exit-browser-test.js` : PASS, 40 assertions, Chrome avec deux contextes indépendants, vraies Rooms et Ready, webcam/micro factices, deux parties, rôles inversés. Rappel Lobby/Game, les trois choix, fermeture du formulaire, échec avec conservation de la note/contexte, statut visible, succès avant la sortie, suppression ultérieure du rappel, reprise après F5, changement de salon, confirmation native conservée, sortie sans rapport unique, `endReport`, `endQuit`, `endHub`, absence de rappel après départ distant, F5 et fermeture.
- `node report-email-bridge-test.js` : PASS, 464 assertions, HTTP réel et Resend intercepté localement.
- `node report-email-browser-test.js` : PASS, 47 assertions, vrai ZIP Lobby/Game, schéma V2 et transmission des octets inchangés à Resend simulé.
- `node --check public/alpha-report-exit.js` et `public/report-mail-ui.js` : PASS.
- Captures contrôlées visuellement : rappel mobile 390 × 844, rappel Game 1366 × 768, trois actions visibles sans débordement.

Les preuves finales du nouveau parcours sont dans `exit-reports-retest3/`. La première version avait réussi 35 assertions. Le retest2 a révélé une omission du parcours de test : les commandes Game natives étaient masquées automatiquement (`controls.hidden-ui`, `pointer-events: none`). Le test final effectue un véritable mouvement du pointeur sur la vidéo pour révéler les commandes, comme le produit normal. Aucun clic forcé ni changement de CSS Game n'a été ajouté pour contourner ce comportement.

## Limites explicites

- Les périphériques sont factices et le fournisseur email est simulé : ces tests ne qualifient ni les webcams physiques, ni un envoi Resend réel, ni deux réseaux distants.
- Le runtime historique ne contient actuellement aucun déclencheur automatique d'ouverture de `endOverlay`. Pour tester ses actions existantes, sa présentation est explicitement ouverte par la fixture navigateur ; aucune fin de partie automatique supplémentaire n'est revendiquée ou implémentée.
- Si le navigateur refuse `sessionStorage`, le rappel conserve son fonctionnement en mémoire ; sa suppression après F5 ne peut alors pas être persistée.
- Aucun push, merge, commit ni déploiement n'a été effectué par ce lot.