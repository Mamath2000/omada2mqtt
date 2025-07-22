// haDiscovery.js : Publication Home Assistant MQTT Discovery pour Omada2MQTT
// Utilise la structure devices (clé = nom normalisé, valeur = { device, ports })
const config = require('./utils/config');
const { log } = require('./utils/logger');

/**
 * Publie la configuration MQTT Discovery Home Assistant pour tous les devices et ports
 * @param {object} mqttClient - client MQTT
 * @param {object} devices - structure devices (clé = nom, valeur = { device, ports })
 */
function publishHADiscovery(mqttClient, devices) {
    if (!mqttClient || !devices) return;
    Object.entries(devices).forEach(([name, entry]) => {
        const device = entry.device;
        if (!device) return;

        const sn = device.sn;
        const baseId = `omada2mqtt_${sn}`;
        const baseTopic = config.mqtt.baseTopic;

        // Device info pour HA
        const haDevice = {
            identifiers: [sn],
            name: device.name,
            manufacturer: device.manufacturer || 'TP-Link',
            model: device.model || 'Unknown',
            sw_version: device.firmwareVersion || '',
        };

        const haOrigin = {
            name: "Omada2MQTT",
            url: 'github.com/mamath/omada2mqtt'
        };
        // Liste des sensors à déclarer
        const sensors = [
            { key: 'type', name: 'Type', value: device.type, domain: 'sensor' , value_template: "{{ value_json.type }}" },
            { key: 'ip', name: 'IP', value: device.ip, domain: 'sensor', value_template: "{{ value_json.ip }}" },
            { key: 'uptime', name: 'Uptime', value: device.uptime, domain: 'sensor', value_template: "{{ value_json.uptime }}" },
            { key: 'status', name: 'Status', value: device.status, domain: 'binary_sensor', device_class: 'running', value_template: "{{ 'on' if value_json.state==1 else 'off' }}" },
            { key: 'last_seen', name: 'Last Seen', value: device.lastSeen, domain: 'sensor', device_class: 'timestamp', value_template: "{{ as_datetime(value_json.lastSeen /1000) }}" },
            { key: 'cpuUtil', name: 'CPU Util', value: device.cpuUtil, domain: 'sensor', value_template: "{{ value_json.cpuUtil }}",  "unit_of_measurement": "%" },
            { key: 'memUtil', name: 'Memory Util', value: device.memUtil, domain: 'sensor', value_template: "{{ value_json.memUtil }}",  "unit_of_measurement": "%" },
        ];
        sensors.forEach(sensor => {
            const objectId = `${baseId}_${sensor.key}`;
            const topic = `${baseTopic}/${device.type}/${name}`;
            const configTopic = `homeassistant/${sensor.domain}/${baseId}/${sensor.key}/config`;
            const payload = {
                ...sensor,
                state_topic: topic,
                unique_id: objectId,
                objectId: objectId,
                device: haDevice,
                origin: haOrigin,
                name: `${sensor.name}`,
                has_entity_name: true,
                expire_after: 600,
            };
            delete payload.key; // Supprimer la clé 'key' pour éviter les conflits
            delete payload.domain; // Supprimer la clé 'domain' pour éviter les conflits

            mqttClient.publish(configTopic, JSON.stringify(payload), { retain: false });
        });
        // Switchs pour chaque port PoE
        if (entry.ports) {
            Object.entries(entry.ports).forEach(([portNum, port]) => {
                if (port.isPOE) {
                    const objectId = `${baseId}_poe_port${portNum}`;
                    const stateTopic = `${baseTopic}/switch/${name}/ports/port${portNum}/poeState`;
                    const commandTopic = `${baseTopic}/switch/${name}/ports/port${portNum}/poeState/set`;
                    const configTopic = `homeassistant/${sensor.domain}/${baseId}/${sensor.key}_port${portNum}/config`;
                    const payload = {
                        name: `${device.name} PoE Port ${portNum}`,
                        state_topic: stateTopic,
                        command_topic: commandTopic,
                        unique_id: objectId,
                        device: haDevice,
                        payload_on: 'on',
                        payload_off: 'off',
                    };
                    mqttClient.publish(configTopic, JSON.stringify(payload), { retain: false });
                }
            });
        }
    });
    log('info', 'Publication Home Assistant MQTT Discovery terminée.');
}

module.exports = { publishHADiscovery };
