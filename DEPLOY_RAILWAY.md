# DÉPLOIEMENT RAILWAY — TCG Webcam V0.5.1

Cette version remplace la V0.5 Quick Tunnel.

## 1. GitHub

Créer un dépôt, par exemple `tcg-webcam-test`, puis déposer **tout le contenu de ce dossier à la racine** :

- `server.js`
- `package.json`
- `railway.json`
- `public/`
- les autres fichiers du projet

Éviter de placer tout le projet dans un sous-dossier, sauf si un Root Directory est ensuite configuré dans Railway.

## 2. Railway

Dans Railway :

1. **New Project**
2. **Deploy from GitHub repo**
3. sélectionner le dépôt
4. attendre le build et le déploiement

Aucune variable d'environnement n'est nécessaire pour V0.5.1. Railway fournit automatiquement `PORT`.

Le fichier `railway.json` configure :

- start : `npm start`
- healthcheck : `/api/health`
- redémarrage : `ON_FAILURE`

## 3. Générer le domaine HTTPS

Dans le service Railway :

**Settings → Networking → Public Networking → Generate Domain**

Railway fournit une adresse HTTPS du type :

`https://nom-production-xxxx.up.railway.app`

Les deux joueurs doivent utiliser **exactement ce même domaine**.

## 4. Vérification rapide

Ouvrir :

`https://VOTRE-DOMAINE.up.railway.app/api/health`

Résultat attendu notamment :

```json
{
  "ok": true,
  "version": "0.5.1"
}
```

## 5. Test A — deux PC sur la même box

PC A :
- ouvrir le domaine Railway ;
- créer la partie ;
- activer caméra + micro.

PC B :
- ouvrir le même domaine ;
- rejoindre avec le code ;
- activer caméra + micro.

Puis :
- prêt des deux côtés ;
- vidéo + audio bidirectionnels ;
- caméra/micro ON/OFF ;
- plein écran adverse ;
- carte HD simulée ;
- absence de scroll desktop ;
- 5 à 10 minutes de fonctionnement ;
- générer un rapport complet sur chaque PC.

## 6. Test B — simulation de deux domiciles

Après validation du Test A :

- PC A reste sur la box/Wi-Fi ;
- PC B passe sur un partage 4G/5G ;
- refaire une nouvelle partie 5 à 10 minutes ;
- générer les deux rapports complets.

C'est le test principal pour ICE/NAT et le futur besoin de TURN.

## Important

Toujours non intégrés :
- Vision alpha15 ;
- calibration ;
- identification réelle ;
- TURN de production.

La V0.4.2 reste la baseline réseau locale stable.
