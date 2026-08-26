# TCGate v0.4 - Configuration envoi des rapports par mail

## Fichiers à copier dans GitHub

À la racine du dépôt `TCGate` :
- `report-mail-server.js`
- `package.json` (remplace le fichier existant)

Dans `public/` :
- `index.html` (remplace le fichier existant)
- `report-mail-ui.js`
- `report-mail.css`

Les fichiers `server.js` et `public/app.js` restent inchangés.

## Variables Railway

Ajouter dans le service TCGate :

- `RESEND_API_KEY` = clé API Resend, commence typiquement par `re_...`
- `TCGATE_REPORT_TO_EMAIL` = votre adresse qui recevra les rapports
- `TCGATE_REPORT_FROM_EMAIL` = expéditeur autorisé par Resend, par exemple `TCGate Reports <reports@votredomaine.fr>`

Ne jamais écrire la clé API dans GitHub ou dans le JavaScript navigateur.

## Resend

Pour un test initial, Resend propose `onboarding@resend.dev` dans ses exemples. Pour un usage normal, utilisez une adresse d'un domaine que vous avez vérifié dans Resend.

## Parcours testeur

1. Le testeur clique sur `Rapport`.
2. Une fenêtre `Notes facultatives` s'ouvre.
3. Il ajoute éventuellement son contexte.
4. Il clique sur `Envoyer le rapport`.
5. TCGate génère le même ZIP technique que le bouton Rapport actuel.
6. Le ZIP est envoyé au serveur TCGate.
7. Le serveur l'expédie à `TCGATE_REPORT_TO_EMAIL` via Resend.

Le navigateur ne reçoit jamais l'adresse destinataire ni la clé API.

## Confidentialité

Le rapport existant indique :
- aucune vidéo enregistrée ;
- aucun audio enregistré ;
- aucune capture d'écran automatique ;
- aucune adresse IP incluse dans le ZIP.

La note facultative est incluse dans le corps du mail.
