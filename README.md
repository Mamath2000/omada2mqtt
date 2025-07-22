
# omada2mqtt

## Présentation

Ce projet permet de faire le pont entre un contrôleur TP-Link Omada et un broker MQTT. Il gère l'authentification OAuth2, le renouvellement automatique du token, et expose les informations Omada sur MQTT.

## Processus de connexion Omada

1. **Authentification initiale** :
   - Appel à `/openapi/authorize/token?grant_type=client_credentials` avec un body JSON contenant :
     - `omadacId`
     - `client_id`
     - `client_secret`
   - Récupération d'un `accessToken` et d'un `refreshToken`.
2. **Renouvellement du token** :
   - Appel à `/openapi/authorize/token?client_id=...&client_secret=...&refresh_token=...&grant_type=refresh_token` (tous les paramètres dans l'URL, body vide).
   - Récupération d'un nouveau `accessToken` et `refreshToken`.
3. **Récupération des sites** :
   - Appel à `/openapi/v1/{omadac_id}/sites?pageSize=100&page=1` avec le header `Authorization: AccessToken=...`.

## Paramètres de configuration (`src/config.js`)

```js
module.exports = {
  omada: {
    baseUrl: 'https://<IP_DU_CONTROLEUR>:8043',
    client_id: '<VOTRE_CLIENT_ID>',
    client_secret: '<VOTRE_CLIENT_SECRET>',
    omadac_id: '<VOTRE_OMADAC_ID>',
    site: '<NOM_DU_SITE_OMADA>'
  },
  mqtt: {
    url: 'mqtt://<IP_DU_BROKER>',
    username: '<UTILISATEUR_MQTT>',
    password: '<MOT_DE_PASSE_MQTT>',
    baseTopic: 'omada2mqtt'
  }
};
```

**Détail des paramètres :**

- `baseUrl` : URL du contrôleur Omada (ex : `https://192.168.0.192:8043`)
- `client_id` : ID client Omada (OAuth2)
- `client_secret` : Secret client Omada (OAuth2)
- `omadac_id` : ID de l'instance Omada
- `site` : Nom du site à utiliser (ex : "Default" ou autre)
- `url` : URL du broker MQTT (ex : `mqtt://192.168.100.9`)
- `username` / `password` : Identifiants MQTT (laisser vide si non utilisé)
- `baseTopic` : Topic racine pour les échanges MQTT

## Fonctionnement

1. Le programme se connecte à Omada, récupère et renouvelle automatiquement le token.
2. Il se connecte au broker MQTT et s'abonne aux topics nécessaires.
3. Il publie ou traite les messages MQTT selon la logique métier (contrôle PoE, etc.).

## Lancement

```bash
make install   # Installe les dépendances
make run       # Démarre l'application
```

## Dépendances principales

- `axios` : pour les requêtes HTTP vers l'API Omada
- `mqtt` : pour la communication MQTT
