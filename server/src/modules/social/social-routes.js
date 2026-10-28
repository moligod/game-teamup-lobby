function sendSocialError(res, error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    if (/already exists|已经发送过|已经是好友|好友关系/i.test(error.message)) {
        return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message });
}

function registerSocialRoutes(app, service, options = {}) {
    const logger = options.logger || console;
    const requireUser = options.requireUser;

    app.get('/api/users/search', requireUser, async (req, res) => {
        try {
            res.json({ users: await service.searchUsers(req.query.keyword) });
        } catch (error) {
            logger.error('User search failed:', error);
            res.status(500).json({ error: error.message });
        }
    });

    app.get('/api/friends/:userId', requireUser, async (req, res) => {
        try {
            res.json(await service.listFriends(req.user.userId));
        } catch (error) {
            logger.error('Friend list failed:', error);
            res.status(500).json({ error: error.message });
        }
    });

    app.get('/api/friend-requests/:userId', requireUser, async (req, res) => {
        try {
            res.json(await service.listFriendRequests(req.user.userId));
        } catch (error) {
            logger.error('Friend request list failed:', error);
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/api/friends', requireUser, async (req, res) => {
        try {
            res.json(await service.sendFriendRequest({ ...req.body, userId: req.user.userId }));
        } catch (error) {
            logger.error('Friend request failed:', error);
            sendSocialError(res, error);
        }
    });

    app.put('/api/friends/accept', requireUser, async (req, res) => {
        try {
            res.json(await service.acceptFriendRequest(req.user.userId, req.body.friendId));
        } catch (error) {
            logger.error('Friend accept failed:', error);
            sendSocialError(res, error);
        }
    });

    app.delete('/api/friends/reject', requireUser, async (req, res) => {
        try {
            res.json(await service.rejectFriendRequest(req.user.userId, req.body.friendId));
        } catch (error) {
            logger.error('Friend reject failed:', error);
            sendSocialError(res, error);
        }
    });

    app.delete('/api/friends', requireUser, async (req, res) => {
        try {
            res.json(await service.removeFriend(req.user.userId, req.body.friendId));
        } catch (error) {
            logger.error('Friend removal failed:', error);
            sendSocialError(res, error);
        }
    });

    app.get('/api/direct-messages/:friendId', requireUser, async (req, res) => {
        try {
            res.json(await service.listDirectMessages(req.user.userId, req.params.friendId));
        } catch (error) {
            logger.error('Direct message list failed:', error);
            sendSocialError(res, error);
        }
    });

    app.post('/api/direct-messages', requireUser, async (req, res) => {
        try {
            res.status(201).json(await service.sendDirectMessage(req.user.userId, req.body));
        } catch (error) {
            logger.error('Direct message send failed:', error);
            sendSocialError(res, error);
        }
    });
}

module.exports = { registerSocialRoutes };
