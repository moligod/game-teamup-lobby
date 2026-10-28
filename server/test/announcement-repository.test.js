const test = require('node:test');
const assert = require('node:assert/strict');
const { PostgresAnnouncementRepository } = require('../src/infrastructure/persistence/postgres/announcement-repository');

test('announcement repository upserts synchronized records and reads channel-filtered local pages', async () => {
    const calls = [];
    const database = {
        one: async (sql, params) => {
            calls.push({ method: 'one', sql, params });
            return { total: 7 };
        },
        query: async (sql, params) => {
            calls.push({ method: 'query', sql, params });
            if (sql.includes('INSERT INTO trovepal_announcements')) {
                return [{ inserted: true }, { inserted: false }];
            }
            return [{ id: 'local-1', channel_name: 'announcements' }];
        }
    };
    const repository = new PostgresAnnouncementRepository(database);

    const saved = await repository.saveAnnouncements([
        {
            id: 'local-1',
            category: 'announcement',
            channel_name: 'announcements',
            content: 'Stored text',
            author_name: 'Trove',
            author_username: 'trove',
            image_urls: ['https://api.trovepal.com/images/discord/image.jpg'],
            posted_at: '2026-07-20T12:00:00.000Z',
            source_url: null
        }
    ]);
    const total = await repository.countAnnouncements('announcements');
    const items = await repository.listAnnouncements('announcements', 10, 20);

    assert.deepEqual(saved, { inserted: 1, updated: 1 });
    assert.deepEqual(total, { total: 7 });
    assert.deepEqual(items, [{ id: 'local-1', channel_name: 'announcements' }]);

    const insert = calls.find((call) => call.method === 'query' && call.sql.includes('INSERT INTO trovepal_announcements'));
    assert.match(insert.sql, /ON CONFLICT \(source_id\) DO UPDATE/);
    assert.match(insert.sql, /image_urls = EXCLUDED\.image_urls/);
    assert.equal(insert.params[6], JSON.stringify(['https://api.trovepal.com/images/discord/image.jpg']));

    const count = calls.find((call) => call.method === 'one');
    const list = calls.find((call) => call.method === 'query' && call.sql.includes('LIMIT \$2 OFFSET \$3'));
    assert.match(count.sql, /regexp_replace\(channel_name/);
    assert.deepEqual(count.params, ['announcements']);
    assert.deepEqual(list.params, ['announcements', 10, 20]);
});
