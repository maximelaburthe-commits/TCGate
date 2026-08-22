# Plan de test — TCGate Alpha 0.1 Candidate 8

## Objectif principal : valider TURN

### Phase A — fonctionnement normal

Railway :
- `CLOUDFLARE_TURN_KEY_ID` configuré ;
- `CLOUDFLARE_TURN_KEY_API_TOKEN` configuré ;
- `TCGATE_ICE_TRANSPORT_POLICY=all`.

1. Déployer Candidate 8.
2. Vérifier `/api/health` : `turn.configured` doit être `true`.
3. Créer/rejoindre une partie Cyberpunk.
4. Vérifier que la partie reste fluide.
5. Générer les deux rapports.
6. Sur un réseau permettant le P2P, `TURN/relay utilisé` peut rester `false` : c'est normal.

### Phase B — test TURN forcé (MAJEUR)

1. Dans Railway, passer temporairement :
   `TCGATE_ICE_TRANSPORT_POLICY=relay`
2. Redéployer sans autre modification.
3. Créer une nouvelle partie avec deux PC/réseaux.
4. Vérifier vidéo et audio dans les deux sens pendant 3 à 5 minutes.
5. Générer les deux rapports.
6. Les rapports doivent indiquer :
   - `Politique ICE: relay`
   - `TURN configuré/disponible: true / true`
   - `TURN/relay utilisé: true`
   - au moins un candidate type `relay`.
7. Après validation, remettre impérativement :
   `TCGATE_ICE_TRANSPORT_POLICY=all`
   puis redéployer.

## Rapports par salon

Créer un salon, générer un rapport, quitter puis créer un second salon.
Le rapport du second salon doit :
- commencer à son entrée dans ce salon ;
- contenir uniquement le nouveau code ;
- ne plus conserver les événements/cumuls du premier salon.

## Codes de salon

1. Rejoindre un salon par code.
2. Quitter.
3. Cliquer de nouveau sur « Rejoindre une partie ».
4. Le champ doit être vide et ne doit pas proposer la liste des anciens codes TCGate.
5. Tester aussi un lien `?room=XXXXXX` : son code doit toujours être prérempli.

## Qualité vidéo

Dans `rapport.txt`, vérifier la présence de :
- résolution reçue/envoyée ;
- fps reçus/envoyés ;
- bitrate reçu/envoyé en kb/s.
