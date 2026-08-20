# TCGate — Alpha fermée 0.1 · Candidate 1

Première branche intégrée destinée à devenir le prototype de l’alpha fermée.
Elle assemble la plateforme réseau réelle, l’identité TCGate et la branche Vision
validée en FaceWebcam.

## Parcours alpha

`Créer/Rejoindre -> caméra + micro -> WebRTC -> Vision sur flux adverse -> lecture HD au survol`

Aucun compte n’est requis dans cette candidate.

## Vision intégré

- détecteur stable issu de la référence V0.6.2 / V5.3 512 ;
- identification avec Cache Freshness Guard ;
- Strict High-Glare Rescue ;
- Vision State `0.1.6-facewebcam-memory-hover` ;
- Memory Hover ;
- Atomic HD Image Handoff ;
- calibration automatique ;
- analyse du **flux adverse uniquement**.

Le modèle ONNX, `vision-core.js` et `detection-worker.js` restent issus de la
référence stable V0.6.2.

## Outils alpha visibles

- indicateurs discrets Vision / calibration / mémoire ;
- bouton `Générer un rapport complet` dans le lobby et la partie ;
- boutons testeur `Carte non détectée` et `Mauvaise carte affichée` ;
- rapport réseau WebRTC + périphériques + calibration + Vision + Vision State.

Le rapport n’enregistre automatiquement ni vidéo, ni audio, ni capture d’écran,
ni adresse IP.

## Lancer sous Windows

Double-cliquer sur `START_WINDOWS.bat`, puis ouvrir l’adresse indiquée.
Pour un test entre deux ordinateurs distants, déployer cette branche comme les
versions réseau précédentes (Railway ou hébergement Node équivalent).

## Test Candidate 1

Le test prioritaire est maintenant une **vraie partie de 30 à 60 minutes**.
Survoler uniquement les cartes réellement consultées pendant la partie.
À la fin, générer un rapport complet sur les deux PC.

À surveiller :
- aucune mauvaise carte HD affichée ;
- pas de flash d’une ancienne carte lors du changement de cible ;
- stabilité des pertes/réacquisitions ;
- comportement sous reflets naturels ;
- stabilité WebRTC et périphériques sur la durée.

## Limites connues

- seul Cyberpunk TCG dispose actuellement de sa bibliothèque Vision ;
- pas de TURN configuré dans cette candidate : les connexions P2P difficiles
  restent un chantier alpha ;
- le mode téléphone comme webcam n’est pas encore inclus ;
- les reflets sévères peuvent volontairement provoquer une hésitation plutôt
  qu’une identification risquée.
