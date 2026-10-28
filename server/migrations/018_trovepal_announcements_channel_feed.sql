CREATE INDEX IF NOT EXISTS idx_trovepal_announcements_channel_feed
    ON trovepal_announcements (channel_name, posted_at DESC NULLS LAST, source_id DESC);
