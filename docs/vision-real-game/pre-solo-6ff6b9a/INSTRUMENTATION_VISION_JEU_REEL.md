# Vision 1.0 — instrumentation de campagne en jeu réel

Base : `6d08ad3fde309a6c38990ba82ef4e56aa2e21597`. Branche isolée : `feature/vision-real-game-instrumentation`. Aucun déploiement, push ou fusion demandé dans cette livraison. Aucune nouvelle qualification physique réalisée.

## Références et protection des preuves

Les quatre références obligatoires ont été lues : audit, critères, préparation et guide PDF. Le PDF de préparation comporte huit pages. Les documents de préparation originaux sont conservés dans `docs/vision-real-game/preparation/`, sans remplacement. Le guide racine et sa version servie par la nouvelle page décrivent désormais l'instrumentation.

Le reçu nominal historique reste 43/45, 95,5556 %, zéro mauvaise identification ; les deux NOT_IDENTIFIED Alt Cunningham sont conservés. Les 16 fichiers de preuves physiques déjà inventoriés restent inchangés. Les 469 fichiers précédemment suivis restent identiques dans Git, notamment le détecteur, les moteurs, matcher, seuils, mémoire, stratégie de cache, SAMPLE, harness et reçus. Le checkout du worktree peut utiliser des fins de lignes CRLF différentes de la working copy initiale ; la vérification distingue les octets du checkout, les sources normalisées et les blobs Git.

## Architecture et mesures

L'entrée `/vision-real-game.html` reprend exactement la page produit existante et ajoute uniquement la feuille de style et les scripts de campagne. Un test retire les six balises ajoutées et exige l'égalité avec `public/index.html`. App, Room, WebRTC et Vision restent chargés comme dans le produit. Aucun iframe, assouplissement CSP, point d'entrée serveur ou copie du moteur. L'accueil ordinaire reste inchangé ; le panneau apparaît uniquement une fois en partie.

| Lacune de l'audit | Instrument ajouté |
| --- | --- |
| Matrice nominale incompatible avec les volumes en partie | Profil `VISION_REAL_GAME_1_0` distinct : 98 fenêtres pour 20 présentations, huit stabilités, huit transitions A/B, douze robustesses, cinq scènes, 36 consultations de délai et une partie libre. |
| Demande réelle non liée au résultat | Événement de pointeur fiable capturé avant les handlers natifs ; une entrée sémantique dans un track devient une consultation. Les mouvements internes au même track ne fabriquent pas des demandes. |
| Événement matcher assimilé à l'affichage | Résultat natif puis image du vrai panneau joueur chargée, visible et présente sur deux opportunités de rendu. L'image technique cachée ne constitue jamais une preuve d'affichage. |
| Cache et mémoire confondus avec première reconnaissance | Sources nouvelle analyse, cache de survol, mémoire table, identité préexistante et inconnue. Les horodatages « première observation » ne prétendent pas dater une décision antérieure inconnue. |
| Aperçu HD retenu assimilé à continuité | Suivi natif, identité courante, suspension/perte, aperçu retenu et présence humaine déclarée sont séparés. Aucune règle de fraîcheur nominale imposée au mode NORMAL. |
| Pertes et A/B peu exploitables | Chronologie, durées de présence/suivi/perte/inconnue, identité changée, retrait déclaré et séquences liées. Les demandes A gardent leur attendu quand B commence ; un résultat tardif ne devient pas un succès de B. |
| Consultations abandonnées ou sans réponse manquantes | Succès, mauvaise identité/impression définitive, refus, annulation, absence de réponse, affichage sans attendu et réponse tardive conservés. Une absence de réponse à dix secondes est une fenêtre d'observation, pas une preuve de refus définitif du moteur. |
| Rapport produit par e-mail | Téléchargement JSON local propre au nouveau profil, aucun envoi ou média. |
| Installation et incidents non structurés | Préparation des cartes avant essais, indisponibilité explicite, cadrage libre puis fixe, présence/retrait manuels, incidents contrôlés et ressenti de gêne. |

Le flux est celui de l'adversaire. Le mode de qualification nominale automatique n'est jamais appelé. L'observateur lit événements, DOM et snapshots ; il n'appelle ni identification, ni initialisation du moteur, ni reset de cache, ni capture média. Il n'ajoute aucune reconnaissance en arrière-plan. Le travail normal de Table State déjà présent est observé tel quel.

Les temps sont monotones et liés à une horloge de page. Les demandes issues d'un changement sous pointeur immobile restent distinctes des demandes humaines. Les résultats préexistants n'inventent pas de zéro ni de latence négative. Les arts partagés gardent une impression non résolue ; un identifiant d'impression utilisé pour présenter une image n'est pas une preuve d'impression reconnue.

## Export et évaluation

Le module comptable n'a aucune dépendance caméra, DOM, réseau, cache ou minuterie. Il applique une liste blanche de scalaires et de codes contrôlés. Aucun snapshot brut, nom de joueur, code de partie, URL d'image, base64, image, vidéo, audio ou crop n'est exporté.

Les journaux sont bornés : 30 000 événements, 300 observations, 3 000 consultations et 300 incidents au maximum. Tout dépassement est annoncé comme troncature avec compteurs ; il ne constitue pas une preuve exhaustive. Les changements de contexte, trous d'observation et horloges incompatibles restent signalés. Le rechargement de page ne restaure pas la session : exporter régulièrement.

Le reçu historique est chargé depuis son SHA immuable de publication `6d08ad3...`, son intégrité est vérifiée, puis il est confronté aux empreintes du build actif, au corpus EN 229 effectivement chargé et aux sémantiques inchangées. Le SHA des essais physiques `ce5be2a...`, celui du recalcul `f6225e1...` et le build courant restent distincts. Aucun fallback vers une branche mouvante. Un reçu absent, un contexte différent ou un build modifié interrompt la préparation.

La fiabilité, la stabilité, les transitions et les scènes négatives gardent leurs dénominateurs. Les délais sont descriptifs, groupés par provenance, premier/deuxième survol et attente prévue ; p95 seulement avec au moins vingt valeurs dans un groupe. Les résultats automatisés portent leur origine ; ils ne deviennent jamais des preuves physiques. Le verdict reste `NOT_EVALUATED`, avec revue physique requise.

## Validation reproductible

Le lanceur dédié se nomme `validate-vision-real-game.js`. Il exige un commit propre sur la branche feature isolée et des ajouts seulement depuis la base. Il exécute les 63 suites du registre historique inchangé, puis quatre suites nouvelles, la vérification syntaxique et `git diff --check`. Il conserve commandes, vrais codes de sortie, temps, assertions et journaux dans un nouveau dossier hors worktree ; il n'écrase pas un ancien reçu. Les clés d'envoi e-mail et fournisseurs TURN sont neutralisées pour les tests.

Les tests couvrent le plan distinct, les dénominateurs, horloges, erreurs, annulations, réponses tardives, attente A/B, source cache/mémoire, aperçu retenu, rendu réel du panneau, indisponibilité de contexte, export sans média et preuves historiques. Les tests navigateur utilisent de vrais mouvements `page.mouse.move` avec handlers du produit, ainsi qu'une partie locale Room/WebRTC et le vrai corpus EN à 229 références. Les vidéos et entrées de reconnaissance contrôlées y restent synthétiques. Les résultats effectivement exécutés sont consignés dans le reçu de validation et le bilan de livraison ; le simple fait de définir un test ne vaut pas exécution.

## Limites et lancement physique

La page instrumentée est disponible dans la branche locale, sans déploiement. Après accord explicite pour sa mise à disposition sur Test, ouvrir `/vision-real-game.html`, créer/rejoindre la vraie partie, activer appareils et Ready, puis préparer la campagne dans le panneau. Suivre le guide utilisateur actualisé : présence → survol normal → retrait → fin, export après chaque phase. Jouer ensuite vingt à trente minutes sans quota, clôturer et télécharger le JSON.

L'instrumentation n'est pas une preuve de justesse sur cartes physiques, de comportement TURN distant ou de performances sur toutes les machines. Le temps d'affichage est un repère navigateur borné par l'observation, pas une mesure au photon près. Les pertes natives sont échantillonnées et les périodes inconnues sont explicites. Le choix facultatif d'attendu en partie libre doit précéder le survol ; les demandes sans attendu restent non évaluables en justesse.

Aucun défaut de reconnaissance n'a été corrigé pour améliorer artificiellement un taux. Aucune nouvelle campagne physique n'est lancée. Aucun PASS physique, global Vision 1.0, ni équivalence de performances physiques n'est déduit des tests automatisés.

## Coût du journal et réserves de mesure

Le journal scalaire n'enregistre pas les champs nuls à chaque événement ; `eventEncoding` précise qu'un champ absent signifie inconnu. Les consultations et métriques conservent leurs valeurs nulles explicites. Un probe comptable synthétique de trente minutes à quinze tracks par seconde plus un échantillon de performance par seconde produit 28 801 événements, environ 8,94 Mio de JSON compact, sans troncature. L'ingestion et la sérialisation ont été mesurées séparément dans Node ; cela ne constitue ni un benchmark de FPS navigateur, ni une preuve de performances physiques. Exporter aux pauses naturelles. Une table plus chargée ou une session plus longue peut atteindre les bornes : l'interface demande alors export, clôture et nouveau segment, sans prétendre conserver une chronologie complète.

Une limite de corrélation reste explicite : le produit ne crée une demande native que si un track est effectivement survolé. Un mouvement au-dessus d'une carte non détectée ne permet pas d'attester automatiquement quelle carte le joueur voulait consulter. Le rapport compte séparément présence déclarée sans demande corrélée, absence de détection observée et motifs d'exclusion. Les tentatives humaines non corrélables restent non mesurées (`null`). Le taux sur les présentations valides ne certifie jamais les présentations exclues ; toutes les exclusions doivent être relues avant une conclusion de fiabilité.
