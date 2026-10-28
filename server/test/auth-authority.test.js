const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const express = require('express');
const WebSocket = require('ws');
const WebSocketManager = require('../websocket');
const { HmacSessionToken } = require('../src/infrastructure/identity/hmac-session-token');
const { createUserSessionService } = require('../src/modules/identity/user-session-service');
const { createUserAuthMiddleware } = require('../src/modules/identity/user-auth-middleware');
const { registerMarketRoutes } = require('../src/modules/market/market-routes');
const { registerPlayerRoutes } = require('../src/modules/players/player-routes');

function createSessionService() {
    return createUserSessionService(new HmacSessionToken('test-user-session-secret'));
}

test('protected HTTP routes derive user identity from the signed session', async (context) => {
    const sessionService = createSessionService();
    const token = sessionService.create({ id: 7, username: 'signed-user' });
    const { requireUser } = createUserAuthMiddleware(sessionService);
    const calls = [];
    const app = express();
    app.use(express.json());
    registerPlayerRoutes(app, {
        bindPlayer: async (userId, playerName) => {
            calls.push([userId, playerName]);
            return { playerName };
        }
    }, { requireUser, logger: { error() {} } });
    const server = app.listen(0);
    context.after(() => server.close());
    await new Promise((resolve) => server.once('listening', resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    const unauthorized = await fetch(`${baseUrl}/api/user/bind-player`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 999, playerName: 'Player' })
    });
    assert.equal(unauthorized.status, 401);

    const authorized = await fetch(`${baseUrl}/api/user/bind-player`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: 999, playerName: 'Player' })
    });
    assert.equal(authorized.status, 200);
    assert.deepEqual(calls, [[7, 'Player']]);
});

test('dishonesty submissions require a signed session and pass its user ID to the market service', async (context) => {
    const sessionService = createSessionService();
    const token = sessionService.create({ id: 17, username: 'reporter' });
    const { requireUser } = createUserAuthMiddleware(sessionService);
    const app = express();
    app.use(express.json());
    registerMarketRoutes(app, {
        createDishonestyReport: async (input, userId) => ({ id: 4, ...input, reporter_id: userId })
    }, {
        requireAdmin: (req, res) => res.status(403).end(),
        requireUser,
        upload: { array: () => (req, res, next) => next() },
        logger: { error() {} }
    });
    const server = app.listen(0);
    context.after(() => server.close());
    await new Promise((resolve) => server.once('listening', resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const body = { dishonest_qq: '12345', reason: 'Missing delivery', evidence_urls: ['https://images.example/proof.png'] };

    const unauthorized = await fetch(`${baseUrl}/api/market/dishonesty-reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    assert.equal(unauthorized.status, 401);

    const authorized = await fetch(`${baseUrl}/api/market/dishonesty-reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
    });
    assert.equal(authorized.status, 201);
    assert.equal((await authorized.json()).reporter_id, 17);
});

test('administrator market deletion is blocked before the deletion service runs', async (context) => {
    let deleteCalled = false;
    const app = express();
    app.use(express.json());
    registerMarketRoutes(app, {
        deleteAdminListing: async () => {
            deleteCalled = true;
            return { id: 4 };
        }
    }, {
        requireAdmin: (_req, res) => res.status(403).end(),
        requireUser: (_req, res) => res.status(401).end(),
        upload: { array: () => (_req, _res, next) => next() },
        logger: { error() {} }
    });
    const server = app.listen(0);
    context.after(() => server.close());
    await new Promise((resolve) => server.once('listening', resolve));

    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/market/listings/4`, {
        method: 'DELETE'
    });

    assert.equal(response.status, 403);
    assert.equal(deleteCalled, false);
});

test('websocket identity ignores claimed userId and accepts only a signed token', async (context) => {
    const sessionService = createSessionService();
    const token = sessionService.create({ id: 7, username: 'signed-user' });
    const server = http.createServer();
    const manager = new WebSocketManager(server, {
        authenticateToken: (value) => sessionService.authenticate(value)
    });
    server.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    context.after(() => {
        manager.wss.close();
        server.close();
    });
    const baseUrl = `ws://127.0.0.1:${server.address().port}`;

    async function connect(path, protocols) {
        const socket = new WebSocket(`${baseUrl}${path}`, protocols);
        const message = await new Promise((resolve, reject) => {
            socket.once('message', (data) => resolve(JSON.parse(data.toString())));
            socket.once('error', reject);
        });
        socket.close();
        return message;
    }

    const claimed = await connect('/ws?userId=999');
    assert.equal(claimed.data.userId, null);
    const authenticated = await connect('/ws?userId=999', ['trovebbs', `bearer.${token}`]);
    assert.equal(authenticated.data.userId, '7');
});
