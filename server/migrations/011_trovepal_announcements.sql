CREATE TABLE IF NOT EXISTS trovepal_announcements (
    source_id TEXT PRIMARY KEY,
    category TEXT NOT NULL CHECK (category IN ('announcement', 'update', 'promotion', 'pts')),
    channel_name TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    author_name TEXT NOT NULL,
    author_username TEXT,
    image_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
    posted_at TIMESTAMPTZ,
    source_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_trovepal_announcements_feed
    ON trovepal_announcements (posted_at DESC NULLS LAST, source_id DESC);

CREATE INDEX IF NOT EXISTS idx_trovepal_announcements_category_feed
    ON trovepal_announcements (category, posted_at DESC NULLS LAST, source_id DESC);
