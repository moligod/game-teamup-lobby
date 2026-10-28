# PostgreSQL migrations

## Layout

Ordered migrations live in `server/migrations/` and are applied by
`PostgresMigrationRunner`. Applied filenames are stored in
`schema_migrations`.

Current baseline:

- `001_initial_schema.sql`: complete schema for a new database.
- `002_legacy_schema_compat.sql`: idempotent columns and old leaderboard PK
  migration for existing volumes.
- `003_indexes.sql`: production indexes.
- `004_leaderboard_snapshots.sql`: immutable daily leaderboard snapshots,
  current-snapshot views and the one-time local bootstrap import.

## Adding a migration

1. Add the next zero-padded filename, for example `004_add_audit_log.sql`.
2. Use PostgreSQL-native SQL and deterministic DDL.
3. Preserve existing data; use an explicit backfill if a new invariant needs it.
4. Do not edit an already deployed migration.
5. Rebuild Docker against the existing volume and query both
   `schema_migrations` and the changed table.

Each migration runs in its own transaction. A failure rolls back that migration
and prevents the backend from listening.

Business SQL belongs in the matching `*-repository.js`. The database facade is
limited to connection, transactions, health, migration execution and seed data.

Leaderboard data is published through the snapshot lifecycle documented in
`LEADERBOARD_SNAPSHOTS.md`. The legacy `leaderboards` and
`leaderboard_entries` tables are migration sources only; runtime services read
the current-snapshot views.

## Forbidden operations

Do not use `docker compose down -v`, `DROP DATABASE`, truncate user/runtime
tables or delete `docker-data` during normal development or refactoring.
