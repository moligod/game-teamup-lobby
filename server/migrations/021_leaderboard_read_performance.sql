ALTER TABLE leaderboard_snapshot_boards
    ADD COLUMN entry_count INTEGER,
    ADD COLUMN min_rank INTEGER,
    ADD COLUMN max_rank INTEGER;

UPDATE leaderboard_snapshot_boards board
SET entry_count = stats.entry_count,
    min_rank = stats.min_rank,
    max_rank = stats.max_rank
FROM (
    SELECT snapshot_id,
           leaderboard_id,
           COUNT(*)::int AS entry_count,
           MIN(rank)::int AS min_rank,
           MAX(rank)::int AS max_rank
    FROM leaderboard_snapshot_entries
    GROUP BY snapshot_id, leaderboard_id
) stats
WHERE stats.snapshot_id = board.snapshot_id
  AND stats.leaderboard_id = board.leaderboard_id;

UPDATE leaderboard_snapshot_boards
SET entry_count = 0
WHERE entry_count IS NULL;

ALTER TABLE leaderboard_snapshot_boards
    ALTER COLUMN entry_count SET DEFAULT 0,
    ALTER COLUMN entry_count SET NOT NULL,
    ADD CONSTRAINT leaderboard_snapshot_boards_entry_count_nonnegative CHECK (entry_count >= 0);

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX idx_leaderboard_snapshot_entries_player_search
    ON leaderboard_snapshot_entries USING gin (lower(player_name) gin_trgm_ops);

CREATE OR REPLACE VIEW leaderboard_current_boards AS
SELECT
    board.snapshot_id,
    board.leaderboard_id,
    board.leaderboard_type,
    board.leaderboard_key,
    board.leaderboard_name,
    board.updated_at,
    catalog.subject_scope,
    board.entry_count,
    board.min_rank,
    board.max_rank
FROM leaderboard_dataset_state state
JOIN leaderboard_snapshots snapshot
    ON snapshot.snapshot_id = state.active_snapshot_id
   AND snapshot.status = 'published'
JOIN leaderboard_snapshot_boards board
    ON board.snapshot_id = snapshot.snapshot_id
JOIN leaderboard_catalog catalog
    ON catalog.leaderboard_id = board.leaderboard_id;
