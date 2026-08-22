# Déploiement Railway — TCGate Alpha 0.1 Candidate 8

## 1. Déployer Candidate 8

Déposer le contenu de l'archive à la racine du dépôt Railway puis attendre le healthcheck `/api/health`.

Le JSON doit contenir :

```json
{
  "ok": true,
  "version": "tcgate-alpha-0.1-candidate-8"
}
```

## 2. Configuration TURN Cloudflare — obligatoire avant validation Public Alpha RC

Créer une clé **Cloudflare Realtime TURN** puis ajouter dans les Variables du service Railway :

```text
CLOUDFLARE_TURN_KEY_ID=<identifiant de la clé TURN>
CLOUDFLARE_TURN_KEY_API_TOKEN=<secret/token de cette clé TURN>
TCGATE_ICE_TRANSPORT_POLICY=all
TCGATE_TURN_TTL_SECONDS=21600
```

Important :
- `CLOUDFLARE_TURN_KEY_API_TOKEN` reste uniquement côté serveur Railway ;
- ne jamais le mettre dans `public/`, GitHub ou un rapport ;
- le navigateur reçoit uniquement des credentials temporaires expirables.

`TCGATE_TURN_TTL_SECONDS=21600` donne des credentials valables 6 heures, au-delà de la durée maximale actuelle d'un salon TCGate (4 h).

## 3. Test de relais obligatoire

Après un premier test en mode normal, passer temporairement :

```text
TCGATE_ICE_TRANSPORT_POLICY=relay
```

Redéployer et réaliser une partie de test. Les rapports doivent confirmer `TURN/relay utilisé: true`.

Ensuite remettre :

```text
TCGATE_ICE_TRANSPORT_POLICY=all
```

et redéployer. Le mode `relay` n'est qu'un outil de validation : en production, TCGate doit tenter le P2P direct et n'utiliser TURN qu'en fallback.

## 4. Si TURN n'est pas encore configuré

Candidate 8 continue de fonctionner avec STUN/P2P sur les réseaux compatibles. `/api/health` indiquera :

```json
"turn": {
  "configured": false
}
```

Le MAJEUR TURN n'est alors **pas considéré comme validé** pour l'alpha publique.
