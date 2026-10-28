const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const WebSocket = require('ws');
const WebSocketManager = require('../websocket');

const silentLogger = {
    error() {}
};

function createBareManager(overrides = {}) {
    const manager = Object.create(WebSocketManager.prototype);
    Object.assign(manager, {
        logger: silentLogger,
        connections: new Set(),
        userConnections: new Map(),
        maxBufferedBytes: 512,
        slowClientCloseGraceMs: 1000,
        presenceBroadcastDelayMs: 60_000,
        presenceBroadcastTimer: null,
        heartbeatTimer: null,
        slowClientTerminationTimers: new Map()
    }, overrides);
    return manager;
}

async function listen(server) {
    server.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
}

async function closeServer(manager, server) {
    for (const socket of manager.wss.clients) {
        socket.terminate();
    }
    await new Promise((resolve) => manager.wss.close(() => resolve()));
    if (server.listening) {
        await new Promise((resolve) => server.close(() => resolve()));
    }
}

test('websocket server rejects frames above the configured payload bound', async (context) => {
    const server = http.createServer();
    const manager = new WebSocketManager(server, {
        maxPayloadBytes: 64,
        heartbeatIntervalMs: 60_000,
        logger: silentLogger
    });
    await listen(server);
    context.after(() => closeServer(manager, server));

    assert.equal(manager.wss.options.maxPayload, 64);
    const client = new WebSocket(`ws://127.0.0.1:${server.address().port}/ws`);
    await new Promise((resolve, reject) => {
        client.once('open', resolve);
        client.once('error', reject);
    });

    const serverSocket = Array.from(manager.connections)[0];
    const pong = new Promise((resolve) => serverSocket.once('pong', resolve));
    manager.runHeartbeat();
    assert.equal(serverSocket.troveIsAlive, false);
    await pong;
    assert.equal(serverSocket.troveIsAlive, true);

    const closed = new Promise((resolve) => client.once('close', (code) => resolve(code)));
    client.send(JSON.stringify({ type: 'heartbeat', padding: 'x'.repeat(128) }));

    assert.equal(await closed, 1009);
});

test('heartbeat pings live clients and terminates stale clients', () => {
    const manager = createBareManager();
    const live = {
        readyState: WebSocket.OPEN,
        troveIsAlive: true,
        pingCount: 0,
        ping() { this.pingCount += 1; },
        terminate() { this.terminated = true; }
    };
    const stale = {
        readyState: WebSocket.OPEN,
        troveIsAlive: false,
        troveUserId: '7',
        ping() { throw new Error('stale client must not be pinged'); },
        terminate() { this.terminated = true; }
    };
    manager.connections.add(live);
    manager.connections.add(stale);
    manager.userConnections.set('7', new Set([stale]));

    manager.runHeartbeat();

    assert.equal(live.pingCount, 1);
    assert.equal(live.troveIsAlive, false);
    assert.equal(stale.terminated, true);
    assert.equal(manager.connections.has(stale), false);
    assert.equal(manager.userConnections.has('7'), false);
    manager.stopTimers();
});

test('broadcast serializes once and closes a client before its queue exceeds the bound', () => {
    const manager = createBareManager({ maxBufferedBytes: 32 });
    const sent = [];
    const fastA = {
        readyState: WebSocket.OPEN,
        bufferedAmount: 0,
        send(payload) { sent.push(['a', payload]); }
    };
    const fastB = {
        readyState: WebSocket.OPEN,
        bufferedAmount: 0,
        send(payload) { sent.push(['b', payload]); }
    };
    let serialized = 0;
    manager.connections = new Set([fastA, fastB]);
    manager.broadcast({
        toJSON() {
            serialized += 1;
            return { type: 'update', data: 1 };
        }
    });

    assert.equal(serialized, 1);
    assert.equal(sent.length, 2);
    assert.equal(sent[0][1], sent[1][1]);

    const slow = {
        readyState: WebSocket.OPEN,
        bufferedAmount: 30,
        troveUserId: '9',
        send() { this.sent = true; },
        close(code, reason) {
            this.closeCode = code;
            this.closeReason = reason;
            this.readyState = WebSocket.CLOSED;
        },
        terminate() { this.terminated = true; }
    };
    manager.connections.add(slow);
    manager.userConnections.set('9', new Set([slow]));

    assert.equal(manager.sendSerialized(slow, 'payload', 7), false);
    assert.equal(slow.sent, undefined);
    assert.equal(slow.closeCode, 1013);
    assert.equal(slow.closeReason, 'client too slow');
    assert.equal(manager.connections.has(slow), false);
    assert.equal(manager.userConnections.has('9'), false);
    manager.stopTimers();
});

test('presence changes are coalesced into one latest full snapshot', () => {
    const events = [];
    const manager = createBareManager();
    manager.userConnections.set('7', new Set());
    manager.broadcast = (event) => events.push(event);

    manager.broadcastOnlinePresence();
    manager.userConnections.set('8', new Set());
    manager.broadcastOnlinePresence();

    assert.equal(events.length, 0);
    manager.flushOnlinePresence();
    assert.deepEqual(events, [{
        type: 'online_presence_update',
        data: {
            onlineUsers: 2,
            onlineUserIds: ['7', '8']
        }
    }]);
    manager.stopTimers();
});

test('inbound websocket messages are bounded per connection window', () => {
    let now = 1000;
    const manager = createBareManager({
        now: () => now,
        maxInboundMessagesPerWindow: 2,
        inboundRateWindowMs: 1000
    });
    const socket = {
        close(code, reason) {
            this.closeCode = code;
            this.closeReason = reason;
        },
        terminate() {
            this.terminated = true;
        }
    };
    socket.troveInboundWindowStartedAt = now;
    socket.troveInboundMessageCount = 0;
    manager.connections.add(socket);

    assert.equal(manager.acceptInboundMessage(socket), true);
    assert.equal(manager.acceptInboundMessage(socket), true);
    assert.equal(manager.acceptInboundMessage(socket), false);
    assert.equal(socket.closeCode, 1008);

    now += 1000;
    socket.troveInboundWindowStartedAt = now - 1000;
    socket.troveInboundMessageCount = 2;
    assert.equal(manager.acceptInboundMessage(socket), true);
});
