DO $$
DECLARE
    legacy_constraint TEXT;
BEGIN
    IF to_regclass('public.market_reviews') IS NULL THEN
        RETURN;
    END IF;

    SELECT constraint_name INTO legacy_constraint
    FROM information_schema.constraint_column_usage usage
    INNER JOIN pg_constraint constraint_def ON constraint_def.conname = usage.constraint_name
      AND constraint_def.conrelid = 'public.market_reviews'::regclass
    WHERE usage.table_schema = 'public'
      AND usage.table_name = 'market_reviews'
      AND usage.column_name = 'rating'
      AND constraint_def.contype = 'c'
      AND pg_get_constraintdef(constraint_def.oid) LIKE '%-1%'
    LIMIT 1;

    IF legacy_constraint IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.market_reviews DROP CONSTRAINT %I', legacy_constraint);
        UPDATE market_reviews
        SET rating = CASE rating
            WHEN 1 THEN 5
            WHEN -1 THEN 1
            ELSE rating
        END
        WHERE rating IN (-1, 1);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.market_reviews'::regclass
          AND conname = 'market_reviews_rating_range_check'
    ) THEN
        ALTER TABLE public.market_reviews
            ADD CONSTRAINT market_reviews_rating_range_check CHECK (rating BETWEEN 1 AND 5);
    END IF;
END $$;
