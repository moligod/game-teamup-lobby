const QQ_BOT_COMMAND_KEYS = Object.freeze([
    'team_list',
    'player_info',
    'latest_news',
    'market',
    'menu',
    'help'
]);

const QQ_BOT_CARD_KEYS = Object.freeze([
    'team_notification',
    'team_list',
    'player_info',
    'latest_news',
    'market',
    'menu'
]);

const MAX_COMMAND_LENGTH = 32;
const MAX_CARD_TEMPLATE_LENGTH = 2_000;

const DEFAULT_QQ_BOT_CONTENT_CONFIG = Object.freeze({
    commands: Object.freeze({
        team_list: '\u961f\u4f0d\u5217\u8868',
        player_info: '\u73a9\u5bb6\u4fe1\u606f',
        latest_news: '\u6700\u65b0\u8d44\u8baf',
        market: '\u4ea4\u6613\u5e02\u573a',
        menu: '\u83dc\u5355',
        help: '\u5e2e\u52a9'
    }),
    cards: Object.freeze({
        team_notification: [
            '## TroveBBS \u65b0\u7ec4\u961f',
            '**\u961f\u4f0d**\uff1a{{team_name}}',
            '**\u7c7b\u578b**\uff1a{{team_type}}',
            '**\u961f\u957f**\uff1a{{leader_name}}',
            '**\u4eba\u6570**\uff1a{{current_members}}/{{max_members}}',
            '**\u6700\u4f4e\u6218\u529b**\uff1a{{min_combat_power}}',
            '',
            '[\u6253\u5f00\u7ec4\u961f\u5927\u5385]({{team_lobby_url}})'
        ].join('\n'),
        team_list: '{{title}}\n{{body}}',
        player_info: '{{title}}\n{{body}}',
        latest_news: '{{title}}\n{{body}}',
        market: '{{title}}\n{{body}}',
        menu: '## TroveBBS \u83dc\u5355\n\u8bf7\u9009\u62e9\u4e0b\u65b9\u529f\u80fd\u3002'
    })
});

function createDefaultQqBotContentConfig() {
    return {
        commands: { ...DEFAULT_QQ_BOT_CONTENT_CONFIG.commands },
        cards: { ...DEFAULT_QQ_BOT_CONTENT_CONFIG.cards }
    };
}

function normalizeCommand(value, fieldName) {
    if (typeof value !== 'string') throw new Error(`${fieldName} must be a string`);
    const normalized = value.trim().replace(/^\/+/, '');
    if (!normalized) throw new Error(`${fieldName} is required`);
    if (normalized.length > MAX_COMMAND_LENGTH) throw new Error(`${fieldName} is too long`);
    if (/\s/.test(normalized)) throw new Error(`${fieldName} must not contain whitespace`);
    return normalized;
}

function normalizeTemplate(value, fieldName) {
    if (typeof value !== 'string') throw new Error(`${fieldName} must be a string`);
    const normalized = value.trim();
    if (!normalized) throw new Error(`${fieldName} is required`);
    if (normalized.length > MAX_CARD_TEMPLATE_LENGTH) throw new Error(`${fieldName} is too long`);
    return normalized;
}

function validateQqBotContentConfig(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('QQ bot content configuration must be an object');
    }
    if (!value.commands || typeof value.commands !== 'object' || Array.isArray(value.commands)) {
        throw new Error('commands must be an object');
    }
    if (!value.cards || typeof value.cards !== 'object' || Array.isArray(value.cards)) {
        throw new Error('cards must be an object');
    }

    const commands = Object.fromEntries(QQ_BOT_COMMAND_KEYS.map((key) => [
        key,
        normalizeCommand(value.commands[key], `commands.${key}`)
    ]));
    if (new Set(Object.values(commands)).size !== QQ_BOT_COMMAND_KEYS.length) {
        throw new Error('QQ bot commands must be unique');
    }

    const cards = Object.fromEntries(QQ_BOT_CARD_KEYS.map((key) => [
        key,
        normalizeTemplate(value.cards[key], `cards.${key}`)
    ]));

    return { commands, cards };
}

function parseQqBotContentConfig(value) {
    if (typeof value !== 'string' || !value.trim()) return createDefaultQqBotContentConfig();
    try {
        return validateQqBotContentConfig(JSON.parse(value));
    } catch {
        return createDefaultQqBotContentConfig();
    }
}

function resolveQqBotContentConfig(value) {
    if (typeof value === 'string') return parseQqBotContentConfig(value);
    try {
        return validateQqBotContentConfig(value);
    } catch {
        return createDefaultQqBotContentConfig();
    }
}

function renderQqBotMarkdown(template, values = {}) {
    return String(template || '').replace(/\{\{([a-z_]+)\}\}/g, (placeholder, key) => (
        Object.hasOwn(values, key) ? String(values[key] ?? '') : placeholder
    ));
}

module.exports = {
    DEFAULT_QQ_BOT_CONTENT_CONFIG,
    MAX_CARD_TEMPLATE_LENGTH,
    MAX_COMMAND_LENGTH,
    QQ_BOT_CARD_KEYS,
    QQ_BOT_COMMAND_KEYS,
    createDefaultQqBotContentConfig,
    parseQqBotContentConfig,
    renderQqBotMarkdown,
    resolveQqBotContentConfig,
    validateQqBotContentConfig
};
