const assert = require('node:assert/strict');
const test = require('node:test');
const { QqBotClient } = require('../src/infrastructure/qq-bot/qq-bot-client');

test('QQ bot client caches the API v2 access token and sends a group message', async () => {
    const calls = [];
    const client = new QqBotClient({
        appId: '1234567890',
        appSecret: 'test-secret',
        now: () => 1_000,
        fetch: async (url, options) => {
            calls.push({ url, options });
            if (url.includes('getAppAccessToken')) {
                return { ok: true, status: 200, json: async () => ({ access_token: 'access-token', expires_in: 7200 }) };
            }
            return { ok: true, status: 200, json: async () => ({ id: 'message-id' }) };
        }
    });

    await client.sendGroupText('group-openid', 'hello');
    await client.sendGroupText('group-openid', 'again');

    assert.equal(calls.length, 3);
    assert.deepEqual(JSON.parse(calls[0].options.body), { appId: '1234567890', clientSecret: 'test-secret' });
    assert.equal(calls[1].url, 'https://api.bot.qq.com/v2/groups/group-openid/messages');
    assert.equal(calls[1].options.headers.Authorization, 'QQBot access-token');
    assert.deepEqual(JSON.parse(calls[1].options.body), { content: 'hello', msg_type: 0 });
});

test('QQ bot client sends a C2C reply with the originating message ID', async () => {
    const calls = [];
    const client = new QqBotClient({
        appId: 'app-id',
        appSecret: 'test-secret',
        fetch: async (url, options) => {
            calls.push({ url, options });
            if (url.includes('getAppAccessToken')) {
                return { ok: true, status: 200, json: async () => ({ access_token: 'access-token', expires_in: 7200 }) };
            }
            return { ok: true, status: 200, json: async () => ({ id: 'message-id' }) };
        }
    });

    await client.sendC2cText('user-openid', 'hello', { msgId: 'incoming-message', msgSeq: 2 });

    assert.equal(calls[1].url, 'https://api.bot.qq.com/v2/users/user-openid/messages');
    assert.deepEqual(JSON.parse(calls[1].options.body), {
        content: 'hello',
        msg_type: 0,
        msg_id: 'incoming-message',
        msg_seq: 2
    });
});

test('QQ bot client sends a Markdown card with an inline keyboard', async () => {
    const calls = [];
    const client = new QqBotClient({
        appId: 'app-id',
        appSecret: 'test-secret',
        fetch: async (url, options) => {
            calls.push({ url, options });
            if (url.includes('getAppAccessToken')) {
                return { ok: true, status: 200, json: async () => ({ access_token: 'access-token', expires_in: 7200 }) };
            }
            return { ok: true, status: 200, json: async () => ({ id: 'message-id' }) };
        }
    });
    const keyboard = {
        content: {
            rows: [{
                buttons: [{
                    id: 'open-lobby',
                    render_data: { label: '打开大厅', style: 1 },
                    action: { type: 0, permission: { type: 2 }, data: 'https://example.com/lobby' }
                }]
            }]
        }
    };

    await client.sendGroupMarkdown('group-openid', '## TroveBBS 新组队', {
        msgId: 'incoming-message',
        msgSeq: 3,
        keyboard
    });

    assert.equal(calls[1].url, 'https://api.bot.qq.com/v2/groups/group-openid/messages');
    assert.deepEqual(JSON.parse(calls[1].options.body), {
        msg_type: 2,
        markdown: { content: '## TroveBBS 新组队' },
        keyboard,
        msg_id: 'incoming-message',
        msg_seq: 3
    });
});

test('QQ bot client acknowledges interaction events', async () => {
    const calls = [];
    const client = new QqBotClient({
        appId: 'app-id',
        appSecret: 'test-secret',
        fetch: async (url, options) => {
            calls.push({ url, options });
            if (url.includes('getAppAccessToken')) {
                return { ok: true, status: 200, json: async () => ({ access_token: 'access-token', expires_in: 7200 }) };
            }
            return { ok: true, status: 200, json: async () => ({}) };
        }
    });

    await client.acknowledgeInteraction('interaction-id');

    assert.equal(calls[1].url, 'https://api.bot.qq.com/interactions/interaction-id');
    assert.equal(calls[1].options.method, 'PUT');
    assert.deepEqual(JSON.parse(calls[1].options.body), { code: 0 });
});

test('QQ bot client rejects an unsuccessful group response without exposing credentials', async () => {
    const client = new QqBotClient({
        appId: 'app-id',
        appSecret: 'test-secret',
        fetch: async (url) => url.includes('getAppAccessToken')
            ? { ok: true, status: 200, json: async () => ({ access_token: 'access-token', expires_in: 7200 }) }
            : { ok: false, status: 429, statusText: 'Too Many Requests', json: async () => ({ message: 'msg limit exceed' }) }
    });

    await assert.rejects(() => client.sendGroupText('group-openid', 'hello'), /QQ group message failed \(429\): msg limit exceed/);
});

test('QQ bot client replaces cached access tokens after credentials change', async () => {
    const requests = [];
    const client = new QqBotClient({
        appId: 'first-app',
        appSecret: 'first-secret',
        fetch: async (url, options) => {
            requests.push({ url, options });
            return { ok: true, status: 200, json: async () => ({ access_token: `token-${requests.length}`, expires_in: 7200 }) };
        }
    });

    await client.getAccessToken();
    client.setCredentials({ appId: 'second-app', appSecret: 'second-secret' });
    await client.getAccessToken();

    assert.equal(client.getAppId(), 'second-app');
    assert.deepEqual(JSON.parse(requests[0].options.body), { appId: 'first-app', clientSecret: 'first-secret' });
    assert.deepEqual(JSON.parse(requests[1].options.body), { appId: 'second-app', clientSecret: 'second-secret' });
});

test('QQ bot client resolves the Gateway URL with its Access Token', async () => {
    const calls = [];
    const client = new QqBotClient({
        appId: 'app-id',
        appSecret: 'app-secret',
        fetch: async (url, options) => {
            calls.push({ url, options });
            if (url.includes('getAppAccessToken')) {
                return { ok: true, status: 200, json: async () => ({ access_token: 'access-token', expires_in: 7200 }) };
            }
            return { ok: true, status: 200, json: async () => ({ url: 'wss://api.bot.qq.com/websocket/' }) };
        }
    });

    const gatewayUrl = await client.getGatewayUrl();

    assert.equal(gatewayUrl, 'wss://api.bot.qq.com/websocket/');
    assert.equal(calls[1].url, 'https://api.bot.qq.com/gateway');
    assert.equal(calls[1].options.headers.Authorization, 'QQBot access-token');
});
