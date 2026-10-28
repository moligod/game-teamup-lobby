function sendPlayerError(res, error, fallbackMessage) {
    return res.status(error.statusCode || 500).json({ error: error.message || fallbackMessage });
}

function registerPlayerRoutes(app, service, options = {}) {
    const logger = options.logger || console;
    const requireUser = options.requireUser;

    app.post('/api/user/bind-player', requireUser, async (req, res) => {
        try {
            res.json(await service.bindPlayer(req.user.userId, req.body.playerName));
        } catch (error) {
            logger.error('Player binding failed:', error);
            sendPlayerError(res, error, '绑定玩家名失败');
        }
    });

    app.delete('/api/user/bind-player/:userId', requireUser, async (req, res) => {
        try {
            res.json(await service.unbindPlayer(req.user.userId));
        } catch (error) {
            logger.error('Player unbinding failed:', error);
            sendPlayerError(res, error, '解绑玩家名失败');
        }
    });

    app.get('/api/user/bind-player/:userId', requireUser, async (req, res) => {
        try {
            res.json(await service.getBinding(req.user.userId));
        } catch (error) {
            logger.error('Player binding lookup failed:', error);
            sendPlayerError(res, error, '获取玩家名绑定失败');
        }
    });

    app.get('/api/user/:userId/game-bindings', requireUser, async (req, res) => {
        try {
            res.json({ success: true, data: await service.getGameBindings(req.user.userId) });
        } catch (error) {
            logger.error('Game binding lookup failed:', error);
            res.status(error.statusCode || 500).json({ success: false, error: error.message || '获取用户游戏绑定失败' });
        }
    });

    app.get('/api/player/combat/:playerName', async (req, res) => {
        try {
            res.json(await service.getCombatData(req.params.playerName));
        } catch (error) {
            logger.error('Player combat lookup failed:', error);
            sendPlayerError(res, error, '获取玩家战斗力数据失败');
        }
    });

    app.get('/api/professions/combat-stats', async (req, res) => {
        try {
            res.json(await service.getProfessionStats());
        } catch (error) {
            logger.error('Profession combat lookup failed:', error);
            res.status(500).json({ error: '获取职业战斗力统计失败' });
        }
    });
}

module.exports = { registerPlayerRoutes };
