# Leaderboard snapshots

Leaderboard runtime reads are served only from the active published snapshot.
One daily collection is staged first, then published with one short database
transaction. Visitors therefore never observe a mix of yesterday's and today's
boards.

## Data model

- `leaderboard_catalog`: board identity and subject type. Board `1100` is
  `guild`; all other known boards are `player`.
- `leaderboard_snapshots`: one collection run and its expected board IDs.
- `leaderboard_snapshot_boards`: board metadata inside one collection run.
- `leaderboard_snapshot_entries`: ranking rows inside one staged board.
- `leaderboard_dataset_state`: the single active snapshot pointer.
- `leaderboard_current_boards` and `leaderboard_current_entries`: read views
  used by every runtime leaderboard and player-binding query.

The old `leaderboards` and `leaderboard_entries` tables are not read at runtime.
Migration `004` imports existing local test rows into the bootstrap snapshot
once, without deleting the source tables.

## Collector lifecycle

Every collector request must send
`Authorization: Bearer <LEADERBOARD_COLLECTOR_TOKEN>`. Configure the same random
token in the backend and collector deployment; it must contain at least 32
characters. When the backend token is absent or too short, these routes remain
disabled and return `503` rather than accepting unauthenticated writes.

The backend accepts at most 256 expected board IDs and 150,000 entries in one
board payload. The collector JSON byte limit defaults to 32 MB and can be
changed with `LEADERBOARD_COLLECTOR_BODY_LIMIT`. Keep batches below both the
entry and byte limits; invalid fields return `400` and oversized bodies or
arrays return `413`.

1. Create a snapshot. On the first collection, send every board ID in
   `expected_board_ids`. For later collections, omitting the field reuses the
   current published board set.

```http
POST /api/collector/leaderboard/snapshots
Content-Type: application/json
Authorization: Bearer <LEADERBOARD_COLLECTOR_TOKEN>

{
  "source_date": "2026-07-15",
  "expected_board_ids": ["1", "100", "1000", "1100"]
}
```

2. Upload each board to the returned `snapshot_id`. Re-uploading the same board
   replaces only that staged board; it cannot affect the active snapshot.

```http
POST /api/collector/leaderboard/snapshots/{snapshot_id}/boards
Content-Type: application/json
Authorization: Bearer <LEADERBOARD_COLLECTOR_TOKEN>

{
  "leaderboard_id": "1000",
  "leaderboard_type": "Power",
  "leaderboard_key": "Power",
  "leaderboard_name": "Power",
  "items": [
    { "rank": 1, "player_name": "PlayerName", "score": "12345" }
  ]
}
```

3. Publish only after every expected board has staged successfully.

```http
POST /api/collector/leaderboard/snapshots/{snapshot_id}/publish
Authorization: Bearer <LEADERBOARD_COLLECTOR_TOKEN>
```

Publication rejects missing boards. On success it changes the active snapshot
pointer, clears the API cache and emits `leaderboard_update`. There is no
per-board daily replacement endpoint.

## Player profile query

`GET /api/leaderboards/players/{playerName}` returns all entries for a player
within the active snapshot. Matching is case-insensitive and `guild` board
`1100` is excluded. The leaderboard page uses this endpoint for player-name
clicks and search results.
