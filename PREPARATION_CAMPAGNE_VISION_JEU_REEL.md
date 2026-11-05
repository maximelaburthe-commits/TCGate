> Document historique de préparation, conservé avec sa date et ses constats. L'implémentation ultérieure est décrite dans [INSTRUMENTATION_VISION_JEU_REEL.md](INSTRUMENTATION_VISION_JEU_REEL.md) ; le [guide utilisateur actualisé](GUIDE_CAMPAGNE_VISION_JEU_REEL.md) décrit la nouvelle page. L'original sans cette notice est archivé dans `docs/vision-real-game/preparation/`. Aucun déploiement ni essai physique n'est réalisé par l'instrumentation.

# Préparation — campagne Vision 1.0 adaptée au jeu réel

**Audit et préparation terminés ; aucune campagne physique lancée.**
5 novembre 2026 (Europe/Paris). Baseline locale et Railway Test vérifiée : `6d08ad3fde309a6c38990ba82ef4e56aa2e21597`.

## Quatre livrables

1. [Audit des capacités et lacunes](AUDIT_VISION_JEU_REEL.md).
2. [Guide utilisateur complet](GUIDE_CAMPAGNE_VISION_JEU_REEL.md), aussi en [version navigateur imprimable](GUIDE_CAMPAGNE_VISION_JEU_REEL.html).
3. [Critères d’évaluation](CRITERES_CAMPAGNE_VISION_JEU_REEL.md).
4. Ce rapport de préparation et de lancement.

## Prêt

Le plan conserve la priorité fiabilité → stabilité → rapidité et une installation choisie/validée par le testeur, puis fixe. Dix cartes sont proposées, dont Alt Cunningham, Mantis, Misty et Detonate/Industrial Assembly. Les indisponibilités restent déclarées ; aucune substitution après échec.

| Phase | Volume préparé |
| --- | --- |
| Installation | Validation depuis le flux reçu, sans angle/hauteur/distance idéaux imposés |
| Fiabilité | 10 cartes × 2 présentations = 20 |
| Stabilité | 8 observations continues d’environ 20 s |
| Retrait/remplacement | 8 séquences A → vide observé → B |
| Robustesse ordinaire | 4 cartes × 3 situations = 12 |
| Scènes négatives | 5 × 30 s = 150 s prévues |
| Rapidité | 6 cartes × 3 délais = 18 premières consultations, puis 18 deuxièmes survols |
| Usage spontané | 20–30 min de vraie partie, sans quota |

Volumes de diagnostic initial, pas garantie statistique universelle d’erreur ≤1 %. Ils ne sont pas déjà paramétrables dans le panneau guidé actuel.

Le nominal reste **PASS 43/45 (95,56 %), zéro mauvaise identification**. Les deux échecs Alt et toutes les anciennes campagnes FAIL sont conservés. Aucun essai historique ne sera compté comme nouvelle observation.

## Encore à développer

La campagne instrumentée complète n’est pas prête. Le harness impose 15×3, trois observations de stabilité de 10 s et deux paires ; il déclenche automatiquement le matcher. En partie, le flux adverse, le survol et la mémoire table en arrière-plan suivent un autre chemin.

Développement minimal proposé, non effectué :

- profil et rapport distincts, sans modifier SAMPLE, harness ni reçu historiques ;
- observateur NORMAL reliant détection, demande réelle, décision correcte, suivi et affichage, avec origine cache/mémoire observée ;
- journal d’incidents et export local scalaire, avec indication des données manquantes et troncatures.

Préférer événements/DOM existants en lecture seule. Conserver « non mesuré » si aucune frontière fiable n’existe pour le survol ou l’affichage. Modifier un fichier moteur empreinté demanderait une revue explicite de compatibilité ; ne pas relâcher l’attestation nominale pour la faire passer.

Aucune correction de reconnaissance, seuil, descripteur, cache, temporisation ou stabilité n’est justifiée par cet audit seul. Les adaptations futures seront isolées, testées et validées avant déploiement.

## Procédure exacte de lancement

**Aucune action suivante n’a été exécutée sur des cartes physiques dans cette préparation.**

Pour une première observation manuelle, après votre décision de commencer :

1. Ouvrir [TCGate Test](https://tcgate-ux-lab.up.railway.app/) avec un partenaire. Créer/rejoindre une partie Cyberpunk ; activer caméra et micro dans Mon installation.
2. Chacun clique Je suis prêt ; entrée automatique lorsque les conditions Ready sont réunies. Vérifier Vision active et vidéo adverse. Le consultant reconnaît les cartes présentées chez son partenaire.
3. Valider le cadrage depuis le flux reçu, puis fixer caméra, configuration et éclairage. Consigner l’installation.
4. Suivre les sept phases du guide dans la table Test avec les réserves manuelles. Suspendre l’extension en cas d’incident critique ou de refus reproductible, avant la vitesse.
5. Sauvegarder le carnet après chaque phase et exporter ce document en PDF si souhaité. Cela ne produit pas un JSON canonique instrumenté.

Pour la campagne instrumentée complète : valider le plan, réaliser les adaptations et leurs tests, obtenir votre validation explicite du déploiement Test, puis lancer les essais avec vous. Rapport ouvre actuellement un envoi par e-mail, pas un téléchargement local ; aucun envoi n’est demandé.

Le Lab et le panneau guidé restent distincts. Ne pas utiliser Préparer la qualification pour mesurer le survol : la reconnaissance y devient automatique. L’export Lab peut contenir des médias, même sans capture volontaire.

## Conservation et vérifications

Documentation uniquement. Aucun commit, push, merge ou déploiement. Aucun moteur ni configuration modifiés. main reste `e26b2e09579be53452c1e631b1dc5230191d0250` ; Production sert ce même SHA. BDD et FR inchangées.

Les 63 suites et 68 assertions live de 6C.2 sont des preuves de la livraison précédente, pas des tests relancés ici ni une nouvelle qualification physique. Ce passage vérifie les sources, libellés/liens, rendu du guide et préservation des fichiers/preuves. Les résultats de préparation sont conservés à part.

**État : préparation prête ; diagnostic manuel possible avec réserves ; campagne instrumentée complète à développer et valider.**
