# 🐳 Utilisation de omada2mqtt avec Docker Compose

Ce guide vous explique comment déployer omada2mqtt facilement avec Docker Compose.

## 🚀 Démarrage rapide

### 1. Préparer la configuration

```bash
# Copier le fichier de configuration d'exemple
cp config-sample.conf config.conf

# Éditer la configuration avec vos paramètres
nano config.conf
```

### 2. Lancer avec Docker Compose

```bash
# Méthode 1: Avec le Makefile (recommandé)
make docker-compose-up

# Méthode 2: Directement avec docker-compose
docker-compose up -d
```

### 3. Vérifier le fonctionnement

```bash
# Voir les logs
docker-compose logs -f

# Vérifier le statut
docker-compose ps
```

## 📁 Fichiers disponibles

- **`docker-compose.yml`** : Configuration simple pour l'usage quotidien
- **`docker-compose.example.yml`** : Configuration complète avec toutes les options commentées

## ⚙️ Configuration

### Fichier de configuration requis

Vous **DEVEZ** avoir un fichier `config.conf` dans le même répertoire que le `docker-compose.yml`.

```ini
[omada]
baseUrl = https://192.168.1.1:8043
client_id = votre_client_id
client_secret = votre_client_secret
omadac_id = votre_omadac_id
site = NomDuSite

[mqtt]
url = mqtt://192.168.1.100
username = votre_username
password = votre_password
baseTopic = omada2mqtt

[log]
level = info

[homeassistant]
enabled = true
```

Le fichier `config.conf` doit être dans le **même répertoire** que le `docker-compose.yml`.

### Personnalisation avancée

Pour des besoins avancés, copiez et modifiez le fichier d'exemple :

```bash
cp docker-compose.example.yml docker-compose.yml
# Puis éditez selon vos besoins
```

## 🛠️ Commandes utiles

### Gestion du service
```bash
# Démarrer
docker-compose up -d

# Arrêter
docker-compose down

# Redémarrer
docker-compose restart

# Voir les logs en temps réel
docker-compose logs -f

# Mettre à jour l'image
docker-compose pull
docker-compose up -d
```

### Avec le Makefile
```bash
# Démarrer
make docker-compose-up

# Arrêter
make docker-compose-down

# Voir l'aide complète
make help
```

## 🔧 Dépannage

### Problèmes courants

1. **Erreur "config.conf not found"**
   ```bash
   # Vérifiez que le fichier existe
   ls -la config.conf
   
   # Créez-le depuis l'exemple si nécessaire
   cp config-sample.conf config.conf
   ```

2. **Problèmes de permissions**
   ```bash
   # Vérifiez les permissions du fichier de config
   chmod 644 config.conf
   ```

3. **Conteneur qui redémarre en boucle**
   ```bash
   # Vérifiez les logs pour voir l'erreur
   docker-compose logs omada2mqtt
   ```

### Commandes de diagnostic

```bash
# Voir le statut des conteneurs
docker-compose ps

# Inspecter la configuration
docker-compose config

# Entrer dans le conteneur pour déboguer
docker-compose exec omada2mqtt sh

# Voir les logs détaillés
docker-compose logs --details omada2mqtt
```

## 🔄 Mise à jour

Pour mettre à jour vers la dernière version :

```bash
# Arrêter le service
docker-compose down

# Mettre à jour l'image
docker-compose pull

# Redémarrer
docker-compose up -d

# Vérifier que tout fonctionne
docker-compose logs -f
```

## 🌐 Intégration avec d'autres services

### Exemple avec un broker MQTT local

```yaml
version: '3.8'

services:
  mosquitto:
    image: eclipse-mosquitto:latest
    container_name: mosquitto
    restart: unless-stopped
    ports:
      - "1883:1883"
      - "9001:9001"
    volumes:
      - ./mosquitto.conf:/mosquitto/config/mosquitto.conf

  omada2mqtt:
    image: mathmath350/omada2mqtt:latest
    container_name: omada2mqtt
    restart: unless-stopped
    depends_on:
      - mosquitto
    volumes:
      - ./config.conf:/app/config/config.conf:ro
    environment:
      - NODE_ENV=production
```

## 📊 Monitoring

Pour surveiller votre instance omada2mqtt :

```bash
# Statistiques de ressources
docker stats omada2mqtt

# Informations système du conteneur
docker inspect omada2mqtt

# Healthcheck status
docker inspect omada2mqtt | grep -A 10 '"Health"'
```

## 🆘 Support

Si vous rencontrez des problèmes :

1. Vérifiez les logs : `docker-compose logs -f`
2. Vérifiez la configuration : `docker-compose config`
3. Consultez la documentation : `make help`
4. Ouvrez une issue sur GitHub avec les logs d'erreur