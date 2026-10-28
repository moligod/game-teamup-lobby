const { IdentityError } = require('./identity-error');

function normalizeConfig(config) {
    return {
        ...config,
        api_url: String(config.api_url || 'https://your-oauth-provider.example/').replace(/\/?$/, '/'),
        appid: String(config.appid || '').trim(),
        appkey: String(config.appkey || '').trim(),
        callback_url: String(config.callback_url || '').trim(),
        frontend_success_path: String(config.frontend_success_path || '/').trim() || '/'
    };
}

function normalizeOauthUser(payload) {
    const socialUid = String(payload.social_uid || payload.openid || payload.uid || '').trim();
    if (!socialUid) {
        throw new IdentityError('OAuth response missing social_uid', { redirectCode: 'qq_callback_failed' });
    }
    return {
        provider: 'qq',
        uid: socialUid,
        nickname: String(payload.nickname || payload.name || `QQ_${socialUid.slice(-6)}`).trim(),
        avatar: payload.faceimg || payload.avatar || null
    };
}

function createQqAuthService(options) {
    const {
        repository,
        oauthClient,
        stateStore,
        ticketStore,
        sessionService,
        tokenFactory,
        stateTtlMs = 10 * 60 * 1000,
        ticketTtlMs = 2 * 60 * 1000
    } = options;

    return {
        async getConfig() {
            return normalizeConfig(await repository.getQqOauthConfig());
        },

        async beginLogin(defaultCallbackUrl, returnTo = null) {
            const config = await this.getConfig();
            if (!config.appid || !config.appkey) {
                throw new IdentityError('QQ 登录未配置 APPID 或 APPKEY', {
                    code: 'QQ_NOT_CONFIGURED',
                    statusCode: 500
                });
            }

            const state = tokenFactory(16);
            stateStore.set(state, { returnTo }, stateTtlMs);
            const payload = await oauthClient.request(config.api_url, {
                act: 'login',
                appid: config.appid,
                appkey: config.appkey,
                type: 'qq',
                redirect_uri: config.callback_url || defaultCallbackUrl,
                state
            });
            const loginUrl = payload.url || payload.login_url || payload.redirect_url;
            if (!loginUrl) {
                throw new IdentityError(payload.msg || 'QQ登录接口未返回登录地址', {
                    code: 'QQ_LOGIN_URL_MISSING',
                    statusCode: 502
                });
            }
            return { loginUrl, config };
        },

        async completeLogin(config, code, state) {
            const loginState = stateStore.consume(state);
            if (!loginState) {
                throw new IdentityError('Invalid OAuth state', {
                    code: 'INVALID_OAUTH_STATE',
                    redirectCode: 'invalid_state'
                });
            }
            if (!config.appid || !config.appkey) {
                throw new IdentityError('QQ OAuth is not configured', {
                    code: 'QQ_NOT_CONFIGURED',
                    redirectCode: 'qq_not_configured'
                });
            }

            const payload = await oauthClient.request(config.api_url, {
                act: 'callback',
                appid: config.appid,
                appkey: config.appkey,
                type: 'qq',
                code
            });
            if (String(payload.code) !== '0') {
                throw new IdentityError(payload.msg || 'QQ callback failed', {
                    code: 'QQ_CALLBACK_FAILED',
                    redirectCode: payload.msg || 'callback_failed'
                });
            }

            const user = await repository.createOrUpdateOauthUser(normalizeOauthUser(payload));
            if (user.role === 'admin') {
                throw new IdentityError('Admin OAuth login is not allowed', {
                    code: 'ADMIN_NOT_ALLOWED',
                    redirectCode: 'admin_not_allowed'
                });
            }

            const ticket = tokenFactory(32);
            ticketStore.set(ticket, {
                user: { ...user, role: 'user' },
                token: sessionService.create(user)
            }, ticketTtlMs);
            return { ticket, user, returnTo: loginState.returnTo || null };
        },

        consumeLoginTicket(ticket) {
            return ticketStore.consume(ticket);
        }
    };
}

module.exports = { createQqAuthService, normalizeConfig, normalizeOauthUser };
