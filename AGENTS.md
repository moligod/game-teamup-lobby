# Trovebbs AI development guide

This file is the mandatory entry point for AI-assisted development in this
repository. Read it before changing code. Use `ARCHITECTURE.md` and the files in
`docs/ai/` for deeper context.

## Product and runtime

- Frontend: React 19, TypeScript, Vite, React Router, Nginx.
- Backend: Node.js 22, CommonJS, Express 4, PostgreSQL 16, `ws`.
- Local Docker URL: `http://127.0.0.1:18080`.
- Public contracts: `/api/*`, `/health`, `/uploads/*`, and `/ws`.
- PostgreSQL and `docker-data/` contain user/runtime data. Never delete or reset
  them as part of a refactor.

## Required architecture

Backend dependencies flow in this direction:

```text
HTTP route adapter -> application service -> repository/gateway port
                                      -> infrastructure adapter
```

- `server/server.js` is the composition/lifecycle root. Do not add domain routes,
  business logic or SQL to it.
- Application services must not import Express, `pg`, or concrete WebSocket
  classes.
- PostgreSQL SQL belongs in `server/src/infrastructure/persistence/postgres/`.
- Route adapters parse HTTP input, invoke one application service, and map the
  result to the existing response contract.
- Cross-domain communication uses explicit service/gateway methods, not direct
  access to another module's tables or internal objects.

Frontend dependencies flow in this direction:

```text
app -> pages -> features -> shared
```

- `src/pages` contains thin route composition only.
- Feature API clients, hooks, state and business components belong in
  `src/features/<feature>/`.
- `src/shared` must never import a feature or page.
- Reusable primitives live in `src/shared/ui`; import component files directly.
  Do not create a barrel `index.ts` for the UI library.
- Appearance state lives in `src/shared/theme/ThemeProvider.tsx`. Use semantic
  tokens from `src/styles.css`; do not introduce component-local light/dark
  hex palettes or read/write the theme key outside that provider.
- Keep the current CSS class contract while components are migrated. Visual
  redesign is a separate task unless explicitly requested.

## Stable contracts during refactoring

Unless a task explicitly authorizes a breaking change, preserve:

- HTTP method, path, status code and JSON/binary response shape.
- WebSocket path, event name and event payload shape.
- PostgreSQL table/column meaning and existing data.
- Docker service names, local port and production reverse-proxy paths.
- Local-storage keys used by released clients.

When a contract must change, add a compatibility adapter or a versioned path and
document the migration.

## Security rules

- Never log passwords, bot tokens, OAuth secrets, bearer tokens or full session
  values.
- Protected operations must derive identity from an authenticated session; do
  not add new endpoints that trust a request-supplied `user_id` as authority.
- WebSocket identity uses the same signed ordinary-user session as HTTP. Never
  restore authority from a claimed `userId` query parameter.
- Validate and bound all strings, arrays, upload sizes, pagination and collector
  payloads at the route boundary.

## Data rules

- Never run `docker compose down -v`, `DROP DATABASE`, broad `DELETE`, or reset a
  volume unless the user explicitly requests data deletion.
- Schema changes use new append-only ordered SQL migrations. Keep compatibility
  migrations idempotent for existing volumes.
- Transactions belong in the repository/application boundary that owns the
  consistency rule.
- Use PostgreSQL-native parameter placeholders. SQLite compatibility
  transformations are not part of this codebase.

## React rules

- Fetch independent resources in parallel.
- Put feature transport calls in feature API modules, not components.
- Split hooks by independent dependency/lifecycle; do not create a single global
  hook that subscribes to unrelated state.
- Derive simple state during render. Avoid effects that only copy other state.
- Keep context values memoized and callbacks stable when consumers depend on
  their identity.
- Use the shared `Button`, `IconButton`, `Badge`, `SegmentedControl` and
  `ThemeToggle` primitives before adding a one-off equivalent control.
- Do not define React components inside other components.
- Use `Set`/`Map` for repeated membership/lookups and direct imports for bundle
  clarity.

## Commands (PowerShell)

Run from the repository root unless noted.

```powershell
npm run build
npm --prefix server test
node --check server/server.js
node --check server/src/infrastructure/persistence/postgres/database.js
docker compose config --quiet
docker compose -f docker-compose.prod.yml config --quiet
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.local.yml ps
Invoke-WebRequest http://127.0.0.1:18080/health -UseBasicParsing
```

For backend dependency changes:

```powershell
npm --prefix server audit --omit=dev
```

## Verification ladder

1. Run focused unit tests for the changed service/adapter.
2. Run `npm --prefix server test` for backend changes.
3. Run `npm run build` for all frontend-visible changes.
4. Validate both Compose files after Docker/config changes.
5. Rebuild local Docker for runtime or dependency changes.
6. Smoke-test `/health`, affected APIs and affected WebSocket events.
7. Inspect container health and restart count.

Do not claim a broad refactor is complete based only on a successful build.

## Current architecture state

- Lobby, Identity, Social, Players, Leaderboard, Market and Administration have route,
  application-service and PostgreSQL adapter boundaries. Announcements uses the same route and
  application-service boundary with an injected TrovePal public API gateway; protected sync writes
  announcement text and remote image URLs to PostgreSQL, and the public feed reads that local cache.
- `server/server.js` is the composition/lifecycle root and has no domain routes.
- Ordered SQL migrations own schema evolution; the database facade owns only
  connection, migration, seed, health and transaction primitives.
- React pages are thin route wrappers. Feature APIs, hooks and components live
  under `src/features/`; Vue sources have been removed.
- `src/shared/ui` is the direct-import project component library.
- Ordinary HTTP and WebSocket identity uses the same signed user session.
  Claimed request IDs are compatibility fields, not authority.

Update this section whenever a domain migration is completed.

## Definition of done for a migrated domain

- Routes are registered outside `server/server.js`.
- Business orchestration is testable without Express, Docker or PostgreSQL.
- SQL is accessed through a domain-specific repository adapter.
- WebSocket/external services are injected gateways.
- Frontend API calls and state hooks are owned by the same feature domain.
- Existing public contracts pass focused and Docker smoke tests.
- `AGENTS.md`, `ARCHITECTURE.md` and `docs/ai/DOMAIN_MAP.md` reflect reality.
