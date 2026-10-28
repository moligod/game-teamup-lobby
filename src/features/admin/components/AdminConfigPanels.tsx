import { type FormEvent, useEffect, useState } from 'react'
import { Bot, DatabaseZap, ImageUp, KeyRound, Newspaper, RotateCcw, Save } from 'lucide-react'
import { saveImageHostConfig, saveQqBotConfig, saveQqBotContentConfig, saveQqOauthConfig } from '../api/admin-api'
import { formatDate, getErrorMessage } from '@/lib/format'
import { useI18n } from '@/lib/i18n-react'
import type { AdminImageHostConfig, AdminQqBotCardKey, AdminQqBotCommandKey, AdminQqBotConfig, AdminQqBotContentConfig, AdminQqOauthConfig } from '@/lib/types'
import { Button } from '@/shared/ui/Button'
import { Badge } from '@/shared/ui/Badge'
import { Notice } from '@/shared/ui/Notice'

export function QqOauthConfigPanel({
  config,
  token,
  onSaved,
  onError,
}: {
  config: AdminQqOauthConfig | null
  token: string | null
  onSaved: (config: AdminQqOauthConfig) => void
  onError: (message: string) => void
}) {
  const { t } = useI18n()
  const [apiUrl, setApiUrl] = useState('https://your-oauth-provider.example/')
  const [appid, setAppid] = useState('')
  const [appkey, setAppkey] = useState('')
  const [callbackUrl, setCallbackUrl] = useState('')
  const [frontendSuccessPath, setFrontendSuccessPath] = useState('/')
  const [clearAppkey, setClearAppkey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setApiUrl(config?.api_url || 'https://your-oauth-provider.example/')
    setAppid(config?.appid ?? '')
    setAppkey('')
    setCallbackUrl(config?.callback_url ?? '')
    setFrontendSuccessPath(config?.frontend_success_path || '/')
    setClearAppkey(false)
  }, [config])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setSaved(false)
    try {
      const payload = await saveQqOauthConfig(
        {
          api_url: apiUrl,
          appid,
          appkey,
          clear_appkey: clearAppkey,
          callback_url: callbackUrl,
          frontend_success_path: frontendSuccessPath,
        },
        token!,
      )
      onSaved(payload)
      setAppkey('')
      setClearAppkey(false)
      setSaved(true)
    } catch (err) {
      onError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="panel admin-section oauth-config-panel">
      <div className="section-head">
        <h2>
          <KeyRound size={18} />
          {t('admin_react.qqOauthConfig', {}, 'QQ 登录配置')}
        </h2>
        <Badge tone={config?.appid && config?.appkey_configured ? 'success' : 'warning'}>
          {config?.appid && config?.appkey_configured
            ? t('admin_react.qqOauthConfigured', {}, '已配置')
            : t('admin_react.qqOauthMissing', {}, '未配置')}
        </Badge>
      </div>
      <form className="form-stack" onSubmit={submit}>
        <label>
          QQ_OAUTH_API_URL
          <input value={apiUrl} onChange={(event) => setApiUrl(event.target.value)} placeholder="https://your-oauth-provider.example/" required />
        </label>
        <label>
          APPID
          <input value={appid} onChange={(event) => setAppid(event.target.value)} placeholder="OAuth2 client id" required />
        </label>
        <label>
          APPKEY
          <input
            type="password"
            value={appkey}
            onChange={(event) => setAppkey(event.target.value)}
            placeholder={config?.appkey_configured ? t('admin_react.keepAppkey', {}, '留空则保留当前 APPKEY') : t('admin_react.enterAppkey', {}, '输入 APPKEY')}
            disabled={clearAppkey}
          />
        </label>
        <label>
          QQ_OAUTH_CALLBACK_URL
          <input value={callbackUrl} onChange={(event) => setCallbackUrl(event.target.value)} placeholder="https://example.com/api/auth/qq/callback" />
        </label>
        <label>
          QQ_OAUTH_FRONTEND_SUCCESS_PATH
          <input value={frontendSuccessPath} onChange={(event) => setFrontendSuccessPath(event.target.value)} placeholder="/" />
        </label>
        <label className="checkbox-row">
          <input type="checkbox" checked={clearAppkey} onChange={(event) => setClearAppkey(event.target.checked)} />
          {t('admin_react.clearAppkey', {}, '清空当前 APPKEY')}
        </label>
        <Button variant="primary" fullWidth type="submit" loading={saving} disabled={!apiUrl.trim() || !appid.trim()} icon={<KeyRound size={16} />}>
          {saving ? t('common.processing') : t('admin_react.saveQqOauthConfig', {}, '保存 QQ 登录配置')}
        </Button>
      </form>
      {saved ? <Notice variant="success">{t('admin_react.qqOauthConfigSaved', {}, 'QQ 登录配置已保存')}</Notice> : null}
      <div className="settings-status">
        <span>{t('admin_react.lastUpdated', {}, '最后修改')}: {formatDate(config?.updated_at)}</span>
      </div>
    </section>
  )
}

export function QqBotConfigPanel({
  config,
  token,
  onSaved,
  onError,
}: {
  config: AdminQqBotConfig | null
  token: string | null
  onSaved: (config: AdminQqBotConfig) => void
  onError: (message: string) => void
}) {
  const { t } = useI18n()
  const [appId, setAppId] = useState('')
  const [appSecret, setAppSecret] = useState('')
  const [clearAppSecret, setClearAppSecret] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setAppId(config?.app_id ?? '')
    setAppSecret('')
    setClearAppSecret(false)
  }, [config])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setSaved(false)
    try {
      const payload = await saveQqBotConfig({
        app_id: appId,
        app_secret: appSecret,
        clear_app_secret: clearAppSecret,
      }, token!)
      onSaved(payload)
      setAppSecret('')
      setClearAppSecret(false)
      setSaved(true)
    } catch (err) {
      onError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const configured = Boolean(config?.app_id && config?.app_secret_configured)

  return (
    <section className="panel admin-section qq-bot-config-panel">
      <div className="section-head">
        <h2><Bot size={18} /> {t('admin_react.qqBotConfig', {}, 'QQ 机器人配置')}</h2>
        <Badge tone={configured ? 'success' : 'warning'}>{configured ? t('admin_react.qqBotConfigured', {}, '已配置') : t('admin_react.qqBotMissing', {}, '未配置')}</Badge>
      </div>
      <form className="form-stack" onSubmit={submit}>
        <label>
          QQ_BOT_APP_ID
          <input value={appId} onChange={(event) => setAppId(event.target.value)} placeholder="QQ Bot AppID" required />
        </label>
        <label>
          QQ_BOT_APP_SECRET
          <input
            type="password"
            value={appSecret}
            onChange={(event) => setAppSecret(event.target.value)}
            placeholder={config?.app_secret_configured ? t('admin_react.keepQqBotSecret', {}, '留空则保留当前 AppSecret') : t('admin_react.enterQqBotSecret', {}, '输入 QQ Bot AppSecret')}
            disabled={clearAppSecret}
          />
        </label>
        <label className="checkbox-row">
          <input type="checkbox" checked={clearAppSecret} onChange={(event) => setClearAppSecret(event.target.checked)} />
          {t('admin_react.clearQqBotSecret', {}, '清空当前 QQ Bot AppSecret')}
        </label>
        <Button variant="primary" fullWidth type="submit" loading={saving} disabled={!appId.trim()} icon={<Bot size={16} />}>
          {saving ? t('common.processing') : t('admin_react.saveQqBotConfig', {}, '保存 QQ 机器人配置')}
        </Button>
      </form>
      {saved ? <Notice variant="success">{t('admin_react.qqBotConfigSaved', {}, 'QQ 机器人配置已保存')}</Notice> : null}
      <div className="settings-status"><span>{t('admin_react.lastUpdated', {}, '最后修改')}: {formatDate(config?.updated_at)}</span></div>
    </section>
  )
}

const QQ_BOT_COMMAND_FIELDS: Array<{ key: AdminQqBotCommandKey; label: string }> = [
  { key: 'team_list', label: '队伍列表' },
  { key: 'player_info', label: '玩家信息' },
  { key: 'latest_news', label: '最新资讯' },
  { key: 'market', label: '交易市场' },
  { key: 'menu', label: '菜单' },
  { key: 'help', label: '帮助' },
]

const QQ_BOT_CARD_FIELDS: Array<{ key: AdminQqBotCardKey; label: string; variables: string }> = [
  { key: 'team_notification', label: '组队推送', variables: '{{team_name}} {{team_type}} {{leader_name}} {{current_members}} {{max_members}} {{min_combat_power}} {{team_lobby_url}}' },
  { key: 'team_list', label: '队伍列表', variables: '{{title}} {{body}}' },
  { key: 'player_info', label: '玩家信息', variables: '{{title}} {{body}}' },
  { key: 'latest_news', label: '最新资讯', variables: '{{title}} {{body}}' },
  { key: 'market', label: '交易市场', variables: '{{title}} {{body}}' },
  { key: 'menu', label: '菜单', variables: '{{team_list_command}} {{player_info_command}} {{latest_news_command}} {{market_command}} {{menu_command}} {{help_command}}' },
]

function createDefaultQqBotContentDraft(): Pick<AdminQqBotContentConfig, 'commands' | 'cards'> {
  return {
    commands: {
      team_list: '队伍列表',
      player_info: '玩家信息',
      latest_news: '最新资讯',
      market: '交易市场',
      menu: '菜单',
      help: '帮助',
    },
    cards: {
      team_notification: [
        '## Game Hub 新组队',
        '**队伍**：{{team_name}}',
        '**类型**：{{team_type}}',
        '**队长**：{{leader_name}}',
        '**人数**：{{current_members}}/{{max_members}}',
        '**最低战力**：{{min_combat_power}}',
        '',
        '[打开组队大厅]({{team_lobby_url}})',
      ].join('\n'),
      team_list: '{{title}}\n{{body}}',
      player_info: '{{title}}\n{{body}}',
      latest_news: '{{title}}\n{{body}}',
      market: '{{title}}\n{{body}}',
      menu: '## Game Hub 菜单\n请选择下方功能。',
    },
  }
}

export function QqBotContentConfigPanel({
  config,
  token,
  onSaved,
  onError,
}: {
  config: AdminQqBotContentConfig | null
  token: string | null
  onSaved: (config: AdminQqBotContentConfig) => void
  onError: (message: string) => void
}) {
  const { t } = useI18n()
  const [commands, setCommands] = useState(() => createDefaultQqBotContentDraft().commands)
  const [cards, setCards] = useState(() => createDefaultQqBotContentDraft().cards)
  const [activeCard, setActiveCard] = useState<AdminQqBotCardKey>('team_notification')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const activeCardMeta = QQ_BOT_CARD_FIELDS.find((item) => item.key === activeCard)!

  useEffect(() => {
    const next = config || createDefaultQqBotContentDraft()
    setCommands({ ...next.commands })
    setCards({ ...next.cards })
    setSaved(false)
  }, [config])

  function restoreDefaults() {
    const defaults = createDefaultQqBotContentDraft()
    setCommands(defaults.commands)
    setCards(defaults.cards)
    setSaved(false)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setSaved(false)
    try {
      const payload = await saveQqBotContentConfig({ commands, cards }, token!)
      onSaved(payload)
      setSaved(true)
    } catch (err) {
      onError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="panel admin-section qq-bot-content-panel">
      <div className="section-head">
        <h2><Bot size={18} /> {t('admin_react.qqBotContent', {}, 'QQ 机器人指令与卡片')}</h2>
        <Badge tone="neutral">Markdown</Badge>
      </div>
      <form className="qq-bot-content-form" onSubmit={submit}>
        <div className="qq-bot-command-grid">
          {QQ_BOT_COMMAND_FIELDS.map((field) => (
            <label key={field.key}>
              <span>{field.label}</span>
              <input
                maxLength={32}
                onChange={(event) => setCommands((current) => ({ ...current, [field.key]: event.target.value }))}
                placeholder={field.label}
                required
                value={commands[field.key]}
              />
            </label>
          ))}
        </div>
        <div className="qq-bot-card-editor">
          <div aria-label={t('admin_react.qqBotCards', {}, '机器人卡片')} className="qq-bot-card-tabs" role="tablist">
            {QQ_BOT_CARD_FIELDS.map((card) => (
              <button
                aria-selected={activeCard === card.key}
                className={activeCard === card.key ? 'active' : ''}
                key={card.key}
                onClick={() => setActiveCard(card.key)}
                role="tab"
                type="button"
              >
                {card.label}
              </button>
            ))}
          </div>
          <label className="qq-bot-card-template">
            <span>{activeCardMeta.label}</span>
            <textarea
              maxLength={2000}
              onChange={(event) => setCards((current) => ({ ...current, [activeCard]: event.target.value }))}
              required
              rows={12}
              value={cards[activeCard]}
            />
          </label>
          <p className="field-hint">变量：{activeCardMeta.variables}</p>
        </div>
        <div className="qq-bot-content-actions">
          <Button icon={<RotateCcw size={16} />} onClick={restoreDefaults} type="button" variant="secondary">恢复默认</Button>
          <Button icon={<Save size={16} />} loading={saving} type="submit" variant="primary">{saving ? t('common.processing') : t('admin_react.saveQqBotContent', {}, '保存机器人内容')}</Button>
        </div>
      </form>
      {saved ? <Notice variant="success">{t('admin_react.qqBotContentSaved', {}, 'QQ 机器人指令与卡片已保存并即时生效')}</Notice> : null}
      <div className="settings-status"><span>{t('admin_react.lastUpdated', {}, '最后修改')}: {formatDate(config?.updated_at)}</span></div>
    </section>
  )
}

export function ImageHostConfigPanel({
  config,
  token,
  onSaved,
  onError,
}: {
  config: AdminImageHostConfig | null
  token: string | null
  onSaved: (config: AdminImageHostConfig) => void
  onError: (message: string) => void
}) {
  const { t } = useI18n()
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [reviewFolderId, setReviewFolderId] = useState('')
  const [clearApiKey, setClearApiKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setBaseUrl(config?.base_url ?? '')
    setApiKey('')
    setReviewFolderId(config?.review_folder_id ?? '')
    setClearApiKey(false)
  }, [config])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setSaved(false)
    try {
      const payload = await saveImageHostConfig({
        base_url: baseUrl,
        api_key: apiKey,
        clear_api_key: clearApiKey,
        review_folder_id: reviewFolderId,
      }, token!)
      onSaved(payload)
      setApiKey('')
      setClearApiKey(false)
      setSaved(true)
    } catch (err) {
      onError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="panel admin-section image-host-config-panel">
      <div className="section-head">
        <h2><ImageUp size={18} /> {t('admin_react.imageHostConfig', {}, '图床配置')}</h2>
        <Badge tone={config?.base_url && config.api_key_configured ? 'success' : 'warning'}>{config?.base_url && config.api_key_configured ? t('admin_react.imageHostConfigured', {}, '已配置') : t('admin_react.imageHostMissing', {}, '未配置')}</Badge>
      </div>
      <form className="form-stack" onSubmit={submit}>
        <label>IMAGE_HOST_BASE_URL<input onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://images.example.com" value={baseUrl} /></label>
        <label>IMAGE_HOST_API_KEY<input disabled={clearApiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={config?.api_key_configured ? t('admin_react.keepImageHostKey', {}, '留空则保留当前密钥') : t('admin_react.enterImageHostKey', {}, '输入图床 API 密钥')} type="password" value={apiKey} /></label>
        <label>IMAGE_HOST_REVIEW_FOLDER_ID<input onChange={(event) => setReviewFolderId(event.target.value)} placeholder={t('admin_react.imageHostFolderHint', {}, '可选：评价图片目标文件夹 UUID')} value={reviewFolderId} /></label>
        <label className="checkbox-row"><input checked={clearApiKey} onChange={(event) => setClearApiKey(event.target.checked)} type="checkbox" />{t('admin_react.clearImageHostKey', {}, '清空当前图床 API 密钥')}</label>
        <Button disabled={!baseUrl.trim() && !clearApiKey} fullWidth icon={<ImageUp size={16} />} loading={saving} type="submit" variant="primary">{saving ? t('common.processing') : t('admin_react.saveImageHostConfig', {}, '保存图床配置')}</Button>
      </form>
      {saved ? <Notice variant="success">{t('admin_react.imageHostConfigSaved', {}, '图床配置已保存')}</Notice> : null}
      <div className="settings-status"><span>{t('admin_react.lastUpdated', {}, '最后修改')}: {formatDate(config?.updated_at)}</span></div>
    </section>
  )
}
