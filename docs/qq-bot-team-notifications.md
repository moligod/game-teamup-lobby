# QQ Bot Team Notifications

The backend sends a QQ group message after a team is created. It uses QQ Bot
API v2 directly and does not use the legacy `bot-node-sdk` bundled under
`docs/`.

## Runtime configuration

Set these values in the deployment `.env` file for first-run initialization, or
configure them in the admin **Integrations** page after deployment:

```dotenv
PUBLIC_BASE_URL=https://example.com
QQ_BOT_APP_ID=<QQ Bot AppID>
QQ_BOT_APP_SECRET=<QQ Bot AppSecret>
QQ_BOT_NOTIFICATION_POLL_MS=15000
TROVEPAL_ANNOUNCEMENT_REFRESH_MS=900000
```

`QQ_BOT_APP_SECRET` is used only for the Access Token request. It must not be committed. When saved from the admin page it is
stored as a secret setting, is never returned by the API, and takes effect
without restarting the backend.

Announcements are synchronized once when the backend starts and then at the
configured interval (15 minutes by default). The refresh runs in the
background; a failed upstream request leaves the previously cached news
available and is retried at the next interval.

## QQ Open Platform configuration

1. Select **WebSocket** as the event delivery method. Do not configure a
   message callback URL.
2. Grant and enable the `GROUP_AND_C2C_EVENT` and `INTERACTION` intents. They
   cover `GROUP_MSG_RECEIVE`, `GROUP_MSG_REJECT`, `GROUP_AT_MESSAGE_CREATE`,
   `GROUP_MESSAGE_CREATE`, `C2C_MESSAGE_CREATE`, lifecycle events, and
   slash-command interactions.
3. The backend resolves QQ's WSS Gateway, authenticates with
   `QQBot {AccessToken}`, maintains heartbeats, and reconnects automatically.
   It therefore needs outbound HTTPS/WSS access but no public callback route or
   reverse tunnel.
4. In each target QQ group, turn "机器人主动在群聊内发言" off and back on after
   the Gateway is connected. The `GROUP_MSG_RECEIVE` event contains the
   `group_openid`; the backend records it automatically.
5. Add `https://example.com` to QQ's message URL allowlist before sending the
   lobby link in a group message.

The QQ group number is not stored and is never used as an API target. QQ's
`group_openid` is captured only from the platform event payload.

Group commands and C2C commands use the original QQ event message ID for a
passive reply, so a command can be answered even when proactive messages are
disabled for that group or user. Team-created notifications remain proactive
and are sent only to groups that enabled proactive messages.

## Message format

Team-created notifications, `队伍列表`, player-information, `最新资讯`, and
`交易市场` responses use API v2 Markdown (`msg_type: 2`) plus a custom inline
keyboard. Team cards include an **打开组队大厅** link and command entries for
**队伍列表**, **菜单**, **玩家信息**, **最新资讯**, and **交易市场**. Sending
`/菜单` or `/帮助` returns a four-button command menu containing exactly **队伍列表**,
**玩家信息**, **最新资讯**, and **交易市场**. The latest-news and market cards
also link to the corresponding public site page. No platform Markdown template
ID is required: current QQ API v2 documents mark the old `template_id` and
`custom_template_id` fields as deprecated.

## Delivery behavior

When a team is created, the lobby command service first persists the team and
publishes existing website WebSocket updates. It then writes a per-group row to
`qq_team_notification_outbox`. A background worker sends queued messages with
an API v2 Access Token over QQ's HTTP group-message endpoint. Failed sends are retried with exponential backoff and
never make team creation fail.
