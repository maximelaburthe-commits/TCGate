# V0.6.2 — Stabilité temporelle anti-reflet

Version ciblée issue du bilan V0.6.1.

## 1. Validation temporelle de l’identité
Une carte déjà reconnue devient l’identité stable de sa piste. Une autre identité acceptée par le matcher ne la remplace plus sur une seule observation.

- changement normal : **2 observations consécutives** ;
- changement sous reflet modéré / mode glare-guarded : **3 observations consécutives** ;
- fenêtre entre confirmations : 1250 ms.

## 2. Maintien pendant les frames abîmées
Une frame rejetée par le garde anti-reflet ou rendue incertaine ne vide plus immédiatement la carte HD si une identité stable existe.

L’identité précédente est conservée temporairement (1600 ms maximum), pendant que le système relance des vérifications espacées de 260 ms.

Si aucune identité cohérente ne revient dans cette fenêtre, la carte HD est retirée plutôt que de rester potentiellement fausse.

## 3. Vraies substitutions de cartes
Un changement réel reste possible : dès que la nouvelle identité atteint le nombre de confirmations requis, elle devient la nouvelle identité stable.

## 4. Diagnostic
Le rapport complet expose maintenant :
- changements suspects bloqués ;
- changements confirmés ;
- maintiens transitoires ;
- maintiens expirés ;
- nombre de revérifications ;
- dernier événement de stabilité.

Les événements `tcg-identification-stability` sont également ajoutés au journal de session.

## 5. Non-modifications volontaires
V0.6.2 ne modifie pas :
- WebRTC / réseau ;
- seuil YOLO global ;
- modèle de détection ;
- logique de chevauchement ;
- UI.

## Vérification de non-régression structurelle
Contrôle effectué avant packaging :
- `public/vision-core.js` identique bit pour bit à V0.6.1 ;
- `public/detection-worker.js` identique bit pour bit ;
- `models/card_detector_v53_512.onnx` identique bit pour bit ;
- `public/styles.css` identique bit pour bit.

Le serveur réseau n'a reçu que le changement de numéro de version. `public/app.js` n'a reçu que la télémétrie du nouveau garde temporel et le numéro du rapport.
