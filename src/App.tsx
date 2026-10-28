import { GAME_NAME } from './config/constants'
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
    title: GAME_NAME ? `${GAME_NAME} | Game Hub` : 'Game Hub | 游戏组队大厅',
    description: 'Game Hub 提供组队、聊天与玩家交易。',
  },
  '/lobby': {
    canonicalPath: '/',
    title: GAME_NAME ? `${GAME_NAME} | Game Hub` : 'Game Hub | 游戏组队大厅',
    description: 'Game Hub 提供组队、聊天与玩家交易。',
  },
  '/leaderboard': {
    canonicalPath: '/leaderboard',
    title: '排行榜 | Game Hub',
    description: '查看玩家排行榜。',
  },
  '/market': {
    canonicalPath: '/market',
    title: '交易市场 | Game Hub',
    description: '浏览玩家发布的交易信息。',
  },
  '/news': {
    canonicalPath: '/news',
    title: '最新公告与资讯 | Game Hub',
    description: '查看游戏公告、更新、活动及测试资讯。',
  },
  '/dishonesty': {
    canonicalPath: '/dishonesty',
    title: '失信名单 | Game Hub',
    description: '查询已审核的交易失信记录。',
  },
  '/about': {
    canonicalPath: '/about',
    title: '关于 Game Hub',
    description: '了解 Game Hub 的组队、聊天、资讯与交易功能。',
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
          title: 'Game Hub 管理后台',
          description: 'Game Hub 管理后台。',
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
  const { auth, loginWithQQ, loginLocal, logout } = useAuthSession()
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

  const openLogin = useCallback(async () => { navigate('/#login') }, [navigate])

  const contextValue = useMemo<AppContextValue>(
    () => ({
      ...auth,
      onlineUsers,
      onlineUserIds,
      loginWithQQ,
      loginLocal,
      openLogin,
      logout,
      refreshOnlineUsers,
    }),
    [auth, loginWithQQ, loginLocal, openLogin, logout, onlineUserIds, onlineUsers, refreshOnlineUsers],
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
              <strong>Game Hub</strong>
              <small>{GAME_NAME || t('app.brandSubtitle')}</small>
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
