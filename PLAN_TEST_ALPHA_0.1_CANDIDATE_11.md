# Plan de test ciblé — TCGate Alpha 0.1 Candidate 11 · UI 1.0.3

Durée recommandée : **10 à 15 minutes**. Inutile de refaire toute la campagne Candidate 10.

## 1. Accueil — faible hauteur

Sur le PC HP / configuration qui posait problème :
- ouvrir la page d'accueil ;
- vérifier logo, titre, boutons et étapes ;
- aucun chevauchement ;
- si la hauteur est vraiment insuffisante, le scroll doit rester propre et lisible.

**Attendu :** accueil exploitable immédiatement à 125 % Windows / faible hauteur utile.

## 2. Gig Dice

En partie Cyberpunk :
- afficher le panneau sans le déplacer ;
- vérifier qu'il ne chevauche pas le PiP local ;
- survoler les 6 points de déplacement plusieurs fois ;
- passer en plein écran sans avoir déplacé le panneau.

**Attendu :** aucun chevauchement initial et les points ne bougent pas au survol.

## 3. Plein écran

- entrer en plein écran ;
- vérifier qu'il n'existe plus de bord/arrondi noir autour de la vue ;
- zoomer une carte ;
- fermer le zoom avec × puis refaire avec clic carte/fond.

**Attendu :** plein écran bord-à-bord et le zoom se ferme sans quitter le plein écran.

## 4. 🔴 F5 / reprise WebRTC

Faire le test une fois sur un poste, idéalement le guest :
- partie active avec les deux webcams visibles ;
- F5 ;
- attendre la reprise.

**Attendu :**
- retour dans la même partie ;
- webcam locale récupérée ;
- flux adverse récupéré ;
- WebRTC revient connecté sans intervention ;
- pas de tempête de créations RTC dans le rapport.

Critère diagnostic : après la reprise, le rapport ne doit plus montrer des dizaines de `rtc-created` en rafale pour une seule génération de reprise.

## 5. 🟠 Hot-plug webcam + Vision

Sur le poste dont le flux est analysé par l'adversaire :
- débrancher la webcam ;
- attendre l'état caméra absente ;
- rebrancher la même webcam ;
- présenter une ou deux cartes.

**Attendu :**
- flux revient ;
- Vision passe en pause pendant l'absence ;
- au retour : `Vision : reprise caméra…`, puis `Vision : active` ;
- reconnaissance reprend sans F5 ni recréation de salle.

## 6. Régression courte

- couper le réseau ~10–15 s puis le remettre.

**Attendu :** reprise normale comme Candidate 10.

## Rapports

Si un point 4 ou 5 échoue, générer les deux rapports immédiatement après l'échec. Sinon un seul rapport final par poste suffit.
