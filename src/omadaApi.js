// omadaApi.js : Classe d'accès aux données Omada (hors authentification)
const config = require('./utils/config');
const { log } = require('./utils/logger');

class OmadaApi {
    /**
     * Rafraîchit immédiatement la liste des devices et des ports (remplit this.devices)
     */
    async refreshDevicesAndPorts() {
        await this.#publishAllDevices();
        await this.#publishSwitchPorts();
        return this.getDevices();
    }
    constructor(omadaAuth) {
        this.omadaAuth = omadaAuth;
        // Structure : { [switchName]: { device: {...}, ports: { [portNum]: {...} } }, ... }
        this.devices = {}; 
        this.mqttClient = null;
        this.siteId = omadaAuth.siteId || null;
    }

    /**
     * Démarre le polling automatique des devices et ports
     * @param {object} mqttClient - Le client MQTT connecté
     * @param {number} deviceInterval - Intervalle de polling des devices (s)
     * @param {number} portInterval - Intervalle de polling des ports (s)
     */
    startPolling(deviceInterval = 60, portInterval = 5) {
        this.#publishAllDevices();
        this.#publishSwitchPorts();

        this._polling = this._polling || {};
        // Devices
        if (this._polling.device) clearInterval(this._polling.device);
        this._polling.device = setInterval(() => {
            this.#publishAllDevices();
        }, deviceInterval * 1000);

        // Ports
        if (this._polling.port) clearInterval(this._polling.port);
        this._polling.port = setInterval(() => {
            this.#publishSwitchPorts();
        }, portInterval * 1000);
    }

    /**
     * Arrête le polling automatique
     */
    stopPolling() {
        if (this._polling) {
            if (this._polling.device) clearInterval(this._polling.device);
            if (this._polling.port) clearInterval(this._polling.port);
            this._polling = {};
        }
    }
    
    /**
     * Récupère tous les devices du site Omada et publie chaque device sur MQTT.
     * Met à jour le cache interne des devices.
     */
    async #publishAllDevices() {
        if (!this.isSiteIdSet()) return;

        const fs = require('fs');
        const path = require('path');

        try {
            const url = `/openapi/v1/${config.omada.omadac_id}/sites/${this.siteId}/devices?pageSize=100&page=1`;
            const response = await this.omadaAuth.api.get(url);
            if (response.data.errorCode === 0 && response.data.result && response.data.result.data) {
                const devicesArr = response.data.result.data;
                log('info', `${devicesArr.length} devices trouvés sur le site.`);
                this.devices = {};
                devicesArr.forEach(device => {
                    const type = (device.type || '').toLowerCase();
                    if (!type || type === 'unknown') {
                        log('warn', 'deviceType/type manquant pour le device:', device);
                        return;
                    }
                    const name = (device.name || 'unknown')
                        .toLowerCase()
                        .replace(/[\s-]+/g, '_');
                    if (!this.devices[name]) this.devices[name] = { device, ports: {} };
                    else this.devices[name].device = device;
                    const topic = `${config.mqtt.baseTopic}/${type}/${name}`;
                    if (this.mqttClient) {
                        this.mqttClient.publish(topic, JSON.stringify(device), { retain: false }, (err) => {
                            if (err) {
                                log('error', `Publication MQTT échouée pour ${topic}:`, err);
                            } else {
                                log('info', `Données publiées sur ${topic}`);
                            }
                        });
                    }
                });

                // Sauvegarde debug si log level debug
                if (process.env.DEBUG || config.logLevel === 'debug') {
                    try {
                        const debugDir = path.join(__dirname, '../debug');
                        if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
                        const filePath = path.join(debugDir, `devices.json`);
                        fs.writeFileSync(filePath, JSON.stringify(this.devices, null, 2), 'utf8');
                    } catch (e) {
                        log('warn', `Erreur lors de la sauvegarde debug des devices:`, e.message);
                    }
                }

            } else {
                log('warn', 'Erreur lors de la récupération des devices, réponse inattendue:', response.data);
            }
        } catch (error) {
            log('error', 'Erreur lors de la récupération des devices Omada:', error.response ? error.response.data : error.message);
        }
    }

    /**
     * Récupère les informations de ports pour chaque switch du site et publie sur MQTT.
     * Met à jour le cache interne des états de ports.
     * @param {object} mqttClient - Le client MQTT connecté
     */
    async #publishSwitchPorts() {
        if (!this.isSiteIdSet()) return;

        // On ne traite que les switches
        const switches = Object.entries(this.devices)
            .filter(([name, entry]) => entry.device && (entry.device.type || '').toLowerCase() === 'switch');

        for (const [identifier, entry] of switches) {
            const sw = entry.device;
            const switchMac = sw.mac;
            if (!switchMac) {
                log('warn', 'Impossible de trouver la MAC Adresse du switch:', sw);
                continue;
            }
            const isPoeSwitch = identifier.includes('p');
            const portsUrl = `/openapi/v1/${config.omada.omadac_id}/sites/${this.siteId}/switches/${switchMac}`;
            try {
                const portsResp = await this.omadaAuth.api.get(portsUrl);
                log('debug', `Récupération des ports pour le switch ${switchMac} (${portsResp})`);
                if (portsResp.data.errorCode === 0 && portsResp.data.result && portsResp.data.result.portList) {
                    const ports = portsResp.data.result.portList;
                    if (!this.devices[identifier].ports) this.devices[identifier].ports = {};
                    for (const element of ports) {
                        const portNum = element.port;
                        const topic = `${config.mqtt.baseTopic}/switch/${identifier}/ports/port${portNum}`;
                        const publishData = {
                            name: element.name,
                            isPOE: isPoeSwitch,
                            profileName: element.profileName,
                            profileOverrideEnable: element.profileOverrideEnable,
                            poeState: element.poeMode,
                        };
                        this.devices[identifier].ports[portNum] = publishData;
                        if (this.mqttClient) {
                            Object.entries(publishData).forEach(([key, value]) => {
                                const fieldTopic = `${topic}/${key}`;
                                this.mqttClient.publish(fieldTopic, JSON.stringify(value), { retain: false }, (err) => {
                                    if (err) {
                                        log('error', `Publication MQTT échouée pour ${fieldTopic}:`, err);
                                    } else {
                                        log('debug', `Champ ${key} du port ${portNum} publié sur ${fieldTopic}`);
                                    }
                                });
                            });
                        }
                    }
                } else {
                    log('warn', `Erreur lors de la récupération des ports pour le switch ${switchMac}:`, portsResp);
                }
            } catch (err) {
                log('error', `Exception lors de la récupération des ports pour le switch ${switchMac}:`, err.response ? err.response.data : err.message);
            }
        }
    }

    /**
     * Applique une commande on/off sur un port PoE d'un switch Omada
     * @param {string} switchName - Nom normalisé du switch (identifiant MQTT)
     * @param {number|string} portNum - Numéro du port à contrôler
     * @param {string} action - 1 ou 0
     * @returns {Promise<void>}
     */
    async setSwitchPortPoe(switchName, portNum, action) {
        if (!this.isSiteIdSet()) return;

        // Vérifier que le switch et le port existent dans la nouvelle structure
        if (!this.devices[switchName] || !this.devices[switchName].ports[portNum]) {
            log('warn', `Switch ${switchName} ou port ${portNum} non trouvé dans devices.`);
            return;
        }

        const switchDevice = this.devices[switchName].device;
        const switchMac = switchDevice.mac;

        // Vérifier l'état de profileOverrideEnable
        const portState = this.devices[switchName].ports[portNum];
        if (portState.profileOverrideEnable === false) {
            const overrideUrl = `/openapi/v1/${config.omada.omadac_id}/sites/${this.siteId}/switches/${switchMac}/ports/${portNum}/profile-override`;
            try {
                const overrideResp = await this.omadaAuth.api.put(overrideUrl, { profileOverrideEnable: true });
                if (overrideResp.data.errorCode === 0) {
                    log('info', `Override du profil activé pour port ${portNum} du switch ${switchName}`);
                    this.devices[switchName].ports[portNum].profileOverrideEnable = true;
                    // Attendre un peu pour que l'override soit pris en compte
                    await new Promise(resolve => setTimeout(resolve, 300));
                } else {
                    log('warn', `Erreur lors de l'activation de l'override du profil pour port ${portNum} (${switchName}):`, overrideResp.data);
                    return;
                }
            } catch (e) {
                log('error', `Exception lors de l'activation de l'override du profil pour port ${portNum} (${switchName}):`, e.response ? e.response.data : e.message);
                return;
            }
        }

        // Mettre à jour le mode PoE
        const poeUrl = `/openapi/v1/${config.omada.omadac_id}/sites/${this.siteId}/switches/${switchMac}/ports/${portNum}/poe-mode`;
        try {
            const poeResp = await this.omadaAuth.api.put(poeUrl, { poeMode: action });
            if (poeResp.data.errorCode === 0) {
                log('info', `PoE du port ${portNum} du switch ${switchName} mis à jour: ${action}`);
                this.devices[switchName].ports[portNum].poeState = action;
            } else {
                log('warn', `Erreur lors de la mise à jour PoE du port ${portNum} (${switchName}):`, poeResp.data);
                return;
            }
        } catch (e) {
            log('error', `Exception lors de la mise à jour PoE du port ${portNum} (${switchName}):`, e.response ? e.response.data : e.message);
            return;
        }

        // Rafraîchir les ports
        await this.#publishSwitchPorts();
    }

    /**
     * Retourne la structure complète des devices (avec ports)
     */
    getDevices() {
        return this.devices;
    }

    /**
     * Check si le siteId est défini
     * @returns {boolean} - true si le siteId est défini, false sinon
     */
    isSiteIdSet() {
        if (!this.siteId) this.siteId = this.omadaAuth.siteId;
        if (!this.siteId) log('error', 'siteId Omada non défini.');
        return !!this.siteId;
    }

    /**
     * Définit le client MQTT à utiliser pour toutes les publications
     * @param {object} mqttClient - Le client MQTT connecté
     */
    setMqttClient(mqttClient) {
        this.mqttClient = mqttClient;
    }    
}

module.exports = OmadaApi;
