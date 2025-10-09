# 🚀 Build et Release Docker pour omada2mqtt

Ce projet utilise un système de build automatisé inspiré des meilleures pratiques DevOps pour construire et publier les images Docker.

## 📁 Scripts disponibles

### `scripts/build-docker.sh`
Build simple avec métadonnées (sans publication)
- Utilise la version actuelle du `package.json`
- Ajoute le hash du commit git
- Crée plusieurs tags (latest, version, avec registry)

### `scripts/build-docker-image.sh`
Build complet avec publication et versioning automatique
- Build l'image avec métadonnées
- Publie sur Docker Hub
- Incrémente automatiquement la version
- Crée un commit git de la nouvelle version

## 🛠️ Utilisation

### Build simple (sans publication)
```bash
# Via Makefile (recommandé)
make docker-build

# Directement
./scripts/build-docker.sh
```

### Build et release complet
```bash
# Via Makefile (recommandé)
make docker-build-release

# Directement
./scripts/build-docker-image.sh
```

### Informations de version
```bash
make docker-version
```

## 🔧 Configuration

### Variables d'environnement

- `DOCKER_USER` : Nom d'utilisateur Docker Hub (défaut: `mathmath350`)

### Prérequis pour le release complet

1. **jq** : Pour manipuler le JSON
   ```bash
   sudo apt install jq
   ```

2. **Docker login** : Connexion à Docker Hub
   ```bash
   docker login
   ```

3. **Git propre** : Working directory sans changements non commités

## 📦 Métadonnées des images

Les images Docker sont construites avec les métadonnées suivantes :

```dockerfile
LABEL maintainer="Mamath2000"
LABEL description="omada2mqtt - Bridge entre Omada Controller et MQTT"
LABEL version="1.0.0"
LABEL git.ref="abc1234"         # Hash du commit git
LABEL build.date="2025-10-09T..."  # Date de build ISO 8601
```

## 🏷️ Stratégie de tagging

Chaque build crée plusieurs tags :

### Build local
- `omada2mqtt:latest`
- `omada2mqtt:1.0.0` (version du package.json)

### Build avec registry
- `mathmath350/omada2mqtt:latest`
- `mathmath350/omada2mqtt:1.0.0`

### Release complet (en plus)
- `mathmath350/omada2mqtt:abc1234` (hash git)

## 🔄 Workflow de release

1. **Développement** : Modifications du code
2. **Test local** : `make docker-build`
3. **Commit** : `git commit -am "feat: nouvelle fonctionnalité"`
4. **Release** : `make docker-build-release`
   - Build l'image
   - Publie sur Docker Hub
   - Incrémente la version (1.0.0 → 1.0.1)
   - Commit automatique de la nouvelle version
5. **Push** : `git push origin main`

## 📋 Exemple de workflow complet

```bash
# 1. Développement
echo "nouvelle fonctionnalité" >> src/index.js

# 2. Commit des changements
git add .
git commit -m "feat: ajout nouvelle fonctionnalité"

# 3. Build et test local
make docker-build

# 4. Release automatique
make docker-build-release
# ✅ Construit l'image
# ✅ Publie sur Docker Hub
# ✅ Version passe de 1.0.0 → 1.0.1
# ✅ Commit automatique

# 5. Push du commit de version
git push origin main
```

## 🔍 Vérification des images

```bash
# Voir les images locales
docker images | grep omada2mqtt

# Inspecter les métadonnées
docker inspect mathmath350/omada2mqtt:latest | jq '.[0].Config.Labels'

# Vérifier sur Docker Hub
docker pull mathmath350/omada2mqtt:latest
```

## 🚨 Dépannage

### Erreur "jq not found"
```bash
sudo apt update && sudo apt install jq
```

### Erreur "Not logged in to Docker Hub"
```bash
docker login
# Entrez vos identifiants Docker Hub
```

### Working directory non propre
```bash
# Voir les changements
git status

# Commiter les changements
git add .
git commit -m "fix: corrections avant release"

# Ou stash temporairement
git stash
make docker-build-release
git stash pop
```

### Version non incrémentée
Le script incrémente automatiquement le numéro de **patch** (1.0.0 → 1.0.1).
Pour incrémenter **minor** ou **major**, modifiez manuellement `package.json` avant le build.

## 💡 Bonnes pratiques

1. **Toujours tester localement** avec `make docker-build` avant release
2. **Commit atomiques** : une fonctionnalité = un commit
3. **Messages de commit clairs** : utilisez la convention conventional commits
4. **Working directory propre** avant release
5. **Push régulier** des commits de version