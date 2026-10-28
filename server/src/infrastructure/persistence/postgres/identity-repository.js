class PostgresIdentityRepository {
    constructor(database) {
        this.database = database;
    }

    query(sql, params = []) { return this.database.query(sql, params); }
    one(sql, params = []) { return this.database.one(sql, params); }
    exec(sql, params = []) { return this.database.exec(sql, params); }

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

    async loginUser(identifier, password) {
        const isEmail = String(identifier).includes('@');
        const row = await this.one(
            isEmail
                ? 'SELECT id, username, email, avatar, signature, role FROM users WHERE email = $1 AND password = $2'
                : 'SELECT id, username, email, avatar, signature, role FROM users WHERE username = $1 AND password = $2',
            [identifier, password]
        );
        if (!row) throw new Error('Invalid username or password');
        return row;
    }

    async findUserByOauth(provider, uid) {
        return this.one(
            `SELECT id, username, email, avatar, signature, role
             FROM users
             WHERE oauth_provider = $1 AND oauth_uid = $2`,
            [provider, uid]
        );
    }

    async createOrUpdateOauthUser({ provider, uid, nickname, avatar }) {
        const existing = await this.findUserByOauth(provider, uid);
        if (existing) {
            return this.one(
                `UPDATE users
                 SET avatar = COALESCE($1, avatar)
                 WHERE id = $2
                 RETURNING id, username, email, avatar, signature, role`,
                [avatar || null, existing.id]
            );
        }

        return this.one(
            `INSERT INTO users (username, password, email, avatar, role, oauth_provider, oauth_uid)
             VALUES ($1, $2, NULL, $3, 'user', $4, $5)
             RETURNING id, username, email, avatar, signature, role`,
            [
                await this.buildUniqueOauthUsername(nickname, provider, uid),
                `oauth:${provider}:${uid}`,
                avatar || null,
                provider,
                uid
            ]
        );
    }

    normalizeOauthUsername(nickname, provider, uid) {
        const raw = String(nickname || '').trim();
        const fallback = `${provider}_${String(uid || 'user').slice(-8) || 'user'}`;
        const cleaned = (raw || fallback)
            .replace(/\s+/g, '_')
            .replace(/[^\p{L}\p{N}_-]/gu, '')
            .slice(0, 20);
        return cleaned || fallback;
    }

    async buildUniqueOauthUsername(nickname, provider, uid) {
        const base = this.normalizeOauthUsername(nickname, provider, uid);
        let candidate = base;
        let index = 1;
        while (await this.checkUsernameExists(candidate)) {
            const suffix = `_${index}`;
            candidate = `${base.slice(0, Math.max(1, 20 - suffix.length))}${suffix}`;
            index += 1;
        }
        return candidate;
    }

    async checkUsernameExists(username) {
        const row = await this.one('SELECT id FROM users WHERE username = $1', [username]);
        return !!row;
    }

    findUserByUsername(username) {
        return this.one('SELECT id, username, email FROM users WHERE username = $1', [username]);
    }

    getUserById(userId) {
        return this.one('SELECT id, username, email, avatar, signature, role FROM users WHERE id = $1', [userId]);
    }

    async updateUserAvatar(userId, avatar) {
        const result = await this.exec('UPDATE users SET avatar = $1 WHERE id = $2', [avatar, userId]);
        return result.changes > 0;
    }

    async updateUserSignature(userId, signature) {
        const result = await this.exec('UPDATE users SET signature = $1 WHERE id = $2', [signature, userId]);
        return result.changes > 0;
    }

}

module.exports = { PostgresIdentityRepository };
