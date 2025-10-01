# Docker pour omada2mqtt

Ce guide vous explique comment utiliser omada2mqtt avec Docker.

## Prérequis

- Docker installé sur votre système
- Docker Compose (optionnel, mais recommandé)
- Un fichier `config.conf` configuré

## Configuration rapide

1. **Copier et configurer le fichier de configuration :**
   ```bash
   cp config-sample.conf config.conf
   # Éditer config.conf avec vos paramètres
   ```

2. **Construire et lancer avec Docker Compose (recommandé) :**
   ```bash
   make docker-compose-up
   ```

   Ou manuellement :
   ```bash
   docker-compose up -d
   ```

## Utilisation avec Make

Le Makefile inclut plusieurs commandes pour faciliter l'utilisation de Docker :

### Construction et gestion de l'image
```bash
# Construire l'image Docker
make docker-build

# Construire avec un tag spécifique
make docker-build DOCKER_TAG=v1.0.0

# Nettoyer les images et conteneurs
make docker-clean
```

### Exécution
```bash
# Lancer le conteneur
make docker-run

# Arrêter le conteneur
make docker-stop
```

### Docker Compose
```bash
# Démarrer les services
make docker-compose-up

# Arrêter les services
make docker-compose-down
```

### Registre Docker
```bash
# Pousser vers un registre
make docker-push DOCKER_REGISTRY=ghcr.io/mamath2000

# Récupérer depuis un registre
make docker-pull DOCKER_REGISTRY=ghcr.io/mamath2000
```

## Configuration Docker

### Variables d'environnement

- `CONFIG_FILE` : Chemin vers le fichier de configuration (par défaut : `/app/config/config.conf`)
- `NODE_ENV` : Environnement Node.js (par défaut : `production`)

### Volumes

Le conteneur monte le fichier de configuration depuis l'hôte :
- `./config.conf:/app/config/config.conf:ro` (lecture seule)

### Sécurité

L'image Docker utilise :
- Un utilisateur non-root (`omada2mqtt:omada2mqtt`)
- Multi-stage build pour réduire la taille de l'image
- Uniquement les dépendances de production

## Utilisation manuelle avec Docker

Si vous préférez utiliser Docker directement sans Make :

```bash
# Construire l'image
docker build -t omada2mqtt:latest .

# Lancer le conteneur
docker run -d \
  --name omada2mqtt \
  --restart unless-stopped \
  -v $(pwd)/config.conf:/app/config/config.conf:ro \
  omada2mqtt:latest

# Voir les logs
docker logs -f omada2mqtt

# Arrêter et supprimer
docker stop omada2mqtt
docker rm omada2mqtt
```

## Dépannage

### Vérifier les logs
```bash
docker logs -f omada2mqtt
```

### Vérifier la configuration
```bash
docker exec omada2mqtt cat /app/config/config.conf
```

### Entrer dans le conteneur
```bash
docker exec -it omada2mqtt sh
```

### Problèmes courants

1. **Erreur "config.conf not found"**
   - Vérifiez que le fichier `config.conf` existe dans le répertoire courant
   - Vérifiez les permissions de lecture du fichier

2. **Problèmes de connexion MQTT/Omada**
   - Vérifiez la configuration réseau Docker
   - Assurez-vous que les adresses IP dans `config.conf` sont accessibles depuis le conteneur

3. **Permissions**
   - Le conteneur utilise l'utilisateur `omada2mqtt` (UID 1001)
   - Assurez-vous que les volumes montés ont les bonnes permissions

## Monitoring

Vous pouvez monitorer le conteneur avec :
```bash
docker stats omada2mqtt
docker inspect omada2mqtt
```

Le healthcheck intégré vérifie que l'application fonctionne correctement.