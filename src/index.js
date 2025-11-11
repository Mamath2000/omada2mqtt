const mqtt = require('mqtt');
const http = require('http');
const config = require('./utils/config');
const omadaAuth = require('./omadaAuth');
const OmadaApi = require('./omadaApi');
const haDiscovery = require('./haDiscovery');
const logger = require('./utils/logger');

// Variables globales pour le statut de l'application
let appStatus = {
  omadaConnected: false,
  mqttConnected: false,
  lastPolling: null,
  startTime: new Date().toISOString()
};

// Serveur HTTP pour le health check
const healthServer = http.createServer((req, res) => {
  // Configurer les headers CORS et content-type
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.url === '/health' && req.method === 'GET') {
    const isHealthy = appStatus.omadaConnected && appStatus.mqttConnected;
    const statusCode = isHealthy ? 200 : 503;
    
    const healthResponse = {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      service: 'omada2mqtt',
      version: require('../package.json').version,
      checks: {
        omada: appStatus.omadaConnected ? 'connected' : 'disconnected',
        mqtt: appStatus.mqttConnected ? 'connected' : 'disconnected',
        lastPolling: appStatus.lastPolling
      },
      startTime: appStatus.startTime
    };
    
    res.writeHead(statusCode);
    res.end(JSON.stringify(healthResponse, null, 2));
  } else if (req.url === '/status' && req.method === 'GET') {
    // Endpoint plus détaillé pour le monitoring
    const detailedStatus = {
      ...appStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      service: 'omada2mqtt',
      version: require('../package.json').version,
      memory: process.memoryUsage(),
      config: {
        mqtt: {
          url: config.mqtt.url,
          baseTopic: config.mqtt.baseTopic
        },
        omada: {
          baseUrl: config.omada.baseUrl,
          site: config.omada.siteName
        },
        homeassistant: {
          enabled: config.homeassistant?.enabled || false
        }
      }
    };
    
    res.writeHead(200);
    res.end(JSON.stringify(detailedStatus, null, 2));
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not Found', available: ['/health', '/status'] }));
  }
});

// Démarrer le serveur de santé sur le port 3000
const HEALTH_PORT = process.env.HEALTH_PORT || 3000;
healthServer.listen(HEALTH_PORT, () => {
  console.log(`Health check server running on port ${HEALTH_PORT}`);
  console.log(`Health endpoint: http://localhost:${HEALTH_PORT}/health`);
  console.log(`Status endpoint: http://localhost:${HEALTH_PORT}/status`);
});

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
    appStatus.omadaConnected = false;
    process.exit(1);
  }
  
  appStatus.omadaConnected = true;
  log('info', 'Connexion Omada établie');

  // Instanciation de l'API orientée objet
  const omadaApi = new OmadaApi(omadaAuth);
  
  // Configurer la callback de mise à jour du statut
  omadaApi.setStatusCallback((updates) => {
    Object.assign(appStatus, updates);
  });

  // Configuration du Last Will and Testament (LWT) pour le statut offline
  const lwt = {
    topic: `${config.mqtt.baseTopic}/bridge/lwt`,
    payload: JSON.stringify('offline'),
    qos: 1,
    retain: true
  };

  const mqttClient = mqtt.connect(config.mqtt.url, {
    username: config.mqtt.username,
    password: config.mqtt.password,
    will: lwt
  });

  mqttClient.on('connect', async () => {
    log('info', 'Connecté au broker MQTT');
    appStatus.mqttConnected = true;
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

    // Souscription aux commandes PoE seulement si la fonctionnalité est activée
    if (config.features && config.features.enablePoePorts) {
      mqttClient.subscribe(`${config.mqtt.baseTopic}/${config.omada.site}/switch/+/ports/+/poeStateSet`, (err) => {
        if (err) {
          log('error', 'Erreur lors de la souscription aux topics de commande PoE:', err);
        } else {
          log('info', 'Souscription aux commandes PoE MQTT prête.');
        }
      });
    } else {
      log('info', 'Gestion des ports PoE désactivée, pas de souscription aux commandes PoE');
    }
  });

  mqttClient.on('error', (err) => {
    log('error', 'Erreur de connexion MQTT:', err);
    appStatus.mqttConnected = false;
  });

  mqttClient.on('message', (topic, message) => {
    log('info', `Message reçu sur le topic ${topic}: ${message.toString()}`);
    // Gestion des commandes PoE : omada2mqtt/switch/{switch}/ports/port{num}/poeStateSet
    const regex = new RegExp(`^${config.mqtt.baseTopic}/${config.omada.site}/switch/([^/]+)/ports/port(\\d+)/poeStateSet$`);
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

  // Gestion de l'arrêt propre du programme
  const gracefulShutdown = async (signal) => {
    log('info', `Signal ${signal} reçu, arrêt en cours...`);
    
    // Publier le statut offline avant de se déconnecter
    if (mqttClient && mqttClient.connected) {
      await new Promise((resolve) => {
        mqttClient.publish(
          `${config.mqtt.baseTopic}/${config.omada.site}/bridge/state`,
          JSON.stringify({ state: 'offline' }),
          { retain: true, qos: 1 },
          () => {
            log('info', 'Statut offline publié');
            resolve();
          }
        );
      });
      
      // Arrêter le polling
      omadaApi.stopPolling();
      
      // Déconnecter MQTT proprement
      await new Promise((resolve) => {
        mqttClient.end(false, {}, () => {
          log('info', 'Client MQTT déconnecté');
          resolve();
        });
      });
    }
    
    // Arrêter le serveur de santé
    healthServer.close(() => {
      log('info', 'Serveur de santé arrêté');
      process.exit(0);
    });
  };

  // Écouter les signaux d'arrêt
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

main();
