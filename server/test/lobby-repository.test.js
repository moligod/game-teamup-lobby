const assert = require('node:assert/strict');
const test = require('node:test');
const { PostgresLobbyRepository } = require('../src/infrastructure/persistence/postgres/lobby-repository');

test('team applications include the applicant highest profession', async () => {
    const repository = new PostgresLobbyRepository({
        one: async () => ({ leader_id: 42 }),
        query: async () => [{
            application_id: 7,
            applied_at: '2026-07-19T10:00:00.000Z',
            user_id: 9,
            username: 'applicant',
            avatar: null,
            player_name: 'ApplicantPlayer',
            knight: 2500,
            neon_ninja: 42000
        }]
    });

    const applications = await repository.getTeamApplications(5, 42);

    assert.deepEqual(applications, [{
        id: 7,
        user_id: 9,
        username: 'applicant',
        avatar: null,
        player_name: 'ApplicantPlayer',
        highest_profession: 'NEON_NINJA',
        max_combat_power: 42000,
        applied_at: '2026-07-19T10:00:00.000Z'
    }]);
});
