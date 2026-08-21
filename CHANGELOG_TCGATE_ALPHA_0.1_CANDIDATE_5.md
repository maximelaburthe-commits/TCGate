# TCGate Alpha 0.1 — Candidate 5

## Point de départ

Candidate 5 repart de Candidate 4. Le coeur TCG Vision Engine reste gelé.

## Diagnostic isolé le 21/08/2026

Les tests croisés ont écarté le rôle host/guest et le réseau :

- PC A : Chrome + webcam EMEET en 1920×1080 ;
- PC B : Firefox + webcam intégrée ;
- inversion host/guest : la forte latence du flux provenant du PC A reste présente ;
- remplacement de l'EMEET par la webcam intégrée 1280×720 sur le même PC A : le flux redevient fluide immédiatement.

Les rapports Candidate 4 montraient déjà que le flux 1080p du PC A saturait l'encodeur WebRTC. Candidate 4 réduisait la sortie du sender à 720p, mais la webcam continuait à être capturée en 1080p : le coût amont restait donc présent.

## Correctifs Candidate 5

1. **Adaptation de la capture réelle**
   - départ en 1080p lorsque la webcam et la machine le permettent ;
   - après 6 s de `qualityLimitationReason: cpu` persistante sur une source >1280 px, TCGate demande directement au track caméra `1280×720 @ 30 fps` via `MediaStreamTrack.applyConstraints()` ;
   - le sender WebRTC revient à un facteur d'échelle 1:1 : il encode le vrai flux 720p au lieu de redimensionner une capture 1080p ;
   - aucune adaptation automatique sous 720p.

2. **Fallback robuste pour les pilotes UVC/Windows**
   - si le changement de format en direct échoue, TCGate tente d'ouvrir la même caméra directement en 1280×720 ;
   - seul le track vidéo est remplacé ; le track audio existant n'est pas réouvert ;
   - l'ancien track vidéo n'est arrêté qu'après succès du remplacement.

3. **Pas d'oscillation 1080p / 720p**
   - après une adaptation CPU réussie, la capture reste en 720p jusqu'à une action manuelle de changement/redémarrage caméra ;
   - une action manuelle réinitialise le profil adaptatif et autorise une nouvelle tentative native lors de la session suivante.

4. **Protection contre les boucles d'échec**
   - en cas d'échec d'adaptation, TCGate attend au moins 15 s avant une nouvelle tentative ;
   - les tentatives et erreurs sont consignées dans le rapport.

5. **Télémétrie Candidate 5**
   - `captureAdaptiveMode` ;
   - `captureAdaptationAttempts` ;
   - `captureAdaptationError` ;
   - `captureAdaptations` avec réglages avant/après et méthode utilisée (`applyConstraints` ou `replaceTrack`) ;
   - événements `rtc-local-capture-adaptation`, `rtc-local-capture-constraints-error`, `rtc-local-capture-adaptation-error` et `rtc-cpu-protect-video`.

## Invariants

- modèle ONNX inchangé ;
- `detection-worker.js` inchangé ;
- Table State 0.1.6 inchangé ;
- identification inchangée ;
- seuils de détection, matching et anti-reflet inchangés.
