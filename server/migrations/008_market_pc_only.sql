UPDATE official_market_products
SET platform = 'PC',
    server = 'PC'
WHERE platform <> 'PC' OR server <> 'PC';

ALTER TABLE official_market_products
    ALTER COLUMN platform SET DEFAULT 'PC',
    ALTER COLUMN server SET DEFAULT 'PC';
