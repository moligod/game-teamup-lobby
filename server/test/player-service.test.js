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

test('game binding works without a game-specific leaderboard', async () => {
    const service = createPlayerService({
        getUserPlayerBinding: async () => ({ player_name: 'Player', created_at: 'now' }),
        getPlayerLeaderboardEntries: async () => { throw new Error('must not query game-specific rankings'); }
    });
    const [binding] = await service.getGameBindings(5);
    assert.equal(binding.player_name, 'Player');
    assert.equal(binding.combat_power, null);
});
