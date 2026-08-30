# Security review — Candidate 12 SWU delta

- Vision reste entièrement exécutée dans le navigateur.
- Aucun média n'est envoyé au serveur hors transport WebRTC attendu.
- Aucun crop, frame, screenshot, audio, vidéo ou image base64 n'est ajouté aux rapports.
- Aucune route d'upload ni credential n'est ajoutée.
- Le proxy de lecture d'assets est limité à HTTPS et à `cdn.starwarsunlimited.com`, sans redirection.
- La DB est consommée en lecture seule depuis GitHub sur une ref déclarée dans le Game Registry.
- La seule nouvelle origine CSP est `https://cdn.starwarsunlimited.com`, limitée à `connect-src` et `img-src`.
- Le cache détaillé est séparé par jeu, version DB, profil Vision, version descripteur et version de layout.
- Une DB ou un index coarse incompatible échoue fermé pour Vision sans interrompre WebRTC.
- Sans jeu reste sans DB, sans worker d'identification et sans Gig Dice.
