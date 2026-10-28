const assert = require('node:assert/strict');
const test = require('node:test');
const {
    QqTeamNotificationService,
    buildActiveTeamListMessages,
    buildLatestNewsMessage,
    buildMarketListingsMessage,
    buildPlayerProfileMessages,
    buildTeamCreatedMessage,
    isLatestNewsCommand,
    isMarketCommand,
    isMenuCommand,
    isPlayerInfoCommand,
    playerNameFromCommand,
    isTeamQueryCommand
} = require('../src/modules/lobby/qq-team-notification-service');

test('QQ team notification settings update the bot client credentials', () => {
    let credentials = null;
    const service = new QqTeamNotificationService({
        client: {
            setCredentials: (value) => { credentials = value; }
        }
    });

    service.configure({ app_id: '1234567890', app_secret: 'updated-secret' });

    assert.deepEqual(credentials, { appId: '1234567890', appSecret: 'updated-secret' });
});

test('team message uses the configured first-level lobby URL', () => {
    const content = buildTeamCreatedMessage({ name: 'Delve' }, 'https://example.com/lobby');

    assert.match(content, /https:\/\/example\.com\/lobby/);
});

test('QQ team query command accepts the configured interaction name', () => {
    assert.equal(isTeamQueryCommand({
        op: 0,
        t: 'INTERACTION_CREATE',
        d: { data: { name: '/查询团队' } }
    }), true);
    assert.equal(isTeamQueryCommand({ op: 0, t: 'INTERACTION_CREATE', d: { data: { name: '查询成员' } } }), false);
});

test('QQ team list command accepts the new name while retaining the legacy alias', () => {
    assert.equal(isTeamQueryCommand({
        op: 0,
        t: 'INTERACTION_CREATE',
        d: { data: { name: '/\u961f\u4f0d\u5217\u8868' } }
    }), true);
    assert.equal(isTeamQueryCommand({
        op: 0,
        t: 'GROUP_AT_MESSAGE_CREATE',
        d: { content: '/\u67e5\u8be2\u56e2\u961f' }
    }), true);
    assert.equal(isTeamQueryCommand({
        op: 0,
        t: 'GROUP_MESSAGE_CREATE',
        d: { content: '/\u961f\u4f0d\u5217\u8868' }
    }), true);
    assert.equal(isTeamQueryCommand({
        op: 0,
        t: 'C2C_MESSAGE_CREATE',
        d: { content: '/\u961f\u4f0d\u5217\u8868' }
    }), true);
});

test('QQ player info command reads player names from text and interaction options', () => {
    const textCommand = {
        op: 0,
        t: 'INTERACTION_CREATE',
        d: { data: { name: '/\u73a9\u5bb6\u4fe1\u606f Alice' } }
    };
    const optionCommand = {
        op: 0,
        t: 'INTERACTION_CREATE',
        d: { data: { name: '/\u73a9\u5bb6\u4fe1\u606f', options: [{ value: 'Bob' }] } }
    };

    assert.equal(isPlayerInfoCommand(textCommand), true);
    assert.equal(playerNameFromCommand(textCommand), 'Alice');
    assert.equal(playerNameFromCommand(optionCommand), 'Bob');
});

test('QQ menu, latest news, and marketplace command names are recognized', () => {
    assert.equal(isMenuCommand({ op: 0, t: 'INTERACTION_CREATE', d: { data: { name: '/菜单' } } }), true);
    assert.equal(isMenuCommand({ op: 0, t: 'C2C_MESSAGE_CREATE', d: { content: '/帮助' } }), true);
    assert.equal(isLatestNewsCommand({ op: 0, t: 'GROUP_MESSAGE_CREATE', d: { content: '/最新资讯' } }), true);
    assert.equal(isMarketCommand({ op: 0, t: 'GROUP_AT_MESSAGE_CREATE', d: { content: '/交易市场' } }), true);
    assert.equal(isMenuCommand({ op: 0, t: 'INTERACTION_CREATE', d: { data: { name: '/设置' } } }), false);
});

test('QQ menu response exposes the four requested command buttons', async () => {
    const sent = [];
    const service = new QqTeamNotificationService({
        appSecret: 'test-secret',
        client: {
            isConfigured: () => true,
            sendGroupMarkdown: async (groupOpenid, content, options) => sent.push({ groupOpenid, content, options })
        }
    });

    const handled = await service.replyWithMenu({ d: { group_openid: 'group-openid' } });

    assert.equal(handled, true);
    assert.equal(sent[0].groupOpenid, 'group-openid');
    assert.match(sent[0].content, /^## Game Hub 菜单/);
    assert.deepEqual(
        sent[0].options.keyboard.content.rows.flatMap((row) => row.buttons.map((button) => button.action.data)),
        ['/队伍列表', '/玩家信息', '/最新资讯', '/交易市场']
    );
});

test('QQ bot content config changes command matching, button payloads, and Markdown templates', async () => {
    const sent = [];
    const contentConfig = {
        commands: {
            team_list: '车队',
            player_info: '档案',
            latest_news: '新闻',
            market: '市集',
            menu: '指引',
            help: '帮助'
        },
        cards: {
            team_notification: '新队伍 {{team_name}}',
            team_list: 'LIST {{team_list_command}}\n{{body}}',
            player_info: 'PROFILE {{body}}',
            latest_news: 'NEWS {{body}}',
            market: 'MARKET {{body}}',
            menu: 'MENU {{team_list_command}} {{help_command}}'
        }
    };
    const service = new QqTeamNotificationService({
        appSecret: 'test-secret',
        contentConfig,
        teamLobbyUrl: 'https://example.com/lobby',
        lobbyQuery: {
            getTeams: async () => [{ name: 'Delve', team_type_name: 'Secret Realm', leader_name: 'Alice', current_members: 1, max_members: 5 }]
        },
        client: {
            isConfigured: () => true,
            sendGroupMarkdown: async (groupOpenid, content, options) => sent.push({ groupOpenid, content, options })
        }
    });

    const result = await service.handleEvent({
        op: 0,
        t: 'GROUP_AT_MESSAGE_CREATE',
        d: { group_openid: 'group-openid', content: '/车队' }
    });
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(result.commandHandled, true);
    assert.equal(sent.length, 1);
    assert.match(sent[0].content, /^LIST 车队/);
    assert.match(sent[0].content, /Delve/);
    assert.deepEqual(
        sent[0].options.keyboard.content.rows[0].buttons.map((button) => button.action.data),
        ['https://example.com/lobby', '/指引']
    );

    await service.replyWithMenu({ d: { group_openid: 'group-openid' } });
    assert.equal(sent[1].content, 'MENU 车队 帮助');
    assert.deepEqual(
        sent[1].options.keyboard.content.rows.flatMap((row) => row.buttons.map((button) => button.action.data)),
        ['/车队', '/档案', '/新闻', '/市集']
    );
});

test('QQ latest news and marketplace responses render localized content and market button', async () => {
    const sent = [];
    const receivedNewsQueries = [];
    const service = new QqTeamNotificationService({
        appSecret: 'test-secret',
        newsUrl: 'https://example.com/news',
        marketUrl: 'https://example.com/market',
        announcementQuery: async (query) => {
            receivedNewsQueries.push(query);
            return {
                items: [{
                    channel_name: 'announcements',
                    posted_at: '2026-07-20T12:00:00.000Z',
                    content: 'New Delve event is live.'
                }],
                pagination: { total: 1 }
            };
        },
        marketQuery: async () => [
            { category: 'boosting', title: 'Service', seller_name: 'Alice', price: 10, price_unit: 'each', stock: 'Available' },
            { category: 'flux', title: 'Flux bundle', seller_name: 'Bob', price: 1.2, price_unit: 'per_million', stock: '80' },
            { category: 'accounts', title: 'Account', seller_name: 'Carol', price: 15000, price_unit: 'each', stock: '' },
            { category: 'items', title: 'Item', seller_name: 'Dave', price: 10, price_unit: '个', stock: '5' },
            { category: 'codes', title: 'Code', seller_name: 'Eve', price: 33, price_unit: 'each', stock: '2' }
        ],
        client: {
            isConfigured: () => true,
            sendGroupMarkdown: async (groupOpenid, content, options) => sent.push({ groupOpenid, content, options })
        }
    });

    await service.replyWithLatestNews({ d: { group_openid: 'group-openid' } });
    await service.replyWithMarketListings({ d: { group_openid: 'group-openid' } });

    assert.deepEqual(receivedNewsQueries, [{ page: 1, pageSize: 5 }]);
    assert.match(sent[0].content, /New Delve event is live/);
    assert.match(sent[0].content, /https:\/\/example\.com\/news/);
    assert.match(sent[0].content, /公告 · 2026\/07\/20 20:00/);
    assert.doesNotMatch(sent[0].content, /announcements/);
    assert.match(sent[1].content, /Flux bundle/);
    assert.match(sent[1].content, /Alice/);
    assert.match(sent[1].content, /游戏货币：Flux bundle/);
    assert.match(sent[1].content, /道具：Item/);
    assert.match(sent[1].content, /代肝：Service/);
    assert.match(sent[1].content, /账号：Account/);
    assert.match(sent[1].content, /兑换码：Code/);
    assert.match(sent[1].content, /1\\\.2 CNY \/ 百万/);
    assert.match(sent[1].content, /10 CNY \/ 个/);
    assert.match(sent[1].content, /10 CNY \/ R/);
    assert.doesNotMatch(sent[1].content, /1\. \*\*/);
    assert.doesNotMatch(sent[1].content, /https:\/\/example\.com\/market/);
    assert.equal(sent[1].options.keyboard.content.rows.length, 3);
    assert.equal(sent[1].options.keyboard.content.rows[2].buttons[0].action.data, 'https://example.com/market');
    assert.ok(sent.every((message) => message.options.keyboard));
});

test('QQ news and marketplace card builders keep remote content bounded', () => {
    const news = buildLatestNewsMessage({
        items: [{ channel_name: 'announcements', posted_at: '2026-07-20T12:00:00.000Z', content: '*'.repeat(300) }]
    }, 'https://example.com/news');
    const market = buildMarketListingsMessage([{
        category: 'boosting', title: 'Item', seller_name: 'Seller', price: 0, price_unit: 'each', stock: '0'
    }]);

    assert.match(news, /\\\*/);
    assert.ok(news.length < 1_200);
    assert.match(news, /公告 · 2026\/07\/20 20:00/);
    assert.match(market, /价格：0 CNY \/ R/);
    assert.match(market, /库存：0/);
    assert.doesNotMatch(market, /1\. \*\*/);
});

test('QQ team query command sends every active team to the originating group', async () => {
    const sent = [];
    const service = new QqTeamNotificationService({
        appSecret: 'test-secret',
        teamLobbyUrl: 'https://example.com/lobby',
        lobbyQuery: {
            getTeams: async () => [
                { name: 'Delve', team_type_name: 'Secret Realm', leader_name: 'Alice', current_members: 1, max_members: 5, min_combat_power: 1234 },
                { name: 'Levi', team_type_name: 'Leviathan', leader_name: 'Bob', current_members: 2, max_members: 8, min_combat_power: 0 }
            ]
        },
        client: {
            isConfigured: () => true,
            sendGroupMarkdown: async (groupOpenid, content, options) => sent.push({ groupOpenid, content, options })
        }
    });

    const handled = await service.replyWithActiveTeams({ d: { group_openid: 'group-openid' } });

    assert.equal(handled, true);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].groupOpenid, 'group-openid');
    assert.match(sent[0].content, /Delve/);
    assert.match(sent[0].content, /Levi/);
    assert.doesNotMatch(sent[0].content, /https:\/\/example\.com\/lobby/);
    assert.deepEqual(
        sent[0].options.keyboard.content.rows[0].buttons.map((button) => button.action.data),
        ['https://example.com/lobby', '/菜单']
    );
});

test('QQ team query command replies to C2C messages using the sender OpenID and message ID', async () => {
    const sent = [];
    const service = new QqTeamNotificationService({
        appSecret: 'test-secret',
        lobbyQuery: {
            getTeams: async () => [{ name: 'Delve', team_type_name: 'Secret Realm', leader_name: 'Alice', current_members: 1, max_members: 5 }]
        },
        client: {
            isConfigured: () => true,
            sendC2cMarkdown: async (userOpenid, content, options) => sent.push({ userOpenid, content, options })
        }
    });

    const handled = await service.replyWithActiveTeams({
        op: 0,
        t: 'C2C_MESSAGE_CREATE',
        d: {
            id: 'incoming-message',
            author: { user_openid: 'user-openid' },
            content: '/\u961f\u4f0d\u5217\u8868'
        }
    });

    assert.equal(handled, true);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].userOpenid, 'user-openid');
    assert.equal(sent[0].options.msgId, 'incoming-message');
    assert.equal(sent[0].options.msgSeq, 1);
    assert.equal(sent[0].options.keyboard.content.rows[0].buttons.length, 2);
    assert.equal(sent[0].options.keyboard.content.rows[0].buttons[1].action.data, '/菜单');
    assert.match(sent[0].content, /Delve/);
});

test('QQ team query replies stay scoped to each originating group', async () => {
    const sent = [];
    const service = new QqTeamNotificationService({
        appSecret: 'test-secret',
        lobbyQuery: {
            getTeams: async () => [{ name: 'Delve', team_type_name: 'Secret Realm', leader_name: 'Alice', current_members: 1, max_members: 5 }]
        },
        client: {
            isConfigured: () => true,
            sendGroupMarkdown: async (groupOpenid, content, options) => sent.push({ groupOpenid, content, options })
        }
    });

    await service.replyWithActiveTeams({
        op: 0,
        t: 'GROUP_AT_MESSAGE_CREATE',
        d: { id: 'first-message', group_openid: 'first-group', content: '/\u961f\u4f0d\u5217\u8868' }
    });
    await service.replyWithActiveTeams({
        op: 0,
        t: 'GROUP_AT_MESSAGE_CREATE',
        d: { id: 'second-message', group_openid: 'second-group', content: '/\u961f\u4f0d\u5217\u8868' }
    });

    assert.deepEqual(sent.map((message) => message.groupOpenid), ['first-group', 'second-group']);
    assert.deepEqual(sent.map((message) => ({
        msgId: message.options.msgId,
        msgSeq: message.options.msgSeq
    })), [
        { msgId: 'first-message', msgSeq: 1 },
        { msgId: 'second-message', msgSeq: 1 }
    ]);
    assert.ok(sent.every((message) => message.options.keyboard));
});

test('QQ player info displays generic ranking names and values', async () => {
    const sent = [];
    const service = new QqTeamNotificationService({
        appSecret: 'test-secret',
        playerProfile: async () => ({ player: { display_name: 'Alice' }, items: [
            { leaderboard_name: 'Points', rank: 1, score: '1200' },
            { leaderboard_name: 'Wins', rank: 2, score: '25' }
        ] }),
        client: { isConfigured: () => true, sendGroupMarkdown: async (_group, content) => sent.push(content) }
    });
    assert.equal(await service.replyWithPlayerProfile({ d: { group_openid: 'group', data: { name: '/玩家信息 Alice' } } }), true);
    assert.match(sent.join('\n'), /Points/);
    assert.match(sent.join('\n'), /Wins/);
    assert.match(sent.join('\n'), /排名 1/);
});

test('QQ player info appends a noninteractive leaderboard refresh footer', async () => {
    const sent = [];
    const service = new QqTeamNotificationService({
        appSecret: 'test-secret',
        playerProfile: async () => ({
            player: { display_name: 'Alice' },
            items: [{ category_id: '4', leaderboard_name: 'Mastery', rank: 1, score: '1200' }]
        }),
        leaderboardVersion: async () => ({ updated_at: '2026-07-23T09:35:32.621Z' }),
        client: {
            isConfigured: () => true,
            sendGroupMarkdown: async (groupOpenid, content, options) => sent.push({ groupOpenid, content, options })
        }
    });

    await service.replyWithPlayerProfile({
        d: { group_openid: 'group-openid', data: { name: '/\u73a9\u5bb6\u4fe1\u606f Alice' } }
    });

    assert.match(sent[0].content, /> \u6392\u884c\u699c\u66f4\u65b0\u65f6\u95f4\uff1a2026\/07\/23 17:35$/);
    assert.equal(sent[0].options.keyboard.content.rows.length, 2);
});

test('QQ player profile output is split without omitting rankings', () => {
    const messages = buildPlayerProfileMessages({
        player: { display_name: 'Alice' },
        items: Array.from({ length: 80 }, (_, index) => ({
            category_id: '5',
            leaderboard_name: 'Board ' + (index + 1),
            rank: index + 1,
            score: String(index + 100)
        }))
    }, 'stats');

    assert.ok(messages.length > 1);
    assert.ok(messages.every((message) => message.length <= 850));
    assert.ok(messages.every((message) => !message.includes('###')));
    assert.match(messages.join('\n'), /Board 1/);
    assert.match(messages.join('\n'), /Board 80/);
});

test('QQ mastery profile separates normalized progress from its score', () => {
    const [message] = buildPlayerProfileMessages({
        player: { display_name: 'Alice' },
        items: [
            {
                category_id: '4',
                leaderboard_name: '宝藏世界专精点',
                score: '213646',
                rank: 27,
                mastery_level_text: 'Lv 909 (171/455)'
            },
            {
                category_id: '4',
                leaderboard_name: '总专精点数量',
                score: '228471',
                rank: 27,
                leaderboard_id: '100',
                leaderboard_key: '$Leaderboard_TotalMastery',
                mastery_level_text: 'Lv 1009 (171/455 + 5725/0)'
            },
            {
                category_id: '4',
                leaderboard_name: '晶洞世界专精点',
                score: '14825',
                rank: 1,
                mastery_level_text: 'Lv 100 (5725/0)'
            }
        ]
    });

    assert.match(message, /宝藏世界专精点：213,646\nLv 909 171\/455 · 排名 27/);
    assert.match(message, /总专精点数量：228,471\nLv 1009 171\/455 · 排名 27/);
    assert.match(message, /晶洞世界专精点：14,825\nLv 100 5725\/0 · 排名 1/);
    assert.doesNotMatch(message, /\(|\)|171\/455 \+ 5725\/0/);
});

test('QQ player info command reports players that are not indexed', async () => {
    const sent = [];
    const service = new QqTeamNotificationService({
        appSecret: 'test-secret',
        playerProfile: async () => {
            const error = new Error('player not found');
            error.statusCode = 404;
            throw error;
        },
        client: {
            isConfigured: () => true,
            sendGroupMarkdown: async (groupOpenid, content, options) => sent.push({ groupOpenid, content, options })
        }
    });

    const handled = await service.replyWithPlayerProfile({
        d: { group_openid: 'group-openid', data: { name: '/\u73a9\u5bb6\u4fe1\u606f Missing' } }
    });

    assert.equal(handled, true);
    assert.equal(sent.length, 1);
    assert.ok(sent[0].content.includes('Missing'));
});

test('team list output is split without omitting teams', () => {
    const teams = Array.from({ length: 40 }, (_, index) => ({
        name: `Team ${index + 1}`,
        team_type: 'mijing',
        leader_name: 'Leader',
        current_members: 1,
        max_members: 5
    }));
    const messages = buildActiveTeamListMessages(teams, 'https://example.com/lobby');

    assert.ok(messages.length > 1);
    assert.match(messages.join('\n'), /Team 1/);
    assert.match(messages.join('\n'), /Team 40/);
});

test('QQ group message event enables the group and queues future team messages', async () => {
    const events = [];
    const service = new QqTeamNotificationService({
        appSecret: 'test-secret',
        repository: {
            recordGroupEvent: async (groupOpenid, type) => {
                events.push(['group', groupOpenid, type]);
                return { group_openid: groupOpenid, proactive_messages_enabled: true };
            },
            claimPendingNotifications: async () => [],
            enqueueTeamCreated: async (team) => {
                events.push(['queue', team.id]);
                return 1;
            }
        },
        client: { isConfigured: () => true, sendGroupMarkdown: async () => undefined },
        logger: { error: () => undefined }
    });

    await service.handleEvent({ op: 0, t: 'GROUP_MSG_RECEIVE', d: { group_openid: 'group-openid' } });
    const result = await service.notifyTeamCreated({ id: 7, name: 'Delve' });

    assert.equal(result.queued, 1);
    assert.deepEqual(events, [['group', 'group-openid', 'GROUP_MSG_RECEIVE'], ['queue', 7]]);
});

test('QQ team-created notifications send a Markdown card with a keyboard', async () => {
    const sent = [];
    const marked = [];
    const service = new QqTeamNotificationService({
        appSecret: 'test-secret',
        teamLobbyUrl: 'https://example.com/lobby',
        repository: {
            claimPendingNotifications: async () => [{
                id: 12,
                attempts: 0,
                group_openid: 'group-openid',
                payload: { name: 'Delve', team_type: 'Secret Realm', leader_name: 'Alice' }
            }],
            markNotificationSent: async (id) => marked.push(id),
            retryNotification: async () => assert.fail('notification should not be retried')
        },
        client: {
            isConfigured: () => true,
            sendGroupMarkdown: async (groupOpenid, content, options) => sent.push({ groupOpenid, content, options })
        }
    });

    const count = await service.flush();

    assert.equal(count, 1);
    assert.deepEqual(marked, [12]);
    assert.equal(sent[0].groupOpenid, 'group-openid');
    assert.match(sent[0].content, /^## Game Hub 新组队/);
    assert.equal(sent[0].options.keyboard.content.rows[0].buttons[0].action.data, 'https://example.com/lobby');
    assert.equal(sent[0].options.keyboard.content.rows[0].buttons[2].action.data, '/菜单');
    assert.deepEqual(
        sent[0].options.keyboard.content.rows[1].buttons.map((button) => button.action.data),
        ['/玩家信息', '/最新资讯', '/交易市场']
    );
});

test('team message is bounded and carries the public lobby link', () => {
    const content = buildTeamCreatedMessage({
        name: ' Delve\nTeam ',
        team_type: 'mijing',
        leader_name: ' Alice ',
        current_members: 1,
        max_members: 5,
        min_combat_power: 1234
    }, 'https://example.com/');

    assert.match(content, /\*\*队伍\*\*：Delve Team/);
    assert.match(content, /\[打开组队大厅\]\(https:\/\/example\.com\)/);
});

test('team Markdown escapes user-supplied formatting characters', () => {
    const content = buildTeamCreatedMessage({
        name: '*Delve*',
        team_type: '[Secret Realm]',
        leader_name: 'Alice#1'
    }, 'https://example.com/lobby');

    assert.match(content, /\*\*队伍\*\*：\\\*Delve\\\*/);
    assert.match(content, /\*\*类型\*\*：\\\[Secret Realm\\\]/);
    assert.match(content, /\*\*队长\*\*：Alice\\#1/);
});
