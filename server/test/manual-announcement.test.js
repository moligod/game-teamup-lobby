const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('events');
const express = require('express');
const { createManualAnnouncementService } = require('../src/modules/announcements/manual-announcement-service');
const { registerAnnouncementRoutes } = require('../src/modules/announcements/announcement-routes');

test('manual announcement validates input, limits ownership and supports edits', async () => {
    const items = new Map();
    const repository = {
        listManualAnnouncements: async () => [...items.values()],
        createManualAnnouncement: async (item) => { items.set(item.id, item); return item; },
        updateManualAnnouncement: async (id, item) => { if (!items.has(id)) return null; const row = { ...items.get(id), ...item }; items.set(id, row); return row; },
        deleteManualAnnouncement: async (id) => items.delete(id)
    };
    const service = createManualAnnouncementService(repository, { makeId: () => '12345678-1234-1234-1234-123456789abc' });
    await assert.rejects(service.create({ title: '', content: 'x', category: 'announcement' }), /Title/);
    await assert.rejects(service.create({ title: 'x', content: 'x', category: '__proto__' }), /category/);
    const saved = await service.create({ title: ' News ', content: 'Body', category: 'update' });
    assert.equal(saved.title, 'News'); assert.equal(saved.channel_name, 'game-updates');
    const edited = await service.update(saved.id, { title: 'Edited', content: 'Text', category: 'promotion' });
    assert.equal(edited.channel_name, 'sales');
    await assert.rejects(service.update('trovepal-id', { title: 'x', content: 'x', category: 'update' }), /Invalid announcement ID/);
    await service.remove(saved.id);
    await assert.rejects(service.remove(saved.id), { statusCode: 404 });
});

test('manual announcement routes require admin and publish through service', async (t) => {
    let created = false;
    const app = express(); app.use(express.json());
    const manualService = { create: async (input) => { created = true; return input; } };
    registerAnnouncementRoutes(app, {}, { manualService, requireAdmin: (req,res,next) => req.headers.authorization === 'Bearer admin' ? next() : res.status(401).end(), logger: { error() {} } });
    const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
    t.after(() => new Promise(resolve => server.close(resolve)));
    const url = `http://127.0.0.1:${server.address().port}/api/admin/announcements`;
    const body = JSON.stringify({ title: 'Title', content: 'Body', category: 'announcement' });
    const denied = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
    assert.equal(denied.status, 401); assert.equal(created, false);
    const ok = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer admin' }, body });
    assert.equal(ok.status, 200); assert.equal((await ok.json()).data.title, 'Title');
});
