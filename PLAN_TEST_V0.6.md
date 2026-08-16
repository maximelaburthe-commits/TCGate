# Test V0.6 — Vision intégrée

## Déploiement Railway
Remplacer les fichiers V0.5.2 du dépôt GitHub par le contenu de cette V0.6.
IMPORTANT : pousser aussi :

`models/card_detector_v53_512.onnx`

Après redéploiement, ouvrir :

`https://VOTRE-DOMAINE/api/health`

Attendu :
- `"version": "0.6.0"`
- `"vision": { "integrated": true, "modelPresent": true, ... }`

## Test
1. Deux PC ouvrent le même domaine Railway.
2. Créer/rejoindre.
3. Activer caméra + micro.
4. Attendre `Vision : prête`.
5. Les deux passent prêts.
6. À réception du flux adverse :
   - `Vision : active`
   - `Calibration : analyse…`
   - puis `Calibration : OK` ou `partielle`
7. Le joueur filmé pose des cartes Cyberpunk face visible.
8. Sur l'autre PC, survoler la CARTE DANS LE GRAND FLUX ADVERSE.
9. Vérifier l'image HD réelle dans le panneau droit.
10. Tester :
   - plusieurs cartes
   - rotations
   - carte inclinée
   - chevauchement raisonnable
   - playmat chargé
   - revisit d'une carte (cache)
   - plein écran adverse
   - agrandissement HD
11. Vérifier qu'aucune Vision ne travaille sur le petit flux local.
12. Laisser tourner 5 à 10 minutes.
13. Générer les deux rapports complets et les envoyer.

## À me signaler
- mauvaise carte
- carte non détectée
- ancien résultat qui clignote
- délai trop long
- calibration partielle/échec
- baisse de fluidité du flux vidéo
- comportement anormal en plein écran

Le but de V0.6 n'est pas encore de perfectionner la Vision :
il faut d'abord vérifier que alpha15 garde son niveau de qualité sur un flux WebRTC distant compressé.
