# Changelog — TCGate Alpha 0.1 Candidate 11 · UI 1.0.3

Candidate corrective construite **strictement sur Candidate 10 · UI 1.0.2 corrective** après le test réel du 26/08/2026.

## 🔴 Reprise F5 / WebRTC atomique

- sérialise la création de `RTCPeerConnection` : plusieurs signaux simultanés ne peuvent plus créer plusieurs connexions concurrentes ;
- ajoute une génération locale par PeerConnection et ignore les callbacks provenant d'une connexion remplacée ;
- un candidat ICE reçu avant la création de la PeerConnection est mis en attente au lieu de créer lui-même une connexion ;
- les candidats ICE dont l'`usernameFragment` ne correspond pas à la description distante active sont ignorés comme candidats périmés ;
- protège la création en cours contre une fermeture/reconstruction concurrente ;
- évite de réassigner inutilement `remoteVideo.srcObject` sur chaque `ontrack` ;
- ajoute un retry borné de `video.play()` après `AbortError`/`NotAllowedError` pendant une reprise.

Objectif : `1 recoveryEpoch = 1 PeerConnection active`, sans tempête de créations lors d'un F5/recovery.

## 🟠 Vision après hot-plug caméra adverse

Le moteur Vision gelé n'est pas modifié.

L'intégration TCGate orchestre désormais explicitement :
1. caméra adverse absente → pause Vision + arrêt calibration ;
2. caméra annoncée de retour → maintien temporaire de la pause ;
3. attente de **3 nouvelles frames réelles** du flux distant ;
4. reprise Vision ;
5. recalibration `remote-camera-resume` ;
6. journalisation `vision-resume-start/success/timeout/error`.

Cela évite de relancer l'inférence sur la dernière frame figée avant que la nouvelle caméra ne produise réellement des images.

## 🟠/🟢 UI 1.0.3

- page d'accueil compactée automatiquement sur les portables/écrans à faible hauteur utile ;
- nouvelle clé de position Gig Dice pour ne pas restaurer une ancienne position C10 pouvant chevaucher le PiP ;
- une position Gig sauvegardée qui chevaucherait le PiP local est rejetée au chargement ;
- position initiale Gig réservant explicitement la zone du PiP, y compris en plein écran ;
- poignée 6 points stabilisée : le `button:hover` historique ne peut plus déplacer la poignée ;
- plein écran réellement bord-à-bord : suppression du border-radius/border/shadow hérités de la carte normale.

## Non modifié

- modèle ONNX ;
- Detection Worker ;
- Vision Core ;
- Identification ;
- Table State ;
- logique de reconnaissance ;
- pipeline vidéo qualité/adaptation ;
- Phone Camera Lab ;
- système de rapports par mail (réservé à l'Alpha privée après validation de cette Candidate).
