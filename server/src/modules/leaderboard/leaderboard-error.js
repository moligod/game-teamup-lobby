class LeaderboardError extends Error {
    constructor(message, statusCode = 400) {
        super(message);
        this.name = 'LeaderboardError';
        this.statusCode = statusCode;
    }
}

module.exports = { LeaderboardError };
