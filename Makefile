# Makefile for omada2mqtt

# Variables
SERVICE_NAME_BASE = omada2mqtt
SERVICE_USER = $(shell whoami)
INSTALL_DIR_BASE = /opt/omada2mqtt
CURRENT_DIR = $(shell pwd)

# Extract site name from config.conf to create unique service name
SITE_NAME = $(shell if [ -f config.conf ]; then grep "^site" config.conf | cut -d'=' -f2 | tr -d ' ' | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/_/g'; else echo "default"; fi)
SERVICE_NAME = $(SERVICE_NAME_BASE)_$(SITE_NAME)
INSTALL_DIR = $(INSTALL_DIR_BASE)_$(SITE_NAME)

.PHONY: all install run clean help install-service uninstall-service start stop restart status enable disable logs list-services uninstall-all

# Default target
all: help

# Install dependencies
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

# Run the application (development)
run:
	@echo "Starting application..."
	npm start

# Clean up node_modules
clean:
	@echo "Cleaning up..."
	rm -rf node_modules

# Install application as system service
install-service: install
	@echo "Installing omada2mqtt as system service..."
	@if [ "$(shell id -u)" != "0" ]; then \
		echo "Error: This command must be run as root (use sudo)"; \
		exit 1; \
	fi
	@# Check if config.conf exists
	@if [ ! -f config.conf ]; then \
		echo "Error: config.conf not found. Please copy and configure config-sample.conf first."; \
		echo "Run: cp config-sample.conf config.conf"; \
		exit 1; \
	fi
	@echo "Detected site: $(SITE_NAME)"
	@echo "Service name will be: $(SERVICE_NAME)"
	@echo "Installation directory: $(INSTALL_DIR)"
	@# Create installation directory
	mkdir -p $(INSTALL_DIR)
	@# Copy application files
	cp -r src package.json config-sample.conf Makefile omada2mqtt.service.template $(INSTALL_DIR)/
	@# Copy config if it exists
	@if [ -f config.conf ]; then \
		cp config.conf $(INSTALL_DIR)/; \
	else \
		echo "Warning: config.conf not found, copying sample"; \
		cp config-sample.conf $(INSTALL_DIR)/config.conf; \
	fi
	@# Install dependencies in target directory
	cd $(INSTALL_DIR) && npm install --production
	@# Set ownership
	chown -R $(SERVICE_USER):$(SERVICE_USER) $(INSTALL_DIR)
	@# Create systemd service file from template
	@echo "Creating systemd service file..."
	@sed 's/{{SERVICE_USER}}/$(SERVICE_USER)/g; s|{{INSTALL_DIR}}|$(INSTALL_DIR)|g' \
		$(INSTALL_DIR)/omada2mqtt.service.template > /etc/systemd/system/$(SERVICE_NAME).service
	@# Reload systemd and enable service
	systemctl daemon-reload
	systemctl enable $(SERVICE_NAME)
	@echo "Service installed successfully!"
	@echo "Edit $(INSTALL_DIR)/config.conf with your settings"
	@echo "Then run: sudo make start"

# Uninstall system service
uninstall-service:
	@echo "Uninstalling omada2mqtt service..."
	@if [ "$(shell id -u)" != "0" ]; then \
		echo "Error: This command must be run as root (use sudo)"; \
		exit 1; \
	fi
	@# Stop and disable service
	-systemctl stop $(SERVICE_NAME)
	-systemctl disable $(SERVICE_NAME)
	@# Remove service file
	-rm -f /etc/systemd/system/$(SERVICE_NAME).service
	@# Remove installation directory
	-rm -rf $(INSTALL_DIR)
	@# Reload systemd
	systemctl daemon-reload
	@echo "Service uninstalled successfully!"

# Start service
start:
	@echo "Starting omada2mqtt service..."
	systemctl start $(SERVICE_NAME)

# Stop service
stop:
	@echo "Stopping omada2mqtt service..."
	systemctl stop $(SERVICE_NAME)

# Restart service
restart:
	@echo "Restarting omada2mqtt service..."
	systemctl restart $(SERVICE_NAME)

# Check service status
status:
	@echo "Checking omada2mqtt service status..."
	systemctl status $(SERVICE_NAME)

# Enable service (start at boot)
enable:
	@echo "Enabling omada2mqtt service..."
	systemctl enable $(SERVICE_NAME)

# Disable service (don't start at boot)
disable:
	@echo "Disabling omada2mqtt service..."
	systemctl disable $(SERVICE_NAME)

# Show service logs
logs:
	@echo "Showing omada2mqtt service logs..."
	journalctl -u $(SERVICE_NAME) -f

# List all omada2mqtt services
list-services:
	@echo "Listing all omada2mqtt services..."
	@systemctl list-units --type=service | grep omada2mqtt || echo "No omada2mqtt services found"
	@echo ""
	@echo "Installation directories:"
	@ls -la /opt/ | grep omada2mqtt || echo "No installation directories found"

# Uninstall all omada2mqtt services
uninstall-all:
	@echo "Uninstalling ALL omada2mqtt services..."
	@if [ "$(shell id -u)" != "0" ]; then \
		echo "Error: This command must be run as root (use sudo)"; \
		exit 1; \
	fi
	@# Stop and disable all omada2mqtt services
	@for service in $$(systemctl list-units --type=service | grep omada2mqtt | awk '{print $$1}'); do \
		echo "Stopping and disabling $$service"; \
		systemctl stop $$service; \
		systemctl disable $$service; \
		rm -f /etc/systemd/system/$$service; \
	done
	@# Remove all installation directories
	@for dir in $$(ls -d /opt/omada2mqtt* 2>/dev/null || true); do \
		echo "Removing $$dir"; \
		rm -rf $$dir; \
	done
	@# Reload systemd
	systemctl daemon-reload
	@echo "All omada2mqtt services uninstalled successfully!"

# Help
help:
	@echo "Available commands:"
	@echo ""
	@echo "Development:"
	@echo "  make install          - Install dependencies"
	@echo "  make run              - Run the application (default)"
	@echo "  make clean            - Remove installed dependencies"
	@echo ""
	@echo "System Service (requires sudo and config.conf):"
	@echo "  sudo make install-service    - Install as system service (site-specific)"
	@echo "  sudo make uninstall-service  - Uninstall current site service"
	@echo "  sudo make uninstall-all      - Uninstall ALL omada2mqtt services"
	@echo ""
	@echo "Service Management:"
	@echo "  sudo make start       - Start the service"
	@echo "  sudo make stop        - Stop the service"
	@echo "  sudo make restart     - Restart the service"
	@echo "  make status           - Show service status"
	@echo "  sudo make enable      - Enable service at boot"
	@echo "  sudo make disable     - Disable service at boot"
	@echo "  make logs             - Show service logs (live)"
	@echo "  make list-services    - List all omada2mqtt services"
	@echo ""
	@echo "Note: Service name will be 'omada2mqtt_<sitename>' based on config.conf"
	@echo "  make help             - Show this help message"
