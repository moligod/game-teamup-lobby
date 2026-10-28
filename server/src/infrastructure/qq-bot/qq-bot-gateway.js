const WebSocket = require('ws');

const GROUP_AND_C2C_EVENT_INTENT = 1 << 25;
const INTERACTION_INTENT = 1 << 26;
const QQ_BOT_GATEWAY_INTENTS = GROUP_AND_C2C_EVENT_INTENT | INTERACTION_INTENT;
const DEFAULT_RECONNECT_DELAY_MS = 1_000;
const MAX_RECONNECT_DELAY_MS = 30_000;
const MIN_HEARTBEAT_INTERVAL_MS = 1_000;

function parsePayload(value) {
    const text = Buffer.isBuffer(value) ? value.toString('utf8') : String(value || '');
    const payload = JSON.parse(text);
    if (!payload || typeof payload !== 'object') throw new Error('QQ gateway payload must be an object');
    return payload;
}

function timerUnref(timer) {
    timer?.unref?.();
    return timer;
}

class QqBotGateway {
    constructor(options = {}) {
        this.client = options.client;
        this.handleEvent = options.handleEvent;
        this.WebSocket = options.WebSocket || WebSocket;
        this.logger = options.logger || console;
        this.gatewayUrl = String(options.gatewayUrl || process.env.QQ_BOT_GATEWAY_URL || '').trim();
        this.intents = Number.isInteger(options.intents) ? options.intents : QQ_BOT_GATEWAY_INTENTS;
        this.reconnectDelayMs = Math.max(100, Number(options.reconnectDelayMs || DEFAULT_RECONNECT_DELAY_MS));
        this.maxReconnectDelayMs = Math.max(this.reconnectDelayMs, Number(options.maxReconnectDelayMs || MAX_RECONNECT_DELAY_MS));
        this.setTimeout = options.setTimeout || setTimeout;
        this.clearTimeout = options.clearTimeout || clearTimeout;
        this.setInterval = options.setInterval || setInterval;
        this.clearInterval = options.clearInterval || clearInterval;

        this.started = false;
        this.connecting = false;
        this.socket = null;
        this.heartbeatTimer = null;
        this.reconnectTimer = null;
        this.heartbeatIntervalMs = 0;
        this.awaitingHeartbeatAck = false;
        this.sessionId = null;
        this.sequence = null;
        this.reconnectAttempt = 0;
        this.connectionVersion = 0;
    }

    isConfigured() {
        return Boolean(this.client?.isConfigured?.() && typeof this.handleEvent === 'function');
    }

    async start() {
        if (this.started) return;
        this.started = true;
        await this.connect();
    }

    stop() {
        this.started = false;
        this.connectionVersion += 1;
        this.connecting = false;
        this.clearReconnectTimer();
        this.stopHeartbeat();
        this.closeCurrentSocket();
    }

    configure() {
        if (!this.started) return;
        this.connectionVersion += 1;
        this.connecting = false;
        this.clearReconnectTimer();
        this.stopHeartbeat();
        this.clearSession();
        this.closeCurrentSocket();
        this.connect().catch((error) => this.logger.error('QQ gateway restart failed:', error.message));
    }

    async connect() {
        if (!this.started || !this.isConfigured() || this.connecting || this.socket) return;

        const version = this.connectionVersion;
        this.connecting = true;
        try {
            const url = await this.getGatewayUrl();
            if (!this.started || version !== this.connectionVersion) return;

            const socket = new this.WebSocket(url);
            this.socket = socket;
            this.bindSocket(socket, version);
        } catch (error) {
            if (this.started && version === this.connectionVersion) {
                this.logger.error('QQ gateway connection failed:', error.message);
                this.scheduleReconnect();
            }
        } finally {
            if (version === this.connectionVersion) this.connecting = false;
        }
    }

    async getGatewayUrl() {
        if (this.gatewayUrl) return this.gatewayUrl;
        if (typeof this.client?.getGatewayUrl !== 'function') throw new Error('QQ bot client cannot resolve the Gateway URL');
        return this.client.getGatewayUrl();
    }

    bindSocket(socket, version) {
        socket.on('message', (message) => {
            this.handleMessage(socket, message).catch((error) => {
                this.logger.error('QQ gateway message handling failed:', error.message);
            });
        });
        socket.on('error', (error) => {
            if (socket === this.socket && version === this.connectionVersion) {
                this.logger.error('QQ gateway socket error:', error.message);
            }
        });
        socket.on('close', (code) => {
            if (socket !== this.socket || version !== this.connectionVersion) return;
            this.socket = null;
            this.stopHeartbeat();
            if (code === 4007 || code === 4009) this.clearSession();
            if (this.started) this.scheduleReconnect();
        });
    }

    async handleMessage(socket, message) {
        let payload;
        try {
            payload = parsePayload(message);
        } catch (error) {
            this.logger.error('QQ gateway returned invalid JSON:', error.message);
            return;
        }
        if (socket !== this.socket) return;

        if (payload.op === 10) {
            const interval = Number(payload?.d?.heartbeat_interval);
            if (!Number.isFinite(interval) || interval <= 0) {
                this.logger.error('QQ gateway Hello payload has no valid heartbeat interval');
                this.forceReconnect(socket, true);
                return;
            }
            this.heartbeatIntervalMs = Math.max(MIN_HEARTBEAT_INTERVAL_MS, Math.floor(interval));
            await this.identifyOrResume(socket);
            return;
        }

        if (payload.op === 11) {
            this.awaitingHeartbeatAck = false;
            return;
        }

        if (payload.op === 7) {
            this.forceReconnect(socket, false);
            return;
        }

        if (payload.op === 9) {
            this.forceReconnect(socket, true);
            return;
        }

        if (payload.op !== 0) return;

        const sessionReady = payload.t === 'READY' || payload.t === 'RESUMED';
        if (payload.t === 'READY') {
            const sessionId = String(payload?.d?.session_id || '').trim();
            if (sessionId) this.sessionId = sessionId;
            this.reconnectAttempt = 0;
        } else if (payload.t === 'RESUMED') {
            this.reconnectAttempt = 0;
        }

        try {
            await this.handleEvent(payload);
            if (Number.isFinite(Number(payload.s))) this.sequence = Number(payload.s);
            if (sessionReady && socket === this.socket) this.startHeartbeat(socket);
        } catch (error) {
            this.logger.error(`QQ gateway event ${String(payload.t || 'unknown')} failed:`, error.message);
            this.forceReconnect(socket, false);
        }
    }

    async identifyOrResume(socket) {
        try {
            const token = await this.client.getAccessToken();
            if (socket !== this.socket || !this.started) return;

            if (this.sessionId && Number.isFinite(this.sequence)) {
                this.send(socket, {
                    op: 6,
                    d: {
                        token: `QQBot ${token}`,
                        session_id: this.sessionId,
                        seq: this.sequence
                    }
                });
                return;
            }

            this.send(socket, {
                op: 2,
                d: {
                    token: `QQBot ${token}`,
                    intents: this.intents,
                    shard: [0, 1],
                    properties: {
                        $os: process.platform,
                        $browser: 'trovebbs',
                        $device: 'trovebbs'
                    }
                }
            });
        } catch (error) {
            this.logger.error('QQ gateway authentication failed:', error.message);
            this.forceReconnect(socket, false);
        }
    }

    startHeartbeat(socket) {
        this.stopHeartbeat();
        this.awaitingHeartbeatAck = false;
        this.sendHeartbeat(socket);
        this.heartbeatTimer = timerUnref(this.setInterval(() => this.sendHeartbeat(socket), this.heartbeatIntervalMs));
    }

    stopHeartbeat() {
        if (this.heartbeatTimer) this.clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
        this.awaitingHeartbeatAck = false;
    }

    sendHeartbeat(socket) {
        if (socket !== this.socket || !this.isSocketOpen(socket)) return;
        if (this.awaitingHeartbeatAck) {
            this.logger.error('QQ gateway heartbeat acknowledgement timed out');
            this.forceReconnect(socket, false);
            return;
        }
        this.awaitingHeartbeatAck = true;
        try {
            this.send(socket, { op: 1, d: this.sequence });
        } catch (error) {
            this.logger.error('QQ gateway heartbeat failed:', error.message);
            this.forceReconnect(socket, false);
        }
    }

    send(socket, payload) {
        if (!this.isSocketOpen(socket)) throw new Error('QQ gateway socket is not open');
        socket.send(JSON.stringify(payload));
    }

    isSocketOpen(socket) {
        return socket?.readyState === (this.WebSocket.OPEN ?? 1);
    }

    forceReconnect(socket, resetSession) {
        if (socket !== this.socket) return;
        if (resetSession) this.clearSession();
        this.stopHeartbeat();
        this.socket = null;
        try {
            socket.terminate?.();
        } catch (error) {
            this.logger.error('QQ gateway socket termination failed:', error.message);
        }
        if (this.started) this.scheduleReconnect();
    }

    closeCurrentSocket() {
        const socket = this.socket;
        this.socket = null;
        if (!socket) return;
        try {
            socket.close?.(1000, 'Server shutdown');
        } catch (error) {
            this.logger.error('QQ gateway socket close failed:', error.message);
        }
    }

    clearSession() {
        this.sessionId = null;
        this.sequence = null;
    }

    scheduleReconnect() {
        if (!this.started || !this.isConfigured() || this.reconnectTimer) return;
        const exponent = Math.min(this.reconnectAttempt, 10);
        const delay = Math.min(this.maxReconnectDelayMs, this.reconnectDelayMs * (2 ** exponent));
        this.reconnectAttempt += 1;
        this.reconnectTimer = timerUnref(this.setTimeout(() => {
            this.reconnectTimer = null;
            this.connect().catch((error) => this.logger.error('QQ gateway reconnect failed:', error.message));
        }, delay));
        this.logger.error(`QQ gateway disconnected; reconnecting in ${delay}ms`);
    }

    clearReconnectTimer() {
        if (this.reconnectTimer) this.clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
    }
}

module.exports = {
    GROUP_AND_C2C_EVENT_INTENT,
    INTERACTION_INTENT,
    QQ_BOT_GATEWAY_INTENTS,
    QqBotGateway
};
