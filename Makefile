# Makefile for omada2mqtt

.PHONY: all install run clean help

# Default target
all: run

# Install dependencies
install:
	@echo "Installing dependencies..."
	npm install

# Run the application
run:
	@echo "Starting application..."
	npm start

# Clean up node_modules
clean:
	@echo "Cleaning up..."
	rm -rf node_modules

# Help
help:
	@echo "Available commands:"
	@echo "  make install   - Install dependencies"
	@echo "  make run       - Run the application (default)"
	@echo "  make clean     - Remove installed dependencies"
	@echo "  make help      - Show this help message"
