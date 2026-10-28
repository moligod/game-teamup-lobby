const { LeaderboardError } = require('./leaderboard-error');

const DEFAULT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_COLLECTOR_ITEMS = 150000;
const MAX_EXPECTED_BOARD_IDS = 256;
const MAX_POSTGRES_INTEGER = 2147483647;

function requiredString(value, fieldName, maxLength) {
    if (value === undefined || value === null) {
        throw new LeaderboardError(`${fieldName} is required`);
    }
    const normalized = String(value).trim();
    if (!normalized) throw new LeaderboardError(`${fieldName} is required`);
    if (normalized.length > maxLength) throw new LeaderboardError(`${fieldName} is too long`);
    return normalized;
}

function positiveInteger(value, fieldName) {
    const normalized = String(value ?? '').trim();
    if (!/^\d+(?:\.0+)?$/.test(normalized)) {
        throw new LeaderboardError(`${fieldName} must be a positive integer`);
    }
    const parsed = Number(normalized);
    if (!Number.isSafeInteger(parsed) || parsed <= 0 || parsed > MAX_POSTGRES_INTEGER) {
        throw new LeaderboardError(`${fieldName} is outside the supported integer range`);
    }
    return parsed;
}

function optionalPositiveInteger(value, fieldName) {
    if (value === undefined || value === null || String(value).trim() === '') return null;
    return positiveInteger(value, fieldName);
}

function optionalString(value, fieldName, maxLength) {
    if (value === undefined || value === null || String(value).trim() === '') return null;
    return requiredString(value, fieldName, maxLength);
}

function normalizeScore(value) {
    const score = requiredString(value, 'items[].score', 128);
    return /^-?\d+\.0+$/.test(score) ? score.slice(0, score.indexOf('.')) : score;
}

function normalizeCollectorPayload(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new LeaderboardError('JSON object body is required');
    }

    const leaderboardId = requiredString(body.leaderboard_id, 'leaderboard_id', 64);
    const leaderboardType = requiredString(body.leaderboard_type, 'leaderboard_type', 255);
    const leaderboardKey = body.leaderboard_key === undefined || body.leaderboard_key === null || String(body.leaderboard_key).trim() === ''
        ? leaderboardType
        : requiredString(body.leaderboard_key, 'leaderboard_key', 255);
    const leaderboardName = body.leaderboard_name === undefined || body.leaderboard_name === null || String(body.leaderboard_name).trim() === ''
        ? leaderboardType
        : requiredString(body.leaderboard_name, 'leaderboard_name', 255);

    if (!Array.isArray(body.items)) throw new LeaderboardError('items must be an array');
    if (body.items.length === 0) throw new LeaderboardError('items cannot be empty');
    if (body.items.length > MAX_COLLECTOR_ITEMS) {
        throw new LeaderboardError(`items cannot contain more than ${MAX_COLLECTOR_ITEMS} entries`, 413);
    }

    const items = body.items.map((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
            throw new LeaderboardError('items[] must contain objects');
        }
        return {
            rank: positiveInteger(item.rank, 'items[].rank'),
            player_name: requiredString(item.player_name, 'items[].player_name', 128),
            score: normalizeScore(item.score),
            mastery_level: optionalPositiveInteger(item.mastery_level, 'items[].mastery_level'),
            mastery_level_text: optionalString(item.mastery_level_text, 'items[].mastery_level_text', 128),
            trove_mastery_level: optionalPositiveInteger(item.trove_mastery_level, 'items[].trove_mastery_level'),
            geode_mastery_level: optionalPositiveInteger(item.geode_mastery_level, 'items[].geode_mastery_level')
        };
    });

    return {
        leaderboard_id: leaderboardId,
        leaderboard_type: leaderboardType,
        leaderboard_key: leaderboardKey,
        leaderboard_name: leaderboardName,
        items
    };
}

function normalizeSnapshotRequest(body, today = new Date().toISOString().slice(0, 10)) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new LeaderboardError('JSON object body is required');
    }
    const sourceDate = body.source_date === undefined || body.source_date === null || String(body.source_date).trim() === ''
        ? today
        : requiredString(body.source_date, 'source_date', 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(sourceDate) || Number.isNaN(new Date(`${sourceDate}T00:00:00Z`).getTime())) {
        throw new LeaderboardError('source_date must use YYYY-MM-DD');
    }
    if (body.expected_board_ids !== undefined && !Array.isArray(body.expected_board_ids)) {
        throw new LeaderboardError('expected_board_ids must be an array');
    }
    if (body.expected_board_ids?.length > MAX_EXPECTED_BOARD_IDS) {
        throw new LeaderboardError(`expected_board_ids cannot contain more than ${MAX_EXPECTED_BOARD_IDS} entries`, 413);
    }
    const expectedBoardIds = Array.from(new Set((body.expected_board_ids || []).map((value) => requiredString(value, 'expected_board_ids[]', 64)))).sort();
    return { sourceDate, expectedBoardIds };
}

function parseLimit(value, fallback, max) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
}

function parseOffset(value) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function createLeaderboardService(options) {
    const { repository, cache, hash, broadcaster } = options;
    const cacheTtlMs = options.cacheTtlMs || DEFAULT_CACHE_TTL_MS;
    const snapshotIdFactory = options.snapshotIdFactory;
    const clock = options.clock || (() => new Date());

    async function cached(key, loader) {
        return cache.getOrLoad(key, loader, cacheTtlMs);
    }

    async function getVersion() {
        return cached('version', async () => {
            const rows = await repository.getVersionSource();
            const updatedAt = rows.reduce((latest, row) => {
                if (!row.updated_at) return latest;
                const timestamp = new Date(row.updated_at).getTime();
                return Number.isFinite(timestamp) && timestamp > latest ? timestamp : latest;
            }, 0);
            const source = rows.map((row) => `${row.snapshot_id || ''}:${row.leaderboard_id}:${row.updated_at || ''}`).join('|');
            return {
                hash: hash(source || 'empty'),
                updated_at: updatedAt ? new Date(updatedAt).toISOString() : null,
                leaderboard_count: rows.length
            };
        });
    }

    async function list() {
        return cached('list', () => repository.list());
    }

    async function search(queryValue, limitValue) {
        const query = String(queryValue || '').trim();
        const limit = parseLimit(limitValue, 50, 200);
        if (!query) return [];
        if (query.length > 120) throw new LeaderboardError('query is too long');
        const includePlayerMatches = query.length >= 3;
        return cached(
            `search:${query.toLowerCase()}:${limit}`,
            () => repository.search(query, limit, includePlayerMatches)
        );
    }

    async function detail(leaderboardId, limitValue, offsetValue) {
        const limit = parseLimit(limitValue, 200, 1000);
        const offset = parseOffset(offsetValue);
        const leaderboard = await cached(`detail-meta:${leaderboardId}`, () => repository.getById(leaderboardId));
        if (!leaderboard) throw new LeaderboardError('排行榜不存在', 404);
        const items = await cached(
            `detail-items:${leaderboardId}:${limit}:${offset}`,
            () => repository.getEntries(leaderboardId, limit, offset)
        );
        return { leaderboard, limit, offset, items };
    }

    async function playerProfile(playerNameValue) {
        const playerName = requiredString(playerNameValue, 'player_name', 128);
        const items = await cached(`player:${playerName.toLowerCase()}`, () => repository.getPlayerProfile(playerName));
        if (!items.length) throw new LeaderboardError('player not found', 404);
        return {
            player: {
                key: playerName.toLowerCase(),
                display_name: items[0].player_name
            },
            items
        };
    }

    return {
        async createSnapshot(body) {
            if (typeof snapshotIdFactory !== 'function') throw new Error('snapshotIdFactory is required');
            const request = normalizeSnapshotRequest(body, clock().toISOString().slice(0, 10));
            return repository.createSnapshot({
                snapshotId: snapshotIdFactory(),
                sourceDate: request.sourceDate,
                expectedBoardIds: request.expectedBoardIds
            });
        },
        stageSnapshotBoard(snapshotIdValue, body) {
            const snapshotId = requiredString(snapshotIdValue, 'snapshot_id', 64);
            return repository.stageBoard(snapshotId, normalizeCollectorPayload(body));
        },
        async publishSnapshot(snapshotIdValue) {
            const snapshotId = requiredString(snapshotIdValue, 'snapshot_id', 64);
            const result = await repository.publishSnapshot(snapshotId);
            cache.clear();
            broadcaster.broadcastLeaderboardUpdate(result);
            return result;
        },
        invalidateCache() {
            cache.clear();
        },
        getVersion,
        list,
        search,
        detail,
        playerProfile,
        async listBinary() {
            const [version, items] = await Promise.all([getVersion(), list()]);
            return { ...version, items };
        },
        async searchBinary(query, limit) {
            const [version, results] = await Promise.all([getVersion(), search(query, limit)]);
            return { ...version, results };
        },
        async detailBinary(leaderboardId, limit, offset) {
            const [version, result] = await Promise.all([getVersion(), detail(leaderboardId, limit, offset)]);
            return { ...version, ...result, entries: result.items };
        }
    };
}

module.exports = {
    createLeaderboardService,
    normalizeCollectorPayload,
    normalizeSnapshotRequest,
    parseLimit,
    parseOffset,
    MAX_COLLECTOR_ITEMS,
    MAX_EXPECTED_BOARD_IDS
};
