# Vision 6C — identité canonique et qualification contrôlée

Départ : `update/next @ 7082e92a66b50d0e0654ef44a6bdba89b0715e2b`.
La prochaine campagne physique reste à réaliser. Les replays scalaires et les
webcams synthétiques ne constituent pas une qualification physique.

## Campagnes originales conservées

| Mesure | Première campagne | Campagne 6B |
| --- | --- | --- |
| Essais enregistrés | 45 | 46 |
| Valides / invalides | 43 / 2 | 45 / 1 |
| Détection des essais valides | 100 % | 100 % |
| Corrects | 11, soit 25,58 % | 0 |
| Mauvaise identité | 7 essais, soit 16,28 % | 0 |
| NOT_IDENTIFIED / UNSTABLE | 18 / 10 | 19 / 26 |

Les six fichiers des deux campagnes sont archivés octet pour octet, avec
manifeste SHA-256 externe. Les copies de la première campagne avaient été
préservées avant le remplacement des fichiers de téléchargement par les nouveaux téléchargements.
Les trois nouveaux fichiers d'origine restent inchangés. Aucun résultat ancien,
aucune annotation et aucun essai invalide n'est retiré ou recalculé pour annoncer
une réussite. Le rejeu du générateur partagé conserve les 91 essais et leurs
agrégats historiques exacts.

Empreintes des sessions :

- première : `49f6c00a09ae40db4f6fa6d7b62827956b67af4f992b74161b9f69a98f0fa5f9` ;
- 6B : `da70fbce21f7ba1a99283ed6c51609883308780c011cdaf92502572cb9b1a6ac`.

Empreintes des rapports de lecture et canoniques, identiques dans chaque campagne :

- première : `593ee46ae23585e88a2d015aecee1088b040680832a873f927a28a3264c39541` ;
- 6B : `f9158f1daf5529c502d2b0bbff381fb26728ed8bcebb6e55f8b4bb47be9cfbb2`.

## Marge entre cartes

Le worker et le fallback regroupent les références EN par `cardId` avant la
troncature du classement. Chaque carte garde le maximum de ses scores, jamais
leur somme. La marge oppose le meilleur score à celui du meilleur autre
`cardId`. Les listes physiques restent disponibles dans les diagnostics.

Le cas obligatoire Mantis Blades place trois impressions de cette carte en
rangs physiques 1, 2 et 3, puis Padre en rang 4 : la marge est bien score1 −
score4. Le rejeu comprend aussi Arasaka Emergency Radioport, Jackie Welles:
Mama's Favorite, Alt Cunningham: Soulkiller Architect, Industrial Assembly et
Adam Smasher: Ender of Legends.

Sur les 123 tentatives réelles enregistrées, le rejeu des scores dans les deux
matchers corrige 56 refus causés par des références sœurs. Onze refus de marge
restent rejetés ; les ambiguïtés entre cartes différentes ne disparaissent pas.
Aucune mauvaise carte canonique supplémentaire n'est acceptée dans ces 123
replays. Cette preuve est bornée aux scores enregistrés et aux tests négatifs ;
elle ne prédit pas le taux de la prochaine campagne physique.

Les seuils, les marges minimales, les descripteurs et les pools de recherche
restent inchangés. Les décisions FR et les références anciennes sans `cardId`
gardent leur traitement physique antérieur. L'identité temporelle EN utilise
`cardId` : un changement d'impression de la même carte n'est pas un changement
d'identité. Une impression à art partagé conserve `printingId: null` et
`UNRESOLVED_SHARED_ART`. Aucun printing exact n'est inventé.

## Suivi pendant un essai

Le Workspace active `PINNED_CANONICAL_TRACK` seulement entre T0 et la fin de
l'essai. Le premier track unique est verrouillé par UID, sans fournir l'identité
attendue au matcher. Le déplacement du curseur n'affecte ni ce choix ni les
décisions natives. Un autre UID ne remplace jamais automatiquement ce track.
Une perte, plusieurs tracks ou une erreur restent observables ; aucun maintien
artificiel d'identité n'est ajouté.

La capture nécessaire au matching existe toujours, mais l'encodage diagnostique
en média est désactivé dans ce mode. Aucun crop, image, vidéo ou identifiant de
périphérique n'est ajouté aux exports. Le produit normal reste piloté par le
survol ; l'API contrôlée refuse les autres pages, corpus et langues.

La fenêtre de 1 000 ms exige des décisions natives couvrant réellement cette
durée, avec horodatages récents et observations continues. Une répétition de
l'affichage ou une requête bloquée ne suffit pas. Dans le nouveau mode :

- un retrait de présentation UI seul n'altère pas l'identité mesurée ;
- les disparitions et changements réels restent comptés ;
- après une fenêtre stable, une perte non marquée du track, un rejet natif
  prolongé ou des décisions devenues périmées donnent UNSTABLE ;
- une trace absente, contradictoire, interrompue ou une erreur donne INVALID_TEST ;
- chaque mauvaise identité et chaque mauvaise impression exacte reste comptée ;
- le retrait volontaire marqué est traité séparément, après sa frontière.

Les anciennes sessions conservent leur interprétation historique. Le neutral
guard, sa fenêtre de 750 ms, la mémoire du moteur et A → vide → B sont conservés.

## Poste Vision Lab

Le Lab normal et la qualification réutilisent la même coque, le même élément
vidéo et le même flux. Caméra, carte/résultat, progression et action restent
accessibles à 1366×768. Les détails peuvent défiler indépendamment. Le retour
vers le Lab ou le Workspace conserve le flux ; la navigation est verrouillée
pendant l'observation active. Le mode normal conserve ses contrôles de survol.

Les captures automatiques demandées sont produites par
`workspace-vision-lab-6c-browser-test.js` : Lab normal, qualification prête,
essai actif, résultat avec neutral guard à 1366×768, puis mobile 390 px. Elles
sont revues visuellement en plus des assertions de géométrie. Elles utilisent
des données et une webcam de test, pas des cartes physiques.

## Avant la prochaine campagne

Ouvrir Railway Test → Workspace → Vision Lab, démarrer caméra, détection et
identification Cyberpunk EN (229 références), puis préparer la qualification.
Présenter une seule carte après T0 ; son track est suivi automatiquement.
Retirer la carte entre les essais et attendre la confirmation de neutralité.
Refaire uniquement les 45 essais nominaux des quinze cartes, puis conserver les
trois nouveaux exports dans un dossier distinct des deux campagnes précédentes.
La limite d’import est de 32 Mio par fichier : les traces 6C dépassent la limite
historique de 10 Mo. Les tests utilisent uniquement des blancs JSON pour vérifier
les bornes, sans ajouter de résultats mesurés.

Le gate physique reste correct ≥95 % et wrong ≤1 %. Les conditions dégradées
restent bloquées jusqu'au PASS nominal. Le verdict technique READY FOR FINAL
NOMINAL REQUALIFICATION n'est pas une réussite de ce gate.

## Vérification et périmètre

`npm run qualify:alpha` conserve toutes les suites historiques et ajoute les
tests canoniques, les contrats exacts de source, le contrôleur, l'intégration
et le parcours Lab 6C. Le reçu gelé, les commandes, codes, assertions et captures
sont conservés hors worktree. `npm run check` et `git diff --check` sont requis.

Le manifeste original de 228 fichiers est toujours authentifié ; 223 restent
strictement gelés. Les deux moteurs autorisés passent par des patches littéraux
réversibles et vérifiés, avant les anciennes empreintes. Les modifications de
seuils, de descripteurs et les changements hors patches sont refusés.

Seule `update/next` est poussée normalement. `main`, `workspace-state`, Candidate
14, les BDD Cyberpunk, FR et Railway Production restent inchangés. Aucun force push.
