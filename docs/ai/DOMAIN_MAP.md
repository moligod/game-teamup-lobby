# Domain ownership map

## Identity

Owns QQ OAuth state/tickets, signed ordinary-user sessions, administrator
sessions, profile avatar/signature changes and authenticated identity.

Backend: `server/src/modules/identity/`, identity infrastructure and
`identity-repository.js`.

Frontend: `src/features/auth/` and `src/features/admin/auth/`.

## Lobby

Owns team types, teams, membership, approval applications, lobby and team-private chat messages,
expiration policy and lobby realtime notifications.

Backend: `lobby-service.js`, `lobby-command-service.js`, `lobby-routes.js` and
`lobby-repository.js`.

Frontend: `src/features/lobby/`.

## Social

Owns user discovery, friend requests, friendship lifecycle and social realtime
notifications. It uses a public user projection, not Identity internals.

Backend: `server/src/modules/social/` and `social-repository.js`.

Frontend: `src/features/social/`; lobby composition consumes its public API.

## Players

Owns user-to-player binding, combat data and profession summaries. It does not
own login/profile identity.

Backend: `server/src/modules/players/` and `player-repository.js`.

Frontend: `src/features/players/`.

## Leaderboard

Owns snapshot collector validation, atomic publication, cache invalidation,
version hashes, gzip binary payloads, list/detail/search queries, player
cross-leaderboard profiles and update events.

Backend: `server/src/modules/leaderboard/`, `leaderboard-store.js`,
`leaderboard-query-repository.js`, `leaderboard-snapshot-repository.js` and
the gzip encoder adapter.

Frontend: `src/features/leaderboard/`, including the player profile drawer.

## Announcements

Owns the server-side adapter for the TrovePal public announcement API. It uses
an injected client with the backend-only API key and exposes the upstream
channel list. The protected synchronization operation fetches all bounded pages
into PostgreSQL; the public feed reads local, channel-filtered pages from that
cache. Announcement image URLs remain direct `api.trovepal.com` URLs and are
not downloaded or proxied by TroveBBS.

Backend: `server/src/modules/announcements/` and
`server/src/infrastructure/trovepal/`.

Frontend: `src/features/announcements/`.

## Administration

Owns protected summaries, operational lists/actions, allowlisted database
inspection/cleanup, TrovePal announcement, QQ OAuth and image-host configuration changes.
Authentication is supplied by Identity.

Backend: `server/src/modules/admin/` and `admin-repository.js`.

Frontend: `src/features/admin/`.

## Market

Owns C2C listings, buyer-seller conversations, private trade messages and
buyer feedback. It depends on an injected image-host gateway for review image
uploads; the image-host API key is only stored and changed through
Administration.

Backend: `server/src/modules/market/` and `market-repository.js`.

Frontend: `src/features/market/`.

## Platform and infrastructure

Platform owns readiness, retry and generic expiration utilities.
Infrastructure owns PostgreSQL, migrations, external clients, encoding and
local upload mechanics. Neither contains business policy.

## Dependency constraints

- Modules exchange IDs or explicit public projections, never repository objects.
- Application services depend on injected ports and have no Express/`pg` imports.
- Pages do not perform transport calls.
- Features do not import `src/app` or `src/pages`.
- `src/shared` imports no feature or page.
