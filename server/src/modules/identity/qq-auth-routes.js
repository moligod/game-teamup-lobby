function getPublicBaseUrl(req, env) {
    const configured = env.PUBLIC_BASE_URL || env.VITE_API_BASE_URL || '';
    if (configured) return configured.replace(/\/+$/, '');
    return `${req.protocol}://${req.get('host')}`;
}

function configuredFrontendOrigins(env, config) {
    const origins = new Set();
    for (const value of [env.FRONTEND_BASE_URL, config?.frontend_success_path]) {
        if (!value) continue;
        try {
            origins.add(new URL(value, env.FRONTEND_BASE_URL || undefined).origin);
        } catch {
            // Ignore malformed administrator configuration instead of opening a redirect target.
        }
    }
    if (env.NODE_ENV !== 'production') {
        origins.add('http://localhost:5173');
        origins.add('http://127.0.0.1:5173');
    }
    return origins;
}

function getLoginReturnUrl(req, env, config) {
    const requested = typeof req.query?.return_to === 'string' ? req.query.return_to.trim() : '';
    if (!requested) return null;
    try {
        const url = new URL(requested);
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
        return configuredFrontendOrigins(env, config).has(url.origin) ? url.toString() : null;
    } catch {
        return null;
    }
}

function buildFrontendRedirect(req, env, params, config = null, returnTo = null) {
    const base = env.FRONTEND_BASE_URL || getPublicBaseUrl(req, env);
    const destination = returnTo || config?.frontend_success_path || '/';
    const url = new URL(destination, base);
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }
    return url.toString();
}

function registerQqAuthRoutes(app, service, options = {}) {
    const env = options.env || process.env;
    const logger = options.logger || console;

    app.get('/api/auth/qq/start', async (req, res) => {
        try {
            const callbackUrl = `${getPublicBaseUrl(req, env)}/api/auth/qq/callback`;
            const config = await service.getConfig();
            const returnTo = getLoginReturnUrl(req, env, config);
            const { loginUrl } = await service.beginLogin(callbackUrl, returnTo);
            res.json({ url: loginUrl });
        } catch (error) {
            logger.error('QQ login start failed:', error);
            res.status(error.statusCode || 500).json({ error: error.message || 'QQ登录初始化失败' });
        }
    });

    app.get('/api/auth/qq/callback', async (req, res) => {
        let config = null;
        try {
            config = await service.getConfig();
            const code = String(req.query.code || '').trim();
            const state = String(req.query.state || '').trim();
            if (!code) {
                return res.redirect(buildFrontendRedirect(req, env, { auth_error: 'missing_code' }, config));
            }
            const { ticket, returnTo } = await service.completeLogin(config, code, state);
            return res.redirect(buildFrontendRedirect(req, env, { qq_login: 'success', ticket }, config, returnTo));
        } catch (error) {
            logger.error('QQ login callback failed:', error);
            return res.redirect(buildFrontendRedirect(req, env, {
                auth_error: error.redirectCode || 'qq_callback_failed'
            }, config));
        }
    });

    app.post('/api/auth/qq/session', (req, res) => {
        const ticket = String(req.body.ticket || '').trim();
        const session = ticket ? service.consumeLoginTicket(ticket) : null;
        if (!session) {
            return res.status(401).json({ error: 'QQ 登录已过期，请重新登录' });
        }
        return res.json(session);
    });
}

module.exports = { buildFrontendRedirect, configuredFrontendOrigins, getLoginReturnUrl, getPublicBaseUrl, registerQqAuthRoutes };
