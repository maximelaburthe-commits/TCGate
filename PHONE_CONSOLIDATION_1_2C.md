# Phone Camera — consolidation 1.2C

Branche : update/next. Checkpoint de départ : f0816d50baefa90cf543d516cea82ba31c72d21a. La source de vérité produit et de tout développement futur Phone Camera est désormais le dépôt TCGate. Le standalone est une archive de comparaison, sans dépendance runtime ni de développement.

Classification : **LOCAL SOURCE FOUND**. Aucun fallback Railway nécessaire et aucun endpoint Railway interrogé.

Archive d’origine : `C:/Users/maxim/Desktop/TCGate/BACKUPS/TCGate_WORKBENCH_FINAL_2026-09-06/SOURCES_FINAL/phone-camera-lab-0.6.4.1/phone-camera-lab-0.6.4.1-LOCAL.zip`.

SHA-256 : `90d4f138125d7145a1c449c25ebd2080762bbb0bdbde74f4755a051f551ae8bd`.

Archive : 51 entrées, 199158 octets décompressés. Copie d’audit temporaire : `C:/Users/maxim/AppData/Local/Temp/tcgate-phone-lab-0641-audit-1792945908433-l4eit`. Aucun original modifié, aucune variable ou secret Railway lu. Le README et server.js:12 déclarent tous deux la version 0.6.4.1.

## Conclusion de port

Les fonctionnalités réellement absentes du parcours PC intégré sont les commandes/UI **qualité auto/720p30/1080p expérimental, zoom matériel et champ maximum**, pourtant déjà implémentées dans le client téléphone intégré. Le Lab les rend accessibles depuis son PC (public/pc.html:61–98 et pc.js:521–524), mais la plateforme limite actuellement son serveur/API PC à select-camera.

Le port utile est l’exposition de ces fonctions à travers le protocole existant, avec validation plus stricte que le Lab, bornage d’après les capabilities et contrôles absents/masqués quand non supportés. Les handlers déjà présents dans phone-camera-client.js restent propriétaires. Les actions request-state et stop-camera existent réellement dans le Lab et peuvent être reprises si elles servent le panneau PC/qualification. Aucun besoin de porter le pairing, les moteurs WebRTC ou la logique de changement de caméra.

**Aucun focus manuel, one-shot ou focusDistance à porter.** Le Lab 0.6.4.1 ne les possède pas : smoke-test.js:27–28 interdit explicitement les anciennes fonctions setFocusDistanceRemote/focusTable/focusContinuous et l’UI remoteFocus/remoteFocusDistance. Seul l’autofocus natif continu est demandé quand getCapabilities().focusMode contient continuous (phone.js:686–700). Ne pas inventer set-focus dans ce jalon.

## Matrice de parité avant port

Les numéros source Lab renvoient à la copie d’audit ci-dessus ; la colonne intégrée vise le checkpoint f0816d50. La présence de code ne vaut pas qualification sur téléphone physique.

| Fonction | Standalone 0.6.4.1 | TCGate intégré | Meilleure implémentation | Action |
| --- | --- | --- | --- | --- |
| QR | QR SVG de liaison (server:139–149) | QR SVG lié room/peer | Intégré, avec sécurité de session produit | KEEP INTEGRATED |
| Durée du token initial | Session 1 h (server:17) | Pairing 5 min, session téléphone 4 h | Intégré | KEEP INTEGRATED |
| One-time token | Token URL conservé pour toutes les requêtes ; join réutilisable | Token initial consommé une fois, nouveau token téléphone distinct | Intégré | KEEP INTEGRATED |
| Session téléphone / privilèges | Rôles PC/Phone séparés, hors room produit | Token Phone limité aux routes Phone et lié au peer PC | Intégré | KEEP INTEGRATED |
| Recovery PC | Token PC seulement en mémoire JS ; aucun cookie/recover Room | F5/resume et recovery avec rotation bearer et lookup pairing | Intégré | KEEP INTEGRATED |
| Caméra arrière | facingMode environment et détection des labels | Même préférence, helper Devices dédié | Intégré | KEEP INTEGRATED |
| Ultra-wide | Affichée si exposée par enumerateDevices et label reconnu | Même comportement | Intégré | KEEP INTEGRATED |
| Téléobjectif | Affiché si exposé par le navigateur | Même comportement | Intégré | KEEP INTEGRATED |
| Caméra avant fallback | Préservée si aucune caméra non-front disponible | Même règle dans Devices | Intégré | KEEP INTEGRATED |
| Résolution / 720p30 | Auto720, fixe720 et 1080 expérimental pilotables PC | Moteur et handlers présents, UI Phone cachée, pas d’action serveur/API PC | Lab pour l’accessibilité du contrôle | PORT FROM LAB |
| Framerate | Capture ideal/max 30 (phone:392–403) | Même contrat | Intégré | KEEP INTEGRATED |
| Autofocus continu | Seulement si focusMode comprend continuous | Même contrat, fallback natif | Intégré | KEEP INTEGRATED |
| Focus manuel / one-shot | Délibérément supprimé ; interdit par smoke | Absent | Aucun port justifié | OBSOLETE |
| focusDistance | Absent, ancienne logique interdite | Absent | Aucun port justifié | OBSOLETE |
| Fallback autofocus navigateur | Continue même sans capacité ou après refus applyConstraints | Même comportement | Intégré | KEEP INTEGRATED |
| Zoom matériel | Slider PC selon min/max/step, applyConstraints borné | Client Phone déjà prêt, serveur/API/UI PC absents | Lab pour l’accessibilité | PORT FROM LAB |
| Champ maximum | Bouton PC → wide → zoom minimum supporté | Handler setMinimumZoom prêt mais inaccessible depuis PC | Lab pour l’accessibilité | PORT FROM LAB |
| Orientation / paysage | Garde paysage, arrêt lors passage portrait | Même logique | Intégré | KEEP INTEGRATED |
| Guide de cadrage | Indication de paysage et preview réellement reçue sur PC | Preview reçu au PC, indication paysage, aucune preview Phone | Intégré | KEEP INTEGRATED |
| PC changement caméra | switch-camera avec index | select-camera opaque camera-N + vérification du device obtenu | Intégré | KEEP INTEGRATED |
| PC résolution | set-quality auto/1280x720/1920x1080 | Handler présent, serveur/API PC refusent l’action | Lab pour l’exposition | PORT FROM LAB |
| PC zoom | set-zoom et wide | Handlers présents, serveur/API PC refusent | Lab pour l’exposition | PORT FROM LAB |
| PC focus | Aucun contrôle dans 0.6.4.1 | Aucun contrôle | Aucun port justifié | OBSOLETE |
| PC actualisation état | request-state, résultat signalé et fetch état persistant | Snapshot/fetchDiagnostics disponibles ; action inaccessible | API/UX Lab utile si besoin du panneau | MERGE |
| PC arrêt caméra | stop-camera exécuté côté Phone | Handler présent, pas d’accès PC | Peut être exposé par le même protocole | MERGE |
| Offer/answer | WebRTC natif et signalisation dédiée | Moteur produit existant, une seule piste vidéo Phone | Intégré | KEEP INTEGRATED |
| ICE / TURN | ICE / STUN et TURN configuré côté serveur | Même infrastructure produit existante | Intégré | KEEP INTEGRATED |
| Restart et retour réseau | Grace / ICE restart / hard reset dans phone.js:1039–1115 | Même logique enrichie de recovery produit | Intégré | KEEP INTEGRATED |
| Changement caméra bloqué | Stop ancienne piste, acquisition puis rollback (phone:556–591) | Helper runCameraSwitch + timeout et vérification target | Intégré | KEEP INTEGRATED |
| Timeout / piste tardive | Pas de délai d’acquisition ni arrêt ciblé d’une piste tardive dans le switch Lab | acquireWithTimeout, rejet explicite et stopAcquired tardif | Intégré | KEEP INTEGRATED |
| Rollback caméra | Tentative de réacquisition de l’ancienne caméra | Rollback borné et résultat explicite rollbackRestored | Intégré | KEEP INTEGRATED |
| Fermeture piste | Stop caméra et replaceTrack(null) | Même cycle, micro PC conservé | Intégré | KEEP INTEGRATED |
| FPS / bitrate / codec | Stats Phone et PC, affichage PC lisible | Stats Phone et diagnostic structuré | Intégré pour le moteur ; affichage PC optionnel | KEEP INTEGRATED |
| Encode time / résolution réelle | Métadonnées et historique Phone | Même télémétrie et collecteur partagé | Intégré | KEEP INTEGRATED |
| ICE route / relay | Configuration TURN exposée au rapport ; pas de route générique détaillée | Diagnostics.collect retourne types de candidats/protocoles/usingRelay, sans adresse | Intégré | KEEP INTEGRATED |
| RTT / jitter | PC stats:464–472 | Sender/receiver metrics existantes | Intégré | KEEP INTEGRATED |
| Dropped frames / decode / jitter buffer | Pas de collecteur PC équivalent complet | Collecteur Diagnostics autorisé par champs | Intégré | KEEP INTEGRATED |
| Batterie | navigator.getBattery facultatif, historique, consommation | Même code déjà présent | Intégré | KEEP INTEGRATED |
| Température / proxy thermique | Coût encodeur, CPU, FPS, ressenti manuel ; pas de température matérielle inventée | Même code, hotfix encodeCostDriftPct déjà repris | Intégré | KEEP INTEGRATED |
| Énergie / écran | Batterie optionnelle, wake lock, recommandation luminosité manuelle | Même code | Intégré | KEEP INTEGRATED |
| Diagnostic Phone récupérable PC | phone-state/phone-report persistés en mémoire ; export JSON PC et Phone | state/report en mémoire et fetchDiagnostics dans rapport produit | Intégré ; UI téléchargement facultative | KEEP INTEGRATED |
| deviceId / labels | Les ID sont supprimés des settings mais les labels bruts sont affichés dans Lab | Alias camera-N et labels génériques intégrés | Intégré | KEEP INTEGRATED |
| SDP / candidates / tokens / IP dans diagnostics | State/report Lab persistés bruts (server:188–223), sécurité inférieure | Sanitizer serveur et collecteur générique ; renforcer les chemins contrôlés si tests révèlent un écart | Intégré | KEEP INTEGRATED |
| Images / screenshots / frames | Flux WebRTC seul, aucune route upload ou MediaRecorder | Même contrat | Intégré | KEEP INTEGRATED |
| Chrome Android | Cible du plan manuel ; aucun résultat physique fourni dans archive | Cible du produit ; reste à qualifier physiquement | Aucun diagnostic de qualification automatique | UNKNOWN |
| Écran allumé | WakeLock optionnel avec reprise visibilitychange | Même logique | Intégré | KEEP INTEGRATED |
| Boutons Phone simples | Démarrer puis details Diagnostic, réglages techniques cachés | Même interface minimale et logo produit | Intégré | KEEP INTEGRATED |
| Diagnostic secondaire | details avec transmission rapport, stop et ressenti thermique | Même structure | Intégré | KEEP INTEGRATED |

## Phone Lab intégré

Recommandation : **NOT NEEDED**, à condition que l’exposition utile des contrôles et diagnostics soit réalisée dans le propriétaire Phone produit existant. Le standalone n’apporte ni second moteur utile, ni métrique de qualification absente : énergie et thermique sont déjà intégrées, le collecteur ICE/receiver produit est plus complet, et le rapport produit récupère l’état/rapport téléphone. Un nouveau cockpit Workspace dupliquerait surtout l’habillage PC du Lab. Ne pas ajouter une vue pour la seule présence historique du standalone.

La source Lab garde une valeur d’archive et de preuve de comparaison. Le service Railway reste nécessaire jusqu’à validation physique et ne doit pas être décommissionné automatiquement.

## Tests locaux de la source

Dans la copie TEMP uniquement : node smoke-test.js → SMOKE_OK_TCGATE_PHONE_CAMERA_LAB_V0.6.4.1 ; node test-v0641.js → TEST_OK_TCGATE_PHONE_CAMERA_LAB_V0.6.4.1_THERMAL ; node test-v0641-server.js → TEST_OK_TCGATE_PHONE_CAMERA_LAB_V0.6.4.1. Les trois exécutions sont réussies. La dernière lance uniquement un serveur HTTP loopback, avec les variables TURN explicitement vides dans le test.

Limites : aucune caméra physique, aucun autofocus/zoom matériel réel, aucune session Chrome Android, aucun passage Wi-Fi/4G, aucune endurance ou chauffe matérielle n’ont été qualifiés. La source prouve les fonctions implémentées, pas leur fiabilité physique sur tous appareils.

## Consolidation réalisée

Phone Camera engine → TCGate repository. Phone Lab → NOT NEEDED. Les propriétaires restent phone.html, phone-camera-client.js, phone-camera.js, phone-camera-control.js, phone-camera-devices.js et phone-camera-diagnostics.js, avec les routes Phone du serveur principal. Le helper partagé phone-camera-privacy.js protège les diagnostics ; phone-camera-settings.js et sa feuille limitée au panneau Phone présentent les contrôles existants. Aucun second serveur, pairing, moteur ou API n’est ajouté. Le Workspace reste inchangé.

La matrice ci-dessus compare explicitement l’état de départ au Lab. Les actions PORT FROM LAB et MERGE sont maintenant réalisées : les handlers Phone existants sont exposés par le propriétaire PC et son panneau repliable. Le PC peut demander l’état, sélectionner une caméra opaque, choisir auto/720p30/1080p expérimental, régler le zoom matériel, demander le champ maximum et arrêter la caméra. Le panneau présente résolution réelle, FPS, débit, codec, route ICE/relay, RTT, batterie optionnelle et proxy thermique, et exporte un diagnostic JSON nettoyé. Il ne réalise aucun fetch direct : il passe uniquement par le propriétaire Phone.

Le serveur et le client partagent un validateur de six actions explicites : request-state, select-camera, set-quality, wide, set-zoom, stop-camera. Payload et arguments ont des clés exactes, un requestId borné, des profils énumérés et des nombres finis. Zoom : limites globales 0–100, plage et pas de la capacité annoncée, revérification sur la piste réelle côté téléphone. Les profils manuels ne sont proposés ni acceptés sans plages width/height/frameRate confirmant leur résolution et 30 fps ; auto reste le fallback. Aucun objet MediaTrackConstraints arbitraire, index caméra brut ou contrôle de focus manuel n’est transmis. Le seul identifiant caméra public reste camera-N.

Le client refuse les commandes de capture pendant un changement en cours. Champ maximum utilise le chemin zoom avec erreur explicite : un applyConstraints refusé ne produit plus un faux succès. Une erreur de qualité restaure le profil précédent quand la piste le permet et rapporte rollbackRestored. Le contrôle non numérique du zoom est rejeté avant applyConstraints.

La sanitation commune est appliquée aux state/report stockés en mémoire, aux messages control-state/control-result, aux événements et exports Phone/PC et aux chaînes libres du collecteur. Elle retire secrets, identifiants bruts, adresses, médias et données SDP/candidates, y compris les chaînes de messages contenant des IP ou du SDP échappé. Elle ne s’applique pas aux messages WebRTC offer/answer/candidate : ces données de signalisation restent nécessaires sur les routes authentifiées des deux participants de la liaison. Aucun upload média, enregistrement ou stockage serveur de flux n’est introduit.

Les tests ont identifié une limite du deuxième périphérique factice Chrome : après remplacement de piste, l’encodage se fige aussi dans une boucle WebRTC native sans TCGate, tandis que la capture locale fonctionne. Le smoke utilise donc les périphériques factices 1 et 3 et exige de nouvelles images réellement présentées, après changement et après chaque reprise. Avec ce matériel simulé valide, la base intégrée reprend déjà la vidéo après F5 et recovery cookie avec rotation du bearer : aucun changement des moteurs recovery/ICE/WebRTC n’est réalisé. Les correctifs Phone associés au smoke gardent le bouton de retour à la webcam accessible après l’arrêt, conservent la webcam PC choisie lors de la reprise du micro seul, et rétablissent les sélecteurs PC après récupération. Les reprises SSE/WebRTC, le pairing et la rotation du bearer restent dans leurs propriétaires d’origine.

## Qualification et protections

Le téléphone reste vidéo uniquement, avec audio:false ; le micro vient du PC. La page /phone garde Démarrer la caméra, État et Diagnostic secondaire, sans cockpit mobile ajouté. Autofocus continu demandé uniquement si supporté ; aucune température matérielle, aucun objectif ultra-wide/télé non exposé par le navigateur, ni aucune capacité absente ne sont inventés. 1080p demeure expérimental et conserve son repli existant vers 720p.

**Chrome Android physique non qualifié.** Ni Safari iOS physique, ni autofocus/zoom matériel, Wi-Fi/4G/5G, verrouillage, endurance, batterie ou chauffe réelle ne sont qualifiés par la simulation. La checklist [PHONE_PHYSICAL_QUALIFICATION_1_2C.md](PHONE_PHYSICAL_QUALIFICATION_1_2C.md) reste entièrement à remplir par des tests réels.

Le logo, Home et section Game UI 1.2, Ready, Timer, Gig Dice, Report Schema, Vision, BDD et état canonique Workspace ne sont pas modifiés. Le Lobby reçoit uniquement le panneau Phone normal. Les références main, Candidate 14 et workspace-state sont protégées. Le projet Railway TCGate-camera-phone et son service/domaine/variables restent intacts ; aucun outil Railway n’est utilisé.

Verdict de décommissionnement visé après validation : STANDALONE PHONE LAB CAN BE DECOMMISSIONED AFTER PHYSICAL TEST. Ce verdict ne constitue ni une qualification physique ni une suppression du service ; la décision et l’opération de décommissionnement restent séparées.

Les résultats exacts des suites et commandes sont consignés dans PHONE_CONSOLIDATION_1_2C_VALIDATION.txt.

## Résultats finaux

33 suites plateforme réussies, dont 220 assertions de consolidation et 73 assertions du smoke navigateur. Trois suites historiques de l’archive passent également, séparément. `npm run check` : code 0, 86 fichiers JavaScript ; `git diff --check` : code 0. Les sections screenHome et screenGame, le markup mobile et le contrôleur findCurrent/restoreCurrent sont comparés au checkpoint et conservés. Le smoke exige de nouvelles images, conserve le micro PC et ne recharge pas le téléphone pendant les reprises.

Verdict technique : TCGATE PHONE CONSOLIDATION 1.2C READY FOR RAILWAY TEST. Chrome Android physique non qualifié.
