# Qualification Alpha courante — Candidate 15

Un seul workflow de qualification complète :

```text
npm run qualify:alpha
```

Il exécute 46 suites distinctes, dont douze suites navigateur, puis le contrôle syntaxique correspondant à `npm run check` et `git diff --check HEAD^ HEAD`. Les 45 suites précédentes sont conservées ; Cyberpunk Languages Qualification ajoute sa suite de qualification structurelle et ses contre-exemples. Cette suite exige les deux snapshots réels indiqués par `TCGATE_CYBERPUNK_MAIN_ROOT` et `TCGATE_CYBERPUNK_DEVELOP_ROOT`, et ne remplace jamais une passe physique. Les empreintes de 79 fonctions d'identification, de 47 fonctions Table State et des constantes de reconnaissance restent identiques à la baseline pré-Jalon-4. Détecteur, worker de reconnaissance et modèle gardent leurs empreintes complètes. Aucune suite navigateur n'est facultative. Aucun package npm runtime externe n'est déclaré ; le workflow C14 historique appelant le forwarder retiré n'est pas restauré.

## Préconditions et preuves

- `update/next` propre, commit gelé ; versions package/lock/frontend/server cohérentes Candidate 15.
- Node 20+ ; Playwright installé et Chrome disponible. Fournir `WORKSPACE_PLAYWRIGHT_PATH` si Playwright est installé hors dépôt. Aucun téléchargement ou ajout de dépendance automatique.
- Accès réseau aux ressources publiques GitHub immuables de Cyberpunk et aux assets de test navigateur existants. Aucun secret nécessaire. Les credentials fournisseur hérités sont neutralisés ; Cloudflare et Resend sont simulés dans leurs tests dédiés.
- Les chemins alternatifs de staging et les hooks Node hérités sont neutralisés pour que les suites testent réellement le dépôt gelé. Le seul preload est le compteur d'assertions versionné.
- Le dossier de preuves est nouveau et hors worktree : valeur automatique dans TEMP, ou `npm run qualify:alpha -- --output-dir CHEMIN_ABSOLU`. Refus de réécrire un reçu existant.

`qualification.json` enregistre SHA, arbre Git, date, Node, Playwright, manifeste SHA-256 des tests, commandes, sorties, durée, PASS/FAIL et comptage. Les journaux, captures et audit Gig y sont conservés. Le workflow échoue au premier échec et préserve la campagne partielle ; une reprise utilise un nouveau dossier.

Comptage : appels aux API Node `assert` des processus de test instrumentés, y compris cas négatifs attendus. Les gardes personnalisées `throw` de certaines suites historiques s'ajoutent sans être comptées. Ce nombre est une mesure explicitement bornée, pas une estimation du nombre total de contrôles manuels ou navigateur.

## Couverture courante

| Domaine | Suites / preuves principales |
| --- | --- |
| Core : room, Host/Guest, Ready/Start, permissions, reconnect | `integration-test-c11.js`, `tcgate-ui-1.2-room-test.js`, `candidate-15-browser-test.js` |
| Offer/answer/ICE, audio/vidéo et recovery | smokes actuels, `offer-delivery-retry-test.js`, UI/Phone browser et complément C15 avec RTP et nouvelles images après F5 Host/Guest/double |
| TURN config/cache/expiration/renouvellement/relay policy | `turn-cache-test.js`, tests réseau/Phone ; Cloudflare mocké, relay distant non certifié |
| Report V2, privacy, ZIP et transport Resend | `report-schema-v2-test.js`, `report-email-bridge-test.js`, `report-email-browser-test.js` |
| Home/Lobby 1.2, Game Table, logo et responsive | contrats UI 1.2, smokes UI courants, UI browser |
| Site UI 2.0 | `site-ui-2.0-test.js`, `site-ui-2.0-browser-test.js` : Home, navigation, création explicite, erreurs, Host/Guest, Ready, Sans jeu, 1920/1366/900/560/390 et captures de référence |
| Player Locale 1.0 | `player-locale-test.js`, `player-locale-browser-test.js` : déclarations Core, préférence personnelle par TCG, persistance, normalisation, Host/Guest indépendants, absence de partage réseau, mobile et snapshot DB brut inchangé |
| Vision Locale 1.0 | `vision-locale-test.js`, `vision-locale-browser-test.js` : vrai corpus EN 229 via Core, fixture EN/FR isolée et même cardId, caches par jeu/langue/source, remplacement des workers et mémoires, rejets sans fallback, F5, Ready, Sans jeu et absence de partage réseau |
| Cyberpunk Languages Qualification 1.0 | `cyberpunk-languages-qualification-test.js` : snapshots main/développement, images et empreintes réelles, couverture avec dénominateurs officiels, refus des images EN en FR, doublons/orphelins, reçu déterministe, historique EN distinct d'une nouvelle passe physique et FR non activée |
| Timer ON/OFF et synchronisation | Room/UI tests + C15 browser start/pause/reset et temps dérivé côté deux joueurs |
| Gig Dice ON/OFF, gating jeu, hover et zoom | Room/client/UI tests + C15 browser, 12 dés × 5 points × 3 largeurs |
| Sans jeu : pas Vision/Gig, webcam/audio conservés | C15 browser, vrais RTP locaux et frames après Start/F5 |
| Phone : pairing, changement source, PC micro, recovery, diagnostics, privacy et retour webcam | tests Phone actuels, consolidation 1.2C et smoke Chrome avec appareils factices |
| Vision : intégrité, provenance, backpressure et contrats BDD | cinq suites Vision existantes, intégration Cyberpunk publique immuable ; test de performance synthétique historique conservé |
| BDD Locale Core 1.0 | `database-locale-core-test.js`, `database-locale-core-browser-test.js` : identités, readiness explicite, séparation physique des langues, compatibilité du corpus EN et import opt-in sans modifier le matcher |
| Workspace, BDD maintenance et Journal | contrats et quatre suites navigateur Workspace existantes |
| Hygiène projet | `project-hygiene-1.2d-test.js`, aucune réintroduction CC/volume persistant/Phone standalone/runtime SWU |

Le test synthétique de performance historique ne lance pas le futur benchmark de qualité Vision. Aucune nouvelle campagne par carte ou BDD n'est construite dans Candidate 15.

## Qualification humaine et distante

[Checklist Q0–Q16](CANDIDATE_15_BROWSER_CHECKLIST.md), conservée comme reçu historique de la préparation C15. Le workflow local ne remplace ni le relay WAN réel, ni la réception d'un vrai mail, ni les cartes physiques. Phone 1.2C est **PHYSICAL QUALIFICATION PASS** selon déclaration du propriétaire. Avant la promotion C15, le propriétaire a ensuite confirmé Q14 Resend, Q15 TURN relay et Q16 Cyberpunk physique **PASS** ; il ne s'agit pas de résultats produits par ce workflow, ni d'une qualification FR.

Une régression Gig reproduite reste **INTERMÉDIAIRE** avec follow-up séparé ; ne pas corriger le produit pendant la qualification. Baseline Git du Jalon 1 Locale Core : C15 `e26b2e09579be53452c1e631b1dc5230191d0250`, déjà promue sur main. Aucune configuration Railway ni source de déploiement n'est modifiée par ce jalon.

## Suites historiques exclues

Conservées dans Git mais superseded : `integration-test-c10.js`, `smoke-test-ui-v1.js`, `smoke-test-ui-v1-0-1.js`, `smoke-test-ui-v1-0-2.js`, `smoke-test-ui-v1-0-3.js`, `smoke-test-ui-v1-0-4.js`. Elles imposent une ancienne version ou un ancien markup. Les suites C11 adaptées aux contrats actuels restent actives. Aucun forwarder legacy n'est réintroduit pour satisfaire un ancien pipeline.
