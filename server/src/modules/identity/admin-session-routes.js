function registerAdminSessionRoutes(app, service, options = {}) {
    const logger = options.logger || console;
    app.post('/api/admin/login', async (req, res) => {
        try {
            const result = await service.login(req.body.identifier, req.body.password);
            res.json(result);
        } catch (error) {
            if (error.statusCode && error.statusCode < 500) {
                return res.status(error.statusCode).json({ error: error.message });
            }
            logger.error('Admin login failed:', error);
            return res.status(500).json({ error: '管理员登录失败' });
        }
    });
}

function createRequireAdmin(service) {
    return (req, res, next) => {
        const auth = req.headers.authorization || '';
        const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
        const session = service.authenticate(token);
        if (!session) {
            return res.status(401).json({ error: '管理员登录已失效，请重新登录' });
        }
        req.admin = session;
        return next();
    };
}

module.exports = { createRequireAdmin, registerAdminSessionRoutes };
