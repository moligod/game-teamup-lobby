const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const test = require('node:test');
const {
    QQ_BOT_GATEWAY_INTENTS,
    QqBotGateway
} = require('../src/infrastructure/qq-bot/qq-bot-gateway');

class FakeWebSocket extends EventEmitter {
    static OPEN = 1;
    static instances = [];

    constructor(url) {
        super();
        this.url = url;
        this.readyState = FakeWebSocket.OPEN;
        this.sent = [];
        this.terminated = false;
        FakeWebSocket.instances.push(this);
    }

    send(message) {
        if (this.readyState !== FakeWebSocket.OPEN) throw new Error('socket is closed');
        this.sent.push(JSON.parse(message));
    }

    close() {
        if (this.readyState !== FakeWebSocket.OPEN) return;
        this.readyState = 3;
        this.emit('close', 1000);
    }

    terminate() {
        if (this.readyState !== FakeWebSocket.OPEN) return;
        this.terminated = true;
        this.readyState = 3;
        this.emit('close', 1006);
    }

    static reset() {
        FakeWebSocket.instances = [];
    }
}

function createFakeTimers() {
    const timeouts = [];
    const intervals = [];
    return {
        timeouts,
        intervals,
        setTimeout(callback, delay) {
            const timer = { callback, delay, cleared: false };
            timeouts.push(timer);
            return timer;
        },
        clearTimeout(timer) {
            if (timer) timer.cleared = true;
        },
        setInterval(callback, delay) {
            const timer = { callback, delay, cleared: false };
            intervals.push(timer);
            return timer;
        },
        clearInterval(timer) {
            if (timer) timer.cleared = true;
        },
        async runNextTimeout() {
            const timer = timeouts.find((item) => !item.cleared);
            assert.ok(timer, 'expected a reconnect timer');
            timer.cleared = true;
            timer.callback();
            await settle();
        }
    };
}

async function settle() {
    await new Promise((resolve) => setImmediate(resolve));
}

function createGateway(options = {}) {
    const timers = options.timers || createFakeTimers();
    const handled = [];
    const gateway = new QqBotGateway({
        client: {
            isConfigured: () => true,
            getGatewayUrl: async () => 'wss://gateway.example.test/websocket',
            getAccessToken: async () => 'access-token'
        },
        handleEvent: async (payload) => handled.push(payload),
        WebSocket: FakeWebSocket,
        logger: { error: () => undefined },
        reconnectDelayMs: 10,
        maxReconnectDelayMs: 40,
        setTimeout: timers.setTimeout,
        clearTimeout: timers.clearTimeout,
        setInterval: timers.setInterval,
        clearInterval: timers.clearInterval
    });
    return { gateway, handled, timers };
}

test('QQ Gateway identifies, acknowledges heartbeats, and forwards group commands', async (t) => {
    FakeWebSocket.reset();
    const { gateway, handled, timers } = createGateway();
    t.after(() => gateway.stop());

    await gateway.start();
    const socket = FakeWebSocket.instances[0];
    assert.equal(socket.url, 'wss://gateway.example.test/websocket');

    socket.emit('message', JSON.stringify({ op: 10, d: { heartbeat_interval: 45_000 } }));
    await settle();

    assert.deepEqual(socket.sent[0], {
        op: 2,
        d: {
            token: 'QQBot access-token',
            intents: QQ_BOT_GATEWAY_INTENTS,
            shard: [0, 1],
            properties: {
                $os: process.platform,
                $browser: 'trovebbs',
                $device: 'trovebbs'
            }
        }
    });
    assert.equal(socket.sent.length, 1);

    socket.emit('message', JSON.stringify({
        op: 0,
        s: 1,
        t: 'READY',
        d: { session_id: 'session-1' }
    }));
    await settle();
    assert.deepEqual(socket.sent[1], { op: 1, d: 1 });
    assert.equal(timers.intervals[0].delay, 45_000);

    socket.emit('message', JSON.stringify({ op: 11 }));
    socket.emit('message', JSON.stringify({
        op: 0,
        s: 2,
        t: 'INTERACTION_CREATE',
        d: { group_openid: 'group-openid', data: { name: '/玩家信息 Alice' } }
    }));
    await settle();

    assert.deepEqual(handled.map((payload) => payload.t), ['READY', 'INTERACTION_CREATE']);
    assert.equal(gateway.sequence, 2);
    timers.intervals[0].callback();
    assert.deepEqual(socket.sent.at(-1), { op: 1, d: 2 });
});

test('QQ Gateway resumes a recoverable session and identifies after invalid session', async (t) => {
    FakeWebSocket.reset();
    const { gateway, timers } = createGateway();
    t.after(() => gateway.stop());

    await gateway.start();
    const firstSocket = FakeWebSocket.instances[0];
    firstSocket.emit('message', JSON.stringify({ op: 10, d: { heartbeat_interval: 45_000 } }));
    await settle();
    firstSocket.emit('message', JSON.stringify({ op: 0, s: 7, t: 'READY', d: { session_id: 'session-7' } }));
    await settle();

    firstSocket.emit('close', 1006);
    await timers.runNextTimeout();
    const resumedSocket = FakeWebSocket.instances[1];
    resumedSocket.emit('message', JSON.stringify({ op: 10, d: { heartbeat_interval: 45_000 } }));
    await settle();

    assert.deepEqual(resumedSocket.sent[0], {
        op: 6,
        d: { token: 'QQBot access-token', session_id: 'session-7', seq: 7 }
    });

    resumedSocket.emit('message', JSON.stringify({ op: 9, d: false }));
    await settle();
    assert.equal(resumedSocket.terminated, true);

    await timers.runNextTimeout();
    const replacementSocket = FakeWebSocket.instances[2];
    replacementSocket.emit('message', JSON.stringify({ op: 10, d: { heartbeat_interval: 45_000 } }));
    await settle();

    assert.equal(replacementSocket.sent[0].op, 2);
    assert.equal(replacementSocket.sent[0].d.token, 'QQBot access-token');
});
