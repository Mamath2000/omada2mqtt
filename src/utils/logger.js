// logger.js : Logger centralisé avec gestion des niveaux
const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
let CURRENT_LOG_LEVEL = LOG_LEVELS.info;

function setLogLevel(level) {
    if (LOG_LEVELS[level] !== undefined) {
        CURRENT_LOG_LEVEL = LOG_LEVELS[level];
    }
}

function log(level, ...args) {
    if (LOG_LEVELS[level] >= CURRENT_LOG_LEVEL) {
        const prefix = `[${level.toUpperCase()}]`;
        if (level === 'error') {
            console.error(prefix, ...args);
        } else if (level === 'warn') {
            console.warn(prefix, ...args);
        } else if (level === 'debug') {
            console.debug(prefix, ...args);
        } else {
            console.log(prefix, ...args);
        }
    }
}

module.exports = {
    log,
    setLogLevel,
    LOG_LEVELS
};
