# TCGate Alpha 0.1 — Candidate 3

Candidate 3 repart de Candidate 2 après comparaison des rapports C1/C2 du 20/08/2026.

## Constats Candidate 2

- Succès : le flux 1080p du host reste en 1920×1080 ; aucune baisse 720p/540p/360p.
- Succès : le fallback `NotReadableError` récupère caméra **et** microphone.
- Succès : les clears Atomic Handoff passent de 1331 événements en C1 à 219 commits en C2 ; 1515 clears redondants sont dédupliqués.
- À corriger : le host reste limité CPU pendant ~208 s ; le plafond de throttle Vision à 250 ms ne suffit pas.
- Observation corrélée : sur le guest, la caméra est coupée vers 76 s ; l'épisode CPU du host commence environ 1 s après. Vision continuait alors à inférer sur un flux adverse quasi figé.

## Correctifs Candidate 3

1. **État média distant explicite**
   - nouveau signal `media-state` entre les deux pairs ;
   - la caméra et le micro locaux sont annoncés à la connexion et à chaque changement ;
   - le rapport conserve le dernier état média reçu de l'adversaire.

2. **Pause Vision lorsque la caméra adverse est coupée**
   - aucune nouvelle inférence lourde n'est planifiée pendant la coupure ;
   - la mémoire/table-state n'est pas effacée ;
   - au retour caméra, les tracks géométriques transitoires sont réinitialisés puis Vision reprend.

3. **Throttle CPU renforcé**
   - paliers : 90 / 160 / 250 / 500 / 750 / 1000 ms ;
   - la priorité reste `maintain-resolution` ;
   - retour automatique à 0 après récupération WebRTC.

4. **Déduplication complète du handoff HD**
   - un rendu vers la même image déjà visible devient un no-op ;
   - nouveau compteur `handoffDeduplicated` ;
   - les vrais swaps d'identité gardent le handoff atomique de Candidate 2.

## Éléments Vision gelés

Le modèle ONNX, `detection-worker.js` et Table State 0.1.6 restent inchangés. Aucun seuil de détection, matching ou anti-reflet n'est modifié.
