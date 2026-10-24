# Restauration du cockpit Workspace

Départ update/next : 9f4605c3d697ff2a882303738a56d6961bc49763. Cette étape restaure la présentation autour du vrai Lab déjà validé, sans modifier ses moteurs.

## Interface restaurée

Référence visuelle locale : tcgate_workspace_permanent.html, cockpit original v3. Sidebar de 252 px sur desktop, sept rubriques (Reprise, Général, Vision, BDD, UI / UX, Fonctions annexes, Vision Lab), fond #0b0d10, cartes et bordures discrètes, accent #51d6c3. Le lien permanent Production TCGate garde le domaine Railway Production. La sidebar se réorganise aux largeurs moyennes ; le Lab conserve une zone webcam large et distingue Caméra & détection de l’identification optionnelle.

Reprise retrouve les références Production/Candidate/développement, SHA et informations disponibles ; synchronisation canonique ; En cours actuellement, Prochaines priorités, Décisions à prendre, Notes de reprise et État vérifié. Les dates et mentions « enregistré » permettent de distinguer ces références stockées d’un contrôle Git courant. Aucun SHA ou statut du JSON canonique n’est réécrit par ce chantier.

Général retrouve les quatre indicateurs et le score de maturité global, les références et les fonctions générales. La formule est celle du cockpit original : moyenne arrondie de progress × weight / somme des poids, pour roadmap=true, status différent de abandoned et poids positif. Toutes catégories contribuent. Stable/qualified comptent comme qualifiées/stables ; attention/experimental/prototype comme points d’attention. Le nombre suivi inclut toutes les fonctions. Les données, poids et maturités viennent du workspace-state ; aucun résultat n’est figé en dur.

Les catégories affichent toutes leurs fonctions avec état, maturité, piste/version, progression, inclusion roadmap et détails notes/historique. Vision conserve Vision Lab comme fonction suivie et propose Ouvrir Vision Lab. BDD retrouve Cyberpunk, les autres BDD, runtime multi-BDD et Card Registry présents dans les données ; les liens de maintenance GitHub déjà livrés restent distincts et inchangés.

## Séparation du Lab conservée

workspace-cockpit-model.js projette les indicateurs ; workspace-cockpit.js lit et présente le JSON canonique. La synchronisation, automatique à l’ouverture puis manuelle via Synchroniser, ne reconstruit ni ne démarre le Lab. En cas d’erreur canonique, le Lab reste utilisable et les dernières données affichées sont conservées.

Le fragment de workspace.js depuis l’état du provider jusqu’à la fin du runtime Lab est identique, après normalisation des fins de ligne, à 9f4605c. Un test en garde le hash. Les changements du même fichier se limitent à déplacer l’ancien rendu canonique et à présenter la navigation (titre, largeur, resize). Les contrôles Lab conservent leurs IDs et leurs nœuds DOM entre vues.

Webcam et détection sans BDD, identification à la demande, erreur de manifest non bloquante, sélection/résolution caméra, overlay, arrêt des tracks, audio:false, corpus production de 229 références, manifest test Lab-only, Top 5/crop, captures et exports restent couverts par les tests existants. Les moteurs, workers, modèle, registry DB et configuration Railway ne changent pas. Aucun code de room ou WebRTC n’est ajouté.

## Validation

- workspace-cockpit-test.js : formule originale, exclusions, compteurs, catégories, absence de mutation des données et hash du runtime Lab conservé.
- workspace-cockpit-browser-test.js : sept vues, références et fonctions issues d’un état synthétique modifiable, historique dépliable, texte sûr, actualisation des indicateurs via Synchroniser, lien Production, échec canonique indépendant et tailles 1920×1080, 1366×900, 900×900, 560×900. Huit captures automatiques de contrôle aux deux largeurs desktop sont conservées dans le dossier temporaire de validation ; aucune donnée de fixture n’est intégrée au produit.
- workspace-camera-browser-test.js : assertions existantes conservées, avec navigation/synchronisation pendant la vraie détection et contrôle de géométrie aux quatre largeurs. Le test utilise deux caméras simulées, le vrai ONNX/WebGPU puis les vrais manifest/assets Cyberpunk de production et le vrai matcher de 229 références. Aucune validation webcam physique revendiquée.
- npm run check est désormais défini : validation syntaxique Node de tous les scripts JavaScript à la racine et sous public, sans dépendance ajoutée. Les suites Workspace/Vision/BDD/Alpha et git diff --check figurent dans WORKSPACE_COCKPIT_UI_VALIDATION.txt ; les journaux précédents sont conservés.

Travail uniquement sur update/next. Aucune Candidate créée, aucun changement de main/workspace-state ou de repository DB, aucune modification ni action de configuration Railway. Le déploiement Test peut suivre le push normal ; il n’est pas exécuté dans cette session.
