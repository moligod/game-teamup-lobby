const { PlayerError } = require('./player-error');

const POWER_LEADERBOARD_IDS = Array.from({ length: 18 }, (_, index) => String(1000 + index));
const GAME_BINDING_LEADERBOARD_IDS = ['100', '1', '20', ...POWER_LEADERBOARD_IDS];

function createPlayerService(repository) {
    return {
        async bindPlayer(userId, playerName) {
            if (!userId || !playerName) throw new PlayerError('用户ID和玩家名不能为空');
            const normalized = String(playerName).trim();
            if (!normalized) throw new PlayerError('玩家名不能为空');
            const canonicalName = await repository.getKnownPlayerName(normalized) || normalized;
            const bound = await repository.bindUserPlayer(userId, canonicalName);
            if (!bound) throw new PlayerError('绑定失败', 500);
            return { message: '玩家名绑定成功', playerName: canonicalName };
        },

        async unbindPlayer(userId) {
            if (!userId) throw new PlayerError('用户ID不能为空');
            const removed = await repository.unbindUserPlayer(userId);
            if (!removed) throw new PlayerError('未找到绑定记录', 404);
            return { message: '玩家名解绑成功' };
        },

        async getBinding(userId) {
            if (!userId) throw new PlayerError('用户ID不能为空');
            const binding = await repository.getUserPlayerBinding(userId);
            return binding
                ? { playerName: binding.player_name, createdAt: binding.created_at }
                : { playerName: null };
        },

        async getGameBindings(userId) {
            if (!userId) throw new PlayerError('用户ID不能为空');
            const binding = await repository.getUserPlayerBinding(userId);
            if (!binding) return [];

            const entries = await repository.getPlayerLeaderboardEntries(
                binding.player_name,
                GAME_BINDING_LEADERBOARD_IDS
            );
            const entriesByLeaderboard = new Map(
                entries.map((entry) => [String(entry.leaderboard_id), entry])
            );
            const totalMastery = entriesByLeaderboard.get('100');
            const troveMastery = entriesByLeaderboard.get('1');
            const geodeMastery = entriesByLeaderboard.get('20');
            const powerEntries = POWER_LEADERBOARD_IDS
                .map((leaderboardId) => entriesByLeaderboard.get(leaderboardId))
                .filter(Boolean);
            const highestPower = powerEntries.filter(Boolean).reduce((best, entry) => {
                if (!best) return entry;
                return Number(entry.score) > Number(best.score) ? entry : best;
            }, null);

            return [{
                player_name: binding.player_name,
                created_at: binding.created_at,
                combat_power: highestPower?.score ?? null,
                combat_rank: highestPower?.rank ?? null,
                total_mastery_score: totalMastery?.score ?? null,
                total_mastery_rank: totalMastery?.rank ?? null,
                total_mastery_level: totalMastery?.mastery_level ?? null,
                total_mastery_level_text: totalMastery?.mastery_level_text ?? null,
                trove_mastery_score: troveMastery?.score ?? null,
                trove_mastery_level: troveMastery?.mastery_level ?? null,
                geode_mastery_score: geodeMastery?.score ?? null,
                geode_mastery_level: geodeMastery?.mastery_level ?? null
            }];
        },

        async getCombatData(playerName) {
            if (!playerName) throw new PlayerError('玩家名不能为空');
            const combatData = await repository.getPlayerCombatData(playerName);
            if (!combatData) throw new PlayerError('未找到该玩家的战斗力数据', 404);
            return combatData;
        },

        getProfessionStats() {
            return repository.getAllProfessionCombatStats();
        }
    };
}

module.exports = { createPlayerService, POWER_LEADERBOARD_IDS, GAME_BINDING_LEADERBOARD_IDS };
