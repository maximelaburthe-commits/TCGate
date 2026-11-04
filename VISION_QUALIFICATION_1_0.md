# Vision Qualification 1.0 — Workspace 6C.2

## Utilisation depuis le Workspace

Ouvrir `/workspace.html` sur Railway Test, puis **Vision Lab**. Démarrer la
caméra et la détection, inspecter la source Production Cyberpunk EN et démarrer
l'identification. Attendre les **229 références** prêtes. Le matcher du Lab
normal reste piloté par le survol. Pendant la qualification, le premier track
unique est suivi automatiquement pendant l'essai, sans maintien du curseur.

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
3. Attendre la remise à zéro confirmée de Vision, puis cliquer **Essai suivant** ;
   après trois essais, **Carte suivante**. La mémoire du moteur expire naturellement.
4. Le nominal physique officiel est qualifié : **43 / 45, soit 95,5556 %, et
   zéro mauvaise identification**. Quand le reçu versionné est compatible avec
   le moteur et le corpus actifs, les conditions complémentaires sont débloquées
   et la nouvelle session commence sur Angle. Aucun import, DevTools ou nouveau
   passage des 45 essais n'est nécessaire. Un reçu absent ou incompatible garde
   ces conditions bloquées, sauf si la session courante satisfait elle-même le gate.
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

## Reçu nominal officiel et conditions complémentaires

**VISION NOMINAL QUALIFICATION: PASS**

- 45 valid physical trials ;
- 43 correct ;
- 95.5556 % ;
- 0 wrong identification.

**Complementary physical qualification: PENDING**

`VISION_NOMINAL_QUALIFICATION_RECEIPT.json` est généré depuis la session physique
`ce5be2ad9aeaa27df4c217dec99df7f6c7e47c94` et le rapport canonique recalculé sous
la sémantique `f6225e1d64b4fce633e5353afb9f716ece1c00eb`. Les SHA-256 source sont :

- session : `a6e7c29bf123ffcf8cae0e421f7fdf67d119c53eede4c170125944c7044078a4` ;
- rapport recalculé : `cc0994cdb6bf0e2b240ae5c146097309527d340a6bdf5fce71e9f3032d676fc8`.

Les deux échecs Alt Cunningham restent NOT_IDENTIFIED. Les deux anciennes
campagnes FAIL et les trois exports originaux ce5be2a restent intacts.
Le reçu ne prétend pas que les essais ont été rejoués sur le build actuel.

À chaque préparation, le Workspace télécharge le reçu uniquement depuis le SHA
réel renvoyé par `/api/health` :
`https://raw.githubusercontent.com/maximelaburthe-commits/TCGate/<buildSha>/VISION_NOMINAL_QUALIFICATION_RECEIPT.json`.
Aucun fallback sur une branche. Il compare le reçu aux empreintes des fichiers
réellement déployés, fournies par le GET en lecture seule
`/api/vision-qualification-compatibility`, puis aux 229 références actives et
au protocole de ce build. Le modèle ONNX n'est pas retéléchargé pour ce contrôle.

Les fichiers complets pertinents du moteur, matcher, seuils, preprocessing,
détecteur, tracking et adaptateurs de corpus sont empreintés ; le modèle l'est
comme binaire. Les 24 entrées attestent 23 fichiers complets, dont le loader
Workspace, et le contrat précis de routage/lecture du modèle dans `server.js`
(scope `MODEL_SERVING_V1`). Modifier le modèle servi ou ses scripts de chargement
invalide aussi la preuve. Le harness est lié à la sémantique qualifiée 6C.1. Un changement
de moteur, corpus, BDD, langue, nombre de références ou identités qualifiées
invalide le reçu. Les modifications séparées d'UI, documentation ou reporting
peuvent conserver la preuve si les empreintes restent compatibles.

Deux gates restent distincts : `sessionNominalGate` décrit seulement la session
courante ; `qualifiedNominalGate` décrit la preuve officielle validée.
Les sections sont disponibles si l'un des deux est ready. L'UI affiche
« Nominal physique qualifié », les taux, la source et
« Conditions complémentaires débloquées ». Une nouvelle page/recharge
revalide automatiquement cette preuve, sans reconstituer les 45 essais.

Les essais complémentaires restent de vraies nouvelles observations dans une
nouvelle session. Le rapport canonique peut réunir cette session avec
`nominalEvidence.source = QUALIFICATION_RECEIPT` : il conserve produit, session,
rapport et sémantique d'origine. Les 45 résumés historiques restent dans cette
preuve séparée, jamais dans `report.trials` ni les compteurs de la nouvelle
session. Les autres conditions, impressions, faux positifs et mesures d'index
restent à observer ; le PASS nominal ne certifie pas le plan complet.
Une nouvelle erreur nominale ne disparaît pas derrière le reçu historique.

Reproduire le reçu, sans écraser de preuve :

```powershell
node generate-vision-nominal-qualification-receipt.js --session C:\preuves\vision-qualification-session.json --report C:\preuves\vision-qualification-1.0-recalculated-6c1-final.json --output C:\preuves\VISION_NOMINAL_QUALIFICATION_RECEIPT.json
```

Le générateur vérifie les octets source, rejoue le rapport canonique, compare
les fichiers qualifiés ce5be2a → f6225e1 → courant et le seul patch de sémantique
autorisé. Aucun chiffre de qualification n'est créé sans ces preuves.

Pour composer le rapport CLI d'une nouvelle session complémentaire, ajouter :

```powershell
--qualified-nominal-receipt .\VISION_NOMINAL_QUALIFICATION_RECEIPT.json
```

Cette option valide le reçu contre les fichiers du checkout et le corpus actif.
Sans option, le générateur historique conserve exactement son format antérieur.

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
Maximum : vingt fichiers de 32 Mio chacun.

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
Le Jalon 6C conserve **223 fichiers originaux strictement gelés**. Les changements
autorisés de regroupement canonique et de qualification contrôlée sont vérifiés
par patches exacts ; après leur retrait, les deux moteurs et les anciennes
empreintes sont identiques aux baselines. Aucun seuil ou descripteur ne change.
Les modules de qualification sont distincts. Seuls le regroupement canonique
et le suivi contrôlé décrit dans Vision 6C changent ; détection, seuils,
preprocessing, backpressure, corpus, cache et décisions FR restent conservés. Les diagnostics ne contiennent que des valeurs scalaires,
les candidats existants et les états runtime disponibles, sans média.
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

Le premier passage physique de Vision Qualification 1.0 est conservé comme
baseline nominale FAIL : 45 essais, 43 valides, 11 corrects et 7 comportant une
mauvaise identité. Voir [Vision 6B](VISION_NOMINAL_6B.md) pour les empreintes,
le diagnostic et la comparaison. Les trois exports d'origine restent intacts.

La campagne physique 6B est conservée : 46 essais enregistrés, 45 valides,
1 invalide, 0 correct, 19 NOT_IDENTIFIED, 26 UNSTABLE, wrong 0. Voir
[Vision 6C](VISION_CANONICAL_6C.md) pour les deux campagnes et la mesure actuelle.

**VISION NOMINAL QUALIFICATION: PASS — 43 / 45, 95.5556 %, 0 wrong.**

**Complementary physical qualification: PENDING.**

**TCGATE VISION QUALIFICATION 1.0 NOT YET QUALIFIED**
