import { useRef, useState, type FormEvent } from 'react'
import { Check, Info, LogIn, Pencil, Plus, Power, X } from 'lucide-react'
import { marketCategories } from '../data/market-catalog'
import type { MarketCategoryId } from '../types'
import { formatDate, getErrorMessage } from '@/lib/format'
import type { MarketListing, MarketListingInput, User } from '@/lib/types'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { IconButton } from '@/shared/ui/IconButton'
import { Notice } from '@/shared/ui/Notice'
import { Panel } from '@/shared/ui/Panel'

interface ListingFormValues {
  title: string
  description: string
  price: string
  priceUnit: string
  stock: string
  playerName: string
}


const emptyValues: ListingFormValues = {
  title: '',
  description: '',
  price: '',
  priceUnit: '个',
  stock: '',
  playerName: '',
}

function itemPriceUnit(value: string) {
  return value === '千' || value === '万' || value === '个' ? value : '个'
}

function valuesFromListing(listing: MarketListing): ListingFormValues {
  return {
    title: listing.title,
    description: listing.description,
    price: String(listing.price),
    priceUnit: itemPriceUnit(listing.price_unit),
    stock: listing.stock,
    playerName: listing.player_name,
  }
}

function inputFromListing(listing: MarketListing, isActive = Boolean(listing.is_active)): MarketListingInput {
  return {
    category: listing.category,
    title: listing.title,
    description: listing.description,
    price: Number(listing.price),
    price_unit: listing.category === 'items' ? itemPriceUnit(listing.price_unit) : listing.price_unit,
    stock: listing.category === 'accounts' ? '' : listing.stock,
    player_name: listing.category === 'accounts' ? listing.player_name : '',
    delivery_method: listing.delivery_method,
    is_active: isActive,
  }
}

function formatListingPrice(listing: MarketListing) {
  const price = String(Number(listing.price))
  const priceWithCurrency = `${price} CNY`
  if (listing.category === 'flux') return `${priceWithCurrency}${listing.price_unit === 'per_million' ? ' / 1M' : ''}`
  return listing.category === 'items' ? `${priceWithCurrency} / ${itemPriceUnit(listing.price_unit)}` : priceWithCurrency
}

interface MarketSellFormProps {
  category: MarketCategoryId
  error: string | null
  listings: MarketListing[]
  loginWithQQ: () => Promise<void>
  onCategoryChange: (category: MarketCategoryId) => void
  onSave: (id: number | null, input: MarketListingInput) => Promise<void>
  t: (key: string, params?: Record<string, string | number>, fallback?: string) => string
  user: User | null
}

export function MarketSellForm({
  category,
  error,
  listings,
  loginWithQQ,
  onCategoryChange,
  onSave,
  t,
  user,
}: MarketSellFormProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const publishIntent = useRef(true)
  const [values, setValues] = useState<ListingFormValues>(() => ({ ...emptyValues }))
  const [editing, setEditing] = useState<MarketListing | null>(null)
  const [saving, setSaving] = useState(false)
  const [loginBusy, setLoginBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<number | null>(null)

  function setValue<Key extends keyof ListingFormValues>(key: Key, value: ListingFormValues[Key]) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  const validateAccountGameName = async (value: string) => Boolean(value.trim())

  function resetEditor() {
    setEditing(null)
    setValues({ ...emptyValues })
    setActionError(null)
  }

  function editListing(listing: MarketListing) {
    onCategoryChange(listing.category)
    setEditing(listing)
    setValues(valuesFromListing(listing))
    setMessage(null)
    setActionError(null)
  }

  async function submitListing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setMessage(null)
    setActionError(null)
    const isActive = publishIntent.current
    try {
      if (category === 'accounts' && !await validateAccountGameName(values.playerName)) return
      await onSave(editing?.id ?? null, {
        category,
        title: values.title,
        description: values.description,
        price: Number(values.price),
        price_unit: category === 'items' ? values.priceUnit : editing?.price_unit ?? 'each',
        stock: category === 'accounts' ? '' : values.stock,
        player_name: category === 'accounts' ? values.playerName.trim() : '',
        delivery_method: editing?.delivery_method ?? '',
        is_active: isActive,
      })
      setMessage(t(isActive ? 'marketSeller.listingPublished' : 'marketSeller.draftSaved'))
      resetEditor()
    } catch (err) {
      setActionError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function toggleListing(listing: MarketListing) {
    setTogglingId(listing.id)
    setActionError(null)
    try {
      await onSave(listing.id, inputFromListing(listing, !listing.is_active))
      setMessage(t(listing.is_active ? 'marketSeller.listingUnlisted' : 'marketSeller.listingPublished'))
    } catch (err) {
      setActionError(getErrorMessage(err))
    } finally {
      setTogglingId(null)
    }
  }

  async function beginLogin() {
    setLoginBusy(true)
    setActionError(null)
    try {
      await loginWithQQ()
    } catch (err) {
      setActionError(getErrorMessage(err))
      setLoginBusy(false)
    }
  }

  if (!user) {
    return (
      <section className="market-sell-layout">
        <div className="market-sell-intro"><span className="market-eyebrow"><Plus size={15} /> {t('market.sellerCenter')}</span><h1>{t('market.publishTitle')}</h1><p>{t('market.publishSubtitle')}</p></div>
        <Panel className="market-login-required">
          <LogIn size={22} />
          <div><h2>{t('marketSeller.loginRequiredTitle')}</h2><p>{t('marketSeller.loginRequiredText')}</p></div>
          <Button icon={<LogIn size={16} />} loading={loginBusy} onClick={() => void beginLogin()} variant="primary">{t('marketSeller.loginButton')}</Button>
          {actionError ? <Notice variant="error">{actionError}</Notice> : null}
        </Panel>
      </section>
    )
  }

  return (
    <div className="market-seller-center">
      <section className="market-sell-layout">
        <div className="market-sell-intro"><span className="market-eyebrow"><Plus size={15} /> {t('market.sellerCenter')}</span><h1>{editing ? t('marketSeller.editTitle') : t('market.publishTitle')}</h1><p>{t('market.publishSubtitle')}</p><div className="market-sell-steps" aria-label={t('market.publishFlow')}><span><b>1</b>{t('market.stepDetails')}</span><span><b>2</b>{t('market.stepReview')}</span><span><b>3</b>{t('market.stepLive')}</span></div></div>
        <form className="market-publish-form" onSubmit={submitListing} ref={formRef}>
          {message ? <Notice variant="success"><Check size={16} /> {message}</Notice> : null}
          {error || actionError ? <Notice variant="error">{actionError || error}</Notice> : null}
          <div className="market-form-section"><div className="market-form-heading"><span>01</span><div><h2>{t('market.chooseCategory')}</h2><p>{t('market.chooseCategoryHint')}</p></div></div><div className="market-category-picker">{marketCategories.map((item) => <button aria-pressed={category === item.id} className={category === item.id ? 'active' : ''} key={item.id} onClick={() => onCategoryChange(item.id)} type="button">{t(item.labelKey)}</button>)}</div></div>
          <div className="market-form-section"><div className="market-form-heading"><span>02</span><div><h2>{t('market.listingDetails')}</h2><p>{t('market.listingDetailsHint')}</p></div></div><div className="market-form-grid">
            <label className="market-form-wide">{t('market.listingTitle')}<input maxLength={120} onChange={(event) => setValue('title', event.target.value)} required value={values.title} placeholder={t('marketC2C.listingTitlePlaceholder', undefined, '请输入商品标题')} /></label>
            <label>{t('marketC2C.unitPrice', undefined, '单价')}{category === 'items' ? <div className="market-input-suffix"><input inputMode="decimal" min="0" onChange={(event) => setValue('price', event.target.value)} required step="0.01" type="number" value={values.price} placeholder="0.00" /><select aria-label={t('marketSeller.priceUnit', undefined, '计价单位')} onChange={(event) => setValue('priceUnit', event.target.value)} value={values.priceUnit}><option value="个">个</option><option value="千">千</option><option value="万">万</option></select></div> : <input inputMode="decimal" min="0" onChange={(event) => setValue('price', event.target.value)} required step="0.01" type="number" value={values.price} placeholder="0.00" />}</label>
            {category !== 'accounts' ? <label>{category === 'boosting' ? t('market.availableTime') : t('marketC2C.remainingStockLabel', undefined, '剩余库存')}{category === 'flux' ? <input maxLength={100} onChange={(event) => setValue('stock', event.target.value)} required value={values.stock} /> : category === 'items' ? <input inputMode="numeric" maxLength={100} onChange={(event) => setValue('stock', event.target.value.replace(/\D/g, ''))} pattern="[0-9]*" required type="text" value={values.stock} /> : <input maxLength={100} onChange={(event) => setValue('stock', event.target.value)} required value={values.stock} placeholder={category === 'boosting' ? t('market.availableTimePlaceholder') : t('market.stockPlaceholder')} />}</label> : <label>{t('team_react.playerName', undefined, '游戏名')}<input maxLength={128} onChange={(event) => setValue('playerName', event.target.value)} required value={values.playerName} placeholder={t('team_react.playerNamePlaceholder', undefined, '请输入游戏名')} /></label>}
            <label className="market-form-wide">{t('marketSeller.description')}<textarea maxLength={1000} onChange={(event) => setValue('description', event.target.value)} placeholder={t('marketSeller.descriptionPlaceholder')} rows={3} value={values.description} /></label>
          </div></div>
          <Notice variant="info" className="market-publish-note"><Info size={16} /> {t('marketSeller.publishRule')}</Notice>
          <div className="market-publish-actions">
            {editing ? <Button icon={<X size={16} />} onClick={resetEditor} variant="ghost">{t('marketSeller.cancelEdit')}</Button> : null}
            <Button loading={saving} onClick={() => { publishIntent.current = false }} type="submit" variant="ghost">{t('market.saveDraft')}</Button>
            <Button icon={editing ? <Pencil size={16} /> : <Plus size={17} />} loading={saving} onClick={() => { publishIntent.current = true }} type="submit" variant="primary">{editing ? t('marketSeller.saveChanges') : t('marketSeller.publishNow')}</Button>
          </div>
        </form>
      </section>
      <section className="market-my-listings">
        <div className="market-my-listings-heading"><div><h2>{t('marketSeller.myListings')}</h2><p>{t('marketSeller.myListingsHint')}</p></div><Badge tone="info">{listings.length}</Badge></div>
        <div className="market-my-listings-rows">
          {listings.map((listing) => (
            <article className="market-my-listing" key={listing.id}>
              <div><strong>{listing.title}</strong><span>{t(`market.categories.${listing.category}`)} / {formatListingPrice(listing)}</span><small>{listing.category !== 'accounts' ? <>{listing.category === 'flux' ? t('marketC2C.remainingStock', { stock: listing.stock }, `剩余库存 ${listing.stock}`) : t('marketC2C.remainingStock', { stock: listing.stock }, `剩余库存 ${listing.stock}`)} / </> : null}{formatDate(listing.updated_at || listing.created_at)}</small></div>
              <Badge tone={listing.is_active ? 'success' : 'neutral'}>{listing.is_active ? t('marketSeller.listed') : t('marketSeller.draft')}</Badge>
              <div className="market-my-listing-actions"><IconButton label={t('marketSeller.edit')} onClick={() => editListing(listing)}><Pencil size={15} /></IconButton><IconButton disabled={togglingId === listing.id} label={listing.is_active ? t('marketSeller.unlist') : t('marketSeller.list')} onClick={() => void toggleListing(listing)}><Power size={15} /></IconButton></div>
            </article>
          ))}
          {listings.length === 0 ? <Panel className="market-empty"><h2>{t('marketSeller.noListings')}</h2><p>{t('marketSeller.noListingsHint')}</p></Panel> : null}
        </div>
      </section>
    </div>
  )
}
