function createRateLimit({ windowMs = 15 * 60 * 1000, limit = 20, maxKeys = 10000 } = {}) {
    const entries = new Map();
    return (req, res, next) => {
        const now = Date.now(), key = req.ip || 'unknown';
        let item = entries.get(key);
        if (!item || item.expires <= now) {
            if (entries.size >= maxKeys) {
                for (const [k, v] of entries) if (v.expires <= now) entries.delete(k);
                if (entries.size >= maxKeys) return res.status(503).json({ error: 'Authentication busy, try again' });
            }
            item = { count: 0, expires: now + windowMs }; entries.set(key, item);
        }
        item.count += 1;
        if (item.count > limit) return res.status(429).json({ error: 'Too many attempts, try again later' });
        next();
    };
}
function registerLocalAuthRoutes(app, service, options = {}) {
    const limit = options.rateLimit || createRateLimit();
    const logger = options.logger || console;
    for (const method of ['register', 'login']) {
        app.post(`/api/auth/local/${method}`, limit, async (req, res) => {
            try { return res.json(await service[method](req.body)); }
            catch (error) {
                if (!error.statusCode || error.statusCode >= 500) logger.error('Local authentication failed');
                return res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Authentication failed' });
            }
        });
    }
}
module.exports = { createRateLimit, registerLocalAuthRoutes };
