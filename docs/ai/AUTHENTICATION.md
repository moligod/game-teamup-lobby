# Authentication and authority

## Ordinary users

1. `GET /api/auth/qq/start` creates a single-use OAuth state.
2. QQ redirects to `GET /api/auth/qq/callback`.
3. The callback creates/updates the user and redirects with a single-use ticket.
4. `POST /api/auth/qq/session` exchanges that ticket for the user projection and
   a seven-day HMAC-signed bearer token.
5. The frontend stores the existing `user` and `token` keys.

`USER_SESSION_SECRET` signs tokens and must be a long random production secret.
Changing it invalidates all ordinary-user sessions.

Protected HTTP routes use `Authorization: Bearer <token>`. `requireUser`
populates `req.user.userId`; route adapters ignore claimed `userId`, `user_id`
and `leader_id` values when choosing the actor.

## WebSocket

The browser sends the signed token in a `bearer.<token>` WebSocket subprotocol;
the URL contains only the non-secret `clientId`. `WebSocketManager` validates
the token and obtains the user ID from its signed payload. A `userId` query
parameter is ignored. Guests can connect but are not inserted into authenticated
user presence maps. The server temporarily accepts `access_token` for old
clients, but new code must use the subprotocol so proxies do not log tokens.

## Administrators

`POST /api/admin/login` uses the dedicated administrator credential/session
service. Admin bearer tokens are stored under `adminToken` and are accepted only
by `requireAdmin`. QQ OAuth cannot create an admin session.

## Leaderboard collector

The three `/api/collector/leaderboard/*` mutation routes use a dedicated static
Bearer credential from `LEADERBOARD_COLLECTOR_TOKEN`; user and administrator
sessions are not accepted there. The token must contain at least 32 characters.
Missing configuration disables collection with `503`, while missing or invalid
credentials return `401`. Rotate the backend and collector values together and
never place the token in a URL or request body.

## Security invariants

- Never log bearer/session/OAuth tokens or secrets.
- Never use a request-supplied ID as authority for a protected mutation.
- Never expose `appkey`, bot tokens or PostgreSQL credentials.
- Add an authority test whenever a protected route is introduced.
