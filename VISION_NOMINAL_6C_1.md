# Vision 6C.1 ? s?mantique du nominal

Baseline : `update/next @ ce5be2ad9aeaa27df4c217dec99df7f6c7e47c94`.

Seul le classement des essais NOMINAL change. Une fen?tre canonique correcte de 1000 ms, sans aucune mauvaise carte ni impression d?finitive erron?e, conserve CORRECT apr?s une disparition ult?rieure. Les erreurs de validit? restent prioritaires. Le T2 est recalcul? depuis les observations, jamais accept? depuis un champ import?.

Les mesures restent enti?res : disparitions, changements, mauvaises identit?s, mauvaises impressions, observations et latences. STABILITY, REMOVAL, RAPID_SWITCH et toutes les autres conditions conservent exactement leurs r?gles ant?rieures. Le moteur, le matcher, les seuils, le tracking, le runtime, les diagnostics, le protocole et le corpus restent inchang?s.

## Session physique immuable

La session demand?e sous le nom `vision-qualification-session(2).json` est localement enregistr?e sans suffixe, dans `C:/Users/maxim/Documents/TCGate/vision-qualification-session.json`. Son SHA produit, ses 45 essais et les deux jobs concern?s correspondent ? la demande.

- Session : SHA-256 `a6e7c29bf123ffcf8cae0e421f7fdf67d119c53eede4c170125944c7044078a4`, 18 290 805 octets.
- Rapports de lecture et canonique originaux : SHA-256 `6813e4dee09635fa0c428615dc7216107767345ce2bfb206b90f98ce5ac83307`, chacun 20 971 170 octets.
- Trois exports copi?s octet pour octet sous `Vision-Qualification-Archives/nominal-ce5be2a-original`, sans remplacer les deux campagnes FAIL ant?rieures.

Le CLI de baseline a reproduit le rapport original ? l?octet avant toute modification. Le nouveau rapport utilise le m?me g?n?rateur canonique partag?, avec le harness corrig?. Son `productSha` demeure ce5be2a, le produit r?ellement test? physiquement ; le SHA du code de reporting est trac? s?par?ment dans le re?u comparatif. Aucun nouvel essai physique.

## Recalcul d?terministe

| Mesure | Rapport original | Rapport 6C.1 |
| --- | ---: | ---: |
| Valides | 45 | 45 |
| CORRECT | 41 | 43 |
| NOT_IDENTIFIED | 2 | 2 |
| UNSTABLE | 2 | 0 |
| WRONG_IDENTIFICATION | 0 | 0 |
| Taux correct | 91,1111 % | 95,5556 % |

Deux essais changent uniquement `category` et `correct` :

- Mantis Blades, job 0 : T2 122854 ms, perte du track 131046 ms, fin 133296 ms ; deux disparitions conserv?es.
- Misty Olszewski, job 23 : T2 966764 ms, perte 976767 ms, fin 978675 ms ; une disparition conserv?e.

Les 43 autres essais sont identiques. Les ?checs Alt Cunningham, jobs 30 et 31, restent NOT_IDENTIFIED. Les deux gates nominaux passent : correct ?95 % et wrong ?1 %. Les compteurs, seuils, coverage 15 cartes ?3 et conditions manquantes ne sont pas assouplis. La qualification compl?te reste NOT YET QUALIFIED ; seul le nominal est PASS.

## R?gressions

`npm run test:vision-nominal-semantics` v?rifie le retrait apr?s T2, le retrait avant T2, les mauvaises cartes et impressions apr?s T2, les preuves invalides et l?art partag?. Il compare int?gralement 117 sc?narios des neuf conditions non nominales au v?ritable harness ce5be2a. Les vecteurs sont AUTOMATED, ne cr?ent aucun export physique et ne d?verrouillent pas le gate physique.

Le test historique 6C conserve les empreintes des 91 essais ant?rieurs et de leurs rapports. Sous la nouvelle r?gle g?n?rale NOMINAL, les diff?rences de classification sont v?rifi?es explicitement (+4 et +24 CORRECT), sans r??crire ces anciens rapports FAIL. Les tests de continuit? r?elle restent en STABILITY. La nouvelle suite est enregistr?e dans le workflow complet, d?sormais 60 suites dont 16 navigateur.

Apr?s PASS nominal, la qualification physique peut poursuivre angles, distance, low light, sleeve/glare, orientation, stabilit?, retrait, rapid switch, similar printings et faux positifs. Aucun de ces sc?narios n?est qualifi? par le seul recalcul nominal.
