const mqtt = require('mqtt');
const config = require('./config');
const omadaAuth = require('./omadaAuth');
const omadaApi = require('./omadaApi');
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
  await omadaAuth.doRefreshToken();

  // Connexion au broker MQTT
  const mqttClient = mqtt.connect(config.mqtt.url, {
    username: config.mqtt.username,
    password: config.mqtt.password
  });

  mqttClient.on('connect', async () => {
    log('info', 'Connecté au broker MQTT');
    // Récupération et publication initiale des devices du site Omada
    let deviceList = await omadaApi.publishAllDevices(omadaAuth, mqttClient);

    // Mise à jour automatique toutes les minutes pour les devices
    setInterval(async () => {
      deviceList = await omadaApi.publishAllDevices(omadaAuth, mqttClient);
    }, 60 * 1000);

    // Publication des ports de switch toutes les 5 secondes
    setInterval(() => {
      // On filtre la liste pour ne garder que les switches valides
      const switches = (deviceList || []).filter(d => d && d.type === 'switch').map(d => d.device);
      omadaApi.publishSwitchPorts(omadaAuth, mqttClient, switches);
    }, 5 * 1000);

  });

  mqttClient.on('error', (err) => {
    log('error', 'Erreur de connexion MQTT:', err);
  });

  mqttClient.on('message', (topic, message) => {
    log('info', `Message reçu sur le topic ${topic}: ${message.toString()}`);
    // Ici, nous allons ajouter la logique pour appeler l'API Omada
  });
}

main();
