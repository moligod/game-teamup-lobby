const { PROFESSION_COLUMNS } = require('./postgres-client');

class PostgresLobbyRepository {
    constructor(database) {
        this.database = database;
    }

    query(sql, params = []) { return this.database.query(sql, params); }
    one(sql, params = []) { return this.database.one(sql, params); }
    exec(sql, params = []) { return this.database.exec(sql, params); }
    withTransaction(callback) { return this.database.withTransaction(callback); }

    getTeamTypes() {
        return this.query('SELECT * FROM team_types ORDER BY id');
    }

    getTeamTypesI18n(language = 'zh') {
        const normalizedLanguage = language === 'en' ? 'en' : 'zh';
        return this.query(
            `SELECT tt.id, COALESCE(i18n.name, tt.name) as name
             FROM team_types tt
             LEFT JOIN team_types_i18n i18n
                ON i18n.team_type_id = tt.id
                AND i18n.language = $1
             ORDER BY tt.id`,
            [normalizedLanguage]
        );
    }

    async getSystemMessage(messageKey, language = 'zh') {
        const row = await this.one(
            'SELECT content FROM system_messages_i18n WHERE message_key = $1 AND language = $2',
            [messageKey, language]
        );
        return row ? row.content : null;
    }

    getUsersByIds(userIds) {
        const ids = Array.from(new Set(userIds
            .map((value) => Number.parseInt(String(value), 10))
            .filter((value) => Number.isInteger(value) && value > 0)));
        if (ids.length === 0) return Promise.resolve([]);
        return this.query(
            `SELECT id, username, avatar
             FROM users
             WHERE id = ANY($1::int[])
             ORDER BY lower(username) ASC, id ASC`,
            [ids]
        );
    }

    getTeams(teamType = null, language = 'zh', includeEnded = false) {
        const normalizedLanguage = language === 'en' ? 'en' : 'zh';
        const params = [normalizedLanguage];
        let filter = includeEnded ? " AND t.status IN ('active', 'ended')" : " AND t.status = 'active'";
        if (teamType) {
            params.push(teamType);
            filter = ` AND t.team_type = $${params.length}`;
        }

        return this.query(
            `SELECT t.*, COALESCE(i18n.name, tt.name) as team_type_name, u.username as leader_name,
                    COALESCE((SELECT COUNT(*)::int FROM team_applications ta WHERE ta.team_id = t.id AND ta.status = 'pending'), 0) as pending_applications
             FROM teams t
             JOIN team_types tt ON t.team_type = tt.id
             LEFT JOIN team_types_i18n i18n
                ON i18n.team_type_id = tt.id
                AND i18n.language = $1
             JOIN users u ON t.leader_id = u.id
             WHERE TRUE${filter}
             ORDER BY CASE WHEN t.status = 'active' THEN 0 ELSE 1 END, t.created_at DESC`,
            params
        );
    }

    getTeam(id, language = 'zh') {
        const normalizedLanguage = language === 'en' ? 'en' : 'zh';
        return this.one(
            `SELECT t.*, COALESCE(i18n.name, tt.name) as team_type_name, u.username as leader_name
             FROM teams t
             JOIN team_types tt ON t.team_type = tt.id
             LEFT JOIN team_types_i18n i18n
                ON i18n.team_type_id = tt.id
                AND i18n.language = $1
             JOIN users u ON t.leader_id = u.id
             WHERE t.id = $2`,
            [normalizedLanguage, id]
        );
    }

    endExpiredActiveTeams(days = 3) {
        return this.query(
            `WITH expired AS (
                SELECT id
                FROM teams
                WHERE status = 'active'
                  AND created_at <= CURRENT_TIMESTAMP - ($1::int * INTERVAL '1 day')
                FOR UPDATE SKIP LOCKED
             )
             UPDATE teams team
             SET status = 'ended'
             FROM expired
             WHERE team.id = expired.id
             RETURNING team.*`,
            [days]
        );
    }

    expireApplicationsForActiveMembers() {
        return this.exec(
            `UPDATE team_applications application
             SET status = 'expired', processed_at = CURRENT_TIMESTAMP
             WHERE application.status = 'pending'
               AND EXISTS (
                   SELECT 1
                   FROM team_members member
                   JOIN teams team ON team.id = member.team_id
                   WHERE member.user_id = application.user_id
                     AND team.status = 'active'
               )`
        );
    }

    async checkUserInActiveTeam(userId) {
        const row = await this.one(
            `SELECT 1
             FROM team_members tm
             JOIN teams t ON tm.team_id = t.id
             WHERE tm.user_id = $1 AND t.status = 'active'
             LIMIT 1`,
            [userId]
        );
        return !!row;
    }

    async hasGameNameBinding(userId) {
        const row = await this.one(
            'SELECT 1 FROM user_player_bindings WHERE user_id = $1 LIMIT 1',
            [userId]
        );
        return !!row;
    }

    createTeam(teamData) {
        const { name, team_type, leader_id, max_members, min_combat_power = 0, requires_approval = false } = teamData;
        return this.withTransaction(async (query) => {
            const active = await query(
                `SELECT 1
                 FROM team_members tm
                 JOIN teams t ON tm.team_id = t.id
                 WHERE tm.user_id = $1 AND t.status = 'active'
                 LIMIT 1`,
                [leader_id]
            );
            if (active.rows.length) {
                throw new Error('User is already in an active team');
            }

            const inserted = await query(
                `INSERT INTO teams (name, team_type, leader_id, max_members, min_combat_power, requires_approval, status)
                 VALUES ($1, $2, $3, $4, $5, $6, 'active')
                 RETURNING *`,
                [name, team_type, leader_id, max_members, min_combat_power, !!requires_approval]
            );
            const team = inserted.rows[0];

            await query(
                `INSERT INTO team_members (team_id, user_id, role)
                 VALUES ($1, $2, 'leader')`,
                [team.id, leader_id]
            );
            await query(
                `UPDATE team_applications
                 SET status = 'expired', processed_at = CURRENT_TIMESTAMP
                 WHERE user_id = $1 AND status = 'pending'`,
                [leader_id]
            );

            return {
                id: team.id,
                ...teamData,
                requires_approval: team.requires_approval,
                current_members: 1,
                created_at: team.created_at
            };
        });
    }

    joinTeam(teamId, userId) {
        return this.withTransaction(async (query) => {
            const active = await query(
                `SELECT 1
                 FROM team_members tm
                 JOIN teams t ON tm.team_id = t.id
                 WHERE tm.user_id = $1 AND t.status = 'active'
                 LIMIT 1`,
                [userId]
            );
            if (active.rows.length) {
                throw new Error('User is already in an active team');
            }

            const teamResult = await query(
                'SELECT current_members, max_members, status, leader_id, requires_approval FROM teams WHERE id = $1 FOR UPDATE',
                [teamId]
            );
            const team = teamResult.rows[0];
            if (!team) throw new Error('Team not found');
            if (team.status !== 'active') throw new Error('Team has ended');
            if (team.leader_id === userId) throw new Error('Leader cannot join own team');
            if (team.requires_approval) throw new Error('Team requires approval');
            if (team.current_members >= team.max_members) throw new Error('Team is full');

            await query('INSERT INTO team_members (team_id, user_id) VALUES ($1, $2)', [teamId, userId]);
            await query('UPDATE teams SET current_members = current_members + 1 WHERE id = $1', [teamId]);
            await query(
                `UPDATE team_applications
                 SET status = 'expired', processed_at = CURRENT_TIMESTAMP
                 WHERE user_id = $1 AND status = 'pending'`,
                [userId]
            );
            return true;
        });
    }

    leaveTeam(teamId, userId) {
        return this.withTransaction(async (query) => {
            const memberResult = await query('SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2', [teamId, userId]);
            const member = memberResult.rows[0];
            if (!member) throw new Error('User is not in this team');
            if (member.role === 'leader') throw new Error('Leader cannot leave own team');

            await query('DELETE FROM team_members WHERE team_id = $1 AND user_id = $2', [teamId, userId]);
            await query('UPDATE teams SET current_members = GREATEST(current_members - 1, 0) WHERE id = $1', [teamId]);
            await query('DELETE FROM team_applications WHERE team_id = $1 AND user_id = $2', [teamId, userId]);
            return true;
        });
    }

    kickMember(teamId, leaderId, memberId) {
        return this.withTransaction(async (query) => {
            const leader = await query(
                `SELECT role FROM team_members
                 WHERE team_id = $1 AND user_id = $2 AND role = 'leader'`,
                [teamId, leaderId]
            );
            if (!leader.rows.length) throw new Error('Only leader can kick members');

            const member = await query('SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2', [teamId, memberId]);
            if (!member.rows.length) throw new Error('Member not found');
            if (member.rows[0].role === 'leader') throw new Error('Cannot kick leader');

            await query('DELETE FROM team_members WHERE team_id = $1 AND user_id = $2', [teamId, memberId]);
            await query('UPDATE teams SET current_members = GREATEST(current_members - 1, 0) WHERE id = $1', [teamId]);
            await query('DELETE FROM team_applications WHERE team_id = $1 AND user_id = $2', [teamId, memberId]);
            return true;
        });
    }

    endTeam(teamId, leaderId) {
        return this.withTransaction(async (query) => {
            const leader = await query(
                `SELECT role FROM team_members
                 WHERE team_id = $1 AND user_id = $2 AND role = 'leader'`,
                [teamId, leaderId]
            );
            if (!leader.rows.length) throw new Error('Only leader can end team');

            const result = await query('UPDATE teams SET status = $1 WHERE id = $2 AND status = $3', ['ended', teamId, 'active']);
            return result.rowCount > 0;
        });
    }

    getTeamMembers(teamId) {
        return this.query(
            `SELECT tm.*, u.username, u.avatar, u.signature, upb.player_name
             FROM team_members tm
             JOIN users u ON tm.user_id = u.id
             LEFT JOIN user_player_bindings upb ON upb.user_id = u.id
             WHERE tm.team_id = $1
             ORDER BY tm.joined_at ASC`,
            [teamId]
        );
    }

    getUserTeams(userId, language = 'zh') {
        const normalizedLanguage = language === 'en' ? 'en' : 'zh';
        return this.query(
            `SELECT t.*, COALESCE(i18n.name, tt.name) as team_type_name,
                    COALESCE((SELECT COUNT(*)::int FROM team_applications ta WHERE ta.team_id = t.id AND ta.status = 'pending'), 0) as pending_applications
             FROM teams t
             JOIN team_members tm ON t.id = tm.team_id
             JOIN team_types tt ON t.team_type = tt.id
             LEFT JOIN team_types_i18n i18n
                ON i18n.team_type_id = tt.id
                AND i18n.language = $1
             WHERE tm.user_id = $2 AND t.status = 'active'
             ORDER BY t.created_at DESC`,
            [normalizedLanguage, userId]
        );
    }

    getMessages(limit = 50) {
        return this.query(
            `SELECT message.id, message.username, message.status, message.content, message.timestamp,
                    message.reply_to_id, reply.username AS reply_to_username, reply.content AS reply_to_content
             FROM (
                SELECT id FROM messages ORDER BY timestamp DESC, id DESC LIMIT $1
             ) recent_messages
             INNER JOIN messages message ON message.id = recent_messages.id
             LEFT JOIN messages reply ON reply.id = message.reply_to_id
             ORDER BY message.timestamp ASC, message.id ASC`,
            [limit]
        );
    }

    async requireActiveTeamMembership(teamId, userId) {
        const membership = await this.one(
            `SELECT 1
             FROM team_members member
             JOIN teams team ON team.id = member.team_id
             WHERE member.team_id = $1 AND member.user_id = $2 AND team.status = 'active'`,
            [teamId, userId]
        );
        if (!membership) throw new Error('User is not in this active team');
    }

    getActiveTeamMemberIds(teamId) {
        return this.query(
            `SELECT member.user_id
             FROM team_members member
             JOIN teams team ON team.id = member.team_id
             WHERE member.team_id = $1 AND team.status = 'active'`,
            [teamId]
        ).then((rows) => rows.map((row) => row.user_id));
    }

    getTeamMessages(teamId, limit = 50) {
        return this.query(
            `SELECT message.id, message.team_id, message.sender_id, message.username, message.status, message.content, message.timestamp,
                    message.reply_to_id, reply.username AS reply_to_username, reply.content AS reply_to_content
             FROM (
                SELECT id FROM team_messages WHERE team_id = $1 ORDER BY timestamp DESC, id DESC LIMIT $2
             ) recent_messages
             INNER JOIN team_messages message ON message.id = recent_messages.id
             LEFT JOIN team_messages reply ON reply.id = message.reply_to_id
             ORDER BY message.timestamp ASC, message.id ASC`,
            [teamId, limit]
        );
    }

    async createTeamMessage(teamId, userId, messageData) {
        const { username, status, content, reply_to_id = null } = messageData;
        await this.requireActiveTeamMembership(teamId, userId);
        if (reply_to_id) {
            const reply = await this.one('SELECT 1 FROM team_messages WHERE id = $1 AND team_id = $2', [reply_to_id, teamId]);
            if (!reply) throw new Error('Invalid reply message');
        }
        return this.one(
            `INSERT INTO team_messages (team_id, sender_id, username, status, content, reply_to_id)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, team_id, sender_id, username, status, content, timestamp, reply_to_id`,
            [teamId, userId, username, status, content, reply_to_id]
        );
    }

    async createMessage(messageData) {
        const { username, status, content, reply_to_id = null } = messageData;
        const row = await this.one(
            `INSERT INTO messages (username, status, content, reply_to_id)
             VALUES ($1, $2, $3, $4)
             RETURNING id, username, status, content, timestamp, reply_to_id`,
            [username, status, content, reply_to_id]
        );
        return row;
    }

    async getStats() {
        const [totalTeams, totalMembers, activeTypes] = await Promise.all([
            this.getTotalTeams(),
            this.getTotalMembers(),
            this.getActiveTeamTypes()
        ]);
        return { totalTeams, totalMembers, activeTypes };
    }

    async getTotalTeams() {
        const row = await this.one('SELECT COUNT(*)::int as count FROM teams');
        return row ? row.count : 0;
    }

    async getTotalMembers() {
        const row = await this.one('SELECT COALESCE(SUM(current_members), 0)::int as total FROM teams');
        return row ? row.total : 0;
    }

    getActiveTeamTypes() {
        return this.query('SELECT DISTINCT team_type FROM teams WHERE status = $1', ['active']);
    }

    async setTeamApprovalRequired(teamId, leaderId, requiresApproval) {
        const team = await this.one('SELECT leader_id FROM teams WHERE id = $1', [teamId]);
        if (!team) throw new Error('Team not found');
        if (team.leader_id !== leaderId) throw new Error('Only leader can set approval');

        await this.exec('UPDATE teams SET requires_approval = $1 WHERE id = $2', [!!requiresApproval, teamId]);
        return { success: true, message: 'Approval setting updated' };
    }

    async submitTeamApplication(teamId, userId) {
        const team = await this.one('SELECT * FROM teams WHERE id = $1 AND requires_approval = TRUE', [teamId]);
        if (!team) throw new Error('Team not found or does not require approval');
        if (team.leader_id === userId) throw new Error('Leader cannot apply to own team');
        if (await this.checkUserInActiveTeam(userId)) throw new Error('User is already in an active team');

        const existing = await this.one('SELECT * FROM team_applications WHERE team_id = $1 AND user_id = $2', [teamId, userId]);
        if (existing) {
            if (existing.status === 'pending') throw new Error('Application already submitted');

            const member = await this.one('SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2', [teamId, userId]);
            if (member) throw new Error('User is already in this team');

            await this.exec(
                `UPDATE team_applications
                 SET status = 'pending', applied_at = CURRENT_TIMESTAMP, processed_at = NULL, processed_by = NULL
                 WHERE id = $1`,
                [existing.id]
            );
            return { success: true, message: 'Application resubmitted', applicationId: existing.id };
        }

        const row = await this.one(
            'INSERT INTO team_applications (team_id, user_id) VALUES ($1, $2) RETURNING id',
            [teamId, userId]
        );
        return { success: true, message: 'Application submitted', applicationId: row.id };
    }

    async getTeamApplications(teamId, leaderId) {
        const team = await this.one('SELECT leader_id FROM teams WHERE id = $1', [teamId]);
        if (!team) throw new Error('Team not found');
        if (team.leader_id !== leaderId) throw new Error('Only leader can view applications');

        const rows = await this.query(
            `SELECT ta.id as application_id,
                    ta.applied_at,
                    u.id as user_id,
                    u.username,
                    u.avatar,
                    upb.player_name,
                    ppc.*
             FROM team_applications ta
             JOIN users u ON ta.user_id = u.id
             LEFT JOIN user_player_bindings upb ON u.id = upb.user_id
             LEFT JOIN player_profession_combat ppc ON lower(upb.player_name) = lower(ppc.player_name)
             WHERE ta.team_id = $1 AND ta.status = 'pending'
             ORDER BY ta.applied_at ASC`,
            [teamId]
        );

        return rows.map((row) => {
            let highestProfession = null;
            let maxCombatPower = 0;
            for (const profession of PROFESSION_COLUMNS) {
                const value = Number(row[profession] || row[profession.toLowerCase()] || 0);
                if (value > maxCombatPower) {
                    maxCombatPower = value;
                    highestProfession = profession;
                }
            }

            return {
                id: row.application_id,
                user_id: row.user_id,
                username: row.username,
                avatar: row.avatar,
                player_name: row.player_name,
                highest_profession: highestProfession,
                max_combat_power: maxCombatPower,
                applied_at: row.applied_at
            };
        });
    }

    async getPendingTeamApplicationInfo(applicationId) {
        return this.one(
            `SELECT ta.*, t.name as team_name, u.username as applicant_name
             FROM team_applications ta
             JOIN teams t ON ta.team_id = t.id
             JOIN users u ON ta.user_id = u.id
             WHERE ta.id = $1 AND ta.status = 'pending'`,
            [applicationId]
        );
    }

    processTeamApplication(applicationId, leaderId, action) {
        return this.withTransaction(async (query) => {
            const applicationResult = await query(
                `SELECT ta.*, t.leader_id, t.current_members, t.max_members, t.name as team_name
                 FROM team_applications ta
                 JOIN teams t ON ta.team_id = t.id
                 WHERE ta.id = $1 AND ta.status = 'pending'
                 FOR UPDATE`,
                [applicationId]
            );
            const application = applicationResult.rows[0];
            if (!application) throw new Error('Application not found or already processed');
            if (application.leader_id !== leaderId) throw new Error('Only leader can process application');

            if (action === 'approve') {
                if (application.current_members >= application.max_members) {
                    throw new Error('Team is full');
                }

                const activeTeam = await query(
                    `SELECT 1
                     FROM team_members tm
                     JOIN teams t ON tm.team_id = t.id
                     WHERE tm.user_id = $1 AND t.status = 'active'
                     LIMIT 1`,
                    [application.user_id]
                );
                if (activeTeam.rows.length) {
                    await query(
                        `UPDATE team_applications
                         SET status = 'expired', processed_at = CURRENT_TIMESTAMP, processed_by = $1
                         WHERE id = $2`,
                        [leaderId, applicationId]
                    );
                    return { success: true, message: 'Application expired', action: 'expired' };
                }

                await query(
                    `UPDATE team_applications
                     SET status = 'approved', processed_at = CURRENT_TIMESTAMP, processed_by = $1
                     WHERE id = $2`,
                    [leaderId, applicationId]
                );
                await query('INSERT INTO team_members (team_id, user_id) VALUES ($1, $2)', [application.team_id, application.user_id]);
                await query('UPDATE teams SET current_members = current_members + 1 WHERE id = $1', [application.team_id]);
                await query(
                    `UPDATE team_applications
                     SET status = 'expired', processed_at = CURRENT_TIMESTAMP, processed_by = $1
                     WHERE user_id = $2 AND status = 'pending' AND id <> $3`,
                    [leaderId, application.user_id, applicationId]
                );
                return { success: true, message: 'Application approved', action: 'approved' };
            }

            if (action === 'reject') {
                await query(
                    `UPDATE team_applications
                     SET status = 'rejected', processed_at = CURRENT_TIMESTAMP, processed_by = $1
                     WHERE id = $2`,
                    [leaderId, applicationId]
                );
                return { success: true, message: 'Application rejected', action: 'rejected' };
            }

            throw new Error('Invalid action');
        });
    }

}

module.exports = { PostgresLobbyRepository };
