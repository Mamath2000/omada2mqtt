// Fichier de configuration pour omada2mqtt

const path = require('path');
const fs = require('fs');
const ini = require('ini');

// Utiliser la variable d'environnement CONFIG_FILE si définie, sinon le chemin par défaut
const configPath = process.env.CONFIG_FILE || path.resolve(__dirname, '../../config.conf');

let config = {};
try {
  const iniContent = fs.readFileSync(configPath, 'utf8');
  config = ini.parse(iniContent);
  console.log(`Configuration chargée depuis: ${configPath}`);
  // Conversion des types et adaptation pour compatibilité descendante
  if (config.log && config.log.level) {
      config.logLevel = config.log.level.replace(/#.*/, '').trim();
  }
  // Pour compatibilité descendante avec l'ancien format
  if (config.omada) {
      config.omada.omadac_id = config.omada.omadac_id || config.omada.omadac_id;
      
      // Normalisation du nom du site
      if (config.omada.site) {
          // Conserver le nom original dans config.omada.name
          config.omada.siteName = config.omada.site;
          // Normaliser le site (minuscules, sans caractères spéciaux)
          config.omada.site = config.omada.site
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '') // Supprimer les accents
              .replace(/[^a-z0-9]+/g, '_')      // Remplacer les caractères spéciaux par _
              .replace(/^_+|_+$/g, '');         // Supprimer les _ en début/fin
      }
  }
  if (config.mqtt) {
      config.mqtt.baseTopic = config.mqtt.baseTopic || config.mqtt.baseTopic;
  }
  
  // Gestion de la configuration Home Assistant avec valeur par défaut
  if (!config.homeassistant) {
      config.homeassistant = {};
  }
  // Conversion de la chaîne en booléen avec valeur par défaut à true
  if (config.homeassistant.enabled === undefined) {
      config.homeassistant.enabled = true;
  } else if (typeof config.homeassistant.enabled === 'string') {
      config.homeassistant.enabled = config.homeassistant.enabled.toLowerCase() === 'true';
  }
  
  // Gestion des filtres de devices
  if (!config.filters) {
      config.filters = {};
  }
  // Parse la liste des devices à inclure (séparés par des virgules)
  if (config.filters.includeDevices) {
      const devicesStr = config.filters.includeDevices.replace(/#.*/, '').trim();
      if (devicesStr) {
          config.filters.includeDevices = devicesStr
              .split(',')
              .map(d => d.trim().toLowerCase())
              .filter(d => d.length > 0);
      } else {
          config.filters.includeDevices = [];
      }
  } else {
      config.filters.includeDevices = [];
  }
  
  // Gestion des features
  if (!config.features) {
      config.features = {};
  }
  // Activer/désactiver la gestion des ports PoE (par défaut: true)
  if (config.features.enablePoePorts === undefined) {
      config.features.enablePoePorts = false;
  } else if (typeof config.features.enablePoePorts === 'string') {
      config.features.enablePoePorts = config.features.enablePoePorts.toLowerCase() === 'true';
  }
  
  // Validation des paramètres essentiels
  if (!config.omada || !config.omada.baseUrl || !config.omada.client_id) {
    console.error('Configuration Omada incomplète. Vérifiez votre fichier config.conf');
    process.exit(1);
  }
  if (!config.mqtt || !config.mqtt.url) {
    console.error('Configuration MQTT incomplète. Vérifiez votre fichier config.conf');
    process.exit(1);
  }
} catch (e) {
  console.error('Erreur de lecture du fichier de configuration config.conf:', e.message);
  process.exit(1);
}
module.exports = config;
