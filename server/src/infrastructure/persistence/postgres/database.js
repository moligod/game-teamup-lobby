const { PostgresClient } = require('./postgres-client');
const { isRetryableDatabaseStartupError, retry } = require('../../../platform/retry');
const { PostgresMigrationRunner } = require('./migration-runner');

const DATABASE_INIT_RETRY_ATTEMPTS = Number(process.env.DATABASE_INIT_RETRY_ATTEMPTS || 10);
const DATABASE_INIT_RETRY_DELAY_MS = Number(process.env.DATABASE_INIT_RETRY_DELAY_MS || 1000);

const DEFAULT_TEAM_TYPES = [
    { id: 'mijing', name: 'Secret Realm' },
    { id: 'anyingta', name: 'Shadow Tower' },
    { id: 'levi', name: 'Leviathan' },
    { id: 'wakuang', name: 'Mining Team' },
    { id: 'chuanche', name: 'Ship Team' },
    { id: 'duanzao', name: 'Forging Team' },
    { id: 'mojin', name: 'Treasure Team' },
    { id: 'hexin', name: 'Core Team' }
];

const DEFAULT_I18N = [
    { team_type_id: 'mijing', language: 'zh', name: '秘境' },
    { team_type_id: 'anyingta', language: 'zh', name: '暗影塔' },
    { team_type_id: 'levi', language: 'zh', name: '利维坦' },
    { team_type_id: 'wakuang', language: 'zh', name: '挖矿队' },
    { team_type_id: 'chuanche', language: 'zh', name: '船队' },
    { team_type_id: 'duanzao', language: 'zh', name: '锻造队' },
    { team_type_id: 'mojin', language: 'zh', name: '摸金队' },
    { team_type_id: 'hexin', language: 'zh', name: '核心队' },
    { team_type_id: 'mijing', language: 'en', name: 'Secret Realm' },
    { team_type_id: 'anyingta', language: 'en', name: 'Shadow Tower' },
    { team_type_id: 'levi', language: 'en', name: 'Leviathan' },
    { team_type_id: 'wakuang', language: 'en', name: 'Mining Team' },
    { team_type_id: 'chuanche', language: 'en', name: 'Ship Team' },
    { team_type_id: 'duanzao', language: 'en', name: 'Forging Team' },
    { team_type_id: 'mojin', language: 'en', name: 'Treasure Team' },
    { team_type_id: 'hexin', language: 'en', name: 'Core Team' }
];

class Database {
    constructor() {
        this.db = new PostgresClient();
        this.migrations = new PostgresMigrationRunner(this.db.pool);
        this.ready = retry(() => this.initDatabase(), {
            attempts: DATABASE_INIT_RETRY_ATTEMPTS,
            delayMs: DATABASE_INIT_RETRY_DELAY_MS,
            shouldRetry: isRetryableDatabaseStartupError,
            onRetry: (error, attempt, attempts) => {
                console.warn(`PostgreSQL initialization attempt ${attempt}/${attempts} failed; retrying: ${error.code || error.message}`);
            }
        });
        this.db.setReady(this.ready);
    }

    async initDatabase() {
        await this.migrations.run();
        await this.db.raw('BEGIN');
        try {
            await this.insertDefaultTeamTypes();
            await this.insertDefaultUsers();
            await this.insertDefaultI18nData();
            await this.insertDefaultAppSettings();
            await this.db.raw('COMMIT');
        } catch (error) {
            await this.db.raw('ROLLBACK').catch(() => {});
            throw error;
        }
    }

    async healthCheck() {
        await this.ready;
        await this.db.raw('SELECT 1 AS ok');
    }

    getPoolStats() {
        return this.db.getPoolStats();
    }

    async query(sql, params = []) {
        await this.ready;
        return this.db.raw(sql, params);
    }

    async one(sql, params = []) {
        const rows = await this.query(sql, params);
        return rows[0];
    }

    async exec(sql, params = []) {
        await this.ready;
        const result = await this.db.pool.query(sql, params);
        return { changes: result.rowCount || 0, lastID: result.rows[0] ? result.rows[0].id : undefined };
    }

    async withTransaction(callback) {
        await this.ready;
        const client = await this.db.pool.connect();
        try {
            await client.query('BEGIN');
            const query = async (sql, params = []) => client.query(sql, params);
            const result = await callback(query);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK').catch(() => {});
            throw error;
        } finally {
            client.release();
        }
    }

    async insertDefaultTeamTypes() {
        for (const team of DEFAULT_TEAM_TYPES) {
            await this.db.raw(
                'INSERT INTO team_types (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING',
                [team.id, team.name]
            );
        }
    }

    async insertDefaultUsers() {
        const adminPassword = String(process.env.ADMIN_PASSWORD || '').trim();
        if (adminPassword) {
            await this.db.raw(
                `INSERT INTO users (username, password, email, role)
                 VALUES ($1, $2, $3, 'admin')
                 ON CONFLICT (username) DO UPDATE SET
                    password = EXCLUDED.password,
                    email = EXCLUDED.email,
                    role = 'admin'`,
                [
                    process.env.ADMIN_USERNAME || 'admin',
                    adminPassword,
                    process.env.ADMIN_EMAIL || 'admin@example.com'
                ]
            );
        }
    }

    async insertDefaultI18nData() {
        for (const item of DEFAULT_I18N) {
            await this.db.raw(
                `INSERT INTO team_types_i18n (team_type_id, language, name)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (team_type_id, language) DO UPDATE SET
                    name = EXCLUDED.name`,
                [item.team_type_id, item.language, item.name]
            );
        }

        await this.db.raw(
            `INSERT INTO system_messages_i18n (message_key, language, content)
             VALUES ($1, $2, $3)
             ON CONFLICT (message_key, language) DO NOTHING`,
            [
                'announcement.maintenance',
                'en',
                'The system will undergo routine maintenance. Services may be unavailable during this time.'
            ]
        );
    }

    async insertDefaultAppSettings() {
        const settings = [
            {
                key: 'trovepal_api_key',
                value: process.env.TROVEPAL_API_KEY || '',
                secret: true
            },
            {
                key: 'trovepal_app_name',
                value: process.env.TROVEPAL_APP_NAME || 'TroveBBS',
                secret: false
            },
            {
                key: 'qq_bot_app_id',
                value: process.env.QQ_BOT_APP_ID || '',
                secret: false
            },
            {
                key: 'qq_bot_app_secret',
                value: process.env.QQ_BOT_APP_SECRET || '',
                secret: true
            },
            {
                key: 'qq_oauth_api_url',
                value: process.env.QQ_OAUTH_API_URL || 'https://your-oauth-provider.example/',
                secret: false
            },
            {
                key: 'qq_oauth_appid',
                value: process.env.QQ_OAUTH_APPID || '',
                secret: false
            },
            {
                key: 'qq_oauth_appkey',
                value: process.env.QQ_OAUTH_APPKEY || '',
                secret: true
            },
            {
                key: 'qq_oauth_callback_url',
                value: process.env.QQ_OAUTH_CALLBACK_URL || '',
                secret: false
            },
            {
                key: 'qq_oauth_frontend_success_path',
                value: process.env.QQ_OAUTH_FRONTEND_SUCCESS_PATH || '/',
                secret: false
            },
            {
                key: 'image_host_base_url',
                value: process.env.IMAGE_HOST_BASE_URL || '',
                secret: false
            },
            {
                key: 'image_host_api_key',
                value: process.env.IMAGE_HOST_API_KEY || '',
                secret: true
            },
            {
                key: 'image_host_review_folder_id',
                value: process.env.IMAGE_HOST_REVIEW_FOLDER_ID || '',
                secret: false
            }
        ];

        for (const setting of settings) {
            await this.db.raw(
                `INSERT INTO app_settings (setting_key, setting_value, is_secret)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (setting_key) DO NOTHING`,
                [setting.key, setting.value, setting.secret]
            );
        }
    }

    close() {
        return this.db.close();
    }
}

module.exports = Database;
