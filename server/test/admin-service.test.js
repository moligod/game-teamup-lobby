const assert = require('node:assert/strict');
const test = require('node:test');
const { createAdminService } = require('../src/modules/admin/admin-service');

function qqBotContentConfig() {
    return {
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
            team_list: '{{title}}\n{{body}}',
            player_info: '{{title}}\n{{body}}',
            latest_news: '{{title}}\n{{body}}',
            market: '{{title}}\n{{body}}',
            menu: '菜单 {{team_list_command}}'
        }
    };
}

function createService(repositoryOverrides = {}, serviceOptions = {}) {
    const events = [];
    const repository = {
        getSummary: async () => ({ total_users: 2 }),
        listUsers: async () => [],
        findUser: async () => null,
        deleteUser: async () => ({ changes: 0 }),
        listTeams: async () => [],
        updateTeamStatus: async () => ({ changes: 0 }),
        getTeam: async () => null,
        listMessages: async () => [],
        deleteMessage: async () => ({ changes: 0 }),
        listApplications: async () => [],
        listTables: async () => [],
        readTable: async () => null,
        getTableConfig: () => null,
        deleteTableRow: async () => ({ changes: 0 }),
        cleanup: async () => [],
        getQqBotPublicConfig: async () => ({ app_id: '', app_secret_configured: false }),
        getQqBotConfig: async () => ({ app_id: '', app_secret: '', app_secret_configured: false }),
        updateQqBotConfig: async (value) => value,
        getQqBotContentConfig: async () => qqBotContentConfig(),
        updateQqBotContentConfig: async (value) => value,
        getQqOauthPublicConfig: async () => ({}),
        updateQqOauthConfig: async (value) => value,
        getTrovePalPublicConfig: async () => ({ app_name: 'TroveBBS', api_key_configured: false }),
        updateTrovePalConfig: async (value) => value,
        ...repositoryOverrides
    };
    const presence = {
        getOnlineUserCount: () => 3,
        getOnlineUserIds: () => ['1'],
        isUserOnline: () => false,
        broadcastTeamListUpdate: () => events.push('team-list'),
        broadcastTeamEnded: () => events.push('team-ended'),
        sendChatMessageUpdate: () => events.push('chat'),
        broadcastLeaderboardUpdate: () => events.push('leaderboard')
    };
    return {
        events,
        service: createAdminService({
            repository,
            presence,
            leaderboard: { invalidateCache: () => events.push('cache') },
            ...serviceOptions
        })
    };
}

test('admin summary combines persistence counts with live presence', async () => {
    const { service } = createService();
    assert.deepEqual(await service.getSummary(), { total_users: 2, online_users: 3 });
});

test('admin cannot delete the current administrator', async () => {
    const { service } = createService();
    await assert.rejects(() => service.deleteUser('7', 7), /不能删除当前登录/);
});

test('ending a team broadcasts list and ended events after persistence', async () => {
    const { service, events } = createService({
        updateTeamStatus: async () => ({ changes: 1 }),
        getTeam: async () => ({ id: 4 })
    });
    const result = await service.updateTeamStatus('4', 'ended');
    assert.equal(result.team.id, 4);
    assert.deepEqual(events, ['team-list', 'team-ended']);
});

test('database cleanup validates date order before repository access', async () => {
    let called = false;
    const { service } = createService({ cleanup: async () => { called = true; return []; } });
    await assert.rejects(
        () => service.cleanup({ from: '2026-07-16', to: '2026-07-15' }),
        /开始时间不能晚于结束时间/
    );
    assert.equal(called, false);
});

test('TrovePal configuration validates the app name and keeps the secret out of the response', async () => {
    let received = null;
    const savedConfig = { app_name: 'TroveBBS', api_key_configured: true, updated_at: null };
    const { service } = createService({
        updateTrovePalConfig: async (value) => {
            received = value;
            return savedConfig;
        }
    });

    const result = await service.updateTrovePalConfig({
        app_name: 'TroveBBS',
        api_key: 'trovepal_sk_test',
        clear_api_key: false
    });

    assert.deepEqual(received, {
        app_name: 'TroveBBS',
        api_key: 'trovepal_sk_test',
        clear_api_key: false
    });
    assert.deepEqual(result, savedConfig);
    assert.equal(Object.hasOwn(result, 'api_key'), false);
    assert.throws(
        () => service.updateTrovePalConfig({ app_name: ' ', api_key: '', clear_api_key: false }),
        /app_name is required/
    );
});

test('QQ bot configuration updates the runtime without exposing the AppSecret', async () => {
    let received = null;
    let applied = null;
    const savedConfig = { app_id: '1234567890', app_secret_configured: true, updated_at: null };
    const runtimeConfig = { app_id: '1234567890', app_secret: 'qq-bot-secret', app_secret_configured: true, updated_at: null };
    const { service } = createService({
        updateQqBotConfig: async (value) => {
            received = value;
            return savedConfig;
        },
        getQqBotConfig: async () => runtimeConfig
    }, {
        onQqBotConfigUpdated: (value) => { applied = value; }
    });

    const result = await service.updateQqBotConfig({
        app_id: '1234567890',
        app_secret: 'qq-bot-secret',
        clear_app_secret: false
    });

    assert.deepEqual(received, {
        app_id: '1234567890',
        app_secret: 'qq-bot-secret',
        clear_app_secret: false
    });
    assert.deepEqual(applied, runtimeConfig);
    assert.deepEqual(result, savedConfig);
    assert.equal(Object.hasOwn(result, 'app_secret'), false);
    await assert.rejects(
        () => service.updateQqBotConfig({ app_id: ' ', app_secret: '', clear_app_secret: false }),
        /app_id is required/
    );
});

test('QQ bot content configuration validates commands and applies the saved cards at runtime', async () => {
    let received = null;
    let applied = null;
    const savedConfig = { ...qqBotContentConfig(), updated_at: '2026-07-23T00:00:00.000Z' };
    const { service } = createService({
        updateQqBotContentConfig: async (value) => {
            received = value;
            return savedConfig;
        }
    }, {
        onQqBotContentUpdated: (value) => { applied = value; }
    });

    const result = await service.updateQqBotContentConfig(qqBotContentConfig());

    assert.deepEqual(received, qqBotContentConfig());
    assert.deepEqual(applied, savedConfig);
    assert.deepEqual(result, savedConfig);

    const duplicateCommands = qqBotContentConfig();
    duplicateCommands.commands.help = duplicateCommands.commands.menu;
    await assert.rejects(
        () => service.updateQqBotContentConfig(duplicateCommands),
        /QQ bot commands must be unique/
    );
});
