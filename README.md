# TCGate — Alpha fermée 0.1 · Candidate 2

Candidate 2 repart exactement de la Candidate 1 officielle et corrige uniquement
les problèmes d'intégration révélés par les premiers rapports alpha.

## Parcours alpha

`Créer/Rejoindre -> caméra + micro -> WebRTC -> Vision sur flux adverse -> lecture HD au survol`

Aucun compte n'est requis dans cette candidate.

## Vision intégré

- détecteur stable issu de la référence V0.6.2 / V5.3 512 ;
- identification avec Cache Freshness Guard ;
- Strict High-Glare Rescue ;
- Vision State `0.1.6-facewebcam-memory-hover` ;
- Memory Hover ;
- Atomic HD Image Handoff avec déduplication des clears ;
- calibration automatique ;
- analyse du **flux adverse uniquement**.

Le modèle ONNX et `detection-worker.js` sont strictement inchangés par rapport à
Candidate 1. `vision-core.js` ne reçoit qu'un budget de cadence piloté par
l'intégration WebRTC en cas de pression CPU ; aucun seuil de détection ou de
tracking n'est modifié.

## Correctifs Candidate 2

### Qualité vidéo sous charge CPU
Le sender WebRTC demande `maintain-resolution` lorsque le navigateur le permet.
Si WebRTC signale `qualityLimitationReason = cpu`, TCGate réduit progressivement
la cadence d'inférence Vision afin de rendre du temps CPU à l'encodeur vidéo.
Après récupération durable, Vision revient automatiquement à sa cadence normale.

### Caméra et microphone
Après un échec d'ouverture caméra+micro, la vidéo et l'audio sont récupérés
indépendamment. Une caméra temporairement indisponible ne doit plus entraîner la
perte du microphone si celui-ci fonctionne.

### Atomic Handoff
Les demandes de clear répétées lorsque l'UI est déjà vide sont comptées mais ne
réémettent plus `tcg-identification-visible-cleared`. Le rapport permet de
comparer demandes, commits et déduplications.

## Outils alpha visibles

- indicateurs discrets Vision / calibration / mémoire ;
- bouton `Générer un rapport complet` dans le lobby et la partie ;
- boutons testeur `Carte non détectée` et `Mauvaise carte affichée` ;
- rapport réseau WebRTC + périphériques + calibration + Vision + Vision State ;
- diagnostic des épisodes de limitation CPU et de l'Atomic Handoff.

Le rapport n'enregistre automatiquement ni vidéo, ni audio, ni capture d'écran,
ni adresse IP.

## Lancer sous Windows

Double-cliquer sur `START_WINDOWS.bat`, puis ouvrir l'adresse indiquée.
Pour un test entre deux ordinateurs distants, déployer cette branche comme les
versions réseau précédentes (Railway ou hébergement Node équivalent).

## Test Candidate 2

Suivre `PLAN_TEST_ALPHA_0.1_CANDIDATE_2.md`.
Le test prioritaire est une session réelle de 20 à 30 minutes sur les mêmes PC
que Candidate 1 si possible, afin de pouvoir comparer directement la résolution
WebRTC et la pression CPU.

## Limites connues

- seul Cyberpunk TCG dispose actuellement de sa bibliothèque Vision ;
- pas de TURN configuré dans cette candidate ;
- le mode téléphone comme webcam n'est pas encore inclus ;
- les reflets sévères peuvent volontairement provoquer une hésitation plutôt
  qu'une identification risquée.
