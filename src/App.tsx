import { lazy, Suspense, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { BarChart3, Compass, Home, LogIn, LogOut, Newspaper, ShieldAlert, ShoppingBag, UsersRound } from 'lucide-react'
import TeamLobbyPage from './pages/TeamLobbyPage'
import { useI18n } from './lib/i18n-react'
import { connectWebSocket, subscribeWebSocket } from './lib/ws'
import type { OnlinePresence } from './lib/types'
import { AppContext, type AppContextValue } from './app/app-context'
import { useAuthSession } from './features/auth/hooks/use-auth-session'
import { getOnlineUserIds, getPresenceStats } from './features/presence/api/presence-api'
import { Badge } from './shared/ui/Badge'
import { IconButton } from './shared/ui/IconButton'
import { SegmentedControl } from './shared/ui/SegmentedControl'
import { ThemeToggle } from './shared/ui/ThemeToggle'

const SITE_ORIGIN = window.location.origin

const loadLeaderboardPage = () => import('./pages/LeaderboardPage')
const loadAdminPage = () => import('./pages/AdminPage')
const loadAboutPage = () => import('./pages/AboutPage')
const loadMarketPage = () => import('./pages/MarketPage')
const loadNewsPage = () => import('./pages/NewsPage')
const loadDishonestyPage = () => import('./pages/DishonestyPage')

const LeaderboardPage = lazy(loadLeaderboardPage)
const AdminPage = lazy(loadAdminPage)
const AboutPage = lazy(loadAboutPage)
const MarketPage = lazy(loadMarketPage)
const NewsPage = lazy(loadNewsPage)
const DishonestyPage = lazy(loadDishonestyPage)

const SEO_PAGES: Record<string, { canonicalPath: string; title: string; description: string }> = {
  '/': {
    canonicalPath: '/',
    title: 'TroveBBS | 宝藏世界组队、开车与交易社区',
    description: 'TroveBBS 是宝藏世界玩家社区，提供组队开车、商品交易、Flux 原晶彩币、Create 服务、代肝代练与黑名单查询。',
  },
  '/lobby': {
    canonicalPath: '/',
    title: 'TroveBBS | 宝藏世界组队、开车与交易社区',
    description: 'TroveBBS 是宝藏世界玩家社区，提供组队开车、商品交易、Flux 原晶彩币、Create 服务、代肝代练与黑名单查询。',
  },
  '/leaderboard': {
    canonicalPath: '/leaderboard',
    title: 'Trove 排行榜 | 宝藏世界玩家数据 | TroveBBS',
    description: '查看宝藏世界玩家排行榜、职业与战力数据，发现适合一起组队开车的伙伴。',
  },
  '/market': {
    canonicalPath: '/market',
    title: 'Trove 商品交易 | Flux、原晶、彩币与代练 | TroveBBS',
    description: '浏览宝藏世界商品交易信息，包括 Flux、原晶、彩币、Create、代肝、代练与宝石箱。',
  },
  '/news': {
    canonicalPath: '/news',
    title: 'Trove 最新公告与资讯 | TroveBBS',
    description: '浏览来自 TrovePal 公告频道的宝藏世界最新公告、更新、活动与 PTS 资讯。',
  },
  '/dishonesty': {
    canonicalPath: '/dishonesty',
    title: 'Trove 交易黑名单 | 宝藏世界交易查询 | TroveBBS',
    description: '查询已审核的宝藏世界交易失信记录，提交可核验的交易证据，帮助社区安全购买商品。',
  },
  '/about': {
    canonicalPath: '/about',
    title: '关于 TroveBBS | 宝藏世界玩家社区',
    description: '了解 TroveBBS 如何服务宝藏世界玩家的组队、开车、资讯与商品交易需求。',
  },
}

function setMetaContent(selector: string, content: string) {
  const element = document.head.querySelector<HTMLMetaElement>(selector)
  if (element) element.content = content
}

function useRouteSeo(pathname: string) {
  useEffect(() => {
    const normalizedPath = pathname === '/' ? '/' : pathname.replace(/\/+$/, '')
    const isAdmin = normalizedPath === '/admin' || normalizedPath.startsWith('/admin/')
    const page = isAdmin
      ? {
          canonicalPath: '/admin',
          title: 'TroveBBS 管理后台',
          description: 'TroveBBS 管理后台。',
        }
      : SEO_PAGES[normalizedPath] ?? SEO_PAGES['/']
    const canonicalUrl = new URL(page.canonicalPath, SITE_ORIGIN).toString()
    const robots = isAdmin ? 'noindex, nofollow' : 'index, follow, max-image-preview:large'

    document.title = page.title
    setMetaContent('meta[name="description"]', page.description)
    setMetaContent('meta[name="robots"]', robots)
    setMetaContent('meta[property="og:title"]', page.title)
    setMetaContent('meta[property="og:description"]', page.description)
    setMetaContent('meta[property="og:url"]', canonicalUrl)
    setMetaContent('meta[name="twitter:title"]', page.title)
    setMetaContent('meta[name="twitter:description"]', page.description)

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.append(canonical)
    }
    canonical.href = canonicalUrl
  }, [pathname])
}

function App() {
  const navigate = useNavigate()
  const location = useLocation()
  useRouteSeo(location.pathname)
  const { locale, setLocale, t, supportedLocales } = useI18n()
  const { auth, loginWithQQ, logout } = useAuthSession()
  const [onlineUsers, setOnlineUsers] = useState(0)
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([])

  const refreshOnlineUsers = useCallback(async () => {
    const [stats, presence] = await Promise.all([getPresenceStats(), getOnlineUserIds()])
    setOnlineUsers(stats.online_users ?? 0)
    setOnlineUserIds(presence.online_user_ids ?? [])
  }, [])

  useEffect(() => {
    connectWebSocket(auth.token)
  }, [auth.token])

  useEffect(() => {
    refreshOnlineUsers().catch(() => undefined)
    return subscribeWebSocket((message) => {
      if (message.type === 'online_presence_update') {
        const payload = message.data as OnlinePresence
        setOnlineUsers(payload.onlineUsers ?? 0)
        setOnlineUserIds(payload.onlineUserIds ?? [])
      }
    })
  }, [refreshOnlineUsers])

  const switchLocale = useCallback(
    (nextLocale: typeof locale) => {
      setLocale(nextLocale)
      const search = new URLSearchParams(location.search)
      search.set('lang', nextLocale)
      navigate(`${location.pathname}?${search.toString()}${location.hash}`, { replace: true })
    },
    [location.hash, location.pathname, location.search, navigate, setLocale],
  )

  const contextValue = useMemo<AppContextValue>(
    () => ({
      ...auth,
      onlineUsers,
      onlineUserIds,
      loginWithQQ,
      logout,
      refreshOnlineUsers,
    }),
    [auth, loginWithQQ, logout, onlineUserIds, onlineUsers, refreshOnlineUsers],
  )

  const isAdminRoute = location.pathname === '/admin' || location.pathname.startsWith('/admin/')
  const routes = (
    <Suspense fallback={<div className="route-loading">{t('common.loading')}</div>}>
      <Routes>
      <Route path="/" element={<TeamLobbyPage />} />
      <Route path="/lobby" element={<TeamLobbyPage />} />
      <Route path="/leaderboard" element={<LeaderboardPage />} />
      <Route path="/market" element={<MarketPage />} />
      <Route path="/news" element={<NewsPage />} />
      <Route path="/dishonesty" element={<DishonestyPage />} />
      <Route path="/admin/*" element={<AdminPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="*" element={<TeamLobbyPage />} />
      </Routes>
    </Suspense>
  )

  return (
    <AppContext.Provider value={contextValue}>
      {isAdminRoute ? (
        <div className="admin-app-shell">{routes}</div>
      ) : (
      <div className="app-shell">
        <header className="topbar">
          <Link to="/" className="brand" aria-label={t('app.homeAria')}>
            <span className="brand-mark"><Compass size={19} strokeWidth={2.2} /></span>
            <span>
              <strong>TroveBBS</strong>
              <small>{t('app.brandSubtitle')}</small>
            </span>
          </Link>
          <nav className="nav-links" aria-label={t('nav.home')}>
            <NavItem to="/" icon={<Home size={17} />} label={t('app.lobby')} />
            <NavItem to="/leaderboard" icon={<BarChart3 size={17} />} label={t('nav.leaderboard')} preload={loadLeaderboardPage} />
            <NavItem to="/market" icon={<ShoppingBag size={17} />} label={t('market.nav')} preload={loadMarketPage} />
            <NavItem to="/news" icon={<Newspaper size={17} />} label={t('announcements.title')} preload={loadNewsPage} />
            <NavItem to="/dishonesty" icon={<ShieldAlert size={17} />} label={t('market.dishonestyList', undefined, '失信名单')} />
          </nav>
          <div className="topbar-actions">
            <SegmentedControl
              ariaLabel={t('language.switch')}
              onValueChange={switchLocale}
              options={supportedLocales.map((item) => ({ value: item.code, label: t(`language.${item.code}`, undefined, item.name) }))}
              value={locale}
            />
            <ThemeToggle
              darkLabel={locale === 'en' ? 'Switch to dark theme' : '切换至深色模式'}
              lightLabel={locale === 'en' ? 'Switch to light theme' : '切换至浅色模式'}
            />
            <Badge className="online-pill" icon={<UsersRound size={16} />} title={t('app.onlineUsers')}>
              {onlineUsers}
            </Badge>
            {auth.user ? (
              <>
                <span className="user-chip">{auth.user.username}</span>
                <IconButton onClick={logout} label={t('auth.logout')}>
                  <LogOut size={18} />
                </IconButton>
              </>
            ) : (
              <a className="login-jump" href="#login">
                <LogIn size={16} />
                {t('auth.login')}
              </a>
            )}
          </div>
        </header>

        <main>
          {routes}
        </main>
        <footer className="site-footer">
          <a className="ICP" href="http://beian.miit.gov.cn/" target="_blank" rel="noreferrer">
            {'\u82cfICP\u59072023028873\u53f7-1'}
          </a>
          <a href="https://trovepal.com/" target="_blank" rel="noreferrer">
            {'TrovePal'}
          </a>
        </footer>
      </div>
      )}
    </AppContext.Provider>
  )
}

function NavItem({ to, icon, label, preload }: { to: string; icon: ReactNode; label: string; preload?: () => Promise<unknown> }) {
  const preloadRoute = () => {
    void preload?.()
  }

  return (
    <NavLink
      to={to}
      className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
      onFocus={preloadRoute}
      onMouseEnter={preloadRoute}
    >
      {icon}
      {label}
    </NavLink>
  )
}

export default App
