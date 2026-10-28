const { AdminError } = require('./admin-error');
const { validateQqBotContentConfig } = require('../lobby/qq-bot-content-config');

function integer(value, message) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    if (!Number.isInteger(parsed)) throw new AdminError(message);
    return parsed;
}

function limit(value, fallback = 100, max = 500) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
}

function optionalString(value, fieldName, maxLength) {
    if (value === undefined || value === null) return '';
    const normalized = String(value).trim();
    if (normalized.length > maxLength) throw new AdminError(`${fieldName} is too long`);
    return normalized;
}

function requiredString(value, fieldName, maxLength) {
    const normalized = optionalString(value, fieldName, maxLength);
    if (!normalized) throw new AdminError(`${fieldName} is required`);
    return normalized;
}

function optionalUrl(value, fieldName, maxLength) {
    const normalized = optionalString(value, fieldName, maxLength);
    if (!normalized) return '';
    try {
        const url = new URL(normalized);
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
        return url.toString();
    } catch {
        throw new AdminError(`${fieldName} must be a valid http(s) URL`);
    }
}

function dateValue(value, fieldName) {
    const date = new Date(value);
    if (!value || Number.isNaN(date.getTime())) throw new AdminError(`${fieldName} must be a valid date`);
    return date.toISOString();
}

function createAdminService({ repository, presence, onQqBotConfigUpdated, onQqBotContentUpdated }) {
    return {
        getOnlineUsers() {
            return { online_users: presence.getOnlineUserCount(), online_user_ids: presence.getOnlineUserIds() };
        },

        getQqBotConfig() { return repository.getQqBotPublicConfig(); },

        async updateQqBotConfig(body) {
            const publicConfig = await repository.updateQqBotConfig({
                app_id: requiredString(body.app_id, 'app_id', 64),
                app_secret: optionalString(body.app_secret, 'app_secret', 255),
                clear_app_secret: body.clear_app_secret === true
            });
            if (onQqBotConfigUpdated) onQqBotConfigUpdated(await repository.getQqBotConfig());
            return publicConfig;
        },

        getQqBotContentConfig() { return repository.getQqBotContentConfig(); },

        async updateQqBotContentConfig(body) {
            let contentConfig;
            try {
                contentConfig = validateQqBotContentConfig(body);
            } catch (error) {
                throw new AdminError(error.message);
            }
            const publicConfig = await repository.updateQqBotContentConfig(contentConfig);
            if (onQqBotContentUpdated) onQqBotContentUpdated(publicConfig);
            return publicConfig;
        },

        getQqOauthConfig() { return repository.getQqOauthPublicConfig(); },

        updateQqOauthConfig(body) {
            return repository.updateQqOauthConfig({
                api_url: optionalUrl(body.api_url || 'https://your-oauth-provider.example/', 'api_url', 255) || 'https://your-oauth-provider.example/',
                appid: optionalString(body.appid, 'appid', 64),
                appkey: optionalString(body.appkey, 'appkey', 255),
                clear_appkey: body.clear_appkey === true,
                callback_url: optionalUrl(body.callback_url, 'callback_url', 255),
                frontend_success_path: optionalString(body.frontend_success_path || '/', 'frontend_success_path', 120) || '/'
            });
        },

        getImageHostConfig() { return repository.getImageHostPublicConfig(); },

        updateImageHostConfig(body) {
            return repository.updateImageHostConfig({
                base_url: optionalUrl(body.base_url, 'base_url', 255),
                api_key: optionalString(body.api_key, 'api_key', 255),
                clear_api_key: body.clear_api_key === true,
                review_folder_id: optionalString(body.review_folder_id, 'review_folder_id', 64)
            });
        },

        async getSummary() {
            return { ...await repository.getSummary(), online_users: presence.getOnlineUserCount() };
        },

        async listUsers() {
            const users = await repository.listUsers();
            return users.map((user) => ({
                ...user,
                role: user.role === 'admin' ? 'admin' : 'user',
                online: presence.isUserOnline(String(user.id)) || user.is_online === 1 || user.online_status === 'online'
            }));
        },

        async deleteUser(userIdValue, currentAdminId) {
            const userId = integer(userIdValue, '无效的用户 ID');
            if (userId === currentAdminId) throw new AdminError('不能删除当前登录的管理员账号');
            const user = await repository.findUser(userId);
            if (!user) throw new AdminError('用户不存在', 404);
            if (user.role === 'admin') throw new AdminError('不能删除管理员账号');
            const result = await repository.deleteUser(userId);
            presence.broadcastTeamListUpdate();
            return { success: result.changes > 0 };
        },

        listTeams() { return repository.listTeams(); },

        async updateTeamStatus(teamIdValue, status) {
            const teamId = integer(teamIdValue, '无效的团队状态');
            if (!['active', 'ended'].includes(status)) throw new AdminError('无效的团队状态');
            const result = await repository.updateTeamStatus(teamId, status);
            if (result.changes === 0) throw new AdminError('团队不存在', 404);
            const team = await repository.getTeam(teamId);
            presence.broadcastTeamListUpdate();
            if (status === 'ended') presence.broadcastTeamEnded(team);
            return { success: true, team };
        },

        listMessages(requestedLimit) { return repository.listMessages(limit(requestedLimit)); },

        async deleteMessage(messageIdValue) {
            const messageId = integer(messageIdValue, '无效的消息 ID');
            const result = await repository.deleteMessage(messageId);
            if (result.changes === 0) throw new AdminError('消息不存在', 404);
            presence.sendChatMessageUpdate();
            return { success: true };
        },

        listApplications() { return repository.listApplications(); },
        listTables() { return repository.listTables(); },

        async readTable(tableName, requestedLimit) {
            const result = await repository.readTable(tableName, limit(requestedLimit));
            if (!result) throw new AdminError('数据表不存在', 404);
            return result;
        },

        async deleteTableRow(tableName, id) {
            const config = repository.getTableConfig(tableName);
            if (!config?.primaryKey) throw new AdminError('该数据表不支持按单行删除');
            if (tableName === 'users') {
                const user = await repository.findUser(integer(id, '用户不存在'));
                if (!user) throw new AdminError('用户不存在', 404);
                if (user.role === 'admin') throw new AdminError('不能删除管理员账号');
            }
            const result = await repository.deleteTableRow(tableName, id);
            if (['teams', 'team_members', 'team_applications'].includes(tableName)) presence.broadcastTeamListUpdate();
            if (tableName === 'messages') presence.sendChatMessageUpdate();
            return { success: result.changes > 0, deleted: result.changes };
        },

        async cleanup(body) {
            const from = dateValue(body.from, 'from');
            const to = dateValue(body.to, 'to');
            if (new Date(from).getTime() > new Date(to).getTime()) {
                throw new AdminError('开始时间不能晚于结束时间');
            }
            const deleted = await repository.cleanup(from, to);
            presence.broadcastTeamListUpdate();
            presence.sendChatMessageUpdate();
            return { success: true, from, to, deleted };
        }
    };
}

module.exports = { createAdminService, limit };
