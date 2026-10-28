CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_market_listings_active_category_newest
    ON market_listings (category, is_pinned DESC, created_at DESC, id DESC)
    WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_market_listings_active_flux_price
    ON market_listings (is_pinned DESC, price ASC, created_at DESC, id DESC)
    WHERE is_active = TRUE AND category = 'flux';

CREATE INDEX IF NOT EXISTS idx_market_listings_active_title_trgm
    ON market_listings USING gin (lower(title) gin_trgm_ops)
    WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_users_username_trgm
    ON users USING gin (lower(username) gin_trgm_ops);
