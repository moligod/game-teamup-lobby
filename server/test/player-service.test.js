const assert = require('node:assert/strict');
const test = require('node:test');
const { createPlayerService } = require('../src/modules/players/player-service');

test('player binding uses canonical casing when known', async () => {
    const calls = [];
    const service = createPlayerService({
        getKnownPlayerName: async () => 'CanonicalName',
        bindUserPlayer: async (userId, playerName) => {
            calls.push([userId, playerName]);
            return true;
        }
    });

    assert.deepEqual(await service.bindPlayer(5, ' canonicalname '), {
        message: '玩家名绑定成功',
        playerName: 'CanonicalName'
    });
    assert.deepEqual(calls, [[5, 'CanonicalName']]);
});

test('game binding selects the highest power leaderboard entry', async () => {
    const calls = [];
    const service = createPlayerService({
        getUserPlayerBinding: async () => ({ player_name: 'Player', created_at: 'now' }),
        getPlayerLeaderboardEntries: async (name, leaderboardIds) => {
            calls.push([name, leaderboardIds]);
            return [
                { leaderboard_id: '100', score: '500', rank: 2, mastery_level_text: 'Lv 10' },
                { leaderboard_id: '1004', score: '900', rank: 4 },
                { leaderboard_id: '1007', score: '1200', rank: 7 }
            ];
        }
    });

    const [binding] = await service.getGameBindings(5);
    assert.equal(binding.combat_power, '1200');
    assert.equal(binding.combat_rank, 7);
    assert.equal(binding.total_mastery_score, '500');
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], 'Player');
    assert.equal(calls[0][1].length, 21);
});
