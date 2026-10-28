const crypto = require('crypto');
const { promisify } = require('util');
const scrypt = promisify(crypto.scrypt);
const DUMMY_SALT = '00000000000000000000000000000000';
const DUMMY_HASH = Buffer.alloc(64);
function fail(message, statusCode) { return Object.assign(new Error(message), { statusCode }); }
function validate(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw fail('Invalid credentials', 400);
    const username = typeof input.username === 'string' ? input.username.trim() : '';
    const password = typeof input.password === 'string' ? input.password : '';
    if (!/^[\p{L}\p{N}_-]{3,32}$/u.test(username)) throw fail('Username must be 3–32 letters, numbers, underscores or hyphens', 400);
    if (password.length < 10 || Buffer.byteLength(password, 'utf8') > 256) throw fail('Password must be at least 10 characters and at most 256 bytes', 400);
    return { username, password };
}
function createLocalAuthService({ repository, sessions }) {
    let active = 0;
    async function derive(password, salt) {
        if (active >= 4) throw fail('Authentication busy, try again', 503);
        active += 1;
        try { return await scrypt(password, salt, 64); } finally { active -= 1; }
    }
    function response(user) {
        const safe = { id: user.id, username: user.username, email: user.email, avatar: user.avatar, signature: user.signature, role: 'user' };
        return { user: safe, token: sessions.create(safe) };
    }
    return {
        async register(input) {
            const { username, password } = validate(input);
            const salt = crypto.randomBytes(16).toString('hex');
            const hash = (await derive(password, salt)).toString('hex');
            try { return response(await repository.create(username, salt, hash)); }
            catch (error) { if (error.code === '23505') throw fail('Username is already in use', 409); throw error; }
        },
        async login(input) {
            const { username, password } = validate(input);
            const record = await repository.find(username);
            const salt = record?.salt || DUMMY_SALT;
            const actual = await derive(password, salt);
            const expected = record && /^[a-f0-9]{128}$/i.test(record.password_hash) ? Buffer.from(record.password_hash, 'hex') : DUMMY_HASH;
            if (!crypto.timingSafeEqual(actual, expected) || !record) throw fail('Invalid username or password', 401);
            return response(record);
        }
    };
}
module.exports = { createLocalAuthService };
