const fetch = require('node-fetch');
const { RequestTimeoutError, normalizeTimeoutMs, withAbortTimeout } = require('../http/abort-timeout');

const TROVEPAL_API_BASE = 'https://api.trovepal.com';
const TROVEPAL_PUBLIC_API_BASE = `${TROVEPAL_API_BASE}/api/public`;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;
const DEFAULT_TROVEPAL_TIMEOUT_MS = 10_000;

function createApiError(message, statusCode = 502) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function normalizePage(value) {
    const page = Number.parseInt(String(value), 10);
    return Number.isInteger(page) && page > 0 ? page : 1;
}

function normalizePageSize(value) {
    const pageSize = Number.parseInt(String(value), 10);
    if (!Number.isInteger(pageSize) || pageSize < 1) return DEFAULT_PAGE_SIZE;
    return Math.min(pageSize, MAX_PAGE_SIZE);
}

function normalizeChannelNames(payload) {
    if (!Array.isArray(payload)) {
        throw createApiError('TrovePal announcement channel API returned an unexpected response');
    }

    return [...new Set(payload
        .map((value) => String(value || '').trim())
        .filter(Boolean))];
}

function categoryFor(channelName, content) {
    const channel = String(channelName || '').toLowerCase();
    const body = String(content || '').toLowerCase();

    if (channel.includes('sales')) return 'promotion';
    if (channel.includes('pts') || /\bpts\b|public test server/.test(body)) return 'pts';
    if (channel.includes('game-updates')) return 'update';
    return 'announcement';
}

function normalizeChannelName(value) {
    const channelName = String(value || '').trim();
    const slug = channelName.match(/([a-z0-9][a-z0-9-]*)$/i);
    return slug ? slug[1] : channelName;
}

function absoluteImageUrl(value) {
    const source = String(value || '').trim();
    if (!source) return null;

    try {
        const url = new URL(source, TROVEPAL_API_BASE);
        return url.protocol === 'https:' ? url.toString() : null;
    } catch {
        return null;
    }
}

function normalizeImageUrls(value) {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.map(absoluteImageUrl).filter(Boolean))];
}

function normalizeAnnouncement(item) {
    const content = String(item?.content || '').trim();
    const rawChannelName = String(item?.channelName || '').trim();
    const channelName = normalizeChannelName(rawChannelName);
    const authorUsername = String(item?.authorUsername || '').trim();
    const authorGlobalName = String(item?.authorGlobalName || '').trim();
    const editCount = Number(item?.editCount);
    const postedAt = typeof item?.postedAt === 'string' && item.postedAt.trim()
        ? item.postedAt.trim()
        : typeof item?.savedAt === 'string' && item.savedAt.trim()
            ? item.savedAt.trim()
            : null;

    return {
        id: String(item?.id ?? item?.messageId ?? '').trim(),
        category: categoryFor(rawChannelName, content),
        channel_name: channelName,
        content,
        author_name: authorGlobalName || authorUsername || 'TrovePal',
        author_username: authorUsername || null,
        image_urls: normalizeImageUrls(item?.imageUrls),
        posted_at: postedAt,
        source_url: null,
        has_edits: Boolean(item?.hasEdits),
        edit_count: Number.isFinite(editCount) && editCount > 0 ? Math.floor(editCount) : 0
    };
}

class TrovePalAnnouncementClient {
    constructor(options = {}) {
        this.fetch = options.fetch || fetch;
        this.baseUrl = String(options.baseUrl || TROVEPAL_PUBLIC_API_BASE).replace(/\/+$/, '');
        this.timeoutMs = normalizeTimeoutMs(
            options.timeoutMs ?? process.env.TROVEPAL_REQUEST_TIMEOUT_MS,
            DEFAULT_TROVEPAL_TIMEOUT_MS
        );
        this.getConfig = options.getConfig || (() => ({
            api_key: options.apiKey ?? process.env.TROVEPAL_API_KEY ?? '',
            app_name: options.appName ?? process.env.TROVEPAL_APP_NAME ?? 'TroveBBS'
        }));
    }

    async request(path, searchParams = {}) {
        const config = await this.getConfig();
        const apiKey = String(config?.api_key ?? '').trim();
        const appName = String(config?.app_name ?? 'TroveBBS').trim() || 'TroveBBS';

        if (!apiKey) {
            throw createApiError('TrovePal API key is not configured', 503);
        }

        const url = new URL(`${this.baseUrl}${path}`);
        for (const [key, value] of Object.entries(searchParams)) {
            if (value !== null && value !== undefined && value !== '') {
                url.searchParams.set(key, String(value));
            }
        }

        try {
            return await withAbortTimeout({
                timeoutMs: this.timeoutMs,
                label: 'TrovePal announcement request'
            }, async (signal) => {
                const response = await this.fetch(url, {
                    headers: {
                        Accept: 'application/json',
                        'X-API-Key': apiKey,
                        'X-App-Name': appName,
                        'User-Agent': 'TroveBBS-Announcements/2.0'
                    },
                    signal
                });

                if (!response.ok) {
                    throw createApiError(`TrovePal announcement API ${response.status}`);
                }

                try {
                    return await response.json();
                } catch (error) {
                    if (signal.aborted) throw error;
                    throw createApiError('TrovePal announcement API returned invalid JSON');
                }
            });
        } catch (error) {
            if (error instanceof RequestTimeoutError) {
                throw createApiError(error.message, error.statusCode);
            }
            throw error;
        }
    }

    async listChannels() {
        return normalizeChannelNames(await this.request('/announcements/channels'));
    }

    async listAnnouncements({ page = 1, pageSize = DEFAULT_PAGE_SIZE, channelName = null } = {}) {
        const normalizedPage = normalizePage(page);
        const normalizedPageSize = normalizePageSize(pageSize);
        const payload = await this.request('/announcements', {
            page: normalizedPage,
            pageSize: normalizedPageSize,
            channelName
        });

        if (!payload || !Array.isArray(payload.items)) {
            throw createApiError('TrovePal announcement API returned an unexpected response');
        }

        const total = Number(payload.total);
        if (!Number.isInteger(total) || total < 0) {
            throw createApiError('TrovePal announcement API returned an invalid total');
        }

        return {
            items: payload.items
                .map(normalizeAnnouncement)
                .filter((item) => item.id && item.channel_name),
            total,
            page: normalizePage(payload.page ?? normalizedPage),
            pageSize: normalizePageSize(payload.pageSize ?? normalizedPageSize)
        };
    }
}

module.exports = {
    TrovePalAnnouncementClient,
    TROVEPAL_PUBLIC_API_BASE,
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
    DEFAULT_TROVEPAL_TIMEOUT_MS,
    absoluteImageUrl,
    categoryFor,
    normalizeAnnouncement,
    normalizeChannelName,
    normalizeImageUrls,
    normalizeChannelNames
};
