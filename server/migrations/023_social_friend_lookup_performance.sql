CREATE INDEX IF NOT EXISTS idx_friends_friend_status_created
    ON friends (friend_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_friends_user_status_created
    ON friends (user_id, status, created_at DESC);
