function registerLegacyAuthRoutes(app) {
    app.all([
        '/api/register',
        '/api/login',
        '/api/check-username',
        '/api/forgot-password',
        '/api/reset-password',
        '/api/validate-reset-token'
    ], (req, res) => {
        res.status(410).json({ error: '旧版账号接口已关闭，请使用新版登录入口' });
    });
}

module.exports = { registerLegacyAuthRoutes };
