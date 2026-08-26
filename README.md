# TCGate — Alpha 0.1 · Candidate 11 · UI 1.0.4 corrective

Cette archive repart de la **Candidate 11 testée** et conserve intégralement ses correctifs réseau/WebRTC/Vision.
La révision UI 1.0.4 ajoute uniquement les correctifs visuels demandés après validation réseau de C11.

## Correctifs UI 1.0.4
- accueil adapté aux faibles hauteurs de viewport, notamment ~695 CSS px ;
- placement initial Gig Dice calculé après rendu réel et hors du PiP local ;
- anciennes positions Gig invalidées via une nouvelle clé de session ;
- poignée de déplacement rendue statique au survol ;
- suppression du contour/ombre noire autour de la carte agrandie en plein écran.

## Base technique conservée
- reprise F5 / WebRTC atomique de Candidate 11 ;
- reconnexion réseau Candidate 11 ;
- reprise média / hot-plug Candidate 11 ;
- orchestration Vision Candidate 11 ;
- baseline Vision gelée inchangée.

## Identification
- frontend : `TCGate Alpha 0.1 Candidate 11 · UI 1.0.4`
- health : `tcgate-alpha-0.1-candidate-11` (base technique C11)

Voir `PLAN_TEST_ALPHA_0.1_CANDIDATE_11_UI_1.0.4.md` et `CHANGELOG_TCGATE_ALPHA_0.1_CANDIDATE_11_UI_1.0.4.md`.
