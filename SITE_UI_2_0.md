# TCGate — Site UI 2.0

Jalon 2, baseline `0844876eb75a6bcac80fe75f605811f5dee1e9a0`, branche produit `update/next`. `main` reste sur `e26b2e09579be53452c1e631b1dc5230191d0250`. La version de présentation passe à UI 2.0.0 ; aucune nouvelle Candidate produit n'est créée.

## Principes visuels

Une interface sombre, sobre et centrée sur la partie : espace libre, hiérarchie typographique, séparateurs fins, surfaces limitées aux endroits utiles. Le logo officiel `public/assets/tcgate-logo-final.png` est conservé octet pour octet, sans recoloration ni déformation. Les fonctions techniques restent dans leurs emplacements existants.

Les styles Home/Lobby de référence sont consolidés dans **le fichier existant** `public/tcgate-ui-1.2.css`. Son nom historique préserve l'URL et l'ordre des styles ; il n'y a pas de feuille expérimentale supplémentaire. `public/tcgate-ui-1.2.js` reste la couche de navigation et de présentation.

| Token | Valeur |
| --- | --- |
| background | `#070b13` |
| panel / panel2 | `#0d1420` / `#111a29` |
| line / line-soft | `#27324a` / `#1b2436` |
| text / muted | `#f4f6fb` / `#8f9bb0` |
| accent / accent2 | `#7c5cff` / `#9b86ff` |
| good / danger | `#67d9a2` / `#f06a75` |

Ces tokens sont limités à Home/Lobby. La typographie système existante est conservée, sans chargement de police externe. Les styles de focus, hover et disabled ainsi que `prefers-reduced-motion` sont explicites. Les statuts restent compréhensibles par leur texte, en complément de la couleur.

## Home et navigation

Le header léger réunit le logo, les cinq pages internes existantes et le statut Alpha. La navigation se compacte sur mobile, sans menu à plusieurs niveaux. Les onglets conservent leurs associations ARIA, leur focus et les touches fléchées/Home/End.

Le hero utilise deux colonnes sur desktop : **« Votre table, pas de frontière. »**, une explication courte, trois marqueurs discrets et les deux actions dominantes Créer/Rejoindre à gauche ; une grande capture du produit à droite. Le hero s'empile sur les petites largeurs. Le bouton de reprise d'une session existante est conservé.

Le visuel `public/assets/tcgate-product-preview.png` est une capture PNG brute du Game Table réel à la baseline, 1280 × 800 : deux pairs Room/SSE/WebRTC ont réellement été connectés, avec un média de démonstration utilisant les illustrations Cyberpunk déjà embarquées. La légende l'indique. Aucun écran produit, résultat Vision ou périphérique physique n'est inventé. La capture ne qualifie aucune webcam ni carte physique. L'ancien visuel Orbit n'est pas utilisé.

La bande Créer → Inviter → Jouer contient exactement trois étapes courtes. Les seuls modes disponibles présentés sont **Cyberpunk Trading Card Game** et **Sans jeu**, avec webcam/audio pour les deux. Les TCG futurs ne sont pas annoncés comme jouables.

## Créer et rejoindre

Créer ouvre d'abord une préparation courte, sans créer de room : jeu, pseudo, options de session, puis confirmation. Les valeurs initiales conservent les défauts existants : Cyberpunk, Timer 50 minutes activé, Gig Dice activés pour Cyberpunk. Sans jeu masque le choix Gig et conserve ses règles existantes.

La confirmation appelle le contrôleur `enterLobby` existant, puis la commande Host `updateHubMetadata` existante pour appliquer les options choisies. Le serveur, le protocole, les permissions et les règles Timer/Gig ne changent pas. Une double soumission UI est bloquée pendant l'ouverture. En cas d'échec de création, le formulaire reste modifiable ; en cas d'échec d'application d'options après création, l'interface demande de vérifier les réglages réels dans Session.

Rejoindre conserve le code de room, le pseudo, les invitations et les mécanismes existants. Les erreurs sont visibles et le champ invalide reçoit le focus. Retour ou Échap ferme une préparation sans room ; le focus revient au CTA correspondant. Le cycle de retour au Hub après une partie conserve son contrôleur antérieur.

## Lobby

Les trois espaces restent distincts :

- **Session** : jeu et options partagés, réglages modifiables par le Host et en lecture seule pour le Guest ; code et lien d'invitation accessibles.
- **Mon installation** : caméra, micro, aperçu personnel et Phone Camera existants. Le layout peut accueillir un futur réglage personnel sans afficher de faux sélecteur de langue.
- **Joueurs** : Moi / Adversaire, rôle Host / Guest, présence et Ready explicites.

Ready reste une action majeure hors des onglets, dans une barre fixe visible. Ses conditions caméra/adversaire, son action et la transition vers la partie sont celles de la baseline. L'espace de fin de page suit la hauteur réelle de cette barre via un `ResizeObserver` de présentation : le dernier champ peut défiler au-dessus du footer, y compris lorsque les textes se replient sur mobile.

## Responsive et qualification

Les tailles de référence sont 1920 × 1080, 1366 × 768, 900 × 900, 560 × 900 et 390 × 844. Les contrôles couvrent navigation, CTA, préparation, tous les onglets Lobby, Ready, débordements et labels critiques. Un contrôle par vrai défilement vérifie également la fin des panneaux derrière le footer fixe.

Les captures de qualification restent hors dépôt : Home desktop/mobile, Lobby Host/Guest desktop et Lobby mobile. La capture produit utilisée dans le hero est un asset nécessaire à la Home ; elle est distincte de ces preuves.

`site-ui-2.0-test.js` protège les fonctions et sources exclues par comparaison avec la baseline Git. `site-ui-2.0-browser-test.js` utilise de vrais salons locaux, SSE, WebRTC et des périphériques factices. Les suites historiques conservent leurs assertions Room, Ready, reprise, Phone, Timer, Gig, Reports, Vision et Locale Core ; seules les attentes de présentation remplacées et la confirmation explicite de création sont actualisées.

Le workflow courant `npm run qualify:alpha` contient 41 suites, dont dix navigateur, suivies du contrôle syntaxique et de `git diff --check`. Les résultats exacts, SHA, captures et limites sont consignés dans `SITE_UI_2_0_VALIDATION.txt` et les reçus externes.

## Audit legacy

| Classement | Éléments | Traitement |
| --- | --- | --- |
| KEEP | `styles.css`, `tcgate-alpha.css`, `tcgate-alpha-ui-1.0.5.css` | Base et règles encore utilisées, notamment par la table ; aucun retrait global risqué. |
| KEEP | `future-ux-v3.7.css` / `.js`, Phone Camera, Reports | Montages, dock, zoom et fonctions existantes encore actifs. |
| REPLACE | Ancien hero une colonne, header haut, panneaux Home/Lobby | Nouvelle présentation dans la couche UI existante, avec mêmes contrôles fonctionnels. |
| DELETE | Option désactivée `value="other"` du choix de jeu | Promesse morte retirée ; aucun jeu réellement disponible supprimé. |
| HISTORICAL | Ancien hero Orbit et sélecteurs de visuels absents du DOM actuel | Assets et historique conservés ; aucune réactivation. |
| HISTORICAL | Anciens wrappers Hub non montés | Aucun nettoyage des contrôleurs hors périmètre ; les classes encore actives sont préservées. |

## Limites et exclusions

Game Table HTML, serveur Room, WebRTC/recovery, Phone, moteur Vision, BDD et contrat Locale Core restent inchangés. Les fonctions actives Timer/Gig/Reports de `app.js` sont protégées par tests ; les changements dans ce fichier se limitent à l'entrée de préparation, aux bindings UI et à la version d'affichage.

**Player Locale NOT IMPLEMENTED. Vision Locale NOT IMPLEMENTED.** Aucun champ de langue personnel, persistance, synchronisation de locale ou filtre Vision n'est ajouté. Player Locale relève du Jalon 3 ; Vision Qualification 1.0 et la qualification FR restent futures. Aucune nouvelle qualification matérielle, TURN distant ou livraison réelle Resend n'est déduite des tests UI. Aucun changement de main, fusion de branche ou intervention sur Railway Production.
