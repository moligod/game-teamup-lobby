const assert = require('node:assert/strict');
const test = require('node:test');
const { ExpiringStore } = require('../src/platform/expiring-store');
const { PostgresLeaderboardStore } = require('../src/infrastructure/persistence/postgres/leaderboard-store');
const {
    createLeaderboardService,
    normalizeCollectorPayload,
    normalizeSnapshotRequest,
    MAX_COLLECTOR_ITEMS,
    MAX_EXPECTED_BOARD_IDS
} = require('../src/modules/leaderboard/leaderboard-service');

function createService(overrides = {}) {
    const broadcasts = [];
    const repository = {
        createSnapshot: async (snapshot) => ({ snapshot_id: snapshot.snapshotId, status: 'loading' }),
        stageBoard: async (snapshotId, payload) => ({ snapshot_id: snapshotId, leaderboard_id: payload.leaderboard_id }),
        publishSnapshot: async (snapshotId) => ({ snapshot_id: snapshotId, status: 'published' }),
        list: async () => [],
        getVersionSource: async () => [],
        search: async () => [],
        getById: async () => null,
        getEntries: async () => [],
        getPlayerProfile: async () => [],
        ...overrides
    };
    return {
        broadcasts,
        service: createLeaderboardService({
            repository,
            cache: new ExpiringStore(),
            hash: (value) => `hash:${value}`,
            snapshotIdFactory: () => 'test-snapshot-id',
            clock: () => new Date('2026-07-15T12:00:00.000Z'),
            broadcaster: { broadcastLeaderboardUpdate: (value) => broadcasts.push(value) }
        })
    };
}

test('short searches keep the player-scan guard through the repository store', async () => {
    const calls = [];
    const store = new PostgresLeaderboardStore({
        queryRepository: {
            search: async (...args) => {
                calls.push(args);
                return [];
            }
        },
        snapshotRepository: {}
    });
    const { service } = createService({
        search: (...args) => store.search(...args)
    });

    await service.search('xy', 20);
    await service.search('xyz', 20);

    assert.deepEqual(calls, [
        ['xy', 20, false],
        ['xyz', 20, true]
    ]);
});

test('collector validation normalizes optional names and integer scores', () => {
    const payload = normalizeCollectorPayload({
        leaderboard_id: '1',
        leaderboard_type: 'Power',
        items: [{ rank: '1', player_name: ' Alice ', score: '1200.0' }]
    });
    assert.equal(payload.leaderboard_key, 'Power');
    assert.equal(payload.items[0].player_name, 'Alice');
    assert.equal(payload.items[0].score, '1200');
});

test('snapshot request validates and de-duplicates expected boards', () => {
    assert.deepEqual(
        normalizeSnapshotRequest({ source_date: '2026-07-15', expected_board_ids: ['100', '1', '100'] }),
        { sourceDate: '2026-07-15', expectedBoardIds: ['1', '100'] }
    );
    assert.throws(
        () => normalizeSnapshotRequest({ source_date: '2026/07/15' }),
        /source_date must use YYYY-MM-DD/
    );
});

test('collector validation rejects oversized arrays before mapping their entries', () => {
    assert.throws(
        () => normalizeCollectorPayload({
            leaderboard_id: '1',
            leaderboard_type: 'Power',
            items: Array(MAX_COLLECTOR_ITEMS + 1).fill(null)
        }),
        (error) => error.statusCode === 413 && /150000/.test(error.message)
    );
    assert.throws(
        () => normalizeSnapshotRequest({
            expected_board_ids: Array(MAX_EXPECTED_BOARD_IDS + 1).fill('1')
        }),
        (error) => error.statusCode === 413 && /256/.test(error.message)
    );
});

test('collector validation rejects partial and out-of-range PostgreSQL integers', () => {
    const payload = (rank) => ({
        leaderboard_id: '1',
        leaderboard_type: 'Power',
        items: [{ rank, player_name: 'Alice', score: '1200' }]
    });
    assert.throws(() => normalizeCollectorPayload(payload('1st')), /positive integer/);
    assert.throws(() => normalizeCollectorPayload(payload(2147483648)), /supported integer range/);
    assert.equal(normalizeCollectorPayload(payload('1.0')).items[0].rank, 1);
});

test('snapshot publication invalidates cache and broadcasts only after persistence', async () => {
    const events = [];
    const { service, broadcasts } = createService({
        publishSnapshot: async (snapshotId) => {
            events.push('persist');
            return { snapshot_id: snapshotId, status: 'published' };
        },
        list: async () => {
            events.push('read');
            return [{ leaderboard_id: 'old' }];
        }
    });
    await service.list();
    const result = await service.publishSnapshot('test-snapshot-id');
    await service.list();
    events.push('complete');
    assert.deepEqual(events, ['read', 'persist', 'read', 'complete']);
    assert.deepEqual(broadcasts, [result]);
});

test('failed publication preserves caches and emits no update', async () => {
    let listReads = 0;
    const { service, broadcasts } = createService({
        list: async () => {
            listReads += 1;
            return [];
        },
        publishSnapshot: async () => { throw new Error('snapshot is incomplete'); }
    });
    await service.list();
    await assert.rejects(() => service.publishSnapshot('test-snapshot-id'), /snapshot is incomplete/);
    await service.list();
    assert.equal(listReads, 1);
    assert.deepEqual(broadcasts, []);
});

test('version and list are cached independently', async () => {
    let versionReads = 0;
    let listReads = 0;
    const { service } = createService({
        getVersionSource: async () => {
            versionReads += 1;
            return [{ leaderboard_id: '1', updated_at: '2026-07-15T00:00:00.000Z' }];
        },
        list: async () => {
            listReads += 1;
            return [{ leaderboard_id: '1' }];
        }
    });
    await Promise.all([service.getVersion(), service.list()]);
    await Promise.all([service.getVersion(), service.list()]);
    assert.equal(versionReads, 1);
    assert.equal(listReads, 1);
});

test('missing leaderboard is a 404 domain error', async () => {
    const { service } = createService();
    await assert.rejects(() => service.detail('missing'), (error) => error.statusCode === 404);
});

test('player profile is cached by case-insensitive player name', async () => {
    let reads = 0;
    const { service } = createService({
        getPlayerProfile: async () => {
            reads += 1;
            return [{ leaderboard_id: '1', player_name: 'Alice', rank: 3, score: '1200' }];
        }
    });

    const first = await service.playerProfile(' Alice ');
    const second = await service.playerProfile('alice');
    assert.equal(first.player.display_name, 'Alice');
    assert.equal(second.items[0].rank, 3);
    assert.equal(reads, 1);
});

test('missing player profile is a 404 domain error', async () => {
    const { service } = createService();
    await assert.rejects(() => service.playerProfile('missing'), (error) => error.statusCode === 404);
});
