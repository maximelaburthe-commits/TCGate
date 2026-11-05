# Guide utilisateur — campagne Vision 1.0 adaptée au jeu réel

**Statut : préparation uniquement. Aucune nouvelle campagne physique n’a été lancée.**

Le nominal historique reste **PASS : 43/45, 95,56 %, zéro mauvaise identification**. Cette préparation n’efface ni ce reçu, ni les échecs et exports antérieurs. Elle ne délivre pas un nouveau PASS global.

Deux niveaux sont distingués :

- **Observation manuelle disponible aujourd’hui** : vraie partie TCGate Test, flux adverse et carnet. Elle décrit l’expérience visible.
- **Qualification instrumentée complète à développer, tester puis déployer après validation explicite** : demandes, détection, décisions Vision, suivi, cache et affichage mesurés séparément. Elle n’est pas annoncée disponible.

Le guide décrit le premier niveau. Il ne certifie pas des délais en millisecondes, une détection fraîche, un suivi continu ou l’origine exacte du cache. Ne commencez que lorsque vous déciderez de lancer les essais.

## Préparation commune

Prévoir deux joueurs avec leurs installations habituelles, les cartes physiques Cyberpunk EN du corpus proposé, les sleeves réellement utilisées, un chronomètre ordinaire et un carnet papier ou traitement de texte. Compter environ une heure à une heure trente, pauses comprises.

Répartir les rôles : le **présentateur** manipule ses cartes devant sa caméra ; le **consultant** regarde cette table sur le flux adverse et utilise Vision par survol. Les cartes testées sont chez le présentateur. Une troisième personne peut prendre les notes. Toutes les phases principales se déroulent dans la vraie table de Test ; ne pas ouvrir simultanément une autre caméra dans le Lab.

Créer un document « Vision jeu réel — date — testeur ». Inscrire date, navigateurs, caméras, éclairage, sleeves, disposition de table, rôles, adresse Test et version affichée si disponible. Aucune mesure géométrique obligatoire.

Pour chaque observation, relever : phase/numéro, carte attendue, présence humaine vérifiée dans la vidéo reçue, nom affiché avant/après survol, résultat correct/refus/incorrect/ambigu, pertes d’aperçu, perturbation vidéo/interface, délai humain approximatif et commentaire. Écrire « non mesuré » lorsque nécessaire. Les contours de détection ne sont pas normalement affichés en partie : ne pas attendre un cadre.

**Après chaque phase**, compléter et enregistrer le document avec votre logiciel habituel ; l’exporter en PDF si souhaité. Conserver les échecs et ajouter toute reprise comme nouvelle ligne. Aucun JSON à fabriquer, script ou DevTools. Le bouton produit **Rapport** prépare un envoi par e-mail : ne pas l’envoyer pour cette procédure ; il ne remplace pas votre carnet et n’est pas un téléchargement local.

## Phase 1 — Créer la table Test et valider l’installation

**Préparer.** Prévoir environ cinq à dix minutes, ou le temps nécessaire pour valider le cadrage sans essais comptés. Choisir librement une hauteur et un angle de caméra confortables pour jouer. Prévoir l’espace nécessaire aux cartes et aux mains, sans rechercher une position avantageuse pour Vision.

**Interface.** Ouvrir [l’accueil Railway Test](https://tcgate-ux-lab.up.railway.app/). L’hôte clique **Créer une partie**, choisit son pseudo et **Cyberpunk Trading Card Game · Vision**, puis **Ouvrir la table**. Transmettre le code ou lien à l’adversaire par votre moyen habituel. Celui-ci clique **Rejoindre une partie**, renseigne code et pseudo puis **Rejoindre la table**.

Dans **Mon installation**, chacun clique **Activer caméra et micro**, autorise les appareils et vérifie son aperçu. Vérifier que **Langue de mes cartes** correspond à l’anglais (EN). Dans **Joueurs**, chacun clique **Je suis prêt**. Lorsque les conditions sont réunies, l’entrée en partie est automatique : aucun autre bouton de lancement de l’hôte n’est requis. Attendre la vidéo adverse et l’état Vision active ou prête ; si la connexion ou Vision ne devient pas disponible, noter le blocage avant tout essai.

**Actions.** Le présentateur pose une carte dans les zones où il jouerait normalement. Le consultant valide le cadrage depuis la **vidéo reçue**, et non seulement depuis l’aperçu local du présentateur. Une courte reconnaissance de contrôle sert au fonctionnement, sans compter dans les résultats.

**Observer et terminer.** Valider personnellement l’installation. Ensuite, garder caméra et éclairage fixes. Noter un déplacement involontaire et séparer les observations suivantes. Ne modifier ni seuil, résolution, mémoire, tracking ou cache ; ne pas reconstruire les références entre essais.

**Exporter.** Enregistrer la fiche d’installation. Le Lab et le bouton « Préparer la qualification » ne servent pas aux mesures principales : leur chemin de reconnaissance diffère de celui d’une partie.

## Les dix cartes préparées

| Repère | Carte | Repère du corpus EN |
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

Ces cartes couvrent quatre types, quatre couleurs, des illustrations claires/sombres et des arts exacts/partagés. Alt reste présente malgré ses deux échecs historiques. Mantis et Misty restent présentes ; Detonate et Industrial forment un couple visuellement proche.

Les numéros sont ceux du corpus historique, pas une autorisation de substituer n’importe quelle édition commerciale. Vérifier les éditions physiques avant la campagne. Ne pas remplacer silencieusement par une autre édition, une carte FR ou une impression hors corpus. Noter l’indisponibilité : une sélection alternative vérifiée devra être fixée avant le lancement complet.

## Phase 2 — Fiabilité : vingt présentations

**Préparer.** Le présentateur range C1 à C10 ; le consultant reste dans la table de Test sur le flux adverse.

**Actions.** Première passe C1→C10 ; seconde C6→C10 puis C1→C5. Les deux présentations d’une carte sont ainsi séparées par plusieurs autres cartes. Avant chaque présentation, sortir le pointeur de la vidéo, retirer la carte précédente et constater la scène vide dans le flux reçu. Présenter la carte à sa place de jeu habituelle. Dès qu’elle est visible pour le consultant, la survoler pour demander sa consultation. Observer environ dix secondes, sans repositionnement destiné à forcer un succès. Aucun cadre de détection n’est requis à l’écran.

**Observer.** Bonne identité, absence de résultat, affichage incorrect, ambiguïté ou perturbation. Inscrire le nom affiché avant le survol. Un ancien aperçu conservé ne constitue pas automatiquement une nouvelle mauvaise décision Vision.

**Passer à la suivante.** Après la fenêtre, noter, retirer la carte puis sortir le pointeur. Ne pas répéter jusqu’au succès. Une erreur de manipulation donne une ligne non concluante et une reprise distincte.

**Exporter et décider.** Enregistrer vingt lignes. Elles constituent un diagnostic, pas une démonstration statistique d’un taux d’erreur inférieur à 1 %. En cas d’incident critique ou de refus reproductible en condition ordinaire, faire une pause et demander l’analyse avant de poursuivre vers la rapidité. Ne modifier aucun réglage pour contourner le défaut.

## Phase 3 — Stabilité : huit observations continues de vingt secondes

**Préparer.** C1, C3, C5, C6, C7, C8, C9, C10, une fois chacune ; chronomètre accessible.

**Actions.** Présenter une carte seule sur la table adverse, la survoler et attendre un premier affichage correct. Dès cet affichage, observer vingt secondes continues, carte toujours présente et visible dans le flux reçu. Garder le pointeur sur elle, sans masquage volontaire. Si aucun résultat correct n’arrive pendant une observation d’environ dix secondes, noter « stabilité non évaluable : acquisition non obtenue ».

**Observer.** Présence physique confirmée par le présentateur, présence dans la vidéo reçue, nom affiché, aperçu qui disparaît ou change, vidéo figée et gêne. Distinguer ces phénomènes. L’image conservée ne prouve pas vingt secondes de confirmation moteur ; la continuité interne du suivi reste non mesurée.

**Passer à la suivante.** Après vingt secondes complètes, noter puis retirer. Une interruption réelle reste consignée. Deux passages de dix secondes ne remplacent pas vingt secondes continues.

**Exporter et décider.** Enregistrer huit lignes, durées réelles et réserves. Pause avant la rapidité si un défaut critique ou une perte reproductible apparaît ; demander l’analyse sans modifier le moteur.

## Phase 4 — Transitions : huit séquences A → B

**Préparer.** C1→C6, C6→C1, C9→C10, C10→C9, C8→C10, C10→C8, C5→C7, C7→C5.

**Actions.** Pointeur hors vidéo, présenter A, puis la survoler pendant environ dix secondes au maximum pour obtenir un premier résultat correct. Sans acquisition, noter la précondition manquante ; une observation de B seule reste un diagnostic distinct, pas une transition réussie. Retirer A et constater la scène vide dans le flux reçu ; noter l’aperçu éventuellement conservé. Sortir le pointeur **avant de présenter B**, puis survoler B une fois visible. Un pointeur immobile déjà placé sur la zone pourrait déclencher une consultation involontaire. Le remplacement comporte ici un intervalle vide, sans chevauchement volontaire.

**Observer.** B reconnue, ancien nom qui revient, absence de résultat ou perturbation vidéo. Le maintien de l’aperçu A sans nouvelle décision n’est pas une identification confirmée de B comme A.

**Passer à la suivante.** Après environ dix secondes d’observation de B et inscription du résultat. Si A n’a jamais été reconnue, conserver l’échec de précondition ; ne pas déclarer son retrait réussi.

**Exporter.** Enregistrer huit séquences, A et B distinctes. Les remplacements directs sans scène vide et cartes simultanées nécessitent une mesure séparée.

## Phase 5 — Robustesse ordinaire et scènes négatives

**Préparer.** C1, C5, C6, C10 ; sleeves habituelles ; installation et éclairage fixes.

**Douze observations.** Pour chaque carte, observer environ dix secondes dans trois situations : sleeve habituelle ; reflet habituel réellement rencontré ; orientation naturelle différente. Alterner le sens de rotation entre les cartes, sans angle extrême imposé. Présenter puis survoler le flux adverse comme en phase 2. Ne pas déplacer caméra ou lampe pour fabriquer/supprimer un reflet. Sans reflet rencontré, noter « reflet non observé » ; sans sleeve, noter l’indisponibilité.

**Observer et avancer.** Noter identité visible, refus, gêne et situation exacte. Après chaque fenêtre, enregistrer avant de retirer. Plusieurs facteurs présents ensemble ne démontrent pas, à eux seuls, la cause d’un défaut.

**Cinq scènes négatives.** Observer trente secondes chacune : table vide ; playmat seul ; main visible ; paquet fermé/dos visibles ; objets de bureau ordinaires. Aucune face de carte cible visible sur la table présentée. Le consultant déplace naturellement le pointeur aux emplacements où une carte ou un objet pourrait être consulté, sans attendre de contours. Noter nouveau nom visible, ancien aperçu et ambiguïtés. Un aperçu antérieur n’établit pas un faux positif frais ; le nombre exact de décisions reste non mesuré.

**Exporter.** Enregistrer douze lignes et cinq scènes avec leurs durées. Les durées négatives restent distinctes des présentations de cartes. Ne pas mélanger ces notes avec les exports historiques.

## Phase 6 — Rapidité : immédiatement, après cinq et dix secondes

**Préparer.** Six cartes, délais dans cet ordre : C1 : 0/5/10 ; C3 : 5/10/0 ; C5 : 10/0/5 ; C6 : 0/10/5 ; C8 : 10/5/0 ; C10 : 5/0/10. Total : dix-huit présentations. Ne passer à cette phase qu’après examen des éventuels défauts prioritaires.

**Actions.** Pointeur hors vidéo, présenter la carte. Dès qu’elle est **visible dans le flux adverse**, la survoler immédiatement, ou après environ cinq/dix secondes selon l’ordre. Cette origine est une convention humaine : elle ne correspond pas à l’instant interne de détection. Chronométrer approximativement le temps entre survol et premier résultat correct visible. Ne pas soustraire cinq/dix secondes d’une autre mesure. Après un résultat, sortir puis remettre le pointeur sur la même carte une fois : dix-huit deuxièmes consultations supplémentaires.

**Observer.** Temps ressenti, résultat juste/refus/incorrect et gêne pour une décision de jeu. Première consultation de cette présentation ne signifie pas première reconnaissance ni cache froid : le traitement de la table peut déjà avoir travaillé. Le cache exact reste non mesuré, même si une indication visible peut être notée. Ne le vider jamais.

**Passer et exporter.** Après les deux consultations et leurs notes, passer à la présentation suivante. Garder séparément échecs, délais non mesurables et secondes consultations. Si une première consultation ne donne aucun résultat, noter la seconde comme non faite ou la décrire comme une nouvelle tentative, pas comme une réutilisation réussie. Les trente-six consultations sont un volume prévu ; enregistrer le nombre réellement effectué. Aucune limite arbitraire de vitesse ne bloque la campagne.

## Phase 7 — Partie spontanée : vingt à trente minutes

**Préparer.** Conserver la vraie table Test de phase 1, les deux installations et un carnet léger. Les deux joueurs reprennent maintenant leur rôle ordinaire.

**Actions.** Jouer normalement vingt à trente minutes. Chacun consulte les cartes adverses par survol lorsqu’une vraie question de jeu se pose. Aucun quota de consultations, attente ajoutée ou ralentissement de tour pour obtenir une mesure.

**Observer.** À la prochaine pause naturelle, noter carte, résultat visible, consultation abandonnée, délai gênant, ancien aperçu trompeur, vidéo/audio/interface perturbés. Distinguer un problème du flux reçu d’un refus de reconnaissance. Sans consultation spontanée, ce volet reste non concluant pour Vision.

**Terminer et exporter.** Relever durée et nombre de consultations réellement notées, puis sauvegarder carnet/document/PDF avant de quitter. Ne pas utiliser l’envoi **Rapport** comme export local. Cette partie ne donne pas automatiquement un verdict global de qualification.

## Annexe — Lab facultatif et preuves séparées

Le Lab est utile pour inspecter le corpus ; il ne remplace pas les phases en vraie partie. À un autre moment, après libération de la caméra, ouvrir `/workspace.html` sur Test, puis **Vision Lab**. Pour inspecter : **Activer la caméra**, **Activer la détection**, source **Cyberpunk · production**, **Inspecter la BDD**, **Activer l’identification** ; attendre les **229 références**. Le reçu historique reste 43/45. « Production » désigne la source BDD, pas une instruction de changer d’environnement.

Ne pas cliquer « Préparer la qualification » pour mesurer le survol : la reconnaissance des essais positifs y devient automatique. Les mesures Lab et partie restent séparées.

Le bouton **Exporter les cas du Lab (images + diagnostic)** peut inclure un crop automatique même sans capture volontaire. Ce n’est pas un export sans média et il n’est pas nécessaire au carnet.

Une conclusion technique complète nécessite encore l’instrumentation validée distinguant détection, demande par survol, première décision correcte, affichage, suivi effectif et cache. Une image conservée n’est jamais une identité encore confirmée par Vision. Arts partagés non résolus, cas indisponibles et incertitudes restent explicitement documentés. Angles extrêmes, distances systématiques et optimisations moteur sont hors de cette préparation.
## Fiches à copier dans votre carnet

Ces tableaux sont des modèles vierges, pas des résultats. Copier les lignes nécessaires dans votre traitement de texte avant de commencer. Sur papier, imprimer et remplir à la main. Le PDF du guide ne sauvegarde pas automatiquement un carnet de partie.

### Fiche d’installation

| Information | À renseigner |
| --- | --- |
| Date, présentateur, consultant, preneur de notes | |
| Navigateur et caméra de chaque joueur | |
| Langue des cartes et édition vérifiée | |
| Éclairage, sleeves, disposition habituelle | |
| Cadrage validé depuis la vidéo reçue par le consultant | Oui / non, commentaire |
| Modification ultérieure de l’installation | Heure et observations concernées, ou aucune |
| Environnement | TCGate Test |

### Fiabilité et robustesse : une ligne par présentation

| Phase / numéro | Carte et édition | Présente chez le partenaire et visible dans le flux reçu ? | Nom avant survol | Résultat après survol | Vidéo/UI et remarque |
| --- | --- | --- | --- | --- | --- |
| À remplir | | | | Correct / non obtenu pendant la fenêtre / incorrect apparent / ambigu | |

Prévoir vingt lignes de fiabilité et douze de robustesse. Ajouter sleeve, reflet réellement présent ou orientation à la remarque. Les observations impossibles restent non faites ; ne pas inscrire de succès par défaut.

### Stabilité : huit lignes

| Carte | Acquisition correcte obtenue ? | Durée continue réellement observée | Présence physique et vidéo | Changement/disparition d’aperçu, heure et durée approximatives | Réserve |
| --- | --- | --- | --- | --- | --- |
| À remplir | | | | | Suivi interne non mesuré en mode manuel |

### Transitions : huit séquences

| Numéro / A → B | A acquise ? | A retirée et scène vide observée ? | Pointeur sorti avant B ? | Résultat de B / ancien aperçu | Incident et durée approximative |
| --- | --- | --- | --- | --- | --- |
| À remplir | | | | | |

### Scènes négatives : cinq lignes

| Scène | Durée réelle | Positions survolées / demandes faites | Nom déjà affiché avant la scène | Nouveau nom apparent ou ambiguïté | Vidéo/UI |
| --- | --- | --- | --- | --- | --- |
| Table vide | | | | | |
| Playmat seul | | | | | |
| Main visible | | | | | |
| Paquet fermé / dos visibles | | | | | |
| Objets de bureau | | | | | |

### Rapidité : jusqu’à trente-six consultations prévues

| Carte / présentation | Attente 0 / 5 / 10 s prévue et approximative réelle | Premier ou deuxième survol | Résultat et aperçu préexistant ? | Temps humain approximatif / non mesuré | Gêne |
| --- | --- | --- | --- | --- | --- |
| À remplir | | | | | Aucune / perceptible / interrompt une décision |

Ajouter « origine cache/mémoire inconnue » tant qu’aucune provenance technique n’est mesurée. Ne pas inventer un zéro pour les demandes sans réponse ou pour l’image déjà présente.

### Partie libre et clôture

Noter début, fin, durée, consultations réellement observées, carte concernée, résultat, éventuelle gêne et moment approximatif de l’incident. Une ligne libre suffit à chaque pause naturelle. Enregistrer le document à la fin de chaque phase. Conserver dans un dossier nouveau les notes et leurs PDF, sans remplacer les anciennes campagnes ni modifier leurs JSON.
