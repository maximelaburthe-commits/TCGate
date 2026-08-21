# Déploiement Railway — TCGate Alpha 0.1 Candidate 7

## 1. Dépôt GitHub

Déposer tout le contenu de l'archive Candidate 7 à la racine du dépôt Railway :

- `server.js`
- `package.json`
- `railway.json`
- `public/`
- `models/`
- les fichiers de documentation/tests

Ne pas imbriquer le projet dans un sous-dossier sauf si le **Root Directory** Railway est configuré en conséquence.

## 2. Railway

1. Ouvrir le service TCGate existant.
2. Déployer le commit contenant Candidate 7.
3. Attendre la fin du build puis du healthcheck `/api/health`.
4. Ne lancer les tests qu'une fois le nouveau déploiement marqué actif/successful.

Railway fournit automatiquement `PORT` ; aucune variable spécifique n'est requise par cette Candidate pour le fonctionnement de base.

## 3. Vérification du healthcheck

Ouvrir :

`https://VOTRE-DOMAINE/api/health`

Le JSON doit notamment contenir :

```json
{
  "ok": true,
  "version": "tcgate-alpha-0.1-candidate-7"
}
```

Le bloc `vision` doit également signaler que le modèle est présent.

## 4. Test distant

Les deux joueurs utilisent exactement le même domaine HTTPS Railway.

- créer puis rejoindre une salle ;
- activer caméra et micro ;
- vérifier vidéo/audio dans les deux sens ;
- effectuer le test EMEET décrit dans `PLAN_TEST_ALPHA_0.1_CANDIDATE_5.md` ;
- générer un rapport complet sur les deux PC en fin de test.

## 5. En cas de déploiement bloqué

Si Railway reste longtemps sur le healthcheck :

- consulter **View logs** ;
- vérifier que le serveur affiche `TCGate Alpha 0.1 Candidate 7` ;
- vérifier l'absence de boucle de redémarrage ;
- tester `/api/health` lorsque le domaine est accessible ;
- ne pas interpréter un incident Railway comme un résultat du test WebRTC/Vision.
