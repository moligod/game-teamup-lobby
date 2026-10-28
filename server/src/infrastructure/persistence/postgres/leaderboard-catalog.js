function withLeaderboardCategory(row) {
    return row ? { ...row, category_id: '0', category_name: 'other' } : row;
}
function getSubjectScope() { return 'player'; }
module.exports = { getSubjectScope, withLeaderboardCategory };
