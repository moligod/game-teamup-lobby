const assert = require('node:assert/strict');
const test = require('node:test');
const { isRetryableDatabaseStartupError, retry } = require('../src/platform/retry');

test('retry retries a temporary PostgreSQL startup failure then returns the result', async () => {
    let calls = 0;
    const retries = [];
    const result = await retry(
        async () => {
            calls += 1;
            if (calls < 3) {
                const error = new Error('the database system is starting up');
                error.code = '57P03';
                throw error;
            }
            return 'ready';
        },
        {
            attempts: 3,
            delayMs: 1,
            shouldRetry: isRetryableDatabaseStartupError,
            onRetry: (error, attempt) => retries.push([error.code, attempt]),
            sleep: async () => undefined
        }
    );

    assert.equal(result, 'ready');
    assert.equal(calls, 3);
    assert.deepEqual(retries, [['57P03', 1], ['57P03', 2]]);
});

test('retry fails immediately for a non-transient database error', async () => {
    const error = new Error('invalid schema');
    error.code = '42P01';

    await assert.rejects(
        retry(
            async () => { throw error; },
            { attempts: 3, shouldRetry: isRetryableDatabaseStartupError, sleep: async () => undefined }
        ),
        error
    );
});
