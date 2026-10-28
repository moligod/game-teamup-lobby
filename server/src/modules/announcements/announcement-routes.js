const MAX_PAGE = 10000;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;
const MAX_CHANNEL_NAME_LENGTH = 100;

function badRequest(message) {
    const error = new Error(message);
    error.statusCode = 400;
    return error;
}

function parsePage(value) {
    if (value === undefined) return 1;
    if (Array.isArray(value) || !/^[1-9]\d*$/.test(String(value))) {
        throw badRequest('page must be between 1 and 10000');
    }
    const page = Number(value);
    if (!Number.isSafeInteger(page) || page > MAX_PAGE) throw badRequest('page must be between 1 and 10000');
    return page;
}

function parsePageSize(value) {
    if (value === undefined || value === '') return DEFAULT_PAGE_SIZE;
    if (Array.isArray(value) || !/^[1-9]\d*$/.test(String(value))) {
        throw badRequest('pageSize must be between 1 and 50');
    }
    const pageSize = Number(value);
    if (!Number.isSafeInteger(pageSize) || pageSize > MAX_PAGE_SIZE) throw badRequest('pageSize must be between 1 and 50');
    return pageSize;
}

function parseChannelName(value) {
    if (value === undefined || value === '') return null;
    if (Array.isArray(value)) throw badRequest('channelName must be a string');
    const channelName = String(value).trim();
    if (!channelName) return null;
    if (channelName.length > MAX_CHANNEL_NAME_LENGTH) {
        throw badRequest('channelName must be at most 100 characters');
    }
    return channelName;
}

function registerAnnouncementRoutes(app, service, options = {}) {
    const logger = options.logger || console;
    const { requireAdmin } = options;

    app.get('/api/announcements/channels', async (_req, res) => {
        try {
            return res.json({ success: true, data: await service.getChannels() });
        } catch (error) {
            logger.error('Failed to get TrovePal announcement channels:', error);
            return res.status(error.statusCode || 502).json({ error: error.message || 'Failed to get announcement channels' });
        }
    });

    app.get('/api/announcements', async (req, res) => {
        try {
            const data = await service.getAnnouncements({
                page: parsePage(req.query.page),
                pageSize: parsePageSize(req.query.pageSize),
                channelName: parseChannelName(req.query.channelName)
            });
            return res.json({ success: true, data });
        } catch (error) {
            logger.error('Failed to get TrovePal announcements:', error);
            return res.status(error.statusCode || 500).json({ error: error.message || 'Failed to get announcements' });
        }
    });

    app.post('/api/admin/announcements/initialize', requireAdmin, async (_req, res) => {
        try {
            return res.json({ success: true, data: await service.initialize() });
        } catch (error) {
            logger.error('Failed to initialize TrovePal announcements:', error);
            return res.status(error.statusCode || 502).json({ error: error.message || 'Failed to initialize announcements' });
        }
    });
}

module.exports = { parseChannelName, parsePage, parsePageSize, registerAnnouncementRoutes };
