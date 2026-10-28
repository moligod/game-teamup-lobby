import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { CalendarDays, Clock, Crown, FlaskConical, Leaf, type LucideIcon, PawPrint, Scale, Zap } from 'lucide-react'
import { formatDate, formatNumber } from '@/lib/format'
import { useI18n } from '@/lib/i18n-react'
import { getTroveActivitySnapshot, type TroveScheduleItem } from '@/lib/troveSchedule'
import { SegmentedControl } from '@/shared/ui/SegmentedControl'

export function LiveActivityPanel({ compact = false }: { compact?: boolean }) {
  const { locale } = useI18n()
  const [now, setNow] = useState(() => Date.now())
  const activity = useMemo(() => getTroveActivitySnapshot(new Date(now), locale), [locale, now])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  return <ActivityPanel activity={activity} compact={compact} />
}

export function ActivityPanel({ activity, compact = false }: { activity: ReturnType<typeof getTroveActivitySnapshot>; compact?: boolean }) {
  const { t } = useI18n()
  const [scheduleView, setScheduleView] = useState<'active' | 'away'>('active')
  const schedule = activity.schedule.filter((item) => scheduleView === 'active' ? item.active : !item.active)

  return (
    <section className={compact ? 'panel activity-panel compact' : 'panel activity-panel'}>
      <div className="section-head activity-head">
        <h2>
          <CalendarDays size={18} />
          {t('activity.title')}
        </h2>
        <p className="muted activity-time-line">
          {t('activity.serverTime')}: {activity.serverTime}
        </p>
      </div>

      <div className="activity-gridline">
        <div className="bonus-board">
          <div className="activity-kicker">
            <Zap size={15} />
            {t('activity.bonuses', {}, '游戏加成')}
          </div>
          <BonusRow
            title={t('activity.daily')}
            name={activity.daily.name}
            color={activity.daily.color}
            timer={activity.daily.resetLabel}
            normalTitle={t('activity.free')}
            normalBuffs={activity.daily.normalBuffs ?? []}
            premiumTitle={t('activity.patron')}
            premiumBuffs={activity.daily.premiumBuffs ?? []}
          />
          <BonusRow
            title={t('activity.weekly')}
            name={activity.weekly.name}
            color={activity.weekly.color}
            timer={activity.weekly.resetLabel}
            normalTitle={t('activity.effects')}
            normalBuffs={activity.weekly.buffs ?? []}
          />
        </div>

        <div className="rotation-board">
          <div className="rotation-header">
            <h3>
              <Clock size={16} />
              {t('activity.schedule')}
            </h3>
            <SegmentedControl
              ariaLabel={t('activity.schedule', {}, '\u65e5\u7a0b')}
              onValueChange={setScheduleView}
              options={[
                { value: 'active', label: t('activity.active', {}, '\u6b63\u5728\u8fdb\u884c') },
                { value: 'away', label: t('activity.away', {}, '\u5df2\u79bb\u5f00') },
              ]}
              value={scheduleView}
            />
          </div>
          <div className="rotation-list">
            {schedule.map((item) => (
              <RotationRow key={item.id} item={item} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function BonusRow({
  title,
  name,
  color,
  timer,
  normalTitle,
  normalBuffs,
  premiumTitle,
  premiumBuffs = [],
  clockPlacement = 'top',
}: {
  title: string
  name: string
  color: string
  timer: string
  normalTitle: string
  normalBuffs: string[]
  premiumTitle?: string
  premiumBuffs?: string[]
  clockPlacement?: 'top' | 'bottom'
}) {
  const pairedBuffs = Boolean(premiumTitle && premiumBuffs.length > 0)
  return (
    <article className={clockPlacement === 'bottom' ? 'bonus-row clock-bottom' : 'bonus-row'} style={{ '--activity-color': color } as CSSProperties}>
      <div className="bonus-marker">
        <Zap size={17} />
      </div>
      <div className="bonus-main">
        <div className="bonus-heading">
          <span>{title}</span>
          <strong>{name}</strong>
        </div>
        <div className={pairedBuffs ? 'bonus-effect-grid paired' : 'bonus-effect-grid'}>
          <BonusList title={normalTitle} buffs={normalBuffs} />
          {premiumTitle && premiumBuffs.length > 0 ? <BonusList title={premiumTitle} buffs={premiumBuffs} premium /> : null}
        </div>
      </div>
      <div className="bonus-clock">
        <Clock size={14} />
        <span>{timer}</span>
      </div>
    </article>
  )
}

function BonusList({ title, buffs, premium = false }: { title: string; buffs: string[]; premium?: boolean }) {
  return (
    <div className="bonus-list">
      <h3>
        {premium ? <Crown size={14} /> : <Zap size={14} />}
        {title}
      </h3>
      <ul>
        {buffs.map((buff) => (
          <li key={buff}>{buff}</li>
        ))}
      </ul>
    </div>
  )
}

function RotationRow({ item }: { item: TroveScheduleItem }) {
  const Icon = scheduleIcons[item.id]
  return (
    <article className={item.active ? 'rotation-row active' : 'rotation-row'} style={{ '--activity-color': item.color } as CSSProperties}>
      <div className="rotation-icon">
        <Icon size={17} />
      </div>
      <div className="rotation-content">
        <div className="rotation-heading">
          <div className="rotation-title-line">
            <strong>{item.name}</strong>
            <span className="state-badge">{item.status}</span>
          </div>
          <div className="rotation-time">
            {item.timeLabel} <b>{item.timeValue}</b>
          </div>
        </div>
        {item.biomes?.length ? (
          <div className="biome-tags">
            {item.biomes.map((biome) => (
              <span key={biome}>{biome}</span>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  )
}

const scheduleIcons = {
  luxion: Crown,
  corruxion: Zap,
  fluxion: Scale,
  stampy: PawPrint,
  d15: Leaf,
  mana: FlaskConical,
} satisfies Record<TroveScheduleItem['id'], LucideIcon>
