// omadaApi.js : Fonctions d'accès aux données Omada (hors authentification)
const config = require('./config');
const { log } = require('./logger');

/**
 * Récupère tous les devices du site Omada et publie chaque device sur MQTT.
 * @param {object} omadaAuth - Le client d'authentification Omada (doit contenir api et siteId)
 * @param {object} mqttClient - Le client MQTT connecté
 */

async function publishAllDevices(omadaAuth, mqttClient) {
    try {
        const siteId = omadaAuth.siteId;
        if (!siteId) {
            log('error', 'siteId Omada non défini.');
            return [];
        }
        const url = `/openapi/v1/${config.omada.omadac_id}/sites/${siteId}/devices?pageSize=100&page=1`;
        const response = await omadaAuth.api.get(url);
        if (response.data.errorCode === 0 && response.data.result && response.data.result.data) {
            const devices = response.data.result.data;
            log('info', `${devices.length} devices trouvés sur le site.`);
            const deviceList = devices.map(device => {
                const type = (device.type || '').toLowerCase();
                if (!type || type === 'unknown') {
                    log('warn', 'deviceType/type manquant pour le device:', device);
                    return; // Passer à l'élément suivant sans traiter ce device
                }
                const name = (device.name || 'unknown')
                    .toLowerCase()
                    .replace(/[\s-]+/g, '_');
                const topic = `${config.mqtt.baseTopic}/${type}/${name}`;
                mqttClient.publish(topic, JSON.stringify(device), { retain: false }, (err) => {
                    if (err) {
                        log('error', `Publication MQTT échouée pour ${topic}:`, err);
                    } else {
                        log('info', `Données publiées sur ${topic}`);
                    }
                });
                return { type, name, device };
            });
            return deviceList;
        } else {
            log('warn', 'Erreur lors de la récupération des devices, réponse inattendue:', response.data);
            return [];
        }
    } catch (error) {
        log('error', 'Erreur lors de la récupération des devices Omada:', error.response ? error.response.data : error.message);
        return [];
    }
}

/**
 * Récupère les informations de ports pour chaque switch du site et publie sur MQTT.
 * @param {object} omadaAuth - Le client d'authentification Omada
 * @param {object} mqttClient - Le client MQTT connecté
 * @param {Array} [switches] - (optionnel) Liste des switches déjà connus
 */

async function publishSwitchPorts(omadaAuth, mqttClient, switches) {
    const siteId = omadaAuth.siteId;
    if (!siteId) {
        log('error', 'siteId Omada non défini.');
        return;
    }
    for (const sw of switches || []) {
        // Pour chaque switch, on va chercher les infos de ports
        const switchMac = sw.mac;
        const identifier = (sw.name || 'unknown')
            .toLowerCase()
            .replace(/[\s-]+/g, '_');

        if (!switchMac) {
            log('warn', 'Impossible de trouver la MAC Adresse du switch:', sw);
            continue;
        }
        if (!identifier.includes('p')) {
            log('debug', `Le switch ${identifier} n'a pas de port POE (nom sans 'p').`);
            continue;
        }

        const portsUrl = `/openapi/v1/${config.omada.omadac_id}/sites/${siteId}/switches/${switchMac}`;
        try {
            const portsResp = await omadaAuth.api.get(portsUrl);
            log('debug', `Récupération des ports pour le switch ${switchMac} (${portsResp})`);
            if (portsResp.data.errorCode === 0 && portsResp.data.result && portsResp.data.result.portList) {
                const ports = portsResp.data.result.portList;
                for (const element of ports) {
                    const portNum = element.port;
                    const topic = `${config.mqtt.baseTopic}/switch/${identifier}/ports/port${portNum}_poe_switch`;
                    const payload = element.poeMode === 1 ? 'on' : 'off'; // Assumant que 1 est "on" et 0 est "off"
                    mqttClient.publish(topic, payload, { retain: false }, (err) => {
                        if (err) {
                            log('error', `Publication MQTT échouée pour ${topic}:`, err);
                        } else {
                            log('debug', `Données port ${portNum} publiées sur ${topic}`);
                        }
                    });
                }
            } else {
                log('warn', `Erreur lors de la récupération des ports pour le switch ${switchMac}:`, portsResp);
            }
        } catch (err) {
            log('error', `Exception lors de la récupération des ports pour le switch ${switchMac}:`, err.response ? err.response.data : err.message);
        }
    }
}


module.exports = {
    publishAllDevices,
    publishSwitchPorts
};
