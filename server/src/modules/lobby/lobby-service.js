function createLobbyService(repository) {
    return {
        getTeamTypes(language) {
            return repository.getTeamTypesI18n(language);
        },

        getSystemMessage(messageKey, language) {
            return repository.getSystemMessage(messageKey, language);
        },

        getTeams(teamType, language, includeEnded = false) {
            return repository.getTeams(teamType, language, includeEnded);
        },

        getTeam(teamId, language) {
            return repository.getTeam(teamId, language);
        },

        getTeamMembers(teamId) {
            return repository.getTeamMembers(teamId);
        },

        getUserTeams(userId, language) {
            return repository.getUserTeams(userId, language);
        },

        getTeamApplications(teamId, leaderId) {
            return repository.getTeamApplications(teamId, leaderId);
        },

        getMessages(limit) {
            return repository.getMessages(limit);
        },

        async getTeamMessages(teamId, userId, limit) {
            await repository.requireActiveTeamMembership(teamId, userId);
            return repository.getTeamMessages(teamId, limit);
        },

        getOnlineUsers(userIds) {
            return repository.getUsersByIds(userIds);
        },

        getStats() {
            return repository.getStats();
        }
    };
}

module.exports = { createLobbyService };
