# TCGate — Alpha fermée 0.1 · Candidate 5

Candidate 5 repart strictement de Candidate 4 après l'isolement de la cause de la latence sur le flux EMEET 1080p.

## Diagnostic

L'inversion host/guest ne changeait pas le problème. En revanche, sur le même PC A et le même navigateur Chrome, remplacer l'EMEET 1080p par la webcam intégrée 720p rendait immédiatement le flux adverse fluide.

Candidate 4 réduisait la **sortie WebRTC** en 720p mais continuait à capturer la webcam en 1080p. Candidate 5 déplace donc l'adaptation au bon niveau : **la capture caméra elle-même**.

## Candidate 5

- démarre en 1080p lorsque possible ;
- en cas de limitation CPU persistante, demande directement 1280×720 @ 30 fps à la caméra ;
- garde le sender WebRTC en 1:1 après la bascule ;
- tente un remplacement atomique du seul track vidéo si le pilote refuse `applyConstraints()` ;
- ne touche pas au micro pendant ce fallback ;
- ne descend jamais automatiquement sous 720p ;
- ne remonte pas automatiquement en 1080p pendant la même session ;
- conserve le throttle Vision comme protection secondaire ;
- ajoute au rapport les réglages de capture avant/après et la méthode d'adaptation utilisée.

Le principe produit est inchangé : **une vidéo 720p fluide et temps réel vaut mieux qu'une vidéo 1080p nette mais retardée**.

Le coeur Vision, ses modèles et ses seuils ne sont pas modifiés.
