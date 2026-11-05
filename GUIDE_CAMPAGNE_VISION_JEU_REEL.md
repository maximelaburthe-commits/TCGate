# Guide utilisateur — Vision 1.0 en jeu réel

Version instrumentée, 5 novembre 2026. Cette livraison prépare les mesures ; elle ne contient aucun résultat de nouvelle campagne physique. Le déploiement et le lancement des essais restent soumis à votre décision. Le guide de préparation original est conservé dans `docs/vision-real-game/preparation/`, avec son PDF.

Le nominal historique reste PASS : **43/45 (95,56 %), zéro mauvaise identification**. Ses deux non-identifications Alt Cunningham restent des preuves. Les nouvelles observations n'entrent jamais dans ses 45 essais. La nouvelle campagne évalue d'abord la fiabilité, ensuite la stabilité et enfin le confort de réponse, sans limite arbitraire de vitesse.

## Avant de commencer

Prévoir deux joueurs avec leurs installations ordinaires, dix cartes physiques Cyberpunk EN, leurs sleeves habituelles et environ une heure à une heure trente, pauses comprises. Un présentateur manipule les cartes ; un consultant regarde sa vidéo adverse et utilise Vision. Le consultant ouvre le panneau de campagne. Un seul sens de consultation est mesuré par cette page ; pour inverser les rôles, créer une session et un export séparés sur l'autre appareil.

Choisir librement la caméra, sa hauteur et son angle, comme pour jouer. Valider le cadrage depuis la vidéo reçue par le consultant, puis conserver cette installation. Aucune géométrie idéale n'est imposée. Ne modifier aucun seuil, mémoire, cache ou réglage moteur pour faire réussir une carte. Ne pas ouvrir le Lab en parallèle.

Cette page n'est pas encore déployée par cette livraison. Après validation explicite et mise à disposition du build de Test, ouvrir **https://tcgate-ux-lab.up.railway.app/vision-real-game.html**. Si elle n'est pas disponible, ne pas utiliser le guide nominal à sa place : demander la mise à disposition du build préparé. La production n'est pas concernée.

Aucune commande, script ou DevTools n'est nécessaire au testeur.

## Phase 1 — Ouvrir la partie et préparer la campagne

1. Sur la page de Test ci-dessus, cliquer **Créer une partie**. Choisir son pseudo et **Cyberpunk Trading Card Game · Vision**, puis **Ouvrir la table**. Transmettre le code par votre moyen habituel. Le partenaire clique **Rejoindre une partie**, saisit code et pseudo, puis **Rejoindre la table**.
2. Dans **Mon installation**, chacun clique **Activer caméra et micro**, autorise ses appareils et vérifie son aperçu. Choisir **Langue de mes cartes : EN**. Dans **Joueurs**, chacun clique **Je suis prêt**. L'entrée en partie est automatique quand les conditions sont réunies.
3. Attendre la vidéo adverse et Vision prête. Le consultant doit reconnaître les cartes chez son partenaire, pas sa propre webcam. Ne pas attendre un contour de détection : il n'est pas normalement affiché en partie.
4. Ouvrir **Campagne Vision en jeu réel**, le panneau repliable en bas de la page. Vérifier le cadrage avec une carte dans une zone ordinaire de jeu, puis cocher les confirmations du cadrage fixe et des impressions physiques EN.
5. Laisser **Origine de cette session : Essais physiques à réaliser par le testeur** pour les véritables cartes. Le choix « Test automatisé / synthétique » sert uniquement aux essais techniques et ne vaut jamais qualification physique. Choisir l'éclairage habituel ; s'il varie, conserver cette limite.
6. Cliquer **Vérifier le jeu et préparer la campagne**. Ouvrir **Disponibilité et sélection des dix cartes avant la campagne**. Vérifier chaque carte et impression. Décocher les indisponibles ; une éventuelle substitution doit être choisie ici avant le début, sans retirer une carte parce qu'elle échoue ensuite.
7. Cliquer **Préparer la campagne avec cette sélection**. Le panneau vérifie le build, le vrai corpus EN à 229 références et la compatibilité du reçu historique. Il doit afficher le nominal historique 43/45. En cas de refus, conserver le message et ne pas contourner la vérification.

La préparation ne commence aucun essai et ne demande aucune reconnaissance. Les boutons du panneau notent les étapes ; seul le survol normal de la vidéo consulte Vision.

## Les dix cartes proposées

| Repère | Carte | Impression physique de préparation |
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

Vérifier les impressions avant les essais ; un identifiant interne proposé dans le panneau ne rend pas toutes les éditions commerciales équivalentes. Les cartes absentes restent visibles comme indisponibles. Les arts partagés peuvent permettre la bonne identité canonique sans résoudre exactement l'impression : cette réserve doit rester présente.

## Les commandes communes à toutes les phases

Dans **Phase**, choisir le volet, puis dans **Observation prévue**, la carte ou la scène. Cliquer **Démarrer l'observation** avant de présenter la carte. Quand elle est effectivement visible dans la vidéo reçue, cliquer **Carte présente dans la vidéo reçue**, puis la survoler naturellement. Ce bouton est un repère humain, pas l'instant interne de détection ni une demande d'identification.

À son retrait, cliquer **Carte retirée / scène vide**. Cliquer **Terminer cette observation** à la fin de la durée. L'observation suivante est proposée, mais ne démarre pas seule. Ne pas chercher à transformer un échec en succès en répétant jusqu'à réussite. Une reprise éventuelle reste une observation supplémentaire, jamais un remplacement.

Pour une pause, cliquer **Mettre en pause**. Une fenêtre en cours devient interrompue ; cliquer ensuite **Reprendre l'observation** et démarrer une nouvelle fenêtre. Deux fragments de dix secondes ne font pas vingt secondes continues. Les changements de corpus, langue, build ou mode de suivi arrêtent le segment ; exporter avant de préparer une nouvelle session.

Pour noter un problème, choisir **Incident / ressenti**, puis **Consigner ce constat**. Choix disponibles : vidéo figée, interface bloquée, mauvaise identité suspectée, perte suspectée, gêne perceptible, interruption d'une décision, changement d'installation, situation indisponible ou erreur de manipulation. Un soupçon humain reste distinct d'une mauvaise décision techniquement observée.

Après chaque phase, cliquer **Télécharger le JSON local**. Vérifier qu'un fichier `vision-real-game-….json` apparaît dans Téléchargements et le ranger dans un nouveau dossier de campagne. Conserver tous les exports, même partiels ou en échec. Le bouton produit **Rapport** prépare un e-mail et n'est pas l'export demandé ici.

## Phase 2 — Fiabilité : dix cartes, deux présentations chacune

Préparer C1 à C10. Choisir **Fiabilité**. Le plan propose une première passe C1→C10, puis C6→C10 et C1→C5, soit vingt présentations séparées.

Pour chaque observation : sortir le pointeur de la vidéo ; retirer l'ancienne carte et constater la scène vide ; démarrer ; présenter la carte à sa place habituelle ; confirmer sa présence dans la vidéo reçue ; survoler. Observer environ dix secondes. Ne pas déplacer caméra, lampe ou carte pour forcer la reconnaissance.

Observer bonne carte, refus, absence de réponse, mauvaise identité, impression non résolue et éventuelle gêne vidéo/interface. Un ancien aperçu HD conservé n'est pas une nouvelle identification de la carte présente. Consigner tout incident. Au bout de la fenêtre, marquer le retrait puis terminer. Passer à la ligne suivante, même après un refus. Exporter après les vingt présentations, ou plus tôt si interruption.

Un incident critique ou un refus reproductible en installation ordinaire justifie une pause pour analyse avant d'aller vers la vitesse. Les vingt présentations sont un diagnostic ; zéro erreur sur vingt ne prouve pas un risque général inférieur à 1 %.

## Phase 3 — Stabilité : huit cartes, vingt secondes continues

Préparer C1, C3, C5, C6, C7, C8, C9, C10. Choisir **Stabilité** et la carte indiquée. Démarrer, présenter, confirmer la présence reçue et survoler. Après le premier affichage correct, garder la carte visible et immobile pendant environ vingt secondes continues. Garder le pointeur sur elle ; ne pas provoquer d'occlusion.

Sans acquisition correcte après environ dix secondes, conserver l'échec d'acquisition : ne pas annoncer une stabilité réussie. Si l'identité disparaît ou change alors que la carte reste là, laisser l'observation se poursuivre, consigner le constat, puis terminer. Le temps affiché compte depuis le début de l'observation : attendre personnellement vingt secondes après l'acquisition correcte, pas seulement vingt secondes au compteur.

Observer séparément la vidéo reçue, le suivi et l'identité ; l'image HD peut rester affichée après une perte native. Marquer le retrait seulement quand la carte est réellement retirée, puis terminer et passer à la suivante. Exporter après les huit fenêtres. Une interruption, une vidéo figée ou une durée trop courte reste une réserve ; ne pas la convertir en fenêtre complète.

## Phase 4 — Huit transitions A → vide → B

Préparer les paires C1→C6, C6→C1, C9→C10, C10→C9, C8→C10, C10→C8, C5→C7, C7→C5. Choisir **Retrait et remplacement**. Chaque séquence comporte deux observations liées, A puis B : seize fenêtres pour huit transitions.

Démarrer A, confirmer sa présence puis la survoler, jusqu'à environ dix secondes. Noter si A est acquise. Retirer A, cliquer **Carte retirée / scène vide** après observation réelle du vide, puis sortir le pointeur. Terminer A. Choisir et démarrer B de la même séquence ; présenter B, confirmer sa présence et la survoler environ dix secondes. Marquer le retrait, puis terminer B.

Observer si B est correctement identifiée, non reconnue, ou reçoit une nouvelle décision portant l'identité de A. L'aperçu A simplement maintenu ne prouve pas cette erreur. Une A jamais reconnue laisse une précondition manquante : l'observation de B reste utile, mais ne devient pas une transition complète réussie. Exporter après les huit séquences. Les remplacements directs sans intervalle vide ne sont pas attestés par ce volet.

## Phase 5 — Robustesse ordinaire et cinq scènes négatives

Choisir **Robustesse ordinaire**. Préparer C1, C5, C6, C10. Pour chacune, effectuer les trois situations proposées : sleeve habituelle, reflet réellement rencontré, orientation naturelle différente. Douze observations d'environ dix secondes, avec les mêmes commandes présence → survol → retrait → fin.

Ne pas déplacer caméra ou lampe pour fabriquer ou supprimer un reflet. Sans sleeve ou reflet rencontré, consigner **Situation indisponible** : l'observation ne doit pas être présentée comme une réussite de cette condition. Noter les facteurs simultanés sans inventer de cause.

Choisir ensuite **Scènes négatives**. Préparer successivement : table vide, playmat seul, main visible, paquet fermé ou dos visibles, objets de bureau ordinaires. Aucune face de carte cible. Démarrer la scène, confirmer **Carte retirée / scène vide**, observer trente secondes et déplacer naturellement le pointeur aux emplacements possibles de consultation. Terminer chaque scène avant la suivante.

Observer forme détectée, nouvelle identité acceptée, ancien aperçu conservé et perturbations : ce sont des choses distinctes. Une forme n'est pas un faux positif d'identification ; un aperçu antérieur non renouvelé non plus. Exporter après les douze observations et après les cinq scènes.

## Phase 6 — Délai après une vraie demande : 0, 5 et 10 secondes

Passer à **Délai après survol** seulement après examen des problèmes prioritaires de fiabilité/stabilité. Préparer C1, C3, C5, C6, C8, C10. Le panneau propose les ordres 0/5/10, 5/10/0, 10/0/5, 0/10/5, 10/5/0 et 5/0/10 secondes. Cela représente dix-huit présentations avec un premier survol, puis un deuxième : trente-six observations de consultation prévues.

Pour un premier survol, démarrer, présenter la carte et confirmer sa présence dans la vidéo reçue, pointeur hors vidéo. Attendre le délai indiqué depuis ce repère humain, puis survoler une fois. La mesure du délai de réponse commence au vrai mouvement de survol, pas au clic ni à l'apparition physique de la carte. Observer le résultat et la gêne, puis terminer sans retirer la carte si le deuxième survol de cette même présentation suit.

Pour le deuxième survol, conserver la même carte, sortir le pointeur, choisir la deuxième observation correspondante et la démarrer. Confirmer que la carte est toujours présente, puis remettre le pointeur une fois. Ne pas vider le cache. Le délai 0/5/10 prépare la première demande de la présentation ; ce deuxième geste sert à observer la réutilisation, pas à prétendre refaire une première reconnaissance froide. Si le premier survol n'a pas abouti, garder cet échec ; le second est une nouvelle tentative, pas une réutilisation réussie.

Consigner le ressenti : **Ne gêne pas le tour**, **Gêne perceptible** ou **Interrompt une décision**. Aucune valeur en millisecondes ne suffit à bloquer le volet par une règle arbitraire. Exporter après cette phase. Les sources nouvelle analyse, cache de survol et mémoire table sont séparées lorsque le produit les expose ; une origine inconnue reste inconnue.

## Phase 7 — Une vraie partie de vingt à trente minutes

Choisir **Partie spontanée** et démarrer l'observation. Jouer normalement vingt à trente minutes, sans quota, ralentissement ou attente artificielle. Replier le panneau si nécessaire. Seules les vraies questions du joueur doivent provoquer les consultations habituelles.

Lorsque cela reste confortable, utiliser le choix facultatif de carte attendue et **Déclarer la nouvelle carte attendue** avant son prochain survol. Cette déclaration sert uniquement à l'analyse et ne demande aucune reconnaissance. Les consultations déjà enregistrées gardent leur ancien attendu. Sans déclaration préalable, les temps et sources restent mesurables, mais la justesse de la carte est non évaluable automatiquement ; ne pas choisir rétroactivement une vérité pour transformer un résultat.

À une pause naturelle, consigner les consultations gênantes, pertes, mauvaise identité suspectée, perturbations vidéo ou interface. Ne pas prendre la présence d'un aperçu pour une confirmation continue. Sans consultation spontanée, le volet Vision est non concluant, même si la vidéo fonctionne.

À la fin, terminer l'observation, cliquer **Clôturer la campagne**, puis **Télécharger le JSON local**. Vérifier le téléchargement avant de quitter ou recharger. La session est en mémoire seulement : le JSON est une preuve d'analyse, pas une restauration automatique de session.

## Lire et conserver les résultats

Le JSON contient le profil, le build et le corpus, les observations, consultations, événements scalaires, incidents et limites. Il conserve réussites, erreurs, annulations, absences de réponse et réponses tardives. Il ne contient ni image, vidéo, audio, crop, nom de joueur ou code de partie. Ne pas joindre un export Lab avec médias à sa place.

Une consultation abandonnée n'est pas automatiquement une non-identification. Une observation interrompue, sans attendu, hors corpus ou sans vidéo exploitable reste visible avec sa réserve. Une image déjà correcte avant la demande n'invente pas un nouveau résultat à zéro milliseconde. Un premier survol n'est pas nécessairement une première reconnaissance : la mémoire table normale peut avoir déjà travaillé.

Si le panneau signale un journal tronqué ou une limite atteinte, ne pas présenter le segment comme une chronologie complète. À une pause naturelle, cliquer **Clôturer la campagne**, puis **Télécharger le JSON local**. Après le téléchargement, cliquer **Préparer un nouveau segment** : seul le panneau se réinitialise, sans recharger la page ni interrompre la vidéo. Revérifier l'installation et la sélection, puis préparer le nouveau segment. Les anciennes mesures restent dans leurs fichiers téléchargés, jamais remplacées ; le nouveau segment a une nouvelle horloge. Ce bouton sert aussi à une reprise distincte après changement d'installation. Ne pas utiliser F5 pour cette opération.

Conserver un dossier nouveau avec tous les JSON et les éventuelles notes. Ne renommer ni écraser les campagnes historiques. Fournir le dossier pour analyse : fiabilité, stabilité, transitions et scènes négatives d'abord, puis délais descriptifs et ressenti. Le rapport reste **NOT_EVALUATED**, avec revue physique requise : aucun PASS physique ou global n'est automatique.

Les temps d'affichage sont des observations navigateur de l'image prête et visible avec opportunité de rendu, pas une mesure au photon près de l'écran. Les pertes sont observées aux événements et points d'échantillonnage du produit, pas à chaque image caméra ; les trous et inconnus restent signalés. Les durées techniques et incidents ne prouvent pas à eux seuls que l'instrumentation cause une gêne.

La relecture décidera : défaut critique confirmé à diagnostiquer, défaut acceptable mais conservé, résultat non concluant à compléter, ou amélioration future. Les angles extrêmes, variations systématiques de distance et optimisations moteur sont reportés. La campagne n'est lancée qu'avec votre intervention sur les vraies cartes et après mise à disposition explicitement autorisée du build de Test.
