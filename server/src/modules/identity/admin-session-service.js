const { IdentityError } = require('./identity-error');

function createAdminSessionService(options) {
    const {
        repository,
        sessionStore,
        tokenFactory,
        sessionTtlMs = 8 * 60 * 60 * 1000
    } = options;

    return {
        async login(identifier, password) {
            if (!identifier || !password) {
                throw new IdentityError('管理员账号和密码不能为空', {
                    code: 'MISSING_CREDENTIALS',
                    statusCode: 400
                });
            }

            let user;
            try {
                user = await repository.loginUser(identifier, password);
            } catch (error) {
                if (error.message === 'Invalid username or password' || error.message === '用户名或密码错误') {
                    throw new IdentityError('管理员账号或密码错误', {
                        code: 'INVALID_CREDENTIALS',
                        statusCode: 401
                    });
                }
                throw error;
            }
            if (user.role !== 'admin') {
                throw new IdentityError('当前账号不是管理员', {
                    code: 'ADMIN_REQUIRED',
                    statusCode: 403
                });
            }

            const token = tokenFactory(32);
            sessionStore.set(token, {
                userId: user.id,
                username: user.username,
                role: user.role
            }, sessionTtlMs);
            return { user: { ...user, role: 'admin' }, token };
        },

        authenticate(token) {
            if (!token) return null;
            return sessionStore.touch(token, sessionTtlMs);
        }
    };
}

module.exports = { createAdminSessionService };
