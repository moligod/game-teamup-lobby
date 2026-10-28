const RETRYABLE_DATABASE_STARTUP_CODES = new Set([
    '57P01', // admin_shutdown
    '57P03', // cannot_connect_now
    '08001', // sqlclient_unable_to_establish_sqlconnection
    '08006', // connection_failure
    'ECONNREFUSED',
    'ECONNRESET',
    'ETIMEDOUT'
]);

function wait(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isRetryableDatabaseStartupError(error) {
    return RETRYABLE_DATABASE_STARTUP_CODES.has(error?.code);
}

async function retry(operation, options = {}) {
    const attempts = Math.max(1, Number(options.attempts) || 1);
    const delayMs = Math.max(0, Number(options.delayMs) || 0);
    const shouldRetry = options.shouldRetry || (() => true);
    const onRetry = options.onRetry || (() => undefined);
    const sleep = options.sleep || wait;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
            return await operation();
        } catch (error) {
            if (attempt === attempts || !shouldRetry(error)) {
                throw error;
            }
            await onRetry(error, attempt, attempts);
            await sleep(delayMs);
        }
    }

    throw new Error('Retry exhausted without executing the operation');
}

module.exports = { isRetryableDatabaseStartupError, retry };
