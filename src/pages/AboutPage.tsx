import { useI18n } from '../lib/i18n-react'

function AboutPage() {
  const { t } = useI18n()

  return (
    <section className="main-stack readable">
      <div className="toolbar">
        <div>
          <h1>TroveBBS</h1>
          <p>{t('about_react.subtitle')}</p>
        </div>
      </div>
      <div className="panel doc-panel">
        <p>{t('about_react.body')}</p>
      </div>
    </section>
  )
}

export default AboutPage
