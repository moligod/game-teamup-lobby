function sendFailure(res, error, fallback, fallbackStatus = 500) {
    return res.status(error.statusCode || fallbackStatus).json({ error: error.message || fallback });
}

async function sendBinary(res, encoder, payload) {
    const encoded = await encoder(payload);
    res.set(encoded.headers);
    res.send(encoded.body);
}

function registerLeaderboardRoutes(app, service, options) {
    const logger = options.logger || console;
    const encoder = options.binaryEncoder;
    const requireCollector = options.requireCollector;
    const collectorJsonParser = options.collectorJsonParser;
    if (typeof requireCollector !== 'function' || typeof collectorJsonParser !== 'function') {
        throw new TypeError('Leaderboard collector authentication and JSON parser are required');
    }

    app.post('/api/collector/leaderboard/snapshots', requireCollector, collectorJsonParser, async (req, res) => {
        try { res.json({ success: true, ...(await service.createSnapshot(req.body)) }); }
        catch (error) {
            logger.error('Failed to create leaderboard snapshot:', error);
            res.status(error.statusCode || 400).json({ success: false, error: error.message || 'Invalid snapshot payload' });
        }
    });

    app.post('/api/collector/leaderboard/snapshots/:snapshotId/boards', requireCollector, collectorJsonParser, async (req, res) => {
        try { res.json({ success: true, ...(await service.stageSnapshotBoard(req.params.snapshotId, req.body)) }); }
        catch (error) {
            logger.error('Failed to stage leaderboard board:', error);
            res.status(error.statusCode || 400).json({ success: false, error: error.message || 'Invalid collector payload' });
        }
    });

    app.post('/api/collector/leaderboard/snapshots/:snapshotId/publish', requireCollector, collectorJsonParser, async (req, res) => {
        try { res.json({ success: true, ...(await service.publishSnapshot(req.params.snapshotId)) }); }
        catch (error) {
            logger.error('Failed to publish leaderboard snapshot:', error);
            res.status(error.statusCode || 400).json({ success: false, error: error.message || 'Snapshot publish failed' });
        }
    });

    app.get('/api/leaderboards/version', async (req, res) => {
        try { res.json(await service.getVersion()); }
        catch (error) {
            logger.error('Failed to get leaderboard version:', error);
            sendFailure(res, error, 'Failed to get leaderboard version');
        }
    });

    app.get('/api/leaderboards', async (req, res) => {
        try { res.json(await service.list()); }
        catch (error) {
            logger.error('Failed to get leaderboards:', error);
            sendFailure(res, error, 'Failed to get leaderboards');
        }
    });

    app.get('/api/leaderboards/data.bin', async (req, res) => {
        try { await sendBinary(res, encoder, await service.listBinary()); }
        catch (error) {
            logger.error('Failed to get binary leaderboard list:', error);
            sendFailure(res, error, 'Failed to get binary leaderboard list');
        }
    });

    app.get('/api/leaderboards/search', async (req, res) => {
        try { res.json({ results: await service.search(req.query.query, req.query.limit) }); }
        catch (error) {
            logger.error('Failed to search leaderboards:', error);
            sendFailure(res, error, 'Failed to search leaderboards');
        }
    });

    app.get('/api/leaderboards/search.bin', async (req, res) => {
        try { await sendBinary(res, encoder, await service.searchBinary(req.query.query, req.query.limit)); }
        catch (error) {
            logger.error('Failed to get binary leaderboard search:', error);
            sendFailure(res, error, 'Failed to get binary leaderboard search');
        }
    });

    app.get('/api/leaderboards/players/:playerName', async (req, res) => {
        try { res.json(await service.playerProfile(req.params.playerName)); }
        catch (error) {
            logger.error('Failed to get player leaderboard profile:', error);
            sendFailure(res, error, 'Failed to get player leaderboard profile');
        }
    });

    app.get('/api/leaderboards/:leaderboardId/data.bin', async (req, res) => {
        try { await sendBinary(res, encoder, await service.detailBinary(req.params.leaderboardId, req.query.limit, req.query.offset)); }
        catch (error) {
            logger.error('Failed to get binary leaderboard detail:', error);
            sendFailure(res, error, 'Failed to get binary leaderboard detail');
        }
    });

    app.get('/api/leaderboards/:leaderboardId', async (req, res) => {
        try {
            const result = await service.detail(req.params.leaderboardId, req.query.limit, req.query.offset);
            res.json({ ...result.leaderboard, limit: result.limit, offset: result.offset, items: result.items });
        } catch (error) {
            logger.error('Failed to get leaderboard detail:', error);
            sendFailure(res, error, 'Failed to get leaderboard detail');
        }
    });
}

module.exports = { registerLeaderboardRoutes };
