# Makefile for omada2mqtt

# Variables
SERVICE_NAME_BASE = omada2mqtt
SERVICE_USER = $(shell whoami)
INSTALL_DIR_BASE = /opt/omada2mqtt
CURRENT_DIR = $(shell pwd)

# Docker variables
DOCKER_IMAGE_NAME = omada2mqtt
DOCKER_TAG ?= latest
DOCKER_REGISTRY ?= mathmath350
DOCKER_FULL_NAME = $(if $(DOCKER_REGISTRY),$(DOCKER_REGISTRY)/,)$(DOCKER_IMAGE_NAME):$(DOCKER_TAG)

.PHONY: all install run clean help docker-build docker-run docker-stop docker-clean docker-push docker-pull docker-compose-up docker-compose-down docker-compose-logs docker-logs docker-status docker-build-release docker-version

# Default target
all: help

# Install dependencies (for local development)
install:
	@echo "Installing dependencies..."
	@# Check if node is installed
	@which node > /dev/null || (echo "Error: Node.js is not installed. Please install Node.js first." && exit 1)
	@# Check if npm is installed
	@which npm > /dev/null || (echo "Error: npm is not installed. Please install npm first." && exit 1)
	@# Check Node.js version (require v16+)
	@node_version=$$(node --version | cut -d'.' -f1 | sed 's/v//'); \
	if [ "$$node_version" -lt 16 ]; then \
		echo "Error: Node.js version 16 or higher is required. Current version: $$(node --version)"; \
		exit 1; \
	fi
	npm install

# Run the application (local development)
run:
	@echo "Starting application locally..."
	npm start

# Clean up node_modules
clean:
	@echo "Cleaning up..."
	rm -rf node_modules

# =============================================================================
# Docker targets
# =============================================================================

# Build Docker image
docker-build:
	@echo "Building Docker image with metadata..."
	@# Check if Docker is installed
	@which docker > /dev/null || (echo "Error: Docker is not installed. Please install Docker first." && exit 1)
	@# Use enhanced build script if available, otherwise fallback to simple build
	@if [ -f scripts/build-docker.sh ]; then \
		./scripts/build-docker.sh; \
	else \
		docker build -t $(DOCKER_FULL_NAME) .; \
		echo "Docker image built successfully: $(DOCKER_FULL_NAME)"; \
	fi

# Build and release Docker image with automatic versioning
docker-build-release:
	@echo "Building and releasing Docker image with automatic versioning..."
	@# Check if script exists
	@if [ ! -f scripts/build-docker-image.sh ]; then \
		echo "Error: scripts/build-docker-image.sh not found."; \
		exit 1; \
	fi
	@# Execute the build script
	./scripts/build-docker-image.sh

# Show current version
docker-version:
	@echo "Current version information:"
	@if command -v jq >/dev/null 2>&1; then \
		echo "📦 Package version: $$(jq -r '.version' package.json)"; \
	else \
		echo "📦 Package version: $$(grep '"version"' package.json | cut -d'"' -f4)"; \
	fi
	@if command -v git >/dev/null 2>&1; then \
		echo "🔀 Git commit: $$(git rev-parse --short HEAD 2>/dev/null || echo 'N/A')"; \
		echo "🌿 Git branch: $$(git branch --show-current 2>/dev/null || echo 'N/A')"; \
	fi
	@echo "🐳 Docker image: $(DOCKER_FULL_NAME)"

# Run Docker container
docker-run:
	@echo "Running Docker container..."
	@if [ ! -f config.conf ]; then \
		echo "Error: config.conf not found. Please copy and configure config-sample.conf first."; \
		echo "Run: cp config-sample.conf config.conf"; \
		exit 1; \
	fi
	@# Stop existing container if running
	-docker stop $(DOCKER_IMAGE_NAME) 2>/dev/null
	-docker rm $(DOCKER_IMAGE_NAME) 2>/dev/null
	@# Run new container
	docker run -d \
		--name $(DOCKER_IMAGE_NAME) \
		--restart unless-stopped \
		-v $(CURRENT_DIR)/config.conf:/app/config/config.conf:ro \
		$(DOCKER_FULL_NAME)
	@echo "Docker container started: $(DOCKER_IMAGE_NAME)"

# Stop Docker container
docker-stop:
	@echo "Stopping Docker container..."
	-docker stop $(DOCKER_IMAGE_NAME)
	-docker rm $(DOCKER_IMAGE_NAME)
	@echo "Docker container stopped and removed"

# Clean Docker images and containers
docker-clean:
	@echo "Cleaning Docker images and containers..."
	-docker stop $(DOCKER_IMAGE_NAME) 2>/dev/null
	-docker rm $(DOCKER_IMAGE_NAME) 2>/dev/null
	-docker rmi $(DOCKER_FULL_NAME) 2>/dev/null
	@# Clean dangling images
	-docker image prune -f
	@echo "Docker cleanup completed"

# Push Docker image to registry
docker-push:
	@echo "Pushing Docker image: $(DOCKER_FULL_NAME)"
	docker push $(DOCKER_FULL_NAME)
	@echo "Docker image pushed successfully"

# Pull Docker image from registry
docker-pull:
	@echo "Pulling Docker image: $(DOCKER_FULL_NAME)"
	docker pull $(DOCKER_FULL_NAME)
	@echo "Docker image pulled successfully"

# Start with docker-compose
docker-compose-up:
	@echo "Starting with docker-compose..."
	@if [ ! -f docker-compose.yml ]; then \
		echo "Error: docker-compose.yml not found."; \
		exit 1; \
	fi
	@if [ ! -f config.conf ]; then \
		echo "Error: config.conf not found. Please copy and configure config-sample.conf first."; \
		echo "Run: cp config-sample.conf config.conf"; \
		exit 1; \
	fi
	docker-compose up -d
	@echo "Services started with docker-compose"

# Stop docker-compose services
docker-compose-down:
	@echo "Stopping docker-compose services..."
	-docker-compose down
	@echo "Docker-compose services stopped"

# Show docker-compose logs
docker-compose-logs:
	@echo "Showing docker-compose logs..."
	docker-compose logs -f

# Show docker container logs
docker-logs:
	@echo "Showing Docker container logs..."
	docker logs -f $(DOCKER_IMAGE_NAME)

# Show docker container status
docker-status:
	@echo "Docker container status:"
	docker ps -a --filter name=$(DOCKER_IMAGE_NAME)

# Help
help:
	@echo "omada2mqtt - Docker-based MQTT bridge for Omada Controller"
	@echo ""
	@echo "Available commands:"
	@echo ""
	@echo "Local Development:"
	@echo "  make install          - Install Node.js dependencies"
	@echo "  make run              - Run application locally"
	@echo "  make clean            - Remove node_modules"
	@echo ""
	@echo "Docker Container:"
	@echo "  make docker-build     - Build Docker image"
	@echo "  make docker-run       - Run Docker container (requires config.conf)"
	@echo "  make docker-stop      - Stop and remove Docker container"
	@echo "  make docker-clean     - Clean Docker images and containers"
	@echo "  make docker-logs      - Show container logs (live)"
	@echo "  make docker-status    - Show container status"
	@echo "  make docker-version   - Show version information"
	@echo ""
	@echo "Docker Release:"
	@echo "  make docker-build-release - Build, version, and publish to Docker Hub"
	@echo ""
	@echo "Docker Registry:"
	@echo "  make docker-push      - Push image to registry"
	@echo "  make docker-pull      - Pull image from registry"
	@echo ""
	@echo "Docker Compose:"
	@echo "  make docker-compose-up   - Start services with docker-compose"
	@echo "  make docker-compose-down - Stop docker-compose services"
	@echo "  make docker-compose-logs - Show docker-compose logs (live)"
	@echo ""
	@echo "Configuration:"
	@echo "  cp config-sample.conf config.conf  # Create configuration file"
	@echo ""
	@echo "Docker Examples:"
	@echo "  make docker-build DOCKER_TAG=v1.0.0"
	@echo "  make docker-push DOCKER_TAG=latest                    # Push to $(DOCKER_REGISTRY)/$(DOCKER_IMAGE_NAME):latest"
	@echo "  make docker-push DOCKER_REGISTRY=ghcr.io/mamath2000   # Push to custom registry"
	@echo ""
	@echo "Quick Start:"
	@echo "  1. cp config-sample.conf config.conf"
	@echo "  2. Edit config.conf with your settings"
	@echo "  3. make docker-compose-up"
	@echo ""
	@echo "  make help             - Show this help message"
