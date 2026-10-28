# TroveBBS architecture

## Runtime

- Frontend: React 19, TypeScript, Vite, React Router, Nginx.
- Backend: Node.js 22, Express 4, CommonJS and `ws`.
- Database: PostgreSQL 16 with ordered SQL migrations.
- Local Docker entry point: `http://127.0.0.1:18080`.
- Production public entry: the separate 1Panel/OpenResty container on 80/443,
  proxying to the loopback-only frontend port `127.0.0.1:8080`.

The backend does not listen until migrations, seed data and a PostgreSQL health
query succeed. Retry is bounded; a permanent initialization failure exits the
startup path so Docker can restart the container.

The public and private proxy layers deliberately have different roles. Public
OpenResty owns TLS, compression, shared public API caching, rate/concurrency
limits and the trusted client-IP boundary. The private frontend Nginx owns SPA
assets, direct read-only upload delivery and the final hop to Node. The private
port must never bind to a public interface because Node trusts one proxy hop.

## Backend boundaries

```text
HTTP/WebSocket adapter -> application service -> repository/gateway port
                                             -> PostgreSQL/external adapter
```

```text
server/
  migrations/                         # ordered, immutable SQL migrations
  src/
    modules/
      identity/                       # QQ auth, signed sessions, profile
      lobby/                          # teams, applications, chat
      social/                         # friendships and discovery
      players/                        # player binding and combat projection
      leaderboard/                    # snapshot collector, cache, version and queries
      announcements/                  # TrovePal sync gateway and locally cached channel-filtered feed
      admin/                           # protected operational use cases
      market/                          # C2C listings, private trade chats and buyer feedback
    infrastructure/
      identity/                       # OAuth client and HMAC token codec
      persistence/postgres/           # connection, migrations, repositories
      trovepal/                       # external TrovePal announcement client
      encoding/                       # gzip JSON binary adapter
      uploads/                        # avatar and configurable image-host adapters
    platform/                         # readiness, retry and generic stores
  server.js                           # composition, middleware and lifecycle only
```

`server/server.js` is the composition root. It creates concrete adapters,
injects them into services and registers route adapters. It contains no domain
routes or SQL. Application services are testable without Express, Docker or
PostgreSQL.

All business SQL lives in a domain-specific repository under
`server/src/infrastructure/persistence/postgres/`. The small `database.js`
facade owns only the connection, transaction primitive, migration runner,
health query and idempotent seed data.

## Authentication authority

QQ OAuth callback completion creates a signed ordinary-user session token.
Protected HTTP routes resolve `req.user` from that token. Legacy body/path
fields such as `userId`, `user_id` and `leader_id` remain accepted for payload
compatibility but never decide the acting identity.

WebSocket clients send the same signed token as `access_token`; the server
ignores claimed `userId` query parameters. Administrator sessions remain a
separate bearer-token system and cannot be obtained through QQ login.

See `docs/ai/AUTHENTICATION.md` for the exact rules.

## Frontend boundaries

```text
app -> pages -> features -> shared
```

`src/pages` contains route wrappers only. Each feature owns its API client,
state/realtime hook and business components. `src/shared/ui` is the project
component library; it is presentational and cannot import a feature, page,
transport or authentication module.

`src/shared/theme/ThemeProvider.tsx` owns the persisted light/dark preference.
`src/styles.css` exposes semantic design tokens for both themes; feature code
and shared components must not create isolated color-mode state or palettes.

Feature components receive application identity through props. They do not
import `app-context`, which prevents an inward layer from depending on the
application shell.

Route pages are lazy loaded and Vite isolates React, router and icon vendors.
The CI build enforces gzip budgets for the largest JavaScript chunk, all
JavaScript and all CSS. Replaceable requests use `AbortController`; keyed lobby
refreshes coalesce repeated realtime invalidations. Browser tabs elect one
leader and share one physical WebSocket through BroadcastChannel, with a
localStorage event-bus fallback and a bounded lease takeover window.

## Performance boundaries

- `ExpiringStore` is capacity bounded and combines concurrent loads for the
  same key. It remains process-local; horizontal backend scaling requires a
  Redis/distributed cache and lock strategy.
- Public market reads use bounded database pagination and invalidate cached
  pages after writes. Short leaderboard queries search only board metadata;
  three-or-more-character player searches use a trigram index.
- PostgreSQL clients have connection, statement, lock and idle-transaction
  timeouts. `/health` publishes bounded pool totals, idle and waiting counts.
- WebSocket frames are limited to 64 KiB. The server pings stale peers, bounds
  inbound message rate, serializes broadcasts once, coalesces presence changes
  and closes slow clients before their send queue grows without bound.
- Collector authentication runs before its 32 MiB parser. Upload and external
  HTTP paths have deadlines, cancellation and bounded concurrency.
- The public OpenResty configuration is the only layer that applies gzip,
  shared proxy cache, cache locking and public IP limits. Brotli remains off
  until the actual OpenResty build confirms module support.

## Stable contracts

- Existing HTTP methods, paths and successful response shapes are preserved.
- Existing WebSocket event names and payload shapes are preserved.
- Existing tables, columns, data volume and Docker service names are preserved.
- Protected operations now return `401` when no valid session is supplied.
- Released local-storage keys remain `user`, `token`, `adminUser` and
  `adminToken`.

## Cross-domain rules

- Lobby uses Identity only through a small user-directory projection.
- Profile updates notify Social through an explicit service method.
- Players consume the active leaderboard snapshot through their repository adapter.
- Admin uses dedicated operational queries and public invalidation gateways.
- Market owns listing conversations, participant-only realtime notifications and buyer feedback.
- No application service imports another domain's concrete repository.
