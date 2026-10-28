const { SocialError } = require('./social-error');

function publicUser(user) {
    return user ? { id: user.id, username: user.username, avatar: user.avatar } : null;
}

function positiveId(value, fieldName) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    if (!Number.isInteger(parsed) || parsed <= 0) throw new SocialError(`${fieldName}无效`);
    return parsed;
}

function messageBody(value) {
    const body = String(value ?? '').trim();
    if (!body) throw new SocialError('消息内容不能为空');
    if (body.length > 1000) throw new SocialError('消息内容不能超过1000个字符');
    return body;
}

function createSocialService(repository, realtime) {
    return {
        listFriends(userId) {
            return repository.getFriends(userId);
        },

        listFriendRequests(userId) {
            return repository.getFriendRequests(userId);
        },

        searchUsers(keyword) {
            const normalized = String(keyword || '').trim();
            return normalized ? repository.searchUsers(normalized) : Promise.resolve([]);
        },

        async sendFriendRequest({ userId, friendId, friendUsername }) {
            let targetFriendId = friendId;
            if (friendUsername && !targetFriendId) {
                const target = await repository.findUserByUsername(friendUsername);
                if (!target) throw new SocialError('用户不存在', 404);
                targetFriendId = target.id;
            }
            if (!userId || !targetFriendId) throw new SocialError('缺少必要参数');
            if (String(userId) === String(targetFriendId)) throw new SocialError('不能添加自己为好友');

            const result = await repository.addFriend(userId, targetFriendId);
            const fromUser = publicUser(await repository.getUserById(userId));
            if (fromUser) realtime.sendFriendRequest(String(targetFriendId), fromUser);
            return { success: true, id: result.id };
        },

        async acceptFriendRequest(userId, friendId) {
            if (!userId || !friendId) throw new SocialError('缺少必要参数');
            const result = await repository.acceptFriend(userId, friendId);
            const [acceptedBy, friend] = await Promise.all([
                repository.getUserById(userId),
                repository.getUserById(friendId)
            ]);
            const acceptedByUser = publicUser(acceptedBy);
            const friendUser = publicUser(friend);
            if (acceptedByUser && friendUser) {
                realtime.sendFriendAccepted(String(friendId), acceptedByUser);
                realtime.sendFriendListUpdate(String(friendId), acceptedByUser);
                realtime.sendFriendListUpdate(String(userId), friendUser);
                realtime.sendFriendRequestUpdate(String(userId));
            }
            return result;
        },

        async rejectFriendRequest(userId, friendId) {
            if (!userId || !friendId) throw new SocialError('缺少必要参数');
            const result = await repository.rejectFriend(userId, friendId);
            const rejectedBy = publicUser(await repository.getUserById(userId));
            if (rejectedBy) {
                realtime.sendFriendRejected(String(friendId), rejectedBy);
                realtime.sendFriendRequestUpdate(String(userId));
            }
            return result;
        },

        async removeFriend(userId, friendId) {
            if (!userId || !friendId) throw new SocialError('缺少必要参数');
            const result = await repository.removeFriend(userId, friendId);
            const removedBy = publicUser(await repository.getUserById(userId));
            if (removedBy) realtime.sendFriendRemoved(String(friendId), removedBy);
            return result;
        },

        async listDirectMessages(userId, friendId) {
            const senderId = positiveId(userId, '用户ID');
            const recipientId = positiveId(friendId, '好友ID');
            if (!await repository.areFriends(senderId, recipientId)) {
                throw new SocialError('只能与好友私聊', 403);
            }
            return repository.listDirectMessages(senderId, recipientId, 100);
        },

        async sendDirectMessage(userId, { friendId, body }) {
            const senderId = positiveId(userId, '用户ID');
            const recipientId = positiveId(friendId, '好友ID');
            if (!await repository.areFriends(senderId, recipientId)) {
                throw new SocialError('只能与好友私聊', 403);
            }
            const message = await repository.createDirectMessage(senderId, recipientId, messageBody(body));
            realtime.sendDirectMessage(String(senderId), { message });
            realtime.sendDirectMessage(String(recipientId), { message });
            return message;
        },

        async notifyProfileUpdated(userId) {
            const [user, friends] = await Promise.all([
                repository.getUserById(userId),
                repository.getFriends(userId)
            ]);
            if (!user) return;
            const profile = {
                id: user.id,
                username: user.username,
                avatar: user.avatar,
                signature: user.signature
            };
            friends.forEach((friend) => realtime.sendFriendListUpdate(String(friend.id), profile));
        }
    };
}

module.exports = { createSocialService };
