class PostgresLeaderboardStore {
    constructor({ queryRepository, snapshotRepository }) {
        this.queryRepository = queryRepository;
        this.snapshotRepository = snapshotRepository;
    }

    list() { return this.queryRepository.list(); }
    getVersionSource() { return this.queryRepository.getVersionSource(); }
    search(query, limit, includePlayerMatches) {
        return this.queryRepository.search(query, limit, includePlayerMatches);
    }
    getById(leaderboardId) { return this.queryRepository.getById(leaderboardId); }
    getEntries(leaderboardId, limit, offset) { return this.queryRepository.getEntries(leaderboardId, limit, offset); }
    getPlayerProfile(playerName) { return this.queryRepository.getPlayerProfile(playerName); }
    createSnapshot(snapshot) { return this.snapshotRepository.createSnapshot(snapshot); }
    stageBoard(snapshotId, payload) { return this.snapshotRepository.stageBoard(snapshotId, payload); }
    publishSnapshot(snapshotId) { return this.snapshotRepository.publishSnapshot(snapshotId); }
}

module.exports = { PostgresLeaderboardStore };
