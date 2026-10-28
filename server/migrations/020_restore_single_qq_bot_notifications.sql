WITH primary_bot AS (
    SELECT setting_value AS app_id
    FROM app_settings
    WHERE setting_key = 'qq_bot_app_id'
)
DELETE FROM qq_team_notification_outbox
WHERE bot_app_id <> COALESCE((SELECT app_id FROM primary_bot), '');

WITH primary_bot AS (
    SELECT setting_value AS app_id
    FROM app_settings
    WHERE setting_key = 'qq_bot_app_id'
)
DELETE FROM qq_bot_groups
WHERE bot_app_id <> COALESCE((SELECT app_id FROM primary_bot), '');

ALTER TABLE qq_team_notification_outbox
    DROP CONSTRAINT IF EXISTS qq_team_notification_outbox_bot_group_fkey;

ALTER TABLE qq_team_notification_outbox
    DROP CONSTRAINT IF EXISTS qq_team_notification_outbox_group_openid_fkey;

ALTER TABLE qq_team_notification_outbox
    DROP CONSTRAINT IF EXISTS qq_team_notification_outbox_group_openid_team_id_key;

DROP INDEX IF EXISTS uq_qq_team_notification_outbox_bot_group_team;

ALTER TABLE qq_bot_groups
    DROP CONSTRAINT IF EXISTS qq_bot_groups_pkey;

ALTER TABLE qq_bot_groups
    ADD CONSTRAINT qq_bot_groups_pkey PRIMARY KEY (group_openid);

ALTER TABLE qq_team_notification_outbox
    DROP COLUMN IF EXISTS bot_app_id;

ALTER TABLE qq_team_notification_outbox
    ADD CONSTRAINT qq_team_notification_outbox_group_openid_fkey
    FOREIGN KEY (group_openid)
    REFERENCES qq_bot_groups (group_openid)
    ON DELETE CASCADE;

ALTER TABLE qq_team_notification_outbox
    ADD CONSTRAINT qq_team_notification_outbox_group_openid_team_id_key
    UNIQUE (group_openid, team_id);

ALTER TABLE qq_bot_groups
    DROP COLUMN IF EXISTS bot_app_id;

DELETE FROM app_settings
WHERE setting_key IN (
    'qq_bot_secondary_app_id',
    'qq_bot_secondary_app_secret'
);
