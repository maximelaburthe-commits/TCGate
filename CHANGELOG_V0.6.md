# V0.6 — Vision intégrée

Parents figés :
- V0.5.2 : baseline réseau distante stable (test offerer 4G → answerer box validé)
- alpha15 : baseline Vision gelée

## Intégration
- analyse UNIQUEMENT du flux adverse `remoteVideo`
- aucun traitement Vision sur la caméra locale
- YOLO V5.3 overlap / 512
- filtres Table-Aware
- tracking/visual lock alpha15
- matcher Worker rapide
- mode masked pour chevauchement
- cache hover alpha15
- affichage de la vraie image HD Cyberpunk

## UI
- aucune box YOLO visible par défaut
- panneau HD réel
- image HD également visible en plein écran adverse
- agrandissement de la vraie carte
- dernier résultat conservé lorsqu'on quitte la vidéo pour aller vers le panneau

## Calibration pré-alpha
Calibration automatique ~3,2 s du flux adverse :
- résolution
- luminosité
- variation
- détail/netteté approximative
- statut OK / partielle / échec
- recalibration automatique en cas de changement lumineux majeur

## Rapport complet
Ajoute calibration + détection + tracking + matcher + cache +
événements d'identification + échantillons Vision toutes les 5 s.
