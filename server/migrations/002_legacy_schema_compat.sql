ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';
ALTER TABLE users ADD COLUMN IF NOT EXISTS online_status TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS oauth_provider TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS oauth_uid TEXT;
UPDATE users SET role = 'user' WHERE role IS NULL OR role = '';

ALTER TABLE leaderboards ADD COLUMN IF NOT EXISTS leaderboard_key TEXT;
ALTER TABLE leaderboards ADD COLUMN IF NOT EXISTS leaderboard_name TEXT;

DO $$
DECLARE
    primary_key_columns TEXT[];
BEGIN
    SELECT array_agg(attribute.attname ORDER BY array_position(indexes.indkey, attribute.attnum))
      INTO primary_key_columns
      FROM pg_index indexes
      JOIN pg_attribute attribute
        ON attribute.attrelid = indexes.indrelid
       AND attribute.attnum = ANY(indexes.indkey)
     WHERE indexes.indrelid = 'leaderboard_entries'::regclass
       AND indexes.indisprimary;

    IF primary_key_columns IS DISTINCT FROM ARRAY['leaderboard_id', 'entry_index']::TEXT[] THEN
        ALTER TABLE leaderboard_entries RENAME TO leaderboard_entries_legacy;
        CREATE TABLE leaderboard_entries (
            leaderboard_id TEXT NOT NULL REFERENCES leaderboards(leaderboard_id) ON DELETE CASCADE,
            entry_index INTEGER NOT NULL,
            rank INTEGER NOT NULL,
            player_name TEXT NOT NULL,
            score TEXT NOT NULL,
            mastery_level INTEGER,
            mastery_level_text TEXT,
            trove_mastery_level INTEGER,
            geode_mastery_level INTEGER,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (leaderboard_id, entry_index)
        );
        INSERT INTO leaderboard_entries (leaderboard_id, entry_index, rank, player_name, score, updated_at)
        SELECT leaderboard_id,
               ROW_NUMBER() OVER (PARTITION BY leaderboard_id ORDER BY rank ASC, player_name ASC),
               rank,
               player_name,
               score,
               updated_at
          FROM leaderboard_entries_legacy;
        DROP TABLE leaderboard_entries_legacy;
    END IF;
END $$;

ALTER TABLE leaderboard_entries ADD COLUMN IF NOT EXISTS mastery_level INTEGER;
ALTER TABLE leaderboard_entries ADD COLUMN IF NOT EXISTS mastery_level_text TEXT;
ALTER TABLE leaderboard_entries ADD COLUMN IF NOT EXISTS trove_mastery_level INTEGER;
ALTER TABLE leaderboard_entries ADD COLUMN IF NOT EXISTS geode_mastery_level INTEGER;

ALTER TABLE player_profession_combat ADD COLUMN IF NOT EXISTS knight INTEGER DEFAULT 0;
ALTER TABLE player_profession_combat ADD COLUMN IF NOT EXISTS gunslinger INTEGER DEFAULT 0;
ALTER TABLE player_profession_combat ADD COLUMN IF NOT EXISTS fae_trickster INTEGER DEFAULT 0;
ALTER TABLE player_profession_combat ADD COLUMN IF NOT EXISTS dracolyte INTEGER DEFAULT 0;
ALTER TABLE player_profession_combat ADD COLUMN IF NOT EXISTS neon_ninja INTEGER DEFAULT 0;
ALTER TABLE player_profession_combat ADD COLUMN IF NOT EXISTS candy_barbarian INTEGER DEFAULT 0;
ALTER TABLE player_profession_combat ADD COLUMN IF NOT EXISTS ice_sage INTEGER DEFAULT 0;
ALTER TABLE player_profession_combat ADD COLUMN IF NOT EXISTS shadow_hunter INTEGER DEFAULT 0;
ALTER TABLE player_profession_combat ADD COLUMN IF NOT EXISTS pirate_captain INTEGER DEFAULT 0;
ALTER TABLE player_profession_combat ADD COLUMN IF NOT EXISTS boomeranger INTEGER DEFAULT 0;
ALTER TABLE player_profession_combat ADD COLUMN IF NOT EXISTS tomb_raiser INTEGER DEFAULT 0;
ALTER TABLE player_profession_combat ADD COLUMN IF NOT EXISTS lunar_lancer INTEGER DEFAULT 0;
ALTER TABLE player_profession_combat ADD COLUMN IF NOT EXISTS revenant INTEGER DEFAULT 0;
ALTER TABLE player_profession_combat ADD COLUMN IF NOT EXISTS chloromancer INTEGER DEFAULT 0;
ALTER TABLE player_profession_combat ADD COLUMN IF NOT EXISTS dino_tamer INTEGER DEFAULT 0;
ALTER TABLE player_profession_combat ADD COLUMN IF NOT EXISTS vanguardian INTEGER DEFAULT 0;
ALTER TABLE player_profession_combat ADD COLUMN IF NOT EXISTS bard INTEGER DEFAULT 0;
ALTER TABLE player_profession_combat ADD COLUMN IF NOT EXISTS solarion INTEGER DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_oauth_identity
    ON users (oauth_provider, oauth_uid)
    WHERE oauth_provider IS NOT NULL AND oauth_uid IS NOT NULL;
