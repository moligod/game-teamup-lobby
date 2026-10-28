const express = require('express');

const LEADERBOARD_COLLECTOR_PATH = '/api/collector/leaderboard';
const DEFAULT_JSON_BODY_LIMIT = '256kb';
const DEFAULT_URLENCODED_BODY_LIMIT = '64kb';
const DEFAULT_COLLECTOR_JSON_BODY_LIMIT = '32mb';

function isLeaderboardCollectorPath(path) {
    return path === LEADERBOARD_COLLECTOR_PATH
        || path.startsWith(`${LEADERBOARD_COLLECTOR_PATH}/`);
}

function skipCollector(middleware) {
    return (req, res, next) => {
        if (isLeaderboardCollectorPath(req.path)) return next();
        return middleware(req, res, next);
    };
}

function registerGeneralRequestBodyParsers(app, options = {}) {
    app.use(skipCollector(express.json({
        limit: options.jsonLimit || DEFAULT_JSON_BODY_LIMIT,
        strict: true
    })));
    app.use(skipCollector(express.urlencoded({
        extended: true,
        limit: options.urlencodedLimit || DEFAULT_URLENCODED_BODY_LIMIT,
        parameterLimit: options.urlencodedParameterLimit || 100
    })));
}

function createCollectorJsonParser(options = {}) {
    return express.json({
        limit: options.limit || DEFAULT_COLLECTOR_JSON_BODY_LIMIT,
        strict: true,
        type: 'application/json'
    });
}

function requestBodyErrorHandler(error, req, res, next) {
    const collectorRequest = isLeaderboardCollectorPath(req.path);
    if (error?.type === 'entity.too.large' || error?.status === 413) {
        const body = { error: 'Request body too large' };
        if (collectorRequest) body.success = false;
        return res.status(413).json(body);
    }
    if (error?.type === 'entity.parse.failed') {
        const body = { error: 'Malformed JSON body' };
        if (collectorRequest) body.success = false;
        return res.status(400).json(body);
    }
    return next(error);
}

module.exports = {
    createCollectorJsonParser,
    isLeaderboardCollectorPath,
    registerGeneralRequestBodyParsers,
    requestBodyErrorHandler,
    DEFAULT_JSON_BODY_LIMIT,
    DEFAULT_URLENCODED_BODY_LIMIT,
    DEFAULT_COLLECTOR_JSON_BODY_LIMIT
};
