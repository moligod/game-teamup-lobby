const assert = require('node:assert/strict');
const test = require('node:test');
const { createLobbyCommandService } = require('../src/modules/lobby/lobby-command-service');

test('creating a team persists it before broadcasting feature events', async () => {
    const calls = [];
    const service = createLobbyCommandService(
        {
            createTeam: async (team) => {
                calls.push(['createTeam', team]);
                return { id: 9, ...team };
            }
        },
        {
            broadcastTeamCreated: (team) => calls.push(['broadcastTeamCreated', team.id]),
            broadcastTeamListUpdate: () => calls.push(['broadcastTeamListUpdate']),
            sendUserTeamUpdate: (userId) => calls.push(['sendUserTeamUpdate', userId])
        }
    );

    const team = await service.createTeam({ name: 'Delve', leader_id: 4 });

    assert.equal(team.id, 9);
    assert.deepEqual(calls, [
        ['createTeam', { name: 'Delve', leader_id: 4 }],
        ['broadcastTeamCreated', 9],
        ['broadcastTeamListUpdate'],
        ['sendUserTeamUpdate', '4']
    ]);
});

test('QQ notification enqueue failure does not fail an already-created team', async () => {
    const service = createLobbyCommandService(
        { createTeam: async (team) => ({ id: 10, ...team }) },
        {
            broadcastTeamCreated: () => undefined,
            broadcastTeamListUpdate: () => undefined,
            sendUserTeamUpdate: () => undefined
        },
        undefined,
        { notifyTeamCreated: async () => { throw new Error('QQ is unavailable'); } }
    );

    const team = await service.createTeam({ name: 'Delve', leader_id: 4 });
    assert.equal(team.id, 10);
});

test('joining or applying to a team requires a game name binding', async () => {
    const service = createLobbyCommandService(
        { hasGameNameBinding: async () => false },
        {}
    );

    await assert.rejects(() => service.joinTeam(7, 4), /Game name binding required/);
    await assert.rejects(() => service.submitTeamApplication(7, 4), /Game name binding required/);
});

test('approving a pending application also requires the applicant game name binding', async () => {
    const service = createLobbyCommandService(
        {
            getPendingTeamApplicationInfo: async () => ({ user_id: 12 }),
            hasGameNameBinding: async () => false
        },
        {}
    );

    await assert.rejects(() => service.processTeamApplication(9, 4, 'approve'), /Game name binding required/);
});

test('approving an application broadcasts the same member-joined event as a direct join', async () => {
    const calls = [];
    const team = { id: 7, name: 'Delve', current_members: 2, max_members: 8 };
    const user = { id: 12, username: 'applicant' };
    const service = createLobbyCommandService(
        {
            getPendingTeamApplicationInfo: async () => ({ id: 9, team_id: team.id, team_name: team.name, user_id: user.id }),
            hasGameNameBinding: async () => true,
            getTeam: async () => team,
            processTeamApplication: async () => ({ success: true, action: 'approved' })
        },
        {
            broadcastTeamJoined: (eventTeam, member) => calls.push(['broadcastTeamJoined', eventTeam, member]),
            broadcastTeamListUpdate: () => calls.push(['broadcastTeamListUpdate']),
            sendTeamApplicationAccepted: (userId, data) => calls.push(['sendTeamApplicationAccepted', userId, data]),
            sendUserTeamUpdate: (userId) => calls.push(['sendUserTeamUpdate', userId])
        },
        { getUserById: async () => user }
    );

    await service.processTeamApplication(9, 4, 'approve');

    assert.deepEqual(calls, [
        ['broadcastTeamJoined', team, user],
        ['broadcastTeamListUpdate'],
        ['sendTeamApplicationAccepted', '12', { id: 7, name: 'Delve' }],
        ['sendUserTeamUpdate', '12']
    ]);
});

test('rejecting an application notifies the applicant with the team identity', async () => {
    const calls = [];
    const service = createLobbyCommandService(
        {
            getPendingTeamApplicationInfo: async () => ({ id: 9, team_id: 7, team_name: 'Delve', user_id: 12 }),
            processTeamApplication: async () => ({ success: true, action: 'rejected' })
        },
        {
            sendTeamApplicationRejected: (userId, data) => calls.push(['sendTeamApplicationRejected', userId, data])
        }
    );

    await service.processTeamApplication(9, 4, 'reject');

    assert.deepEqual(calls, [
        ['sendTeamApplicationRejected', '12', { id: 7, name: 'Delve' }]
    ]);
});

test('team chat persists before notifying only active team members', async () => {
    const calls = [];
    const service = createLobbyCommandService(
        {
            hasGameNameBinding: async () => true,
            createTeamMessage: async (teamId, userId, message) => {
                calls.push(['createTeamMessage', teamId, userId, message]);
                return { id: 14, team_id: teamId, sender_id: userId, ...message };
            },
            getActiveTeamMemberIds: async (teamId) => {
                calls.push(['getActiveTeamMemberIds', teamId]);
                return [4, 8];
            }
        },
        {
            sendTeamChatMessage: (userIds, message) => calls.push(['sendTeamChatMessage', userIds, message.id])
        }
    );

    const message = await service.createTeamMessage(7, 4, {
        username: 'leader',
        status: '玩家',
        content: 'Ready',
        reply_to_id: null
    });

    assert.equal(message.id, 14);
    assert.deepEqual(calls, [
        ['createTeamMessage', 7, 4, { username: 'leader', status: '玩家', content: 'Ready', reply_to_id: null }],
        ['getActiveTeamMemberIds', 7],
        ['sendTeamChatMessage', [4, 8], 14]
    ]);
});

test('team chat requires a game name binding', async () => {
    const service = createLobbyCommandService(
        { hasGameNameBinding: async () => false },
        {}
    );

    await assert.rejects(
        () => service.createTeamMessage(7, 4, { content: 'Ready' }),
        /Game name binding required/
    );
});

test('scheduled lobby cleanup batches expired teams and emits one list refresh', async () => {
    const calls = [];
    const endedTeams = [
        { id: 7, name: 'Delve', leader_id: 4 },
        { id: 8, name: 'Leviathan', leader_id: 4 },
        { id: 9, name: 'Farm', leader_id: 6 }
    ];
    const service = createLobbyCommandService(
        {
            endExpiredActiveTeams: async (days) => {
                calls.push(['endExpiredActiveTeams', days]);
                return endedTeams;
            },
            expireApplicationsForActiveMembers: async () => ({ changes: 5 })
        },
        {
            broadcastTeamEnded: (team) => calls.push(['broadcastTeamEnded', team.id]),
            broadcastTeamListUpdate: () => calls.push(['broadcastTeamListUpdate']),
            sendUserTeamUpdate: (userId) => calls.push(['sendUserTeamUpdate', userId])
        }
    );

    const result = await service.expireTeams(3);

    assert.deepEqual(result, { expired: 3, ended: endedTeams, expiredApplications: 5 });
    assert.deepEqual(calls, [
        ['endExpiredActiveTeams', 3],
        ['broadcastTeamEnded', 7],
        ['broadcastTeamEnded', 8],
        ['broadcastTeamEnded', 9],
        ['broadcastTeamListUpdate'],
        ['sendUserTeamUpdate', '4'],
        ['sendUserTeamUpdate', '6']
    ]);
});

test('scheduled lobby cleanup stays silent when no team expires', async () => {
    const calls = [];
    const service = createLobbyCommandService(
        {
            endExpiredActiveTeams: async () => [],
            expireApplicationsForActiveMembers: async () => ({ changes: 2 })
        },
        {
            broadcastTeamEnded: () => calls.push('team'),
            broadcastTeamListUpdate: () => calls.push('list'),
            sendUserTeamUpdate: () => calls.push('user')
        }
    );

    assert.deepEqual(await service.expireTeams(3), { expired: 0, ended: [], expiredApplications: 2 });
    assert.deepEqual(calls, []);
});
