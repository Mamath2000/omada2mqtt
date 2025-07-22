const mqtt = require('mqtt');
const config = require('./config');
const omadaAuth = require('./omadaAuth');
const OmadaApi = require('./omadaApi');
const { log } = require('./logger');

async function main() {
  // Connexion à l'API Omada
  const loggedIn = await omadaAuth.login();
  if (!loggedIn) {
    log('error', "Impossible de démarrer l'application sans connexion à Omada. Vérifiez votre configuration.");
    process.exit(1);
  }

  // Test du refresh token immédiatement après le login
    log('info', 'Test du renouvellement du token...');

  // Instanciation de l'API orientée objet
  const omadaApi = new OmadaApi(omadaAuth);

  const mqttClient = mqtt.connect(config.mqtt.url, {
    username: config.mqtt.username,
    password: config.mqtt.password
  });

  mqttClient.on('connect', async () => {
    log('info', 'Connecté au broker MQTT');
    omadaApi.setMqttClient(mqttClient);
    
    // Démarrage du polling automatique (devices et ports)
    omadaApi.startPolling(60, 5);
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
      const action = message.toString().trim().toLowerCase();
      if (action === 'on' || action === 'off') {
        omadaApi.setSwitchPortPoe(switchName, portNum, action);
      } else {
        log('warn', `Commande PoE inconnue : ${action} (topic: ${topic})`);
      }
    }
  });
}

main();
