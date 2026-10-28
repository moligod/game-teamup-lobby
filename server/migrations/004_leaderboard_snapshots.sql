CREATE TABLE leaderboard_catalog (
    leaderboard_id TEXT PRIMARY KEY,
    subject_scope TEXT NOT NULL DEFAULT 'player' CHECK (subject_scope IN ('player', 'guild')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE leaderboard_snapshots (
    snapshot_id UUID PRIMARY KEY,
    source_date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('loading', 'published', 'superseded', 'failed')),
    expected_board_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMPTZ
);

CREATE TABLE leaderboard_snapshot_boards (
    snapshot_id UUID NOT NULL REFERENCES leaderboard_snapshots(snapshot_id) ON DELETE CASCADE,
    leaderboard_id TEXT NOT NULL REFERENCES leaderboard_catalog(leaderboard_id),
    leaderboard_type TEXT NOT NULL,
    leaderboard_key TEXT,
    leaderboard_name TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (snapshot_id, leaderboard_id)
);

CREATE TABLE leaderboard_snapshot_entries (
    snapshot_id UUID NOT NULL,
    leaderboard_id TEXT NOT NULL,
    entry_index INTEGER NOT NULL,
    rank INTEGER NOT NULL,
    player_name TEXT NOT NULL,
    score TEXT NOT NULL,
    mastery_level INTEGER,
    mastery_level_text TEXT,
    trove_mastery_level INTEGER,
    geode_mastery_level INTEGER,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (snapshot_id, leaderboard_id, entry_index),
    FOREIGN KEY (snapshot_id, leaderboard_id)
        REFERENCES leaderboard_snapshot_boards(snapshot_id, leaderboard_id)
        ON DELETE CASCADE
);

CREATE TABLE leaderboard_dataset_state (
    singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
    active_snapshot_id UUID REFERENCES leaderboard_snapshots(snapshot_id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_leaderboard_snapshot_entries_board_order
    ON leaderboard_snapshot_entries (snapshot_id, leaderboard_id, entry_index);
CREATE INDEX idx_leaderboard_snapshot_entries_player_profile
    ON leaderboard_snapshot_entries (snapshot_id, lower(player_name), leaderboard_id, rank, entry_index);
CREATE INDEX idx_leaderboard_snapshot_boards_updated
    ON leaderboard_snapshot_boards (snapshot_id, updated_at DESC);

-- Keep local test data available as the first immutable read snapshot.
INSERT INTO leaderboard_catalog (leaderboard_id, subject_scope)
SELECT leaderboard_id,
       CASE WHEN leaderboard_id = '1100' THEN 'guild' ELSE 'player' END
FROM leaderboards
ON CONFLICT (leaderboard_id) DO UPDATE
SET subject_scope = EXCLUDED.subject_scope,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO leaderboard_snapshots (
    snapshot_id, source_date, status, expected_board_ids, created_at, published_at
)
SELECT
    '00000000-0000-0000-0000-000000000001'::uuid,
    COALESCE(MAX(updated_at)::date, CURRENT_DATE),
    'published',
    jsonb_agg(leaderboard_id ORDER BY leaderboard_id),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM leaderboards
HAVING COUNT(*) > 0
ON CONFLICT (snapshot_id) DO NOTHING;

INSERT INTO leaderboard_snapshot_boards (
    snapshot_id, leaderboard_id, leaderboard_type, leaderboard_key, leaderboard_name, updated_at
)
SELECT
    '00000000-0000-0000-0000-000000000001'::uuid,
    leaderboard_id,
    leaderboard_type,
    leaderboard_key,
    leaderboard_name,
    updated_at
FROM leaderboards
WHERE EXISTS (
    SELECT 1 FROM leaderboard_snapshots
    WHERE snapshot_id = '00000000-0000-0000-0000-000000000001'::uuid
)
ON CONFLICT (snapshot_id, leaderboard_id) DO NOTHING;

INSERT INTO leaderboard_snapshot_entries (
    snapshot_id, leaderboard_id, entry_index, rank, player_name, score,
    mastery_level, mastery_level_text, trove_mastery_level, geode_mastery_level, updated_at
)
SELECT
    '00000000-0000-0000-0000-000000000001'::uuid,
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
FROM leaderboard_entries
WHERE EXISTS (
    SELECT 1 FROM leaderboard_snapshots
    WHERE snapshot_id = '00000000-0000-0000-0000-000000000001'::uuid
)
ON CONFLICT (snapshot_id, leaderboard_id, entry_index) DO NOTHING;

INSERT INTO leaderboard_dataset_state (singleton, active_snapshot_id)
SELECT TRUE, '00000000-0000-0000-0000-000000000001'::uuid
WHERE EXISTS (
    SELECT 1 FROM leaderboard_snapshots
    WHERE snapshot_id = '00000000-0000-0000-0000-000000000001'::uuid
)
ON CONFLICT (singleton) DO NOTHING;

CREATE OR REPLACE VIEW leaderboard_current_boards AS
SELECT
    board.snapshot_id,
    board.leaderboard_id,
    board.leaderboard_type,
    board.leaderboard_key,
    board.leaderboard_name,
    board.updated_at,
    catalog.subject_scope
FROM leaderboard_dataset_state state
JOIN leaderboard_snapshots snapshot
    ON snapshot.snapshot_id = state.active_snapshot_id
   AND snapshot.status = 'published'
JOIN leaderboard_snapshot_boards board
    ON board.snapshot_id = snapshot.snapshot_id
JOIN leaderboard_catalog catalog
    ON catalog.leaderboard_id = board.leaderboard_id;

CREATE OR REPLACE VIEW leaderboard_current_entries AS
SELECT
    entry.snapshot_id,
    entry.leaderboard_id,
    entry.entry_index,
    entry.rank,
    entry.player_name,
    entry.score,
    entry.mastery_level,
    entry.mastery_level_text,
    entry.trove_mastery_level,
    entry.geode_mastery_level,
    entry.updated_at
FROM leaderboard_dataset_state state
JOIN leaderboard_snapshot_entries entry
    ON entry.snapshot_id = state.active_snapshot_id;
