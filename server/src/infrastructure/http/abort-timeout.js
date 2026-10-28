class RequestTimeoutError extends Error {
    constructor(label, timeoutMs) {
        super(`${label} timed out after ${timeoutMs}ms`);
        this.name = 'RequestTimeoutError';
        this.code = 'ETIMEDOUT';
        this.statusCode = 504;
        this.timeoutMs = timeoutMs;
    }
}

function normalizeTimeoutMs(value, fallback) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

async function withAbortTimeout({ timeoutMs, label = 'External request', signal: parentSignal } = {}, operation) {
    if (typeof operation !== 'function') throw new TypeError('operation must be a function');

    const controller = new AbortController();
    const abortFromParent = () => controller.abort(parentSignal?.reason);
    if (parentSignal?.aborted) abortFromParent();
    else parentSignal?.addEventListener('abort', abortFromParent, { once: true });

    let timer = null;
    const task = Promise.resolve().then(() => operation(controller.signal));
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
            const error = new RequestTimeoutError(label, timeoutMs);
            controller.abort(error);
            reject(error);
        }, timeoutMs);
    });

    try {
        return await Promise.race([task, timeout]);
    } finally {
        if (timer !== null) clearTimeout(timer);
        parentSignal?.removeEventListener('abort', abortFromParent);
    }
}

module.exports = { RequestTimeoutError, normalizeTimeoutMs, withAbortTimeout };
