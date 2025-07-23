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
            connections : [
                ['mac', device.mac || '00:00:00:00:00:00'],
                ['ip', device.ip || '0.0.0.0']
            ]
        };

        // Liste des sensors à déclarer
        const sensors = [
            { key: 'type', name: 'Type', domain: 'sensor', value_template: '{{ value_json.type }}' },
            { key: 'ip', name: 'Adresse Ip', domain: 'sensor', value_template: '{{ value_json.ip }}' },
            { key: 'uptime', name: 'Uptime', domain: 'sensor', value_template: '{{ value_json.uptime }}' },
            { key: 'status', name: 'Etat', domain: 'binary_sensor', device_class: 'running', value_template: '{{ "on" if (value_json.status|int==1) else "off" }}' },
            { key: 'last_seen', name: 'Dernière Détection', domain: 'sensor', device_class: 'timestamp', value_template: '{{ as_datetime(value_json.lastSeen /1000) }}' },
            { key: 'cpuUtil', name: 'CPU', domain: 'sensor', value_template: '{{ value_json.cpuUtil }}', "unit_of_measurement": "%" },
            { key: 'memUtil', name: 'Mémoire', domain: 'sensor', value_template: '{{ value_json.memUtil }}', "unit_of_measurement": "%" },
            { key: 'name', name: 'Nom', domain: 'sensor', value_template: '{{ value_json.name }}' },
            { key: 'mac', name: 'MAC', domain: 'sensor', value_template: '{{ value_json.mac }}' },
        ];
        sensors.forEach(sensor => {
            const objectId = `${entityId}_${sensor.key}`;
            const topic = `${baseTopic}/${device.type}/${name}`;
            const configTopic = `homeassistant/${sensor.domain}/${baseId}/${sensor.key}/config`;
            const payload = {
                state_topic: topic,
                unique_id: `${baseId}_${sensor.key}`,
                object_id: objectId,
                device: haDevice,
                name: `${sensor.name}`,
                has_entity_name: true,
                expire_after: 600,
            };

            // Ajouter les propriétés spécifiques selon le type de sensor
            if (sensor.value_template) {payload.value_template = sensor.value_template;}
            if (sensor.device_class) {payload.device_class = sensor.device_class;}

            if (sensor.domain === 'binary_sensor') {
                // Pour binary_sensor
                payload.payload_on = 1;
                payload.payload_off = 0;

                // binary_sensor n'a pas unit_of_measurement
            } else if (sensor.domain === 'sensor') {
                // Pour sensor
                if (sensor.unit_of_measurement) {payload.unit_of_measurement = sensor.unit_of_measurement;}
            }

            log('debug', `Publishing HA Discovery: topic=${configTopic}, payload=${JSON.stringify(payload)}`);
            mqttClient.publish(configTopic, JSON.stringify(payload), { retain: true }, (err) => {
                if (err) {
                    console.error('Erreur MQTT:', err);
                } else {
                    log('debug', `HA Discovery publié avec succès sur ${configTopic}`);
                }
            });
          
            if (entry.ports) {
                Object.entries(entry.ports).forEach(([portNum, port]) => {
                    if (port.isPOE) {
                        // sg2008p_port2_poe_switch
                        const objectId = `${entityId}_port${portNum}`;
                        const stateTopic = `${baseTopic}/switch/${name}/ports/port${portNum}/poeState`;
                        const commandTopic = `${baseTopic}/switch/${name}/ports/port${portNum}/poeState/set`;
                        const configTopic = `homeassistant/switch/${baseId}/port${portNum}/config`;
                        const payload = {
                            name: port.name,
                            state_topic: stateTopic,
                            command_topic: commandTopic,
                            unique_id: `${baseId}_port${portNum}`,
                            object_id: objectId,
                            device_class: 'outlet',
                            value_template: '{{ value }}',
                            has_entity_name: true,
                            device: haDevice,
                            payload_on: 1,
                            payload_off: 0,
                            state_on: 1,
                            state_off: 0,
                        };
                        mqttClient.publish(configTopic, JSON.stringify(payload), { retain: true });
                    }
                });
            }
        });
    });
    log('info', 'Publication Home Assistant MQTT Discovery terminée.');
}

module.exports = { publishHADiscovery };
