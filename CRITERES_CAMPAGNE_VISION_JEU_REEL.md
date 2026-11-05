# Critères d’évaluation — Vision 1.0 en conditions de partie

Préparation du 5 novembre 2026 (Europe/Paris), sur `6d08ad3fde309a6c38990ba82ef4e56aa2e21597`. Aucun nouveau résultat physique.

## Priorité obligatoire

Évaluer **la fiabilité, puis la stabilité, puis la rapidité**. Une réponse rapide avec une mauvaise identité reste un défaut de fiabilité. Une image affichée longtemps ne prouve pas une identité stable. La vitesse sert à comprendre une gêne constatée en partie ; elle ne compense jamais les deux premières exigences.

Le PASS nominal historique reste **43/45, 95,5556 %, zéro mauvaise identification**, avec les deux NOT_IDENTIFIED Alt Cunningham conservés. Il garde son périmètre historique. Les nouveaux essais ne changent pas son dénominateur.

## 1. Classer les constats

| Classe | Exemples et décision |
| --- | --- |
| **Défaut critique confirmé** | Une nouvelle décision accepte une autre carte ; B reçoit réellement une identité de A ; une nouvelle identité est acceptée sans face de carte cible ; une identité se perd ou bascule de façon reproductible alors que la même carte est présente et que son suivi natif reste admissible ; Vision bloque durablement l’interface ou interrompt la partie de façon reproductiblement corrélée. Conserver la preuve et suspendre l’extension pour diagnostic. |
| **Défaut acceptable sous réserve** | Refus ponctuel explicite permettant de poursuivre normalement ; impression exacte non résolue pour un art partagé alors que la bonne carte canonique est obtenue ; aperçu volontairement maintenu après sortie du pointeur, s’il n’est pas présenté comme une confirmation actuelle. Garder et compter le défaut : « acceptable » ne signifie pas effacé ni converti en succès. |
| **Résultat non concluant** | Carte/édition hors corpus ou indisponible, durée interrompue, erreur de manipulation, installation changée, vidéo adverse figée, cible masquée, fraîcheur de décision inconnue, source cache non exposée, absence de consultation spontanée. Un incident visuel suspect sans preuve de fraîcheur reste à confirmer, pas une erreur moteur démontrée. |
| **Amélioration future** | Consultations correctes mais gênantes à plusieurs reprises ; confort de présentation ; angles extrêmes et variations systématiques de distance reportés. Une optimisation exige une gêne reproductible et doit conserver les protections contre les mauvaises identités. |

Un refus reproductible sur une carte représentative dans une installation jugée jouable appelle un diagnostic de fiabilité, même sans mauvaise identité. Il n’est pas automatiquement acceptable parce qu’il serait prudent. Une véritable sortie du champ, une occlusion ou un arrêt vidéo ne sont pas une disparition injustifiée.

Un changement d’UID de suivi ne prouve pas un changement de carte. Distinguer perte de track, réacquisition, identité native et présentation. Un ancien aperçu avant le survol de B ne prouve pas que B a été reconnue comme A.

## 2. Fiabilité : des nombres descriptifs

Pour les **20 présentations prévues**, publier planifiées, réalisées, exploitables, non concluantes, correctes, non reconnues pendant la fenêtre et incorrectes. Conserver motifs d’exclusion et reprises comme nouvelles lignes.

Taux : correctes / présentations exploitables ; présentations comportant une mauvaise identité / présentations exploitables. Une erreur sur vingt vaut cinq points de pourcentage. Zéro erreur sur vingt ne démontre pas un risque général inférieur à 1 % ; les répétitions d’une même carte ne sont pas deux cartes indépendantes.

« Aucun résultat correct observé pendant environ dix secondes » reste cette observation limitée, pas une preuve que la carte ne pourra jamais être reconnue. Une réponse plus tardive est un événement supplémentaire, pas un remplacement du constat. En manuel, ne pas nommer NO_DETECTION un survol sans résultat lorsque la détection interne n’est pas mesurée.

Ne jamais additionner les 45 essais historiques aux vingt présentations pour améliorer artificiellement le taux. Robustesse et consultations répétées gardent leurs propres groupes.

## 3. Stabilité et transitions

Les **huit observations de vingt secondes** représentent au plus 160 secondes observées, pas 160 essais indépendants. Compter fenêtres complètes, acquisitions non obtenues, interruptions, pertes et changements de nom.

L’instrumentation future doit séparer présence physique déclarée, présence dans la vidéo reçue, track actuel, observations manquées, perte/réacquisition, identité suspendue, identité native utilisable, origine/âge de dernière décision, mémoire et aperçu HD conservé.

Publier durées totale/maximale des pertes et délai de retour d’une identité correcte. Si un taux de maintien est calculé, préciser son dénominateur : présence physique déclarée, ou suivi natif admissible. Publier aussi la disponibilité du suivi afin de ne pas masquer ses pertes en réduisant le dénominateur. Un dénominateur nul donne « non mesuré ».

Ne pas imposer au mode normal la cadence ou la fenêtre de fraîcheur du harness automatique. Décrire ses règles actuelles sans provoquer des matchs pour fabriquer une continuité. Deux passages de dix secondes ne constituent pas vingt secondes continues.

Pour les **huit A → B**, conserver A, retrait, intervalle vide, B, demande et résultat. Séparer A jamais acquise, retrait observé, B non reconnue et B réellement identifiée comme A. Un remplacement avec intervalle vide n’atteste pas tous les remplacements directs sous pointeur immobile.

## 4. Robustesse et faux positifs

Les **douze observations** sont quatre cartes dans trois situations ordinaires, pas un plan factoriel isolant toutes les causes. Noter sleeve déjà présente, reflet réellement rencontré et orientation. Une situation indisponible reste non testée. Caméra et installation fixes : aucun angle favorable recherché après échec.

Les **cinq scènes de trente secondes** ont un dénominateur de cinq scènes et 150 secondes prévues ; publier les durées réellement observées. Séparer forme détectée, ancienne image conservée, nouvelle identité acceptée sans cible, demandes réellement tentées et périodes sans demande.

Une forme détectée n’est pas un faux positif d’identification. Zéro identité erronée dans une scène passive ne garantit pas toutes les consultations possibles. Ne pas diviser ces événements par le nombre de cartes positives.

## 5. Rapidité : confort, aucun seuil bloquant arbitraire

Prévoir **18 premières consultations et 18 deuxièmes consultations**, sur six cartes avec délais immédiat/5/10 secondes. Ces attentes sont des conditions de présentation, pas des durées matcher à soustraire.

Le carnet manuel utilise la présence de la carte dans la vidéo reçue comme repère humain. Il ne prétend pas connaître la première détection interne. La mesure instrumentée attendue sépare demande réelle → résultat correspondant présentable dans l’interface, premier résultat quelconque, première identité correcte, confirmation stable et disponibilité de l’image HD.

La bonne identité peut déjà exister avant le survol grâce à la mémoire table : la dater comme préexistante, sans inventer une latence négative. Identifier la provenance observée : comparaison au premier plan, cache de survol, mémoire table, autre/inconnue. Premier survol ne signifie pas cache froid ; cache bibliothèque/descripteurs et image HD sont d’autres mécanismes. Aucun cache n’est vidé.

Conserver demandes sans réponse et résultats tardifs. Une donnée inconnue n’est jamais zéro milliseconde. L’aperçu déjà visible correctement au début d’une demande est signalé comme préexistant ; son seul maintien n’est pas un nouveau résultat instantané confirmé.

Publier n, min, médiane, max et ressenti par provenance/délai/type de consultation. Les petits groupes ne permettent pas un p95 robuste ; le tooling historique ne l’émet qu’à partir de vingt valeurs valides. Ne pas mélanger premières et secondes consultations pour atteindre artificiellement ce minimum.

Ressenti proposé : **ne gêne pas le tour**, **gêne perceptible**, **oblige à attendre/interrompt une décision**. Ce sont des annotations humaines, pas des seuils normatifs. Optimiser seulement après plusieurs épisodes concrets reproductibles, puis vérifier l’absence de dégradation de fiabilité/stabilité.

## 6. Partie libre et conclusion

Pendant 20 à 30 minutes, relever les consultations spontanées et incidents. Aucun quota ni attente artificielle. Zéro consultation rend le volet Vision non concluant, même avec une vidéo fonctionnelle.

Vidéo figée ou UI bloquée : incident à examiner. FPS, long tasks, WebRTC et chronologie peuvent aider ; une coïncidence temporelle ne démontre pas la cause.

Trois états distincts :

1. **Préparation validable** : guide, sélection, volumes et limites documentés.
2. **Diagnostic manuel disponible**, avec réserves : il ne certifie pas les mesures natives absentes.
3. **Qualification instrumentée du périmètre jeu réel** : après développement, tests, validation explicite du déploiement, campagne physique du testeur et analyse.

Ne pas transformer le rapport historique incomplet en FAIL de ce nouveau périmètre, ni annoncer un PASS global Vision 1.0. Angles extrêmes, distance systématique et autres conditions différées restent à qualifier.
