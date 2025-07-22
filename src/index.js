const mqtt = require('mqtt');
const config = require('./config');
const omadaAuth = require('./omadaAuth');

async function main() {
  // Connexion à l'API Omada
  const loggedIn = await omadaAuth.login();
  if (!loggedIn) {
    console.error("Impossible de démarrer l'application sans connexion à Omada. Vérifiez votre configuration.");
    process.exit(1);
  }

  // Test du refresh token immédiatement après le login
  console.log('[INFO] Test du renouvellement du token...');
  await omadaAuth.doRefreshToken();

  // Connexion au broker MQTT
  const mqttClient = mqtt.connect(config.mqtt.url, {
    username: config.mqtt.username,
    password: config.mqtt.password
  });

//   mqttClient.on('connect', () => {
//     console.log('Connecté au broker MQTT');
//     // Souscription au topic pour contrôler les ports des switchs
//     const topic = `${config.mqtt.baseTopic}/switch/+/ports/+/set`;
//     mqttClient.subscribe(topic, (err) => {
//       if (!err) {
//         console.log(`Souscription réussie au topic: ${topic}`);
//       } else {
//         console.error('Erreur de souscription:', err);
//       }
//     });
//   });

  mqttClient.on('error', (err) => {
    console.error('Erreur de connexion MQTT:', err);
  });

  mqttClient.on('message', (topic, message) => {
    console.log(`Message reçu sur le topic ${topic}: ${message.toString()}`);
    // Ici, nous allons ajouter la logique pour appeler l'API Omada
  });
}

main();
