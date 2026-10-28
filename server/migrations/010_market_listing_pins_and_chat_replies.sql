ALTER TABLE market_listings
    ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_market_listings_public_pinned
    ON market_listings (is_active, is_pinned DESC, created_at DESC, id DESC);

ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS reply_to_id INTEGER REFERENCES messages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_reply_to
    ON messages (reply_to_id)
    WHERE reply_to_id IS NOT NULL;

DROP TABLE IF EXISTS official_market_products;
