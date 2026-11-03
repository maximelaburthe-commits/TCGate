# Vision 6B — diagnostic nominal et remise à zéro

Baseline produit : `062d6089fdfe5d778d65014642d909e8273fcc9a`, branche
`update/next`. Cette passe porte uniquement sur les 45 essais nominaux des
15 cartes proposées. Les conditions dégradées restent bloquées avant le gate
nominal physique. Aucun résultat automatisé ne déverrouille ce gate.

## Preuves physiques conservées

Les trois exports originaux du propriétaire sont conservés octet pour octet,
avec copies externes et manifeste SHA-256. Les rapports de lecture et canonique
ont la même empreinte ; ils restent deux fichiers distincts.

| Export original | SHA-256 |
| --- | --- |
| vision-qualification-session.json | 49f6c00a09ae40db4f6fa6d7b62827956b67af4f992b74161b9f69a98f0fa5f9 |
| vision-qualification-reading-report.json | 593ee46ae23585e88a2d015aecee1088b040680832a873f927a28a3264c39541 |
| vision-qualification-1.0.json | 593ee46ae23585e88a2d015aecee1088b040680832a873f927a28a3264c39541 |

| Mesure nominale | Baseline physique FAIL | Nouvelle campagne |
| --- | --- | --- |
| Essais | 45, dont 43 valides et 2 invalides | NOT TESTED |
| Détection | 43/43, 100 % | NOT TESTED |
| Identification correcte | 11/43, 25,58 % | NOT TESTED |
| Mauvaise identité observée | 7/43, 16,28 % | NOT TESTED |
| Catégories | 11 CORRECT, 18 NOT_IDENTIFIED, 10 UNSTABLE, 4 WRONG_IDENTIFICATION, 2 INVALID_TEST | NOT TESTED |

Le taux de mauvaise identification inclut trois essais UNSTABLE contenant une
mauvaise identité. Il ne se limite donc pas aux quatre WRONG_IDENTIFICATION.
Le verdict complet d'origine reste NOT YET QUALIFIED / INCOMPLETE ; les gates
nominaux d'origine sont FAIL. Aucune soustraction rétrospective ne corrige ces
résultats après découverte du défaut de frontière entre essais.

Les sept essais contenant une mauvaise identité commencent tous à T0 avec la
carte précédente encore mémorisée. Exemples : Alt Cunningham commence avec Safety
Override ; Detonate avec Padre ; Industrial Assembly avec Detonate. Les traces
montrent ensuite l'effacement de cette ancienne identité. C'est un défaut de
protocole reproductible du harness, pas une preuve suffisante pour changer le
matcher ou ses seuils.

Dans 17 des 18 NOT_IDENTIFIED, la référence attendue figure au moins une fois
dans les candidats. Ces candidats étaient exportés sans ordre de score. Les
anciens exports ne contiennent pas les scores rejetés, marges, motifs, qualité ou
état temporel nécessaires pour attribuer ces refus à un mécanisme précis.

Les dix UNSTABLE contiennent 25 disparitions d'identité alors que la détection
agrégée reste vraie. Cela n'exclut pas un changement de track : les anciens
exports ne donnent pas les UID de suivi. La responsabilité du matcher, du
lissage ou de la mémoire reste à établir par les nouveaux diagnostics.

## Armement après état neutre

Avant T0, l'observateur exige une scène vide réelle, l'absence de travail matcher
en cours et l'expiration naturelle de la mémoire de suivi existante. Il ne
change jamais identityMemoryMs et ne réinitialise pas les tracks.

La fenêtre neutre continue est de 750 ms, avec observations rapprochées et
progression réelle du détecteur. Une interruption, une carte réapparue ou une
identité résiduelle remet cette fenêtre à zéro. L'armement vérifie de nouveau
l'état courant, même si le bouton était actif un instant auparavant.

Le dernier visuel HD peut rester affiché après disparition physique. Lorsque la
mémoire réelle et le matcher sont vides, seule cette présentation est effacée
via l'API de handoff existante. Aucune mémoire de reconnaissance n'est raccourcie.
Les origines de suivi antérieures sont séparées du nouvel essai ; une vraie
mauvaise identification sur le nouveau track reste enregistrée.

## Utilisation du Workspace

Dans Workspace → Vision Lab, démarrer caméra, détection et identification EN,
puis préparer la qualification. Le même flux vidéo passe dans une console avec
caméra, carte courante, résultat court, progression et actions persistantes.
Les détails défilent indépendamment. Retour au Lab et reprise conservent le flux
et la session. Aucune nouvelle page ni seconde caméra.

L'action principale reste au même endroit : démarrer, terminer, essai suivant,
puis carte suivante. Entre les essais, attendre « Prêt pour l'essai suivant ».
Le message de retrait reste visible tant que Vision n'est pas neutre.
Espace actionne le bouton visible uniquement hors champs de saisie, sans
répétition de touche ni combinaison modificatrice.

Ne pas recharger la page pendant la session. Exporter les nouveaux fichiers dans
un autre dossier : ne jamais remplacer les trois exports de baseline.

## Diagnostic sans média

Chaque identification complétée dans le pipeline foreground existant expose une
observation scalaire, y compris les résultats retenus par le lissage temporel.
Les requêtes déjà annulées par les gardes existantes ne deviennent pas des essais
du nouvel échantillon.

Les données comprennent attente canonique, candidats classés existants, meilleurs
scores, score/rang attendu, second score, marge, motif de rejet, qualité/reflet
disponibles et décision temporelle. Un score attendu hors du classement exposé
reste null avec un statut explicite ; aucun matching supplémentaire n'est lancé.
Les diagnostics signalent également leurs limites et toute troncature.

Aucune image, vidéo, capture, crop, piste audio, SDP, ICE candidate ou ID brut de
périphérique ne fait partie de ces événements ou exports. Les identités sont
validées contre le corpus EN réel. Le même sanitizer est utilisé par la session
et le rapport canonique, dans le navigateur et le CLI.

Les causes observables distinguent score, marge, rang attendu, qualité et garde
temporelle. Une cause absente des données reste inconnue ; un motif observé n'est
pas automatiquement une cause physique démontrée.

## Gate avant la suite

Le gate exige les quinze cartes/impressions de la session, trois essais nominaux
physiques valides chacune, soit 45 valides, puis correct ≥95 % et wrong ≤1 %.
Les échecs sont tous conservés ; une annotation opérateur ne les réécrit pas.
Le gate nominal ne change jamais le verdict de qualification complète.

Le rapport et le panneau comparent explicitement la baseline conservée avec la
nouvelle campagne du SHA courant. Tant que les nouveaux exports physiques ne
sont pas disponibles, leurs taux restent null / NOT TESTED.

Si le nominal échoue encore, poursuivre uniquement le diagnostic nominal. Aucun
angle, distance, faible lumière, sleeve, faux positif, stabilité dédiée ou rapid
switch physique n'est à refaire dans cette passe.

## Séparation des changements

1. Workspace/harness : neutralité, séparation des essais, console et gate.
2. Instrumentation : point d'observation optionnel et diagnostics sanitisés.
3. Correction de reconnaissance : uniquement si des données la justifient.

Aucune correction des scores, seuils, marges, mémoire ou détecteur n'est justifiée
par la baseline actuelle. Aucun travail sur les performances d'index. FR, BDD,
main, workspace-state et Railway Production restent inchangés ; seul update/next
est poussé normalement, sans force.
