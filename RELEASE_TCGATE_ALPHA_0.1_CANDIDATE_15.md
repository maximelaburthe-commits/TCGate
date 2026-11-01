# TCGate — Alpha 0.1 Candidate 15 · UI 1.2.0

Préparation du 1er novembre 2026 sur `update/next`, départ `30e553f2c287101b162a995abf368ad9c4ac22de`, propre après fetch. Candidate 15 réconcilie les seuls changements utiles de C14, gèle les fonctions et prépare une qualification complète. Aucune nouvelle fonction produit ni promotion vers `main`.

## Réconciliation C14

Commit examiné : `c4adb95bacfe137d9f3f07cae0d3540e1aabf5c3`, `release: prepare TCGate Alpha 0.1 Candidate 14`. Chaque différence est comparée à la branche courante ; aucun merge ou cherry-pick global.

| Change | Status | Action |
| --- | --- | --- |
| `ALPHA_QUALIFICATION.md`, ancien `qualify:alpha` | PORT MANUALLY | Un seul workflow reconstruit pour la Candidate courante : 37 suites distinctes, navigateur obligatoire, SHA propre gelé, preuves hors dépôt |
| README C14 | ALREADY SUPERSEDED | Conserver le README UI 1.2 / Resend / Phone ; actualiser seulement l'identité et l'état Candidate 15 |
| `RELEASE_TCGATE_ALPHA_0.1_CANDIDATE_14.md` | HISTORICAL ONLY | Conserver dans l'historique et la branche C14 ; créer cette note C15 |
| Versions C14 de `package.json` / `package-lock.json` | ALREADY SUPERSEDED | Utiliser une identité cohérente C15 ; conserver tous les scripts et fonctions actuels |
| Version C14 de `public/app.js` | ALREADY SUPERSEDED | Modifier seulement `PRODUCT_VERSION` en Candidate 15, UI 1.2.0 conservée |
| Sanitation de `public/report-diagnostics-v2.js` | STILL REQUIRED → PORT MANUALLY | Porter les garanties C14 et couvrir JSON/SDP échappé, IDs device/group/ICE, URLs sensibles et variantes IP ; garder collecteurs, enveloppe et limites |
| Cas adversariaux `report-schema-v2-test.js` | PORT MANUALLY | Conserver les 16 cas C14, ajouter 20 cas ; témoin négatif sur baseline et suite corrigée |
| Purge du cache TURN dans `server.js` | STILL REQUIRED → PORT MANUALLY | Helper C14, purge au sweep existant et retrait des clés des pairs lors d'expiration d'une room ; reste du serveur récent préservé |
| `turn-cache-test.js` | PORT MANUALLY | Couverture étendue sur source serveur complète : expiration, seuil cinq minutes, renouvellement, erreurs fournisseur, isolation Phone et policies all/relay |
| Anciennes commandes forwarder du pipeline C14 | HISTORICAL ONLY | Ne pas réintroduire le runtime ou la suite du forwarder supprimé ; le contrôle d'hygiène reste obligatoire |

Les tests anciens C10 / anciens markups UI restent conservés comme historique mais exclus de la qualification courante. Les suites portant un nom historique C11 restent actives lorsqu'elles vérifient les contrats actuels et l'identité cohérente de la Candidate.

## Périmètre figé

Conservés : UI 1.2 (Home cinq pages, Lobby trois onglets, Ready visible), Room/Host/Guest/Start, Timer, Gig Dice option room, WebRTC/recovery, Phone 1.2C intégré, Report Schema V2/ZIP/Resend, Vision et BDD actives. Le code `public/app.js` ne reçoit que la nouvelle chaîne de version. Aucun code Control Center, route legacy, inbox disque ou variable retirée n'est restauré.

Privacy Report V2 conserve les collecteurs et diagnostics récents, avec des garanties au moins équivalentes à C14. Le sanitizer Phone reste indépendant et inchangé. Le cache TURN ne renvoie pas d'anciens credentials après un échec de renouvellement ; les tests vérifient les limites exactes de validité et la purge périodique.

Gig Dice : le complément navigateur mesure les douze dés au centre et sur quatre bords intérieurs, sur trois largeurs (180 sondes), puis le centrage et l'agrandissement. Aucun correctif Gig n'est improvisé. Si une campagne reproduit encore le problème historique, le classer **INTERMÉDIAIRE** et ouvrir un follow-up séparé. Les résultats sont liés au SHA dans le reçu de qualification.

## Infrastructure actuelle

Inventaire Railway en lecture seule et confirmations du propriétaire ; aucune valeur de secret lue, aucune mutation, suppression ou promotion effectuée par Codex.

| Ressource | État Candidate 15 |
| --- | --- |
| Production `TCGate_platform / TCGate` | Source toujours `candidate/alpha-0.1-c14`, dernier déploiement Production inchangé ; volume `/data` encore monté |
| Test `TCGate_platform / TCGate` | Source `update/next`, redéploiement observé SUCCESS après détachement du volume au SHA de préparation `30e553f…` déclaré par le propriétaire ; aucun montage `/data` |
| Test persistent volume | **NOT REQUIRED**. Le volume existe encore détaché en Test ; aucune suppression de données |
| `TCGate-report-schema-v2` | Service supprimé, absence confirmée dans l'inventaire du projet |
| `report-schema-v2-qualification` | Aucun service, volume ou bucket : **SAFE TO DELETE ENVIRONMENT** |
| Phone Camera integrated | **QUALIFIED — PHYSICAL QUALIFICATION PASS**, déclaration explicite du propriétaire pour Phone 1.2C ; matériel non retesté par Codex |
| Standalone Phone Lab | **DECOMMISSIONABLE** ; `TCGate-camera-phone` **SAFE TO DELETE**. Projet/service encore présents, aucune suppression ici |
| Control Center | Hors runtime produit. Infrastructure conservée jusqu'après promotion C15 ; données historiques intactes jusqu'à décision explicite |

La cible de promotion reste **Production → main / Test → update/next**. Dette bloquante de promotion : **Production source must be realigned to main during Candidate 15 promotion.** Le PASS du workflow local ne change pas la source Production.

## BDD et Workspace

Cyberpunk 1.1.0 reste actif à SHA immuable `56402636a77af9c8b5dc4e3b61c509a185f3c834` : 150 cartes, 229 printings et références, 150 groupes. SWU reste en développement, inactif produit. Riftbound : **ARCHIVE CANDIDATE**. Aucune BDD reconstruite, aucun moteur Vision changé.

L'état canonique est mis à jour **dans un commit séparé sur `workspace-state`**, sans fichiers produit, merge ou déploiement de cette branche. Il doit référencer le SHA final qualifié de `update/next`, les états réels UI/Phone/infrastructure/BDD et les follow-ups. Historiques, Vision Lab `0.5.1-r14.1 / R14.1 ERA`, campagnes et synchronisation canonique restent conservés.

Décision post-Candidate 15 conservée : `TCG → cardId canonique → printing → locale → Vision index par locale`. Chaque joueur choisira sa langue physique dans Mon installation (Host Cyberpunk/FR, Guest Cyberpunk/EN). Chargement limité à la locale sélectionnée avec `visionReady = true`, **aucun fallback visuel inter-langue**. Fonction non implémentée dans C15.

## Qualification et suites

Commande unique : `npm run qualify:alpha`. [Protocole et couverture](ALPHA_QUALIFICATION.md), [checklist Q0–Q16](CANDIDATE_15_BROWSER_CHECKLIST.md), [reçu versionné](CANDIDATE_15_VALIDATION.txt). Le workflow refuse un arbre sale, fige le SHA et manifeste les empreintes des tests ; ses journaux et captures sont écrits hors dépôt.

Les médias simulés vérifient de vrais échanges locaux WebRTC/SSE, pas un relay WAN ni des appareils physiques. Le ZIP arrive au mock Resend ; la livraison réelle reste distincte. Phone physique : **PASS déclaré par le propriétaire**. Vision physique Q16 : **NOT TESTED**, réponse explicite du propriétaire ; à qualifier sur quelques cartes, sans benchmark. Le futur chantier Vision Qualification 1.0 reste séparé.

Le gel technique est suivi d'un reçu documentaire séparé. Après ce reçu, le workflow est réexécuté sur le SHA final exact ; le reçu externe `qualification.json` porte ce SHA sans créer de référence circulaire dans le commit. Le rapport final fournit ce SHA et le chemin des preuves. Aucune nouvelle branche Candidate distante ni tag créé.
