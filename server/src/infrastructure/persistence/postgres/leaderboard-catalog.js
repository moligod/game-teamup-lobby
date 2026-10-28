const LEADERBOARD_CATEGORY_BY_ID = new Map([
    ...['2002', '2013', '2314', '2416', '10019'].map((id) => [id, { category_id: '3', category_name: 'weekly' }]),
    ...['1', '20', '100', '999'].map((id) => [id, { category_id: '4', category_name: 'mastery' }]),
    ...['3', '4', '6', '9', '10', '11', '13', '14', '15', '16', '17', '21004', '21005', '21012', '30001', '30002', '30003', '30004', '32000', '33001', '33002']
        .map((id) => [id, { category_id: '5', category_name: 'stats' }]),
    ...[...Array.from({ length: 18 }, (_, index) => String(1000 + index)), '1100']
        .map((id) => [id, { category_id: '6', category_name: 'power' }]),
    ...['2001', '2004', '2011', '2014', '2021', '2024'].map((id) => [id, { category_id: '8', category_name: 'delve' }]),
    ...Array.from({ length: 18 }, (_, index) => String(4000 + index)).map((id) => [id, { category_id: '9', category_name: 'classActivity' }]),
    ...[...Array.from({ length: 18 }, (_, index) => String(5000 + index)), '50000']
        .map((id) => [id, { category_id: '10', category_name: 'paragon' }])
]);

function withLeaderboardCategory(row) {
    if (!row) return row;
    const category = LEADERBOARD_CATEGORY_BY_ID.get(String(row.leaderboard_id)) || {
        category_id: '0',
        category_name: 'other'
    };
    return { ...row, ...category };
}

function getSubjectScope(leaderboardId) {
    return String(leaderboardId) === '1100' ? 'guild' : 'player';
}

module.exports = { getSubjectScope, withLeaderboardCategory };
