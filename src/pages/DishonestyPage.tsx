import { useApp } from '../app/app-context'
import { DishonestyReportsView } from '../features/market/components/DishonestyReportsView'
import { useI18n } from '../lib/i18n-react'

export default function DishonestyPage() {
  const { t } = useI18n()
  const app = useApp()
  return <DishonestyReportsView loginWithQQ={app.openLogin} t={t} token={app.token} />
}
