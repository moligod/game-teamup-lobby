const { Pool, types } = require('pg');

types.setTypeParser(20, (value) => Number(value));
types.setTypeParser(1700, (value) => Number(value));

const PROFESSION_COLUMNS = [
    'KNIGHT', 'GUNSLINGER', 'FAE_TRICKSTER', 'DRACOLYTE', 'NEON_NINJA',
    'CANDY_BARBARIAN', 'ICE_SAGE', 'SHADOW_HUNTER', 'PIRATE_CAPTAIN',
    'BOOMERANGER', 'TOMB_RAISER', 'LUNAR_LANCER', 'REVENANT',
    'CHLOROMANCER', 'DINO_TAMER', 'VANGUARDIAN', 'BARD', 'SOLARION'
];

function envInteger(name, fallback, minimum = 0) {
    const value = Number(process.env[name]);
    return Number.isInteger(value) && value >= minimum ? value : fallback;
}

class PostgresClient {
    constructor() {
        this.poolMax = envInteger('POSTGRES_POOL_MAX', 10, 1);
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            host: process.env.POSTGRES_HOST || 'postgres',
            port: Number(process.env.POSTGRES_PORT || 5432),
            database: process.env.POSTGRES_DB || 'game_hall',
            user: process.env.POSTGRES_USER || 'game_hall',
            password: process.env.POSTGRES_PASSWORD || 'game_hall_password',
            max: this.poolMax,
            idleTimeoutMillis: envInteger('POSTGRES_POOL_IDLE_TIMEOUT_MS', 30000),
            connectionTimeoutMillis: envInteger('POSTGRES_CONNECT_TIMEOUT_MS', 5000),
            statement_timeout: envInteger('POSTGRES_STATEMENT_TIMEOUT_MS', 60000),
            lock_timeout: envInteger('POSTGRES_LOCK_TIMEOUT_MS', 10000),
            idle_in_transaction_session_timeout: envInteger(
                'POSTGRES_IDLE_IN_TRANSACTION_TIMEOUT_MS',
                30000
            ),
            application_name: process.env.POSTGRES_APPLICATION_NAME || 'trovebbs-backend'
        });
        this.pool.on('error', (error) => {
            console.error('Unexpected idle PostgreSQL client error:', error.message);
        });
        this.transactionClient = null;
    }

    setReady(readyPromise) {
        readyPromise.catch((error) => {
            console.error('PostgreSQL initialization failed:', error);
        });
    }

    async raw(sql, params = []) {
        const command = sql.trim().replace(/;$/, '').toUpperCase();
        if (command === 'BEGIN') {
            if (!this.transactionClient) {
                this.transactionClient = await this.pool.connect();
                await this.transactionClient.query('BEGIN');
            }
            return [];
        }
        if (command === 'COMMIT' || command === 'ROLLBACK') {
            if (!this.transactionClient) return [];
            const client = this.transactionClient;
            this.transactionClient = null;
            try {
                await client.query(command);
                return [];
            } finally {
                client.release();
            }
        }

        const result = await (this.transactionClient || this.pool).query(sql, params);
        return this.normalizeRows(result.rows);
    }

    normalizeRows(rows) {
        return rows.map((row) => {
            const normalized = { ...row };
            for (const profession of PROFESSION_COLUMNS) {
                const lower = profession.toLowerCase();
                if (Object.prototype.hasOwnProperty.call(normalized, lower) &&
                    !Object.prototype.hasOwnProperty.call(normalized, profession)) {
                    normalized[profession] = normalized[lower];
                }
            }
            return normalized;
        });
    }

    close() {
        return this.pool.end();
    }

    getPoolStats() {
        return {
            max: this.poolMax,
            total: this.pool.totalCount,
            idle: this.pool.idleCount,
            waiting: this.pool.waitingCount
        };
    }
}

module.exports = { PostgresClient, PROFESSION_COLUMNS, envInteger };
