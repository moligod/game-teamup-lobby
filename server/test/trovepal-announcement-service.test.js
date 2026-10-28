const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const express = require('express');
const fetch = require('node-fetch');
const {
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
    TrovePalAnnouncementClient
} = require('../src/infrastructure/trovepal/trovepal-announcement-client');
const {
    DEFAULT_ANNOUNCEMENT_REFRESH_INTERVAL_MS,
    TrovePalAnnouncementService
} = require('../src/modules/announcements/trovepal-announcement-service');
const {
    parseChannelName,
    parsePage,
    parsePageSize,
    registerAnnouncementRoutes
} = require('../src/modules/announcements/announcement-routes');

test('TrovePal client uses the public list endpoint, API key headers, and channel filter', async () => {
    let request = null;
    const client = new TrovePalAnnouncementClient({
        baseUrl: 'https://api.trovepal.com/api/public',
        apiKey: 'trovepal_sk_test',
        appName: 'TroveBBS',
        fetch: async (url, options) => {
            request = { url: url.toString(), headers: options.headers };
            return {
                ok: true,
                json: async () => ({
                    total: 59,
                    page: 2,
                    pageSize: 50,
                    items: [{
                        id: 123,
                        channelName: 'patch-notes',
                        content: 'Patch notes',
                        authorUsername: 'Trove',
                        authorGlobalName: 'Trove News',
                        imageUrls: [
                            '/images/discord/test-image.jpg',
                            'https://api.trovepal.com/images/discord/already-full.png',
                            'javascript:alert(1)'
                        ],
                        postedAt: '2026-07-20T12:00:00.000Z',
                        hasEdits: true,
                        editCount: 2
                    }]
                })
            };
        }
    });

    const result = await client.listAnnouncements({ page: 2, pageSize: 999, channelName: 'patch-notes' });
    const requestedUrl = new URL(request.url);

    assert.equal(requestedUrl.pathname, '/api/public/announcements');
    assert.equal(requestedUrl.searchParams.get('page'), '2');
    assert.equal(requestedUrl.searchParams.get('pageSize'), '50');
    assert.equal(requestedUrl.searchParams.get('channelName'), 'patch-notes');
    assert.equal(request.headers['X-API-Key'], 'trovepal_sk_test');
    assert.equal(request.headers['X-App-Name'], 'TroveBBS');
    assert.equal(result.total, 59);
    assert.equal(result.items[0].category, 'announcement');
    assert.equal(result.items[0].channel_name, 'patch-notes');
    assert.equal(result.items[0].author_name, 'Trove News');
    assert.deepEqual(result.items[0].image_urls, [
        'https://api.trovepal.com/images/discord/test-image.jpg',
        'https://api.trovepal.com/images/discord/already-full.png'
    ]);
    assert.equal(result.items[0].has_edits, true);
    assert.equal(result.items[0].edit_count, 2);
});

test('TrovePal client reads and de-duplicates public announcement channels', async () => {
    let requestedUrl = null;
    const client = new TrovePalAnnouncementClient({
        apiKey: 'trovepal_sk_test',
        fetch: async (url) => {
            requestedUrl = url.toString();
            return { ok: true, json: async () => ['announcements', ' patch-notes ', '', 'announcements'] };
        }
    });

    const channels = await client.listChannels();

    assert.equal(new URL(requestedUrl).pathname, '/api/public/announcements/channels');
    assert.deepEqual(channels, ['announcements', 'patch-notes']);
});

test('TrovePal client loads the latest injected configuration for each request', async () => {
    let apiKey = 'trovepal_sk_first';
    let appName = 'TroveBBS';
    const headers = [];
    const client = new TrovePalAnnouncementClient({
        getConfig: async () => ({ api_key: apiKey, app_name: appName }),
        fetch: async (_url, options) => {
            headers.push(options.headers);
            return { ok: true, json: async () => ['announcements'] };
        }
    });

    await client.listChannels();
    apiKey = 'trovepal_sk_second';
    appName = 'TroveBBS-Production';
    await client.listChannels();

    assert.deepEqual(headers.map((value) => [value['X-API-Key'], value['X-App-Name']]), [
        ['trovepal_sk_first', 'TroveBBS'],
        ['trovepal_sk_second', 'TroveBBS-Production']
    ]);
});

test('TrovePal client rejects requests before they can leak an unconfigured key', async () => {
    const client = new TrovePalAnnouncementClient({
        apiKey: '',
        fetch: async () => {
            throw new Error('request should not be made');
        }
    });

    await assert.rejects(
        () => client.listChannels(),
        (error) => error.statusCode === 503 && error.message === 'TrovePal API key is not configured'
    );
});

test('TrovePal announcement service reads local pages and synchronizes every upstream page', async () => {
    const upstreamQueries = [];
    const repositoryQueries = [];
    const savedItems = [];
    const client = {
        listChannels: async () => ['announcements', 'patch-notes'],
        listAnnouncements: async (query) => {
            upstreamQueries.push(query);
            return {
                items: [{
                    id: String(query.page),
                    category: 'announcement',
                    channel_name: 'announcements',
                    content: 'First',
                    author_name: 'Trove',
                    author_username: 'Trove',
                    image_urls: [],
                    posted_at: '2026-07-20T12:00:00.000Z',
                    source_url: null
                }],
                total: 101,
                page: query.page,
                pageSize: query.pageSize
            };
        }
    };
    const service = new TrovePalAnnouncementService({
        client,
        repository: {
            countAnnouncements: async (channelName) => {
                repositoryQueries.push({ method: 'count', channelName });
                return { total: 21 };
            },
            listAnnouncements: async (channelName, limit, offset) => {
                repositoryQueries.push({ method: 'list', channelName, limit, offset });
                return [{
                    id: 'local-123',
                    category: 'announcement',
                    channel_name: channelName || 'announcements',
                    content: 'Stored locally',
                    author_name: 'Trove',
                    image_urls: ['https://api.trovepal.com/images/discord/test-image.jpg'],
                    posted_at: '2026-07-20T12:00:00.000Z'
                }];
            },
            saveAnnouncements: async (items) => {
                savedItems.push(...items);
                return { inserted: items.length, updated: 0 };
            }
        },
        clock: () => new Date('2026-07-20T13:00:00.000Z')
    });

    const channels = await service.getChannels();
    const page = await service.getAnnouncements({ page: 2, pageSize: DEFAULT_PAGE_SIZE, channelName: 'patch-notes' });
    const initialized = await service.initialize();

    assert.deepEqual(channels, ['announcements', 'patch-notes']);
    assert.deepEqual(repositoryQueries, [
        { method: 'count', channelName: 'patch-notes' },
        { method: 'list', channelName: 'patch-notes', limit: DEFAULT_PAGE_SIZE, offset: DEFAULT_PAGE_SIZE }
    ]);
    assert.deepEqual(upstreamQueries, [
        { page: 1, pageSize: MAX_PAGE_SIZE },
        { page: 2, pageSize: MAX_PAGE_SIZE },
        { page: 3, pageSize: MAX_PAGE_SIZE }
    ]);
    assert.equal(page.items[0].content, 'Stored locally');
    assert.equal(page.pagination.page, 2);
    assert.equal(page.pagination.page_size, DEFAULT_PAGE_SIZE);
    assert.equal(page.pagination.total, 21);
    assert.equal(page.pagination.total_pages, 3);
    assert.equal(page.status.refresh_interval_ms, DEFAULT_ANNOUNCEMENT_REFRESH_INTERVAL_MS);
    assert.equal(initialized.fetched, 3);
    assert.equal(initialized.inserted, 3);
    assert.equal(savedItems.length, 3);
    assert.equal(service.getStatus().last_inserted_count, 3);
});

test('announcement service refreshes immediately on startup and at its configured interval', async () => {
    const scheduled = [];
    const cleared = [];
    let upstreamRequests = 0;
    const timer = { unref: () => undefined };
    const service = new TrovePalAnnouncementService({
        client: {
            listAnnouncements: async ({ page, pageSize }) => {
                upstreamRequests += 1;
                return { items: [], total: 0, page, pageSize };
            }
        },
        repository: { saveAnnouncements: async () => ({ inserted: 0, updated: 0 }) },
        refreshIntervalMs: 60_000,
        setIntervalFn: (callback, interval) => {
            scheduled.push({ callback, interval });
            return timer;
        },
        clearIntervalFn: (value) => cleared.push(value),
        logger: { error: () => assert.fail('background refresh should not fail') }
    });

    await service.start();

    assert.equal(upstreamRequests, 1);
    assert.equal(scheduled.length, 1);
    assert.equal(scheduled[0].interval, 60_000);
    assert.equal(service.getStatus().refresh_interval_ms, 60_000);

    await scheduled[0].callback();

    assert.equal(upstreamRequests, 2);
    service.stop();
    assert.deepEqual(cleared, [timer]);
});

test('announcement route parsing follows the public API pagination and channel constraints', () => {
    assert.equal(parsePage(undefined), 1);
    assert.equal(parsePage(7), 7);
    assert.throws(() => parsePage(0), /page must be between 1 and 10000/);
    assert.equal(parsePageSize(undefined), DEFAULT_PAGE_SIZE);
    assert.equal(parsePageSize(50), 50);
    assert.throws(() => parsePageSize(51), /pageSize must be between 1 and 50/);
    assert.equal(parseChannelName(undefined), null);
    assert.equal(parseChannelName(' patch-notes '), 'patch-notes');
    assert.throws(() => parseChannelName(['one', 'two']), /channelName must be a string/);
});

test('announcement routes expose channels and forward a bounded channel-filtered list request', async (t) => {
    let receivedQuery = null;
    const app = express();
    registerAnnouncementRoutes(app, {
        getChannels: async () => ['announcements', 'patch-notes'],
        getAnnouncements: async (query) => {
            receivedQuery = query;
            return {
                status: { provider: 'trovepal' },
                items: [{ id: '123', channel_name: query.channelName, content: 'Patch notes' }],
                pagination: { page: query.page, page_size: query.pageSize, total: 1, total_pages: 1 }
            };
        }
    }, {
        logger: { error: () => undefined },
        requireAdmin: (_req, _res, next) => next()
    });

    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));

    const { port } = server.address();
    const [channelsResponse, listResponse] = await Promise.all([
        fetch(`http://127.0.0.1:${port}/api/announcements/channels`),
        fetch(`http://127.0.0.1:${port}/api/announcements?page=2&pageSize=10&channelName=patch-notes`)
    ]);

    assert.equal(channelsResponse.status, 200);
    assert.deepEqual(await channelsResponse.json(), { success: true, data: ['announcements', 'patch-notes'] });
    assert.equal(listResponse.status, 200);
    assert.equal((await listResponse.json()).data.pagination.page, 2);
    assert.deepEqual(receivedQuery, { page: 2, pageSize: 10, channelName: 'patch-notes' });
});
