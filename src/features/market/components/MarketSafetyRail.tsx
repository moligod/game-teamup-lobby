import { LockKeyhole, ShieldCheck, Video } from 'lucide-react'

interface MarketSafetyRailProps {
  t: (key: string, params?: Record<string, string | number>, fallback?: string) => string
}

export function MarketSafetyRail({ t }: MarketSafetyRailProps) {
  return <aside className="market-safety-rail">
    <section className="market-rail-section"><div className="market-rail-icon"><ShieldCheck size={18} /></div><div><strong>{t('market.tradeSafely', undefined, '个人交易须知')}</strong><p>{t('market.tradeSafelyText', undefined, '买卖双方自行沟通交易，请在交易前确认商品信息。')}</p></div></section>
    <section className="market-rail-section"><div className="market-rail-icon"><LockKeyhole size={18} /></div><div><strong>{t('market.keepOnPlatform', undefined, '保留沟通记录')}</strong><p>{t('market.keepOnPlatformText', undefined, '建议在站内聊天中沟通，完成交易后再留下评价。')}</p></div></section>
    <section className="market-rail-section"><div className="market-rail-icon"><Video size={18} /></div><div><strong>{t('market.tradeWithProof', undefined, '交易保障建议')}</strong><p>{t('market.tradeWithProofText', undefined, '双方交易推荐使用闲鱼交易，并通过视频留证。')}</p></div></section>
  </aside>
}
