# Qualification Alpha courante — Candidate 15

Un seul workflow de qualification complète :

```text
npm run qualify:alpha
```

Il exécute 63 suites distinctes, dont dix-sept suites navigateur, puis le contrôle syntaxique correspondant à `npm run check` et `git diff --check HEAD^ HEAD`. Les 48 suites du Jalon 6 Phase A sont conservées ; le Jalon 6A.1 ajoute le contrat du générateur partagé et du runtime guidé, puis le parcours navigateur du Workspace, sans modifier le moteur. Le Jalon 6B ajoute les contrats de neutralité, de gate nominal et de diagnostics scalaires, ainsi que le parcours console sur cinq formats. Le Jalon 6C conserve les 54 suites antérieures et ajoute cinq suites : regroupement canonique, contrats de source exacts, contrôleur de track, intégration native et parcours visuel Lab. Le correctif 6C.1 ajoute la sémantique de succès nominal confirmé, avec comparaison intégrale des neuf autres conditions au harness ce5be2a. Le Jalon 6C.2 ajoute trois suites : provenance reproductible du reçu nominal, rapport composé sans duplication et persistance du déblocage navigateur avec invalidation stricte. Cyberpunk Languages Qualification exige toujours les deux snapshots réels indiqués par `TCGATE_CYBERPUNK_MAIN_ROOT` et `TCGATE_CYBERPUNK_DEVELOP_ROOT`, et ne remplace jamais une passe physique. Après retrait des patches exacts autorisés 6B/6C, les empreintes de 79 fonctions d'identification et des constantes correspondent à la baseline pré-Jalon-4. Les 47 fonctions Table State, le détecteur et le modèle restent inchangés. Le worker est comparé intégralement après retrait des seuls patches 6C autorisés. Aucune suite navigateur n'est facultative. Aucun package npm runtime externe n'est déclaré ; le workflow C14 historique appelant le forwarder retiré n'est pas restauré.

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
| Vision Qualification 1.0 Phase A | `vision-qualification-1.0-test.js`, `vision-qualification-1.0-browser-test.js` : classifications, taux, confidentialité, locale et observation du runtime existant, trois initialisations froides et trois F5 ; aucune preuve physique déduite |
| Workspace Vision Qualification UX | `workspace-vision-qualification-test.js`, `workspace-vision-qualification-browser-test.js` : préparation au SHA réel, vrai corpus EN 229, 45 essais guidés, substitutions, annotations, conditions, timers, exports sanitisés et parité du rapport canonique CLI/navigateur ; observations fixtures exclusivement AUTOMATED |
| Vision 6B nominal | `vision-qualification-neutral-test.js`, `vision-nominal-6b-test.js`, `vision-nominal-diagnostics-test.js`, `workspace-vision-nominal-browser-test.js` : A → vide → B, expiration réelle de mémoire, événements anciens séparés, classement/score/marge/rejets/stabilité sans média, gate physique et console sans défilements répétés sur cinq formats ; aucune réussite physique déduite |
| Vision 6C | `vision-canonical-6c-test.js`, `vision-6c-production-contract-test.js`, `vision-qualification-track-test.js`, `vision-qualification-stable-6c-test.js`, `workspace-vision-lab-6c-browser-test.js` : marge par cardId, replays scalaires réels, décisions natives fraîches, garde du track, pertes réelles et cinq captures revues ; aucune réussite physique déduite |
| Timer ON/OFF et synchronisation | Room/UI tests + C15 browser start/pause/reset et temps dérivé côté deux joueurs |
| Gig Dice ON/OFF, gating jeu, hover et zoom | Room/client/UI tests + C15 browser, 12 dés × 5 points × 3 largeurs |
| Sans jeu : pas Vision/Gig, webcam/audio conservés | C15 browser, vrais RTP locaux et frames après Start/F5 |
| Phone : pairing, changement source, PC micro, recovery, diagnostics, privacy et retour webcam | tests Phone actuels, consolidation 1.2C et smoke Chrome avec appareils factices |
| Vision : intégrité, provenance, backpressure et contrats BDD | cinq suites Vision existantes, intégration Cyberpunk publique immuable ; test de performance synthétique historique conservé |
| BDD Locale Core 1.0 | `database-locale-core-test.js`, `database-locale-core-browser-test.js` : identités, readiness explicite, séparation physique des langues, compatibilité du corpus EN et import opt-in sans modifier le matcher |
| Workspace, BDD maintenance et Journal | contrats et quatre suites navigateur Workspace existantes |
| Hygiène projet | `project-hygiene-1.2d-test.js`, aucune réintroduction CC/volume persistant/Phone standalone/runtime SWU |

Le test synthétique de performance historique reste distinct de Vision Qualification. Le Jalon 6 Phase A prépare le protocole par carte et mesure des initialisations automatiques réelles ; la baseline physique FAIL du premier passage est conservée ; la campagne 6B reste FAIL (45 valides, correct 0, wrong 0) ; la campagne nominale physique ce5be2a, recalculée par la sémantique 6C.1, est PASS (43/45, 95,5556 %, wrong 0). Le reçu versionné 6C.2 conserve ce PASS uniquement pour le moteur/corpus attesté ; les conditions physiques complémentaires restent PENDING. Le workflow produit aussi `vision-qualification-1.0.json` au SHA exact, hors dépôt, avec PHYSICAL QUALIFICATION PENDING. Le benchmark n'enregistre aucun média ; les captures historiques des autres suites concernent leurs fixtures automatisées.

## Qualification humaine et distante

[Checklist Q0–Q16](CANDIDATE_15_BROWSER_CHECKLIST.md), conservée comme reçu historique de la préparation C15. Le workflow local ne remplace ni le relay WAN réel, ni la réception d'un vrai mail, ni les cartes physiques. Phone 1.2C est **PHYSICAL QUALIFICATION PASS** selon déclaration du propriétaire. Avant la promotion C15, le propriétaire a ensuite confirmé Q14 Resend, Q15 TURN relay et Q16 Cyberpunk physique **PASS** ; il ne s'agit pas de résultats produits par ce workflow, ni d'une qualification FR.

Une régression Gig reproduite reste **INTERMÉDIAIRE** avec follow-up séparé ; ne pas corriger le produit pendant la qualification. Baseline Git du Jalon 1 Locale Core : C15 `e26b2e09579be53452c1e631b1dc5230191d0250`, déjà promue sur main. Aucune configuration Railway ni source de déploiement n'est modifiée par ce jalon.

## Suites historiques exclues

Conservées dans Git mais superseded : `integration-test-c10.js`, `smoke-test-ui-v1.js`, `smoke-test-ui-v1-0-1.js`, `smoke-test-ui-v1-0-2.js`, `smoke-test-ui-v1-0-3.js`, `smoke-test-ui-v1-0-4.js`. Elles imposent une ancienne version ou un ancien markup. Les suites C11 adaptées aux contrats actuels restent actives. Aucun forwarder legacy n'est réintroduit pour satisfaire un ancien pipeline.
