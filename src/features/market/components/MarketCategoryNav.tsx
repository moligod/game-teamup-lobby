import { Boxes, CircleDollarSign, Gamepad2, KeyRound, ShieldCheck } from 'lucide-react'
import { marketCategories } from '../data/market-catalog'
import type { MarketCategoryId } from '../types'

interface MarketCategoryNavProps {
  activeCategory: MarketCategoryId
  onSelect: (category: MarketCategoryId) => void
  t: (key: string) => string
}

const categoryIcons = { flux: CircleDollarSign, items: Boxes, boosting: Gamepad2, accounts: ShieldCheck, codes: KeyRound } satisfies Record<MarketCategoryId, typeof CircleDollarSign>

export function MarketCategoryNav({ activeCategory, onSelect, t }: MarketCategoryNavProps) {
  return <aside className="market-category-nav" aria-label={t('market.categoryNav')}>
    <div className="market-category-heading"><span>{t('market.browseByCategory')}</span><small>{t('marketSeller.categoryNavHint')}</small></div>
    <div className="market-category-list">
      {marketCategories.map((category) => {
        const Icon = categoryIcons[category.id]
        const active = activeCategory === category.id
        return <button aria-pressed={active} className={active ? 'market-category-item active' : 'market-category-item'} key={category.id} onClick={() => onSelect(category.id)} type="button">
          <Icon size={17} /><span><strong>{t(category.labelKey)}</strong><small>{t(`marketSeller.categoryDescriptions.${category.id}`)}</small></span>
        </button>
      })}
    </div>
  </aside>
}
