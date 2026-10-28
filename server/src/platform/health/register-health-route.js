function registerHealthRoute(app, database, options = {}) {
    const service = options.service || 'game-hall-backend';
    const startedAt = options.startedAt || new Date();
    const logger = options.logger || console;

    function poolStatus() {
        return typeof database.getPoolStats === 'function'
            ? { database_pool: database.getPoolStats() }
            : {};
    }

    app.get('/health', async (req, res) => {
        try {
            await database.healthCheck();
            res.json({
                ok: true,
                service,
                database: 'ready',
                ...poolStatus(),
                started_at: startedAt.toISOString()
            });
        } catch (error) {
            logger.error('Health check failed:', error.message);
            res.status(503).json({
                ok: false,
                service,
                database: 'unavailable',
                ...poolStatus()
            });
        }
    });
}

module.exports = { registerHealthRoute };
