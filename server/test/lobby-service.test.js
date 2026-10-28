const assert = require('node:assert/strict');
const test = require('node:test');
const { createLobbyService } = require('../src/modules/lobby/lobby-service');

test('lobby service delegates to its repository port with the request language', async () => {
    const calls = [];
    const service = createLobbyService({
        getTeamTypesI18n: async (language) => {
            calls.push(['getTeamTypesI18n', language]);
            return [{ id: 'mijing', name: 'Secret Realm' }];
        },
        getSystemMessage: async () => null,
        getTeams: async () => [],
        getTeam: async () => null,
        getTeamMembers: async () => [],
        getUserTeams: async () => [],
        getMessages: async () => []
    });

    assert.deepEqual(await service.getTeamTypes('en'), [{ id: 'mijing', name: 'Secret Realm' }]);
    assert.deepEqual(calls, [['getTeamTypesI18n', 'en']]);
});
