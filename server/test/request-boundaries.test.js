const assert = require('node:assert/strict');
const test = require('node:test');
const express = require('express');
const { createCollectorAuthMiddleware } = require('../src/modules/leaderboard/collector-auth-middleware');
const { registerLeaderboardRoutes } = require('../src/modules/leaderboard/leaderboard-routes');
const {
    createCollectorJsonParser,
    registerGeneralRequestBodyParsers,
    requestBodyErrorHandler
} = require('../src/platform/http/request-body');
const { createRequestLogger } = require('../src/platform/http/request-logger');

const COLLECTOR_TOKEN = 'test-collector-token-with-more-than-32-characters';

async function listen(app, context) {
    const server = app.listen(0);
    context.after(() => new Promise((resolve) => server.close(resolve)));
    await new Promise((resolve) => server.once('listening', resolve));
    return `http://127.0.0.1:${server.address().port}`;
}

function registerCollector(app, options = {}) {
    const calls = [];
    registerLeaderboardRoutes(app, {
        createSnapshot: async (body) => {
            calls.push(body);
            return { snapshot_id: 'snapshot-1', status: 'loading' };
        },
        stageSnapshotBoard: async () => ({}),
        publishSnapshot: async () => ({})
    }, {
        binaryEncoder: async () => ({ headers: {}, body: Buffer.alloc(0) }),
        requireCollector: createCollectorAuthMiddleware({
            token: options.token === undefined ? COLLECTOR_TOKEN : options.token,
            logger: options.logger || { error() {} }
        }),
        collectorJsonParser: createCollectorJsonParser({ limit: options.bodyLimit || '1kb' }),
        logger: { error() {} }
    });
    return calls;
}

test('collector routes authenticate before parsing and preserve the success response', async (context) => {
    const app = express();
    registerGeneralRequestBodyParsers(app, { jsonLimit: '128b' });
    const calls = registerCollector(app);
    app.use(requestBodyErrorHandler);
    const baseUrl = await listen(app, context);
    const url = `${baseUrl}/api/collector/leaderboard/snapshots`;

    const unauthorized = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{not-valid-json'
    });
    assert.equal(unauthorized.status, 401);
    assert.equal(unauthorized.headers.get('www-authenticate'), 'Bearer realm="leaderboard-collector"');

    const malformed = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${COLLECTOR_TOKEN}`
        },
        body: '{not-valid-json'
    });
    assert.equal(malformed.status, 400);
    assert.deepEqual(await malformed.json(), { error: 'Malformed JSON body', success: false });

    const successful = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${COLLECTOR_TOKEN}`
        },
        body: JSON.stringify({ source_date: '2026-07-20', expected_board_ids: ['1'] })
    });
    assert.equal(successful.status, 200);
    assert.deepEqual(await successful.json(), {
        success: true,
        snapshot_id: 'snapshot-1',
        status: 'loading'
    });
    assert.deepEqual(calls, [{ source_date: '2026-07-20', expected_board_ids: ['1'] }]);
});

test('missing collector configuration fails closed without calling the service', async (context) => {
    const app = express();
    registerGeneralRequestBodyParsers(app);
    const logs = [];
    const calls = registerCollector(app, {
        token: '',
        logger: { error: (message) => logs.push(message) }
    });
    app.use(requestBodyErrorHandler);
    const baseUrl = await listen(app, context);

    const response = await fetch(`${baseUrl}/api/collector/leaderboard/snapshots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
    });
    assert.equal(response.status, 503);
    assert.equal(calls.length, 0);
    assert.equal(logs.length, 1);
    assert.doesNotMatch(logs[0], /Bearer|test-collector/);
});

test('general and collector parsers return 413 at their independent byte limits', async (context) => {
    const app = express();
    registerGeneralRequestBodyParsers(app, { jsonLimit: '128b' });
    registerCollector(app, { bodyLimit: '256b' });
    app.post('/api/echo', (req, res) => res.json(req.body));
    app.use(requestBodyErrorHandler);
    const baseUrl = await listen(app, context);
    const body = JSON.stringify({ value: 'x'.repeat(512) });

    const general = await fetch(`${baseUrl}/api/echo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body
    });
    assert.equal(general.status, 413);
    assert.deepEqual(await general.json(), { error: 'Request body too large' });

    const collector = await fetch(`${baseUrl}/api/collector/leaderboard/snapshots`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${COLLECTOR_TOKEN}`
        },
        body
    });
    assert.equal(collector.status, 413);
    assert.deepEqual(await collector.json(), { error: 'Request body too large', success: false });
});

test('request logging records metadata without body values or URL query secrets', () => {
    const entries = [];
    const middleware = createRequestLogger({
        logger: { info: (...args) => entries.push(args) },
        clock: () => new Date('2026-07-20T12:00:00.000Z')
    });
    let nextCalled = false;
    middleware({
        method: 'POST',
        path: '/api/admin/login',
        originalUrl: '/api/admin/login?access_token=query-secret',
        body: { identifier: 'admin', password: 'body-secret' },
        get: (name) => ({
            'content-type': 'application/json',
            'content-length': '58'
        })[name]
    }, {}, () => { nextCalled = true; });

    assert.equal(nextCalled, true);
    assert.equal(entries.length, 1);
    const serialized = JSON.stringify(entries);
    assert.match(serialized, /api\/admin\/login/);
    assert.doesNotMatch(serialized, /body-secret|query-secret|identifier|password|access_token/);
});
