function configuredTeamTypes(value = process.env.GAME_TEAM_TYPES) {
    const defaultTypes = [
        { id: 'casual', zh: '休闲组队', en: 'Casual' },
        { id: 'competitive', zh: '竞技组队', en: 'Competitive' },
        { id: 'cooperative', zh: '合作挑战', en: 'Cooperative' }
    ];
    if (!value) return defaultTypes;
    let types;
    try { types = JSON.parse(value); } catch { throw new Error('GAME_TEAM_TYPES must be a JSON array'); }
    if (!Array.isArray(types) || types.length < 1 || types.length > 30 || types.some(t => !t || typeof t.id !== 'string' || !/^[a-z0-9_-]{1,32}$/.test(t.id) || typeof t.zh !== 'string' || !t.zh.trim() || t.zh.length > 80 || typeof t.en !== 'string' || !t.en.trim() || t.en.length > 80) || new Set(types.map(t => t.id)).size !== types.length) throw new Error('GAME_TEAM_TYPES must contain unique id, zh, en values');
    return types;
}

module.exports = { configuredTeamTypes };
