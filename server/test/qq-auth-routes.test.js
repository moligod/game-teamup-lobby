const assert = require('node:assert/strict');
const test = require('node:test');
const { buildFrontendRedirect, getLoginReturnUrl } = require('../src/modules/identity/qq-auth-routes');

function request(returnTo) {
    return {
        query: { return_to: returnTo },
        protocol: 'http',
        get: () => '127.0.0.1:3000'
    };
}

test('QQ login keeps the Vite development origin as a one-time return target', () => {
    const env = { NODE_ENV: 'development', FRONTEND_BASE_URL: 'http://127.0.0.1:18080' };
    const config = { frontend_success_path: 'http://127.0.0.1:18080/' };
    const returnTo = getLoginReturnUrl(request('http://127.0.0.1:5173/lobby?view=teams'), env, config);
    assert.equal(returnTo, 'http://127.0.0.1:5173/lobby?view=teams');
    assert.equal(
        buildFrontendRedirect(request(''), env, { qq_login: 'success', ticket: 'ticket-1' }, config, returnTo),
        'http://127.0.0.1:5173/lobby?view=teams&qq_login=success&ticket=ticket-1'
    );
});

test('QQ login rejects untrusted return targets', () => {
    const env = { NODE_ENV: 'production', FRONTEND_BASE_URL: 'https://example.com' };
    const config = { frontend_success_path: '/' };
    assert.equal(getLoginReturnUrl(request('https://example.test/steal-token'), env, config), null);
    assert.equal(getLoginReturnUrl(request('https://example.com/lobby'), env, config), 'https://example.com/lobby');
});
