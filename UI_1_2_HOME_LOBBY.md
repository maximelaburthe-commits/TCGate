# TCGate UI 1.2 — Accueil et Lobby

Branche : `update/next`. Départ : `25cd174c2bd4952fd8d0d317ad543d7b720cf3a0`.
La version produit reste Candidate 13 ; le libellé frontend passe à UI 1.2.0.

## Présentation

L’Accueil propose Accueil, Fonctionnement, Fonctions, Jeux et Alpha sans route supplémentaire ni rechargement. Il conserve les actions de création, de connexion et de reprise. L’illustration Orbit est retirée de la Home. Seuls Cyberpunk et Sans jeu sont proposés ; Phone Camera reste présenté comme expérimental.

Le Lobby propose Session, Mon installation et Joueurs. Les contrôles existants sont déplacés dans des zones statiques, sans clonage, reconstruction des formulaires ou seconde source d’état. Ready reste dans une barre inférieure indépendante des onglets. La navigation utilise des boutons à rôles tab, aria-selected, tabindex et flèches clavier. Timer et Gig Dice exposent aria-pressed ; le Guest consulte les options sans pouvoir les modifier.

`public/tcgate-ui-1.2.css` est chargé après les anciennes couches et ne cible que Home et Lobby. `public/tcgate-ui-1.2.js` contient uniquement navigation et présentation en lecture de l’état existant. Le montage `mountUnifiedHub()` conserve les nœuds, IDs et listeners d’origine.

## Option de salon Gig Dice

Le serveur conserve `room.gigDiceEnabled` : true à la création Cyberpunk, false pour Sans jeu. Le snapshot l’expose dans les réponses de création/connexion/reprise et les événements SSE room-state. Le PATCH Room existant n’accepte qu’un booléen, réservé au Host avant lancement. Une activation hors Cyberpunk est refusée ; passer à Sans jeu force false. Revenir réellement vers Cyberpunk reprend le défaut true, sauf valeur false explicite dans le même PATCH. Réassigner Cyberpunk sans changement conserve le choix précédent.

Le client hydrate `state.gigDiceEnabled` depuis les réponses serveur. Le bouton du Lobby utilise le PATCH existant ; le snapshot reste autoritaire. Le module n’est disponible que si le jeu est Cyberpunk et si le booléen vaut true. Quand il est désactivé, panneau, totem et reset sont cachés et inertes, les interactions sont bloquées et aucun gig-state n’est demandé ni envoyé. Le serveur refuse aussi ce type de signal lorsque l’option est désactivée. Le serveur ne stocke aucune valeur de dé. Calculs, limites, transferts et transport existants restent conservés.

## Intégrité

Le logo `public/assets/tcgate-logo-final.png` est le PNG RGBA 2048 × 682 fourni, copié octet pour octet :

`56660fac88d53f7fc9e6056725a4067f89f5cc0079f70407cb79180bb7d92515`.

Le contrat vérifie la totalité de la section HTML screenGame, y compris les sections imbriquées, et la présentation Table de future-ux-v3.7.js. La seule adaptation de cette dernière est le refus d’ouvrir Gig Dice lorsqu’il est désactivé. Le markup Game est conservé et le remplacement global du logo s’y applique automatiquement. setReady et le gestionnaire startGame sont comparés au départ Git ; les ajouts d’adoption du booléen sont isolés dans la comparaison applyRoomState. Les protections historiques sont conservées et les anciennes assertions Home remplacées par le contrat UI 1.2.

Les moteurs WebRTC, TURN, recovery, Vision, identification, Table State, Phone Camera, BDD et reports ne sont pas modifiés. Les changements dans app.js et server.js concernent l’adoption et l’accès au module Gig Dice, plus le libellé UI frontend. Aucun changement de configuration Railway, de main, de Candidate 14 ou de workspace-state.

## Validation

30 suites distinctes réussies, dont quatre suites UI 1.2 : contrat, client (45 assertions), Room HTTP/SSE (59 assertions), navigateur (366 assertions). Le journal complet est dans [UI_1_2_VALIDATION.txt](UI_1_2_VALIDATION.txt).

Le smoke Chrome utilise deux contextes Host/Guest, les vraies routes Room, SSE et WebRTC locales, avec caméra et micro simulés. Il couvre les cinq pages, les trois onglets, 1920 × 1080 / 1366 × 768 / 900 × 900 / 560 × 900, copie code/lien, Timer Host-only, Gig Dice partagé, Phone Camera UI et QR, médias, Ready, lancement, reprise F5 et Sans jeu. Il vérifie l’absence de signaux Gig quand l’option est désactivée et sa présence dans une nouvelle partie activée.

Les suites Workspace, BDD, Vision, Phone et reports existantes passent aussi. Les tests BDD historiques utilisent le fixture de production 1.1.0 via TCGATE_DB_FIXTURE_ROOT ; les tests navigateur utilisent Playwright via WORKSPACE_PLAYWRIGHT_PATH. Les captures optionnelles sont enregistrées via WORKSPACE_SCREENSHOT_DIR avec le préfixe ui-1.2-.

Commandes dédiées : `npm run test:ui-1.2` et `npm run test:ui-1.2-browser`. Contrôles finaux : `npm run check` et `git diff --check`.

Limites : aucune qualification de deux webcams physiques, d’un téléphone réel ou de TURN distant. Les captures et le smoke sont automatisés. La validation Railway reste à effectuer après publication de ce commit sur update/next.
