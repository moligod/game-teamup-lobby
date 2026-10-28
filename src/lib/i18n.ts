import zhBase from '../i18n/locales/zh.json'
import enBase from '../i18n/locales/en.json'

export type Locale = 'zh' | 'en'
export type TranslationParams = Record<string, string | number>

type MessageTree = Record<string, unknown>

let activeLocale: Locale | null = null

function normalizeLocale(value?: string | null): Locale | null {
  return value === 'en' ? 'en' : value === 'zh' ? 'zh' : null
}

const extraMessages: Record<Locale, MessageTree> = {
  zh: {
    language: {
      switch: '切换语言',
      zh: '中文',
      en: 'EN',
    },
    app: {
      homeAria: 'TroveBBS 首页',
      brandSubtitle: '队伍大厅',
      lobby: '大厅',
      admin: '后台',
      onlineUsers: '当前在线用户数',
    },
    market: {
      nav: '\u4ea4\u6613\u5e02\u573a', communityMarket: 'TroveBBS C2C', title: '\u4e2a\u4eba\u5356\u5bb6\u5e02\u573a', subtitle: '\u6d4f\u89c8\u5356\u5bb6\u5546\u54c1\u3001\u53d1\u8d77\u7ad9\u5185\u79c1\u804a\uff0c\u7531\u4e70\u5bb6\u7559\u4e0b\u771f\u5b9e\u8bc4\u4ef7\u3002', sellerCenter: '\u6211\u8981\u51fa\u552e', buy: '\u6d4f\u89c8\u5546\u54c1', sell: '\u53d1\u5e03\u51fa\u552e', modeSwitch: '\u5e02\u573a\u89c6\u56fe', browseByCategory: '\u6d4f\u89c8\u5206\u7c7b', categoryNav: '\u5546\u54c1\u5206\u7c7b', categoryNavHint: '\u5171 6 \u4e2a\u5206\u7c7b',
      categories: { flux: '\u539f\u6676 Flux', items: '\u9053\u5177', boosting: '\u4ee3\u809d', accounts: '\u8d26\u53f7', codes: '\u5151\u6362\u7801', official: '\u5b98\u65b9\u670d\u52a1' },
      categoryDescriptions: { flux: '\u6839\u636e\u5e73\u53f0\u4e0e\u670d\u52a1\u5668\u9009\u62e9\u73b0\u8d27 Flux', items: '\u7cbe\u9009\u88c5\u5907\u3001\u5750\u9a91\u3001\u76df\u53cb\u4e0e\u6536\u85cf\u54c1', boosting: '\u6df1\u6e0a\u3001\u5229\u7ef4\u5766\u3001\u5468\u5e38\u4e0e\u9644\u8fd1\u670d\u52a1', accounts: '\u91cd\u70b9\u5c55\u793a\u8d26\u53f7\u8d44\u4ea7\u4e0e\u4ea4\u4ed8\u4fdd\u969c', codes: '\u5b9e\u65f6\u5e93\u5b58\u4e0e\u53ef\u5f00\u542f\u7684\u5151\u6362\u7801', official: 'TroveBBS \u7ad9\u5185\u81ea\u8425\u4e0e\u670d\u52a1\u5546\u54c1' },
      platform: '\u5e73\u53f0', server: '\u670d\u52a1\u5668', allPlatforms: '\u6240\u6709\u5e73\u53f0', searchPlaceholder: '\u641c\u7d22\u5356\u5bb6\u3001\u5546\u54c1\u6216\u670d\u52a1\u5668', sellerReputation: '\u5356\u5bb6\u4fe1\u8a89', verifiedSeller: '\u5df2\u8ba4\u8bc1\u5356\u5bb6', official: '\u5b98\u65b9', online: '\u5728\u7ebf', offline: '\u79bb\u7ebf', completedOrders: '\u4e70\u5bb6\u8bc4\u4ef7 {count} \u6761', response: '{time} \u56de\u590d', contactSeller: '\u8054\u7cfb\u5356\u5bb6', listingCount: '{count} \u4e2a\u4e2a\u4eba\u5356\u5bb6\u5546\u54c1', sortRecommended: '\u6309\u4e70\u5bb6\u8bc4\u4ef7\u4e0e\u6700\u8fd1\u53d1\u5e03\u6392\u5e8f', contactDemoNotice: '\u5c06\u4e3a\u4f60\u6253\u5f00\u4e0e {seller} \u7684\u5e73\u53f0\u6c9f\u901a\u3002\u672c\u8bbe\u8ba1\u7248\u6682\u672a\u8fde\u63a5\u5b9e\u9645\u79c1\u4fe1\u3002', emptyTitle: '\u6ca1\u6709\u5339\u914d\u7684\u5546\u54c1', emptyText: '\u53ef\u6e05\u9664\u7b5b\u9009\u6761\u4ef6\u6216\u5c1d\u8bd5\u5176\u4ed6\u5206\u7c7b\u3002', clearFilters: '\u6e05\u9664\u7b5b\u9009',
      pinned: '\u7f6e\u9876',
      publishTitle: '\u53d1\u5e03\u4f60\u7684\u5546\u54c1', publishSubtitle: '\u7528\u6e05\u6670\u7684\u4fe1\u606f\u5efa\u7acb\u5356\u5bb6\u4fe1\u8a89\uff0c\u8ba9\u4e70\u5bb6\u5feb\u901f\u4e86\u89e3\u4f60\u7684\u4ea4\u4ed8\u65b9\u5f0f\u3002', publishFlow: '\u53d1\u5e03\u6d41\u7a0b', stepDetails: '\u586b\u5199\u5546\u54c1', stepReview: '\u5e73\u53f0\u5ba1\u6838', stepLive: '\u4e0a\u67b6\u51fa\u552e', chooseCategory: '\u9009\u62e9\u5206\u7c7b', chooseCategoryHint: '\u4e0d\u540c\u5206\u7c7b\u5c06\u663e\u793a\u5bf9\u5e94\u7684\u4ea4\u4ed8\u4fe1\u606f\u3002', listingDetails: '\u5546\u54c1\u4fe1\u606f', listingDetailsHint: '\u4e70\u5bb6\u4f1a\u6839\u636e\u8fd9\u4e9b\u4fe1\u606f\u9009\u62e9\u5356\u5bb6\u3002', listingTitle: '\u5546\u54c1\u6807\u9898', listingTitlePlaceholder: '\u4f8b\uff1aPC \u7f8e\u670d Flux \u73b0\u8d27\uff0c5 \u5206\u949f\u5185\u4ea4\u4ed8', unitPrice: '\u5355\u4ef7 (CNY)', stock: '\u5e93\u5b58 / \u53ef\u4ea4\u4ed8\u91cf', stockPlaceholder: '\u4f8b\uff1a5000 \u4e07 Flux', availableTime: '\u53ef\u7ea6\u65f6\u95f4', availableTimePlaceholder: '\u4f8b\uff1a\u6bcf\u65e5 19:00-24:00', accountDetails: '\u8d26\u53f7\u4e0e\u4ea4\u4ed8\u8bf4\u660e', codeDetails: '\u5151\u6362\u7801\u4e0e\u53d1\u9001\u8bf4\u660e', deliveryMethod: '\u4ea4\u4ed8\u65b9\u5f0f', deliveryPlaceholder: '\u8bf7\u5199\u660e\u4ea4\u4ed8\u5730\u70b9\u3001\u8054\u7cfb\u65f6\u95f4\u4e0e\u5176\u4ed6\u6ce8\u610f\u4e8b\u9879', boostingDetailsPlaceholder: '\u8bf7\u5199\u660e\u670d\u52a1\u5185\u5bb9\u3001\u9884\u8ba1\u65f6\u957f\u3001\u9700\u8981\u4e70\u5bb6\u63d0\u4f9b\u7684\u4fe1\u606f', publishRule: '\u53d1\u5e03\u540e\u5c06\u8fdb\u5165\u5e73\u53f0\u5ba1\u6838\u3002\u8bf7\u52ff\u53d1\u5e03\u4efb\u4f55\u7ad9\u5916\u5bfc\u6d41\u65b9\u5f0f\u3001\u865a\u5047\u5546\u54c1\u6216\u8fdd\u89c4\u4fe1\u606f\u3002', saveDraft: '\u4fdd\u5b58\u8349\u7a3f', publishListing: '\u63d0\u4ea4\u5ba1\u6838', publishDemoNotice: '\u5df2\u6a21\u62df\u63d0\u4ea4\u5ba1\u6838\u3002\u6b63\u5f0f\u7248\u672c\u5c06\u5728\u8fd9\u91cc\u8fde\u63a5\u5546\u54c1\u53d1\u5e03\u63a5\u53e3\u3002',
    },
    marketSeller: {
      loginRequiredTitle: '登录后即可发布', loginRequiredText: '使用 QQ 登录后即可创建、编辑和管理自己的 C2C 商品。', loginButton: '使用 QQ 登录',
      categoryNavHint: '共 5 个 C2C 分类', searchPlaceholder: '搜索卖家或商品', categoryDescriptions: { flux: '原晶 Flux 现货与交易服务', items: '装备、坐骑、盟友与收藏品', boosting: '深渊、利维坦、周常与陪玩服务', accounts: '账号资产与安全交付说明', codes: '实时库存与可兑换的兑换码' },
      priceUnit: '计价单位', priceUnitPlaceholder: '例如：1M Flux', description: '商品说明', descriptionPlaceholder: '补充商品内容、交易要求或注意事项',
      publishRule: '商品会立即按上架状态展示。请勿发布站外导流、虚假商品或违规信息。', publishNow: '立即发布', saveChanges: '保存修改', cancelEdit: '取消编辑',
      listingPublished: '商品已上架，并已同步到市场列表。', draftSaved: '草稿已保存，仅自己可见。', listingUnlisted: '商品已下架，不再对买家显示。',
      myListings: '我的商品', myListingsHint: '管理已发布的商品和草稿。', noListings: '还没有发布商品', noListingsHint: '填写上方表单后即可在这里管理你的商品。',
      listed: '已上架', draft: '草稿', edit: '编辑商品', list: '上架', unlist: '下架', editTitle: '编辑你的商品',
      contactPending: '已选择 {seller} 的商品。站内订单与私信将在后续版本接入。',
    },
    marketC2C: {
      ownListingConversationForbidden: '不能与自己的商品发起洽谈。',
      myChats: '我的洽谈', myChatsHint: '所有交易沟通仅对买卖双方可见。', loginToChatTitle: '登录后查看交易洽谈', loginToChatText: '使用 QQ 登录后，即可私聊卖家、接收买家消息并留下交易评价。',
      noChats: '还没有交易洽谈。', noMessages: '尚未发送消息', selectChat: '从左侧选择一个洽谈，或在商品列表中联系卖家。', startConversation: '发送一条消息，开始本次交易洽谈。', messagePlaceholder: '输入交易相关消息...', send: '发送', you: '你',
      sellerReviews: '{seller} 的买家评价', viewReviews: '查看评价', reviewHint: '评价来自已发起站内洽谈的买家。', noReviews: '暂时没有买家留言。', reviewImage: '买家留言图片',
      leaveReview: '留下评价', reviewComposerHint: '请在确认交易完成后，留下真实评价。', rating: '买家评分', starRating: '{rating} 星', ratingOutOfFive: '{rating} / 5 分', noRating: '暂无评分', remainingStock: '剩余库存 {stock}', fluxStock: '库存 {stock} 百万', details: '详情', collapse: '收起', unitPrice: '单价', pricePerMillion: '单价(百万)', million: '百万', millionFlux: '百万 Flux', sortedByPrice: '按价格从低到高排序', sortedByNewest: '按最新发布时间排序', listingTitlePlaceholder: '例如：美服 Flux 现货，5 分钟内交付', reviewMessage: '买家留言', reviewPlaceholder: '描述本次交易的沟通和交付情况。', addReviewImages: '添加评价图片', imageLimit: '最多上传 4 张图片。', imageSelected: '已选择 {count} 张图片', submitReview: '提交评价',
    },
    adminConsole: {
      navigation: '后台功能', overview: '概览', users: '用户管理', operations: '运营管理', settings: '集成设置', market: '商品置顶', data: '数据维护',
      overviewHint: '查看当前运行情况与社区数据。', brandSubtitle: '管理控制台', backToSite: '返回网站',
    },
    common: {
      account: '账号',
      optional: '可选',
      processing: '处理中',
      no_data: '暂无数据',
      no_match: '暂无匹配结果',
      online: '在线',
      offline: '离线',
      pending: '待审',
      normal_user: '普通用户',
    },
    leaderboard: {
      title: '排行榜',
      all: '全部',
      mastery: '专精点',
      stats: '属性',
      paragon: '巅峰等级',
      power: '战斗力',
      weekly: '每周竞赛',
      other: '其他',
      searchPlaceholder: '搜索 ID 或名称',
      rowCount: '{count} 条',
      noMatch: '暂无匹配排行榜',
      noBoard: '暂无排行榜',
      waitingUpload: '等待采集端上传数据',
      rank: '排名',
      player: '玩家',
      value: '数值',
      previousPage: '上一页',
      nextPage: '下一页',
      playerNotIndexed: '该玩家暂未收录，请等待下次数据更新。',
    },
    team_react: {
      title: '队伍大厅',
      realtimeSummary: '队伍、好友、聊天和游戏名绑定已接入实时刷新。',
      onlineMetric: '在线',
      teamsMetric: '队伍',
      typesMetric: '类型',
      loggedIn: '已登录',
      usernameOrEmail: '用户名或邮箱',
      usernameHint: '3-20 位字母数字',
      passwordHint: '至少 6 位',
      teamStateLogin: '登录后显示你所在的队伍。',
      noJoinedTeam: '当前未加入队伍。',
      tabsTeams: '队伍',
      tabsChat: '聊天',
      tabsFriends: '好友',
      tabsBinding: '绑定',
      teamNameShort: '队伍名',
      teamNamePlaceholder: '输入队伍名',
      typeShort: '类型',
      noPowerRequirement: '无战力要求',
      captain: '队长',
      pendingReview: '待审核',
      approveNotice: '申请已同意',
      rejectNotice: '申请已拒绝',
      createdNotice: '队伍已创建',
      joinedNotice: '已加入队伍',
      leftNotice: '已退出队伍',
      chatPlaceholder: '输入聊天内容',
      loginFirst: '请先登录',
      friendDeleted: '好友已删除',
      friendAccepted: '已接受好友请求',
      friendRejected: '已拒绝好友请求',
      directMessageNotice: '{friend} 发来了一条私聊消息。',
      userSearchPlaceholder: '用户名',
      currentBinding: '当前绑定',
      noBinding: '暂无绑定游戏名',
      playerName: '游戏名',
      playerNamePlaceholder: '输入游戏名',
      boundNotice: '游戏名已绑定',
      unboundNotice: '游戏名已解绑',
      highestPower: '最高战力',
      memberJoinedNotification: '队伍加入提醒',
      memberJoinedNotificationHint: '有人申请加入或加入当前队伍时播放提示音',
      memberJoinedNotificationTitle: '队伍有新成员',
      memberJoinedNotificationBody: '{member}加入了{team}',
      teamApplicationNotificationTitle: '队伍有新申请',
      teamApplicationNotificationBody: '{team}收到了新的入队申请',
      enableDesktopNotifications: '开启桌面通知',
      disableDesktopNotifications: '关闭桌面通知',
      desktopNotificationsDenied: '浏览器已拒绝桌面通知权限',
      soundPermissionTitle: '暂无声音权限',
      soundPermissionDescription: '请点击授权声音，允许网页播放队伍提示音。',
      soundPermissionUnsupported: '当前浏览器不支持网页提示音。',
      authorizeSound: '授权声音',
      reply: '回复',
      replyTo: '回复 {name}',
      replyUnknown: '已删除消息',
      replyUnavailable: '原消息不可用',
    },
    admin_react: {
      title: '后台',
      subtitle: '用户、队伍、消息和申请概览。',
      users: '用户',
      teams: '队伍',
      activeTeams: '活跃队伍',
      pending: '待审',
      bindings: '绑定',
      online: '在线',
      messages: '消息',
      applications: '申请',
      endTeam: '结束队伍',
      ended: '已结束',
    },
    help_react: {
      title: '帮助',
      subtitle: '常用操作入口集中在大厅顶部标签。',
      lobbyTitle: '队伍大厅',
      lobbyText: '登录后可以创建、加入、退出队伍；另一个浏览器窗口会通过 websocket 自动刷新队伍列表和个人队伍状态。',
      friendsTitle: '好友',
      friendsText: '好友请求、接受、拒绝、删除都会触发双方列表刷新。在线人数显示在顶部导航。',
      leaderboardTitle: '排行榜',
      leaderboardText: '排行榜来自采集端上传数据，整数型分数会按整数显示。',
    },
    about_react: {
      subtitle: '队伍、好友、聊天、游戏名绑定和排行榜的云端面板。',
      body: '当前前端已迁移到 React，后端仍保持原有 API 和 websocket 事件契约。',
    },
  },
  en: {
    market: {
      nav: 'Market', communityMarket: 'TroveBBS C2C', title: 'Player Marketplace', subtitle: 'Browse seller listings, start a private chat, and read buyer feedback.', sellerCenter: 'Sell on the market', buy: 'Browse offers', sell: 'Sell an item', modeSwitch: 'Market view', browseByCategory: 'Browse categories', categoryNav: 'Product categories', categoryNavHint: '6 categories',
      categories: { flux: 'Flux', items: 'Items', boosting: 'Boosting', accounts: 'Accounts', codes: 'Codes', official: 'Official services' }, categoryDescriptions: { flux: 'Choose available Flux by platform and server', items: 'Equipment, mounts, allies, and collectibles', boosting: 'Delves, Leviathans, weekly runs, and help', accounts: 'Account assets and protected delivery', codes: 'Live inventory and redeemable codes', official: 'TroveBBS-owned services and products' },
      platform: 'Platform', server: 'Server', allPlatforms: 'All platforms', searchPlaceholder: 'Search seller, listing, or server', sellerReputation: 'Seller reputation', verifiedSeller: 'Verified seller', official: 'Official', online: 'Online', offline: 'Offline', completedOrders: '{count} buyer reviews', response: '{time} response', contactSeller: 'Contact seller', listingCount: '{count} personal seller listings', sortRecommended: 'Sorted by buyer feedback and recent publishing', contactDemoNotice: 'This will open on-platform chat with {seller}. Chat is not connected in this design preview.', emptyTitle: 'No matching listings', emptyText: 'Clear filters or try another category.', clearFilters: 'Clear filters',
      dishonestyList: 'Dishonesty list', dishonestySubtitle: 'Submit verifiable trade misconduct evidence and search reviewed records.', dishonestyGuide: 'Only administrator-approved records are listed. Verify the evidence carefully before taking action.', dishonestySubmitTitle: 'Submit a dishonesty report', dishonestySubmitHint: 'Administrators review every submission before it is publicly listed.', dishonestyQq: 'QQ', dishonestyPlayerName: 'Player name', dishonestyQqPlaceholder: 'Optional, provide at least one identifier', dishonestyPlayerNamePlaceholder: 'Optional, provide at least one identifier', dishonestyReason: 'Reason', dishonestyReasonPlaceholder: 'Describe the trade and the misconduct truthfully.', dishonestyEvidence: 'Evidence images', dishonestyEvidenceLimit: 'You can upload up to 4 evidence images.', dishonestyIdentifierRequired: 'Provide a QQ number or player name.', dishonestyEvidenceRequired: 'Upload at least one evidence image.', dishonestyEvidenceSelected: '{count} evidence images selected', dishonestySubmit: 'Submit for review', dishonestySubmitted: 'Submitted and awaiting administrator review.', dishonestyLoginTitle: 'Sign in to submit a dishonesty report', dishonestyLoginText: 'Sign in with QQ so submitted reports remain traceable.', dishonestyPublicRecords: 'Approved records', dishonestyPublicRecordsHint: 'Search by QQ number or player name.', dishonestySearchPlaceholder: 'Search QQ number or player name', dishonestyApprovedAt: 'Approved', dishonestyEmpty: 'No matching dishonesty records', dishonestyEmptyHint: 'Try a different keyword.', dishonestyPage: 'Page {page} / {total}', listingPage: 'Page {page} / {total}', adminDishonestyTitle: 'Dishonesty report review', adminDishonestyHint: 'Approve only submissions with complete evidence and clear information. Approved records are visible publicly.', adminDishonestySearch: 'Search QQ, player name, or reason', adminDishonestyStatus: 'Review status', adminDishonestyPending: 'Pending', adminDishonestyApproved: 'Approved', adminDishonestyRejected: 'Rejected', adminDishonestyReporter: 'Reporter', adminDishonestyReviewer: 'Reviewer', adminDishonestyApprove: 'Approve report', adminDishonestyReject: 'Reject report', adminDishonestyEmpty: 'No matching dishonesty reports.',
      tradeSafely: 'Personal trade reminder', tradeSafelyText: 'Buyer and seller arrange the trade privately. Confirm listing details before proceeding.', keepOnPlatform: 'Keep a record here', keepOnPlatformText: 'Use the on-platform chat to retain communication records, then leave feedback after the trade.', tradeWithProof: 'Trade protection', tradeWithProofText: 'Use Xianyu for the trade when possible and keep a video record.', officialService: 'Official services', officialServiceText: 'Listings with the official label are provided by TroveBBS directly.', publishTitle: 'Publish your listing', publishSubtitle: 'Clear information builds seller trust and helps buyers understand delivery.', publishFlow: 'Publishing flow', stepDetails: 'Listing details', stepReview: 'Platform review', stepLive: 'Live listing', chooseCategory: 'Choose a category', chooseCategoryHint: 'Each category displays the relevant delivery fields.', listingDetails: 'Listing details', listingDetailsHint: 'Buyers use this information to select a seller.', listingTitle: 'Listing title', listingTitlePlaceholder: 'Example: PC NA Flux in stock, delivery within 5 minutes', unitPrice: 'Unit price (CNY)', stock: 'Stock / available amount', stockPlaceholder: 'Example: 50 million Flux', availableTime: 'Available time', availableTimePlaceholder: 'Example: Daily 19:00-24:00', accountDetails: 'Account and delivery details', codeDetails: 'Code and delivery details', deliveryMethod: 'Delivery method', deliveryPlaceholder: 'Describe delivery location, contact time, and notes', boostingDetailsPlaceholder: 'Describe service scope, expected duration, and buyer requirements', publishRule: 'Listings enter review after submission. Do not publish off-platform solicitation, false listings, or prohibited content.', saveDraft: 'Save draft', publishListing: 'Submit for review', publishDemoNotice: 'Submission simulated. The production version will connect the listing API here.',
    },
    language: {
      switch: 'Switch language',
      zh: '中文',
      en: 'EN',
    },
    app: {
      homeAria: 'TroveBBS Home',
      brandSubtitle: 'Team Lobby',
      lobby: 'Lobby',
      admin: 'Admin',
      onlineUsers: 'Online users',
    },
    marketSeller: {
      loginRequiredTitle: 'Sign in to start selling', loginRequiredText: 'Sign in with QQ to create, edit, and manage your C2C listings.', loginButton: 'Sign in with QQ',
      categoryNavHint: '5 C2C categories', searchPlaceholder: 'Search sellers or listings', categoryDescriptions: { flux: 'PC Flux stock and trade services', items: 'Equipment, mounts, allies, and collectibles', boosting: 'Delves, Leviathans, weekly runs, and help', accounts: 'Account assets and secure delivery details', codes: 'Live inventory and redeemable codes' },
      priceUnit: 'Price unit', priceUnitPlaceholder: 'Example: 1M Flux', description: 'Listing description', descriptionPlaceholder: 'Add item details, trade requirements, or notes',
      publishRule: 'Active listings appear on the market immediately. Do not post off-platform solicitation, false listings, or prohibited content.', publishNow: 'Publish now', saveChanges: 'Save changes', cancelEdit: 'Cancel edit',
      listingPublished: 'Listing is live and synced to the market.', draftSaved: 'Draft saved. Only you can see it.', listingUnlisted: 'Listing is unlisted and hidden from buyers.',
      myListings: 'My listings', myListingsHint: 'Manage your live listings and drafts.', noListings: 'No listings yet', noListingsHint: 'Create a listing above to manage it here.',
      listed: 'Listed', draft: 'Draft', edit: 'Edit listing', list: 'List', unlist: 'Unlist', editTitle: 'Edit your listing',
      contactPending: 'You selected {seller}\'s listing. On-platform orders and direct messages will be added in a later release.',
    },
    marketC2C: {
      ownListingConversationForbidden: 'You cannot open a conversation for your own listing.',
      myChats: 'My chats', myChatsHint: 'Only the buyer and seller can see these trade conversations.', loginToChatTitle: 'Sign in to view trade chats', loginToChatText: 'Sign in with QQ to message sellers, receive buyer messages, and leave trade feedback.',
      noChats: 'No trade chats yet.', noMessages: 'No messages yet', selectChat: 'Choose a chat on the left, or contact a seller from the listings.', startConversation: 'Send a message to start this trade conversation.', messagePlaceholder: 'Write a trade-related message...', send: 'Send', you: 'You',
      sellerReviews: '{seller}\'s buyer feedback', viewReviews: 'View feedback', reviewHint: 'Feedback is submitted by buyers who started an on-platform conversation.', noReviews: 'No buyer feedback yet.', reviewImage: 'Buyer feedback image',
      leaveReview: 'Leave feedback', reviewComposerHint: 'Please leave honest feedback after the trade is complete.', rating: 'Buyer rating', starRating: '{rating} star rating', ratingOutOfFive: '{rating} / 5', noRating: 'No ratings', remainingStock: 'Stock remaining: {stock}', fluxStock: 'Stock {stock} million', details: 'Details', collapse: 'Collapse', unitPrice: 'Unit price', pricePerMillion: 'Unit price (million)', million: 'million', millionFlux: 'million Flux', sortedByPrice: 'Sorted by price: low to high', sortedByNewest: 'Sorted by most recently published', listingTitlePlaceholder: 'Example: NA Flux in stock, delivery within 5 minutes', reviewMessage: 'Buyer message', reviewPlaceholder: 'Describe the communication and delivery for this trade.', addReviewImages: 'Add feedback images', imageLimit: 'You can upload up to 4 images.', imageSelected: '{count} images selected', submitReview: 'Submit feedback',
    },
    adminConsole: {
      navigation: 'Administration', overview: 'Overview', users: 'User management', operations: 'Operations', settings: 'Integrations', market: 'Listing pins', data: 'Data maintenance',
      overviewHint: 'Review the current service health and community data.', brandSubtitle: 'Admin console', backToSite: 'Back to site',
    },
    common: {
      account: 'Account',
      optional: 'Optional',
      processing: 'Processing',
      no_data: 'No data',
      no_match: 'No matching results',
      online: 'Online',
      offline: 'Offline',
      pending: 'Pending',
      normal_user: 'User',
      approve: 'Approve',
      reject: 'Reject',
    },
    leaderboard: {
      title: 'Leaderboard',
      all: 'All',
      mastery: 'Mastery',
      stats: 'Stats',
      paragon: 'Paragon Level',
      power: 'Power Rank',
      delve: 'Delve',
      classActivity: 'Class Activity',
      weekly: 'Weekly Contest',
      other: 'Other',
      searchPlaceholder: 'Search ID, board, or player',
      rowCount: '{count} rows',
      noMatch: 'No matching leaderboards',
      noBoard: 'No leaderboards',
      waitingUpload: 'Waiting for collector uploads',
      rank: 'Rank',
      player: 'Player',
      value: 'Value',
      previousPage: 'Previous page',
      nextPage: 'Next page',
    },
    team_react: {
      title: 'Team Lobby',
      realtimeSummary: 'Teams, friends, chat, and game name binding now refresh in real time.',
      onlineMetric: 'Online',
      teamsMetric: 'Teams',
      typesMetric: 'Types',
      loggedIn: 'Signed in',
      usernameOrEmail: 'Username or email',
      usernameHint: '3-20 letters or numbers',
      passwordHint: 'At least 6 characters',
      teamStateLogin: 'Sign in to see your team status.',
      noJoinedTeam: 'You are not in a team.',
      tabsTeams: 'Teams',
      tabsChat: 'Chat',
      tabsFriends: 'Friends',
      tabsBinding: 'Binding',
      teamNameShort: 'Team name',
      teamNamePlaceholder: 'Enter team name',
      typeShort: 'Type',
      noPowerRequirement: 'No power requirement',
      captain: 'Leader',
      pendingReview: 'Pending Review',
      pendingReviewHint: 'Approve or reject each request to join your team.',
      newApplicationNotice: 'New request to join {team}. Review it when ready.',
      approveNotice: 'Application approved',
      rejectNotice: 'Application rejected',
      createdNotice: 'Team created',
      joinedNotice: 'Joined team',
      leftNotice: 'Left team',
      chatPlaceholder: 'Enter chat message',
      loginFirst: 'Please sign in first',
      friendDeleted: 'Friend removed',
      friendAccepted: 'Friend request accepted',
      friendRejected: 'Friend request rejected',
      directMessageNotice: '{friend} sent you a private message.',
      userSearchPlaceholder: 'Username',
      currentBinding: 'Current Binding',
      noBinding: 'No bound game name',
      playerName: 'Game name',
      playerNamePlaceholder: 'Enter game name',
      boundNotice: 'Game name bound',
      unboundNotice: 'Game name unbound',
      highestPower: 'Highest Power',
      memberJoinedNotification: 'Team join alerts',
      memberJoinedNotificationHint: 'Play a sound when someone applies to or joins your current team.',
      memberJoinedNotificationTitle: 'New team member',
      memberJoinedNotificationBody: '{member} joined {team}',
      teamApplicationNotificationTitle: 'New team application',
      teamApplicationNotificationBody: '{team} has a new request to join',
      enableDesktopNotifications: 'Enable desktop notifications',
      disableDesktopNotifications: 'Disable desktop notifications',
      desktopNotificationsDenied: 'Browser desktop notifications are blocked',
      soundPermissionTitle: 'Sound permission required',
      soundPermissionDescription: 'Click Authorize sound to allow team alert sounds on this page.',
      soundPermissionUnsupported: 'This browser does not support webpage alert sounds.',
      authorizeSound: 'Authorize sound',
    },
    admin_react: {
      title: 'Admin',
      subtitle: 'Overview of users, teams, messages, and applications.',
      users: 'Users',
      teams: 'Teams',
      activeTeams: 'Active Teams',
      pending: 'Pending',
      bindings: 'Bindings',
      online: 'Online',
      messages: 'Messages',
      applications: 'Applications',
      endTeam: 'End team',
      ended: 'Ended',
    },
    help_react: {
      title: 'Help',
      subtitle: 'Common actions are grouped in the lobby tabs.',
      lobbyTitle: 'Team Lobby',
      lobbyText: 'After signing in, you can create, join, and leave teams. Other browser windows refresh team lists and your team state through websocket events.',
      friendsTitle: 'Friends',
      friendsText: 'Friend requests, accepts, rejects, and removals refresh both sides. Online users are shown in the top navigation.',
      leaderboardTitle: 'Leaderboard',
      leaderboardText: 'Leaderboard data comes from collector uploads. Integer scores are displayed as integers.',
    },
    about_react: {
      subtitle: 'Cloud panel for teams, friends, chat, game name binding, and leaderboards.',
      body: 'The frontend has been migrated to React while the backend keeps the existing API and websocket event contract.',
    },
  },
}

const uiMessages: Record<Locale, MessageTree> = {
  zh: {
    nav: {
      home: '\u9996\u9875',
      leaderboard: '\u6392\u884c\u699c',
    },
    language: {
      switch: '\u5207\u6362\u8bed\u8a00',
      zh: '\u4e2d\u6587',
      en: 'EN',
    },
    app: {
      homeAria: 'TroveBBS \u9996\u9875',
      brandSubtitle: '\u961f\u4f0d\u5927\u5385',
      lobby: '\u5927\u5385',
      admin: '\u540e\u53f0',
      onlineUsers: '\u5f53\u524d\u5728\u7ebf\u7528\u6237\u6570',
    },
    common: {
      account: '\u8d26\u53f7',
      optional: '\u53ef\u9009',
      processing: '\u5904\u7406\u4e2d',
      no_data: '\u6682\u65e0\u6570\u636e',
      no_match: '\u6682\u65e0\u5339\u914d\u7ed3\u679c',
      online: '\u5728\u7ebf',
      away: '\u79bb\u5f00',
      offline: '\u79bb\u7ebf',
      pending: '\u5f85\u5ba1',
      normal_user: '\u666e\u901a\u7528\u6237',
      approve: '\u540c\u610f',
      reject: '\u62d2\u7edd',
      bind: '\u7ed1\u5b9a',
      unbind: '\u89e3\u7ed1',
      refresh: '\u5237\u65b0',
      loading: '\u52a0\u8f7d\u4e2d...',
      search: '\u641c\u7d22',
      send: '\u53d1\u9001',
      delete: '\u5220\u9664',
    },
    auth: {
      login: '\u767b\u5f55',
      logout: '\u9000\u51fa',
      register: '\u6ce8\u518c',
      username: '\u7528\u6237\u540d',
      password: '\u5bc6\u7801',
      email: '\u90ae\u7bb1',
      qqLogin: 'QQ \u767b\u5f55',
      qqLoginButton: '\u4f7f\u7528 QQ \u767b\u5f55',
      qqLoginHint: '\u4f7f\u7528 QQ \u6388\u6743\u8fdb\u5165\u961f\u4f0d\u5927\u5385\uff0c\u7ad9\u5185\u8d26\u53f7\u5165\u53e3\u5df2\u5173\u95ed\u3002',
    },
    team: {
      create_team: '\u521b\u5efa\u961f\u4f0d',
      team_status: '\u961f\u4f0d\u72b6\u6001',
      team_list: '\u961f\u4f0d\u5217\u8868',
      all_types: '\u5168\u90e8\u7c7b\u578b',
      no_teams: '\u6682\u65e0\u961f\u4f0d',
      join: '\u52a0\u5165',
      leave: '\u9000\u51fa',
      create: '\u521b\u5efa',
      leader: '\u961f\u957f',
      member: '\u6210\u5458',
      max_members: '\u6700\u5927\u6210\u5458',
      min_combat_power: '\u6700\u4f4e\u6218\u529b',
      select_team_type_placeholder: '\u9009\u62e9\u7c7b\u578b',
      player_status: '\u73a9\u5bb6',
    },
    friends: {
      no_friends: '\u6682\u65e0\u597d\u53cb',
      friend_requests: '\u597d\u53cb\u8bf7\u6c42',
      no_requests: '\u6682\u65e0\u8bf7\u6c42',
      remove_friend: '\u5220\u9664\u597d\u53cb',
      accept_request: '\u63a5\u53d7\u8bf7\u6c42',
      reject_request: '\u62d2\u7edd\u8bf7\u6c42',
      search_users: '\u641c\u7d22\u7528\u6237',
      add_friend: '\u6dfb\u52a0\u597d\u53cb',
      request_sent: '\u597d\u53cb\u8bf7\u6c42\u5df2\u53d1\u9001',
    },
    teamLobby: {
      gameBinding: '\u89d2\u8272\u7ed1\u5b9a',
    },
    leaderboard: {
      title: '\u6392\u884c\u699c',
      all: '\u5168\u90e8',
      mastery: '\u4e13\u7cbe\u70b9',
      stats: '\u5c5e\u6027',
      paragon: '\u5dc5\u5cf0\u7b49\u7ea7',
      power: '\u6218\u6597\u529b',
      delve: '\u79d8\u5883',
      classActivity: '\u804c\u4e1a\u6d3b\u8dc3\u5ea6',
      weekly: '\u6bcf\u5468\u7ade\u8d5b',
      other: '\u5176\u4ed6',
      searchPlaceholder: '\u641c\u7d22 ID\u3001\u6392\u884c\u699c\u6216\u73a9\u5bb6',
      rowCount: '{count} \u884c',
      noMatch: '\u6682\u65e0\u5339\u914d\u6392\u884c\u699c',
      noBoard: '\u6682\u65e0\u6392\u884c\u699c',
      waitingUpload: '\u7b49\u5f85\u91c7\u96c6\u7aef\u4e0a\u4f20\u6570\u636e',
      rank: '\u6392\u540d',
      player: '\u73a9\u5bb6',
      value: '\u6570\u503c',
      previousPage: '\u4e0a\u4e00\u9875',
      nextPage: '\u4e0b\u4e00\u9875',
    },
    activity: {
      title: '\u6d3b\u52a8',
      subtitle: '\u6e38\u620f\u5185\u52a0\u6210\u548c\u65e5\u7a0b\u8f6e\u6362',
      source: 'BetterTroveTools',
      serverTime: '\u670d\u52a1\u5668\u65f6\u95f4',
      daily: '\u6bcf\u65e5',
      weekly: '\u6bcf\u5468',
      free: '\u514d\u8d39',
      patron: 'VIP\u4f1a\u5458',
      effects: '\u6548\u679c',
      schedule: '\u65e5\u7a0b',
    },
    announcements: {
      title: '\u6700\u65b0\u8d44\u8baf',
      all: '\u5168\u90e8',
      gameAnnouncements: '\u6e38\u620f\u516c\u544a',
      gameUpdates: '\u7248\u672c\u66f4\u65b0',
      sales: '\u4fc3\u9500\u6d3b\u52a8',
      pts: 'PTS \u6d4b\u8bd5',
      subtitle: '\u6765\u81ea TrovePal \u516c\u544a\u9891\u9053\u7684\u4e00\u624b\u4fe1\u606f',
      empty: '\u6682\u65e0 TrovePal \u516c\u544a',
      notConfigured: 'TrovePal \u516c\u544a API \u672a\u914d\u7f6e',
      richContent: '\u5305\u542b\u5d4c\u5165\u5185\u5bb9\u6216\u9644\u4ef6\uff0c\u70b9\u51fb\u67e5\u770b\u539f\u516c\u544a\u3002',
    },
    team_react: {
      title: '\u961f\u4f0d\u5927\u5385',
      realtimeSummary: '\u961f\u4f0d\u3001\u597d\u53cb\u3001\u804a\u5929\u548c\u6e38\u620f\u540d\u7ed1\u5b9a\u5df2\u63a5\u5165\u5b9e\u65f6\u5237\u65b0\u3002',
      onlineMetric: '\u5728\u7ebf',
      teamsMetric: '\u961f\u4f0d',
      typesMetric: '\u7c7b\u578b',
      loggedIn: '\u5df2\u767b\u5f55',
      usernameOrEmail: '\u7528\u6237\u540d\u6216\u90ae\u7bb1',
      usernameHint: '3-20 \u4f4d\u5b57\u6bcd\u6570\u5b57',
      passwordHint: '\u81f3\u5c11 6 \u4f4d',
      teamStateLogin: '\u767b\u5f55\u540e\u663e\u793a\u4f60\u6240\u5728\u7684\u961f\u4f0d\u3002',
      noJoinedTeam: '\u5f53\u524d\u672a\u52a0\u5165\u961f\u4f0d\u3002',
      tabsTeams: '\u961f\u4f0d',
      tabsFriends: '\u597d\u53cb',
      tabsSocial: '\u804a\u5929 / \u597d\u53cb',
      currentChannel: '\u5f53\u524d\u804a\u5929\u9891\u9053',
      channelOnlineUsers: '\u5f53\u524d\u5728\u7ebf {count} \u4eba',
      channelMembers: '\u5728\u7ebf\u7528\u6237',
      noOnlineMembers: '\u6682\u65e0\u5728\u7ebf\u7528\u6237',
      alreadyInTeamCreate: '\u5df2\u8fdb\u5165\u961f\u4f0d\uff0c\u4e0d\u80fd\u518d\u521b\u5efa\u65b0\u961f\u4f0d\u3002',
      teamNameShort: '\u961f\u4f0d\u540d',
      teamNamePlaceholder: '\u8f93\u5165\u961f\u4f0d\u540d',
      typeShort: '\u7c7b\u578b',
      noPowerRequirement: '\u65e0\u6218\u529b\u8981\u6c42',
      captain: '\u961f\u957f',
      pendingReview: '\u5f85\u5ba1\u6838',
      pendingReviewHint: '\u8bf7\u9009\u62e9\u540c\u610f\u6216\u62d2\u7edd\u5904\u7406\u5165\u961f\u7533\u8bf7\u3002',
      newApplicationNotice: '\u961f\u4f0d\u300c{team}\u300d\u6709\u65b0\u7684\u5165\u961f\u7533\u8bf7\uff0c\u8bf7\u53ca\u65f6\u5904\u7406\u3002',
      applicationRejectedNotice: '\u961f\u4f0d\u300c{team}\u300d\u62d2\u7edd\u4e86\u4f60\u7684\u5165\u961f\u7533\u8bf7\u3002',
      applicationAlreadySubmitted: '\u4f60\u5df2\u7ecf\u63d0\u4ea4\u8fc7\u5165\u961f\u7533\u8bf7\uff0c\u8bf7\u7b49\u5f85\u961f\u957f\u5ba1\u6838\u3002',
      approveNotice: '\u7533\u8bf7\u5df2\u540c\u610f',
      rejectNotice: '\u7533\u8bf7\u5df2\u62d2\u7edd',
      createdNotice: '\u961f\u4f0d\u5df2\u521b\u5efa',
      joinedNotice: '\u5df2\u52a0\u5165\u961f\u4f0d',
      leftNotice: '\u5df2\u9000\u51fa\u961f\u4f0d',
      chatPlaceholder: '\u8f93\u5165\u804a\u5929\u5185\u5bb9',
      loginFirst: '\u8bf7\u5148\u767b\u5f55',
      friendDeleted: '\u597d\u53cb\u5df2\u5220\u9664',
      friendAccepted: '\u5df2\u63a5\u53d7\u597d\u53cb\u8bf7\u6c42',
      friendRejected: '\u5df2\u62d2\u7edd\u597d\u53cb\u8bf7\u6c42',
      userSearchPlaceholder: '\u7528\u6237\u540d',
      noBinding: '\u6682\u65e0\u7ed1\u5b9a\u6e38\u620f\u540d',
      playerName: '\u6e38\u620f\u540d',
      playerNamePlaceholder: '\u8f93\u5165\u6e38\u620f\u540d',
      boundNotice: '\u6e38\u620f\u540d\u5df2\u7ed1\u5b9a',
      unboundNotice: '\u6e38\u620f\u540d\u5df2\u89e3\u7ed1',
      unbindRole: '\u89e3\u7ed1\u6e38\u620f\u540d',
      gameNameBindingRequired: '\u8bf7\u5148\u7ed1\u5b9a\u6e38\u620f\u540d',
      noGameNameBinding: '\u672a\u7ed1\u5b9a\u6e38\u620f\u540d',
      inviteMember: '\u9080\u8bf7\u6307\u4ee4',
      inviteCopied: '\u590d\u5236\u6210\u529f\uff0c\u8bf7\u5728\u6e38\u620f\u5185\u7c98\u8d34\u6307\u4ee4\u5373\u53ef\u9080\u8bf7',
      copyInviteFailed: '\u590d\u5236\u9080\u8bf7\u6307\u4ee4\u5931\u8d25',
    },
    marketC2C: {
      remainingStockLabel: '\u5269\u4f59\u5e93\u5b58',
    },
    admin_react: {
      title: '\u540e\u53f0',
      subtitle: '\u7528\u6237\u3001\u961f\u4f0d\u3001\u6570\u636e\u5e93\u548c\u6570\u636e\u6e05\u7406\u96c6\u4e2d\u7ba1\u7406\u3002',
      users: '\u7528\u6237',
      teams: '\u961f\u4f0d',
      activeTeams: '\u6d3b\u8dc3\u961f\u4f0d',
      pending: '\u5f85\u5ba1',
      bindings: '\u7ed1\u5b9a',
      online: '\u5728\u7ebf',
      messages: '\u6d88\u606f',
      applications: '\u7533\u8bf7',
      registeredUsers: '\u6ce8\u518c\u7528\u6237',
      operations: '\u8fd0\u8425\u6570\u636e',
      cleanup: '\u6309\u65f6\u95f4\u6e05\u7406',
      fromTime: '\u5f00\u59cb\u65f6\u95f4',
      toTime: '\u7ed3\u675f\u65f6\u95f4',
      cleanupButton: '\u4e00\u952e\u5220\u9664\u8303\u56f4\u5185\u6570\u636e',
      cleanupNote: '\u4e0d\u4f1a\u5220\u9664\u7ba1\u7406\u5458\u8d26\u53f7\u548c\u961f\u4f0d\u7c7b\u578b\u914d\u7f6e\u3002',
      database: '\u6570\u636e\u5e93',
      adminLogin: '\u7ba1\u7406\u5458\u767b\u5f55',
      loginPrompt: '\u8bf7\u8f93\u5165\u7ba1\u7406\u5458\u8d26\u53f7\u8fdb\u5165\u540e\u53f0\u3002',
      adminOnly: '\u5f53\u524d\u8d26\u53f7\u4e0d\u662f\u7ba1\u7406\u5458\uff0c\u8bf7\u5207\u6362\u7ba1\u7406\u5458\u8d26\u53f7\u3002',
    },
    about_react: {
      subtitle: '\u961f\u4f0d\u3001\u597d\u53cb\u3001\u804a\u5929\u3001\u89d2\u8272\u7ed1\u5b9a\u548c\u6392\u884c\u699c\u7684\u4e91\u7aef\u9762\u677f\u3002',
      body: '\u5f53\u524d\u524d\u7aef\u5df2\u8fc1\u79fb\u5230 React\uff0c\u540e\u7aef\u4fdd\u7559\u539f\u6709 API \u548c websocket \u4e8b\u4ef6\u5951\u7ea6\u3002',
    },
  },
  en: {
    common: {
      away: 'Away',
    },
    leaderboard: {
      delve: 'Delve',
      classActivity: 'Class Activity',
    },
    activity: {
      title: 'Activity',
      subtitle: 'In-game bonuses and schedule rotations',
      source: 'BetterTroveTools',
      serverTime: 'Server time',
      daily: 'Daily',
      weekly: 'Weekly',
      free: 'Free',
      patron: 'Patron',
      effects: 'Effects',
      schedule: 'Schedule',
    },
    announcements: {
      title: 'Latest News',
      all: 'All',
      gameAnnouncements: 'Game Announcements',
      gameUpdates: 'Game Updates',
      sales: 'Sales',
      pts: 'PTS Testing',
      subtitle: 'First-hand updates from TrovePal announcement channels',
      empty: 'No TrovePal announcements yet',
      notConfigured: 'TrovePal announcement API is not configured',
      richContent: 'This post contains embeds or attachments. Open the original announcement.',
    },
    auth: {
      qqLogin: 'QQ Login',
      qqLoginButton: 'Continue with QQ',
      qqLoginHint: 'Use QQ authorization to enter the lobby. The local account entry is closed.',
    },
    team_react: {
      tabsSocial: 'Chat / Friends',
      currentChannel: 'Current Channel',
      channelOnlineUsers: '{count} online',
      channelMembers: 'Online users',
      noOnlineMembers: 'No users are online',
      alreadyInTeamCreate: 'You are already in a team and cannot create another one.',
      applicationRejectedNotice: 'Your request to join {team} was rejected.',
      applicationAlreadySubmitted: 'You already submitted a request to join this team. Please wait for the leader to review it.',
      noBinding: 'No bound game name',
      playerName: 'Game name',
      playerNamePlaceholder: 'Enter game name',
      boundNotice: 'Game name bound',
      unboundNotice: 'Game name unbound',
      unbindRole: 'Unbind game name',
      gameNameBindingRequired: 'Bind a game name first',
      noGameNameBinding: 'No game name bound',
      inviteMember: 'Invite command',
      inviteCopied: 'Copied. Paste the command in game to invite this player.',
      copyInviteFailed: 'Could not copy the invite command',
    },
    marketC2C: {
      remainingStockLabel: 'Remaining stock',
    },
    admin_react: {
      subtitle: 'Manage users, teams, database rows, and timed data cleanup.',
      registeredUsers: 'Registered Users',
      operations: 'Operations',
      cleanup: 'Timed Cleanup',
      fromTime: 'From',
      toTime: 'To',
      cleanupButton: 'Delete Data in Range',
      cleanupNote: 'Admin accounts and team type config are not deleted.',
      database: 'Database',
      adminLogin: 'Admin Login',
      loginPrompt: 'Sign in with an admin account to enter the dashboard.',
      adminOnly: 'The current account is not an admin. Sign in with an admin account.',
    },
  },
}

const dictionaries: Record<Locale, MessageTree> = {
  zh: mergeMessages(mergeMessages(zhBase as MessageTree, extraMessages.zh), uiMessages.zh),
  en: mergeMessages(mergeMessages(enBase as MessageTree, extraMessages.en), uiMessages.en),
}

export const supportedLocales: { code: Locale; name: string }[] = [
  { code: 'zh', name: '\u4e2d\u6587' },
  { code: 'en', name: 'EN' },
]

export function getDefaultLocale(): Locale {
  if (typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('en')) {
    return 'en'
  }
  return 'zh'
}

export function getStoredLocale(): Locale {
  const urlLocale = getUrlLocale()
  if (urlLocale) {
    persistLocale(urlLocale)
    return urlLocale
  }
  if (activeLocale) return activeLocale
  if (typeof localStorage === 'undefined') return getDefaultLocale()
  let stored: string | null = null
  try {
    stored = localStorage.getItem('locale') || localStorage.getItem('language')
  } catch {
    return getDefaultLocale()
  }
  return normalizeLocale(stored) ?? getDefaultLocale()
}

export function persistLocale(locale: Locale) {
  activeLocale = locale
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem('locale', locale)
      localStorage.setItem('language', locale)
    } catch {
      // Language switching should still work for the current tab if storage is blocked.
    }
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en'
  }
}

export function getIntlLocale(locale: Locale = getStoredLocale()) {
  return locale === 'zh' ? 'zh-CN' : 'en-US'
}

export function translate(locale: Locale, key: string, params?: TranslationParams, fallback?: string) {
  const value = getMessage(dictionaries[locale], key) ?? getMessage(dictionaries.zh, key) ?? fallback ?? key
  if (typeof value !== 'string') return fallback ?? key
  return value.replace(/\{(\w+)\}/g, (match, name: string) => String(params?.[name] ?? match))
}

function getMessage(messages: MessageTree, key: string): unknown {
  return key.split('.').reduce<unknown>((current, part) => {
    if (!current || typeof current !== 'object') return undefined
    return (current as MessageTree)[part]
  }, messages)
}

function mergeMessages(base: MessageTree, extension: MessageTree): MessageTree {
  const output: MessageTree = { ...base }
  Object.entries(extension).forEach(([key, value]) => {
    const current = output[key]
    if (isPlainObject(current) && isPlainObject(value)) {
      output[key] = mergeMessages(current, value)
    } else {
      output[key] = value
    }
  })
  return output
}

function isPlainObject(value: unknown): value is MessageTree {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function getUrlLocale(): Locale | null {
  if (typeof window === 'undefined') return null
  try {
    return normalizeLocale(new URLSearchParams(window.location.search).get('lang'))
  } catch {
    return null
  }
}
