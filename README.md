# TCGate — Alpha fermée 0.1 · Candidate 3

Candidate 3 est la version active de test après analyse comparative des rapports Candidate 1 et Candidate 2 du 20/08/2026.

## Base préservée

- Vision FaceWebcam 0.3.1
- Table State 0.1.6 `facewebcam-memory-hover`
- modèle Vision V5.3 / 512
- identification anti-reflet et mémoire de survol de la Candidate 2

## Changements C3

- signal d'état caméra/micro entre les pairs ;
- pause automatique des inférences Vision quand la caméra adverse est coupée ;
- reprise automatique sans effacer la mémoire Table State ;
- throttle CPU étendu jusqu'à 1000 ms ;
- résolution WebRTC toujours prioritaire via `maintain-resolution` ;
- déduplication des handoffs HD vers une image déjà visible.

Voir `CHANGELOG_TCGATE_ALPHA_0.1_CANDIDATE_3.md` et `PLAN_TEST_ALPHA_0.1_CANDIDATE_3.md`.

## Lancement local

Sous Windows : `START_WINDOWS_LOCAL.bat` ou `START_WINDOWS.bat`.

Avec Node.js :

```bash
npm start
```

Smoke test :

```bash
npm run smoke
```
