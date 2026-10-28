function createUserSessionService(tokenCodec, options = {}) {
    const sessionTtlMs = options.sessionTtlMs || 7 * 24 * 60 * 60 * 1000;
    return {
        create(user) {
            return tokenCodec.issue({
                userId: Number(user.id),
                username: user.username,
                role: 'user'
            }, sessionTtlMs);
        },

        authenticate(token) {
            const payload = tokenCodec.verify(token);
            if (!payload || payload.role !== 'user' || !Number.isInteger(payload.userId)) return null;
            return {
                userId: payload.userId,
                username: payload.username,
                role: payload.role,
                expiresAt: payload.exp
            };
        }
    };
}

module.exports = { createUserSessionService };
