const crypto = require('crypto');

function base64UrlJson(value) {
    return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

class HmacSessionToken {
    constructor(secret, options = {}) {
        if (!secret || String(secret).length < 16) {
            throw new Error('USER_SESSION_SECRET must contain at least 16 characters');
        }
        this.secret = String(secret);
        this.clock = options.clock || (() => Date.now());
    }

    sign(encodedPayload) {
        return crypto.createHmac('sha256', this.secret).update(encodedPayload).digest('base64url');
    }

    issue(payload, ttlMs) {
        const encoded = base64UrlJson({ ...payload, exp: this.clock() + ttlMs });
        return `${encoded}.${this.sign(encoded)}`;
    }

    verify(token) {
        try {
            const [encoded, signature, extra] = String(token || '').split('.');
            if (!encoded || !signature || extra !== undefined) return null;
            const expected = this.sign(encoded);
            const actualBuffer = Buffer.from(signature);
            const expectedBuffer = Buffer.from(expected);
            if (actualBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) {
                return null;
            }
            const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
            if (!payload.exp || payload.exp <= this.clock()) return null;
            return payload;
        } catch {
            return null;
        }
    }
}

module.exports = { HmacSessionToken };
