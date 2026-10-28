const fs = require('fs');
const path = require('path');

class PostgresMigrationRunner {
    constructor(pool, options = {}) {
        this.pool = pool;
        this.directory = options.directory || path.resolve(__dirname, '../../../../migrations');
    }

    async run() {
        await this.pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
            version TEXT PRIMARY KEY,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`);

        const appliedResult = await this.pool.query('SELECT version FROM schema_migrations');
        const applied = new Set(appliedResult.rows.map((row) => row.version));
        const files = fs.readdirSync(this.directory)
            .filter((file) => file.endsWith('.sql'))
            .sort((left, right) => left.localeCompare(right));

        for (const file of files) {
            if (applied.has(file)) continue;
            const sql = fs.readFileSync(path.join(this.directory, file), 'utf8');
            const client = await this.pool.connect();
            try {
                await client.query('BEGIN');
                await client.query('SET LOCAL statement_timeout = 0');
                await client.query('SET LOCAL lock_timeout = 0');
                await client.query('SET LOCAL idle_in_transaction_session_timeout = 0');
                await client.query({ text: sql, query_timeout: 0 });
                await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
                await client.query('COMMIT');
            } catch (error) {
                await client.query('ROLLBACK').catch(() => undefined);
                error.message = `Migration ${file} failed: ${error.message}`;
                throw error;
            } finally {
                client.release();
            }
        }
    }
}

module.exports = { PostgresMigrationRunner };
