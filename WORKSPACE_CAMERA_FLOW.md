# Correctif Workspace : caméra indépendante de la BDD

Départ : 6ba0b2d7258331e17c82aadd28e7a7d4a592fada, branche update/next uniquement.

## Cause

labControls hidden englobait toute la caméra. Seul labStart rendait le bloc visible, après une inspection BDD réussie. Le même chemin chargeait les scripts du détecteur et de l’identification. Le test précédent initialisait le manifest test avant la caméra et ne détectait donc pas ce défaut de parcours.

## Séparation

- Caméra & détection : visibles dès l’ouverture de Vision Lab. Chargement unique de vision-frame-gate, vision-analysis-frame, vision-appearance-sampler et vision-core à l’ouverture de l’onglet. Aucun manifest, référence ou matcher nécessaire ; aucune permission webcam demandée automatiquement.
- Identification : interface distincte avec source, inspection et activation explicite. vision-library-integrity et identification.js ne chargent qu’à cette activation. Le provider test reste Lab-only, capturé avant le chargement du moteur. Un manifest invalide ne modifie ni le flux ni le détecteur.
- Les moteurs, workers, modèle, game-databases et SHA DB actif ne sont pas modifiés par ce correctif. Vision Core reste responsable de getUserMedia({video, audio:false}), enumerateDevices après autorisation, changement réel de deviceId/résolution, arrêt des tracks, boxes et tracking.

workspace-camera-status.js fournit les messages explicites : contexte non sécurisé, API absente, permission refusée, aucune caméra, caméra utilisée/inaccessible, contraintes de résolution et erreur navigateur. Les erreurs remontées par le Core sont traduites dans un état caméra indépendant du diagnostic BDD. Caméra, détection et identification ont chacune leur état visible.

Les captures sont possibles sans identification : images webcam/overlay et diagnostic détection. La source BDD et la dernière observation sont figées à la capture ; une BDD chargée après ne modifie pas la provenance des captures précédentes. L’export et les feedbacks restent locaux.

## Validation

- node workspace-camera-test.js : régression explicite contre labControls hidden, dépendances séparées, initialisation optionnelle, messages d’erreur, contrat audio:false et géométrie/arrêt du Core.
- node workspace-camera-browser-test.js : smoke Chrome réel depuis /workspace.html, sans préinspection BDD. Webcam simulée et vrai modèle ONNX/WebGPU ; identité inactive et aucun script matcher chargé pendant cette première phase. Capture/export sans BDD, erreur de manifest pendant la détection sans arrêt, puis vrais manifest/assets Cyberpunk production et matcher réel prêt sur 229 références. Deux devices simulés réellement sélectionnés via deviceId, flux précédent terminé, résolution 640×480, overlay contrôlé à 1440 et 560 px. Arrêt vérifié sur readyState des MediaStreamTracks. Les refus/absence/occupation caméra sont injectés comme DOMException à l’entrée du vrai handler Core ; tous les appels webcam sont vérifiés audio:false. Aucune room/WebRTC ni écriture réseau.
- Le test Workspace historique conserve le parcours provider test, crop/Top 5, feedback et export. Les suites Vision/BDD/Alpha pertinentes sont réexécutées ; voir le journal distinct WORKSPACE_CAMERA_FLOW_VALIDATION.txt. Le journal précédent est conservé.

Les deux caméras sont simulées ; aucune validation d’une webcam physique ou qualification Vision physique revendiquée. Aucun déploiement ni réglage Railway n’est effectué. Le push update/next permet la validation sur Railway Test à /workspace.html → Vision Lab.
