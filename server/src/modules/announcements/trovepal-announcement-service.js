const { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } = require('../../infrastructure/trovepal/trovepal-announcement-client');

const DEFAULT_ANNOUNCEMENT_REFRESH_INTERVAL_MS = 15 * 60 * 1000;
const MIN_ANNOUNCEMENT_REFRESH_INTERVAL_MS = 60 * 1000;

function storedTotal(row) {
    const total = Number(row?.total);
    return Number.isSafeInteger(total) && total >= 0 ? total : 0;
}

function insertedCount(result) {
    const value = typeof result === 'number' ? result : result?.inserted;
    const count = Number(value);
    return Number.isSafeInteger(count) && count >= 0 ? count : 0;
}

function refreshIntervalMs(value) {
    const interval = Number(value);
    if (!Number.isFinite(interval)) return DEFAULT_ANNOUNCEMENT_REFRESH_INTERVAL_MS;
    return Math.max(MIN_ANNOUNCEMENT_REFRESH_INTERVAL_MS, Math.floor(interval));
}

class TrovePalAnnouncementService {
    constructor({
        client,
        repository,
        clock = () => new Date(),
        refreshIntervalMs: configuredRefreshIntervalMs = process.env.TROVEPAL_ANNOUNCEMENT_REFRESH_MS,
        setIntervalFn = setInterval,
        clearIntervalFn = clearInterval,
        logger = console
    }) {
        this.client = client;
        this.repository = repository;
        this.clock = clock;
        this.refreshIntervalMs = refreshIntervalMs(configuredRefreshIntervalMs);
        this.setInterval = setIntervalFn;
        this.clearInterval = clearIntervalFn;
        this.logger = logger;
        this.lastRefreshAt = null;
        this.lastError = null;
        this.lastInsertedCount = 0;
        this.initializing = null;
        this.timer = null;
    }

    getStatus() {
        return {
            provider: 'trovepal',
            refreshed_at: this.lastRefreshAt,
            last_error: this.lastError,
            refresh_interval_ms: this.refreshIntervalMs,
            last_inserted_count: this.lastInsertedCount
        };
    }

    recordSuccess(insertedCount = this.lastInsertedCount) {
        this.lastRefreshAt = this.clock().toISOString();
        this.lastError = null;
        this.lastInsertedCount = insertedCount;
    }

    recordFailure(error) {
        this.lastError = error.message || 'TrovePal announcement request failed';
        throw error;
    }

    async getChannels() {
        try {
            const channels = await this.client.listChannels();
            this.recordSuccess();
            return channels;
        } catch (error) {
            return this.recordFailure(error);
        }
    }

    async getAnnouncements({ page = 1, pageSize = DEFAULT_PAGE_SIZE, channelName = null } = {}) {
        try {
            const offset = (page - 1) * pageSize;
            const [countRow, items] = await Promise.all([
                this.repository.countAnnouncements(channelName),
                this.repository.listAnnouncements(channelName, pageSize, offset)
            ]);
            const total = storedTotal(countRow);
            return {
                status: this.getStatus(),
                items: Array.isArray(items) ? items : [],
                pagination: {
                    page,
                    page_size: pageSize,
                    total,
                    total_pages: Math.ceil(total / pageSize)
                }
            };
        } catch (error) {
            return this.recordFailure(error);
        }
    }

    async syncAllAnnouncements() {
        const firstPage = await this.client.listAnnouncements({ page: 1, pageSize: MAX_PAGE_SIZE });
        const totalPages = Math.max(1, Math.ceil(firstPage.total / firstPage.pageSize));
        const items = [...firstPage.items];

        for (let page = 2; page <= totalPages; page += 1) {
            const payload = await this.client.listAnnouncements({ page, pageSize: firstPage.pageSize });
            items.push(...payload.items);
        }

        return items;
    }

    async initialize() {
        if (this.initializing) return this.initializing;
        this.initializing = this.syncAllAnnouncements()
            .then(async (items) => {
                const saveResult = this.repository?.saveAnnouncements
                    ? await this.repository.saveAnnouncements(items)
                    : 0;
                const newCount = insertedCount(saveResult);
                this.recordSuccess(newCount);
                return { fetched: items.length, inserted: newCount };
            })
            .catch((error) => this.recordFailure(error))
            .finally(() => {
            this.initializing = null;
        });
        return this.initializing;
    }

    refreshInBackground() {
        return this.initialize().catch((error) => {
            this.logger.error('TrovePal announcement refresh failed:', error.message);
            return null;
        });
    }

    async start() {
        if (this.timer !== null) return;

        this.timer = this.setInterval(() => this.refreshInBackground(), this.refreshIntervalMs);
        this.timer?.unref?.();
        await this.refreshInBackground();
    }

    stop() {
        if (this.timer !== null) this.clearInterval(this.timer);
        this.timer = null;
    }
}

module.exports = {
    DEFAULT_ANNOUNCEMENT_REFRESH_INTERVAL_MS,
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
    TrovePalAnnouncementService
};
