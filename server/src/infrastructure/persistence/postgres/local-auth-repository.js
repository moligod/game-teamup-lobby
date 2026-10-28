const crypto = require('crypto');
class PostgresLocalAuthRepository {
    constructor(database) { this.database = database; }
    async create(username, salt, hash) {
        return this.database.withTransaction(async query => {
            const created = await query(`INSERT INTO users (username, password, role) VALUES ($1, $2, 'user')
                RETURNING id, username, email, avatar, signature, role`, [username, `local:${crypto.randomBytes(32).toString('hex')}`]);
            const user = created.rows[0];
            await query('INSERT INTO local_credentials (user_id, salt, password_hash) VALUES ($1, $2, $3)', [user.id, salt, hash]);
            return user;
        });
    }
    find(username) {
        return this.database.one(`SELECT users.id, users.username, users.email, users.avatar, users.signature, users.role,
            local_credentials.salt, local_credentials.password_hash FROM local_credentials
            JOIN users ON users.id = local_credentials.user_id WHERE users.username = $1 AND users.role = 'user'`, [username]);
    }
}
module.exports = { PostgresLocalAuthRepository };
