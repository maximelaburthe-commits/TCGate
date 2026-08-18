# Test V0.6.3.4

1. Reprendre la disposition benchmark V0.6.3.2.
2. Sur Panam : descendre vers la carte du dessous, puis remonter sur Panam en restant dans la zone commune. L’image HD doit changer dès que le pointeur revient réellement vers Panam.
3. Faire le même mouvement 10 fois sur deux paires différentes.
4. Vérifier la sensation de réactivité en passant rapidement entre 4 cartes déjà identifiées.
5. Sur le PC Chrome, laisser la partie ouverte 5 à 10 minutes et surveiller les clignotements Windows/Explorateur.
6. Si les clignotements persistent, refaire uniquement ce test avec `?visionProvider=wasm` (ou `&visionProvider=wasm` si l’URL possède déjà des paramètres) pour isoler WebGPU du problème.
7. Générer les deux rapports.
