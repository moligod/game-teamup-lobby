const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { PostgresMigrationRunner } = require('../src/infrastructure/persistence/postgres/migration-runner');

test('migrations disable runtime query guards inside their transaction', async (context) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'trovebbs-migration-'));
    context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    fs.writeFileSync(path.join(directory, '001_test.sql'), 'SELECT 42;', 'utf8');

    const clientCalls = [];
    const client = {
        async query(...args) {
            clientCalls.push(args);
            return { rows: [] };
        },
        release() {}
    };
    const pool = {
        async query(sql) {
            if (sql === 'SELECT version FROM schema_migrations') return { rows: [] };
            return { rows: [] };
        },
        async connect() {
            return client;
        }
    };

    await new PostgresMigrationRunner(pool, { directory }).run();

    assert.deepEqual(clientCalls.slice(0, 5), [
        ['BEGIN'],
        ['SET LOCAL statement_timeout = 0'],
        ['SET LOCAL lock_timeout = 0'],
        ['SET LOCAL idle_in_transaction_session_timeout = 0'],
        [{ text: 'SELECT 42;', query_timeout: 0 }]
    ]);
    assert.deepEqual(clientCalls.at(-1), ['COMMIT']);
});
