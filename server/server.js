const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const http = require('http');
const fs = require('fs');
const Database = require('./src/infrastructure/persistence/postgres/database');
const { i18nMiddleware } = require('./i18n');
const WebSocketManager = require('./websocket');
const { TrovePalAnnouncementClient } = require('./src/infrastructure/trovepal/trovepal-announcement-client');
const { TrovePalAnnouncementService } = require('./src/modules/announcements/trovepal-announcement-service');
const { registerAnnouncementRoutes } = require('./src/modules/announcements/announcement-routes');
const { QqBotClient } = require('./src/infrastructure/qq-bot/qq-bot-client');
const { QqBotGateway } = require('./src/infrastructure/qq-bot/qq-bot-gateway');
const { PostgresQqBotRepository } = require('./src/infrastructure/persistence/postgres/qq-bot-repository');
const { registerHealthRoute } = require('./src/platform/health/register-health-route');
const { createLobbyService } = require('./src/modules/lobby/lobby-service');
const { createLobbyCommandService } = require('./src/modules/lobby/lobby-command-service');
const { registerLobbyRoutes } = require('./src/modules/lobby/lobby-routes');
const { QqTeamNotificationService } = require('./src/modules/lobby/qq-team-notification-service');
const { PostgresLobbyRepository } = require('./src/infrastructure/persistence/postgres/lobby-repository');
const { PostgresIdentityRepository } = require('./src/infrastructure/persistence/postgres/identity-repository');
const { PostgresSocialRepository } = require('./src/infrastructure/persistence/postgres/social-repository');
const { PostgresPlayerRepository } = require('./src/infrastructure/persistence/postgres/player-repository');
const { PostgresLeaderboardQueryRepository } = require('./src/infrastructure/persistence/postgres/leaderboard-query-repository');
const { PostgresLeaderboardSnapshotRepository } = require('./src/infrastructure/persistence/postgres/leaderboard-snapshot-repository');
const { PostgresLeaderboardStore } = require('./src/infrastructure/persistence/postgres/leaderboard-store');
const { PostgresAdminRepository } = require('./src/infrastructure/persistence/postgres/admin-repository');
const { PostgresMarketRepository } = require('./src/infrastructure/persistence/postgres/market-repository');
const { PostgresAnnouncementRepository } = require('./src/infrastructure/persistence/postgres/announcement-repository');
const { encodeGzipJson } = require('./src/infrastructure/encoding/gzip-json-encoder');
const { QqOauthClient } = require('./src/infrastructure/identity/qq-oauth-client');
const { ExpiringStore } = require('./src/platform/expiring-store');
const { createQqAuthService } = require('./src/modules/identity/qq-auth-service');
const { registerQqAuthRoutes } = require('./src/modules/identity/qq-auth-routes');
const { createAdminSessionService } = require('./src/modules/identity/admin-session-service');
const { createRequireAdmin, registerAdminSessionRoutes } = require('./src/modules/identity/admin-session-routes');
const { createSocialService } = require('./src/modules/social/social-service');
const { registerSocialRoutes } = require('./src/modules/social/social-routes');
const { createPlayerService } = require('./src/modules/players/player-service');
const { registerPlayerRoutes } = require('./src/modules/players/player-routes');
const { createLeaderboardService } = require('./src/modules/leaderboard/leaderboard-service');
const { registerLeaderboardRoutes } = require('./src/modules/leaderboard/leaderboard-routes');
const { createCollectorAuthMiddleware } = require('./src/modules/leaderboard/collector-auth-middleware');
const { createAdminService } = require('./src/modules/admin/admin-service');
const { registerAdminRoutes } = require('./src/modules/admin/admin-routes');
const { createMarketService } = require('./src/modules/market/market-service');
const { registerMarketRoutes } = require('./src/modules/market/market-routes');
const { createProfileService } = require('./src/modules/identity/profile-service');
const { registerProfileRoutes } = require('./src/modules/identity/profile-routes');
const { registerLegacyAuthRoutes } = require('./src/modules/identity/legacy-auth-routes');
const { createUserSessionService } = require('./src/modules/identity/user-session-service');
const { createUserAuthMiddleware } = require('./src/modules/identity/user-auth-middleware');
const { HmacSessionToken } = require('./src/infrastructure/identity/hmac-session-token');
const { createAvatarUpload } = require('./src/infrastructure/uploads/avatar-upload');
const { LocalAvatarStorage } = require('./src/infrastructure/uploads/local-avatar-storage');
const { createImageUpload } = require('./src/infrastructure/uploads/image-host-upload');
const { ImageHostClient } = require('./src/infrastructure/uploads/image-host-client');
const {
    createCollectorJsonParser,
    registerGeneralRequestBodyParsers,
    requestBodyErrorHandler,
    DEFAULT_JSON_BODY_LIMIT,
    DEFAULT_URLENCODED_BODY_LIMIT,
    DEFAULT_COLLECTOR_JSON_BODY_LIMIT
} = require('./src/platform/http/request-body');
const { createRequestLogger } = require('./src/platform/http/request-logger');
// 创建Express应用实例
const app = express();
const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
const JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT || DEFAULT_JSON_BODY_LIMIT;
const URLENCODED_BODY_LIMIT = process.env.URLENCODED_BODY_LIMIT || DEFAULT_URLENCODED_BODY_LIMIT;
const LEADERBOARD_COLLECTOR_BODY_LIMIT = process.env.LEADERBOARD_COLLECTOR_BODY_LIMIT || DEFAULT_COLLECTOR_JSON_BODY_LIMIT;
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const db = new Database();
const lobbyRepository = new PostgresLobbyRepository(db);
const qqBotRepository = new PostgresQqBotRepository(db);
const identityRepository = new PostgresIdentityRepository(db);
const socialRepository = new PostgresSocialRepository(db);
const playerRepository = new PostgresPlayerRepository(db);
const leaderboardRepository = new PostgresLeaderboardStore({
    queryRepository: new PostgresLeaderboardQueryRepository(db),
    snapshotRepository: new PostgresLeaderboardSnapshotRepository(db)
});
const adminRepository = new PostgresAdminRepository(db);
const marketRepository = new PostgresMarketRepository(db);
const announcementRepository = new PostgresAnnouncementRepository(db);
const lobbyService = createLobbyService(lobbyRepository);
const tokenFactory = (bytes) => crypto.randomBytes(bytes).toString('hex');
const userSessionService = createUserSessionService(new HmacSessionToken(
    process.env.USER_SESSION_SECRET || process.env.POSTGRES_PASSWORD || 'local-development-user-session-secret'
));
const { requireUser } = createUserAuthMiddleware(userSessionService);
const requireCollector = createCollectorAuthMiddleware({
    token: process.env.LEADERBOARD_COLLECTOR_TOKEN,
    logger: console
});
const qqAuthService = createQqAuthService({
    repository: identityRepository,
    oauthClient: new QqOauthClient(),
    stateStore: new ExpiringStore({ maxEntries: 5000 }),
    ticketStore: new ExpiringStore({ maxEntries: 5000 }),
    sessionService: userSessionService,
    tokenFactory
});
const adminSessionService = createAdminSessionService({
    repository: identityRepository,
    sessionStore: new ExpiringStore({ maxEntries: 2000 }),
    tokenFactory
});
const requireAdmin = createRequireAdmin(adminSessionService);
// Only the private frontend Nginx is connected directly to Express. It has
// already received a sanitized client IP from the public OpenResty hop.
app.set('trust proxy', 1);

// 创建HTTP服务器
const server = http.createServer(app);

// 创建WebSocket管理器
const wsManager = new WebSocketManager(server, {
    authenticateToken: (token) => userSessionService.authenticate(token)
});
const leaderboardService = createLeaderboardService({
    repository: leaderboardRepository,
    cache: new ExpiringStore({ maxEntries: 2048 }),
    hash: (value) => crypto.createHash('sha256').update(value).digest('hex'),
    snapshotIdFactory: () => crypto.randomUUID(),
    broadcaster: wsManager
});
const qqBotClient = new QqBotClient();
const qqTeamNotifications = new QqTeamNotificationService({
    repository: qqBotRepository,
    client: qqBotClient,
    lobbyQuery: lobbyService,
    playerProfile: (playerName) => leaderboardService.playerProfile(playerName),
    leaderboardVersion: () => leaderboardService.getVersion(),
    announcementQuery: (query) => trovePalAnnouncements.getAnnouncements(query),
    marketQuery: () => marketService.listPublicListings(),
    publicBaseUrl: process.env.PUBLIC_BASE_URL,
    logger: console
});
const qqBotGateway = new QqBotGateway({
    client: qqBotClient,
    handleEvent: (payload) => qqTeamNotifications.handleEvent(payload),
    logger: console
});
const lobbyCommandService = createLobbyCommandService(
    lobbyRepository,
    wsManager,
    identityRepository,
    qqTeamNotifications
);
const socialService = createSocialService(socialRepository, wsManager);
const profileService = createProfileService(identityRepository, socialService);
const avatarUpload = createAvatarUpload(UPLOAD_DIR);
const avatarStorage = new LocalAvatarStorage(UPLOAD_DIR);
const imageUpload = createImageUpload();
const imageHostClient = new ImageHostClient({
    getConfig: () => adminRepository.getImageHostConfig()
});
const playerService = createPlayerService(playerRepository);
const trovePalAnnouncements = new TrovePalAnnouncementService({
    client: new TrovePalAnnouncementClient({
        getConfig: () => adminRepository.getTrovePalConfig()
    }),
    repository: announcementRepository,
    logger: console
});
const adminService = createAdminService({
    repository: adminRepository,
    presence: wsManager,
    onQqBotConfigUpdated: (config) => {
        qqTeamNotifications.configure(config);
        qqTeamNotifications.start();
        qqBotGateway.configure(config);
    },
    onQqBotContentUpdated: (contentConfig) => {
        qqTeamNotifications.configure({ content: contentConfig });
    }
});
const marketService = createMarketService({
    repository: marketRepository,
    broadcaster: wsManager,
    mediaStorage: imageHostClient,
    publicListingsCache: new ExpiringStore({ maxEntries: 256 }),
    playerProfile: (playerName) => leaderboardService.playerProfile(playerName)
});

// 中间件配置
app.use(cors());// 启用CORS跨域支持
app.use(createRequestLogger({ logger: console }));
registerGeneralRequestBodyParsers(app, {
    jsonLimit: JSON_BODY_LIMIT,
    urlencodedLimit: URLENCODED_BODY_LIMIT
});
app.use(i18nMiddleware);// 多语言支持中间件
// 提供静态文件服务
app.use('/uploads', express.static(UPLOAD_DIR));

registerHealthRoute(app, db);

registerQqAuthRoutes(app, qqAuthService);
registerAdminSessionRoutes(app, adminSessionService);
registerSocialRoutes(app, socialService, { requireUser });
registerPlayerRoutes(app, playerService, { requireUser });
registerLeaderboardRoutes(app, leaderboardService, {
    binaryEncoder: encodeGzipJson,
    requireCollector,
    collectorJsonParser: createCollectorJsonParser({ limit: LEADERBOARD_COLLECTOR_BODY_LIMIT })
});
registerAdminRoutes(app, adminService, requireAdmin);
registerAnnouncementRoutes(app, trovePalAnnouncements, { requireAdmin });
registerMarketRoutes(app, marketService, { requireAdmin, requireUser, upload: imageUpload });
registerLobbyRoutes(app, lobbyService, lobbyCommandService, { presence: wsManager, requireUser });
registerProfileRoutes(app, profileService, { upload: avatarUpload, storage: avatarStorage, requireUser });
registerLegacyAuthRoutes(app);

// 本地头像上传功能已移除，现在使用聚合图床API

// 头像上传接口已移除，现在使用聚合图床API

// 获取所有团队类型
// 返回：团队类型列表（id和name）
app.use(requestBodyErrorHandler);

app.use((err, req, res, next) => {
    console.error('全局错误:', err);

    if (res.headersSent) {
        return next(err);
    }

    res.status(500).json({ success: false, error: '服务器内部错误' });
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('未处理的Promise拒绝:', reason);
    // 不要退出进程，只记录错误
});

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
    console.error('未捕获的异常:', error);
    // 不要退出进程，只记录错误
});

// 未找到路由处理
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Start only after the database schema and seed data are available. This makes
// Docker readiness reflect the actual ability to serve business requests.
async function startServer() {
    try {
        await db.ready;
    } catch (error) {
        console.error('Database initialization failed; backend will not start:', error);
        await db.close().catch(() => undefined);
        process.exitCode = 1;
        return;
    }

    try {
        const [config, contentConfig] = await Promise.all([
            adminRepository.getQqBotConfig(),
            adminRepository.getQqBotContentConfig()
        ]);
        qqTeamNotifications.configure({ ...config, content: contentConfig });
        qqBotGateway.configure(config);
    } catch (error) {
        console.error('QQ bot configuration load failed; using environment fallback:', error.message);
    }

    server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`WebSocket server is running on ws://localhost:${PORT}`);
    trovePalAnnouncements.start().catch((error) => {
        console.error('TrovePal announcement service failed to start:', error.message);
    });
    qqTeamNotifications.start();
    qqBotGateway.start().catch((error) => {
        console.error('QQ gateway failed to start:', error.message);
    });

    // 定时任务：每小时检查并自动结束超过3天的团队
    const THREE_DAYS = 3;
    async function autoEndExpiredTeams() {
        try {
            const result = await lobbyCommandService.expireTeams(THREE_DAYS);
            if (result.expired > 0) {
                console.log(`自动结束任务：发现超过${THREE_DAYS}天的活跃团队 ${result.expired} 个`);
            }
            for (const team of result.ended) {
                console.log(`已自动结束团队: ${team.id} - ${team.name}`);
            }
        } catch (err) {
            console.error('自动结束任务执行失败:', err);
        }
    }

    // 启动时立即执行一次，然后每小时执行
    autoEndExpiredTeams();
    setInterval(autoEndExpiredTeams, 60 * 60 * 1000);
    });
}

if (require.main === module) {
    startServer();
}

module.exports = app;
module.exports.startServer = startServer;
