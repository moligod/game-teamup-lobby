class PostgresQqBotRepository {
    constructor(database) {
        this.database = database;
    }

    query(sql, params = []) { return this.database.query(sql, params); }
    one(sql, params = []) { return this.database.one(sql, params); }
    exec(sql, params = []) { return this.database.exec(sql, params); }
    withTransaction(callback) { return this.database.withTransaction(callback); }

    async recordGroupEvent(groupOpenid, eventType) {
        const groupId = String(groupOpenid || '').trim();
        if (!groupId) return null;

        const enabled = eventType === 'GROUP_MSG_RECEIVE';
        const disabled = eventType === 'GROUP_MSG_REJECT' || eventType === 'GROUP_DEL_ROBOT';
        if (!enabled && !disabled && eventType !== 'GROUP_ADD_ROBOT') return null;

        const result = await this.query(
            `INSERT INTO qq_bot_groups (group_openid, proactive_messages_enabled, last_event_type, last_event_at)
             VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
             ON CONFLICT (group_openid) DO UPDATE SET
                proactive_messages_enabled = CASE
                    WHEN EXCLUDED.last_event_type = 'GROUP_MSG_RECEIVE' THEN TRUE
                    WHEN EXCLUDED.last_event_type IN ('GROUP_MSG_REJECT', 'GROUP_DEL_ROBOT') THEN FALSE
                    ELSE qq_bot_groups.proactive_messages_enabled
                END,
                last_event_type = EXCLUDED.last_event_type,
                last_event_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [groupId, enabled, eventType]
        );
        return result[0] || null;
    }

    async enqueueTeamCreated(team) {
        const payload = JSON.stringify(team);
        const result = await this.query(
            `INSERT INTO qq_team_notification_outbox (group_openid, team_id, payload)
             SELECT group_openid, $1, $2::jsonb
             FROM qq_bot_groups
             WHERE proactive_messages_enabled = TRUE
             ON CONFLICT (group_openid, team_id) DO NOTHING
             RETURNING id`,
            [team.id, payload]
        );
        return result.length;
    }

    async claimPendingNotifications(limit = 10) {
        const count = Math.max(1, Math.min(Number(limit) || 10, 50));
        return this.withTransaction(async (query) => {
            const claimed = await query(
                `WITH candidates AS (
                    SELECT id
                    FROM qq_team_notification_outbox
                    WHERE (status = 'pending' AND next_attempt_at <= CURRENT_TIMESTAMP)
                       OR (status = 'processing' AND locked_at <= CURRENT_TIMESTAMP - INTERVAL '5 minutes')
                    ORDER BY id
                    LIMIT $1
                    FOR UPDATE SKIP LOCKED
                 )
                 UPDATE qq_team_notification_outbox outbox
                 SET status = 'processing', locked_at = CURRENT_TIMESTAMP, attempts = attempts + 1
                 FROM candidates
                 WHERE outbox.id = candidates.id
                 RETURNING outbox.*`,
                [count]
            );
            return claimed.rows;
        });
    }

    async markNotificationSent(notificationId) {
        await this.exec(
            `UPDATE qq_team_notification_outbox
             SET status = 'sent', sent_at = CURRENT_TIMESTAMP, locked_at = NULL, last_error = NULL
             WHERE id = $1`,
            [notificationId]
        );
    }

    async retryNotification(notificationId, attempts, error) {
        const delaySeconds = Math.min(3600, Math.max(30, 2 ** Math.min(Number(attempts) || 1, 10)));
        await this.exec(
            `UPDATE qq_team_notification_outbox
             SET status = 'pending',
                 locked_at = NULL,
                 next_attempt_at = CURRENT_TIMESTAMP + ($2::int * INTERVAL '1 second'),
                 last_error = $3
             WHERE id = $1`,
            [notificationId, delaySeconds, String(error?.message || error || 'QQ notification failed').slice(0, 500)]
        );
    }
}

module.exports = { PostgresQqBotRepository };
