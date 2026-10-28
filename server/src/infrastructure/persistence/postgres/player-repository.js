const { PROFESSION_COLUMNS } = require('./postgres-client');

class PostgresPlayerRepository {
    constructor(database) {
        this.database = database;
    }

    query(sql, params = []) { return this.database.query(sql, params); }
    one(sql, params = []) { return this.database.one(sql, params); }
    exec(sql, params = []) { return this.database.exec(sql, params); }

    async checkPlayerExists(playerName) {
        const row = await this.one(
            'SELECT player_name FROM player_profession_combat WHERE lower(player_name) = lower($1)',
            [playerName]
        );
        return !!row;
    }

    async getActualPlayerName(playerName) {
        const row = await this.one(
            'SELECT player_name FROM player_profession_combat WHERE lower(player_name) = lower($1)',
            [playerName]
        );
        return row ? row.player_name : null;
    }

    async getKnownPlayerName(playerName) {
        const combatRow = await this.one(
            'SELECT player_name FROM player_profession_combat WHERE lower(player_name) = lower($1)',
            [playerName]
        );
        if (combatRow) return combatRow.player_name;

        const leaderboardRow = await this.one(
            `SELECT player_name
             FROM leaderboard_current_entries
             WHERE lower(player_name) = lower($1)
             ORDER BY updated_at DESC, entry_index ASC
             LIMIT 1`,
            [playerName]
        );
        return leaderboardRow ? leaderboardRow.player_name : null;
    }

    async bindUserPlayer(userId, playerName) {
        const result = await this.exec(
            `INSERT INTO user_player_bindings (user_id, player_name)
             VALUES ($1, $2)
             ON CONFLICT (user_id) DO UPDATE SET player_name = EXCLUDED.player_name, created_at = CURRENT_TIMESTAMP`,
            [userId, playerName]
        );
        return result.changes > 0;
    }

    async unbindUserPlayer(userId) {
        const result = await this.exec('DELETE FROM user_player_bindings WHERE user_id = $1', [userId]);
        return result.changes > 0;
    }

    getUserPlayerBinding(userId) {
        return this.one('SELECT player_name, created_at FROM user_player_bindings WHERE user_id = $1', [userId]);
    }

    getPlayerCombatData(playerName) {
        return this.one(
            'SELECT * FROM player_profession_combat WHERE lower(player_name) = lower($1)',
            [playerName]
        );
    }

    getPlayerLeaderboardEntries(playerName, leaderboardIds) {
        return this.query(
            `SELECT DISTINCT ON (leaderboard_id)
                leaderboard_id,
                entry_index,
                rank,
                player_name,
                score,
                mastery_level,
                mastery_level_text,
                trove_mastery_level,
                geode_mastery_level,
                updated_at
             FROM leaderboard_current_entries
             WHERE leaderboard_id = ANY($1::text[])
               AND lower(player_name) = lower($2)
             ORDER BY leaderboard_id ASC, entry_index ASC`,
            [leaderboardIds.map(String), playerName]
        );
    }

    async getAllProfessionCombatStats() {
        const selectParts = PROFESSION_COLUMNS.map((column) => {
            const dbColumn = column.toLowerCase();
            return `SELECT '${column}' as profession,
                           COUNT(CASE WHEN "${dbColumn}" > 0 THEN 1 END)::int as player_count,
                           AVG(CASE WHEN "${dbColumn}" > 0 THEN "${dbColumn}" END)::float as avg_combat,
                           MAX("${dbColumn}")::int as max_combat,
                           MIN(CASE WHEN "${dbColumn}" > 0 THEN "${dbColumn}" END)::int as min_combat,
                           SUM("${dbColumn}")::int as total_combat_sum
                    FROM player_profession_combat`;
        });
        const rows = await this.query(`${selectParts.join(' UNION ALL ')} ORDER BY avg_combat DESC NULLS LAST`);
        return rows.filter((row) => row.player_count > 0);
    }

}

module.exports = { PostgresPlayerRepository };
