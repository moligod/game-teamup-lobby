function createRequestLogger(options = {}) {
    const logger = options.logger || console;
    const clock = options.clock || (() => new Date());
    const write = typeof logger.info === 'function'
        ? logger.info.bind(logger)
        : logger.log.bind(logger);

    return (req, _res, next) => {
        write('HTTP request', {
            timestamp: clock().toISOString(),
            method: req.method,
            path: req.path,
            content_type: req.get('content-type') || null,
            content_length: req.get('content-length') || null
        });
        return next();
    };
}

module.exports = { createRequestLogger };
