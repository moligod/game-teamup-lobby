function sendError(res, error, fallback, fallbackStatus = 500) {
    return res.status(error.statusCode || fallbackStatus).json({ error: error.message || fallback });
}

function registerAdminRoutes(app, service, requireAdmin, options = {}) {
    const logger = options.logger || console;

    app.get('/api/online-users', async (req, res) => res.json(service.getOnlineUsers()));

    app.get('/api/admin/qq-bot-config', requireAdmin, async (req, res) => {
        try { res.json({ success: true, data: await service.getQqBotConfig() }); }
        catch (error) {
            logger.error('获取QQ机器人配置失败:', error);
            sendError(res, error, '获取QQ机器人配置失败');
        }
    });

    app.put('/api/admin/qq-bot-config', requireAdmin, async (req, res) => {
        try { res.json({ success: true, data: await service.updateQqBotConfig(req.body) }); }
        catch (error) {
            logger.error('保存QQ机器人配置失败:', error);
            sendError(res, error, '保存QQ机器人配置失败', 400);
        }
    });

    app.get('/api/admin/qq-bot-content-config', requireAdmin, async (req, res) => {
        try { res.json({ success: true, data: await service.getQqBotContentConfig() }); }
        catch (error) {
            logger.error('Failed to get QQ bot content configuration:', error);
            sendError(res, error, 'Failed to get QQ bot content configuration');
        }
    });

    app.put('/api/admin/qq-bot-content-config', requireAdmin, async (req, res) => {
        try { res.json({ success: true, data: await service.updateQqBotContentConfig(req.body) }); }
        catch (error) {
            logger.error('Failed to save QQ bot content configuration:', error);
            sendError(res, error, 'Failed to save QQ bot content configuration', 400);
        }
    });

    app.get('/api/admin/qq-oauth-config', requireAdmin, async (req, res) => {
        try { res.json({ success: true, data: await service.getQqOauthConfig() }); }
        catch (error) {
            logger.error('获取QQ登录配置失败:', error);
            sendError(res, error, '获取QQ登录配置失败');
        }
    });

    app.put('/api/admin/qq-oauth-config', requireAdmin, async (req, res) => {
        try { res.json({ success: true, data: await service.updateQqOauthConfig(req.body) }); }
        catch (error) {
            logger.error('保存QQ登录配置失败:', error);
            sendError(res, error, '保存QQ登录配置失败', 400);
        }
    });

    app.get('/api/admin/image-host-config', requireAdmin, async (req, res) => {
        try { res.json({ success: true, data: await service.getImageHostConfig() }); }
        catch (error) {
            logger.error('Failed to get image host configuration:', error);
            sendError(res, error, 'Failed to get image host configuration');
        }
    });

    app.put('/api/admin/image-host-config', requireAdmin, async (req, res) => {
        try { res.json({ success: true, data: await service.updateImageHostConfig(req.body) }); }
        catch (error) {
            logger.error('Failed to save image host configuration:', error);
            sendError(res, error, 'Failed to save image host configuration', 400);
        }
    });

    app.get('/api/admin/trovepal-config', requireAdmin, async (req, res) => {
        try { res.json({ success: true, data: await service.getTrovePalConfig() }); }
        catch (error) {
            logger.error('Failed to get TrovePal configuration:', error);
            sendError(res, error, 'Failed to get TrovePal configuration');
        }
    });

    app.put('/api/admin/trovepal-config', requireAdmin, async (req, res) => {
        try { res.json({ success: true, data: await service.updateTrovePalConfig(req.body) }); }
        catch (error) {
            logger.error('Failed to save TrovePal configuration:', error);
            sendError(res, error, 'Failed to save TrovePal configuration', 400);
        }
    });

    app.get('/api/admin/summary', requireAdmin, async (req, res) => {
        try { res.json(await service.getSummary()); }
        catch (error) {
            logger.error('获取管理后台统计失败:', error);
            sendError(res, error, '获取管理后台统计失败');
        }
    });

    app.get('/api/admin/users', requireAdmin, async (req, res) => {
        try { res.json(await service.listUsers()); }
        catch (error) {
            logger.error('获取用户列表失败:', error);
            sendError(res, error, '获取用户列表失败');
        }
    });

    app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
        try { res.json(await service.deleteUser(req.params.id, req.admin.userId)); }
        catch (error) {
            logger.error('删除用户失败:', error);
            sendError(res, error, '删除用户失败');
        }
    });

    app.get('/api/admin/teams', requireAdmin, async (req, res) => {
        try { res.json(await service.listTeams()); }
        catch (error) {
            logger.error('获取团队列表失败:', error);
            sendError(res, error, '获取团队列表失败');
        }
    });

    app.patch('/api/admin/teams/:id/status', requireAdmin, async (req, res) => {
        try { res.json(await service.updateTeamStatus(req.params.id, req.body.status)); }
        catch (error) {
            logger.error('更新团队状态失败:', error);
            sendError(res, error, '更新团队状态失败');
        }
    });

    app.get('/api/admin/messages', requireAdmin, async (req, res) => {
        try { res.json(await service.listMessages(req.query.limit)); }
        catch (error) {
            logger.error('获取消息列表失败:', error);
            sendError(res, error, '获取消息列表失败');
        }
    });

    app.delete('/api/admin/messages/:id', requireAdmin, async (req, res) => {
        try { res.json(await service.deleteMessage(req.params.id)); }
        catch (error) {
            logger.error('删除消息失败:', error);
            sendError(res, error, '删除消息失败');
        }
    });

    app.get('/api/admin/applications', requireAdmin, async (req, res) => {
        try { res.json(await service.listApplications()); }
        catch (error) {
            logger.error('获取申请列表失败:', error);
            sendError(res, error, '获取申请列表失败');
        }
    });

    app.get('/api/admin/database/tables', requireAdmin, async (req, res) => {
        try { res.json(await service.listTables()); }
        catch (error) {
            logger.error('获取数据库表失败:', error);
            sendError(res, error, '获取数据库表失败');
        }
    });

    app.get('/api/admin/database/:table', requireAdmin, async (req, res) => {
        try { res.json(await service.readTable(req.params.table, req.query.limit)); }
        catch (error) {
            logger.error('读取数据表失败:', error);
            sendError(res, error, '读取数据表失败');
        }
    });

    app.delete('/api/admin/database/:table/:id', requireAdmin, async (req, res) => {
        try { res.json(await service.deleteTableRow(req.params.table, req.params.id)); }
        catch (error) {
            logger.error('删除数据行失败:', error);
            sendError(res, error, '删除数据行失败');
        }
    });

    app.post('/api/admin/database/cleanup', requireAdmin, async (req, res) => {
        try { res.json(await service.cleanup(req.body)); }
        catch (error) {
            logger.error('按时间范围清理数据失败:', error);
            sendError(res, error, '按时间范围清理数据失败', 400);
        }
    });
}

module.exports = { registerAdminRoutes };
