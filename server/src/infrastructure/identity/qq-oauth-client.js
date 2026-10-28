class QqOauthClient {
    constructor(options = {}) {
        this.fetch = options.fetch || global.fetch;
    }

    async request(apiUrl, params) {
        const url = new URL('connect.php', apiUrl);
        for (const [key, value] of Object.entries(params)) {
            url.searchParams.set(key, value);
        }

        const response = await this.fetch(url);
        const text = await response.text();
        let payload;
        try {
            payload = JSON.parse(text);
        } catch {
            throw new Error(`Invalid OAuth response: ${text.slice(0, 120)}`);
        }
        if (!response.ok) {
            throw new Error(payload.msg || `OAuth HTTP ${response.status}`);
        }
        return payload;
    }
}

module.exports = { QqOauthClient };
