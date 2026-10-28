const zlib = require('zlib');
const { promisify } = require('util');

const gzipAsync = promisify(zlib.gzip);

async function encodeGzipJson(payload) {
    const body = await gzipAsync(Buffer.from(JSON.stringify(payload), 'utf8'));
    return {
        headers: {
            'Content-Type': 'application/octet-stream',
            'X-Content-Encoding': 'gzip',
            'X-Leaderboard-Hash': payload.hash || '',
            'Cache-Control': 'private, max-age=86400'
        },
        body
    };
}

module.exports = { encodeGzipJson };
