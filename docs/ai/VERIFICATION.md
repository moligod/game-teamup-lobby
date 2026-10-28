# Verification matrix

## Required commands

```powershell
npm --prefix server test
npm run build
node --check server/server.js
node --check server/src/infrastructure/persistence/postgres/database.js
docker compose config --quiet
docker compose -f docker-compose.prod.yml config --quiet
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.local.yml ps
```

Dependency changes also require:

```powershell
npm audit --omit=dev
npm --prefix server audit --omit=dev
```

## Evidence by change

| Change | Required evidence |
|---|---|
| Application service | Focused fake-adapter tests plus full backend suite |
| Route/auth | Status/payload smoke plus forged-ID authority test |
| Frontend feature/UI | TypeScript and Vite production build |
| WebSocket | Guest/forged ID test and signed-token connection |
| Migration/schema | Existing-volume startup, migration row and affected query |
| Compose/environment | Local and production config validation |
| Runtime | Healthy backend, zero restarts and affected API smoke |

## Completion audit

- `server/server.js` contains composition/lifecycle only and no domain routes.
- The database facade contains no domain query SQL or runtime schema creation.
- Every domain has route, service and PostgreSQL adapter boundaries.
- Pages are thin wrappers and contain no generic transport calls.
- Features do not import app/page; shared does not import features.
- HTTP and WebSocket identity come from signed/authenticated sessions.
- SQL migrations are recorded and the existing volume remains intact.
- Backend tests, frontend build and both Compose validations pass.
- Primary JSON/binary APIs and WebSocket auth pass Docker smoke tests.
- AI documentation matches the current code and contains no stale migration
  caveats.
