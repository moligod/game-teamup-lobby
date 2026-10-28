const test = require('node:test');
const assert = require('node:assert/strict');
const { createLocalAuthService } = require('../src/modules/identity/local-auth-service');
const { createRateLimit } = require('../src/modules/identity/local-auth-routes');

test('local registration stores salted password hashes and login issues user sessions', async () => {
    const records = new Map();
    const repository = {
        async create(username, salt, password_hash) {
            if (records.has(username)) throw Object.assign(new Error('duplicate'), { code: '23505' });
            const user = { id: records.size + 1, username, salt, password_hash };
            records.set(username, user);
            return user;
        },
        async find(username) { return records.get(username); }
    };
    const service = createLocalAuthService({ repository, sessions: { create: user => `token-${user.id}` } });
    const input = { username: 'player_1', password: 'correct password' };
    const registered = await service.register(input);
    assert.equal(registered.token, 'token-1');
    assert.equal(registered.user.role, 'user');
    assert.notEqual(records.get(input.username).password_hash, input.password);
    assert.equal((await service.login(input)).user.username, input.username);
    await assert.rejects(service.login({ ...input, password: 'wrong password' }), e => e.statusCode === 401);
    await assert.rejects(service.login({ ...input, username: 'missing' }), e => e.statusCode === 401);
    await assert.rejects(service.register(input), e => e.statusCode === 409);
    await assert.rejects(service.register({ ...input, password: 'short' }), e => e.statusCode === 400);
    await assert.rejects(service.register({ ...input, username: 'bad name' }), e => e.statusCode === 400);
});

test('local authentication limiter bounds attempts per IP', () => {
    const limit = createRateLimit({ limit: 2 });
    let allowed = 0, status;
    const req = { ip: '127.0.0.1' };
    const res = { status(code) { status = code; return this; }, json() {} };
    for (let i = 0; i < 3; i++) limit(req, res, () => allowed++);
    assert.equal(allowed, 2);
    assert.equal(status, 429);
});
