# Makefile for omada2mqtt

# Variables
SERVICE_NAME = omada2mqtt
SERVICE_USER = $(shell whoami)
INSTALL_DIR = /opt/omada2mqtt
CURRENT_DIR = $(shell pwd)

.PHONY: all install run clean help install-service uninstall-service start stop restart status enable disable logs

# Default target
all: help

# Install dependencies
install:
	@echo "Installing dependencies..."
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

# Help
help:
	@echo "Available commands:"
	@echo ""
	@echo "Development:"
	@echo "  make install          - Install dependencies"
	@echo "  make run              - Run the application (default)"
	@echo "  make clean            - Remove installed dependencies"
	@echo ""
	@echo "System Service (requires sudo):"
	@echo "  sudo make install-service    - Install as system service"
	@echo "  sudo make uninstall-service  - Uninstall system service"
	@echo ""
	@echo "Service Management:"
	@echo "  sudo make start       - Start the service"
	@echo "  sudo make stop        - Stop the service"
	@echo "  sudo make restart     - Restart the service"
	@echo "  make status           - Show service status"
	@echo "  sudo make enable      - Enable service at boot"
	@echo "  sudo make disable     - Disable service at boot"
	@echo "  make logs             - Show service logs (live)"
	@echo ""
	@echo "  make help             - Show this help message"
