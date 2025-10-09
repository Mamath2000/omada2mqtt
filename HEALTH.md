# 🏥 Health Check et Monitoring

omada2mqtt expose des endpoints HTTP pour le monitoring et les health checks.

## 🌐 Endpoints disponibles

### `/health` - Health Check
Endpoint principal pour les health checks Docker et orchestrateurs.

**URL**: `http://localhost:3000/health`

**Réponse (healthy)**:
```json
{
  "status": "healthy",
  "timestamp": "2025-10-09T10:30:00.000Z",
  "uptime": 3600.5,
  "service": "omada2mqtt",
  "version": "1.0.0",
  "checks": {
    "omada": "connected",
    "mqtt": "connected",
    "lastPolling": "2025-10-09T10:29:55.000Z"
  },
  "startTime": "2025-10-09T09:30:00.000Z"
}
```

**Réponse (unhealthy)**:
```json
{
  "status": "unhealthy",
  "checks": {
    "omada": "disconnected",
    "mqtt": "connected",
    "lastPolling": null
  }
}
```

**Codes de retour**:
- `200`: Service en bonne santé
- `503`: Service en erreur

### `/status` - Status détaillé
Endpoint pour le monitoring avancé avec plus d'informations.

**URL**: `http://localhost:3000/status`

**Réponse**:
```json
{
  "omadaConnected": true,
  "mqttConnected": true,
  "lastPolling": "2025-10-09T10:29:55.000Z",
  "startTime": "2025-10-09T09:30:00.000Z",
  "timestamp": "2025-10-09T10:30:00.000Z",
  "uptime": 3600.5,
  "service": "omada2mqtt",
  "version": "1.0.0",
  "memory": {
    "rss": 45678912,
    "heapTotal": 20971520,
    "heapUsed": 15728640,
    "external": 1048576,
    "arrayBuffers": 524288
  },
  "config": {
    "mqtt": {
      "url": "mqtt://192.168.1.100",
      "baseTopic": "omada2mqtt"
    },
    "omada": {
      "baseUrl": "https://192.168.1.1:8043",
      "site": "MonSite"
    },
    "homeassistant": {
      "enabled": true
    }
  }
}
```

## 🐳 Docker Health Check

Le health check Docker utilise l'endpoint `/health`:

```yaml
healthcheck:
  test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

## 📊 Monitoring avec Prometheus

Vous pouvez scraper l'endpoint `/status` avec Prometheus:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'omada2mqtt'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/status'
    scrape_interval: 30s
```

## 🔧 Configuration

### Variable d'environnement
- `HEALTH_PORT`: Port du serveur de santé (défaut: 3000)

### Docker Compose
```yaml
environment:
  - HEALTH_PORT=3000
ports:
  - "3000:3000"
```

## 🚨 Monitoring et Alerting

### Vérification manuelle
```bash
# Health check simple
curl http://localhost:3000/health

# Status détaillé
curl http://localhost:3000/status | jq

# Vérifier le code de retour
curl -f http://localhost:3000/health && echo "OK" || echo "ERREUR"
```

### Scripts de monitoring
```bash
#!/bin/bash
# check_omada2mqtt.sh
HEALTH_URL="http://localhost:3000/health"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)

if [ "$STATUS" = "200" ]; then
    echo "OK - omada2mqtt healthy"
    exit 0
else
    echo "CRITICAL - omada2mqtt unhealthy (HTTP $STATUS)"
    exit 2
fi
```

### Intégration Grafana
Créez un dashboard avec ces requêtes:
- Status: `up{job="omada2mqtt"}`
- Uptime: `omada2mqtt_uptime_seconds`
- Connexions: `omada2mqtt_connections{type="mqtt"}`, `omada2mqtt_connections{type="omada"}`

## 🔍 Dépannage

### Service ne répond pas
```bash
# Vérifier que le port est ouvert
netstat -tuln | grep 3000

# Vérifier les logs Docker
docker logs omada2mqtt

# Tester depuis l'intérieur du conteneur
docker exec omada2mqtt wget -qO- http://localhost:3000/health
```

### Health check échoue
1. Vérifiez la connexion MQTT et Omada
2. Consultez les logs de l'application
3. Vérifiez la configuration réseau Docker

### Monitoring externe
Pour monitorer depuis l'extérieur du conteneur, exposez le port:
```yaml
ports:
  - "3000:3000"  # External:Internal
```