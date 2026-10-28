## Executive Summary

### Audit Overview

- **Target System**: TroveBBS
- **Analysis Date**: 2026-07-20
- **Analysis Scope**: React/Vite 前端、Express API、PostgreSQL 数据访问、WebSocket 实时链路、Docker/Nginx/OpenResty 公网入口
- **Technology Stack**: React 19、TypeScript 5.8、Vite 7、Node.js 20/22、Express 4、`pg` 8、PostgreSQL 16、`ws` 8、Docker Compose、Nginx/OpenResty

> 证据与行号对应 2026-07-20 21:54 开始审计时的源码快照，18 项发现保留为修复前基线。后续章节中的估算仍不是生产承诺。
>
> 2026-07-21 已完成本地修复复审、PostgreSQL `EXPLAIN (ANALYZE, BUFFERS)`、容器重建和真实 HTTP/WebSocket 冒烟验证。仍未运行生产压测、浏览器 RUM/APM 或真实公网 OpenResty 验证；公网配置目前只是通过 Nginx 1.27 `nginx -t`，部署后必须再用实际 OpenResty 执行 `openresty -t`。

### Performance Assessment Summary

| Performance Level | Count | Percentage |
|-------------------|-------|------------|
| Critical Issues   | 5     | 27.8%      |
| High Impact       | 8     | 44.4%      |
| Medium Impact     | 4     | 22.2%      |
| Low Impact        | 1     | 5.6%       |
| **Total**         | **18**| **100%**   |

### Key Analysis Results

- **Performance Anti-Patterns**: 5 个可能造成事件循环、内存或连接池级联失效的关键模式
- **Code Optimization Opportunities**: 8 个高影响优化点，集中于实时事件合并、缓存治理、分页、索引和超时
- **Architecture Assessment**: 6/10 的性能基础能力已经实现，包括数据库连接池、事务释放、排行榜分页与缓存、公网限流和静态资源长期缓存
- **Overall Code Performance Score**: 45/100；这是基于静态风险覆盖面的工程评分，不是 Lighthouse 或压测分数

### Remediation and Verification Update

| Finding | Current status | Verified outcome |
|---------|----------------|------------------|
| P-001/P-002 | Completed locally | Collector Bearer auth runs before its independent 32 MiB parser; item/board limits and metadata-only request logs are tested; missing token returns 503. Public concurrency limits await OpenResty deployment. |
| P-003 | Mitigated | Lobby refreshes are keyed, single-flight and trailing-edge coalesced; realtime chat appends locally. A fully patch-based event protocol remains future work. |
| P-004 | Completed | 64 KiB frames, ping/pong stale-peer cleanup, slow-client queue cutoff and 60 messages/10 seconds per connection are covered by tests. |
| P-005 | Mitigated | Uploads have two-request bulkhead, timeout, disconnect cancellation and buffer release after Blob ownership. Multer is still memory-backed rather than fully streamed. |
| P-006 | Mitigated | Broadcast payloads serialize once and presence changes coalesce to the latest snapshot; presence payloads are still full snapshots. |
| P-007/P-008 | Completed | Browser tabs share one physical Socket with bounded lease takeover; TTL stores are bounded and combine concurrent same-key loads. |
| P-009 | Completed | `pg_trgm` GIN is valid (71 MB); one/two-character searches no longer enter the 1,844,546-row player path. Local short-query plan: 0.659 ms. |
| P-010 | Open by design | No superseded snapshot currently exists. No retention deletion was enabled without an approved history policy. |
| P-011 | Completed | Public market category/search/page/limit are bounded server-side; page caches coalesce and invalidate after writes. |
| P-012 | Mostly completed | Image-host and TrovePal requests have deadlines and cancellation; upload has a bulkhead. Circuit-breaker/stale fallback remains open. |
| P-013/P-015 | Completed | PostgreSQL uses 60 s statement, 10 s lock and 30 s idle-transaction timeouts; `/health` exposes pool state; market/friend/user-search indexes are valid and predicate-aligned. |
| P-014/P-017 | Completed for audited paths | Activity clock was isolated; replaceable page requests abort on supersession/unmount and stale responses cannot overwrite current state. |
| P-016 | Completed locally | Internal Nginx serves the read-only upload mount directly; public OpenResty caches uploads after deployment. |
| P-018 | Partial | Route/vendor splitting and gzip bundle budgets are enforced. CDN, RUM/APM, Lighthouse budget and confirmed Brotli support remain open. |

Local verification evidence:

- Backend test suite: `117/117`; cross-tab WebSocket and keyed lobby scheduler: `8/8`.
- Production frontend build: largest JS `103851/122880`, total JS `155056/204800`, total CSS `17838/30720` bytes gzip.
- Both Compose files parse; internal and public proxy files pass Nginx 1.27 `nginx -t`.
- Local Docker health is ready with pool `{ max: 10, total: 1, idle: 1, waiting: 0 }`; PostgreSQL volume and both 1,844,546-row leaderboard tables survived recreation.
- Migrations 021/022/023 and seven new indexes are valid/ready; `pg_trgm 1.6` is enabled.
- Market/friend/user tables are currently too small for the production planner to prefer the new indexes; diagnostic plans confirm index eligibility. This is expected, not a failed optimization.

---

## Analysis Methodology

### Performance Analysis Approach

- **Static Code Analysis**: 沿浏览器事件、HTTP 路由、应用服务、Repository、PostgreSQL 和 WebSocket 的真实调用路径检查
- **Database Query Analysis**: 检查 15 个 PostgreSQL 适配器、20 个迁移、索引、分页、事务和数据保留策略
- **Resource Utilization Assessment**: 对 JSON 解析、内存上传、WebSocket 帧与发送队列、缓存 Map 和外部 HTTP 生命周期建模
- **Architecture Performance Review**: 检查浏览器、OpenResty、Node 进程和 PostgreSQL 四层的缓存、限流、连接复用与失效机制

### Analysis Coverage

- **Files Analyzed**: 199 个源码文件，约 20,358 行，覆盖 `src` 与 `server` 两个主要代码树以及 Docker 配置
- **Database Queries Reviewed**: 约 210 个 SQL 语句块/数据访问操作，覆盖 15 个 PostgreSQL 适配器
- **API Endpoints Analyzed**: 约 100 个 HTTP 端点及 WebSocket 消息入口
- **Performance Patterns Checked**: N+1、无界集合、事件循环阻塞、缓存击穿、慢客户端背压、连接池耗尽、缺索引、无分页、重复请求和 Core Web Vitals 风险

### Analysis Capabilities

- **Pattern Detection**: 识别请求风暴、同步大对象处理、无界内存、过期请求和跨客户端放大
- **Database Analysis**: 识别模糊查询索引缺口、反向索引缺口、无界读取、历史数据膨胀和查询超时缺失
- **Resource Analysis**: 估算请求体、上传 Buffer/Blob、WebSocket payload/queue 和缓存键的内存压力
- **Architecture Assessment**: 评估公网 OpenResty、内部 Nginx、Express、PostgreSQL 的职责边界与失效保护
- **Frontend Analysis**: 检查路由分包、列表派生计算、1 Hz 重渲染、请求取消、图片尺寸及缓存头

---

## Performance Findings

### Critical Performance Issues

#### P-001: 公网采集接口无身份校验且单次上传条目无上限

**Location**: `server/src/modules/leaderboard/leaderboard-routes.js:15`, `server/src/modules/leaderboard/leaderboard-service.js:52`, `server/src/infrastructure/persistence/postgres/leaderboard-snapshot-repository.js:37`
**Performance Impact**: 9.8 (Critical)
**Pattern Detected**: 未认证的公网批写入口接受任意长度的 `items`，并在事务内分块遍历写入。
**Code Context**:

```javascript
app.post('/api/collector/leaderboard/snapshots/:snapshotId/boards', async (req, res) => {
    try { res.json({ success: true, ...(await service.stageSnapshotBoard(req.params.snapshotId, req.body)) }); }
});

if (!Array.isArray(body.items)) throw new LeaderboardError('items must be an array');
if (body.items.length === 0) throw new LeaderboardError('items cannot be empty');
```

**Impact**: OpenResty 的 10 r/s 限流只能控制频率，不能阻止未授权写入；一个超大请求仍可长期占用一个事务和 10 个连接中的一个，并制造大量 WAL、索引更新和 JSON 分配。
**Performance Cost**: 静态容量模型中，单次 N 条上传的校验、参数构建和写入均为 O(N)；并发大请求可使连接池排队并拖慢全部 API。
**Recommendation**: 在 JSON 解析前验证独立 collector 凭据或 mTLS；为 `items`、`expected_board_ids` 和单请求字节数设置业务上限；超限返回 413/422；将采集入口配置更小的专用 body limit 和并发上限。
**Fix Priority**: Immediate

#### P-002: 全局 50 MB 请求体在认证前解析，并将多数请求体同步输出到日志

**Location**: `server/server.js:63`, `server/server.js:158`, `server/server.js:167`, `server/server.js:210`
**Performance Impact**: 9.6 (Critical)
**Pattern Detected**: 全局大 body limit 与请求级对象日志同时位于路由认证之前。
**Code Context**:

```javascript
const JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT || '50mb';
app.use(bodyParser.json({ limit: JSON_BODY_LIMIT }));
app.use(bodyParser.urlencoded({ extended: true, limit: JSON_BODY_LIMIT }));

app.use((req, res, next) => {
    if (req.body && Object.keys(req.body).length > 0) {
        if (req.path.startsWith('/api/collector/leaderboard/snapshots')) {
            const itemCount = Array.isArray(req.body.items) ? req.body.items.length : 0;
            console.log('Leaderboard snapshot request:', { path: req.path, items: itemCount });
        } else {
            console.log('请求体:', req.body);
        }
    }
    next();
});
```

**Impact**: 任意普通 API 请求都可以先迫使 Node 主线程接收和解析巨大 JSON，再进入认证与路由；对象序列化和 stdout 写入进一步拉长事件循环停顿。
**Performance Cost**: 50 MB 文本、解析后的对象图和日志序列化可能同时驻留，单请求瞬时堆占用可明显超过 50 MB；数个并发请求即可触发频繁 major GC。
**Recommendation**: 默认全局限制降到 256 KB-1 MB；仅对已认证 collector 路由单独放宽；日志改为结构化摘要、请求 ID、字节数和耗时，禁止输出任意完整 body。
**Fix Priority**: Immediate

#### P-003: 一次实时业务动作会触发全站 HTTP/SQL 请求风暴

**Location**: `server/src/modules/lobby/lobby-command-service.js:3`, `src/features/lobby/hooks/use-lobby-realtime.ts:136`, `src/features/lobby/api/lobby-api.ts:35`, `src/features/lobby/api/lobby-api.ts:90`
**Performance Impact**: 9.7 (Critical)
**Pattern Detected**: 一个命令连续广播多个失效事件，每个客户端对每个事件重新拉取 3 个公共请求、5 个用户请求和最多 4 个队伍请求。
**Code Context**:

```javascript
const team = await repository.createTeam(teamData);
realtime.broadcastTeamCreated(team);
realtime.broadcastTeamListUpdate();
realtime.sendUserTeamUpdate(String(teamData.leader_id));

if (LOBBY_REFRESH_EVENTS.has(message.type)) {
  loadLobby().catch(() => undefined)
  loadUserData().catch(() => undefined)
  if (teamToRefresh) loadTeamPanel(teamToRefresh).catch(() => undefined)
  if (viewedTeamToRefresh) loadViewedTeam(viewedTeamToRefresh).catch(() => undefined)
}
```

**Impact**: 广播事件数量乘以在线客户端数量，再乘以每次刷新请求数；数据库池仅 10 个连接，短时扇出会迅速形成排队和超时。聊天事件已携带完整消息，客户端仍会全量重取消息列表。
**Performance Cost**: 模型场景为 100 个登录客户端时，一次建队的两个全站事件约产生 1,600-2,400 个 HTTP 请求，具体取决于队伍面板是否打开；这不是压测结果。
**Recommendation**: 一个业务事务只广播一个带版本号和变更实体的领域事件；客户端直接合并 payload；必须重取时按资源 key 100-300 ms 合并、single-flight，并只刷新受影响片段。
**Fix Priority**: Immediate

#### P-004: WebSocket 缺少入站帧限制、慢客户端背压和服务端失活回收

**Location**: `server/websocket.js:6`, `server/websocket.js:43`, `server/websocket.js:107`
**Performance Impact**: 9.4 (Critical)
**Pattern Detected**: 默认 `ws` server 接受大 payload，消息直接 `JSON.parse`，发送只检查 OPEN，不检查 `bufferedAmount`。
**Code Context**:

```javascript
this.wss = new WebSocket.Server({ server });

ws.on('message', (message) => {
  const data = JSON.parse(message);
  this.handleMessage(userId, data, ws);
});

if (ws && ws.readyState === WebSocket.OPEN) {
  ws.send(JSON.stringify(data));
}
```

**Impact**: `ws` v8 默认最大 payload 约 100 MiB；大帧解析会阻塞事件循环，慢客户端会让待发送数据在进程内累积。客户端发来的 `chat_message` 数据还可以直接进入全站广播。
**Performance Cost**: 单个大帧即可制造百 MB 级输入与解析压力；慢连接数量增长时，发送队列内存与广播频率近似线性增长。
**Recommendation**: 设置 `maxPayload`（例如 64 KiB，按最大真实消息校准）；校验消息 schema；限制消息频率；超过 `bufferedAmount` 阈值时丢弃可恢复事件或断开连接；加入服务端 ping/pong 与 terminate 清理。
**Fix Priority**: Immediate

#### P-005: 图片上传在内存中重复持有文件，外部上传无超时和并发界限

**Location**: `server/src/infrastructure/uploads/image-host-upload.js:3`, `server/src/infrastructure/uploads/image-host-upload.js:7`, `server/src/infrastructure/uploads/image-host-client.js:36`, `server/src/infrastructure/uploads/image-host-client.js:43`
**Performance Impact**: 9.1 (Critical)
**Pattern Detected**: `multer.memoryStorage()` 可接收 4 x 8 MB，随后每个 Buffer 又包装为 Blob/FormData，外部 fetch 没有 AbortSignal。
**Code Context**:

```javascript
return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_IMAGE_SIZE, files: 4 }
});

for (const file of files) {
    form.append('files', new Blob([file.buffer], { type: file.mimetype }), file.originalname || 'image');
}
const response = await this.fetch(new URL('/api/v1/upload/', config.base_url), { method: 'POST', body: form });
```

**Impact**: 上游变慢时请求会长期持有原始 Buffer、FormData 和请求上下文；Compose 未设置容器内存限制，多个并发上传可触发 OOM 或长 GC。
**Performance Cost**: 10 个满额并发请求仅原始文件 Buffer 就约 320 MB，尚未计 Blob/FormData、HTTP 库和 V8 开销。
**Recommendation**: 改为磁盘临时文件或流式直传；上传路由设置较小并发信号量；使用 AbortSignal timeout；限制总请求字节数；确保取消、失败和客户端断开时清理资源。
**Fix Priority**: Immediate

### High Performance Impact Findings

#### P-006: 在线状态广播具有 O(N²) 数据量且对每个连接重复序列化

**Location**: `server/websocket.js:107`, `server/websocket.js:128`, `server/websocket.js:155`
**Performance Impact**: 8.8 (High)
**Pattern Detected**: 每次连接或断开都向所有连接发送完整在线用户 ID 数组，`JSON.stringify` 在每个连接上重复执行。
**Code Context**:

```javascript
broadcast(data) {
  for (const ws of this.connections) {
    this.send(ws, data);
  }
}

broadcastOnlinePresence() {
  this.broadcast({ data: { onlineUsers: this.getOnlineUserCount(), onlineUserIds: this.getOnlineUserIds() } });
}
```

**Impact**: N 个在线用户时，一次上下线生成 N 份、每份含 N 个 ID 的消息；频繁重连时 CPU、内存分配和出口带宽被同时放大。
**Performance Cost**: 1,000 在线用户时，一次状态变化约发送 1,000 份包含 1,000 个 ID 的 payload，并执行约 1,000 次序列化。
**Recommendation**: 初次连接发送完整快照，后续只发 `user_online/user_offline` 增量；同一广播只序列化一次；按 100-500 ms 合并 presence 更新。
**Fix Priority**: Within 1 week

#### P-007: 同一浏览器的每个标签页都会建立独立 WebSocket

**Location**: `src/lib/ws.ts:11`, `src/lib/ws.ts:40`, `src/lib/ws.ts:58`
**Performance Impact**: 8.3 (High)
**Pattern Detected**: 单例只存在于当前 JavaScript 上下文，没有 BroadcastChannel 或跨标签 leader election。
**Code Context**:

```typescript
let socket: WebSocket | null = null
let heartbeat: number | null = null

export function connectWebSocket(token: string | null) {
  activeToken = token
  if (socket && connectedToken === token) return
  const url = new URL(WS_BASE_URL)
  url.searchParams.set('clientId', getClientId())
  const protocols = token ? ['trovebbs', 'bearer.' + token] : ['trovebbs']
  const nextSocket = new WebSocket(url.toString(), protocols)
  socket = nextSocket
}
```

**Impact**: 用户打开多个标签时，每个标签都执行连接、心跳、重连和全量事件刷新，直接放大 P-003 与 P-006。
**Performance Cost**: T 个标签近似产生 T 倍连接、心跳和广播消费；OpenResty 每 IP 12 连接上限只能限制最坏情况，不能去重正常重复连接。
**Recommendation**: 用 BroadcastChannel 建立主标签，只有 leader 连接服务端；其他标签通过频道收发；localStorage 事件作为兼容回退，并处理 leader 崩溃租约。
**Fix Priority**: Within 1 week

#### P-008: ExpiringStore 无容量上限、定时清理与 single-flight

**Location**: `server/src/platform/expiring-store.js:4`, `server/src/platform/expiring-store.js:15`, `server/src/modules/leaderboard/leaderboard-service.js:112`, `server/src/modules/identity/qq-auth-service.js:54`
**Performance Impact**: 8.2 (High)
**Pattern Detected**: 过期项只有访问同 key 时才删除，任意搜索词与 OAuth state 都会创建新 key，缓存 miss 并发时重复执行 loader。
**Code Context**:

```javascript
this.values = new Map();

get(key) {
    const entry = this.values.get(key);
    if (entry.expiresAt < this.clock()) this.values.delete(key);
}

async function cached(key, loader) {
    const value = cache.get(key);
    if (value !== null) return value;
    return cache.set(key, await loader(), cacheTtlMs);
}
```

**Impact**: 不再访问的随机 key 会永久占 Map；热点 key 同时失效时，每个请求都执行 SQL、hash 或二进制编码，形成缓存击穿。
**Performance Cost**: 内存与历史唯一 key 数量线性增长；失效瞬间数据库工作量近似并发数倍增。
**Recommendation**: 使用有 maxEntries 的 LRU/TTL store，定时或惰性批量清理；为 loader 保存 in-flight Promise；多实例部署时将共享热点迁移到 Redis 分布式锁/缓存。
**Fix Priority**: Within 1 week

#### P-009: 排行榜包含式模糊搜索无法使用现有 B-tree 索引

**Location**: `server/src/infrastructure/persistence/postgres/leaderboard-query-repository.js:36`, `server/migrations/004_leaderboard_snapshots.sql:51`
**Performance Impact**: 8.1 (High)
**Pattern Detected**: `lower(column) LIKE '%query%'` 扫描当前快照，迁移只有排序与 lower(player_name) 前缀型 B-tree。
**Code Context**:

```javascript
const normalizedQuery = '%' + String(searchQuery || '').trim().toLowerCase() + '%';
FROM leaderboard_current_entries
WHERE lower(player_name) LIKE $1
```

**Impact**: 数据增长后单字符或高频搜索会扫描大量快照行；250 ms 前端防抖不能让数据库使用索引，也不能取消已经发出的查询。
**Performance Cost**: 查询成本随当前快照条目数近似线性增长；并发搜索会争用仅 10 个连接。
**Recommendation**: 启用 `pg_trgm`，为被搜索字段建立 GIN/GiST trigram 表达式索引；设置最短 2-3 字符；按业务拆分玩家名搜索与榜单元数据搜索，并用 `EXPLAIN (ANALYZE, BUFFERS)` 验证。
**Fix Priority**: Within 1 week

#### P-010: 排行榜历史快照没有自动保留或清理策略

**Location**: `server/src/infrastructure/persistence/postgres/leaderboard-snapshot-repository.js:139`, `server/src/infrastructure/persistence/postgres/leaderboard-snapshot-repository.js:163`
**Performance Impact**: 7.9 (High)
**Pattern Detected**: 发布新快照只把旧快照标记为 `superseded`，没有 DELETE、分区或保留任务。
**Code Context**:

```javascript
await query("UPDATE leaderboard_snapshots SET status = 'superseded' WHERE status = 'published'");
await query(
  "UPDATE leaderboard_snapshots SET status = 'published', published_at = CURRENT_TIMESTAMP WHERE snapshot_id = $1",
  [snapshotId]
);
```

**Impact**: 历史 entry 与索引永久增长，备份、VACUUM、迁移和缓存冷启动成本持续上升。
**Performance Cost**: 若每日 70 个榜、每榜 1,000 行，则约 70,000 行/日、2,555 万行/年；这是容量模型，不代表当前真实数据量。
**Recommendation**: 明确保留期或保留快照数；按 `source_date` 分区；后台任务分批删除旧 superseded 快照并监控表/索引大小与 autovacuum。
**Fix Priority**: Within 1 month

#### P-011: 公共市场列表在服务端无分页，浏览器拿全量后才切 10 条

**Location**: `server/src/infrastructure/persistence/postgres/market-repository.js:14`, `src/features/market/components/MarketView.tsx:81`, `src/features/market/components/MarketView.tsx:103`
**Performance Impact**: 7.8 (High)
**Pattern Detected**: SQL 返回全部活跃商品并全表聚合卖家评价，前端过滤、排序、映射后才 `slice`。
**Code Context**:

```javascript
WHERE listing.is_active = TRUE
ORDER BY listing.is_pinned DESC, listing.created_at DESC, listing.id DESC

const offers = listings
  .filter((listing) => (
    listing.category === category &&
    (!search || [listing.title, listing.seller_name]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(search)))
  ))
const visibleOffers = offers.slice((currentOfferPage - 1) * MARKET_PAGE_SIZE, currentOfferPage * MARKET_PAGE_SIZE)
```

**Impact**: 数据库计算、JSON 序列化、网络、浏览器内存和排序 CPU 都随商品总量增长，而用户每页只看到 10 条。
**Performance Cost**: M 条商品的传输与浏览器排序分别为 O(M) 和 O(M log M)，与展示条数无关。
**Recommendation**: API 接受 category/query/sort/cursor/limit；数据库完成过滤和排序并返回 `items + next_cursor/total`；评价汇总做增量表或仅聚合当前页卖家。
**Fix Priority**: Within 1 month

#### P-012: 外部 HTTP 调用没有超时、取消、并发隔离或熔断

**Location**: `server/src/infrastructure/trovepal/trovepal-announcement-client.js:122`, `server/src/infrastructure/uploads/image-host-client.js:23`, `server/src/infrastructure/uploads/image-host-client.js:43`
**Performance Impact**: 7.7 (High)
**Pattern Detected**: 多处 `fetch` 不传 AbortSignal；公网 Nginx 的 60 秒客户端超时不会自动取消 Node 内仍运行的 fetch。
**Code Context**:

```javascript
const response = await this.fetch(url, {
    headers: {
        Accept: 'application/json',
        'X-API-Key': apiKey
    }
});
```

**Impact**: 依赖故障会堆积悬挂请求、上传 Buffer 与 Promise，最终拖慢同一 Node 进程的无关接口。
**Performance Cost**: 占用时长由不可控上游决定；并发量没有硬上限时资源占用可持续增长到进程或代理边界。
**Recommendation**: 使用 `AbortSignal.timeout` 或组合 AbortController；设置每个依赖的并发信号量、有限重试和指数退避；对只读公告增加 stale cache/circuit breaker。
**Fix Priority**: Within 1 week

#### P-013: PostgreSQL 连接池缺少 statement/query timeout 与排队监控

**Location**: `server/src/infrastructure/persistence/postgres/postgres-client.js:15`
**Performance Impact**: 7.6 (High)
**Pattern Detected**: 连接池仅配置 max、idle 与 connect timeout，没有语句执行上限。
**Code Context**:

```javascript
this.pool = new Pool({
    host: process.env.POSTGRES_HOST || 'postgres',
    port: Number(process.env.POSTGRES_PORT || 5432),
    database: process.env.POSTGRES_DB || 'game_hall',
    max: Number(process.env.POSTGRES_POOL_MAX || 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
});
```

**Impact**: 慢搜索、锁等待或请求风暴可以长期占住全部 10 个连接，后续健康检查和核心 API 一起排队。
**Performance Cost**: 最坏排队时间没有应用侧上限；故障可由单个慢查询扩散成全站 5xx/超时。
**Recommendation**: 配置 `statement_timeout`、`query_timeout`、`lock_timeout` 和 `idle_in_transaction_session_timeout`；导出 pool total/idle/waiting 指标；为采集或后台任务使用独立小池。
**Fix Priority**: Within 1 week

### Medium Performance Impact Findings

#### P-014: 大厅父视图每秒更新时间，导致整棵大型组件树重渲染

**Location**: `src/features/lobby/components/LobbyView.tsx:75`, `src/features/lobby/components/LobbyView.tsx:80`, `src/features/lobby/components/LobbyView.tsx:181`
**Performance Impact**: 6.4 (Medium)
**Pattern Detected**: 1 Hz timer 更新 `LobbyView` 顶层 state，父组件还持有队伍、消息、好友、申请等大量状态。
**Code Context**:

```typescript
const [activityNow, setActivityNow] = useState(() => new Date())
const activity = useMemo(() => getTroveActivitySnapshot(activityNow, locale), [activityNow, locale])

useEffect(() => {
  const timer = window.setInterval(() => setActivityNow(new Date()), 1000)
  return () => window.clearInterval(timer)
}, [])
```

**Impact**: 即使只有活动倒计时文本变化，队伍列表、聊天区和好友区也会每秒重新执行父级渲染路径，低端设备上增加 INP 与耗电风险。
**Performance Cost**: 每个保持大厅打开的标签每分钟至少触发 60 次顶层更新。
**Recommendation**: 将时钟 state 下沉到最小的 ActivityPanel；按显示精度改为分钟或精确边界定时；用 React Profiler 验证实际 commit 成本后再决定 memo 范围。
**Fix Priority**: Within 1 month

#### P-015: 好友关系的反向查询缺少匹配索引

**Location**: `server/src/infrastructure/persistence/postgres/social-repository.js:29`, `server/src/infrastructure/persistence/postgres/social-repository.js:87`, `server/migrations/001_initial_schema.sql:51`
**Performance Impact**: 6.2 (Medium)
**Pattern Detected**: 表只有 `UNIQUE(user_id, friend_id)`，但高频查询包含 `friend_id = $1` 和双向 OR。
**Code Context**:

```sql
WHERE (f.user_id = $1 OR f.friend_id = $1) AND f.status = 'accepted'

CREATE TABLE IF NOT EXISTS friends (
    user_id INTEGER NOT NULL,
    friend_id INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    UNIQUE(user_id, friend_id)
);
```

**Impact**: 以 friend_id 查待处理请求无法有效利用现有索引；好友边增长后用户大厅刷新会扫描更多关系行。
**Performance Cost**: 反向分支可能从索引定位退化为较大范围扫描，并被 P-003 的重复刷新放大。
**Recommendation**: 增加 `(friend_id, status, created_at DESC)` 索引；必要时为 accepted 双向查询拆成 `UNION ALL`，用执行计划验证 BitmapOr 与新索引选择。
**Fix Priority**: Within 1 month

#### P-016: 本地上传资源始终经过两层代理和 Express，且没有长期缓存

**Location**: `server/server.js:162`, `docker/nginx.conf:47`, `the public reverse-proxy configuration:225`
**Performance Impact**: 5.9 (Medium)
**Pattern Detected**: `/uploads/` 从 OpenResty 到内部 Nginx，再代理到 `express.static`，没有 immutable TTL 或静态文件直出。
**Code Context**:

```nginx
location ^~ /uploads/ {
    proxy_pass http://trovebbs_frontend;
}
```

```javascript
app.use('/uploads', express.static(UPLOAD_DIR));
```

**Impact**: 每张本地图片都占用 Node 连接并进入请求日志，重复访问无法充分利用浏览器/边缘缓存。
**Performance Cost**: 相比 OpenResty/Nginx `alias` 直出，多一次内部代理和 Node 请求处理；图片流量高时会与 API 争用进程。
**Recommendation**: 将上传卷只读挂载给内部 Nginx 或公网 OpenResty；内容哈希文件使用一年 immutable，非哈希文件使用短 TTL + ETag；关闭静态命中访问日志。
**Fix Priority**: Within 2 months

#### P-017: 前端只防止旧响应写状态，没有取消网络和服务器工作

**Location**: `src/lib/api.ts:28`, `src/features/leaderboard/components/LeaderboardView.tsx:269`
**Performance Impact**: 5.8 (Medium)
**Pattern Detected**: 通用 API 支持 RequestInit 但调用侧普遍仅用 `cancelled` 或 requestId；输入变化后旧 fetch/SQL 继续执行。
**Code Context**:

```typescript
let cancelled = false
const timer = window.setTimeout(() => {
  searchLeaderboardsBinary(trimmedQuery)
    .then((payload) => {
      if (!cancelled) setSearchResults(payload.results ?? [])
    })
}, 250)
```

**Impact**: 快速搜索、切换榜单或实时重复刷新时，过期请求仍占浏览器连接、Node 处理和数据库连接，只是结果被丢弃。
**Performance Cost**: 浪费量与用户输入速度和响应延迟成正比；与 P-003/P-009 组合时更明显。
**Recommendation**: 每个可替换请求创建 AbortController；effect cleanup 调用 `abort()`；API helper 透传 signal；服务端监听客户端断开并尽可能取消长任务。
**Fix Priority**: Within 1 month

### Low Performance Impact Findings

#### P-018: 传输优化和性能回归护栏仍不完整

**Location**: `the public reverse-proxy configuration:70`, `package.json:9`
**Performance Impact**: 3.6 (Low)
**Pattern Detected**: 公网仅启用 gzip，仓库未见 Brotli、CDN、RUM/APM、Lighthouse 或 bundle/performance budget。
**Code Context**:

```nginx
gzip on;
gzip_vary on;
gzip_comp_level 5;
```

**Impact**: 当前已有 gzip 和 hash 静态缓存，基础正确；但跨地域延迟、真实 Core Web Vitals 和包体回归缺少持续约束。
**Performance Cost**: 主要是错失收益而非当前故障；Brotli 对文本资源通常还能减少约 10%-25% 传输，实际值取决于文件内容与压缩等级。
**Recommendation**: 在真正公网 OpenResty 验证 Brotli 模块后启用；静态资源可接 CDN；接入 Web Vitals RUM、Node APM 和 CI Lighthouse/bundle budget。AES-GCM 等加密机制属于安全措施，不能替代压缩。
**Fix Priority**: Within 2 months

---

## Code Pattern Performance Analysis

### Performance Anti-Pattern Detection

- **N+1 Query Patterns**: 未确认传统“循环内逐行 SQL”型 N+1；确认 1 个跨客户端请求扇出模式（P-003）
- **Blocking Operations**: 2 个主线程高风险点，即大 JSON 解析与完整请求体日志（P-002）
- **Memory Pressure Points**: 4 类，分别是大 body、内存上传、WebSocket 大帧/慢客户端队列、无界 ExpiringStore
- **Inefficient Data Access**: 4 类，分别是排行榜包含式搜索、市场全量列表、好友反向索引和历史快照无保留
- **Concurrency Issues**: 5 类，包括实时请求风暴、缓存击穿、慢客户端背压、外部 fetch 无界等待和数据库池无执行超时

### Database Access Pattern Analysis

- **ORM/Query Usage**: 约 210 个 SQL 语句块；项目使用参数化原生 SQL，没有 ORM 隐式加载造成的已确认 N+1
- **Missing Async Patterns**: 数据库调用均为异步；问题集中在无界并发、请求放大和取消/超时，而非同步 DB API
- **Query Complexity**: 4 条路径需要重点执行计划验证：排行榜搜索、公共市场列表、好友双向关系、排行榜快照保留
- **Connection Management**: `max=10` 且事务 `finally` 正确 release；缺 statement/query timeout、等待队列指标与工作负载隔离

### Resource Management Pattern Analysis

- **Memory Allocation Patterns**: 50 MB body、32 MB/请求上传上限、约 100 MiB 默认 WebSocket payload 和无界 Map 是主要压力点
- **Garbage Collection Pressure**: 至少 4 个高分配位置；其中 Buffer/Blob、JSON 对象图与重复 stringify 对 V8 GC 最敏感
- **Thread/Event Loop Usage**: Node 单事件循环会被大 JSON parse/stringify 和广播序列化直接影响
- **Caching Opportunities**: 3 个优先机会：实时事件本地合并、排行榜 single-flight、公共只读数据多层缓存
- **Resource Disposal**: 数据库事务连接未发现泄漏；外部 fetch 与 WebSocket 慢连接缺少明确取消/终止边界

---

## Architecture Performance Assessment

### Data Access Layer Analysis

- PostgreSQL Repository 分层清楚，参数化 SQL 与事务连接释放正确；排行榜写入按 1,000 行批量插入，快照通过 active pointer 原子切换，避免读到半成品。
- 排行榜详情已有 limit/offset 限幅，消息、公告、黑名单和后台列表大多有分页。
- 主要缺口是热点失效 single-flight、模糊搜索 trigram 索引、公共市场服务端分页、好友反向索引和历史快照保留。

### Application Layer Analysis

- 异步 I/O 使用较普遍，数据库 pool 已配置连接数、空闲和连接超时。
- 全局大请求体、内存上传和无界 WebSocket/缓存使单进程仍可能在突发流量下失效。
- 实时事件当前表达的是“让所有客户端重取”，而非“携带可合并变更”，这是全栈最主要的 CPU、网络与 SQL 放大器。
- 外部依赖缺少 timeout、并发舱壁和 stale fallback，依赖故障会占住应用资源。

### Frontend Analysis (if applicable)

- 当前源码与 `dist` 已包含路由懒加载和 React/router/icons vendor chunk；这是正确方向。当前构建产物已拆成多个页面 chunk，而非单一 JS。
- 多个列表已使用 `useMemo`、Set/Map，本地分页和搜索防抖也已存在。
- 主要运行时问题是 WebSocket 事件触发全量重取、跨标签重复连接、过期请求不 abort 和大厅父视图每秒重渲染。
- 多处图片已有 `loading="lazy"`，公告图片已有 `decoding="async"`；部分评价/证据图仍缺稳定尺寸，需通过 CLS/RUM 判断优先级。

### Infrastructure Analysis

- 公网 OpenResty 已有 gzip、排行榜与 team-types 热点缓存、`proxy_cache_lock`、stale、API 限流和 WebSocket 每 IP 连接上限。
- 内部 Nginx 已有 upstream keepalive、hash 静态资源一年 immutable、WebSocket 关闭代理缓冲及清晰的代理超时。
- OpenResty 限流不能替代 collector 身份验证，代理超时也不能自动中止 Node 内的外部 fetch。
- 未见 CDN、Brotli、RUM/APM、生产 SLO 或缓存命中率面板；多实例时进程内缓存与锁还需要 Redis/分布式方案。

---

## Performance Bottleneck Analysis

### Top Performance Bottlenecks

| Rank | Component | Issue | Impact Score | Estimated Cost |
|------|-----------|-------|--------------|----------------|
| 1 | 实时大厅 | 广播事件触发全站多接口重取 | 9.7 | 100 客户端约 1,600-2,400 请求/次建队（模型） |
| 2 | HTTP 入口 | 认证前解析 50 MB body 并记录完整对象 | 9.6 | 单请求可造成 50 MB 以上瞬时堆与长 GC |
| 3 | WebSocket | 大帧、无背压、无失活回收 | 9.4 | 单帧可接近 100 MiB；慢客户端队列无上限 |
| 4 | 图片上传 | 4 x 8 MB 内存上传且外部 fetch 无超时 | 9.1 | 10 个满额请求仅原始 Buffer 约 320 MB |
| 5 | Collector/DB | 未认证、无条目上限的事务批写 | 9.8 | O(N) 校验/写入并长期占连接 |
| 6 | 在线状态 | 完整用户列表 O(N²) 广播 | 8.8 | 1,000 用户一次变化约 1,000 x 1,000 ID |
| 7 | 缓存 | 无容量上限与 single-flight | 8.2 | 内存随唯一 key 增长，miss 随并发放大 |
| 8 | 排行榜搜索 | 包含式 LIKE 缺 trigram | 8.1 | 随当前快照行数近似线性扫描 |
| 9 | 公共市场 | 无服务端分页 | 7.8 | O(M) 传输、O(M log M) 浏览器排序 |
| 10 | PostgreSQL | 无 statement/query timeout | 7.6 | 10 个连接可被慢查询全部占满 |

---

## Technical Recommendations

### Immediate Performance Fixes

1. 为 collector 增加解析前认证、独立 body limit、条目上限和并发上限，关闭完整 body 日志（P-001、P-002）。
2. 合并大厅领域事件，客户端按实体增量更新；对不得不重取的资源做 100-300 ms key 合并与 single-flight（P-003）。
3. 为 WebSocket 设置 `maxPayload`、schema 校验、速率限制、`bufferedAmount` 背压和服务端 ping/pong 回收（P-004）。
4. 上传改为流式/临时文件，并增加外部调用超时和并发信号量（P-005、P-012）。

### Performance Enhancements

1. presence 首次发快照、后续发增量，广播 payload 只序列化一次（P-006）。
2. 用 BroadcastChannel 在多标签之间共享一个实际 Socket（P-007）。
3. ExpiringStore 增加容量/清理/single-flight；多实例热点迁移 Redis（P-008）。
4. 增加排行榜 trigram 和好友反向索引，公共市场改服务端 cursor 分页（P-009、P-011、P-015）。
5. 设置 PostgreSQL 查询/锁/事务超时并暴露 pool waiting 指标（P-013）。

### Architecture Improvements

1. 采用“命令 -> 单一领域事件 -> 客户端局部合并”的实时契约，避免用 WebSocket 充当全站缓存清除广播。
2. 将 collector、用户 API、外部上传分成不同容量舱壁；至少使用独立限流/并发器，规模扩大后再考虑独立进程。
3. 建立排行榜快照分区与保留任务，监控表、索引、WAL 和 autovacuum。
4. 将 `/uploads` 交由 Nginx/OpenResty 直出；公网层继续承担压缩、公共缓存、限流和连接治理。

---

## Code Optimization Examples

### WebSocket 限帧、单次序列化与慢客户端背压 (references P-004, P-006)

**Before (Inefficient)**:

```javascript
this.wss = new WebSocket.Server({ server });

send(ws, data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
    return true;
  }
  return false;
}

broadcast(data) {
  for (const ws of this.connections) this.send(ws, data);
}
```

**After (Optimized)**:

```javascript
const MAX_WS_PAYLOAD = 64 * 1024;
const MAX_BUFFERED_BYTES = 512 * 1024;
this.wss = new WebSocket.Server({ server, maxPayload: MAX_WS_PAYLOAD });

sendSerialized(ws, payload) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return false;
  if (ws.bufferedAmount > MAX_BUFFERED_BYTES) {
    ws.close(1013, 'client too slow');
    return false;
  }
  ws.send(payload);
  return true;
}

broadcast(data) {
  const payload = JSON.stringify(data);
  for (const ws of this.connections) this.sendSerialized(ws, payload);
}
```

**Expected Improvement**: 广播序列化从 O(连接数) 降为每事件 1 次；限制单帧与发送队列最坏内存。实际吞吐收益需用 100/1,000 连接压测验证。

### 合并实时失效并避免每个事件全量重取 (references P-003)

**Before (Inefficient)**:

```typescript
if (LOBBY_REFRESH_EVENTS.has(message.type)) {
  loadLobby().catch(() => undefined)
  loadUserData().catch(() => undefined)
  if (teamToRefresh) loadTeamPanel(teamToRefresh).catch(() => undefined)
  if (viewedTeamToRefresh) loadViewedTeam(viewedTeamToRefresh).catch(() => undefined)
}
```

**After (Optimized)**:

```typescript
const refreshByKey = createCoalescedRefresh(200)

if (message.type === 'team_changed') {
  mergeTeamPatch(message.data.team)
  if (message.data.affectsCurrentUser) {
    refreshByKey('current-user', loadUserData)
  }
  if (selectedTeamRef.current?.id === message.data.team.id) {
    refreshByKey('team:' + message.data.team.id, () => loadTeamPanel(message.data.team))
  }
}

if (message.type === 'new_chat_message') {
  appendMessage(message.data)
}
```

**Expected Improvement**: 对可增量合并事件可消除 90% 以上 HTTP 重取；100 客户端场景理论上可从千级请求降至低百级或零公共重取，需以真实事件分布验证。

### 为热点缓存增加 single-flight 与容量边界 (references P-008)

**Before (Inefficient)**:

```javascript
async function cached(key, loader) {
    const value = cache.get(key);
    if (value !== null) return value;
    return cache.set(key, await loader(), cacheTtlMs);
}
```

**After (Optimized)**:

```javascript
const inFlight = new Map();

async function cached(key, loader) {
  const value = cache.get(key);
  if (value !== null) return value;
  if (inFlight.has(key)) return inFlight.get(key);

  const pending = Promise.resolve()
    .then(loader)
    .then((loaded) => cache.set(key, loaded, cacheTtlMs))
    .finally(() => inFlight.delete(key));

  inFlight.set(key, pending);
  return pending;
}

// ExpiringStore additionally enforces maxEntries and evicts oldest expired/LRU keys.
```

**Expected Improvement**: 同 key 失效瞬间的 loader/SQL 次数从并发数降为 1；内存上界由 `maxEntries` 明确控制。

### 公共市场改为数据库过滤和 cursor 分页 (references P-011)

**Before (Inefficient)**:

```javascript
WHERE listing.is_active = TRUE
ORDER BY listing.is_pinned DESC, listing.created_at DESC, listing.id DESC

const visibleOffers = offers.slice(
  (currentOfferPage - 1) * MARKET_PAGE_SIZE,
  currentOfferPage * MARKET_PAGE_SIZE
)
```

**After (Optimized)**:

```sql
SELECT listing.id, listing.seller_id, listing.title, listing.price, listing.created_at
FROM market_listings listing
WHERE listing.is_active = TRUE
  AND listing.category = $1
  AND ($2 = '' OR listing.title ILIKE '%' || $2 || '%')
  AND (listing.created_at, listing.id) < ($3, $4)
ORDER BY listing.created_at DESC, listing.id DESC
LIMIT $5;
```

**Expected Improvement**: 数据库和网络成本从“与全部 M 条商品相关”降为“与每页 L 条相关”；当 M 远大于 L=10-50 时，响应体和浏览器排序成本可下降一个数量级。

---

## Performance Optimization Priorities

### Phase 1: Critical Performance Fixes

- [x] P-001/P-002：collector 解析前认证、路由级 body/条目上限、日志摘要化
- [ ] P-003：已完成 keyed single-flight/合并和聊天局部追加；全量领域 patch 协议仍开放
- [x] P-004：WebSocket maxPayload、背压、ping/pong、入站速率限制和单次序列化
- [ ] P-005/P-012：已完成超时、取消、并发舱壁和内存释放；全流式上传/熔断仍开放

### Phase 2: High Impact Optimizations

- [x] P-007：跨标签共享一个实际 WebSocket
- [x] P-008：有界 TTL/LRU 与 single-flight；多实例 Redis 路线仍需在扩容前确定
- [x] P-009/P-015：已添加并用本地真实数据验证 trigram、市场与好友索引
- [ ] P-010：排行榜快照分区与保留任务
- [x] P-011：公共市场服务端有界 offset 分页、过滤、缓存合并与写后失效
- [x] P-013：数据库 statement/query/lock timeout 与 pool 指标

### Phase 3: Medium Impact Improvements

- [x] P-014：隔离活动时钟；生产 React Profiler/RUM 对比仍待接入
- [x] P-016：内部 Nginx 直出上传资源；公网缓存配置待云端发布验证
- [x] P-017：审计范围内可替换请求接入 AbortController
- [ ] 对评价/证据图补充稳定尺寸和 `decoding="async"`，以 CLS 数据决定是否继续优化

### Phase 4: Performance Monitoring and Fine-tuning

- [ ] P-018：接入 RUM/APM、缓存命中率、连接池、事件循环和 WebSocket 队列指标
- [ ] 为核心 API、collector、上传和 100/1,000 WebSocket 场景建立可重复压测
- [ ] 已建立 JS/CSS gzip 预算；Lighthouse/Core Web Vitals 预算仍待接入
- [ ] 在 OpenResty 验证 Brotli/CDN 后灰度启用，并比较真实压缩率与命中率

---

## Estimated Performance Improvement Impact

### Performance Gains by Priority

| Priority Level | Expected Improvement | Implementation Complexity |
|----------------|---------------------|--------------------------|
| Critical Fixes | 实时突发请求减少约 70%-99%；大 body、WS 帧、上传内存获得硬上界 | High，涉及实时协议与上传路径 |
| High Impact | 受影响 SQL p95 预计下降 30%-90%，缓存失效重复工作接近降为 1 份 | Medium-High |
| Medium Impact | 大厅无关渲染减少约 98%（1 Hz 降到按需/分钟），过期请求和静态 Node 流量下降 | Medium |
| Low Impact | 文本传输预计再降 10%-25%，并建立性能回归可见性 | Low-Medium |

以上均为静态模型估算，不是实测承诺；百分比会受在线人数、数据量、缓存命中率、页面停留时间和上游延迟影响。

### Resource Utilization Improvements

- **Database Load**: 实时事件局部更新和 single-flight 在广播突发时预计减少 80%-99% 重复 SQL；市场分页将成本限制在页面大小
- **Memory Usage**: 限制 body/WS payload、流式上传和有界缓存后，压力场景峰值预计下降 50%-90%
- **CPU Utilization**: 单次广播序列化、增量 presence 和减少 JSON/日志处理后，实时突发 CPU 预计下降 30%-80%
- **Concurrency/Throughput**: 避免连接池被重复请求与慢 SQL 占满后，突发阶段有效吞吐预计提升 3-10 倍，但必须压测确认

---

## Performance Monitoring Setup Recommendations

### Observability Recommendations

- **Metrics**: 使用 `prom-client` 暴露 HTTP duration/size、event-loop lag、heap/GC、PostgreSQL pool total/idle/waiting、cache hit/miss、WebSocket connections/buffered bytes、事件类型和 coalesced refresh 数
- **Logging**: 使用 Pino 等结构化异步日志；记录 request_id、route template、status、duration_ms、request_bytes、response_bytes、db_wait_ms、cache_status，禁止记录完整敏感 body
- **Distributed Tracing**: 用 OpenTelemetry 串联 OpenResty request ID、Express、PostgreSQL 和 TrovePal/image-host 外部调用；为广播事件附 event_id 以识别扇出

### Recommended Performance Tracking

- HTTP p50/p95/p99、吞吐、5xx/429、请求/响应字节和客户端取消率
- PostgreSQL query p95、锁等待、`pg_stat_statements` top queries、pool waiting；waiting 持续大于 0 或连接使用率持续超过 80% 告警
- Node event-loop lag p99 超过 50 ms、heap 连续增长、major GC 时间、RSS 接近容器限额 80% 告警
- WebSocket 连接数、每事件 fan-out、payload 字节、`bufferedAmount`、慢客户端关闭数和重连率
- OpenResty `X-TroveBBS-Cache` HIT/MISS/STALE 比例、上游响应时间和限流拒绝数
- Web Vitals：LCP < 2.5 s、INP < 200 ms、CLS < 0.1，并按路由、设备与网络分位数观察

### Performance Testing Recommendations

- 使用 k6 或 Artillery 重放“创建/加入队伍 -> WebSocket 广播 -> 客户端刷新”，分别测试 100 与 1,000 连接
- 使用 autocannon/k6 测试普通 256 KB body、超限 body、collector 合法批次与恶意超大批次
- 对图片上传测试 1/5/10/20 并发、上游 5/30/90 秒延迟与客户端中途断开，记录 RSS 和资源清理
- 在等比例测试数据上对排行榜搜索、市场分页和好友查询执行 `EXPLAIN (ANALYZE, BUFFERS)`；不要在生产直接做破坏性全量分析
- 使用 Lighthouse CI、Chrome Performance/React Profiler 和 WebPageTest 验证路由分包、INP、CLS 与慢网首屏

---

## Summary

This performance analysis identified **5 critical**, **8 high**, **4 medium**, and **1 low** performance issues across the application stack. The analysis focused on code patterns, database queries, resource utilization, and architectural performance.

**Key Strengths Identified**:

- 排行榜按 1,000 行批量写入并在事务内原子发布，避免半新半旧快照
- PostgreSQL 事务连接在 `finally` 中正确释放，多个常规接口已有分页/limit 限幅
- 当前前端源码和构建产物已经实现路由懒加载与 React/router/icons vendor 分包
- 公网 OpenResty 已有 gzip、热点缓存、`proxy_cache_lock`、stale、限流与 WebSocket 连接上限
- 内部 Nginx 已有 upstream keepalive、hash 资源一年 immutable 和 WebSocket 无缓冲
- 前端多个列表使用 `useMemo`、Set/Map、分页和图片 lazy loading

**Remaining Areas Requiring Attention**:

- 将已通过语法检查的公网 OpenResty 文件部署到真正 80/443，并验证 gzip、缓存 HIT、限流和 WebSocket
- 在明确历史需求后制定排行榜快照保留/归档策略；当前没有授权删除任何已有数据
- 继续把 remaining full-refresh/presence snapshot 改为细粒度 patch（需真实在线人数指标决定优先级）
- 若上传规模继续增长，将 Multer memory storage 改为流式/临时文件并加入断路器
- 接入生产 RUM/APM、缓存命中率、Lighthouse 预算和可重复的 100/1,000 连接压测

**Current Outcome**: 关键请求体、WebSocket、缓存、外部调用、数据库池和公共分页路径已经获得可配置上限，并通过本地测试、真实容器、HTTP/WebSocket 冒烟和执行计划验证。原先“减少 70%-99% 重复请求/SQL”的数字仍只是容量模型；在公网 OpenResty 发布并接入生产 RUM/APM、缓存命中率和负载测试前，不把它作为实测收益声明。
