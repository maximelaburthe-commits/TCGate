# Vision Qualification 1.0 — Workspace Phase B

## Utilisation depuis le Workspace

Ouvrir `/workspace.html` sur Railway Test, puis **Vision Lab**. Démarrer la
caméra et la détection, inspecter la source Production Cyberpunk EN et démarrer
l'identification. Attendre les **229 références** prêtes. Le matcher du Lab
existant s'active au survol de la zone caméra : conserver le pointeur dans cette
zone pendant la présentation des cartes.

Ouvrir **Qualification Vision 1.0**, lire l'avertissement de rechargement,
confirmer l'utilisation de vraies cartes, puis cliquer **Préparer la
qualification**. Aucune console, commande JavaScript ou copie d'identifiant
n'est nécessaire.

Le panneau lit le SHA réel via `/api/health`, vérifie Cyberpunk EN et charge
`VISION_QUALIFICATION_SAMPLE.json` depuis ce SHA immuable. Aucun fallback vers
une branche ou un ancien SHA. Un protocole absent bloque avec :
« Qualification indisponible : protocole absent pour ce build. »
Le SHA est vérifié une deuxième fois avant l'attachement et avant le rapport
canonique. Une seule session d'observateur peut être attachée à la fois.

Les quinze cartes, leurs métadonnées et toutes les conditions viennent du JSON
versionné. Les identifiants restent dans les diagnostics repliables.

1. Cliquer **Démarrer l'essai**, puis présenter la carte proposée.
2. Observer la fenêtre conseillée de dix secondes et cliquer **Terminer
   l'essai**. Revenir à une scène vide entre les essais.
3. Cliquer **Essai suivant** ; après trois essais, **Carte suivante**.
4. Une fois les 45 essais nominaux enregistrés, choisir les sections
   complémentaires. Chaque sous-échantillon est proposé automatiquement.
5. Terminer l'observation active, puis exporter la session et les rapports.

Un mauvais résultat reste enregistré. **Marquer cet essai invalide** ajoute
une annotation explicite d'erreur opérateur, conserve les observations et le
résultat initial, et exclut cet essai des taux. Un nouvel essai a un nouvel ID.
Le gate historique conserve aussi une réserve en présence d'essais physiques
invalides : une nouvelle tentative ne la lève pas automatiquement et ne permet
pas d'effacer la preuve initiale.
La progression est calculée depuis les essais valides réellement présents,
indépendamment de leur réussite ; elle n'est pas un taux de reconnaissance.

**Je ne possède pas cette carte** propose uniquement les alternatives autorisées
du même profil. La déclaration conserve originalCardId, originalPrintingId,
replacementCardId, replacementPrintingId et PHYSICAL_CARD_UNAVAILABLE. Elle doit
précéder tout essai de la carte concernée. Ne pas remplacer silencieusement une
édition hors corpus. Les sleeves et impressions indisponibles restent NOT TESTED.

## Conditions guidées

| Section | Déroulement |
| --- | --- |
| Nominal | 15 cartes × 3 essais, éclairage et distance ordinaires |
| Angle | Sous-échantillon du JSON, léger puis modéré |
| Faible lumière | Éclairage plus faible mais encore jouable |
| Distance | Plus proche puis plus éloignée |
| Orientation | Légère rotation prévue par le plan |
| Sleeve / reflet | Vraie sleeve disponible, sinon indisponibilité déclarée |
| Stabilité | Maintien dix secondes dès la première détection ; arrêt automatique |
| Retrait | Présenter, attendre l'identification stable, cliquer Retirer la carte, retirer immédiatement, attendre l'état vide, terminer |
| Changement A → B | A reconnue, retrait marqué, état vide observé, bouton Présenter la carte B ; deux essais liés |
| Cartes proches / variantes | Couples et impressions proposés séparément, disponibilité explicite |
| Faux positifs | Table vide, playmat, main visible, paquet/pile, objets de bureau ; cinq scènes de trente secondes avec arrêt automatique |

Si A se termine sans retrait suivi du retour réel à l'état vide, le bouton
**Recommencer A** ajoute une nouvelle présentation avant B. Le premier résultat
reste intact, sans invalidation automatique ; B est lié au nouvel essai de A.

L'UI affiche détection, identification et catégorie de résultat. Une identité
canonique correcte avec art partagé reste **UNRESOLVED_SHARED_ART** :
« Carte correctement reconnue · impression exacte non résolue ». Elle ne devient
pas une mauvaise identification ni une erreur rouge.

## Session, exports et confidentialité

**Ne rechargez pas la page pendant la session.** L'état reste en mémoire ; un
avertissement de fermeture est activé après le début des observations. Aucune
persistance de session n'est annoncée. Exporter avant de fermer ou recharger.

- **Exporter la session** : `vision-qualification-session.json`, observations
  sanitisées et déclarations d'origine conservées.
- **Télécharger le rapport de lecture** :
  `vision-qualification-reading-report.json`.
- **Télécharger vision-qualification-1.0.json** : rapport canonique déterministe,
  produit dans le navigateur par le même module pur que le CLI.

L'import facultatif de sessions/mesures d'index du même SHA les ajoute au rapport
uniquement. Il ne reprend pas une session ni ne modifie sa progression. Les
déclarations incompatibles sont refusées. Préserver tous les fichiers d'origine.
Maximum : vingt fichiers de dix Mo chacun.

Le bouton de mesure d'index relève une initialisation réelle déjà disponible,
une fois ; il ne reconstruit ni ne vide le cache. Trois initialisations froides
distinctes et trois rechargements restent nécessaires au plan complet. Répéter
la lecture d'une même initialisation ne crée pas de nouvelle preuve.

Les exports de qualification n'incluent aucune vidéo, image, capture, audio,
visage, SDP, ICE candidate ou identifiant brut de périphérique. Aucun
MediaRecorder n'est utilisé. L'export de diagnostic historique du Lab, distinct,
peut contenir les captures que l'opérateur y demande explicitement ; ce n'est
pas un export de qualification.

## Générateur partagé et CLI

`public/vision-qualification-report.js` orchestre la validation du plan, du SHA,
du corpus et des entrées, puis appelle le `buildReport` du harness existant.
Le CLI et le Workspace utilisent ce module unique ; classifications, gates,
statistiques et sanitisation ne sont pas réimplémentés. La parité des octets
navigateur/Node est testée. Le CLI conserve en plus les gardes Git, chemins
locaux, fichiers de preuve et reçu automatisé qui lui sont propres.

Le CLI reste disponible pour une utilisation avancée :

```powershell
npm.cmd run qualify:vision -- --input C:\preuves\vision-qualification-session.json --output C:\preuves\vision-qualification-1.0.json --fixture-root C:\audit\cyberpunk-main
```

Il exige un checkout `update/next` propre au même SHA, recharge les références
authentiques et refuse d'écraser une preuve ou d'écrire dans le produit/BDD.
Répéter `--input` ou `--index-input` pour réunir les exports compatibles.
`--template` produit le rapport sans essai physique. Un rapport incomplet reste
PHYSICAL QUALIFICATION PENDING ; l'absence de mesure reste `null`.

## Corpus et gel du moteur

Cyberpunk : clé produit `cyberpunk`, identifiant canonique `cyberpunk-tcg`, EN,
**150 cartes et 229 références**, dont 83 exactes et 146 à art partagé.
BDD immuable : `56402636a77af9c8b5dc4e3b61c509a185f3c834`.
FR reste dataReady=true, visionReady=false, zéro asset et zéro référence Vision.
Une fixture FR ne constitue pas une preuve physique.

Baseline moteur : `7baeb9844ac8a2a68b2c5a38011003514bab5f98`.
`VISION_QUALIFICATION_ENGINE_BASELINE.json` conserve les 228 fichiers originaux
publics/modèles et leurs objets Git authentifiés. Le Jalon 6A.1 autorise seulement
trois exceptions de présentation : workspace.html, workspace.js et workspace.css.
Les **225 autres fichiers originaux restent gelés**. Les modules de qualification
sont distincts ; aucune modification de détection, scoring, seuils, ranking,
matcher, preprocessing, smoothing, backpressure, corpus, cache ou Locale.
Le Workspace charge le pont d'observation déjà existant avant l'identification,
afin de lire les références du worker sans reconstruire l'index.

Branche produit : `update/next`, déploiement automatique Railway Test.
`main` reste `e26b2e09579be53452c1e631b1dc5230191d0250` et Production inchangée.
Le workspace canonique séparé reste
`workspace-state @ 49200683c138fcf4d83a3feec8deb7459b110858`.

## Mesure et qualification physique

T0 précède la présentation ; T1 est la première détection ; T2 confirme une
identité correcte pendant 1 000 ms, sans trou d'observation supérieur à 1 000 ms.
L'observation utilise une cadence de 250 ms complétée par les événements runtime.
Les latences incluent le geste manuel et cette résolution ; aucune précision
supérieure n'est revendiquée. Un changement de locale/corpus, une caméra arrêtée
ou une référence inconnue invalide l'essai.

Chaque essai reçoit une seule catégorie : CORRECT, NO_DETECTION, NOT_IDENTIFIED,
WRONG_IDENTIFICATION, UNSTABLE ou INVALID_TEST. Les invalides sont exclus des taux.
Les scènes négatives ont des durées et dénominateurs distincts. Le rapport sépare
metrics.physical et metrics.automated, ainsi que les latences froides/rechargement.
Statistiques : n, minimum, médiane, maximum ; P95 au rang le plus proche dès vingt
valeurs valides. Les défauts restent classés et liés aux essais d'origine.

Le plan physique complet exige nominal correct ≥95 %, mauvaises identifications
≤1 % et zéro fausse identification sur les cinq scènes. L'objectif dégradé 85 %
reste indicatif. Aucun nouveau seuil du moteur n'est ajouté.

La Phase A a livré le harness et des mesures automatiques d'index réelles.
Le Jalon 6A.1 livre son orchestration Workspace. Les tests navigateur utilisent
des appareils synthétiques, des identités fixtures et une horloge accélérée :
ils restent AUTOMATED et ne certifient pas la reconnaissance de cartes physiques.

**PHYSICAL QUALIFICATION: NOT TESTED.**

**TCGATE VISION QUALIFICATION 1.0 NOT YET QUALIFIED**
