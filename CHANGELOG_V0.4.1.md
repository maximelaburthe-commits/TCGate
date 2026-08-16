# V0.4.1 — Vidéo WebRTC + UI Chrome

Correctifs issus du premier rapport réseau réel :

## WebRTC vidéo
- création systématique d'un transceiver vidéo `sendrecv`;
- création systématique d'un transceiver audio `sendrecv`;
- la présence temporaire d'un flux audio-only chez l'hôte ne peut plus supprimer
  la possibilité pour l'adversaire d'envoyer sa vidéo;
- remplacement des tracks via les senders négociés.

## Diagnostic caméra
- journalisation du nom/message/constraint exacts des erreurs getUserMedia;
- tentative vidéo 1080p puis tentative plus souple 720p avant de basculer audio-only;
- le statut du lobby indique le type d'erreur caméra si seul le micro fonctionne.

## Prêt
- une caméra active est maintenant obligatoire pour cliquer `Je suis prêt`;
- couper sa caméra dans le lobby annule automatiquement l'état prêt.

## Rapport complet
- snapshot WebRTC périodique;
- conservation des dernières métriques connues après déconnexion/quitter.

## Chrome / dimensions
- écran de jeu desktop limité à `100dvh`;
- plus de min-height fixe 560px sur le flux adverse en desktop;
- flux adverse et colonne HD se redimensionnent selon la hauteur disponible;
- maintien du layout à deux colonnes jusqu'à 760px;
- le scroll reste autorisé sur petit écran/mobile seulement.
