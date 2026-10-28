const { IdentityError } = require('./identity-error');

function createProfileService(repository, socialNotifier) {
    return {
        async updateUploadedAvatar(userId, avatarUrl) {
            if (!userId) throw new IdentityError('用户ID不能为空', { statusCode: 400 });
            const previous = await repository.getUserById(userId);
            const updated = await repository.updateUserAvatar(userId, avatarUrl);
            if (!updated) throw new IdentityError('用户不存在', { statusCode: 404 });
            return { previousAvatar: previous?.avatar || null, avatarUrl };
        },

        async updateAvatarUrl(userId, avatarUrl) {
            if (!userId || !avatarUrl) throw new IdentityError('用户ID和头像URL不能为空', { statusCode: 400 });
            const updated = await repository.updateUserAvatar(userId, avatarUrl);
            if (!updated) throw new IdentityError('用户不存在', { statusCode: 404 });
            return { message: '头像更新成功' };
        },

        async updateSignature(userId, signature) {
            if (!userId) throw new IdentityError('用户ID不能为空', { statusCode: 400 });
            const normalized = String(signature || '');
            if (normalized.length > 64) throw new IdentityError('个人签名不能超过64个字符', { statusCode: 400 });
            const updated = await repository.updateUserSignature(userId, normalized);
            if (!updated) throw new IdentityError('用户不存在', { statusCode: 404 });
            await socialNotifier.notifyProfileUpdated(userId);
            return { message: '个人签名更新成功' };
        }
    };
}

module.exports = { createProfileService };
