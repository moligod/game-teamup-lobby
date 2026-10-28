const QQ_BOT_TOKEN_URL = 'https://bots.qq.com/app/getAppAccessToken';
const QQ_BOT_API_BASE = 'https://api.bot.qq.com';
const QQ_BOT_GATEWAY_URL = 'https://api.bot.qq.com/gateway';

function responseDetail(payload) {
    if (!payload || typeof payload !== 'object') return '';
    return String(payload.message || payload.msg || payload.error || '').slice(0, 300);
}

function addReplyFields(body, options = {}) {
    const messageId = String(options.msgId ?? options.msg_id ?? '').trim();
    const eventId = String(options.eventId ?? options.event_id ?? '').trim();
    const messageSequence = Number(options.msgSeq ?? options.msg_seq);

    if (messageId) body.msg_id = messageId;
    else if (eventId) body.event_id = eventId;
    if (Number.isInteger(messageSequence) && messageSequence > 0) body.msg_seq = messageSequence;
    return body;
}

function textMessageBody(content, options = {}) {
    return addReplyFields({ content: String(content ?? ''), msg_type: 0 }, options);
}

function markdownMessageBody(content, options = {}) {
    const markdownContent = String(content ?? '').trim();
    if (!markdownContent) throw new Error('QQ Markdown content is required');

    const body = {
        msg_type: 2,
        markdown: { content: markdownContent }
    };
    if (options.keyboard && typeof options.keyboard === 'object') body.keyboard = options.keyboard;
    return addReplyFields(body, options);
}

class QqBotClient {
    constructor(options = {}) {
        this.fetch = options.fetch || globalThis.fetch;
        this.now = options.now || (() => Date.now());
        this.appId = '';
        this.appSecret = '';
        this.accessToken = null;
        this.accessTokenExpiresAt = 0;
        this.refreshingToken = null;
        this.setCredentials({
            appId: options.appId ?? process.env.QQ_BOT_APP_ID,
            appSecret: options.appSecret ?? process.env.QQ_BOT_APP_SECRET
        });
    }

    setCredentials({ appId, appSecret } = {}) {
        const nextAppId = String(appId || '').trim();
        const nextAppSecret = String(appSecret || '').trim();
        const changed = this.appId !== nextAppId || this.appSecret !== nextAppSecret;
        this.appId = nextAppId;
        this.appSecret = nextAppSecret;
        if (changed) {
            this.accessToken = null;
            this.accessTokenExpiresAt = 0;
            this.refreshingToken = null;
        }
    }

    getAppId() {
        return this.appId;
    }

    isConfigured() {
        return Boolean(this.appId && this.appSecret && typeof this.fetch === 'function');
    }

    async getAccessToken() {
        if (!this.isConfigured()) throw new Error('QQ bot is not configured');
        if (this.accessToken && this.accessTokenExpiresAt > this.now()) return this.accessToken;
        if (this.refreshingToken) return this.refreshingToken;

        this.refreshingToken = this.refreshAccessToken().finally(() => {
            this.refreshingToken = null;
        });
        return this.refreshingToken;
    }

    async refreshAccessToken() {
        const response = await this.fetch(QQ_BOT_TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ appId: this.appId, clientSecret: this.appSecret })
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.access_token) {
            throw new Error(`QQ bot token request failed (${response.status}): ${responseDetail(payload) || response.statusText}`);
        }

        const expiresInMs = Math.max(60_000, Number(payload.expires_in || 0) * 1000);
        this.accessToken = payload.access_token;
        this.accessTokenExpiresAt = this.now() + Math.max(0, expiresInMs - 60_000);
        return this.accessToken;
    }

    async getGatewayUrl() {
        const token = await this.getAccessToken();
        const response = await this.fetch(QQ_BOT_GATEWAY_URL, {
            headers: { Authorization: `QQBot ${token}` }
        });
        const payload = await response.json().catch(() => null);
        const gatewayUrl = String(payload?.url || '').trim();
        if (!response.ok || !gatewayUrl) {
            throw new Error(`QQ bot gateway request failed (${response.status}): ${responseDetail(payload) || response.statusText}`);
        }
        if (!/^wss:\/\//i.test(gatewayUrl)) throw new Error('QQ bot gateway returned an invalid WSS URL');
        return gatewayUrl;
    }

    async sendMessage(path, body, label) {
        const token = await this.getAccessToken();
        const response = await this.fetch(`${QQ_BOT_API_BASE}${path}`, {
            method: 'POST',
            headers: {
                Authorization: `QQBot ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
            throw new Error(`QQ ${label} message failed (${response.status}): ${responseDetail(payload) || response.statusText}`);
        }
        return payload;
    }

    async sendTextMessage(path, content, label, options = {}) {
        return this.sendMessage(path, textMessageBody(content, options), label);
    }

    async sendMarkdownMessage(path, content, label, options = {}) {
        return this.sendMessage(path, markdownMessageBody(content, options), label);
    }

    async sendGroupText(groupOpenid, content, options = {}) {
        const normalizedGroupOpenid = String(groupOpenid || '').trim();
        if (!normalizedGroupOpenid) throw new Error('QQ group_openid is required');
        return this.sendTextMessage(
            `/v2/groups/${encodeURIComponent(normalizedGroupOpenid)}/messages`,
            content,
            'group',
            options
        );
    }

    async sendC2cText(userOpenid, content, options = {}) {
        const normalizedUserOpenid = String(userOpenid || '').trim();
        if (!normalizedUserOpenid) throw new Error('QQ user_openid is required');
        return this.sendTextMessage(
            `/v2/users/${encodeURIComponent(normalizedUserOpenid)}/messages`,
            content,
            'C2C',
            options
        );
    }

    async sendGroupMarkdown(groupOpenid, content, options = {}) {
        const normalizedGroupOpenid = String(groupOpenid || '').trim();
        if (!normalizedGroupOpenid) throw new Error('QQ group_openid is required');
        return this.sendMarkdownMessage(
            `/v2/groups/${encodeURIComponent(normalizedGroupOpenid)}/messages`,
            content,
            'group',
            options
        );
    }

    async sendC2cMarkdown(userOpenid, content, options = {}) {
        const normalizedUserOpenid = String(userOpenid || '').trim();
        if (!normalizedUserOpenid) throw new Error('QQ user_openid is required');
        return this.sendMarkdownMessage(
            `/v2/users/${encodeURIComponent(normalizedUserOpenid)}/messages`,
            content,
            'C2C',
            options
        );
    }

    async acknowledgeInteraction(interactionId, code = 0) {
        const normalizedInteractionId = String(interactionId || '').trim();
        if (!normalizedInteractionId) throw new Error('QQ interaction_id is required');
        const token = await this.getAccessToken();
        const response = await this.fetch(
            `${QQ_BOT_API_BASE}/interactions/${encodeURIComponent(normalizedInteractionId)}`,
            {
                method: 'PUT',
                headers: {
                    Authorization: `QQBot ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ code: Number.isInteger(Number(code)) ? Number(code) : 0 })
            }
        );
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
            throw new Error(`QQ interaction acknowledgement failed (${response.status}): ${responseDetail(payload) || response.statusText}`);
        }
        return payload;
    }
}

module.exports = { QqBotClient };
