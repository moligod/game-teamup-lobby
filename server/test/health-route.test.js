const assert = require('node:assert/strict');
const test = require('node:test');
const { registerHealthRoute } = require('../src/platform/health/register-health-route');

function createResponse() {
    return {
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        }
    };
}

function register(database) {
    let handler;
    registerHealthRoute(
        {
            get(path, routeHandler) {
                assert.equal(path, '/health');
                handler = routeHandler;
            }
        },
        database,
        {
            service: 'trovebbs-test',
            startedAt: new Date('2026-01-01T00:00:00.000Z'),
            logger: { error: () => undefined }
        }
    );
    return handler;
}

test('health endpoint reports ready only after the database succeeds', async () => {
    const handler = register({ healthCheck: async () => undefined });
    const response = createResponse();

    await handler({}, response);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, {
        ok: true,
        service: 'trovebbs-test',
        database: 'ready',
        started_at: '2026-01-01T00:00:00.000Z'
    });
});

test('health endpoint returns 503 when the database is unavailable', async () => {
    const handler = register({ healthCheck: async () => { throw new Error('database unavailable'); } });
    const response = createResponse();

    await handler({}, response);

    assert.equal(response.statusCode, 503);
    assert.deepEqual(response.body, {
        ok: false,
        service: 'trovebbs-test',
        database: 'unavailable'
    });
});

test('health endpoint exposes bounded connection pool utilization when available', async () => {
    const handler = register({
        healthCheck: async () => undefined,
        getPoolStats: () => ({ max: 10, total: 4, idle: 3, waiting: 1 })
    });
    const response = createResponse();

    await handler({}, response);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body.database_pool, {
        max: 10,
        total: 4,
        idle: 3,
        waiting: 1
    });
});
