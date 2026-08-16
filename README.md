# TCG Webcam — V0.5.2 Railway

Première version prévue pour un **vrai test HTTPS distant permanent**.

## Base

La V0.4.2 reste notre baseline réseau locale validée.

V0.5.2 conserve :
- rooms deux joueurs ;
- signaling SSE ;
- WebRTC audio/vidéo ;
- caméra/micro ;
- plein écran adverse ;
- simulation carte HD ;
- rapports complets ;
- diagnostics ICE ;
- mesure viewport/scroll.

V0.5.2 retire complètement :
- Cloudflare Quick Tunnel ;
- `trycloudflare.com` ;
- téléchargement de `cloudflared` ;
- scripts de tunnel temporaire.

## Déploiement

Lire `DEPLOY_RAILWAY.md`.

Le projet est prêt pour GitHub → Railway. `railway.json` configure automatiquement le start, le healthcheck et la politique de redémarrage.

## Test attendu

1. deux PC sur la même box ;
2. puis PC A sur box / PC B sur hotspot 4G-5G ;
3. 5 à 10 minutes par test ;
4. deux rapports complets à envoyer.

## Confidentialité

Les rapports n'enregistrent toujours ni vidéo, ni audio, ni screenshot, ni adresse IP ICE.

## Suite après validation distante

- figer le socle réseau distant ;
- réintégrer Vision alpha15 uniquement sur le flux adverse ;
- calibration automatique invisible ;
- vraie carte HD au survol.


## Correctif V0.5.2
La petite webcam locale en bas à droite conserve maintenant un ratio 16:9 réel,
y compris sur les fenêtres Chrome peu hautes. Le correctif ne touche pas au
réseau/WebRTC validé en V0.5.1.
