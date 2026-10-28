const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('events');
const express = require('express');
const { parseChannelName, parsePage, parsePageSize, registerAnnouncementRoutes } = require('../src/modules/announcements/announcement-routes');
const DEFAULT_PAGE_SIZE = 10;
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
