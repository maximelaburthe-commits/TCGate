# TCGate Phone Camera Alpha

Baseline TCGate: Candidate 11, commit `dd96acf54a291696439a48416e0e2bcc7b9cba05`.
Référence technique: TCGate Phone Camera Lab V0.6.4.1.

## Architecture

Le téléphone est un périphérique vidéo du client PC, jamais un troisième joueur. Le téléphone envoie une seule piste vidéo WebRTC au navigateur PC. Celui-ci remplace la piste webcam envoyée à l’adversaire avec `RTCRtpSender.replaceTrack()`; le microphone reste celui du PC.

L’appairage crée un secret aléatoire de 256 bits, lié au salon et au peer PC, valable cinq minutes et consommé une seule fois. Après consommation, le serveur remet une session téléphone distincte, limitée aux routes Phone Camera et stockée seulement dans `sessionStorage` mobile. Le bearer et le recovery token PC ne sont jamais inclus dans le QR.

Les tickets SSE sont jetables et valables trente secondes. Une seule association est active par peer. La suppression du peer ou l’expiration invalide la session téléphone.

## Confidentialité

Le flux reste intégralement WebRTC et n’est ni enregistré ni envoyé à une route d’upload. Aucun `MediaRecorder`, snapshot automatique ou stockage de frame n’est utilisé. Les diagnostics excluent SDP, ICE candidates, tokens, images, vidéo, audio et captures.

## Validation manuelle restante

- Chrome Android et Safari iOS sur appareil physique;
- passage Wi-Fi/4G, verrouillage/réveil et reconnexion;
- endurance, chauffe et batterie;
- validation visuelle du flux chez l’adversaire et du parcours Vision.
