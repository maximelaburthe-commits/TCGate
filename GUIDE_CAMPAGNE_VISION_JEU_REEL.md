# Guide utilisateur — Vision 1.0 dans le Lab solo

Version corrigée du 5 novembre 2026. Une seule personne manipule ses cartes physiques devant sa webcam et utilise Vision dans le Lab. Aucune partie à créer, aucun deuxième joueur, aucun Ready, aucune connexion WebRTC. Les tests avec de vrais joueurs viendront plus tard pour améliorer le produit.

Cette livraison prépare les instruments : aucune nouvelle qualification physique n'est déclarée. Le nominal historique reste **43/45 (95,56 %), zéro mauvaise identification** ; ses deux échecs Alt Cunningham et toutes ses preuves sont conservés. La campagne complémentaire a son propre profil et ses propres résultats.

## Préparer le matériel et ouvrir Test

Prévoir un ordinateur, une souris, une webcam, dix cartes physiques Cyberpunk EN et leurs sleeves habituelles. Réserver environ une heure à une heure trente avec pauses, dont vingt à trente minutes de manipulation libre. Le navigateur demande seulement la caméra ; aucun microphone n'est nécessaire.

Choisir librement une installation jugée acceptable pour jouer : hauteur, distance, angle et éclairage ordinaires. Valider le cadrage dans la webcam locale, puis garder l'installation fixe. Ne pas chercher un angle idéal ou déplacer la lampe pour faire réussir une carte. Les angles extrêmes et variations systématiques de distance sont reportés.

Le build corrigé n'est pas déployé par cette livraison. **Après autorisation et mise à disposition sur Test**, ouvrir **https://tcgate-ux-lab.up.railway.app/workspace.html#vision-real-game**. Ce lien ouvre l'onglet Lab et le panneau complémentaire. Si le panneau n'existe pas, le build n'est pas disponible : ne pas substituer une ancienne campagne. La production n'est pas concernée.

Le guide ne demande ni commande, ni script, ni DevTools.

## Phase 1 — Installation et préparation dans le Vision Lab

1. Dans le Lab, cliquer **Activer la caméra**, autoriser la webcam, puis **Activer la détection**. Vérifier que la vidéo locale est vivante. Il n'est pas nécessaire de rejoindre une table.
2. Dans les contrôles de source du Lab, sélectionner la BDD **Cyberpunk production**, cliquer **Inspecter la BDD**, puis **Activer l'identification**. Attendre la fin du chargement. Utiliser le corpus EN de 229 références, sans changer de source pendant les essais.
3. Vérifier qu'une carte présentée dans une zone ordinaire est visible. Le survol de son image dans la vidéo consulte Vision ; l'aperçu haute définition à droite affiche le résultat. Retirer ensuite la carte et sortir le pointeur de la vidéo.
4. Ouvrir **Campagne Vision complémentaire solo** si nécessaire. Ne pas préparer la qualification nominale historique. Les deux protocoles sont exclusifs sur une même page ; si le nominal a déjà été préparé, exporter ses résultats puis recharger le Lab avant de préparer le complémentaire.
5. Cocher le cadrage validé et la vérification des impressions physiques EN. Garder **Origine de cette session : Essais physiques à réaliser par le testeur** pour les vraies cartes. Le choix synthétique est réservé aux contrôles techniques et ne vaut jamais preuve physique. Choisir l'éclairage habituel ou signaler sa variabilité.
6. Cliquer **Vérifier le Lab et préparer la campagne**. Ouvrir **Disponibilité et sélection des dix cartes avant la campagne**. Vérifier les dix cartes et impressions ; décocher toute carte absente. Une substitution se choisit ici, avant les essais, jamais parce qu'une carte vient d'échouer.
7. Cliquer **Préparer la campagne avec cette sélection**. La vérification confronte le build, le corpus effectivement chargé et le reçu nominal historique. Le panneau doit confirmer 43/45. En cas de refus, conserver le message et arrêter la préparation ; ne pas contourner le contrôle.

La préparation ne démarre aucun essai. Seuls les survols habituels demandent une identification ; les boutons de campagne enregistrent des repères humains.

## Les dix cartes proposées

| Repère | Carte | Impression à vérifier |
| --- | --- | --- |
| C1 | Mantis Blades | Bêta β025 |
| C2 | Arasaka Emergency Radioport | Bêta β023 |
| C3 | Jackie Welles: Mama's Favorite | Bêta β073 |
| C4 | Wild in the Streets | Bêta β105 |
| C5 | Adam Smasher: Metal Over Meat | Bêta β041 |
| C6 | Misty Olszewski: Mender of Broken Spirits | Bêta β119 |
| C7 | Safety Override | Bêta β069 |
| C8 | Alt Cunningham: Soulkiller Architect | Pré-sortie bêta 009 |
| C9 | Detonate | Bêta β031 |
| C10 | Industrial Assembly | Bêta β033 |

Vérifier l'édition physique. Une bonne identité canonique ne prouve pas une impression exacte lorsque plusieurs impressions partagent le même art. Garder les impressions non résolues comme réserve.

## Les commandes communes

Dans **Phase**, choisir le volet, puis dans **Observation prévue**, la carte ou la scène. Cliquer **Démarrer l'observation** avant de présenter la carte. Lorsqu'elle est effectivement visible dans la webcam, cliquer **Carte présente dans la webcam**, puis survoler son image avec la souris. Ne pas cliquer sur la vidéo. Le bouton de présence ne correspond ni à une détection interne ni à une demande d'identification.

Au retrait réel, cliquer **Carte retirée / scène vide**. En fin de fenêtre, cliquer **Terminer cette observation**. La ligne suivante est proposée mais ne démarre pas seule. Sortir le pointeur avant une nouvelle présentation. Ne pas répéter jusqu'à réussite pour remplacer un échec : toute reprise reste une observation supplémentaire.

Pour un problème, choisir **Incident / ressenti**, puis **Consigner ce constat**. Signaler vidéo figée, interface bloquée, identité suspectée, perte suspectée, gêne, interruption d'une décision, installation modifiée, situation indisponible ou erreur de manipulation. Un soupçon humain reste distinct d'une erreur moteur confirmée.

Pour une pause, cliquer **Mettre en pause**. Une observation en cours devient interrompue ; cliquer ensuite **Reprendre l'observation** et démarrer une nouvelle fenêtre. Deux fragments de dix secondes ne font pas vingt secondes continues. Un changement d'installation, de source ou un arrêt de caméra interrompt le segment et exige une nouvelle préparation.

Après chaque phase, cliquer **Télécharger le JSON local** dans le panneau complémentaire. Vérifier le fichier `vision-real-game-….json` dans Téléchargements et conserver chaque version dans un nouveau dossier. Ce bouton télécharge uniquement des mesures : ne pas utiliser **Exporter les cas du Lab (images + diagnostic)** à sa place. Aucun e-mail n'est nécessaire.

## Phase 2 — Fiabilité : vingt présentations

Préparer C1 à C10. Choisir **Fiabilité**. Le plan propose C1→C10, puis C6→C10 et C1→C5 : deux présentations par carte.

Pour chaque ligne : retirer l'ancienne carte, constater le vide, sortir le pointeur ; démarrer l'observation ; présenter la carte à une place ordinaire ; confirmer sa présence ; la survoler naturellement. Observer environ dix secondes sans déplacer caméra, lampe ou carte pour forcer un résultat.

Observer bonne carte, refus, absence de réponse, mauvaise identité, impression non résolue et éventuelle perturbation vidéo ou interface. Un ancien aperçu conservé n'est pas une nouvelle réponse. Noter les incidents, marquer le retrait et terminer, même après un refus. Passer à la ligne suivante. Exporter après les vingt présentations ou avant toute interruption.

Une erreur critique ou un refus reproductible en installation ordinaire justifie une pause pour analyse avant la vitesse. Les vingt présentations sont un diagnostic : zéro erreur sur vingt ne prouve pas un risque général inférieur à 1 %.

## Phase 3 — Stabilité : huit cartes, vingt secondes après acquisition

Préparer C1, C3, C5, C6, C7, C8, C9 et C10. Choisir **Stabilité** et la carte indiquée. Démarrer, présenter, confirmer la présence, puis survoler. Après le premier affichage correct, garder la carte visible et immobile et le pointeur sur elle pendant environ vingt secondes continues.

Sans acquisition correcte après environ dix secondes, conserver l'échec d'acquisition ; ne pas annoncer une stabilité réussie. Si l'identité disparaît ou change malgré la présence de la carte, poursuivre la fenêtre, consigner le constat et terminer. Le compteur part du début de l'observation : attendre vingt secondes après l'acquisition, pas simplement vingt secondes au compteur.

Observer séparément présence physique, suivi, identité actuelle et aperçu HD. Une mémoire temporelle native peut maintenir réellement l'identité ; l'image HD seule ne le prouve pas. Hors survol, la disponibilité d'identité peut être inconnue et ne doit pas être comptée comme une perte. En fin de fenêtre, retirer, marquer le retrait et terminer. Exporter après les huit cartes. Toute durée insuffisante ou vidéo figée reste une réserve.

## Phase 4 — Huit transitions A → vide → B

Préparer les paires C1→C6, C6→C1, C9→C10, C10→C9, C8→C10, C10→C8, C5→C7 et C7→C5. Choisir **Retrait et remplacement**. Le plan comporte deux observations liées par séquence : seize fenêtres pour huit transitions.

Démarrer A, confirmer sa présence et la survoler environ dix secondes. Noter son acquisition ou son échec. Retirer A, constater réellement le vide, cliquer **Carte retirée / scène vide**, sortir le pointeur et terminer A. Démarrer ensuite B de la même séquence ; présenter B, confirmer sa présence, la survoler environ dix secondes, puis marquer son retrait et terminer B.

Observer si B est correctement identifiée, non reconnue ou reçoit une nouvelle décision portant l'identité de A. Un aperçu A simplement retenu ne prouve pas cette erreur. Si A n'a jamais été acquise, B reste utile mais la transition n'est pas une séquence complète réussie. Exporter après les huit séquences. Les remplacements directs sans intervalle vide ne sont pas attestés par ce volet.

## Phase 5 — Robustesse ordinaire et scènes négatives

Choisir **Robustesse ordinaire**. Préparer C1, C5, C6 et C10. Pour chaque carte, réaliser les trois situations proposées : sleeve habituelle, reflet habituel réellement présent, orientation naturelle différente. Cela fait douze observations d'environ dix secondes, chacune avec démarrer → présence → survol → retrait → fin.

Ne pas déplacer caméra ou lampe pour fabriquer ou supprimer un reflet. Si la sleeve ou le reflet n'est pas disponible, consigner **Situation indisponible** ; la fenêtre ne doit pas devenir un succès de cette condition. Noter les facteurs simultanés sans en déduire une cause. Exporter après les douze observations.

Choisir **Scènes négatives**. Préparer successivement table vide, playmat seul, main visible, paquet fermé ou dos visibles, puis objets de bureau ordinaires. Ne montrer aucune face de carte cible. Pour chaque scène, démarrer, confirmer **Carte retirée / scène vide**, observer trente secondes et déplacer naturellement le pointeur sur les emplacements possibles de consultation. Terminer avant la suivante.

Distinguer forme détectée, nouvelle identité acceptée et ancien aperçu conservé. Une forme ou un aperçu non renouvelé n'est pas un faux positif d'identification. Le Lab n'analyse pas spontanément tous les objets : un résultat négatif sans demande native ne prouve pas l'absence de faux positifs pour tout objet. Exporter après les cinq scènes.

## Phase 6 — Délai après survol : consultations immédiates, différées et répétées

Ne commencer **Délai après survol** qu'après examen des défauts prioritaires. Préparer C1, C3, C5, C6, C8 et C10. Le plan alterne les délais de 0, 5 et 10 secondes selon les cartes : dix-huit présentations avec deux survols chacune, soit trente-six fenêtres de consultation.

Pour le premier survol : démarrer la ligne, présenter la carte, confirmer sa présence et garder le pointeur hors vidéo. Attendre les 0, 5 ou 10 secondes indiquées depuis ce repère humain. Survoler une fois, observer environ dix secondes après la demande et consigner le résultat. La mesure commence au vrai mouvement entrant sur un track, pas à la présence ni au bouton. Terminer sans retirer la carte si le deuxième survol de la présentation suit.

Pour le deuxième survol : garder la même carte, sortir le pointeur, démarrer la deuxième ligne correspondante, confirmer la présence et remettre le pointeur une fois. Ne pas recommencer l'attente et ne pas vider le cache. Observer environ dix secondes, puis terminer et retirer la carte avant la nouvelle présentation. Si le premier a échoué, le deuxième est une nouvelle tentative, pas une réutilisation réussie.

Consigner **Aucune gêne ressentie**, **Gêne perceptible** ou **Interrompt une décision**. Exporter après cette phase. Aucune limite arbitraire en millisecondes ne décide du PASS. Les délais sont groupés selon leur provenance réelle : nouvelle analyse, cache, mémoire temporelle native, résultat préexistant ou origine inconnue. Premier survol ne signifie pas cache froid. Le Lab n'ajoute pas la mémoire de table des parties.

## Phase 7 — Manipulation libre solo : vingt à trente minutes

Choisir **Manipulation libre solo** et démarrer l'observation. Manipuler librement ses cartes sur la table, seul devant sa webcam : présenter, laisser en place, retirer et remplacer selon des gestes ordinaires. Consulter Vision par survol lorsqu'une information semble utile. Aucun adversaire ni quota de consultations n'est nécessaire.

Lorsque cela reste confortable, choisir la carte attendue puis cliquer **Déclarer la nouvelle carte attendue** avant le prochain survol. Ce repère ne demande aucune reconnaissance et ne change pas les consultations déjà enregistrées. Sans attendu préalable, les temps et sources restent observables mais la justesse est non évaluable automatiquement. Ne pas déclarer rétroactivement une vérité pour changer un résultat.

Déclarer la présence et le retrait lorsque cela est possible, et noter les incidents aux pauses naturelles. Un aperçu maintenu n'atteste pas une confirmation continue. Sans consultation, ce volet reste non concluant. Ce parcours exerce le moteur solo ; il ne certifie ni une partie réelle, ni WebRTC, ni l'expérience de deux joueurs.

Après vingt à trente minutes, terminer l'observation, cliquer **Clôturer la campagne**, puis **Télécharger le JSON local**. Vérifier le téléchargement avant de quitter. Les essais avec de vrais joueurs auront leur campagne ultérieure distincte.

## Conserver et interpréter les résultats

Le JSON conserve profil, build, corpus, observations, consultations, événements scalaires, incidents et limites. Aucun média, image, vidéo, audio, crop, nom de joueur ou code de partie n'est inclus. Les réussites, erreurs, refus, annulations, absences de réponse et réponses tardives restent visibles. Le rapport reste **NOT_EVALUATED** jusqu'à l'analyse des preuves physiques ; aucun PASS global automatique.

Une image correcte déjà visible avant une demande ne fabrique pas une latence à zéro. Une sortie de pointeur ne prouve pas une perte de suivi. Une identité expirée sous survol est distincte d'un aperçu encore visible. Les périodes sans observation native et trous d'échantillonnage sont inconnus. Une carte présente mais non détectée peut empêcher toute demande corrélable : conserver l'exclusion, sans présenter le taux des seuls essais valides comme une réussite de toutes les présentations.

Si le journal atteint ses limites ou devient tronqué, clôturer et télécharger le segment à une pause naturelle. Cliquer ensuite **Préparer un nouveau segment**, revérifier cadrage et sélection, puis préparer. Cette opération conserve la webcam et les règles moteur ; elle ne vide pas le cache. Garder tous les fichiers, y compris partiels ou en échec. Un rechargement de page ne restaure pas les essais : exporter d'abord. Pour passer au protocole nominal, exporter puis recharger le Lab, et préparer uniquement ce protocole dans la nouvelle page.

Créer un dossier nouveau pour cette campagne, conserver chaque JSON et les notes éventuelles, puis fournir ce dossier pour analyse. Ne pas écraser les exports historiques. Examiner fiabilité, stabilité, transitions et faux positifs avant les délais descriptifs et la gêne. Les défauts confirmés, réserves non concluantes et améliorations futures restent séparés ; aucun réglage moteur n'est modifié pour améliorer artificiellement un taux.
