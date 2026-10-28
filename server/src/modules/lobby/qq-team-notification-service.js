const {
    createDefaultQqBotContentConfig,
    renderQqBotMarkdown,
    resolveQqBotContentConfig
} = require('./qq-bot-content-config');

function cleanText(value, fallback = '') {
    const normalized = String(value || '').replace(/[\r\n]+/g, ' ').trim();
    return normalized || fallback;
}

function markdownText(value, fallback = '', maximumLength) {
    const text = cleanText(value, fallback);
    const bounded = Number.isInteger(maximumLength) ? text.slice(0, maximumLength) : text;
    return bounded.replace(/([\\`*_[\]{}()#+\-.!|>])/g, '\\$1');
}

function normalizeHttpUrl(value, fallback) {
    const url = cleanText(value, fallback).replace(/\/+$/, '');
    return /^https?:\/\/[^\s]+$/i.test(url) ? url : fallback;
}

function normalizePublicBaseUrl(value) {
    return normalizeHttpUrl(value, 'https://example.com');
}

function normalizeTeamLobbyUrl(value) {
    return normalizeHttpUrl(value, 'https://example.com/lobby');
}

function teamLobbyMarkdownLink(url) {
    return `[打开组队大厅](${normalizeTeamLobbyUrl(url)})`;
}

function commandButton(id, label, command) {
    return {
        id,
        render_data: { label, style: 0 },
        action: { type: 2, permission: { type: 2 }, data: `/${command}`, enter: false }
    };
}

function commandMenuKeyboard() {
    return {
        content: {
            rows: [
                {
                    buttons: [
                        commandButton('show_team_list', '队伍列表', TEAM_LIST_COMMAND),
                        commandButton('show_player_info', '玩家信息', PLAYER_INFO_COMMAND)
                    ]
                },
                {
                    buttons: [
                        commandButton('show_latest_news', '最新资讯', LATEST_NEWS_COMMAND),
                        commandButton('show_market', '交易市场', MARKET_COMMAND)
                    ]
                }
            ]
        }
    };
}

function openTeamLobbyButton(url) {
    const lobbyUrl = normalizeTeamLobbyUrl(url);
    return {
        id: 'open_team_lobby',
        render_data: { label: '打开组队大厅', visited_label: '已打开', style: 1 },
        action: { type: 0, permission: { type: 2 }, data: lobbyUrl }
    };
}

function openMarketButton(url) {
    const marketUrl = normalizeHttpUrl(url, 'https://example.com/market');
    return {
        id: 'open_market',
        render_data: { label: '\u6253\u5f00\u4ea4\u6613\u5e02\u573a', visited_label: '\u5df2\u6253\u5f00', style: 1 },
        action: { type: 0, permission: { type: 2 }, data: marketUrl }
    };
}

function teamLobbyKeyboard(url) {
    const lobbyUrl = normalizeTeamLobbyUrl(url);
    return {
        content: {
            rows: [
                {
                    buttons: [
                        openTeamLobbyButton(lobbyUrl),
                        commandButton('show_team_list', '队伍列表', TEAM_LIST_COMMAND),
                        commandButton('show_menu', '菜单', MENU_COMMAND)
                    ]
                },
                {
                    buttons: [
                        commandButton('show_player_info', '玩家信息', PLAYER_INFO_COMMAND),
                        commandButton('show_latest_news', '最新资讯', LATEST_NEWS_COMMAND),
                        commandButton('show_market', '交易市场', MARKET_COMMAND)
                    ]
                }
            ]
        }
    };
}

function teamListKeyboard(url) {
    const lobbyUrl = normalizeTeamLobbyUrl(url);
    return {
        content: {
            rows: [
                {
                    buttons: [
                        openTeamLobbyButton(lobbyUrl),
                        commandButton('show_menu', '菜单', MENU_COMMAND)
                    ]
                },
                {
                    buttons: [
                        commandButton('show_player_info', '玩家信息', PLAYER_INFO_COMMAND),
                        commandButton('show_latest_news', '最新资讯', LATEST_NEWS_COMMAND),
                        commandButton('show_market', '交易市场', MARKET_COMMAND)
                    ]
                }
            ]
        }
    };
}

function configuredCommandMenuKeyboard(contentConfig) {
    const commands = resolveQqBotContentConfig(contentConfig).commands;
    return {
        content: {
            rows: [
                {
                    buttons: [
                        commandButton('show_team_list', commands.team_list, commands.team_list),
                        commandButton('show_player_info', commands.player_info, commands.player_info)
                    ]
                },
                {
                    buttons: [
                        commandButton('show_latest_news', commands.latest_news, commands.latest_news),
                        commandButton('show_market', commands.market, commands.market)
                    ]
                }
            ]
        }
    };
}

function configuredMarketKeyboard(url, contentConfig) {
    const menuKeyboard = configuredCommandMenuKeyboard(contentConfig);
    return {
        content: {
            rows: [
                ...menuKeyboard.content.rows,
                { buttons: [openMarketButton(url)] }
            ]
        }
    };
}

function configuredTeamLobbyKeyboard(url, contentConfig) {
    const commands = resolveQqBotContentConfig(contentConfig).commands;
    const lobbyUrl = normalizeTeamLobbyUrl(url);
    return {
        content: {
            rows: [
                {
                    buttons: [
                        openTeamLobbyButton(lobbyUrl),
                        commandButton('show_team_list', commands.team_list, commands.team_list),
                        commandButton('show_menu', commands.menu, commands.menu)
                    ]
                },
                {
                    buttons: [
                        commandButton('show_player_info', commands.player_info, commands.player_info),
                        commandButton('show_latest_news', commands.latest_news, commands.latest_news),
                        commandButton('show_market', commands.market, commands.market)
                    ]
                }
            ]
        }
    };
}

function playerProfilePageCommand(playerName, view, page, contentConfig) {
    const commands = resolveQqBotContentConfig(contentConfig).commands;
    const targetPage = Number.isSafeInteger(page) && page > 0 ? page : 1;
    const pageText = targetPage > 1 ? '\u7b2c' + targetPage + '\u9875' : '';
    return [
        commands.player_info,
        cleanText(playerName),
        playerProfileViewLabel(view),
        pageText
    ].filter(Boolean).join(' ');
}

function configuredPlayerProfileKeyboard(contentConfig, playerName, view, page, totalPages) {
    const currentPage = Math.max(1, Math.min(Number(page) || 1, Number(totalPages) || 1));
    const pages = Math.max(1, Number(totalPages) || 1);
    const selectedView = resolvePlayerProfileView(view);
    const rows = [];
    const pageButtons = [];

    if (currentPage > 1) {
        pageButtons.push(commandButton(
            'player_profile_previous',
            '\u4e0a\u4e00\u9875',
            playerProfilePageCommand(playerName, selectedView, currentPage - 1, contentConfig)
        ));
    }
    if (currentPage < pages) {
        pageButtons.push(commandButton(
            'player_profile_next',
            '\u4e0b\u4e00\u9875',
            playerProfilePageCommand(playerName, selectedView, currentPage + 1, contentConfig)
        ));
    }
    if (pageButtons.length) rows.push({ buttons: pageButtons });

    return {
        content: {
            rows: [
                ...rows,
                {
                    buttons: [
                        commandButton(
                            'player_profile_weekly',
                            '\u5468\u699c',
                            playerProfilePageCommand(playerName, 'weekly', 1, contentConfig)
                        ),
                        commandButton(
                            'player_profile_combat',
                            '\u6218\u6597\u529b',
                            playerProfilePageCommand(playerName, 'combat', 1, contentConfig)
                        )
                    ]
                },
                {
                    buttons: [
                        commandButton(
                            'player_profile_stats',
                            '\u6e38\u620f\u6570\u636e\u7edf\u8ba1',
                            playerProfilePageCommand(playerName, 'stats', 1, contentConfig)
                        )
                    ]
                }
            ]
        }
    };
}

function configuredTeamListKeyboard(url, contentConfig) {
    const commands = resolveQqBotContentConfig(contentConfig).commands;
    const lobbyUrl = normalizeTeamLobbyUrl(url);
    return {
        content: {
            rows: [
                {
                    buttons: [
                        openTeamLobbyButton(lobbyUrl),
                        commandButton('show_menu', commands.menu, commands.menu)
                    ]
                },
                {
                    buttons: [
                        commandButton('show_player_info', commands.player_info, commands.player_info),
                        commandButton('show_latest_news', commands.latest_news, commands.latest_news),
                        commandButton('show_market', commands.market, commands.market)
                    ]
                }
            ]
        }
    };
}

function commandTemplateValues(contentConfig) {
    const commands = resolveQqBotContentConfig(contentConfig).commands;
    return {
        team_list_command: markdownText(commands.team_list),
        player_info_command: markdownText(commands.player_info),
        latest_news_command: markdownText(commands.latest_news),
        market_command: markdownText(commands.market),
        menu_command: markdownText(commands.menu),
        help_command: markdownText(commands.help)
    };
}

function renderConfiguredCard(cardKey, contentConfig, values = {}) {
    const config = resolveQqBotContentConfig(contentConfig);
    return renderQqBotMarkdown(config.cards[cardKey], {
        ...commandTemplateValues(config),
        ...values
    });
}

function renderConfiguredResponse(cardKey, messages, contentConfig) {
    return messages.map((message) => {
        const [title, ...bodyLines] = String(message || '').split('\n');
        return renderConfiguredCard(cardKey, contentConfig, {
            title,
            body: bodyLines.join('\n')
        });
    });
}

function buildConfiguredTeamCreatedMessage(team, teamLobbyUrl, contentConfig) {
    const baseUrl = normalizeTeamLobbyUrl(teamLobbyUrl);
    const teamName = markdownText(team?.name, '\u672a\u547d\u540d\u7ec4\u961f', 80);
    const teamType = markdownText(team?.team_type_name || team?.team_type, '\u672a\u5206\u7c7b', 80);
    const leader = markdownText(team?.leader_name, '\u73a9\u5bb6', 80);
    const currentMembers = Number.isFinite(Number(team?.current_members)) ? Number(team.current_members) : 1;
    const maxMembers = Number.isFinite(Number(team?.max_members)) ? Number(team.max_members) : '?';
    const combatPower = Number.isFinite(Number(team?.min_combat_power)) ? Number(team.min_combat_power) : 0;
    return renderConfiguredCard('team_notification', contentConfig, {
        team_name: teamName,
        team_type: teamType,
        leader_name: leader,
        current_members: currentMembers,
        max_members: maxMembers,
        min_combat_power: combatPower,
        team_lobby_url: baseUrl
    });
}

function buildConfiguredActiveTeamListMessages(teams, contentConfig) {
    return renderConfiguredResponse('team_list', buildActiveTeamListMessages(teams), contentConfig);
}

function buildConfiguredPlayerProfileMessages(profile, contentConfig) {
    const name = markdownText(profile?.player?.display_name, '玩家', PLAYER_NAME_MAX_LENGTH);
    const items = Array.isArray(profile?.items) ? profile.items : [];
    const lines = items.map(item => {
        const board = markdownText(displayLeaderboardName(item), '排行榜', 100);
        const score = markdownText(formatProfileScore(item?.score), '-', 40);
        const rank = Number.isFinite(Number(item?.rank)) ? ` · 排名 ${Number(item.rank)}` : '';
        return `- ${board}：${score}${rank}`;
    });
    const chunks = splitLines(lines.length ? lines : ['暂无排行榜数据'], PLAYER_PROFILE_CHUNK_LENGTH);
    return renderConfiguredResponse('player_info', chunks.map(chunk => `## Game Hub 玩家信息\n玩家：${name}\n${chunk}`), contentConfig);
}

function configuredPlayerInfoUsageMessage(contentConfig) {
    const command = resolveQqBotContentConfig(contentConfig).commands.player_info;
    return renderConfiguredCard('player_info', contentConfig, {
        title: '## Game Hub \u73a9\u5bb6\u4fe1\u606f',
        body: '\u8bf7\u5728\u6307\u4ee4\u540e\u8f93\u5165\u73a9\u5bb6\u540d\uff0c\u4f8b\u5982\uff1a`/' + markdownText(command) + ' PlayerName`'
    });
}

function configuredPlayerInfoNotFoundMessage(playerName, contentConfig) {
    return renderConfiguredResponse('player_info', [playerInfoNotFoundMessage(playerName)], contentConfig)[0];
}

function buildConfiguredLatestNewsMessage(result, newsUrl, contentConfig) {
    return renderConfiguredResponse('latest_news', [buildLatestNewsMessage(result, newsUrl)], contentConfig)[0];
}

function buildConfiguredMarketListingsMessage(result, contentConfig) {
    return renderConfiguredResponse('market', [buildMarketListingsMessage(result)], contentConfig)[0];
}

function configuredMenuMessage(contentConfig) {
    return renderConfiguredCard('menu', contentConfig);
}

function buildTeamCreatedMessage(team, teamLobbyUrl) {
    const baseUrl = normalizeTeamLobbyUrl(teamLobbyUrl);
    const teamName = markdownText(team.name, '未命名组队', 80);
    const teamType = markdownText(team.team_type_name || team.team_type, '未分类', 80);
    const leader = markdownText(team.leader_name, '玩家', 80);
    const currentMembers = Number.isFinite(Number(team.current_members)) ? Number(team.current_members) : 1;
    const maxMembers = Number.isFinite(Number(team.max_members)) ? Number(team.max_members) : '?';
    const combatPower = Number.isFinite(Number(team.min_combat_power)) ? Number(team.min_combat_power) : 0;

    return [
        '## Game Hub 新组队',
        `**队伍**：${teamName}`,
        `**类型**：${teamType}`,
        `**队长**：${leader}`,
        `**人数**：${currentMembers}/${maxMembers}`,
        `**最低战力**：${combatPower}`,
        '',
        teamLobbyMarkdownLink(baseUrl)
    ].join('\n');
}

const TEAM_LIST_COMMAND = '\u961f\u4f0d\u5217\u8868';
const LEGACY_TEAM_QUERY_COMMAND = '\u67e5\u8be2\u56e2\u961f';
const PLAYER_INFO_COMMAND = '\u73a9\u5bb6\u4fe1\u606f';
const LATEST_NEWS_COMMAND = '\u6700\u65b0\u8d44\u8baf';
const MARKET_COMMAND = '\u4ea4\u6613\u5e02\u573a';
const MENU_COMMAND = '\u83dc\u5355';
const HELP_COMMAND = '\u5e2e\u52a9';
const TEAM_LIST_CHUNK_LENGTH = 1200;
const PLAYER_PROFILE_CHUNK_LENGTH = 720;
const PLAYER_NAME_MAX_LENGTH = 128;
const LATEST_NEWS_LIMIT = 5;
const MARKET_LISTINGS_LIMIT = 5;
const MARKET_CATEGORY_ORDER = Object.freeze(['flux', 'items', 'boosting', 'accounts', 'codes']);
const MARKET_CATEGORY_LABELS = new Map([
    ['flux', '游戏货币'],
    ['items', '\u9053\u5177'],
    ['boosting', '\u4ee3\u809d'],
    ['accounts', '\u8d26\u53f7'],
    ['codes', '\u5151\u6362\u7801']
]);
const MARKET_PRICE_UNIT_LABELS = new Map([
    ['each', 'R'],
    ['per_million', '\u767e\u4e07']
]);
const ANNOUNCEMENT_CHANNEL_LABELS = new Map([
    ['announcements', '\u516c\u544a'],
    ['announcement', '\u516c\u544a'],
    ['game-updates', '\u6e38\u620f\u66f4\u65b0'],
    ['patch-notes', '\u66f4\u65b0\u8bf4\u660e'],
    ['sales', '\u5546\u57ce\u6d3b\u52a8'],
    ['promotion', '\u5546\u57ce\u6d3b\u52a8']
]);
const COMMAND_EVENT_TYPES = new Set([
    'INTERACTION_CREATE',
    'GROUP_AT_MESSAGE_CREATE',
    'GROUP_MESSAGE_CREATE',
    'C2C_MESSAGE_CREATE'
]);
const MESSAGE_REPLY_EVENT_TYPES = new Set([
    'GROUP_AT_MESSAGE_CREATE',
    'GROUP_MESSAGE_CREATE',
    'C2C_MESSAGE_CREATE'
]);

const PROFILE_CATEGORY_LABELS = new Map([
    ['3', '\u6bcf\u5468\u7ade\u8d5b'],
    ['4', '\u4e13\u7cbe\u70b9'],
    ['5', '\u5c5e\u6027'],
    ['6', '\u6218\u6597\u529b'],
    ['8', '\u79d8\u5883'],
    ['9', '\u804c\u4e1a\u6d3b\u8dc3\u5ea6'],
    ['10', '\u5dc5\u5cf0\u7b49\u7ea7']
]);
const PLAYER_PROFILE_VIEWS = Object.freeze({
    mastery: {
        label: '\u4e13\u7cbe\u70b9',
        categoryIds: ['4'],
        categoryOrder: ['4']
    },
    weekly: {
        label: '\u5468\u699c',
        categoryIds: ['3', '8', '9', '10', 'other'],
        categoryOrder: ['3', '8', '9', 'other']
    },
    combat: {
        label: '\u6218\u6597\u529b',
        categoryIds: ['6'],
        categoryOrder: ['6']
    },
    stats: {
        label: '\u6e38\u620f\u6570\u636e\u7edf\u8ba1',
        categoryIds: ['5'],
        categoryOrder: ['5']
    }
});
const DEFAULT_PLAYER_PROFILE_VIEW = 'mastery';

function resolvePlayerProfileView(value) {
    const view = cleanText(value).toLowerCase();
    return Object.hasOwn(PLAYER_PROFILE_VIEWS, view) ? view : DEFAULT_PLAYER_PROFILE_VIEW;
}

function playerProfileViewLabel(view) {
    return PLAYER_PROFILE_VIEWS[resolvePlayerProfileView(view)].label;
}

function normalizeCommand(value) {
    return cleanText(value)
        .replace(/^(?:<@!?\d+>|@\S+)\s*/, '')
        .replace(/^\/+/, '')
        .split(/\s+/)[0];
}

function commandText(payload) {
    const eventType = String(payload?.t || '');
    if (eventType === 'INTERACTION_CREATE') {
        return cleanText(payload?.d?.data?.name) || cleanText(payload?.d?.content);
    }
    return cleanText(payload?.d?.content);
}

function isCommandEvent(payload) {
    if (payload?.op !== 0) return false;
    return COMMAND_EVENT_TYPES.has(String(payload?.t || ''));
}

function groupOpenidFromEvent(payload) {
    return cleanText(payload?.d?.group_openid || payload?.d?.group_id);
}

function userOpenidFromEvent(payload) {
    return cleanText(
        payload?.d?.author?.user_openid
        || payload?.d?.user_openid
        || payload?.d?.author?.id
    );
}

function replyTargetFromEvent(payload) {
    const eventType = String(payload?.t || '');
    const messageId = MESSAGE_REPLY_EVENT_TYPES.has(eventType) ? cleanText(payload?.d?.id) : '';
    const eventId = eventType === 'INTERACTION_CREATE' ? cleanText(payload?.id) : '';
    const groupOpenid = groupOpenidFromEvent(payload);
    if (groupOpenid) {
        return { kind: 'group', openid: groupOpenid, messageId, eventId };
    }

    const userOpenid = userOpenidFromEvent(payload);
    if (userOpenid) {
        return { kind: 'c2c', openid: userOpenid, messageId, eventId };
    }
    return null;
}

function isTeamQueryCommand(payload) {
    if (!isCommandEvent(payload)) return false;
    const command = normalizeCommand(commandText(payload));
    return command === TEAM_LIST_COMMAND || command === LEGACY_TEAM_QUERY_COMMAND;
}

function isPlayerInfoCommand(payload) {
    return isCommandEvent(payload) && normalizeCommand(commandText(payload)) === PLAYER_INFO_COMMAND;
}

function isLatestNewsCommand(payload) {
    return isCommandEvent(payload) && normalizeCommand(commandText(payload)) === LATEST_NEWS_COMMAND;
}

function isMarketCommand(payload) {
    return isCommandEvent(payload) && normalizeCommand(commandText(payload)) === MARKET_COMMAND;
}

function isMenuCommand(payload) {
    if (!isCommandEvent(payload)) return false;
    const command = normalizeCommand(commandText(payload));
    return command === MENU_COMMAND || command === HELP_COMMAND;
}

function configuredCommandMatches(payload, commandKey, contentConfig) {
    if (!isCommandEvent(payload)) return false;
    const command = normalizeCommand(commandText(payload));
    return command === resolveQqBotContentConfig(contentConfig).commands[commandKey];
}

function isConfiguredTeamQueryCommand(payload, contentConfig) {
    if (!isCommandEvent(payload)) return false;
    const command = normalizeCommand(commandText(payload));
    const commands = resolveQqBotContentConfig(contentConfig).commands;
    return command === commands.team_list || command === LEGACY_TEAM_QUERY_COMMAND;
}

function isConfiguredMenuCommand(payload, contentConfig) {
    return configuredCommandMatches(payload, 'menu', contentConfig)
        || configuredCommandMatches(payload, 'help', contentConfig);
}

function commandArgumentFromText(value) {
    const normalized = cleanText(value)
        .replace(/^(?:<@!?\d+>|@\S+)\s*/, '')
        .replace(/^\/+/, '');
    const [, argument = ''] = normalized.match(/^\S+(?:\s+([\s\S]+))?$/) || [];
    return cleanText(argument);
}

function interactionArgumentValue(value) {
    if (typeof value === 'string' || typeof value === 'number') return cleanText(value);
    if (Array.isArray(value)) {
        return value.map(interactionArgumentValue).filter(Boolean).join(' ');
    }
    if (!value || typeof value !== 'object') return '';

    for (const field of ['value', 'input', 'text', 'content', 'player_name', 'playerName']) {
        const extracted = interactionArgumentValue(value[field]);
        if (extracted) return extracted;
    }
    return '';
}

function playerNameFromCommand(payload) {
    for (const value of [payload?.d?.data?.name, payload?.d?.content]) {
        const argument = commandArgumentFromText(value);
        if (argument) return argument;
    }

    const data = payload?.d?.data;
    for (const value of [
        data?.options,
        data?.params,
        data?.arguments,
        data?.argument,
        data?.value,
        data?.input,
        data?.data,
        data?.resolved?.options,
        data?.resolved?.params,
        data?.resolved?.arguments,
        data?.resolved?.argument,
        data?.resolved?.value,
        data?.resolved?.input
    ]) {
        const argument = interactionArgumentValue(value);
        if (argument) return argument;
    }
    return '';
}

function playerProfileRequestFromCommand(payload) {
    const argument = playerNameFromCommand(payload);
    const viewMatch = argument.match(/(?:^|\s)--view=([a-z_]+)(?=\s|$)/i);
    const pageMatch = argument.match(/(?:^|\s)--page=(\d+)(?=\s|$)/);
    let playerName = cleanText(argument.replace(/(?:^|\s)--(?:view=[^\s]+|page=\d+)(?=\s|$)/gi, ' '));
    const friendlyPageMatch = playerName.match(/\s+\u7b2c\s*(\d+)\s*\u9875\s*$/);
    const parsedPage = Number.parseInt(friendlyPageMatch?.[1] || pageMatch?.[1] || '', 10);
    if (friendlyPageMatch) playerName = cleanText(playerName.slice(0, friendlyPageMatch.index));

    const friendlyView = Object.entries(PLAYER_PROFILE_VIEWS)
        .sort(([, left], [, right]) => right.label.length - left.label.length)
        .find(([, config]) => playerName.endsWith(' ' + config.label));
    if (friendlyView) playerName = cleanText(playerName.slice(0, -friendlyView[1].label.length));

    return {
        playerName,
        view: friendlyView?.[0] || resolvePlayerProfileView(viewMatch?.[1]),
        page: Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1
    };
}

function buildActiveTeamListMessages(teams) {
    const activeTeams = Array.isArray(teams) ? teams : [];
    if (!activeTeams.length) {
        return [[
            '## Game Hub 在线车队',
            '当前没有可加入的在线车队。'
        ].join('\n')];
    }

    const lines = activeTeams.map((team, index) => {
        const name = markdownText(team.name, '未命名车队', 80);
        const type = markdownText(team.team_type_name || team.team_type, '未分类', 40);
        const leader = markdownText(team.leader_name, '未知', 40);
        const currentMembers = Number.isFinite(Number(team.current_members)) ? Number(team.current_members) : 1;
        const maxMembers = Number.isFinite(Number(team.max_members)) ? Number(team.max_members) : '?';
        const combatPower = Number.isFinite(Number(team.min_combat_power)) ? Number(team.min_combat_power) : 0;
        return `${index + 1}. **${name}** · ${type}\n> 队长：${leader} | 人数：${currentMembers}/${maxMembers} | 最低战力：${combatPower}`;
    });

    const chunks = [];
    let chunk = '';
    for (const line of lines) {
        const next = chunk ? `${chunk}\n${line}` : line;
        if (chunk && next.length > TEAM_LIST_CHUNK_LENGTH) {
            chunks.push(chunk);
            chunk = line;
        } else {
            chunk = next;
        }
    }
    if (chunk) chunks.push(chunk);

    return chunks.map((content, index) => [
        `## Game Hub 在线车队 ${index + 1}/${chunks.length}`,
        `当前共 **${activeTeams.length}** 支`,
        content
    ].join('\n'));
}

function displayLeaderboardName(item) {
    const candidates = [item?.leaderboard_name, item?.leaderboard_type, item?.leaderboard_key]
        .filter(Boolean)
        .map((value) => cleanText(value));
    return candidates.find((value) => !value.startsWith('$')) || candidates[0] || '\u672a\u547d\u540d\u6392\u884c\u699c';
}

function formatProfileScore(value) {
    const raw = cleanText(value, '-');
    const withoutZeroDecimal = raw.replace(/^-?\d+\.0+$/, (match) => match.slice(0, match.indexOf('.')));
    return /^-?\d+$/.test(withoutZeroDecimal)
        ? new Intl.NumberFormat('zh-CN').format(Number(withoutZeroDecimal))
        : raw;
}

function formatMasteryProgress(value, omitZeroMaximum = false) {
    const raw = cleanText(value);
    const level = raw.match(/\bLv\s*(\d+)/i)?.[1];
    const parts = [...raw.matchAll(/(\d+)\s*\/\s*(\d+)/g)];
    if (!parts.length) return raw;

    const countedParts = omitZeroMaximum
        ? parts.filter(([, , maximum]) => Number.parseInt(maximum, 10) > 0)
        : parts;
    if (!countedParts.length) return level ? 'Lv ' + level : raw;

    const totals = countedParts.reduce((result, [, current, maximum]) => ({
        current: result.current + Number.parseInt(current, 10),
        maximum: result.maximum + Number.parseInt(maximum, 10)
    }), { current: 0, maximum: 0 });
    const progress = totals.current + '/' + totals.maximum;
    return level ? 'Lv ' + level + ' ' + progress : progress;
}

function playerProfileGroups(profile, view) {
    const selectedView = resolvePlayerProfileView(view);
    const viewConfig = PLAYER_PROFILE_VIEWS[selectedView];
    const allowedCategoryIds = new Set(viewConfig.categoryIds);
    const groups = new Map();
    for (const item of Array.isArray(profile?.items) ? profile.items : []) {
        const rawCategoryId = String(item?.category_id ?? 'other');
        const sourceCategoryId = PROFILE_CATEGORY_LABELS.has(rawCategoryId) ? rawCategoryId : 'other';
        if (!allowedCategoryIds.has(sourceCategoryId)) continue;

        const categoryId = selectedView === 'weekly' && sourceCategoryId === '10'
            ? 'other'
            : sourceCategoryId;
        const group = groups.get(categoryId) || [];
        group.push(item);
        groups.set(categoryId, group);
    }

    const categoryOrder = new Map(viewConfig.categoryOrder.map((categoryId, index) => [categoryId, index]));
    return [...groups.entries()]
        .sort(([left], [right]) => (categoryOrder.get(left) ?? Number.MAX_SAFE_INTEGER) - (categoryOrder.get(right) ?? Number.MAX_SAFE_INTEGER));
}

function playerProfileLines(groups) {
    return groups
        .flatMap(([categoryId, categoryItems]) => [
            '【' + (PROFILE_CATEGORY_LABELS.get(categoryId) || '\u5176\u4ed6') + '】',
            ...categoryItems.map((item) => {
                const rank = Number.isFinite(Number(item?.rank)) ? '排名 ' + Number(item.rank) : '';
                const name = markdownText(displayLeaderboardName(item), '\u672a\u547d\u540d\u6392\u884c\u699c', 100);
                const score = markdownText(formatProfileScore(item?.score), '-', 40);
                if (categoryId === '4') {
                    const isTotalMastery = String(item?.leaderboard_id ?? '') === '100'
                        || item?.leaderboard_key === '$Leaderboard_TotalMastery'
                        || item?.leaderboard_type === '$Leaderboard_TotalMastery';
                    const detail = [formatMasteryProgress(item?.mastery_level_text, isTotalMastery), rank].filter(Boolean).join(' · ');
                    return name + '\uff1a' + score + (detail ? '\n' + detail : '');
                }

                const mastery = markdownText(item?.mastery_level_text, '', 64);
                const suffixes = [mastery, rank].filter(Boolean);
                return '- ' + name
                    + '\uff1a' + score
                    + (suffixes.length ? ' · ' + suffixes.join(' · ') : '');
            })
        ]);
}

function splitLines(lines, maximumLength) {
    const chunks = [];
    let chunk = '';
    for (const line of lines) {
        const next = chunk ? chunk + '\n' + line : line;
        if (chunk && next.length > maximumLength) {
            chunks.push(chunk);
            chunk = line;
        } else {
            chunk = next;
        }
    }
    if (chunk) chunks.push(chunk);
    return chunks;
}

function buildPlayerProfileMessages(profile, view = DEFAULT_PLAYER_PROFILE_VIEW) {
    const selectedView = resolvePlayerProfileView(view);
    const viewConfig = PLAYER_PROFILE_VIEWS[selectedView];
    const playerName = markdownText(profile?.player?.display_name, '\u73a9\u5bb6', PLAYER_NAME_MAX_LENGTH);
    const groups = playerProfileGroups(profile, selectedView);
    const itemCount = groups.reduce((count, [, categoryItems]) => count + categoryItems.length, 0);
    if (!itemCount) {
        return [[
            'Game Hub · \u73a9\u5bb6\u4fe1\u606f · ' + viewConfig.label,
            '\u73a9\u5bb6\uff1a' + playerName,
            '\u6682\u65e0' + viewConfig.label + '\u6570\u636e'
        ].join('\n')];
    }

    const chunks = splitLines(playerProfileLines(groups), PLAYER_PROFILE_CHUNK_LENGTH);
    return chunks.map((content, index) => [
        'Game Hub · \u73a9\u5bb6\u4fe1\u606f · ' + viewConfig.label + (chunks.length > 1 ? ' ' + chunks.length + '/' + (index + 1) : ''),
        '\u73a9\u5bb6\uff1a' + playerName + ' · ' + viewConfig.label + '\uff1a' + itemCount + ' \u9879',
        content
    ].join('\n'));
}

function playerInfoUsageMessage() {
    return '## Game Hub \u73a9\u5bb6\u4fe1\u606f\n\u8bf7\u5728\u6307\u4ee4\u540e\u8f93\u5165\u73a9\u5bb6\u540d\uff0c\u4f8b\u5982\uff1a\`/\u73a9\u5bb6\u4fe1\u606f moligod\`';
}

function playerInfoNotFoundMessage(playerName) {
    return '## Game Hub \u73a9\u5bb6\u4fe1\u606f\n\u6682\u672a\u627e\u5230\u73a9\u5bb6\u300c' + markdownText(playerName, '\u73a9\u5bb6', PLAYER_NAME_MAX_LENGTH) + '\u300d\u7684\u6e38\u620f\u4fe1\u606f';
}

function latestNewsMarkdownLink(url) {
    return `[查看全部资讯](${normalizeHttpUrl(url, 'https://example.com/news')})`;
}

function resultItems(result) {
    if (Array.isArray(result)) return result;
    return Array.isArray(result?.items) ? result.items : [];
}

function announcementChannelLabel(item) {
    const raw = cleanText(item?.channel_name || item?.category);
    const label = ANNOUNCEMENT_CHANNEL_LABELS.get(raw.toLowerCase())
        || (/[A-Za-z]/.test(raw) ? '\u6700\u65b0\u8d44\u8baf' : raw);
    return markdownText(label, '\u6700\u65b0\u8d44\u8baf', 40);
}

function formatShanghaiDateTime(value) {
    const raw = cleanText(value);
    const date = new Date(raw);
    if (!raw || Number.isNaN(date.getTime())) return '';

    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return values.year && values.month && values.day && values.hour && values.minute
        ? values.year + '/' + values.month + '/' + values.day + ' ' + values.hour + ':' + values.minute
        : '';
}

function announcementPublishedAt(item) {
    return formatShanghaiDateTime(item?.posted_at || item?.created_at || item?.updated_at);
}

function leaderboardUpdateFooter(version) {
    const updatedAt = formatShanghaiDateTime(version?.updated_at);
    return updatedAt ? '> \u6392\u884c\u699c\u66f4\u65b0\u65f6\u95f4\uff1a' + updatedAt : '';
}

function appendMarkdownFooter(message, footer) {
    return footer ? String(message || '').trimEnd() + '\n\n' + footer : message;
}

function buildLatestNewsMessage(result, newsUrl) {
    const items = resultItems(result).slice(0, LATEST_NEWS_LIMIT);
    const lines = items.map((item, index) => {
        const channel = announcementChannelLabel(item);
        const publishedAt = announcementPublishedAt(item);
        const preview = markdownText(cleanText(item?.content).slice(0, 180), '暂无详情', 180);
        return `${index + 1}. **${[channel, publishedAt].filter(Boolean).join(' · ')}**\n> ${preview}`;
    });

    return [
        '## Game Hub 最新资讯',
        latestNewsMarkdownLink(newsUrl),
        '',
        ...(lines.length ? lines : ['暂无已同步的最新资讯。'])
    ].join('\n');
}

function marketPriceLabel(listing) {
    const rawPrice = listing?.price === undefined || listing?.price === null ? '' : String(listing.price).trim();
    if (!rawPrice) return '面议';

    const rawUnit = cleanText(listing?.price_unit);
    const unit = MARKET_PRICE_UNIT_LABELS.get(rawUnit.toLowerCase()) || rawUnit;
    const configured = String(process.env.MARKET_CURRENCY || 'CNY').trim().toUpperCase();
    const currency = /^[A-Z]{3}$/.test(configured) ? configured : 'CNY';
    return rawPrice + ' ' + currency + (unit ? ' / ' + unit : '');
}

function featuredMarketListings(result) {
    const items = resultItems(result);
    const selectedIndexes = new Set();
    const featured = [];

    for (const category of MARKET_CATEGORY_ORDER) {
        const index = items.findIndex((item, itemIndex) => (
            !selectedIndexes.has(itemIndex) && cleanText(item?.category).toLowerCase() === category
        ));
        if (index === -1) continue;
        selectedIndexes.add(index);
        featured.push(items[index]);
    }

    for (const [index, item] of items.entries()) {
        if (featured.length >= MARKET_LISTINGS_LIMIT) break;
        if (selectedIndexes.has(index)) continue;
        selectedIndexes.add(index);
        featured.push(item);
    }
    return featured.slice(0, MARKET_LISTINGS_LIMIT);
}

function marketCategoryLabel(value) {
    const category = cleanText(value).toLowerCase();
    return MARKET_CATEGORY_LABELS.get(category) || '\u5176\u4ed6';
}

function buildMarketListingsMessage(result) {
    const items = featuredMarketListings(result);
    const lines = items.map((item) => {
        const title = markdownText(item?.title, '未命名商品', 100);
        const seller = markdownText(item?.seller_name, '未知卖家', 60);
        const price = markdownText(marketPriceLabel(item), '面议', 60);
        const stock = markdownText(String(item?.stock ?? '有货'), '有货', 40);
        return `**${marketCategoryLabel(item?.category)}：${title}**\n> 卖家：${seller} | 价格：${price} | 库存：${stock}`;
    });

    return [
        '## Game Hub 交易市场',
        '',
        ...(lines.length ? lines : ['当前没有在售商品。'])
    ].join('\n');
}

function menuMessage() {
    return '## Game Hub 菜单\n请选择下方功能。';
}

class QqTeamNotificationService {
    constructor(options = {}) {
        this.repository = options.repository;
        this.client = options.client;
        this.appId = '';
        this.appSecret = '';
        this.contentConfig = createDefaultQqBotContentConfig();
        this.configure({
            appId: options.appId ?? process.env.QQ_BOT_APP_ID,
            appSecret: options.appSecret ?? process.env.QQ_BOT_APP_SECRET,
            content: options.contentConfig ?? options.content
        });
        this.publicBaseUrl = normalizePublicBaseUrl(options.publicBaseUrl || process.env.PUBLIC_BASE_URL);
        this.teamLobbyUrl = options.teamLobbyUrl || process.env.QQ_BOT_TEAM_URL
            || `${String(this.publicBaseUrl).replace(/\/+$/, '')}/lobby`;
        this.newsUrl = normalizeHttpUrl(options.newsUrl || `${this.publicBaseUrl}/news`, `${this.publicBaseUrl}/news`);
        this.marketUrl = normalizeHttpUrl(options.marketUrl || `${this.publicBaseUrl}/market`, `${this.publicBaseUrl}/market`);
        this.lobbyQuery = options.lobbyQuery;
        this.playerProfile = options.playerProfile;
        this.leaderboardVersion = options.leaderboardVersion;
        this.announcementQuery = options.announcementQuery;
        this.marketQuery = options.marketQuery;
        this.logger = options.logger || console;
        this.intervalMs = Math.max(5_000, Number(options.intervalMs || process.env.QQ_BOT_NOTIFICATION_POLL_MS || 15_000));
        this.timer = null;
        this.flushing = null;
    }

    configure(config = {}) {
        const hasAppId = Object.hasOwn(config, 'app_id') || Object.hasOwn(config, 'appId');
        const hasAppSecret = Object.hasOwn(config, 'app_secret') || Object.hasOwn(config, 'appSecret');
        if (hasAppId) this.appId = String(config.app_id ?? config.appId ?? '').trim();
        if (hasAppSecret) this.appSecret = String(config.app_secret ?? config.appSecret ?? '').trim();
        if (hasAppId || hasAppSecret) {
            this.client?.setCredentials?.({ appId: this.appId, appSecret: this.appSecret });
        }
        if (Object.hasOwn(config, 'content')) {
            this.contentConfig = resolveQqBotContentConfig(config.content);
        } else if (Object.hasOwn(config, 'commands') || Object.hasOwn(config, 'cards')) {
            this.contentConfig = resolveQqBotContentConfig(config);
        }
    }

    isConfigured() {
        return Boolean(this.repository && this.client?.isConfigured?.() && this.appSecret);
    }

    canSendMessages() {
        return Boolean(this.client?.isConfigured?.());
    }

    async handleEvent(payload) {
        if (payload?.op !== 0 || !payload?.t) return { ignored: true };

        const groupOpenid = groupOpenidFromEvent(payload);
        const group = groupOpenid && typeof this.repository?.recordGroupEvent === 'function'
            ? await this.repository.recordGroupEvent(groupOpenid, payload.t)
            : null;
        if (payload.t === 'INTERACTION_CREATE' && payload.id && typeof this.client?.acknowledgeInteraction === 'function') {
            this.client.acknowledgeInteraction(payload.id).catch((error) => {
                this.logger.error('QQ interaction acknowledgement failed:', error.message);
            });
        }
        if (isConfiguredMenuCommand(payload, this.contentConfig)) {
            this.replyWithMenu(payload).catch((error) => {
                this.logger.error('QQ menu command failed:', error.message);
            });
            return { group, commandHandled: true };
        }
        if (isConfiguredTeamQueryCommand(payload, this.contentConfig)) {
            this.replyWithActiveTeams(payload).catch((error) => {
                this.logger.error('QQ team query command failed:', error.message);
            });
            return { group, commandHandled: true };
        }
        if (configuredCommandMatches(payload, 'player_info', this.contentConfig)) {
            this.replyWithPlayerProfile(payload).catch((error) => {
                this.logger.error('QQ player info command failed:', error.message);
            });
            return { group, commandHandled: true };
        }
        if (configuredCommandMatches(payload, 'latest_news', this.contentConfig)) {
            this.replyWithLatestNews(payload).catch((error) => {
                this.logger.error('QQ latest news command failed:', error.message);
            });
            return { group, commandHandled: true };
        }
        if (configuredCommandMatches(payload, 'market', this.contentConfig)) {
            this.replyWithMarketListings(payload).catch((error) => {
                this.logger.error('QQ market command failed:', error.message);
            });
            return { group, commandHandled: true };
        }
        if (group?.proactive_messages_enabled) this.flush().catch((error) => {
            this.logger.error('QQ notification flush failed:', error.message);
        });
        return { group, ignored: !group };
    }

    async sendReplyMessages(target, messages, keyboard) {
        if (!target || !this.canSendMessages()) return false;
        const send = target.kind === 'group' ? this.client?.sendGroupMarkdown : this.client?.sendC2cMarkdown;
        if (typeof send !== 'function') return false;

        const replyId = target.messageId || target.eventId;
        for (let index = 0; index < messages.length; index += 1) {
            const options = replyId
                ? (target.messageId
                    ? { msgId: target.messageId, msgSeq: index + 1 }
                    : { eventId: target.eventId, msgSeq: index + 1 })
                : {};
            if (keyboard && index === messages.length - 1) options.keyboard = keyboard;
            await send.call(this.client, target.openid, messages[index], options);
        }
        return true;
    }

    async replyWithActiveTeams(payload) {
        const target = replyTargetFromEvent(payload);
        if (!target || !this.lobbyQuery?.getTeams || !this.canSendMessages()) return false;

        const teams = await this.lobbyQuery.getTeams(null, 'zh');
        const messages = buildConfiguredActiveTeamListMessages(teams, this.contentConfig);
        return this.sendReplyMessages(target, messages, configuredTeamListKeyboard(this.teamLobbyUrl, this.contentConfig));
    }

    async getLeaderboardVersion() {
        if (typeof this.leaderboardVersion !== 'function') return null;
        try {
            return await this.leaderboardVersion();
        } catch (error) {
            this.logger?.warn?.('QQ player profile leaderboard version lookup failed:', error.message);
            return null;
        }
    }

    async replyWithPlayerProfile(payload) {
        const target = replyTargetFromEvent(payload);
        if (!target || !this.canSendMessages()) return false;

        const { playerName, view, page } = playerProfileRequestFromCommand(payload);
        if (!playerName || playerName.length > PLAYER_NAME_MAX_LENGTH) {
            return this.sendReplyMessages(target, [configuredPlayerInfoUsageMessage(this.contentConfig)]);
        }
        if (typeof this.playerProfile !== 'function') return false;

        try {
            const [profile, leaderboardVersion] = await Promise.all([
                this.playerProfile(playerName),
                this.getLeaderboardVersion()
            ]);
            const messages = buildConfiguredPlayerProfileMessages(profile, this.contentConfig)
                .map(message => appendMarkdownFooter(message, leaderboardUpdateFooter(leaderboardVersion)));
            return this.sendReplyMessages(target, messages, configuredCommandMenuKeyboard(this.contentConfig));
        } catch (error) {
            if (error?.statusCode === 404) {
                return this.sendReplyMessages(target, [configuredPlayerInfoNotFoundMessage(playerName, this.contentConfig)]);
            }
            throw error;
        }
    }

    async replyWithMenu(payload) {
        const target = replyTargetFromEvent(payload);
        if (!target || !this.canSendMessages()) return false;
        return this.sendReplyMessages(target, [configuredMenuMessage(this.contentConfig)], configuredCommandMenuKeyboard(this.contentConfig));
    }

    async replyWithLatestNews(payload) {
        const target = replyTargetFromEvent(payload);
        if (!target || !this.canSendMessages() || typeof this.announcementQuery !== 'function') return false;

        const announcements = await this.announcementQuery({ page: 1, pageSize: LATEST_NEWS_LIMIT });
        return this.sendReplyMessages(
            target,
            [buildConfiguredLatestNewsMessage(announcements, this.newsUrl, this.contentConfig)],
            configuredCommandMenuKeyboard(this.contentConfig)
        );
    }

    async replyWithMarketListings(payload) {
        const target = replyTargetFromEvent(payload);
        if (!target || !this.canSendMessages() || typeof this.marketQuery !== 'function') return false;

        const listings = await this.marketQuery();
        return this.sendReplyMessages(
            target,
            [buildConfiguredMarketListingsMessage(listings, this.contentConfig)],
            configuredMarketKeyboard(this.marketUrl, this.contentConfig)
        );
    }

    async notifyTeamCreated(team) {
        if (!this.isConfigured()) return { queued: 0, configured: false };
        const queued = await this.repository.enqueueTeamCreated(team);
        if (queued) this.flush().catch((error) => {
            this.logger.error('QQ notification flush failed:', error.message);
        });
        return { queued, configured: true };
    }

    async flush() {
        if (!this.isConfigured()) return 0;
        if (this.flushing) return this.flushing;

        this.flushing = this.flushPending().finally(() => {
            this.flushing = null;
        });
        return this.flushing;
    }

    async flushPending() {
        const notifications = await this.repository.claimPendingNotifications(10);
        for (const notification of notifications) {
            try {
                await this.client.sendGroupMarkdown(
                    notification.group_openid,
                    buildConfiguredTeamCreatedMessage(notification.payload, this.teamLobbyUrl, this.contentConfig),
                    { keyboard: configuredTeamLobbyKeyboard(this.teamLobbyUrl, this.contentConfig) }
                );
                await this.repository.markNotificationSent(notification.id);
            } catch (error) {
                await this.repository.retryNotification(notification.id, notification.attempts, error);
                this.logger.error(`QQ team notification ${notification.id} failed:`, error.message);
            }
        }
        return notifications.length;
    }

    start() {
        if (!this.isConfigured() || this.timer) return;
        this.flush().catch((error) => this.logger.error('QQ notification initial flush failed:', error.message));
        this.timer = setInterval(() => {
            this.flush().catch((error) => this.logger.error('QQ notification poll failed:', error.message));
        }, this.intervalMs);
    }

    stop() {
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
    }
}

module.exports = {
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
    isTeamQueryCommand,
    playerNameFromCommand
};
