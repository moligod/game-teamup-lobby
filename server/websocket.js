const WebSocket = require('ws');
const url = require('url');

const DEFAULT_MAX_PAYLOAD_BYTES = 64 * 1024;
const DEFAULT_MAX_BUFFERED_BYTES = 512 * 1024;
const DEFAULT_HEARTBEAT_INTERVAL_MS = 30 * 1000;
const DEFAULT_PRESENCE_BROADCAST_DELAY_MS = 150;
const DEFAULT_SLOW_CLIENT_CLOSE_GRACE_MS = 1000;
const DEFAULT_INBOUND_RATE_WINDOW_MS = 10 * 1000;
const DEFAULT_MAX_INBOUND_MESSAGES_PER_WINDOW = 60;

function positiveInteger(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function nonNegativeInteger(value, fallback) {
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

class WebSocketManager {
  constructor(server, options = {}) {
    this.maxPayloadBytes = positiveInteger(options.maxPayloadBytes, DEFAULT_MAX_PAYLOAD_BYTES);
    this.maxBufferedBytes = positiveInteger(options.maxBufferedBytes, DEFAULT_MAX_BUFFERED_BYTES);
    this.heartbeatIntervalMs = positiveInteger(options.heartbeatIntervalMs, DEFAULT_HEARTBEAT_INTERVAL_MS);
    this.presenceBroadcastDelayMs = nonNegativeInteger(
      options.presenceBroadcastDelayMs,
      DEFAULT_PRESENCE_BROADCAST_DELAY_MS
    );
    this.slowClientCloseGraceMs = nonNegativeInteger(
      options.slowClientCloseGraceMs,
      DEFAULT_SLOW_CLIENT_CLOSE_GRACE_MS
    );
    this.inboundRateWindowMs = positiveInteger(
      options.inboundRateWindowMs,
      DEFAULT_INBOUND_RATE_WINDOW_MS
    );
    this.maxInboundMessagesPerWindow = positiveInteger(
      options.maxInboundMessagesPerWindow,
      DEFAULT_MAX_INBOUND_MESSAGES_PER_WINDOW
    );
    this.now = options.now || Date.now;
    this.logger = options.logger || console;
    this.wss = new WebSocket.Server({ server, maxPayload: this.maxPayloadBytes });
    this.authenticateToken = options.authenticateToken || (() => null);
    this.connections = new Set();
    this.userConnections = new Map();
    this.presenceBroadcastTimer = null;
    this.heartbeatTimer = null;
    this.slowClientTerminationTimers = new Map();

    this.setupWebSocketServer();
    this.startHeartbeat();
  }

  setupWebSocketServer() {
    this.wss.on('connection', (ws, request) => {
      const parameters = url.parse(request.url, true);
      const protocols = String(request.headers['sec-websocket-protocol'] || '')
        .split(',')
        .map((value) => value.trim());
      const protocolToken = protocols.find((value) => value.startsWith('bearer.'))?.slice('bearer.'.length);
      const session = this.authenticateToken(protocolToken || parameters.query.access_token);
      const userId = session ? String(session.userId) : null;
      const clientId = parameters.query.clientId ? String(parameters.query.clientId) : null;

      ws.troveUserId = userId;
      ws.troveClientId = clientId || userId || `guest-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      ws.troveIsAlive = true;
      ws.troveInboundWindowStartedAt = this.now();
      ws.troveInboundMessageCount = 0;

      this.connections.add(ws);
      if (userId) {
        this.addUserConnection(userId, ws);
      }

      this.send(ws, {
        type: 'connection',
        data: {
          userId,
          clientId: ws.troveClientId,
          onlineUsers: this.getOnlineUserCount()
        }
      });
      this.broadcastOnlinePresence();

      ws.on('message', (message) => {
        if (!this.acceptInboundMessage(ws)) return;
        try {
          const data = JSON.parse(message);
          if (!data || typeof data !== 'object' || typeof data.type !== 'string') return;
          this.handleMessage(userId, data, ws);
        } catch (error) {
          this.logger.error('Failed to parse websocket message:', error);
        }
      });

      ws.on('pong', () => {
        ws.troveIsAlive = true;
      });
      ws.on('close', () => {
        this.clearSlowClientTermination(ws);
        this.removeConnection(ws);
      });
      ws.on('error', (error) => {
        this.logger.error('WebSocket error:', error);
        this.removeConnection(ws);
      });
    });

    this.wss.once('close', () => this.stopTimers());
  }

  acceptInboundMessage(ws) {
    const now = this.now();
    if (now - ws.troveInboundWindowStartedAt >= this.inboundRateWindowMs) {
      ws.troveInboundWindowStartedAt = now;
      ws.troveInboundMessageCount = 0;
    }
    ws.troveInboundMessageCount += 1;
    if (ws.troveInboundMessageCount <= this.maxInboundMessagesPerWindow) return true;

    this.removeConnection(ws);
    try {
      ws.close(1008, 'message rate exceeded');
    } catch {
      try {
        ws.terminate();
      } catch {
        // The socket may already be closed.
      }
    }
    return false;
  }

  startHeartbeat() {
    if (this.heartbeatTimer) {
      return;
    }

    this.heartbeatTimer = setInterval(() => this.runHeartbeat(), this.heartbeatIntervalMs);
    this.heartbeatTimer.unref?.();
  }

  runHeartbeat() {
    for (const ws of Array.from(this.connections)) {
      if (ws.readyState !== WebSocket.OPEN || ws.troveIsAlive === false) {
        this.removeConnection(ws);
        try {
          ws.terminate();
        } catch (error) {
          this.logger.error('Failed to terminate stale websocket client:', error);
        }
        continue;
      }

      ws.troveIsAlive = false;
      try {
        ws.ping();
      } catch (error) {
        this.logger.error('Failed to ping websocket client:', error);
        this.removeConnection(ws);
        try {
          ws.terminate();
        } catch {
          // The socket may already be fully closed.
        }
      }
    }
  }

  stopTimers() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.presenceBroadcastTimer) {
      clearTimeout(this.presenceBroadcastTimer);
      this.presenceBroadcastTimer = null;
    }
    for (const timer of this.slowClientTerminationTimers.values()) {
      clearTimeout(timer);
    }
    this.slowClientTerminationTimers.clear();
  }

  addUserConnection(userId, ws) {
    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set());
    }
    this.userConnections.get(userId).add(ws);
  }

  removeConnection(ws) {
    const hadConnection = this.connections.delete(ws);
    const userId = ws.troveUserId;

    if (userId && this.userConnections.has(userId)) {
      const sockets = this.userConnections.get(userId);
      sockets.delete(ws);
      if (sockets.size === 0) {
        this.userConnections.delete(userId);
      }
    }

    if (hadConnection) {
      this.broadcastOnlinePresence();
    }
  }

  handleMessage(userId, data, ws) {
    switch (data.type) {
      case 'ping':
        this.send(ws, { type: 'pong' });
        break;
      case 'heartbeat':
        this.send(ws, { type: 'heartbeat_ack', data: { onlineUsers: this.getOnlineUserCount() } });
        break;
      case 'chat_message':
        this.broadcastChatMessage(data.message);
        break;
      case 'team_message':
        this.handleTeamMessage(userId, data);
        break;
      default:
        console.log('Unknown websocket message type:', data.type);
    }
  }

  handleTeamMessage(userId, data) {
    console.log('Team websocket message:', { userId, type: data.type });
  }

  send(ws, data) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return false;
    }
    const payload = JSON.stringify(data);
    return this.sendSerialized(ws, payload, Buffer.byteLength(payload));
  }

  sendSerialized(ws, payload, payloadBytes = Buffer.byteLength(payload)) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    const bufferedBytes = Number.isFinite(ws.bufferedAmount) ? ws.bufferedAmount : 0;
    if (bufferedBytes + payloadBytes > this.maxBufferedBytes) {
      this.closeSlowClient(ws);
      return false;
    }

    try {
      ws.send(payload);
      return true;
    } catch (error) {
      this.logger.error('Failed to send websocket message:', error);
      this.removeConnection(ws);
      try {
        ws.terminate();
      } catch {
        // The socket may already be fully closed.
      }
      return false;
    }
  }

  closeSlowClient(ws) {
    if (!ws || ws.troveClosingForBackpressure) {
      return;
    }

    ws.troveClosingForBackpressure = true;
    this.removeConnection(ws);
    try {
      ws.close(1013, 'client too slow');
    } catch (error) {
      this.logger.error('Failed to close slow websocket client:', error);
      try {
        ws.terminate();
      } catch {
        // The socket may already be fully closed.
      }
      return;
    }

    if (ws.readyState === WebSocket.CLOSED) {
      return;
    }

    const timer = setTimeout(() => {
      this.slowClientTerminationTimers.delete(ws);
      if (ws.readyState !== WebSocket.CLOSED) {
        try {
          ws.terminate();
        } catch {
          // The socket may have closed between the state check and terminate().
        }
      }
    }, this.slowClientCloseGraceMs);
    timer.unref?.();
    this.slowClientTerminationTimers.set(ws, timer);
  }

  clearSlowClientTermination(ws) {
    const timer = this.slowClientTerminationTimers.get(ws);
    if (timer) {
      clearTimeout(timer);
      this.slowClientTerminationTimers.delete(ws);
    }
  }

  sendToUser(userId, data) {
    const sockets = this.userConnections.get(String(userId));
    if (!sockets || sockets.size === 0) {
      return false;
    }

    const payload = JSON.stringify(data);
    const payloadBytes = Buffer.byteLength(payload);
    return this.sendSerializedToUser(userId, payload, payloadBytes);
  }

  sendSerializedToUser(userId, payload, payloadBytes = Buffer.byteLength(payload)) {
    const sockets = this.userConnections.get(String(userId));
    if (!sockets || sockets.size === 0) {
      return false;
    }

    let sent = false;
    for (const ws of sockets) {
      sent = this.sendSerialized(ws, payload, payloadBytes) || sent;
    }
    return sent;
  }

  broadcast(data) {
    if (this.connections.size === 0) {
      return;
    }
    const payload = JSON.stringify(data);
    const payloadBytes = Buffer.byteLength(payload);
    for (const ws of this.connections) {
      this.sendSerialized(ws, payload, payloadBytes);
    }
  }

  getOnlineUserCount() {
    return this.userConnections.size;
  }

  getOnlineUserIds() {
    return Array.from(this.userConnections.keys());
  }

  isUserOnline(userId) {
    const sockets = this.userConnections.get(String(userId));
    if (!sockets) {
      return false;
    }
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        return true;
      }
    }
    return false;
  }

  broadcastOnlinePresence() {
    if (this.presenceBroadcastTimer) {
      return;
    }

    this.presenceBroadcastTimer = setTimeout(() => {
      this.presenceBroadcastTimer = null;
      this.emitOnlinePresence();
    }, this.presenceBroadcastDelayMs);
    this.presenceBroadcastTimer.unref?.();
  }

  flushOnlinePresence() {
    if (this.presenceBroadcastTimer) {
      clearTimeout(this.presenceBroadcastTimer);
      this.presenceBroadcastTimer = null;
    }
    this.emitOnlinePresence();
  }

  emitOnlinePresence() {
    this.broadcast({
      type: 'online_presence_update',
      data: {
        onlineUsers: this.getOnlineUserCount(),
        onlineUserIds: this.getOnlineUserIds()
      }
    });
  }

  sendFriendRequest(toUserId, fromUser) {
    return this.sendToUser(toUserId, {
      type: 'friend_request',
      data: {
        from: fromUser,
        message: `${fromUser.username} sent you a friend request`
      }
    });
  }

  sendFriendAccepted(toUserId, acceptedBy) {
    return this.sendToUser(toUserId, {
      type: 'friend_accepted',
      data: {
        friend: acceptedBy,
        message: `${acceptedBy.username} accepted your friend request`
      }
    });
  }

  sendFriendRejected(toUserId, rejectedBy) {
    return this.sendToUser(toUserId, {
      type: 'friend_rejected',
      data: {
        rejectedBy,
        message: `${rejectedBy.username} rejected your friend request`
      }
    });
  }

  sendFriendRemoved(toUserId, removedBy) {
    return this.sendToUser(toUserId, {
      type: 'friend_removed',
      data: {
        removedBy,
        message: `${removedBy.username} removed the friendship`
      }
    });
  }

  sendFriendListUpdate(toUserId, newFriend = null) {
    return this.sendToUser(toUserId, {
      type: 'friend_list_update',
      data: {
        friend: newFriend,
        message: 'Friend list updated'
      }
    });
  }

  sendFriendRequestUpdate(toUserId) {
    return this.sendToUser(toUserId, {
      type: 'friend_request_update',
      data: {
        message: 'Friend request list updated'
      }
    });
  }

  broadcastChatMessage(messageData) {
    this.broadcast({
      type: 'new_chat_message',
      data: messageData
    });
  }

  sendDirectMessage(toUserId, data) {
    return this.sendToUser(toUserId, {
      type: 'direct_message',
      data
    });
  }

  sendChatMessageUpdate() {
    this.broadcast({
      type: 'chat_message_update',
      data: {
        message: 'Chat messages updated'
      }
    });
  }

  sendTeamChatMessage(userIds, messageData) {
    const payload = JSON.stringify({
      type: 'team_chat_message',
      data: messageData
    });
    const payloadBytes = Buffer.byteLength(payload);
    for (const userId of userIds) {
      this.sendSerializedToUser(userId, payload, payloadBytes);
    }
  }

  sendMarketConversationUpdate(userId, data) {
    return this.sendToUser(userId, {
      type: 'market_conversation_update',
      data
    });
  }

  sendMarketConversationMessage(userId, data) {
    return this.sendToUser(userId, {
      type: 'market_conversation_message',
      data
    });
  }

  broadcastTeamCreated(teamData) {
    this.broadcast({
      type: 'team_created',
      data: teamData
    });
  }

  broadcastTeamJoined(teamData, memberData) {
    this.broadcast({
      type: 'team_joined',
      data: {
        team: teamData,
        member: memberData
      }
    });
  }

  broadcastTeamLeft(teamData, memberData) {
    this.broadcast({
      type: 'team_left',
      data: {
        team: teamData,
        member: memberData
      }
    });
  }

  broadcastTeamEnded(teamData) {
    this.broadcast({
      type: 'team_ended',
      data: teamData
    });
  }

  broadcastTeamListUpdate() {
    this.broadcast({
      type: 'team_list_update',
      data: {
        message: 'Team list updated'
      }
    });
  }

  sendUserTeamUpdate(userId) {
    return this.sendToUser(userId, {
      type: 'user_team_update',
      data: {
        message: 'User team status updated'
      }
    });
  }

  broadcastTeamTypesUpdate() {
    this.broadcast({
      type: 'team_types_update',
      data: {
        message: 'Team types updated'
      }
    });
  }

  broadcastLeaderboardUpdate(leaderboardData) {
    this.broadcast({
      type: 'leaderboard_update',
      data: leaderboardData
    });
  }

  sendTeamApplicationNotification(leaderId, applicationData) {
    return this.sendToUser(leaderId, {
      type: 'team_application',
      data: {
        ...applicationData,
        message: 'New team application'
      }
    });
  }

  sendTeamApplicationAccepted(applicantId, teamData) {
    return this.sendToUser(applicantId, {
      type: 'team_application_accepted',
      data: {
        team: teamData,
        message: `Your application to ${teamData.name} was accepted`
      }
    });
  }

  sendTeamApplicationRejected(applicantId, teamData, reason = '') {
    return this.sendToUser(applicantId, {
      type: 'team_application_rejected',
      data: {
        team: teamData,
        reason,
        message: `Your application to ${teamData.name} was rejected`
      }
    });
  }
}

module.exports = WebSocketManager;
