const { withLeaderboardCategory } = require('./leaderboard-catalog');

class PostgresLeaderboardQueryRepository {
    constructor(database) {
        this.database = database;
    }

    query(sql, params = []) { return this.database.query(sql, params); }
    one(sql, params = []) { return this.database.one(sql, params); }

    async list() {
        const rows = await this.query(
            `SELECT
                board.leaderboard_id,
                board.leaderboard_type,
                board.leaderboard_key,
                board.leaderboard_name,
                board.updated_at,
                board.entry_count,
                board.min_rank,
                board.max_rank
             FROM leaderboard_current_boards board
             ORDER BY board.updated_at DESC, board.leaderboard_id ASC`
        );
        return rows.map(withLeaderboardCategory);
    }

    getVersionSource() {
        return this.query(
            `SELECT snapshot_id, leaderboard_id, updated_at
             FROM leaderboard_current_boards
             ORDER BY leaderboard_id ASC`
        );
    }

    async search(searchQuery, limit, includePlayerMatches = true) {
        const normalizedQuery = `%${String(searchQuery || '').trim().toLowerCase()}%`;
        const rows = await this.query(
            `WITH matching_entries AS MATERIALIZED (
                SELECT entry_index, rank, player_name, score, leaderboard_id
                FROM leaderboard_current_entries
                WHERE $2::boolean
                  AND lower(player_name) LIKE $1
             )
             SELECT
                board.leaderboard_id,
                board.leaderboard_type,
                board.leaderboard_key,
                board.leaderboard_name,
                board.updated_at,
                board.entry_count,
                board.min_rank,
                board.max_rank,
                entry.entry_index,
                entry.rank,
                entry.player_name,
                entry.score
             FROM leaderboard_current_boards board
             LEFT JOIN matching_entries entry ON entry.leaderboard_id = board.leaderboard_id
             WHERE lower(board.leaderboard_id) LIKE $1
                OR lower(board.leaderboard_type) LIKE $1
                OR lower(COALESCE(board.leaderboard_key, '')) LIKE $1
                OR lower(COALESCE(board.leaderboard_name, '')) LIKE $1
                OR entry.player_name IS NOT NULL
             ORDER BY CASE WHEN entry.player_name IS NOT NULL THEN 0 ELSE 1 END,
                      entry.rank NULLS LAST,
                      board.updated_at DESC,
                      board.leaderboard_id ASC
             LIMIT $3`,
            [normalizedQuery, includePlayerMatches, limit]
        );
        return rows.map(withLeaderboardCategory);
    }

    async getById(leaderboardId) {
        const row = await this.one(
            `SELECT
                board.leaderboard_id,
                board.leaderboard_type,
                board.leaderboard_key,
                board.leaderboard_name,
                board.updated_at,
                board.entry_count,
                board.min_rank,
                board.max_rank
             FROM leaderboard_current_boards board
             WHERE board.leaderboard_id = $1
             LIMIT 1`,
            [leaderboardId]
        );
        return withLeaderboardCategory(row);
    }

    getEntries(leaderboardId, limit, offset) {
        return this.query(
            `SELECT entry_index, rank, player_name, score, mastery_level, mastery_level_text, trove_mastery_level, geode_mastery_level
             FROM leaderboard_current_entries
             WHERE leaderboard_id = $1
             ORDER BY entry_index ASC
             LIMIT $2 OFFSET $3`,
            [leaderboardId, limit, offset]
        );
    }

    async getPlayerProfile(playerName) {
        const rows = await this.query(
            `WITH player_entries AS (
                SELECT DISTINCT ON (entry.leaderboard_id)
                    entry.leaderboard_id,
                    entry.entry_index,
                    entry.rank,
                    entry.player_name,
                    entry.score,
                    entry.mastery_level,
                    entry.mastery_level_text,
                    entry.trove_mastery_level,
                    entry.geode_mastery_level,
                    board.leaderboard_type,
                    board.leaderboard_key,
                    board.leaderboard_name,
                    board.updated_at
                 FROM leaderboard_current_entries entry
                 JOIN leaderboard_current_boards board ON board.leaderboard_id = entry.leaderboard_id
                 WHERE lower(entry.player_name) = lower($1)
                   AND board.subject_scope = 'player'
                 ORDER BY entry.leaderboard_id, entry.rank ASC, entry.entry_index ASC
             )
             SELECT * FROM player_entries
             ORDER BY leaderboard_id ASC`,
            [playerName]
        );
        return rows.map(withLeaderboardCategory);
    }
}

module.exports = { PostgresLeaderboardQueryRepository };
