const mqtt = require('mqtt');
const config = require('./utils/config');
const omadaAuth = require('./omadaAuth');
const OmadaApi = require('./omadaApi');
const haDiscovery = require('./haDiscovery');
const logger = require('./utils/logger');

// Applique le niveau de log depuis la config
if (config.logLevel) {
  logger.setLogLevel && logger.setLogLevel(config.logLevel);
}
const log = logger.log || logger;

async function main() {
  // Connexion à l'API Omada
  const loggedIn = await omadaAuth.login();
  if (!loggedIn) {
    log('error', "Impossible de démarrer l'application sans connexion à Omada. Vérifiez votre configuration.");
    process.exit(1);
  }

  // Instanciation de l'API orientée objet
  const omadaApi = new OmadaApi(omadaAuth);

  const mqttClient = mqtt.connect(config.mqtt.url, {
    username: config.mqtt.username,
    password: config.mqtt.password
  });

  mqttClient.on('connect', async () => {
    log('info', 'Connecté au broker MQTT');
    omadaApi.setMqttClient(mqttClient);

    // Fonction pour publier la découverte HA
    const publishHADiscoveryData = async () => {
      // Vérifier si l'autodiscovery Home Assistant est activée
      if (!config.homeassistant || !config.homeassistant.enabled) {
        log('debug', 'Home Assistant MQTT Discovery désactivée dans la configuration');
        return;
      }
      
      const devices = omadaApi.getDevices();
      if (!devices || Object.keys(devices).length === 0) {
        const devices = await omadaApi.refreshDevicesAndPorts();
        if (devices && Object.keys(devices).length > 0) {
          log('info', 'Publication de la configuration Home Assistant MQTT Discovery');
          haDiscovery.publishHADiscovery(mqttClient, devices);
        } else {
          log('warn', 'Aucun device trouvé pour la publication Home Assistant.');
        }
      }
    };

    // Publication immédiate de la découverte HA en premier
    await publishHADiscoveryData();

    // Publication de la découverte HA tous les jours (24h = 86400000 ms) - seulement si activée
    if (config.homeassistant && config.homeassistant.enabled) {
      setInterval(publishHADiscoveryData, 24 * 60 * 60 * 1000);
      log('info', 'Publication Home Assistant programmée toutes les 24 heures');
    }

    // Démarrage du polling automatique (devices et ports)
    await omadaApi.startPolling(60, 5);

    // Souscription aux commandes PoE
    mqttClient.subscribe(`${config.mqtt.baseTopic}/switch/+/ports/+/poeState/set`, (err) => {
      if (err) {
        log('error', 'Erreur lors de la souscription aux topics de commande PoE:', err);
      } else {
        log('info', 'Souscription aux commandes PoE MQTT prête.');
      }
    });
  });

  mqttClient.on('error', (err) => {
    log('error', 'Erreur de connexion MQTT:', err);
  });

  mqttClient.on('message', (topic, message) => {
    log('info', `Message reçu sur le topic ${topic}: ${message.toString()}`);
    // Gestion des commandes PoE : omada2mqtt/switch/{switch}/ports/port{num}/poeState/set
    const regex = new RegExp(`^${config.mqtt.baseTopic}/switch/([^/]+)/ports/port(\\d+)/poeState/set$`);
    const match = topic.match(regex);
    if (match) {
      const switchName = match[1];
      const portNum = match[2];
      const action = parseInt(message.toString());
      if (action === 1 || action === 0) {
        omadaApi.setSwitchPortPoe(switchName, portNum, action);
      } else {
        log('warn', `Commande PoE inconnue : ${action} (topic: ${topic})`);
      }
    }
  });
}

main();
