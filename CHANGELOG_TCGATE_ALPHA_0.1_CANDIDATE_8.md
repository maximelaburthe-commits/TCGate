# TCGate Alpha 0.1 — Candidate 8

## MAJEUR — Fallback TURN prêt pour l'alpha publique

- Ajout d'un endpoint serveur `/api/rtc-config` protégé par l'identité du salon et du pair.
- Intégration prévue avec **Cloudflare Realtime TURN**.
- La clé maître TURN reste exclusivement dans les variables Railway.
- Le navigateur reçoit uniquement des identifiants TURN temporaires générés côté serveur.
- Un identifiant temporaire distinct est mis en cache par pair pour la durée de la session.
- P2P direct reste prioritaire avec `iceTransportPolicy=all`.
- Un mode de validation forcée `TCGATE_ICE_TRANSPORT_POLICY=relay` permet de confirmer qu'une partie passe réellement par TURN.
- Si TURN est temporairement indisponible en mode normal, TCGate conserve STUN/P2P pour les réseaux qui l'autorisent.

## INTERMÉDIAIRE — Rapports par salon

- Le début d'un nouveau salon remet désormais à zéro les événements et compteurs de rapport de la session précédente.
- Les métriques WebRTC cumulées et feedbacks Vision ne polluent plus le rapport du salon suivant.
- Ajout de la configuration TURN et de la politique ICE dans les rapports.
- Ajout du débit vidéo reçu/envoyé estimé en kb/s à partir des stats WebRTC.

## MINEUR — Codes de salon temporaires

- Le champ de code est vidé après une entrée réussie dans un salon et lors d'un retour à l'accueil.
- Le code précédent est effacé lors d'une nouvelle action « Rejoindre une partie ».
- `autocomplete`, correction automatique et spellcheck sont désactivés sur le champ afin d'éviter l'historique de codes temporaires.
- Un code présent dans un lien d'invitation `?room=` reste prérempli normalement.

## Inchangé

- Pipeline vidéo Candidate 6/7.
- Mode Sans jeu.
- Vision V5.3 / 512.
- Detection Worker.
- Vision Core.
- Identification.
- Vision State 0.1.6.
- Seuils et logique anti-reflet.
