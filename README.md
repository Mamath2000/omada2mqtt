
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


## Paramètres de configuration (`config.conf`)

La configuration de l'application se fait désormais dans le fichier `config.conf` à la racine du projet.

Exemple de contenu :

```ini
[omada]
baseUrl = https://<IP_DU_CONTROLEUR>:8043
client_id = <VOTRE_CLIENT_ID>
client_secret = <VOTRE_CLIENT_SECRET>
omadac_id = <VOTRE_OMADAC_ID>
site = <NOM_DU_SITE_OMADA>

[mqtt]
url = mqtt://<IP_DU_BROKER>
username = <UTILISATEUR_MQTT>
password = <MOT_DE_PASSE_MQTT>
baseTopic = omada2mqtt

[log]
level = info # Log level: debug, info, warn, error
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
3. Il publie les informations des devices et des ports PoE sur MQTT.
4. Il configure automatiquement Home Assistant via MQTT Discovery.

### Publication des informations devices

Pour chaque device détecté (switch, AP, gateway), le programme publie :

- **Topic principal** : `<baseTopic>/<type>/<nom_device>`
- **Payload** : Objet JSON complet avec toutes les informations du device
- **Fréquence** : Toutes les 60 secondes

### Publication des ports PoE

Pour chaque switch détecté, le programme publie l'état de chaque port individuellement :

- **Topics par port** :
  - `<baseTopic>/switch/<nom_switch>/ports/port<numero>/name` : Nom du port
  - `<baseTopic>/switch/<nom_switch>/ports/port<numero>/isPOE` : Si le port supporte PoE
  - `<baseTopic>/switch/<nom_switch>/ports/port<numero>/profileName` : Nom du profil
  - `<baseTopic>/switch/<nom_switch>/ports/port<numero>/profileOverrideEnable` : Override activé
  - `<baseTopic>/switch/<nom_switch>/ports/port<numero>/poeState` : État PoE (1=on, 0=off)

- **Fréquence** : Toutes les 5 secondes

### Contrôle des ports PoE

Le programme permet de contrôler l'état PoE des ports via MQTT :

- **Topic de commande** : `<baseTopic>/switch/<nom_switch>/ports/port<numero>/poeState/set`
- **Payload** : `1` (activer PoE) ou `0` (désactiver PoE)

Exemple :
```bash
# Activer le PoE sur le port 5 du switch SG2008P
mosquitto_pub -h <broker> -t "omada2mqtt/switch/sg2008p/ports/port5/poeState/set" -m "1"

# Désactiver le PoE sur le port 5 du switch SG2008P  
mosquitto_pub -h <broker> -t "omada2mqtt/switch/sg2008p/ports/port5/poeState/set" -m "0"
```

### Intégration Home Assistant

Le programme configure automatiquement Home Assistant via MQTT Discovery :

**Pour chaque device** :
- Sensors : Type, IP, Uptime, CPU, Mémoire, Nom, MAC
- Binary sensor : État (on/off)
- Device grouping avec informations complètes

**Pour chaque port PoE** :
- Switch entity avec contrôle on/off
- Device class : `outlet`
- Commandes bidirectionnelles (lecture + écriture)

Les entities apparaissent automatiquement dans Home Assistant sous **Paramètres → Appareils et services → MQTT**.

## Structure des topics MQTT

### Topics de publication (automatiques)

```
<baseTopic>/<type_device>/<nom_device>                                    # Données complètes du device
<baseTopic>/switch/<nom_switch>/ports/port<X>/name                        # Nom du port
<baseTopic>/switch/<nom_switch>/ports/port<X>/isPOE                       # Support PoE (true/false)
<baseTopic>/switch/<nom_switch>/ports/port<X>/profileName                 # Nom du profil
<baseTopic>/switch/<nom_switch>/ports/port<X>/profileOverrideEnable       # Override activé (true/false)
<baseTopic>/switch/<nom_switch>/ports/port<X>/poeState                    # État PoE (1/0)
```

### Topics de commande (pour contrôle)

```
<baseTopic>/switch/<nom_switch>/ports/port<X>/poeState/set                # Contrôle PoE (payload: 1 ou 0)
```

### Topics Home Assistant Discovery (automatiques)

```
homeassistant/sensor/<device_id>/<sensor_key>/config                      # Configuration sensors
homeassistant/binary_sensor/<device_id>/<sensor_key>/config               # Configuration binary sensors  
homeassistant/switch/<device_id>/port<X>/config                           # Configuration switches PoE
```

**Note** : `<nom_device>` et `<nom_switch>` sont normalisés (minuscules, espaces et tirets remplacés par `_`).

## Installation et lancement

### Mode développement

```bash
make install   # Installe les dépendances
make run       # Démarre l'application
```

### Installation en tant que service système

Pour une installation en production, vous pouvez installer omada2mqtt comme service systemd :

```bash
# 1. Configurer l'application
cp config-sample.conf config.conf
# Éditer config.conf avec vos paramètres

# 2. Installer le service (nécessite sudo)
sudo make install-service

# 3. Démarrer le service
sudo make start

# 4. Vérifier le statut
make status
```

### Gestion du service

```bash
# Démarrage/Arrêt
sudo make start          # Démarrer le service
sudo make stop           # Arrêter le service
sudo make restart        # Redémarrer le service

# Configuration au démarrage
sudo make enable         # Démarrer automatiquement au boot
sudo make disable        # Ne pas démarrer au boot

# Monitoring
make status              # Statut du service
make logs                # Logs en temps réel

# Désinstallation
sudo make uninstall-service  # Supprimer complètement le service
```

**Note** : Le service s'installe dans `/opt/omada2mqtt` et utilise l'utilisateur actuel pour l'exécution.

## Dépendances principales

- `axios` : pour les requêtes HTTP vers l'API Omada
- `mqtt` : pour la communication MQTT
