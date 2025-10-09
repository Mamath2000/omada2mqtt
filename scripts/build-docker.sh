#!/bin/bash

# Script de build Docker simple pour omada2mqtt (sans publication)
# Utilise la version actuelle et le commit git

set -e

# Configuration
DOCKER_USER=${DOCKER_USER:-"mathmath350"}
APP_NAME="omada2mqtt"

echo "🔨 Build Docker pour $APP_NAME"

# Récupère la version actuelle du fichier package.json
if command -v jq >/dev/null 2>&1; then
    VERSION=$(jq -r '.version' package.json)
else
    VERSION=$(grep '"version"' package.json | cut -d'"' -f4)
fi

# Récupère le hash court du commit git
if command -v git >/dev/null 2>&1; then
    GIT_REF=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
else
    GIT_REF="unknown"
fi

echo "📦 Version: $VERSION"
echo "🔀 Git ref: $GIT_REF"

# Build de l'image Docker avec métadonnées
echo "🔨 Construction de l'image Docker avec métadonnées..."
docker build \
    --build-arg GIT_REF=$GIT_REF \
    --build-arg BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ') \
    -t $APP_NAME:latest \
    -t $APP_NAME:$VERSION \
    -t $DOCKER_USER/$APP_NAME:latest \
    -t $DOCKER_USER/$APP_NAME:$VERSION \
    .

echo ""
echo "✅ Build terminé avec succès!"
echo "🐳 Images Docker créées:"
echo "   - $APP_NAME:latest"
echo "   - $APP_NAME:$VERSION"
echo "   - $DOCKER_USER/$APP_NAME:latest"
echo "   - $DOCKER_USER/$APP_NAME:$VERSION"
echo ""
echo "💡 Pour publier les images:"
echo "   make docker-push"
echo "   ou"
echo "   make docker-build-release  # Build + version + publish automatique"