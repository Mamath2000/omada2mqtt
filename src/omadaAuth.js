

const axios = require('axios');
const config = require('./utils/config');
const { log, setLogLevel, LOG_LEVELS } = require('./utils/logger');

class omadaAuth {
    constructor() {
        this.api = axios.create({
            baseURL: config.omada.baseUrl,
            httpsAgent: new (require('https')).Agent({ rejectUnauthorized: false }),
        });
        this.token = null;
        this.refreshToken = null;
        this.tokenExpires = 0;
        this.refreshTimer = null;
        this.siteId = null;
    }

    setLogLevel(level) {
        setLogLevel(level);
    }

    /**
     * Se connecte à l'API Omada et récupère un token d'accès.
     */
    async login() {
        log('info', 'Tentative de connexion à l\'API Omada...');
        try {
            const loginUrl = `/openapi/authorize/token?grant_type=client_credentials`;
            const response = await this.api.post(loginUrl, {
                omadacId: config.omada.omadac_id,
                client_id: config.omada.client_id,
                client_secret: config.omada.client_secret,
            });

            const result = response.data.result;
            if (response.data.errorCode === 0 && result && result.accessToken) {
                this.token = result.accessToken;
                this.refreshToken = result.refreshToken;
                const expiresIn = (result.expiresIn || 3600) - 60;
                this.tokenExpires = Date.now() + expiresIn * 1000;
                this.api.defaults.headers.common['Authorization'] = `AccessToken=${this.token}`;
                log('info', 'Connexion à l\'API Omada réussie.');
                log('debug', 'AccessToken:', this.token);
                log('debug', 'RefreshToken:', this.refreshToken);
                this.scheduleTokenRefresh();
                await this.getSiteId();
                return true;
            } else {
                log('error', 'Erreur de connexion à Omada: Token non trouvé dans la réponse', response.data);
                return false;
            }
        } catch (error) {
            log('error', 'Erreur lors de la connexion à l\'API Omada:', error.response ? error.response.data : error.message);
            return false;
        }
    }

    /**
     * Renouvelle le token d'accès en utilisant le refresh token.
     */
    async doRefreshToken() {
        log('info', 'Tentative de renouvellement du token...');
        try {
            // Les paramètres doivent être passés dans l'URL (query string)
            const refreshUrl = `/openapi/authorize/token?client_id=${encodeURIComponent(config.omada.client_id)}&client_secret=${encodeURIComponent(config.omada.client_secret)}&refresh_token=${encodeURIComponent(this.refreshToken)}&grant_type=refresh_token`;
            const response = await this.api.post(refreshUrl, {}, {
                headers: { 'content-type': 'application/json' }
            });

            const result = response.data.result;
            if (response.data.errorCode === 0 && result && result.accessToken) {
                this.token = result.accessToken;
                this.refreshToken = result.refreshToken;
                const expiresIn = (result.expiresIn || 3600) - 60;
                this.tokenExpires = Date.now() + expiresIn * 1000;
                this.api.defaults.headers.common['Authorization'] = `AccessToken=${this.token}`;
                log('info', 'Token renouvelé avec succès.');
                log('debug', 'AccessToken:', this.token);
                log('debug', 'RefreshToken:', this.refreshToken);
                this.scheduleTokenRefresh();
            } else {
                log('warn', 'Échec du renouvellement du token, nouvelle connexion nécessaire.', response.data);
                await this.login();
            }
        } catch (error) {
            log('error', 'Erreur lors du renouvellement du token:', error.response ? error.response.data : error.message);
            await this.login();
        }
    }

    /**
     * Programme le prochain renouvellement de token.
     */
    scheduleTokenRefresh() {
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
        }
        // Prendre une marge de 10 minutes (600 secondes) avant l'expiration
        const marginMs = 10 * 60 * 1000;
        let refreshDelay = this.tokenExpires - Date.now() - marginMs;
        if (refreshDelay < 0) refreshDelay = 0;
        if (this.tokenExpires > Date.now()) {
            this.refreshTimer = setTimeout(() => this.doRefreshToken(), refreshDelay);
            log(
                'info',
                `Renouvellement du token programmé dans ${Math.round(refreshDelay / 1000 / 60)} minutes (avec marge de 10min).`
            );
        } else {
            this.doRefreshToken();
        }
    }

    /**
     * Récupère l'ID du site configuré.
     */
    async getSiteId() {
        if (!this.token) {
            log('error', 'Vous devez être connecté pour récupérer l\'ID du site.');
            return;
        }
        try {
            const sitesUrl = `/openapi/v1/${config.omada.omadac_id}/sites?pageSize=100&page=1`;
            const response = await this.api.get(sitesUrl);
            if (response.data.errorCode === 0 && response.data.result && response.data.result.data) {
                log('info', '[INFO] Liste des sites récupérée :');
                response.data.result.data.forEach(site => {
                    log('info', `  - ${site.name} (siteId: ${site.siteId})`);
                });
                const site = response.data.result.data.find(s => s.name === config.omada.site);
                if (site) {
                    this.siteId = site.siteId;
                    log('info', `ID du site '${config.omada.site}' trouvé: ${this.siteId}`);
                } else {
                    log('warn', `Le site '${config.omada.site}' n'a pas été trouvé.`);
                }
            } else {
                log('warn', 'Erreur lors de la récupération des sites, réponse inattendue:', response.data);
            }
        } catch (error) {
            log('error', 'Erreur lors de la récupération des sites Omada:', error.response ? error.response.data : error.message);
        }
    }
}

module.exports = new omadaAuth();
