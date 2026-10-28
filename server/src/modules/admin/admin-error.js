class AdminError extends Error {
    constructor(message, statusCode = 400) {
        super(message);
        this.name = 'AdminError';
        this.statusCode = statusCode;
    }
}

module.exports = { AdminError };
