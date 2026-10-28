function getBearerToken(req) {
    const authorization = req.headers.authorization || '';
    return authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
}

function createUserAuthMiddleware(sessionService) {
    function optionalUser(req, res, next) {
        req.user = sessionService.authenticate(getBearerToken(req));
        return next();
    }

    function requireUser(req, res, next) {
        const session = sessionService.authenticate(getBearerToken(req));
        if (!session) return res.status(401).json({ error: '登录已失效，请重新登录' });
        req.user = session;
        return next();
    }

    return { optionalUser, requireUser };
}

module.exports = { createUserAuthMiddleware, getBearerToken };
