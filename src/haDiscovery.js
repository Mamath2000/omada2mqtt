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
        const baseId = `omada_${sn}`;
        const baseTopic = config.mqtt.baseTopic;
        const entityId = `omada2mqtt_${name.replace(/[\s-]/g, '_').toLowerCase()}`;

        // Device info pour HA
        const haDevice = {
            identifiers: [sn],
            name: device.name,
            manufacturer: device.manufacturer || 'TP-Link',
            model: device.model || 'Unknown',
            serial_number: sn,
            sw_version: device.firmwareVersion || '',
            hw_version: device.modelVersion || '',
            connections: [
                ['mac', device.mac || '00:00:00:00:00:00'],
                ['ip', device.ip || '0.0.0.0']
            ]
        };

        const origin = {
            name: 'Omada2MQTT',
            url: 'https://github.com/Mamath2000/omada2mqtt.git'
        }

        // Liste des components
        let components = {
            type: {
                platform: 'sensor',
                name: 'Type',
                unique_id: `${baseId}_type`,
                object_id: `${entityId}_type`,
                has_entity_name: true,
                value_template: '{{ value_json.type }}'

            },
            ip: {
                platform: 'sensor',
                name: 'Adresse Ip',
                unique_id: `${baseId}_ip`,
                object_id: `${entityId}_ip`,
                has_entity_name: true,
                value_template: '{{ value_json.ip }}'
            },
            uptime: {
                platform: 'sensor',
                name: 'Uptime',
                unique_id: `${baseId}_uptime`,
                object_id: `${entityId}_uptime`,
                has_entity_name: true,
                value_template: '{{ value_json.uptime }}'
            },
            status: {
                platform: 'binary_sensor',
                name: 'Etat',
                device_class: 'running',
                unique_id: `${baseId}_status`,
                object_id: `${entityId}_status`,
                has_entity_name: true,
                value_template: '{{ value_json.status }}',
                payload_on : 1,
                payload_off : 0
            },
            last_seen: {
                platform: 'sensor',
                name: 'Dernière Détection',
                device_class: 'timestamp',
                unique_id: `${baseId}_last_seen`,
                object_id: `${entityId}_last_seen`,
                has_entity_name: true,
                value_template: '{{ as_datetime(value_json.lastSeen /1000) }}'
            },
            cpuUtil: {
                platform: 'sensor',
                name: 'CPU',
                unique_id: `${baseId}_cpu`,
                object_id: `${entityId}_cpu`,
                has_entity_name: true,
                value_template: '{{ value_json.cpuUtil }}',
                unit_of_measurement: "%"
            },
            memUtil: {
                platform: 'sensor',
                name: 'Mémoire',
                unique_id: `${baseId}_mem`,
                object_id: `${entityId}_mem`,
                has_entity_name: true,
                value_template: '{{ value_json.memUtil }}',
                unit_of_measurement: "%"

            },
            name: {
                platform: 'sensor',
                name: 'Nom',
                unique_id: `${baseId}_name`,
                object_id: `${entityId}_name`,
                has_entity_name: true,
                value_template: '{{ value_json.name }}'
            },
            mac: {
                platform: 'sensor',
                name: 'MAC',
                unique_id: `${baseId}_mac`,
                object_id: `${entityId}_mac`,
                has_entity_name: true,
                value_template: '{{ value_json.mac }}'
            }
        };
        if (entry.ports) {
            Object.entries(entry.ports).forEach(([portNum, port]) => {
                
                const objectId = `${entityId}_port${portNum}`;
                const stateTopic = `${baseTopic}/switch/${name}/ports/port${portNum}/poeState`;
                const commandTopic = `${baseTopic}/switch/${name}/ports/port${portNum}/poeState/set`;

                components[objectId]= {
                    platform: 'switch',
                    name: port.name,
                    state_topic: stateTopic,
                    command_topic: commandTopic,
                    unique_id: `${baseId}_port${portNum}`,
                    object_id: `${entityId}_port${portNum}`,
                    device_class: 'outlet',
                    value_template: '{{ value }}',
                    has_entity_name: true,
                    payload_on: 1,
                    payload_off: 0,
                    state_on: 1,
                    state_off: 0
                }
            });
        }

        const configTopic = `homeassistant/device/omada/${baseId}/config`;
        const payload = {
            device: haDevice,
            origin: origin,
            state_topic: `${baseTopic}/${device.type}/${name}`,
            components: components,
        };

        log('debug', `Publishing HA Discovery: topic=${configTopic}, payload=${JSON.stringify(payload)}`);
        mqttClient.publish(configTopic, JSON.stringify(payload), { retain: true }, (err) => {
            if (err) {
                console.error('Erreur MQTT:', err);
            } else {
                log('debug', `HA Discovery publié avec succès sur ${configTopic}`);
            }
        });

    });
    log('info', 'Publication Home Assistant MQTT Discovery terminée.');
}

module.exports = { publishHADiscovery };
