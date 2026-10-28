DELETE FROM app_settings
WHERE setting_key IN (
    'discord_bot_token',
    'discord_guild_id',
    'discord_channel_id',
    'discord_announcement_display_limit'
);

DROP TABLE IF EXISTS discord_announcements;
