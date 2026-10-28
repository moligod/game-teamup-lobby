# Change playbook for AI agents

Use this workflow for every non-trivial change.

## 1. Identify ownership

Start with `AGENTS.md`, `ARCHITECTURE.md` and `docs/ai/DOMAIN_MAP.md`. Select one
owning domain. Do not put business logic in `server/server.js`, React pages or
shared UI.

## 2. Preserve the contract

Record the affected HTTP path/status/payload, WebSocket event, local-storage
key and database meaning. A security change may add `401`, but successful
contracts require an explicit versioned migration before they can change.

## 3. Backend implementation

1. Put orchestration in a framework-free application service.
2. Put HTTP parsing/status mapping in the domain route adapter.
3. Put PostgreSQL SQL in the domain repository adapter.
4. Inject realtime, OAuth, encoding and storage behavior as gateways.
5. Add service tests with fakes; add route/authority tests for security rules.

## 4. Frontend implementation

1. Put transport functions in `src/features/<domain>/api/`.
2. Put independent realtime/state lifecycles in feature hooks.
3. Put domain UI in feature components and pass application identity as props.
4. Reuse direct imports from `src/shared/ui`; never create a UI barrel file.
5. Keep `src/pages` as route wrappers.

## 5. Database changes

Create the next ordered file under `server/migrations/`. Migrations are
append-only after release. Use PostgreSQL-native SQL and idempotent guards when
supporting an existing volume. Never edit data with a broad reset during a
refactor.

## 6. Verification

Follow `docs/ai/VERIFICATION.md`. A build alone does not prove runtime behavior.
Use focused tests, the full suites, Compose validation, an existing-volume
Docker rebuild and affected HTTP/WebSocket smoke tests.

## Prohibited shortcuts

- Duplicating a migrated route in `server/server.js`.
- Trusting body/path/query user IDs as the acting identity.
- Adding SQLite syntax or SQL-rewrite compatibility.
- Importing app/page code from a feature or feature code from shared UI.
- Deleting `postgres-data`, `docker-data` or using `docker compose down -v`.
