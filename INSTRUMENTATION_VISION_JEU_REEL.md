# Vision 1.0 — rectification de l'instrumentation vers le Lab solo

Base auditée : `6ff6b9a31e8cfc2ddb219ce72142c8a645dcfd99`. Branche : `feature/vision-real-game-instrumentation`. La qualification initiale du moteur se fait désormais dans le Vision Lab autonome, par une seule personne. Les essais avec joueurs sont reportés à une campagne produit distincte. Aucun push, fusion ou déploiement n'est réalisé.

## Audit du montage précédent

L'observateur et le modèle comptable du commit initial étaient réutilisables. Leur entrée reproduisait cependant la page de partie : le démarrage dépendait d'une vidéo adverse, de Room/Ready et du contexte de table. Cette dépendance contredisait la qualification initiale solo. Le guide décrivait aussi deux joueurs.

Le Lab existant possède déjà une webcam locale, le détecteur normal, l'identification native par survol et un vrai aperçu HD. Il charge le bridge des références mais pas le moteur Table State des parties. Son snapshot `active` reste faux sans source externe, même lorsque la caméra locale détecte correctement. Ajouter le moteur de table ou réutiliser le harness nominal aurait changé le comportement mesuré.

| Point audité | Adaptation minimale |
| --- | --- |
| Entrée et prérequis de partie | Panneau dans le poste natif du Lab ; ancienne URL redirigée vers `/workspace.html#vision-real-game`. |
| Contrôle d'activité lié au flux adverse | Vérification de la détection locale, de la piste caméra vivante, de la source production et du corpus EN réellement chargé. |
| Affichage réservé au joueur en partie | Mesure sur la véritable image HD native du Lab : chargée, visible, non masquée, avec opportunités de rendu. |
| Provenance mémoire | `IDENTITY_MEMORY` pour les maintiens temporels natifs ; cache de survol, analyse, préexistant et inconnu séparés. Aucune mémoire de table ajoutée. |
| Aperçu conservé et état courant | Expiration native sous survol distincte d'un aperçu HD retenu ; hors pointeur, disponibilité d'identité inconnue plutôt qu'une perte inventée. |
| Première acquisition et perte ultérieure | Durées indisponibles ventilées avant/après acquisition ; perte maximale après acquisition et taux de maintien correspondant explicités. |
| Campagnes simultanées | Nominal et complémentaire exclusifs. Export puis nouvelle page pour changer de protocole, sans effacer une session historique. |
| Guide et dernière phase | Manipulation libre solo de vingt à trente minutes ; aucune étape Room, Ready ou WebRTC. |

Les documents de préparation restent intacts dans `docs/vision-real-game/preparation/`. Le guide, le descriptif et le profil du montage initial sont archivés dans `docs/vision-real-game/pre-solo-6ff6b9a/`. Les anciens exports, reçus, SAMPLE, harness et sémantiques nominales sont conservés. Le PASS 43/45 reste une preuve historique séparée, jamais un résultat de la nouvelle campagne.

## Mesures conservées

Le profil `VISION_SOLO_LAB_1_0`, périmètre `SOLO_LAB_NORMAL_HOVER`, conserve les 98 fenêtres : vingt présentations de fiabilité, huit stabilités, huit transitions A/B en seize observations, douze robustesses, cinq scènes négatives, trente-six consultations de délai et une manipulation libre solo. Le format historique de profil reste lisible par le modèle ; aucun export ancien n'est réécrit.

Une vraie entrée du pointeur sur un track corrèle demande, résultat et affichage. Les mouvements internes ne fabriquent pas de demandes. Les changements sous un pointeur immobile restent distincts des gestes humains. Les délais commencent au survol effectif et restent descriptifs, sans nouveau seuil de vitesse. Une image déjà visible n'invente pas un délai nul.

La stabilité sépare présence physique déclarée, suivi observé, identité courante, mémoire native, expiration et aperçu retenu. Hors survol, le Lab ne publie pas toute sa mémoire interne : les durées sans observation d'identité sont inconnues et exclues du dénominateur admissible. L'attente initiale est comptée dans `acquisitionIdentityUnavailableMs`, les pertes ultérieures dans `postAcquisitionIdentityLossMs`. Le taux historique `nativeIdentityRetentionRate` inclut l'acquisition ; `postAcquisitionNativeIdentityRetentionRate` mesure le maintien après une première identité correcte observée. Les pertes de track, suspensions et trous d'observation restent séparés.

Les consultations correctes, erronées, refusées, annulées, sans réponse ou tardives sont conservées. Les erreurs ne sont jamais effacées par une bonne réponse ultérieure. Les compteurs `wrongAccepted` sont des événements de preuve et peuvent compter résultat puis affichage ; les taux d'erreur comptent les consultations/observations distinctes, pas ces événements. Les motifs natifs connus sont normalisés en codes contrôlés ; aucune erreur libre potentiellement sensible n'est exportée.

Le JSON local applique une liste blanche de scalaires : aucun média, crop, base64, URL d'image, nom de joueur, code de partie ou secret. Le journal reste borné et les troncatures explicites. Le verdict reste `NOT_EVALUATED` avec revue physique requise. Les tests synthétiques ne deviennent pas une qualification physique.

## Isolation technique et validation

L'intégration ajoute les scripts et styles d'instrumentation à `workspace.html`. Les moteurs, `workspace.js`, le provider Lab, les seuils, descripteurs, mémoire, cache, matcher et détecteur restent inchangés. L'observateur n'appelle pas d'identification, ne lance pas le moteur Table State et ne prépare pas le harness nominal. Aucune reconnaissance permanente n'est ajoutée. Seuls les états, événements et affichages normaux sont observés. La mémoire de l'observateur est réinitialisée après pause ou trou d'observation sans toucher au moteur.

`validate-vision-real-game.js` exige un commit propre sur la branche isolée. Il autorise seulement l'entrée HTML du Lab parmi les fichiers antérieurs à l'instrumentation ; les autres modifications concernent les instruments et leur documentation. Il sélectionne explicitement dix-sept suites historiques pertinentes dans le registre intact des 63 suites et les quatre suites d'instrumentation, puis syntaxe et `git diff --check`. Les sources et leurs octets sont figés pendant le passage. Les preuves vont dans un nouveau dossier externe ; un échec reste enregistré, sans remplacement par un succès supposé. Les identifiants de fournisseurs d'envoi sont neutralisés.

Les tests navigateur utilisent une seule page, une caméra vidéo synthétique, le vrai matcher et le corpus EN 229 pour les survols intégrés. Ils interdisent `RTCPeerConnection` et vérifient l'absence de Room/Ready/signaling, l'absence de moteur de table et de harness automatique. D'autres vecteurs scalaires contrôlent les états de mémoire, l'expiration, A → vide → B, les événements tardifs et les cas impossibles à provoquer fiablement par une image synthétique. Ces niveaux de preuve restent distincts. Les résultats réellement exécutés figurent dans le reçu externe et le bilan de rectification.

## Limites et lancement sur Test

La page corrigée est locale à la branche tant qu'aucun déploiement n'a été autorisé. Après accord explicite et mise à disposition du build sur Test, ouvrir `https://tcgate-ux-lab.up.railway.app/workspace.html#vision-real-game`, activer caméra puis détection, sélectionner Cyberpunk production, inspecter la BDD et activer l'identification. Préparer uniquement le panneau complémentaire après vérification du cadrage et des cartes, puis suivre le guide PDF phase par phase. Exporter son JSON local après chaque phase, clôturer et exporter à la fin.

Aucune mesure ne certifie WebRTC, les échanges entre deux joueurs ou les FPS d'une partie distante. Le temps d'affichage est un repère navigateur, pas une mesure au photon près. Une carte non détectée ne produit pas de demande native corrélable ; l'exclusion est conservée et doit être relue. Un track non survolé ne déclenche aucune nouvelle analyse par la campagne. Les tests de performance physique et le ressenti du testeur restent à recueillir. Aucun problème moteur n'est corrigé artificiellement pour augmenter un taux.
