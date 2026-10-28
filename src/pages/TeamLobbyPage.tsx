import { useApp } from '../app/app-context'
import { LobbyView } from '../features/lobby/components/LobbyView'

export default function TeamLobbyPage() {
  const app = useApp()
  return (
    <LobbyView
      loginWithQQ={app.loginWithQQ}
      onlineUserIds={app.onlineUserIds}
      user={app.user}
    />
  )
}
