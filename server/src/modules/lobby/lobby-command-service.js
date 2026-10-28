function createLobbyCommandService(repository, realtime, userDirectory = repository, teamNotifier = null) {
    return {
        async createTeam(teamData) {
            const team = await repository.createTeam(teamData);
            realtime.broadcastTeamCreated(team);
            realtime.broadcastTeamListUpdate();
            realtime.sendUserTeamUpdate(String(teamData.leader_id));
            if (teamNotifier?.notifyTeamCreated) {
                teamNotifier.notifyTeamCreated(team).catch((error) => {
                    console.error('QQ team notification enqueue failed:', error.message);
                });
            }
            return team;
        },

        async joinTeam(teamId, userId) {
            if (!await repository.hasGameNameBinding(userId)) {
                throw new Error('Game name binding required');
            }
            const team = await repository.getTeam(teamId);
            const user = await userDirectory.getUserById(userId);
            await repository.joinTeam(teamId, userId);
            realtime.broadcastTeamJoined(team, user);
            realtime.broadcastTeamListUpdate();
            realtime.sendUserTeamUpdate(String(userId));
        },

        async leaveTeam(teamId, userId) {
            const team = await repository.getTeam(teamId);
            const user = await userDirectory.getUserById(userId);
            await repository.leaveTeam(teamId, userId);
            realtime.broadcastTeamLeft(team, user);
            realtime.broadcastTeamListUpdate();
            realtime.sendUserTeamUpdate(String(userId));
        },

        async kickMember(teamId, leaderId, memberId) {
            const team = await repository.getTeam(teamId);
            const user = await userDirectory.getUserById(memberId);
            await repository.kickMember(teamId, leaderId, memberId);
            realtime.broadcastTeamLeft(team, user);
            realtime.broadcastTeamListUpdate();
            realtime.sendUserTeamUpdate(String(memberId));
        },

        async endTeam(teamId, leaderId) {
            const team = await repository.getTeam(teamId);
            await repository.endTeam(teamId, leaderId);
            realtime.broadcastTeamEnded(team);
            realtime.broadcastTeamListUpdate();
            realtime.sendUserTeamUpdate(String(leaderId));
        },

        async setTeamApproval(teamId, leaderId, requiresApproval) {
            const result = await repository.setTeamApprovalRequired(teamId, leaderId, requiresApproval);
            realtime.broadcastTeamListUpdate();
            return result;
        },

        async submitTeamApplication(teamId, userId) {
            if (!await repository.hasGameNameBinding(userId)) {
                throw new Error('Game name binding required');
            }
            const result = await repository.submitTeamApplication(teamId, userId);
            const team = await repository.getTeam(teamId);
            realtime.sendTeamApplicationNotification(String(team.leader_id), {
                teamId,
                teamName: team.name,
                applicantId: userId
            });
            return result;
        },

        async processTeamApplication(applicationId, leaderId, action) {
            const application = await repository.getPendingTeamApplicationInfo(applicationId);
            if (!application) {
                return { application: null, result: null };
            }

            if (action === 'approve' && !await repository.hasGameNameBinding(application.user_id)) {
                throw new Error('Game name binding required');
            }

            const [team, user] = action === 'approve'
                ? await Promise.all([
                    repository.getTeam(application.team_id),
                    userDirectory.getUserById(application.user_id)
                ])
                : [null, null];
            const result = await repository.processTeamApplication(applicationId, leaderId, action);
            if (result.success) {
                if (action === 'approve' && result.action === 'approved') {
                    realtime.broadcastTeamJoined(team, user);
                    realtime.broadcastTeamListUpdate();
                    realtime.sendTeamApplicationAccepted(String(application.user_id), {
                        id: application.team_id,
                        name: application.team_name
                    });
                    realtime.sendUserTeamUpdate(String(application.user_id));
                } else if (result.action === 'expired') {
                    realtime.broadcastTeamListUpdate();
                    realtime.sendUserTeamUpdate(String(application.user_id));
                } else if (action === 'reject') {
                    realtime.sendTeamApplicationRejected(String(application.user_id), {
                        id: application.team_id,
                        name: application.team_name
                    });
                }
            }
            return { application, result };
        },

        async createMessage(messageData) {
            const message = await repository.createMessage(messageData);
            realtime.broadcastChatMessage(message);
            return message;
        },

        async createTeamMessage(teamId, userId, messageData) {
            if (!await repository.hasGameNameBinding(userId)) {
                throw new Error('Game name binding required');
            }
            const message = await repository.createTeamMessage(teamId, userId, messageData);
            const memberIds = await repository.getActiveTeamMemberIds(teamId);
            realtime.sendTeamChatMessage(memberIds, message);
            return message;
        },

        async expireTeams(maxAgeDays) {
            const [endedTeams, expiredApplications] = await Promise.all([
                repository.endExpiredActiveTeams(maxAgeDays),
                repository.expireApplicationsForActiveMembers()
            ]);
            for (const team of endedTeams) {
                realtime.broadcastTeamEnded(team);
            }
            if (endedTeams.length > 0) {
                realtime.broadcastTeamListUpdate();
                const leaderIds = new Set(endedTeams.map((team) => team.leader_id).filter(Boolean));
                for (const leaderId of leaderIds) {
                    realtime.sendUserTeamUpdate(String(leaderId));
                }
            }
            return {
                expired: endedTeams.length,
                ended: endedTeams,
                expiredApplications: expiredApplications.changes
            };
        }
    };
}

module.exports = { createLobbyCommandService };
