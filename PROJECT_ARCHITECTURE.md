# TCGate — architecture courante et décision langues

État du 1er novembre 2026, préparation Candidate 15. Branche de travail : `update/next`. Privacy Report V2 et purge TURN sont réconciliées ; Vision, BDD et configuration Railway restent conservées.

## Dépôts et exécution

| Dépôt | Rôle courant |
| --- | --- |
| `maximelaburthe-commits/TCGate` | Produit, Report Schema V2, transport Resend, Phone Camera intégré, Workspace et Vision Lab isolé |
| `maximelaburthe-commits/tcgate_db_cyberpunk` | BDD active du projet ; seule BDD actuellement configurée dans le runtime produit |
| `maximelaburthe-commits/tcgate_db_star_wars_unlimited` | BDD active du programme de développement ; source et qualification à préparer, aucune activation produit |
| `maximelaburthe-commits/tcgate_db_riftbound` | **ARCHIVE CANDIDATE** tant qu'aucune reprise produit n'est décidée ; aucun archivage ni suppression effectué |

La configuration produit `public/game-databases.js` fixe Cyberpunk 1.1.0 à `56402636a77af9c8b5dc4e3b61c509a185f3c834`, scope `cyberpunk-beta-2026`, statut `candidate-qualified` : 150 cartes canoniques, 229 printings, 150 groupes et 229 références matcher. Le navigateur lit directement ces ressources publiques immuables. La Candidate Cyberpunk 1.2.0 et SWU suivies dans le Workspace ne sont pas des BDD actives en partie.

Dans `TCGate_platform`, Production utilise encore `candidate/alpha-0.1-c14` ; Test utilise `update/next`. La politique cible est **Production → main / Test → update/next**. Le réalignement Production est une dette bloquante de promotion Candidate 15, pas une opération de préparation. Voir [le workflow](UPDATE_WORKFLOW.md) et [le pre-flight](CANDIDATE_15_PRE_FLIGHT.md).

Le runtime démarre par `npm start` → `report-mail-server.js` → `server.js`. Les rapports passent par Resend ; aucune inbox ni forwarder Control Center n'est nécessaire dans cette branche. Le serveur ne fait que lire les assets livrés et le modèle ONNX ; aucun volume persistant n'est requis par ce code. Le constat ne s'applique pas automatiquement au code C14 encore en Production. [Inventaire et conditions de retrait](PROJECT_DECOMMISSION_1_2D.md).

Phone Camera intégré est la source de vérité. `TCGate-camera-phone` / `TCGate-Phone-Camera-Lab` : **Legacy standalone — superseded by integrated Phone Camera 1.2C**.

**Decommission condition: physical Chrome Android qualification PASS**. Condition satisfaite : **Phone Camera integrated: QUALIFIED** ; **PHYSICAL QUALIFICATION PASS** déclaré par le propriétaire dans la demande Candidate 15. Le [reçu physique](PHONE_PHYSICAL_QUALIFICATION_1_2C.md) conserve cette attribution sans inventer de campagne Codex. **Standalone Phone Lab: DECOMMISSIONABLE** ; **TCGate-camera-phone SAFE TO DELETE**. Aucun projet supprimé.

## Décision structurante : langues physiques des BDD

Décision enregistrée pour le chantier **post-Candidate 15**, sans implémentation ni migration dans Maintenance 1.2D.

Chaque BDD TCG devra déclarer ses langues physiques disponibles. Le modèle conceptuel est :

```text
TCG
→ card canonical identity
→ printing
→ locale
→ Vision index par locale
```

Le TCG est commun à la room. Chaque joueur choisira personnellement la langue de ses cartes physiques dans **Mon installation** :

```text
Host = Cyberpunk / FR
Guest = Cyberpunk / EN
```

Les deux joueurs partagent le même `cardId` canonique, avec des printings et corpus Vision correspondant à leur langue physique. La sélection de langue est personnelle ; elle ne crée pas deux TCG différents dans la room.

Règle de chargement Vision future :

```text
selected locale
→ load only that locale's qualified Vision references
```

**Aucun fallback visuel EN lorsque FR est sélectionné.** Une langue ne sera proposée pour Vision que si `visionReady = true`. Une couverture de métadonnées ou des assets d'affichage ne constituent pas à eux seuls une qualification Vision.

Le texte « fallback FR → EN » du checkpoint Candidate Cyberpunk connu décrit un état historique de données ; il ne définit pas cette future politique Vision. Aucun sélecteur, filtre de corpus, champ runtime, reconstruction de BDD ou changement Vision n'est introduit ici.

## Workspace

`workspace-state` conserve uniquement l'état canonique du Workspace. Aucun merge vers `main` et aucune connexion Railway. Le runtime produit et son JSON de pilotage gardent leurs cycles séparés. La [fiche historique de transfert 1.2D](PROJECT_DECOMMISSION_1_2D.md#transfert-vers-la-prochaine-mise-à-jour-workspace) prépare la prochaine mise à jour séparée ; une mise à jour séparée de cette branche est explicitement autorisée pour Candidate 15, sans mélange des fichiers produit.
