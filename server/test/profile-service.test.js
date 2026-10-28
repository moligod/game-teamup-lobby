const assert = require('node:assert/strict');
const test = require('node:test');
const { createProfileService } = require('../src/modules/identity/profile-service');

test('signature update persists before notifying the social domain', async () => {
    const events = [];
    const service = createProfileService({
        updateUserSignature: async () => { events.push('persist'); return true; }
    }, {
        notifyProfileUpdated: async () => events.push('notify')
    });
    assert.deepEqual(await service.updateSignature(1, 'hello'), { message: '个人签名更新成功' });
    assert.deepEqual(events, ['persist', 'notify']);
});

test('profile service bounds signatures at 64 characters', async () => {
    const service = createProfileService({}, { notifyProfileUpdated: async () => {} });
    await assert.rejects(() => service.updateSignature(1, 'x'.repeat(65)), /64/);
});
