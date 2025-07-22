// Fichier de configuration pour omada2mqtt

const path = require('path');
const fs = require('fs');
const ini = require('ini');
const configPath = path.resolve(__dirname, '../../config.conf');
let config = {};
try {
  const iniContent = fs.readFileSync(configPath, 'utf8');
  config = ini.parse(iniContent);
  // Conversion des types et adaptation pour compatibilité descendante
  if (config.log && config.log.level) {
      config.logLevel = config.log.level.replace(/#.*/, '').trim();
  }
  // Pour compatibilité descendante avec l'ancien format
  if (config.omada) {
      config.omada.omadac_id = config.omada.omadac_id || config.omada.omadac_id;
  }
  if (config.mqtt) {
      config.mqtt.baseTopic = config.mqtt.baseTopic || config.mqtt.baseTopic;
  }
} catch (e) {
  console.error('Erreur de lecture du fichier de configuration config.conf:', e.message);
  process.exit(1);
}
module.exports = config;
