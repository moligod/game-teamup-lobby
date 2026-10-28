class MarketError extends Error {
    constructor(message, statusCode = 400) {
        super(message);
        this.name = 'MarketError';
        this.statusCode = statusCode;
    }
}

module.exports = { MarketError };
