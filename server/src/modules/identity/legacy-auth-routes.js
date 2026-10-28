function registerLegacyAuthRoutes(app) {
    app.all([
        '/api/register',
        '/api/login',
        '/api/check-username',
        '/api/forgot-password',
        '/api/reset-password',
        '/api/validate-reset-token'
    ], (req, res) => {
        res.status(410).json({ error: '账号密码注册登录已关闭，请使用 QQ 登录' });
    });
}

module.exports = { registerLegacyAuthRoutes };
