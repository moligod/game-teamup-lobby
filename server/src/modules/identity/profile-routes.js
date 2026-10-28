function sendProfileError(res, error, fallback) {
    return res.status(error.statusCode || 500).json({ error: error.message || fallback });
}

function registerProfileRoutes(app, service, options) {
    const upload = options.upload;
    const storage = options.storage;
    const logger = options.logger || console;
    const requireUser = options.requireUser;

    app.post('/api/user/avatar', requireUser, upload.single('avatar'), async (req, res) => {
        try {
            if (!req.file) return res.status(400).json({ error: '请选择要上传的图片' });
            const uploadsBase = `${req.protocol}://${req.get('host')}/uploads/`;
            const avatarUrl = storage.buildPublicUrl(req.protocol, req.get('host'), req.file.filename);
            const result = await service.updateUploadedAvatar(req.user.userId, avatarUrl);
            storage.removePreviousAvatar(result.previousAvatar, uploadsBase);
            res.json({ success: true, message: '头像上传成功', avatarUrl });
        } catch (error) {
            if (req.file) storage.removeUploadedFile(req.file.path);
            logger.error('头像上传失败:', error);
            sendProfileError(res, error, '头像上传失败');
        }
    });

    app.put('/api/user/avatar', requireUser, async (req, res) => {
        try { res.json(await service.updateAvatarUrl(req.user.userId, req.body.avatar)); }
        catch (error) {
            logger.error('更新头像失败:', error);
            sendProfileError(res, error, '更新头像失败');
        }
    });

    app.put('/api/user/signature', requireUser, async (req, res) => {
        try { res.json(await service.updateSignature(req.user.userId, req.body.signature)); }
        catch (error) {
            logger.error('更新个人签名失败:', error);
            sendProfileError(res, error, '更新个人签名失败');
        }
    });
}

module.exports = { registerProfileRoutes };
