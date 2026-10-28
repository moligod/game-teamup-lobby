const { getSubjectScope } = require('./leaderboard-catalog');

function asStringArray(value) {
    if (!Array.isArray(value)) return [];
    return value.map((item) => String(item));
}

class PostgresLeaderboardSnapshotRepository {
    constructor(database) {
        this.database = database;
    }

    async createSnapshot(snapshot) {
        return this.database.withTransaction(async (query) => {
            let expectedBoardIds = snapshot.expectedBoardIds;
            if (!expectedBoardIds.length) {
                const result = await query('SELECT leaderboard_id FROM leaderboard_current_boards ORDER BY leaderboard_id ASC');
                expectedBoardIds = result.rows.map((row) => row.leaderboard_id);
            }
            if (!expectedBoardIds.length) throw new Error('expected_board_ids is required for the first snapshot');

            await query(
                `INSERT INTO leaderboard_snapshots (snapshot_id, source_date, status, expected_board_ids)
                 VALUES ($1, $2, 'loading', $3::jsonb)`,
                [snapshot.snapshotId, snapshot.sourceDate, JSON.stringify(expectedBoardIds)]
            );
            return {
                snapshot_id: snapshot.snapshotId,
                source_date: snapshot.sourceDate,
                expected_board_count: expectedBoardIds.length,
                status: 'loading'
            };
        });
    }

    async stageBoard(snapshotId, payload) {
        const entryCount = payload.items.length;
        let minRank = payload.items[0].rank;
        let maxRank = payload.items[0].rank;
        for (const item of payload.items) {
            minRank = Math.min(minRank, item.rank);
            maxRank = Math.max(maxRank, item.rank);
        }

        return this.database.withTransaction(async (query) => {
            const snapshotResult = await query(
                `SELECT status, expected_board_ids
                 FROM leaderboard_snapshots
                 WHERE snapshot_id = $1
                 FOR UPDATE`,
                [snapshotId]
            );
            const snapshot = snapshotResult.rows[0];
            if (!snapshot) throw new Error('snapshot not found');
            if (snapshot.status !== 'loading') throw new Error('snapshot is not accepting boards');

            const expectedBoardIds = asStringArray(snapshot.expected_board_ids);
            if (!expectedBoardIds.includes(payload.leaderboard_id)) {
                throw new Error(`leaderboard ${payload.leaderboard_id} is not expected by this snapshot`);
            }

            await query(
                `INSERT INTO leaderboard_catalog (leaderboard_id, subject_scope)
                 VALUES ($1, $2)
                 ON CONFLICT (leaderboard_id) DO UPDATE
                 SET subject_scope = EXCLUDED.subject_scope,
                     updated_at = CURRENT_TIMESTAMP`,
                [payload.leaderboard_id, getSubjectScope(payload.leaderboard_id)]
            );
            await query(
                `INSERT INTO leaderboard_snapshot_boards (
                    snapshot_id, leaderboard_id, leaderboard_type, leaderboard_key, leaderboard_name,
                    entry_count, min_rank, max_rank, updated_at
                 ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
                 ON CONFLICT (snapshot_id, leaderboard_id) DO UPDATE
                 SET leaderboard_type = EXCLUDED.leaderboard_type,
                     leaderboard_key = EXCLUDED.leaderboard_key,
                     leaderboard_name = EXCLUDED.leaderboard_name,
                     entry_count = EXCLUDED.entry_count,
                     min_rank = EXCLUDED.min_rank,
                     max_rank = EXCLUDED.max_rank,
                     updated_at = CURRENT_TIMESTAMP`,
                [
                    snapshotId,
                    payload.leaderboard_id,
                    payload.leaderboard_type,
                    payload.leaderboard_key,
                    payload.leaderboard_name,
                    entryCount,
                    minRank,
                    maxRank
                ]
            );
            await query(
                'DELETE FROM leaderboard_snapshot_entries WHERE snapshot_id = $1 AND leaderboard_id = $2',
                [snapshotId, payload.leaderboard_id]
            );

            const chunkSize = 1000;
            for (let offset = 0; offset < payload.items.length; offset += chunkSize) {
                const params = [];
                const values = [];
                for (const [index, item] of payload.items.slice(offset, offset + chunkSize).entries()) {
                    params.push(
                        snapshotId,
                        payload.leaderboard_id,
                        offset + index + 1,
                        item.rank,
                        item.player_name,
                        item.score,
                        item.mastery_level,
                        item.mastery_level_text,
                        item.trove_mastery_level,
                        item.geode_mastery_level
                    );
                    const start = params.length - 9;
                    values.push(`($${start}, $${start + 1}, $${start + 2}, $${start + 3}, $${start + 4}, $${start + 5}, $${start + 6}, $${start + 7}, $${start + 8}, $${start + 9}, CURRENT_TIMESTAMP)`);
                }
                await query(
                    `INSERT INTO leaderboard_snapshot_entries (
                        snapshot_id, leaderboard_id, entry_index, rank, player_name, score,
                        mastery_level, mastery_level_text, trove_mastery_level, geode_mastery_level, updated_at
                     ) VALUES ${values.join(', ')}`,
                    params
                );
            }

            const receivedResult = await query(
                'SELECT COUNT(*)::int AS received_board_count FROM leaderboard_snapshot_boards WHERE snapshot_id = $1',
                [snapshotId]
            );
            return {
                snapshot_id: snapshotId,
                leaderboard_id: payload.leaderboard_id,
                imported: payload.items.length,
                received_board_count: receivedResult.rows[0].received_board_count,
                expected_board_count: expectedBoardIds.length
            };
        });
    }

    async publishSnapshot(snapshotId) {
        return this.database.withTransaction(async (query) => {
            const snapshotResult = await query(
                `SELECT expected_board_ids, status
                 FROM leaderboard_snapshots
                 WHERE snapshot_id = $1
                 FOR UPDATE`,
                [snapshotId]
            );
            const snapshot = snapshotResult.rows[0];
            if (!snapshot) throw new Error('snapshot not found');
            if (snapshot.status !== 'loading') throw new Error('snapshot cannot be published');

            const expectedBoardIds = asStringArray(snapshot.expected_board_ids);
            const receivedResult = await query(
                'SELECT leaderboard_id FROM leaderboard_snapshot_boards WHERE snapshot_id = $1',
                [snapshotId]
            );
            const receivedIds = new Set(receivedResult.rows.map((row) => row.leaderboard_id));
            const missingBoardIds = expectedBoardIds.filter((id) => !receivedIds.has(id));
            if (missingBoardIds.length) {
                throw new Error(`snapshot is incomplete: ${missingBoardIds.join(', ')}`);
            }

            await query("UPDATE leaderboard_snapshots SET status = 'superseded' WHERE status = 'published'");
            await query(
                `UPDATE leaderboard_snapshots
                 SET status = 'published', published_at = CURRENT_TIMESTAMP
                 WHERE snapshot_id = $1`,
                [snapshotId]
            );
            await query(
                `INSERT INTO leaderboard_dataset_state (singleton, active_snapshot_id, updated_at)
                 VALUES (TRUE, $1, CURRENT_TIMESTAMP)
                 ON CONFLICT (singleton) DO UPDATE
                 SET active_snapshot_id = EXCLUDED.active_snapshot_id,
                     updated_at = CURRENT_TIMESTAMP`,
                [snapshotId]
            );
            return {
                snapshot_id: snapshotId,
                status: 'published',
                leaderboard_count: expectedBoardIds.length
            };
        });
    }
}

module.exports = { PostgresLeaderboardSnapshotRepository };
