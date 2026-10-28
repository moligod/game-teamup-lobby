class IdentityError extends Error {
    constructor(message, options = {}) {
        super(message);
        this.name = 'IdentityError';
        this.code = options.code || 'IDENTITY_ERROR';
        this.statusCode = options.statusCode || 500;
        this.redirectCode = options.redirectCode || null;
    }
}

module.exports = { IdentityError };
