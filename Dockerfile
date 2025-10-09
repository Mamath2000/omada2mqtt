# Dockerfile pour omada2mqtt
# Utilise un build multi-stage pour optimiser la taille de l'image

# Arguments de build
ARG GIT_REF="unknown"
ARG BUILD_DATE="unknown"

# Stage 1: Build stage
FROM node:18-alpine AS builder

# Définir le répertoire de travail
WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances
RUN npm ci --only=production && npm cache clean --force

# Stage 2: Production stage
FROM node:18-alpine AS production

# Arguments de build disponibles dans le stage final
ARG GIT_REF
ARG BUILD_DATE

# Créer un utilisateur non-root pour la sécurité
RUN addgroup -g 1001 -S omada2mqtt && \
    adduser -S omada2mqtt -u 1001 -G omada2mqtt

# Définir le répertoire de travail
WORKDIR /app

# Copier les dépendances depuis le stage builder
COPY --from=builder /app/node_modules ./node_modules

# Copier le code source
COPY src/ ./src/
COPY package*.json ./

# Copier le fichier de configuration d'exemple
COPY config-sample.conf ./config-sample.conf

# Définir les permissions
RUN chown -R omada2mqtt:omada2mqtt /app

# Changer vers l'utilisateur non-root
USER omada2mqtt

# Exposer le port pour le health check
EXPOSE 3000

# Variables d'environnement par défaut
ENV NODE_ENV=production

# Point de montage pour la configuration (optionnel)
# VOLUME ["/app/config"]

# Commande de démarrage
CMD ["node", "src/index.js"]

# Labels pour la métadonnée avec les informations de build
LABEL maintainer="Mamath2000"
LABEL description="omada2mqtt - Bridge entre Omada Controller et MQTT"
LABEL version="1.0.0"
LABEL git.ref="${GIT_REF}"
LABEL build.date="${BUILD_DATE}"