const { parseQqBotContentConfig } = require('../../../modules/lobby/qq-bot-content-config');

const QQ_BOT_CONTENT_CONFIG_SETTING_KEY = 'qq_bot_content_config';

const ADMIN_TABLES = {
    users: { label: '注册用户', primaryKey: 'id', timeColumn: 'created_at' },
    teams: { label: '团队', primaryKey: 'id', timeColumn: 'created_at' },
    team_members: { label: '团队成员', primaryKey: 'id', timeColumn: 'joined_at' },
    team_applications: { label: '团队申请', primaryKey: 'id', timeColumn: 'applied_at' },
    messages: { label: '聊天消息', primaryKey: 'id', timeColumn: 'timestamp' },
    friends: { label: '好友关系', primaryKey: 'id', timeColumn: 'created_at' },
    user_player_bindings: { label: '游戏名绑定', primaryKey: 'id', timeColumn: 'created_at' },
    app_settings: { label: '站点配置', primaryKey: 'setting_key', timeColumn: 'updated_at' },
    player_profession_combat: { label: '角色战力', primaryKey: 'player_name', timeColumn: 'updated_at' },
    leaderboard_catalog: { label: '排行榜目录', primaryKey: null, timeColumn: 'updated_at' },
    leaderboard_snapshots: { label: '排行榜快照', primaryKey: null, timeColumn: 'created_at' },
    leaderboard_current_boards: { label: '当前排行榜', primaryKey: null, timeColumn: 'updated_at' }
};

const CLEANUP_TABLES = [
    'team_applications', 'messages', 'friends', 'user_player_bindings',
    'player_profession_combat', 'teams'
];

class PostgresAdminRepository {
    constructor(database) {
        this.database = database;
    }

    all(sql, params = []) {
        return this.database.query(sql, params);
    }

    query(sql, params = []) {
        return this.database.query(sql, params);
    }

    get(sql, params = []) {
        return this.database.one(sql, params);
    }

    run(sql, params = []) {
        return this.database.exec(sql, params);
    }

    raw(sql, params = []) {
        return this.database.query(sql, params);
    }

    withTransaction(callback) { return this.database.withTransaction(callback); }

    async getSummary() {
        const [users, teams, messages, applications, bindings] = await Promise.all([
            this.get('SELECT COUNT(*) as total_users FROM users'),
            this.get(`SELECT COUNT(*) as total_teams,
                SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_teams,
                SUM(CASE WHEN status = 'ended' THEN 1 ELSE 0 END) as ended_teams FROM teams`),
            this.get('SELECT COUNT(*) as total_messages FROM messages'),
            this.get("SELECT COUNT(*) as pending_applications FROM team_applications WHERE status = 'pending'"),
            this.get('SELECT COUNT(*) as bound_players FROM user_player_bindings')
        ]);
        return {
            total_users: users.total_users || 0,
            total_teams: teams.total_teams || 0,
            active_teams: teams.active_teams || 0,
            ended_teams: teams.ended_teams || 0,
            total_messages: messages.total_messages || 0,
            pending_applications: applications.pending_applications || 0,
            bound_players: bindings.bound_players || 0
        };
    }

    listUsers() {
        return this.all(`SELECT u.id, u.username, u.email, u.avatar, u.signature, u.role,
            u.created_at, u.online_status, u.is_online, upb.player_name,
            COALESCE(team_counts.team_count, 0) as team_count,
            COALESCE(friend_counts.friend_count, 0) as friend_count
          FROM users u
          LEFT JOIN user_player_bindings upb ON upb.user_id = u.id
          LEFT JOIN (SELECT user_id, COUNT(*) as team_count FROM team_members GROUP BY user_id) team_counts
            ON team_counts.user_id = u.id
          LEFT JOIN (
            SELECT user_id, COUNT(*) as friend_count FROM (
              SELECT user_id FROM friends WHERE status = 'accepted'
              UNION ALL
              SELECT friend_id as user_id FROM friends WHERE status = 'accepted'
            ) accepted_friends GROUP BY user_id
          ) friend_counts ON friend_counts.user_id = u.id
          ORDER BY u.id DESC LIMIT 500`);
    }

    findUser(userId) { return this.get('SELECT id, username, role FROM users WHERE id = $1', [userId]); }
    deleteUser(userId) { return this.run('DELETE FROM users WHERE id = $1', [userId]); }

    listTeams() {
        return this.all(`SELECT t.*, tt.name as team_type_name, u.username as leader_name,
            COALESCE(member_counts.member_count, 0) as member_count,
            COALESCE(application_counts.pending_applications, 0) as pending_applications
          FROM teams t
          LEFT JOIN team_types tt ON tt.id = t.team_type
          LEFT JOIN users u ON u.id = t.leader_id
          LEFT JOIN (SELECT team_id, COUNT(*) as member_count FROM team_members GROUP BY team_id) member_counts
            ON member_counts.team_id = t.id
          LEFT JOIN (
            SELECT team_id, COUNT(*) as pending_applications
            FROM team_applications WHERE status = 'pending' GROUP BY team_id
          ) application_counts ON application_counts.team_id = t.id
          ORDER BY t.created_at DESC LIMIT 500`);
    }

    updateTeamStatus(teamId, status) {
        return this.run('UPDATE teams SET status = $1 WHERE id = $2', [status, teamId]);
    }

    getTeam(teamId) {
        return this.get(`SELECT t.*, u.username as leader_name FROM teams t
          LEFT JOIN users u ON u.id = t.leader_id WHERE t.id = $1`, [teamId]);
    }

    listMessages(limit) {
        return this.all('SELECT * FROM messages ORDER BY timestamp DESC, id DESC LIMIT $1', [limit]);
    }
    deleteMessage(messageId) { return this.run('DELETE FROM messages WHERE id = $1', [messageId]); }

    listApplications() {
        return this.all(`SELECT ta.id, ta.status, ta.applied_at, ta.processed_at, ta.team_id,
            t.name as team_name, applicant.id as user_id, applicant.username as username,
            processor.username as processed_by_name
          FROM team_applications ta
          LEFT JOIN teams t ON t.id = ta.team_id
          LEFT JOIN users applicant ON applicant.id = ta.user_id
          LEFT JOIN users processor ON processor.id = ta.processed_by
          ORDER BY ta.applied_at DESC LIMIT 500`);
    }

    getTableConfig(tableName) { return ADMIN_TABLES[String(tableName || '')] || null; }

    async listTables() {
        return Promise.all(Object.entries(ADMIN_TABLES).map(async ([name, config]) => {
            const rows = await this.raw(`SELECT COUNT(*)::int AS rows FROM ${name}`);
            return {
                name,
                label: config.label,
                primary_key: config.primaryKey,
                time_column: config.timeColumn,
                rows: rows[0]?.rows || 0
            };
        }));
    }

    async readTable(tableName, limit) {
        const config = this.getTableConfig(tableName);
        if (!config) return null;
        const rows = await this.raw(
            `SELECT * FROM ${tableName} ORDER BY ${config.timeColumn} DESC LIMIT $1`,
            [limit]
        );
        return {
            table: tableName,
            label: config.label,
            primary_key: config.primaryKey,
            time_column: config.timeColumn,
            rows
        };
    }

    deleteTableRow(tableName, id) {
        const config = this.getTableConfig(tableName);
        if (!config?.primaryKey) return null;
        return this.run(`DELETE FROM ${tableName} WHERE ${config.primaryKey} = $1`, [id]);
    }

    async cleanup(from, to) {
        const deleted = [];
        await this.database.withTransaction(async (query) => {
            for (const tableName of CLEANUP_TABLES) {
                const config = ADMIN_TABLES[tableName];
                const result = await query(
                    `DELETE FROM ${tableName} WHERE ${config.timeColumn} >= $1 AND ${config.timeColumn} <= $2`,
                    [from, to]
                );
                deleted.push({ table: tableName, label: config.label, count: result.rowCount || 0 });
            }
        });
        return deleted;
    }

    async getQqBotConfig() {
        const rows = await this.query(
            `SELECT setting_key, setting_value, updated_at
             FROM app_settings
             WHERE setting_key IN ('qq_bot_app_id', 'qq_bot_app_secret')`
        );
        const byKey = new Map(rows.map((row) => [row.setting_key, row]));
        const appId = byKey.get('qq_bot_app_id')?.setting_value || '';
        const appSecret = byKey.get('qq_bot_app_secret')?.setting_value || '';
        return {
            app_id: appId,
            app_secret: appSecret,
            app_secret_configured: Boolean(String(appSecret).trim()),
            updated_at: rows.reduce((latest, row) => {
                const value = row.updated_at ? new Date(row.updated_at).getTime() : 0;
                return value > latest.value ? { value, updated_at: row.updated_at } : latest;
            }, { value: 0, updated_at: null }).updated_at
        };
    }

    async getQqBotPublicConfig() {
        const config = await this.getQqBotConfig();
        return {
            app_id: config.app_id,
            app_secret_configured: config.app_secret_configured,
            updated_at: config.updated_at
        };
    }

    async updateQqBotConfig(config) {
        const updates = [
            { key: 'qq_bot_app_id', value: config.app_id, secret: false }
        ];

        if (config.clear_app_secret) {
            updates.push({ key: 'qq_bot_app_secret', value: '', secret: true });
        } else if (typeof config.app_secret === 'string' && config.app_secret.trim()) {
            updates.push({ key: 'qq_bot_app_secret', value: config.app_secret.trim(), secret: true });
        }

        await this.withTransaction(async (query) => {
            for (const item of updates) {
                await query(
                    `INSERT INTO app_settings (setting_key, setting_value, is_secret, updated_at)
                     VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
                     ON CONFLICT (setting_key) DO UPDATE SET
                        setting_value = EXCLUDED.setting_value,
                        is_secret = EXCLUDED.is_secret,
                        updated_at = CURRENT_TIMESTAMP`,
                    [item.key, item.value, item.secret]
                );
            }
        });

        return this.getQqBotPublicConfig();
    }

    async getQqBotContentConfig() {
        const row = await this.get(
            `SELECT setting_value, updated_at
             FROM app_settings
             WHERE setting_key = $1`,
            [QQ_BOT_CONTENT_CONFIG_SETTING_KEY]
        );
        return {
            ...parseQqBotContentConfig(row?.setting_value),
            updated_at: row?.updated_at || null
        };
    }

    async updateQqBotContentConfig(config) {
        await this.run(
            `INSERT INTO app_settings (setting_key, setting_value, is_secret, updated_at)
             VALUES ($1, $2, false, CURRENT_TIMESTAMP)
             ON CONFLICT (setting_key) DO UPDATE SET
                setting_value = EXCLUDED.setting_value,
                is_secret = EXCLUDED.is_secret,
                updated_at = CURRENT_TIMESTAMP`,
            [QQ_BOT_CONTENT_CONFIG_SETTING_KEY, JSON.stringify(config)]
        );
        return this.getQqBotContentConfig();
    }

    async getQqOauthConfig() {
        const rows = await this.query(
            `SELECT setting_key, setting_value, updated_at
             FROM app_settings
             WHERE setting_key IN (
                'qq_oauth_api_url',
                'qq_oauth_appid',
                'qq_oauth_appkey',
                'qq_oauth_callback_url',
                'qq_oauth_frontend_success_path'
             )`
        );
        const byKey = new Map(rows.map((row) => [row.setting_key, row]));
        const appid = byKey.get('qq_oauth_appid')?.setting_value || '';
        const appkey = byKey.get('qq_oauth_appkey')?.setting_value || '';
        return {
            api_url: byKey.get('qq_oauth_api_url')?.setting_value || 'https://your-oauth-provider.example/',
            appid,
            appkey,
            callback_url: byKey.get('qq_oauth_callback_url')?.setting_value || '',
            frontend_success_path: byKey.get('qq_oauth_frontend_success_path')?.setting_value || '/',
            appkey_configured: Boolean(String(appkey).trim()),
            updated_at: rows.reduce((latest, row) => {
                const value = row.updated_at ? new Date(row.updated_at).getTime() : 0;
                return value > latest.value ? { value, updated_at: row.updated_at } : latest;
            }, { value: 0, updated_at: null }).updated_at
        };
    }

    async getQqOauthPublicConfig() {
        const config = await this.getQqOauthConfig();
        return {
            api_url: config.api_url,
            appid: config.appid,
            appkey_configured: config.appkey_configured,
            callback_url: config.callback_url,
            frontend_success_path: config.frontend_success_path,
            updated_at: config.updated_at
        };
    }

    async updateQqOauthConfig(config) {
        const updates = [
            { key: 'qq_oauth_api_url', value: config.api_url, secret: false },
            { key: 'qq_oauth_appid', value: config.appid, secret: false },
            { key: 'qq_oauth_callback_url', value: config.callback_url, secret: false },
            { key: 'qq_oauth_frontend_success_path', value: config.frontend_success_path, secret: false }
        ];

        if (config.clear_appkey) {
            updates.push({ key: 'qq_oauth_appkey', value: '', secret: true });
        } else if (typeof config.appkey === 'string' && config.appkey.trim()) {
            updates.push({ key: 'qq_oauth_appkey', value: config.appkey.trim(), secret: true });
        }

        await this.withTransaction(async (query) => {
            for (const item of updates) {
                await query(
                    `INSERT INTO app_settings (setting_key, setting_value, is_secret, updated_at)
                     VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
                     ON CONFLICT (setting_key) DO UPDATE SET
                        setting_value = EXCLUDED.setting_value,
                        is_secret = EXCLUDED.is_secret,
                        updated_at = CURRENT_TIMESTAMP`,
                    [item.key, item.value, item.secret]
                );
            }
        });

        return this.getQqOauthPublicConfig();
    }

    async getImageHostConfig() {
        const rows = await this.query(
            `SELECT setting_key, setting_value, updated_at
             FROM app_settings
             WHERE setting_key IN ('image_host_base_url', 'image_host_api_key', 'image_host_review_folder_id')`
        );
        const byKey = new Map(rows.map((row) => [row.setting_key, row]));
        const apiKey = byKey.get('image_host_api_key')?.setting_value || '';
        return {
            base_url: byKey.get('image_host_base_url')?.setting_value || '',
            api_key: apiKey,
            review_folder_id: byKey.get('image_host_review_folder_id')?.setting_value || '',
            api_key_configured: Boolean(String(apiKey).trim()),
            updated_at: rows.reduce((latest, row) => {
                const value = row.updated_at ? new Date(row.updated_at).getTime() : 0;
                return value > latest.value ? { value, updated_at: row.updated_at } : latest;
            }, { value: 0, updated_at: null }).updated_at
        };
    }

    async getImageHostPublicConfig() {
        const config = await this.getImageHostConfig();
        return {
            base_url: config.base_url,
            review_folder_id: config.review_folder_id,
            api_key_configured: config.api_key_configured,
            updated_at: config.updated_at
        };
    }

    async updateImageHostConfig(config) {
        const updates = [
            { key: 'image_host_base_url', value: config.base_url, secret: false },
            { key: 'image_host_review_folder_id', value: config.review_folder_id, secret: false }
        ];

        if (config.clear_api_key) {
            updates.push({ key: 'image_host_api_key', value: '', secret: true });
        } else if (typeof config.api_key === 'string' && config.api_key.trim()) {
            updates.push({ key: 'image_host_api_key', value: config.api_key.trim(), secret: true });
        }

        await this.withTransaction(async (query) => {
            for (const item of updates) {
                await query(
                    `INSERT INTO app_settings (setting_key, setting_value, is_secret, updated_at)
                     VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
                     ON CONFLICT (setting_key) DO UPDATE SET
                        setting_value = EXCLUDED.setting_value,
                        is_secret = EXCLUDED.is_secret,
                        updated_at = CURRENT_TIMESTAMP`,
                    [item.key, item.value, item.secret]
                );
            }
        });

        return this.getImageHostPublicConfig();
    }

    async getTrovePalConfig() {
        const rows = await this.query(
            `SELECT setting_key, setting_value, updated_at
             FROM app_settings
             WHERE setting_key IN ('trovepal_api_key', 'trovepal_app_name')`
        );
        const byKey = new Map(rows.map((row) => [row.setting_key, row]));
        const apiKey = byKey.get('trovepal_api_key')?.setting_value || '';
        return {
            api_key: apiKey,
            app_name: byKey.get('trovepal_app_name')?.setting_value || 'TroveBBS',
            api_key_configured: Boolean(String(apiKey).trim()),
            updated_at: rows.reduce((latest, row) => {
                const value = row.updated_at ? new Date(row.updated_at).getTime() : 0;
                return value > latest.value ? { value, updated_at: row.updated_at } : latest;
            }, { value: 0, updated_at: null }).updated_at
        };
    }

    async getTrovePalPublicConfig() {
        const config = await this.getTrovePalConfig();
        return {
            app_name: config.app_name,
            api_key_configured: config.api_key_configured,
            updated_at: config.updated_at
        };
    }

    async updateTrovePalConfig(config) {
        const updates = [
            { key: 'trovepal_app_name', value: config.app_name, secret: false }
        ];

        if (config.clear_api_key) {
            updates.push({ key: 'trovepal_api_key', value: '', secret: true });
        } else if (typeof config.api_key === 'string' && config.api_key.trim()) {
            updates.push({ key: 'trovepal_api_key', value: config.api_key.trim(), secret: true });
        }

        await this.withTransaction(async (query) => {
            for (const item of updates) {
                await query(
                    `INSERT INTO app_settings (setting_key, setting_value, is_secret, updated_at)
                     VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
                     ON CONFLICT (setting_key) DO UPDATE SET
                        setting_value = EXCLUDED.setting_value,
                        is_secret = EXCLUDED.is_secret,
                        updated_at = CURRENT_TIMESTAMP`,
                    [item.key, item.value, item.secret]
                );
            }
        });

        return this.getTrovePalPublicConfig();
    }

}

module.exports = { PostgresAdminRepository, ADMIN_TABLES, CLEANUP_TABLES };
