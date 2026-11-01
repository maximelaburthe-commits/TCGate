# TCGate Phone Camera Alpha

> **État Candidate 15 : Phone Camera integrated QUALIFIED**, PASS physique déclaré par le propriétaire pour Phone 1.2C. Le standalone est **DECOMMISSIONABLE**. Les baselines et listes de validation ci-dessous conservent l'historique initial ; voir [le reçu](PHONE_PHYSICAL_QUALIFICATION_1_2C.md).

> **Legacy standalone — superseded by integrated Phone Camera 1.2C**. Les mentions du Lab ci-dessous conservent le contexte historique ; le moteur produit courant est intégré au dépôt TCGate. **Decommission condition: physical Chrome Android qualification PASS**. Voir [la consolidation](PHONE_CONSOLIDATION_1_2C.md) et [la qualification physique restante](PHONE_PHYSICAL_QUALIFICATION_1_2C.md).

Baseline TCGate: Candidate 11, commit `dd96acf54a291696439a48416e0e2bcc7b9cba05`.
Référence historique de l’intégration initiale : TCGate Phone Camera Lab V0.6.4.1. Depuis Maintenance 1.2C, le moteur intégré au dépôt TCGate est la source de vérité produit et de développement ; voir PHONE_CONSOLIDATION_1_2C.md.

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
