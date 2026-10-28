const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveLanguage } = require('../i18n');

test('language resolution follows the preferred Accept-Language entry', () => {
    assert.equal(resolveLanguage('zh-CN,zh;q=0.9,en;q=0.8'), 'zh');
    assert.equal(resolveLanguage('en-US,en;q=0.9,zh;q=0.8'), 'en');
    assert.equal(resolveLanguage('en;q=0.8,zh;q=0.7'), 'en');
    assert.equal(resolveLanguage(), 'zh');
});
