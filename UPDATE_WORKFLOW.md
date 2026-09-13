# Workflow de mise à jour TCGate

## Environnements

- Railway Production déploie `main`.
- Railway Test déploie `update/next`.

## Cycle d'une mise à jour

1. `main` est la baseline stable de production.
2. Après chaque promotion, `update/next` repart du nouveau `main`.
3. Plusieurs fonctionnalités peuvent être développées dans un même cycle Update.
4. Chaque fonctionnalité conserve des commits et des tests clairement identifiables.
5. Railway Test déploie `update/next` pour les validations intermédiaires.
6. Lorsque le lot est prêt, `update/next` est gelée.
7. Une qualification globale est effectuée sur ce SHA gelé.
8. Le SHA qualifié est promu sur `main` sans réécriture de son historique.
9. La release promue reçoit un tag immuable.
10. `update/next` est ensuite réalignée sur le nouveau `main` pour ouvrir le cycle suivant.

## Règles

- Aucun développement direct sur `main`.
- `update/next` est l'unique branche distante normale de développement.
- Un seul environnement Railway Test est associé à `update/next`.
- Les branches `feature/`, `lab/` et `candidate/` ne sont pas multipliées automatiquement.
- Une expérimentation lourde peut être menée localement avec Codex.
- Si une fonctionnalité n'est pas prête, ses commits doivent pouvoir être retirés avant la qualification globale.
- Les bases de cartes conservent un cycle de développement et de promotion séparé.
