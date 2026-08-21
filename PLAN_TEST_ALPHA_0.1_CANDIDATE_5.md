# Plan de test — TCGate Alpha 0.1 Candidate 5

## Objectif principal

Vérifier que l'EMEET peut démarrer en 1080p, puis que TCGate bascule la **capture réelle** en 1280×720 si l'encodeur est durablement limité par le CPU, avec un retour à un flux adverse fluide et sans latence croissante.

## Configuration prioritaire

Reproduire la configuration qui déclenchait le problème :

- PC A : Chrome + webcam EMEET ;
- PC B : Firefox + webcam intégrée ;
- le rôle host/guest n'a plus d'importance pour ce diagnostic.

## Test A — EMEET 1080p

1. Créer/rejoindre une partie normalement.
2. Vérifier que l'EMEET démarre en 1920×1080 si disponible.
3. Faire des mouvements continus et visibles devant la caméra du PC A pendant 30 à 60 secondes.
4. Observer le flux du PC A sur le PC B.
5. Si le CPU sature, attendre au moins 10 secondes sans changer de périphérique.
6. Vérifier visuellement si la fluidité revient après la bascule adaptative.
7. Continuer la session 5 à 10 minutes avec quelques cartes/survols Vision.
8. Générer un rapport complet sur les deux PC.

### Résultat attendu

Dans le rapport du PC A, si l'adaptation s'est déclenchée :

- média local final proche de `1280×720 @ 30 fps` ;
- `captureAdaptiveMode = cpu-capture-720p` ;
- au moins une entrée dans `captureAdaptations` ;
- sender WebRTC en échelle `1x` ;
- cadence WebRTC sensiblement supérieure au cas Candidate 4 à 8–13 fps ;
- absence de descente automatique sous 720p.

Sur le PC B :

- flux adverse nettement plus fluide ;
- pas de croissance importante du jitter buffer ;
- pas de latence de plusieurs secondes.

## Test B — contrôle 720p natif

Sur le PC A, sélectionner ensuite la webcam intégrée 1280×720 et refaire 1 à 2 minutes de mouvements.

Résultat attendu : aucune adaptation de capture nécessaire et flux fluide.

## À signaler immédiatement

- caméra qui se coupe pendant l'adaptation ;
- micro qui disparaît après l'adaptation ;
- bascule sous 720p ;
- alternance répétée 1080p/720p ;
- flux toujours à moins d'environ 20 fps après adaptation ;
- latence importante malgré un flux entrant fluide.
