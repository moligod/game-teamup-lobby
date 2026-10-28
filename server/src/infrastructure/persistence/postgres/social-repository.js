class PostgresSocialRepository {
    constructor(database) {
        this.database = database;
    }

    query(sql, params = []) { return this.database.query(sql, params); }
    one(sql, params = []) { return this.database.one(sql, params); }
    exec(sql, params = []) { return this.database.exec(sql, params); }

    findUserByUsername(username) {
        return this.one('SELECT id, username, email FROM users WHERE username = $1', [username]);
    }

    getUserById(userId) {
        return this.one('SELECT id, username, email, avatar, signature, role FROM users WHERE id = $1', [userId]);
    }

    searchUsers(keyword) {
        return this.query(
             `SELECT id, username, email, avatar, signature
             FROM users
             WHERE lower(username) LIKE lower($1)
             ORDER BY username ASC
             LIMIT 20`,
            [`%${keyword}%`]
        );
    }

    getFriends(userId) {
        return this.query(
            `SELECT f.id as friendship_id, f.status, f.created_at,
                    u.id, u.username, u.email, u.avatar, u.signature
             FROM friends f
             JOIN users u ON u.id = CASE WHEN f.user_id = $1 THEN f.friend_id ELSE f.user_id END
             WHERE (f.user_id = $1 OR f.friend_id = $1) AND f.status = 'accepted'
             ORDER BY f.created_at DESC`,
            [userId]
        );
    }

    async addFriend(userId, friendId) {
        const existing = await this.one(
            `SELECT *
             FROM friends
             WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`,
            [userId, friendId]
        );
        if (existing) throw new Error('Friend relationship already exists');

        const row = await this.one(
            'INSERT INTO friends (user_id, friend_id, status) VALUES ($1, $2, $3) RETURNING id',
            [userId, friendId, 'pending']
        );
        return { id: row.id };
    }

    async acceptFriend(userId, friendId) {
        const result = await this.exec(
            `UPDATE friends
             SET status = 'accepted'
             WHERE user_id = $1 AND friend_id = $2 AND status = 'pending'`,
            [friendId, userId]
        );
        if (result.changes === 0) throw new Error('Friend request not found');
        return { success: true };
    }

    async rejectFriend(userId, friendId) {
        const result = await this.exec(
            `DELETE FROM friends
             WHERE user_id = $1 AND friend_id = $2 AND status = 'pending'`,
            [friendId, userId]
        );
        if (result.changes === 0) throw new Error('Friend request not found');
        return { success: true };
    }

    async removeFriend(userId, friendId) {
        const result = await this.exec(
            `DELETE FROM friends
             WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`,
            [userId, friendId]
        );
        return result.changes > 0;
    }

    getFriendRequests(userId) {
        return this.query(
            `SELECT f.id as friendship_id, f.created_at,
                    u.id, u.username, u.email, u.avatar, u.signature
             FROM friends f
             JOIN users u ON f.user_id = u.id
             WHERE f.friend_id = $1 AND f.status = 'pending'
             ORDER BY f.created_at DESC`,
            [userId]
        );
    }

    areFriends(userId, friendId) {
        return this.one(
            `SELECT 1
             FROM friends
             WHERE ((user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1))
               AND status = 'accepted'`,
            [userId, friendId]
        );
    }

    listDirectMessages(userId, friendId, limit) {
        return this.query(
            `SELECT message.id, message.sender_id, message.recipient_id, message.body, message.created_at,
                    sender.username AS sender_name
             FROM direct_messages message
             JOIN users sender ON sender.id = message.sender_id
             WHERE (message.sender_id = $1 AND message.recipient_id = $2)
                OR (message.sender_id = $2 AND message.recipient_id = $1)
             ORDER BY message.created_at ASC, message.id ASC
             LIMIT $3`,
            [userId, friendId, limit]
        );
    }

    createDirectMessage(senderId, recipientId, body) {
        return this.one(
            `WITH inserted AS (
                INSERT INTO direct_messages (sender_id, recipient_id, body)
                VALUES ($1, $2, $3)
                RETURNING id, sender_id, recipient_id, body, created_at
             )
             SELECT inserted.*, sender.username AS sender_name
             FROM inserted
             JOIN users sender ON sender.id = inserted.sender_id`,
            [senderId, recipientId, body]
        );
    }

}

module.exports = { PostgresSocialRepository };
