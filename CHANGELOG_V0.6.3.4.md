# V0.6.3.4 — Hover + Chromium GPU Recovery

## Objectifs
- Corriger le maintien erroné de la carte précédente dans une zone de chevauchement.
- Retrouver une sensation de survol plus réactive sans relâcher la stabilité d’identité sur les crops risqués.
- Réduire le risque de clignotements système observés sur le PC Chrome pendant l’inférence WebGPU.

## Changements
- Suppression du sticky ownership V0.6.3.3 : chaque position du pointeur est ré-arbitrée géométriquement.
- Même arbitre utilisé lorsque les tracks bougent sous un pointeur immobile.
- Retour instantané de l’identité stable lorsqu’on revient sur un track déjà confirmé, avec revérification à 320 ms.
- Vérification du cache raccourcie à 900 ms et délai de survol initial à 35 ms.
- Chromium : WebGPU standard/balanced, sans graph capture ni forcing high-performance.
- Diagnostic possible : `visionProvider=wasm` dans l’URL force le backend CPU/WASM.
- Aucune modification du modèle ONNX ni des seuils YOLO / Overlap Probe.
