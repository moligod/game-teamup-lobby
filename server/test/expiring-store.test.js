const assert = require('node:assert/strict');
const test = require('node:test');
const { ExpiringStore } = require('../src/platform/expiring-store');

test('expiring store keeps a bounded least-recently-used set', () => {
    const store = new ExpiringStore({ maxEntries: 2 });
    store.set('a', 1, 1000);
    store.set('b', 2, 1000);
    assert.equal(store.get('a'), 1);

    store.set('c', 3, 1000);

    assert.equal(store.get('b'), null);
    assert.equal(store.get('a'), 1);
    assert.equal(store.get('c'), 3);
    assert.equal(store.size, 2);
});

test('expiring store combines concurrent loads for the same key', async () => {
    const store = new ExpiringStore();
    let loads = 0;
    let resolveLoad;
    const loader = () => {
        loads += 1;
        return new Promise((resolve) => { resolveLoad = resolve; });
    };

    const first = store.getOrLoad('key', loader, 1000);
    const second = store.getOrLoad('key', loader, 1000);
    await Promise.resolve();
    resolveLoad('value');

    assert.deepEqual(await Promise.all([first, second]), ['value', 'value']);
    assert.equal(loads, 1);
    assert.equal(store.get('key'), 'value');
});

test('clearing the store prevents an older load from repopulating it', async () => {
    const store = new ExpiringStore();
    let resolveLoad;
    const pending = store.getOrLoad(
        'key',
        () => new Promise((resolve) => { resolveLoad = resolve; }),
        1000
    );
    await Promise.resolve();

    store.clear();
    resolveLoad('stale');

    assert.equal(await pending, 'stale');
    assert.equal(store.get('key'), null);
});
