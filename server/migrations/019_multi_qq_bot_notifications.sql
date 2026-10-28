ALTER TABLE qq_bot_groups
    ADD COLUMN IF NOT EXISTS bot_app_id TEXT NOT NULL DEFAULT '';

ALTER TABLE qq_team_notification_outbox
    ADD COLUMN IF NOT EXISTS bot_app_id TEXT NOT NULL DEFAULT '';

UPDATE qq_bot_groups AS groups
SET bot_app_id = settings.setting_value
FROM app_settings AS settings
WHERE groups.bot_app_id = ''
  AND settings.setting_key = 'qq_bot_app_id'
  AND settings.setting_value <> '';

UPDATE qq_team_notification_outbox AS outbox
SET bot_app_id = groups.bot_app_id
FROM qq_bot_groups AS groups
WHERE outbox.group_openid = groups.group_openid
  AND outbox.bot_app_id = '';

ALTER TABLE qq_team_notification_outbox
    DROP CONSTRAINT IF EXISTS qq_team_notification_outbox_group_openid_fkey;

ALTER TABLE qq_team_notification_outbox
    DROP CONSTRAINT IF EXISTS qq_team_notification_outbox_group_openid_team_id_key;

DO $$
DECLARE
    primary_columns TEXT[];
BEGIN
    SELECT ARRAY_AGG(attribute.attname ORDER BY key_part.ordinality)
      INTO primary_columns
      FROM pg_constraint AS table_constraint
      JOIN unnest(table_constraint.conkey) WITH ORDINALITY AS key_part(attnum, ordinality) ON TRUE
      JOIN pg_attribute AS attribute
        ON attribute.attrelid = table_constraint.conrelid
       AND attribute.attnum = key_part.attnum
     WHERE table_constraint.conrelid = 'qq_bot_groups'::regclass
       AND table_constraint.contype = 'p';

    IF primary_columns IS DISTINCT FROM ARRAY['bot_app_id', 'group_openid']::TEXT[] THEN
        ALTER TABLE qq_bot_groups DROP CONSTRAINT IF EXISTS qq_bot_groups_pkey;
        ALTER TABLE qq_bot_groups
            ADD CONSTRAINT qq_bot_groups_pkey PRIMARY KEY (bot_app_id, group_openid);
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_qq_team_notification_outbox_bot_group_team
    ON qq_team_notification_outbox (bot_app_id, group_openid, team_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'qq_team_notification_outbox_bot_group_fkey'
    ) THEN
        ALTER TABLE qq_team_notification_outbox
            ADD CONSTRAINT qq_team_notification_outbox_bot_group_fkey
            FOREIGN KEY (bot_app_id, group_openid)
            REFERENCES qq_bot_groups (bot_app_id, group_openid)
            ON DELETE CASCADE;
    END IF;
END $$;
