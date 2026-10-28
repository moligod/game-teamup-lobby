const crypto = require('crypto');

const DEFAULT_MIN_TOKEN_LENGTH = 32;

function getBearerToken(req) {
    const authorization = String(req.headers.authorization || '').trim();
    const match = /^Bearer\s+(.+)$/i.exec(authorization);
    return match ? match[1].trim() : '';
}

function digest(value) {
    return crypto.createHash('sha256').update(value, 'utf8').digest();
}

function createCollectorAuthMiddleware(options = {}) {
    const logger = options.logger || console;
    const minTokenLength = options.minTokenLength || DEFAULT_MIN_TOKEN_LENGTH;
    const expectedToken = String(options.token || '').trim();
    const configured = expectedToken.length >= minTokenLength;
    const expectedDigest = configured ? digest(expectedToken) : null;
    let configurationWarningLogged = false;

    return function requireCollector(req, res, next) {
        if (!configured) {
            if (!configurationWarningLogged) {
                logger.error(`Leaderboard collector is disabled: LEADERBOARD_COLLECTOR_TOKEN must contain at least ${minTokenLength} characters`);
                configurationWarningLogged = true;
            }
            return res.status(503).json({
                success: false,
                error: 'Leaderboard collector authentication is not configured'
            });
        }

        const providedToken = getBearerToken(req);
        const authenticated = providedToken
            && crypto.timingSafeEqual(digest(providedToken), expectedDigest);
        if (!authenticated) {
            res.set('WWW-Authenticate', 'Bearer realm="leaderboard-collector"');
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        return next();
    };
}

module.exports = {
    createCollectorAuthMiddleware,
    getBearerToken,
    DEFAULT_MIN_TOKEN_LENGTH
};
