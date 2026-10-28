import { Bot, Boxes, Database, LayoutDashboard, Settings2, Store, UsersRound, Newspaper, type LucideIcon } from 'lucide-react'

export type AdminSectionId = 'overview' | 'announcements' | 'users' | 'operations' | 'settings' | 'qq-bot' | 'market' | 'data'

type Translate = (key: string, params?: Record<string, string | number>, fallback?: string) => string

interface AdminSectionItem {
  id: AdminSectionId
  icon: LucideIcon
  labelKey: string
  fallback: string
}

const sections: AdminSectionItem[] = [
  { id: 'overview', icon: LayoutDashboard, labelKey: 'adminConsole.overview', fallback: '概览' },
  { id: 'announcements', icon: Newspaper, labelKey: 'adminConsole.announcements', fallback: '公告管理' },
  { id: 'users', icon: UsersRound, labelKey: 'adminConsole.users', fallback: '用户管理' },
  { id: 'operations', icon: Boxes, labelKey: 'adminConsole.operations', fallback: '运营管理' },
  { id: 'settings', icon: Settings2, labelKey: 'adminConsole.settings', fallback: '集成设置' },
  { id: 'qq-bot', icon: Bot, labelKey: 'adminConsole.qqBot', fallback: 'QQ 机器人' },
  { id: 'market', icon: Store, labelKey: 'adminConsole.market', fallback: '\u5546\u54c1\u7f6e\u9876' },
  { id: 'data', icon: Database, labelKey: 'adminConsole.data', fallback: '数据维护' },
]

export function AdminSectionNav({ activeSection, onSelect, t }: { activeSection: AdminSectionId; onSelect: (section: AdminSectionId) => void; t: Translate }) {
  return (
    <nav className="admin-section-nav" aria-label={t('adminConsole.navigation', undefined, '后台功能')} role="tablist">
      {sections.map((section) => {
        const Icon = section.icon
        const selected = activeSection === section.id
        return (
          <button
            aria-selected={selected}
            className={selected ? 'active' : ''}
            key={section.id}
            onClick={() => onSelect(section.id)}
            role="tab"
            type="button"
          >
            <Icon size={17} />
            <span>{t(section.labelKey, undefined, section.fallback)}</span>
          </button>
        )
      })}
    </nav>
  )
}
