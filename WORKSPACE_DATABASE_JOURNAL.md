# Workspace — Maintenance BDD et Journal de pilotage

Départ update/next : be40bf6405421f1f45bfa98866f13bbddaad7a42. État canonique de départ : 9088d31567585b12889a4e1f0e104b262e97ee88. Git CLI uniquement pour les opérations Git/GitHub en écriture. Les interfaces navigateur décrites ci-dessous effectuent uniquement des lectures publiques ou ouvrent un formulaire GitHub à confirmer par le propriétaire.

## Maintenance des bases de données

La vue BDD conserve les fonctions canoniques et présente un tableau ACTIVE TCGATE / CANDIDATE CYBERPUNK. ACTIVE vient exclusivement de game-databases.js, inchangé : DB1.1.0, SHA56402636a77af9c8b5dc4e3b61c509a185f3c834, game cyberpunk-tcg, scope cyberpunk-beta-2026, 150 cartes, 229 printings, 150 groupes, 229 références matcher, statut candidate-qualified. Aucune lecture de la branche main du repository DB n’infère cet état.

Au premier accès BDD, le modèle tente de résoudre le HEAD public de develop-cyberpunk-db-v1.2. Tous les documents RAW sont ensuite lus sur ce SHA immuable. Rafraîchir l’état BDD résout à nouveau le HEAD. Un échec API emploie le fallback connu425e0198610cd0a746c4e2d1fc3094b3823340e4 et l’indique ; les erreurs des documents optionnels restent visibles sans bloquer le Workspace.

Pendant ce chantier, le HEAD confirmé par Git CLI et API publique est425e0198610cd0a746c4e2d1fc3094b3823340e4 : DB1.2.0 development, schema2.1.0, locales EN/FR, catalogue151 cartes/700 printings, 447 assets d’affichage et447 Vision. Snapshot Candidate2026-09-24 ; staging2026-09-12. Le tableau affiche ces provenances séparément, y compris lorsqu’un rapport partiel exige un fallback de date vers db-manifest ou coverage. Le runtime reste150 cartes/229 printings, distinct du catalogue. Le rapport différentiel déclare240 nouveaux printings,240 nouveaux assets et240 assets manquants dans ce différentiel ; le catalogue expose253 assets hors runtime manquants, EN103/FR150. FR expose zéro asset Vision et cinq champs de metadata manquants. Asset rights review reste requis.

Les badges lisent les données. READY FOR LAB signifie que le runtime déclaré peut être inspecté, pas que toutes ses langues/cartes sont physiquement qualifiées. QUALIFIED exige un statut correspondant dans un manifest valide ; aucun test JavaScript ne crée ce statut. Les résumés comptent les éléments, et les listes complètes sont disponibles sous details.

Vérifier les mises à jour ouvre Validate TCGate database / build-database.yml dans GitHub. Utiliser Run workflow avec promote=false pour une vérification/staging sans promotion. Le Workspace ne lance pas le workflow et ne modifie aucun repository DB.

Tester la Candidate dans Vision Lab ouvre cette vue, choisit Manifest de test, remplit son URL RAW immuable et lance uniquement l’inspection. Activer l’identification reste un clic distinct. Si l’identification d’une autre source est déjà initialisée, la Candidate est ouverte dans une nouvelle session Workspace/Lab afin de conserver le flux et les captures courants. Cette session peut être amorcée par un paramètre labCandidate strictement limité au manifest Cyberpunk sur SHA40. Aucun registre de production n’est changé. Le flux webcam et le détecteur restent indépendants de toutes ces lectures.

## Journal

Le Journal constitue l’inbox opérationnel du projet. Lors de la préparation d’un nouveau jalon, consulter ses entrées ouvertes avec l’état canonique du Workspace avant de décider des priorités. workspace-state est l’état consolidé ; les GitHub Issues dont le titre commence exactement par [JOURNAL] sont les choses à intégrer, tester, vérifier, décider ou investiguer. Les Pull Requests et autres Issues sont exclues.

Le formulaire propose type, domaine, priorité, titre et description, avec contexte et critère de validation facultatifs. Publier dans le journal ouvre une URL /issues/new préremplie : titre [JOURNAL] et corps balisé tcgate-workspace-journal:v1. Le propriétaire confirme la création sur GitHub. Aucun token, authentification GitHub ou appel write API n’est présent. Le formulaire n’ajoute automatiquement aucun diagnostic, média ou donnée sensible. Aucun test ne crée de vraie Issue.

Un brouillon local explicite peut être conservé dans localStorage puis effacé ; il n’apparaît jamais comme entrée officielle. Les longues notes ne sont pas tronquées : si la taille d’URL conseillée est dépassée, titre et corps complets peuvent être copiés vers un formulaire GitHub vide.

Les Issues publiques sont lues par pages et séparées entre À traiter et Historique. Les ouvertes sont triées Majeur / Intermédiaire / Mineur puis de la plus ancienne à la plus récente. Ce tri ne modifie aucune roadmap. Types et priorités sont filtrables. Chaque carte conserve metadata, date, état, numéro, résumé et lien GitHub. Une limite de pagination atteinte est signalée avec lien vers GitHub ; les erreurs conservent les dernières entrées lues. Le backend/config par défaut fonctionne aussi sans section journal canonique.

## Architecture et isolation

- workspace-journal-model.js : formats, URL de formulaire, parsing/tri/filtres, brouillon et lectures GET ; workspace-journal.js : formulaire et cartes.
- workspace-database-maintenance-model.js : projection ACTIVE, résolution HEAD et rapports immuables ; workspace-database-maintenance.js : tableau/actions.
- workspace-candidate-lab.js : passage explicite et isolé vers le Lab existant. workspace.js conserve son runtime caméra/provider/matcher inchangé, protégé par le test de hash historique.
- workspace-cockpit.js émet uniquement un événement de données après lecture canonique. La sidebar ajoute Journal ; les autres vues sont conservées.
- La CSP autorise api.github.com seulement pour /workspace.html, afin de permettre ces lectures publiques. La politique de la page produit reste inchangée. Aucun nouveau backend d’administration n’est ajouté.

## État canonique et validation

Un commit séparé sur workspace-state actualise la référence finale update/next et son avance réellement mesurée après push. Le départ était14ahead/0behind ; le commit de fonctionnalité porte cette avance à15ahead/0behind. main et Candidate14 restent inchangés. Les versions Lab0.5.1-r14.1/R14.1ERA, campagnes et historiques existants sont conservés ; la reconnaissance physique porte explicitement « à tester avec cartes physiques ». La validation Railway Test sur be40bf6405… est une confirmation du propriétaire, distincte du nouveau lot à tester. La configuration journal demandée est ajoutée sans changer la synchronisation canonique.

Voir WORKSPACE_DATABASE_JOURNAL_VALIDATION.txt pour les commandes/codes. Les tests dédiés couvrent les erreurs réseau, la pagination, les dates/sources, la publication manuelle, la conservation du brouillon, l’isolation Candidate et les largeurs1920/1366/900/560. Les suites précédentes Workspace/Cockpit/Camera/Vision/BDD/Alpha restent exécutées. Les caméras de tests sont simulées ; les moteurs ONNX et matcher sont réels ; aucune qualification avec cartes physiques n’est revendiquée.
