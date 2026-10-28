const assert = require('node:assert/strict');
const test = require('node:test');
const { ExpiringStore } = require('../src/platform/expiring-store');
const { createQqAuthService } = require('../src/modules/identity/qq-auth-service');
const { createAdminSessionService } = require('../src/modules/identity/admin-session-service');
const { createUserSessionService } = require('../src/modules/identity/user-session-service');
const { HmacSessionToken } = require('../src/infrastructure/identity/hmac-session-token');

function tokenFactory(bytes) {
    return `token-${bytes}`;
}

test('QQ login state and ticket are single-use values', async () => {
    const stateStore = new ExpiringStore();
    const ticketStore = new ExpiringStore();
    const requests = [];
    const service = createQqAuthService({
        repository: {
            getQqOauthConfig: async () => ({ api_url: 'https://oauth.example/', appid: 'app', appkey: 'key' }),
            createOrUpdateOauthUser: async () => ({ id: 7, username: 'qq-user', role: 'user' })
        },
        oauthClient: {
            request: async (url, params) => {
                requests.push([url, params]);
                return params.act === 'login'
                    ? { url: 'https://oauth.example/login' }
                    : { code: 0, social_uid: 'qq-7', nickname: 'QQ User' };
            }
        },
        stateStore,
        ticketStore,
        sessionService: { create: () => 'signed-user-token' },
        tokenFactory
    });

    const started = await service.beginLogin('https://trovebbs.example/api/auth/qq/callback', 'http://localhost:5173/lobby');
    assert.equal(started.loginUrl, 'https://oauth.example/login');
    const completed = await service.completeLogin(started.config, 'code-1', 'token-16');
    assert.equal(completed.ticket, 'token-32');
    assert.equal(completed.returnTo, 'http://localhost:5173/lobby');
    const session = service.consumeLoginTicket(completed.ticket);
    assert.equal(session.user.id, 7);
    assert.equal(session.token, 'signed-user-token');
    assert.equal(service.consumeLoginTicket(completed.ticket), null);
    await assert.rejects(service.completeLogin(started.config, 'code-2', 'token-16'), /Invalid OAuth state/);
    assert.equal(requests.length, 2);
});

test('signed user sessions reject tampering and expiration', () => {
    let now = 1000;
    const service = createUserSessionService(
        new HmacSessionToken('test-user-session-secret', { clock: () => now }),
        { sessionTtlMs: 100 }
    );
    const token = service.create({ id: 7, username: 'qq-user' });
    assert.equal(service.authenticate(token).userId, 7);
    assert.equal(service.authenticate(`${token}x`), null);
    now = 1101;
    assert.equal(service.authenticate(token), null);
});

test('ordinary user sessions default to seven days', () => {
    const now = 1_000;
    const service = createUserSessionService(
        new HmacSessionToken('test-user-session-secret', { clock: () => now })
    );
    const token = service.create({ id: 7, username: 'qq-user' });
    assert.equal(service.authenticate(token).expiresAt, now + (7 * 24 * 60 * 60 * 1000));
});

test('admin sessions authenticate and refresh through the session service', async () => {
    let now = 100;
    const service = createAdminSessionService({
        repository: {
            loginUser: async () => ({ id: 1, username: 'admin', role: 'admin' })
        },
        sessionStore: new ExpiringStore({ clock: () => now }),
        tokenFactory,
        sessionTtlMs: 50
    });

    const result = await service.login('admin', 'secret');
    assert.equal(result.token, 'token-32');
    now = 140;
    assert.equal(service.authenticate(result.token).userId, 1);
    now = 180;
    assert.equal(service.authenticate(result.token).userId, 1);
    now = 231;
    assert.equal(service.authenticate(result.token), null);
});
