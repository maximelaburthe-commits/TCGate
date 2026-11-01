# TCGate Maintenance 1.2D - inventaire legacy fige

Baseline auditee : `e1455cbff845baf90e3fb8a027b5f59c33d571cf`.

Audit local en lecture seule du depot. Artefact initialement prepare dans TEMP puis versionne dans le jalon 1.2D ; aucune collecte de variable, secret ou infrastructure. Les nouveaux documents 1.2D sont exclus car la recherche vise explicitement le commit baseline.

## Commande executee

```text
git grep -n -i -E "Control Center|control-center|CONTROL_CENTER|TCGATE_CC|REPORT_INBOX|Phone Camera Lab|TCGate-camera-phone|TCGate-Phone-Camera-Lab|report-schema-v2-qualification|/data|Candidate 14" e1455cbff845baf90e3fb8a027b5f59c33d571cf --
```

Code de sortie : 0. Total : **39 lignes texte + 1 signal binaire = 40 sorties**.

## Repartition des 39 lignes texte

- documentation historique : 24
- documentation devenue fausse : 1
- test historique : 11
- runtime encore necessaire : 3
- reference supprimable : 0

La classe test historique inclut les gardes de non-regression actuelles visant les anciens noms. Leur utilite actuelle est indiquee individuellement.

## Inventaire exhaustif des lignes texte

### 1. CHANGELOG_TCGATE_ALPHA_0.1_CANDIDATE_10.md:6

Classe : **documentation historique**.

Mention Phone Lab dans un ancien jalon ; ajouter au besoin le marquage Legacy standalone, sans effacer l historique.

```text
Aucun changement du modèle Vision, Detection Worker, Vision Core, Identification, Table State, ni du Phone Camera Lab.
```

### 2. CHANGELOG_TCGATE_ALPHA_0.1_CANDIDATE_11.md:49

Classe : **documentation historique**.

Mention Phone Lab dans un ancien jalon ; ajouter au besoin le marquage Legacy standalone, sans effacer l historique.

```text
- Phone Camera Lab ;
```

### 3. CHANGELOG_TCGATE_ALPHA_0.1_CANDIDATE_11_UI_1.0.4.md:40

Classe : **documentation historique**.

Mention Phone Lab dans un ancien jalon ; ajouter au besoin le marquage Legacy standalone, sans effacer l historique.

```text
- Phone Camera Lab ;
```

### 4. CHANGELOG_TCGATE_ALPHA_HOME_UI_1.0.6.md:9

Classe : **documentation historique**.

Conserver le contexte du jalon ; aucune dependance runtime.

```text
- Aucune modification WebRTC, Vision, Control Center, lobby, game UI, Gig Dice ou rapports.
```

### 5. PHONE_CAMERA_ALPHA_INTEGRATION.md:4

Classe : **documentation historique**.

Integration initiale explicitement historique ; moteur integre deja declare source de verite.

```text
Référence historique de l’intégration initiale : TCGate Phone Camera Lab V0.6.4.1. Depuis Maintenance 1.2C, le moteur intégré au dépôt TCGate est la source de vérité produit et de développement ; voir PHONE_CONSOLIDATION_1_2C.md.
```

### 6. PHONE_CONSOLIDATION_1_2C.md:108

Classe : **documentation historique**.

Protection des branches et projet Phone au jalon 1.2C ; ni lien ni dependance runtime standalone.

```text
Le logo, Home et section Game UI 1.2, Ready, Timer, Gig Dice, Report Schema, Vision, BDD et état canonique Workspace ne sont pas modifiés. Le Lobby reçoit uniquement le panneau Phone normal. Les références main, Candidate 14 et workspace-state sont protégées. Le projet Railway TCGate-camera-phone et son service/domaine/variables restent intacts ; aucun outil Railway n’est utilisé.
```

### 7. PROJECT_CLEANUP_1_2A.md:5

Classe : **documentation historique**.

Historique du retrait 1.2A ; conserver, lier au bilan courant 1.2D.

```text
## Retrait du Control Center
```

### 8. PROJECT_CLEANUP_1_2A.md:7

Classe : **documentation historique**.

Historique du retrait 1.2A ; conserver, lier au bilan courant 1.2D.

```text
Le runtime ne dépend plus du Control Center historique : suppression du forwarder, de l’inbox privée sur disque, de son token, de ses routes HTTP et de ses variables. Le bridge n’intercepte plus aucune ancienne route `/api/control-center/*` ; elles suivent le serveur TCGate normal et retournent 404, sans redirection.
```

### 9. PROJECT_CLEANUP_1_2A.md:11

Classe : **documentation historique**.

Historique du retrait 1.2A ; conserver, lier au bilan courant 1.2D.

```text
- `control-center-forwarder.js` : dépendance de forwarding retirée ;
```

### 10. PROJECT_CLEANUP_1_2A.md:12

Classe : **documentation historique**.

Historique du retrait 1.2A ; conserver, lier au bilan courant 1.2D.

```text
- `control-center-forwarder-test.js` : suite exclusivement liée à cette fonction retirée.
```

### 11. PROJECT_CLEANUP_1_2A.md:14

Classe : **documentation historique**.

Historique du retrait 1.2A ; conserver, lier au bilan courant 1.2D.

```text
Script npm supprimé : `test:control-center-forwarder`. Nouveaux scripts : `test:project-cleanup` et `test:report-email-browser`. Aucun autre script historique applicable n’est supprimé.
```

### 12. PROJECT_CLEANUP_1_2A.md:28

Classe : **documentation historique**.

Historique du retrait 1.2A ; conserver, lier au bilan courant 1.2D.

```text
README présente désormais Report Schema V2 + envoi e-mail des rapports Alpha. RAILWAY_REPORT_EMAIL_SETUP.md décrit uniquement le bridge actuel et les trois variables mail nécessaires. Les notes Candidate 13, le changelog Home 1.0.6 et le journal UI 1.2 sont explicitement marqués comme archives pour conserver le contexte historique de qualification, sans consigne active de déploiement Control Center.
```

### 13. PROJECT_CLEANUP_1_2A.md:30

Classe : **documentation historique**.

Explique l artefact BDD distant a nom historique ; conserver cette distinction.

```text
Une chaîne de nom similaire est conservée dans `public/workspace-database-maintenance-model.js:7` : `data/control-center-update-candidate.json`. Il s’agit d’un artefact BDD externe lu sur GitHub à un SHA fixé, avec credentials omis, et non d’un appel au service Control Center. Sa fixture dans workspace-maintenance-journal-browser-test.js conserve ce contrat. La supprimer casserait la maintenance BDD ; ce jalon n’autorise pas cette modification.
```

### 14. PROJECT_CLEANUP_1_2A.md:34

Classe : **documentation historique**.

Historique du retrait 1.2A ; conserver, lier au bilan courant 1.2D.

```text
Aucune suppression hors Control Center. Recherches effectuées sur les fichiers suivis avec git grep/rg, références HTML/CSS/JS, imports/requires, scripts npm, noms d’assets et hash de contenu. Aucun temporaire suivi de type tmp/bak/old/orig/rej, doublon exact d’asset hors BDD, ou JS public sans référence runtime/test/documentation n’a été identifié par cet audit. Les références dynamiques empêchent de conclure qu’une simple absence d’import rend un fichier inutile.
```

### 15. PROJECT_CLEANUP_1_2A.md:52

Classe : **documentation historique**.

Historique de l audit /data et ressources non modifiees ; le verdict actuel appartient au bilan 1.2D.

```text
**VOLUME /data : probablement orphelin**, selon le code de cette branche après retrait de l’inbox. Aucun usage restant du montage absolu /data ni d’une variable de volume n’a été trouvé dans le runtime. Les lectures de server.js:13–14/592 concernent public/ et models/ à côté du code ; rooms, sessions, Phone et cache TURN sont en mémoire. Le chemin relatif distant data/control-center-update-candidate.json n’utilise pas le volume.
```

### 16. PROJECT_CLEANUP_1_2A.md:54

Classe : **documentation historique**.

Historique de l audit /data et ressources non modifiees ; le verdict actuel appartient au bilan 1.2D.

```text
Cette conclusion ne vérifie ni les fichiers historiques présents ni les usages hors dépôt. Le volume tcgate-volume, son contenu, toutes les variables et tous les services Railway restent intacts. Le projet séparé TCGate_Control_Center n’est ni modifié ni supprimé.
```

### 17. PROJECT_CLEANUP_1_2A.md:56

Classe : **documentation devenue fausse**.

Phrase Production/main ambiguement actuelle ; Production reste C14 selon demande 1.2D. Conserver preuve historique et ajouter renvoi etat courant.

```text
Après un déploiement et une validation réussis sur Railway Test, les quatre anciennes variables suivantes ne sont plus utilisées par ce code et pourront être retirées manuellement de Test : CONTROL_CENTER_URL, CONTROL_CENTER_INGEST_KEY, TCGATE_CC_SYNC_TOKEN, TCGATE_REPORT_INBOX_DIR. Aucune n’est retirée ici. Production reste hors périmètre tant que main utilise l’ancien code. RESEND_API_KEY, TCGATE_REPORT_TO_EMAIL, TCGATE_REPORT_FROM_EMAIL et les variables TURN sont conservées ; aucune valeur n’est reproduite.
```

### 18. PROJECT_CLEANUP_1_2A_VALIDATION.txt:190

Classe : **documentation historique**.

Conserver le contexte du jalon ; aucune dependance runtime.

```text
VOLUME /data : probablement orphelin selon le code ; aucune opération sur Railway ni le volume.
```

### 19. RELEASE_TCGATE_ALPHA_0.1_CANDIDATE_13.md:3

Classe : **documentation historique**.

Conserver le contexte du jalon ; aucune dependance runtime.

```text
> Archive historique du jalon Candidate 13 : les mentions Control Center ci-dessous décrivent son ancien contexte de qualification. Depuis Maintenance 1.2A, le parcours actuel est Report Schema V2 + e-mail Resend ; consulter RAILWAY_REPORT_EMAIL_SETUP.md.
```

### 20. RELEASE_TCGATE_ALPHA_0.1_CANDIDATE_13.md:5

Classe : **documentation historique**.

Conserver le contexte du jalon ; aucune dependance runtime.

```text
Candidate coordonnée avec TCGate Control Center `0.3.1-rc.1` pour qualifier Report Schema V2.
```

### 21. RELEASE_TCGATE_ALPHA_0.1_CANDIDATE_13.md:16

Classe : **documentation historique**.

Conserver le contexte du jalon ; aucune dependance runtime.

```text
- prise en charge des exports et de Report Intelligence par le Control Center ;
```

### 22. UI_1_2_HOME_LOBBY.md:28

Classe : **documentation historique**.

Conserver le contexte du jalon ; aucune dependance runtime.

```text
Les moteurs WebRTC, TURN, recovery, Vision, identification, Table State, Phone Camera, BDD et reports ne sont pas modifiés. Les changements dans app.js et server.js concernent l’adoption et l’accès au module Gig Dice, plus le libellé UI frontend. Aucun changement de configuration Railway, de main, de Candidate 14 ou de workspace-state.
```

### 23. UI_1_2_VALIDATION.txt:163

Classe : **test historique**.

Trace authentique de suite forwarding executee avant retrait ; journal deja marque archive ; conserver sans reexecution de suite supprimee.

```text
COMMAND node control-center-forwarder-test.js
```

### 24. UI_1_2_VALIDATION.txt:165

Classe : **test historique**.

Trace authentique de suite forwarding executee avant retrait ; journal deja marque archive ; conserver sans reexecution de suite supprimee.

```text
CONTROL_CENTER_FORWARDER_OK
```

### 25. WORKSPACE_CAMERA_FLOW_VALIDATION.txt:5

Classe : **documentation historique**.

Conserver le contexte du jalon ; aucune dependance runtime.

```text
Candidate 14 : c4adb95bacfe137d9f3f07cae0d3540e1aabf5c3
```

### 26. WORKSPACE_COCKPIT_UI_VALIDATION.txt:6

Classe : **documentation historique**.

Conserver le contexte du jalon ; aucune dependance runtime.

```text
Candidate 14 : c4adb95bacfe137d9f3f07cae0d3540e1aabf5c3
```

### 27. WORKSPACE_VISION_LAB_VALIDATION.txt:6

Classe : **documentation historique**.

Conserver le contexte du jalon ; aucune dependance runtime.

```text
Candidate 14 : c4adb95bacfe137d9f3f07cae0d3540e1aabf5c3
```

### 28. cyberpunk-db-integration-test.js:8

Classe : **test historique**.

Faux positif /data dans chemin ./public/database-source.js importe par test BDD/Workspace ; aucun montage ni acces persistant /data.

```text
const databaseSource=require('./public/database-source.js');
```

### 29. cyberpunk-db-integration-test.js:106

Classe : **test historique**.

Faux positif /data dans chemin ./public/database-source.js importe par test BDD/Workspace ; aucun montage ni acces persistant /data.

```text
  const allSource=['server.js','public/app.js','public/database-source.js','public/game-databases.js','public/identification.js','DEPLOY_RAILWAY.md'].map(file=>fs.readFileSync(path.join(__dirname,file),'utf8')).join('\n');
```

### 30. phone-consolidation-1.2c-test.js:243

Classe : **test historique**.

Garde de non-regression actuelle : refuse dependance du produit au domaine Phone standalone ; conserver.

```text
    check(!owners.includes('tcgate-phone-camera-lab-production.up.railway.app'),'Product Phone has no dependency on the standalone deployment');
```

### 31. public/app.js:676

Classe : **runtime encore necessaire**.

Faux positif /data : ressource URL /database-source.js et scripts database ; aucun acces filesystem /data.

```text
  '/database-source.js',
```

### 32. public/workspace-database-maintenance-model.js:7

Classe : **runtime encore necessaire**.

Chemin relatif data/control-center-update-candidate.json d un document BDD GitHub lu au SHA immuable ; aucun appel service Control Center ni montage /data.

```text
  const PATHS=Object.freeze({manifest:'manifest.json',databaseManifest:'db-manifest.json',candidateReport:'data/control-center-update-candidate.json',syncReport:'staging/latest/sync_report.json',coverage:'data/coverage.json',multilingualCoverage:'data/multilingual-coverage.json'});
```

### 33. public/workspace.html:22

Classe : **runtime encore necessaire**.

Faux positif /data : ressource URL /database-source.js et scripts database ; aucun acces filesystem /data.

```text
<script src="/game-databases.js"></script><script src="/database-source.js"></script><script src="/workspace-databases.js"></script><script src="/workspace-lab-provider.js"></script><script src="/workspace-camera-status.js"></script><script src="/workspace-cockpit-model.js"></script><script src="/workspace-journal-model.js"></script><script src="/workspace-journal.js"></script><script src="/workspace-database-maintenance-model.js"></script><script src="/workspace-database-maintenance.js"></script><script src="/workspace-cockpit.js"></script><script src="/workspace.js"></script><script src="/workspace-candidate-lab.js"></script></body></html>
```

### 34. report-email-bridge-test.js:12

Classe : **test historique**.

Garde de non-regression actuelle : constate disparition forwarder/script/variables/routes CC ; conserver.

```text
  for(const file of ['control-center-forwarder.js','control-center-forwarder-test.js'])check(!fs.existsSync(path.join(root,file)),file+' removed');
```

### 35. report-email-bridge-test.js:13

Classe : **test historique**.

Garde de non-regression actuelle : constate disparition forwarder/script/variables/routes CC ; conserver.

```text
  const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));check(!Object.hasOwn(pkg.scripts,'test:control-center-forwarder'),'Obsolete npm command removed');
```

### 36. report-email-bridge-test.js:14

Classe : **test historique**.

Garde de non-regression actuelle : constate disparition forwarder/script/variables/routes CC ; conserver.

```text
  const forbidden=['CONTROL_CENTER_URL','CONTROL_CENTER_INGEST_KEY','TCGATE_CC_SYNC_TOKEN','TCGATE_REPORT_INBOX_DIR','/api/control-center/','control-center-forwarder'];
```

### 37. report-email-bridge-test.js:29

Classe : **test historique**.

Garde de non-regression actuelle : constate disparition forwarder/script/variables/routes CC ; conserver.

```text
    for(const route of ['/api/control-center/status','/api/control-center/reports','/api/control-center/reports/'+'a'.repeat(40),'/api/control-center/unknown']){response=await fetch(fixture.origin+route);equal(response.status,404,route+' falls through to normal TCGate 404');const text=await response.text();check(!/inboxConfigured|controlCenterConfigured|"reports"/.test(text));}
```

### 38. workspace-maintenance-journal-browser-test.js:23

Classe : **test historique**.

Fixture necessaire du rapport BDD a nom historique, sans infrastructure CC ; conserver.

```text
  docs['data/control-center-update-candidate.json']={sourceSnapshot:{snapshotDate:'2026-10-24',capturedAt:'2026-10-24T08:15:00Z',canonicalCards:151,expectedOfficialPrintings:700,officialSite:'https://example.invalid/official-source'},sourceStatus:{authority:'Source officielle témoin',assetRightsReviewRequired:true},updateSummary:{newCards:['new-card-a','new-card-b'],newPrintings:['new-print-a','new-print-b','new-print-c'],newLocales:['fr'],newAssets:['new-en.png','new-fr.png'],changedAssets:['changed-en.png'],missingAssets:['missing-fr-art'],missingMetadata:['missing-fr-flavour']},localizationCoverage};
```

### 39. workspace-test.js:3

Classe : **test historique**.

Faux positif /data dans chemin ./public/database-source.js importe par test BDD/Workspace ; aucun montage ni acces persistant /data.

```text
const provider=require('./public/workspace-lab-provider.js'),source=require('./public/database-source.js'),registry=require('./public/game-databases.js'),dbs=require('./public/workspace-databases.js'),{fixture}=require('./workspace-lab-fixture.js');
```

## Signal binaire distinct

```text
Binary file e1455cbff845baf90e3fb8a027b5f59c33d571cf:models/card_detector_v53_512.onnx matches
```

Classe : **runtime encore necessaire - faux positif binaire sans instruction filesystem**.

Termes effectivement detectes dans les octets du modele suivi : `/data`. Ce signal binaire ne contient aucun numero de ligne texte ; il est donc comptabilise separement. Il ne correspond pas a une instruction filesystem du runtime Node. Le modele Vision reste integralement intact.

## Corrections documentaires hors de la regex

- `UPDATE_WORKFLOW.md:5` : Production deploie main est formule comme etat courant. Distinguer Production actuellement sur candidate/alpha-0.1-c14 et cible main lors de Candidate 15. `UPDATE_WORKFLOW.md:10` doit aussi distinguer baseline Git stable et branche effectivement deployee.
- `DEPLOY_RAILWAY.md:1/14` : procedure generique nommant Candidate 11 et health c11. Marquer comme historique et lier les consignes courantes/preflight. Conserver les principes TURN utiles.
- `README.md:34/38` et documentation Phone : ajouter les formulations explicites Legacy standalone - superseded by integrated Phone Camera 1.2C et Decommission condition: physical Chrome Android qualification PASS.

## Absences et protections

- Aucun resultat pour report-schema-v2-qualification ; aucun resultat pour TCGate-report-schema-v2 lors de la recherche complementaire. Aucune URL/script/procedure actuelle ne depend de ce service.
- Aucun runtime Control Center, forwarder, inbox disque ou lecture des quatre variables retirees trouve. Les noms subsistent dans documentation et gardes negatives.
- Report Schema V2, Resend, Phone integre restent presents dans leurs proprietaires et tests actuels.
- Qualification physique Phone reste pending dans PHONE_PHYSICAL_QUALIFICATION_1_2C.md:3/5/56 et PHONE_CONSOLIDATION_1_2C.md:80/106/110. Ne pas transformer les simulations en PASS.

Aucun fichier du depot modifie ou supprime par cet audit.
