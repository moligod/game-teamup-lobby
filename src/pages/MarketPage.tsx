import { useApp } from '../app/app-context'
import { MarketView } from '../features/market/components/MarketView'

export default function MarketPage() {
  const app = useApp()
  return <MarketView onlineUserIds={app.onlineUserIds} user={app.user} token={app.token} loginWithQQ={app.openLogin} />
}
