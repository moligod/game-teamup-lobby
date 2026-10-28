import type { Locale } from './i18n'

const HOUR = 3600000
const DAY = 24 * HOUR
const WEEK = 7 * DAY

type Pair = [string, string]
type Buff = [color: string, name: Pair, normal: Pair[], patron?: Pair[]]
type ScheduleId = 'luxion' | 'corruxion' | 'fluxion' | 'stampy' | 'd15' | 'mana'

export interface TroveBuff {
  name: string
  color: string
  resetLabel: string
  normalBuffs?: string[]
  premiumBuffs?: string[]
  buffs?: string[]
}

export interface TroveScheduleItem {
  id: ScheduleId
  name: string
  status: string
  active: boolean
  color: string
  timeLabel: string
  timeValue: string
  biomes?: string[]
}

export interface TroveActivitySnapshot {
  serverTime: string
  daily: TroveBuff
  weekly: TroveBuff
  schedule: TroveScheduleItem[]
}

const DAILY: Buff[] = [
  ['#6c4fd8', ['Delve Day', '秘境日'], [['Double Crystal Drops', '水晶掉落翻倍'], ['Double Shadow Shard Drops', '暗影碎片掉落翻倍'], ['Double Inert Geode Drops', '惰性晶洞掉落翻倍']], [['Triple Crystal Drops', '水晶掉落三倍'], ['Triple Shadow Shard Drops', '暗影碎片掉落三倍'], ['Triple Inert Geode Drops', '惰性晶洞掉落三倍']]],
  ['#c26423', ['Gathering Day', '采集日'], [['Double Radiant Shard Drops', '光辉碎片掉落翻倍'], ['20% Bonus Harvest Chance', '收获几率提升20%'], ['50% Bonus Ore Chance', '矿石几率提升50%'], ['20% Bonus Fish Chance', '钓鱼几率提升20%']], [['Triple Radiant Shard Drops', '光辉碎片掉落三倍'], ['40% Bonus Harvest Chance', '收获几率提升40%'], ['100% Bonus Ore Chance', '矿石几率提升100%'], ['40% Bonus Fish Chance', '钓鱼几率提升40%']]],
  ['#2e5bd7', ['Gem Day', '宝石日'], [['Gem Upgrade Dust Cost Reduced By 10%', '宝石升级粉尘消耗降低10%'], ['25% Bonus Gem Box Drop Chance', '宝石箱掉率提升25%'], ['Dungeons Can Drop Up To 3 Lustrous Gem Boxes', '地下城最多掉落3个璀璨宝石箱']], [['Gem Upgrade Dust Cost Reduced By 20%', '宝石升级粉尘消耗降低20%'], ['50% Bonus Gem Box Drop Chance', '宝石箱掉率提升50%'], ['Dungeons Can Drop Up To 6 Lustrous Gem Boxes', '地下城最多掉落6个璀璨宝石箱']]],
  ['#8b5b2b', ['Adventure Day', '冒险日'], [['Earn 50% More Adventurine', '冒险币获取提升50%'], ['Double Chance to Find Adventure Boxes', '冒险箱掉率翻倍'], ['Double Chance To Find Talismans', '护符掉率翻倍']], [['Earn 100% More Adventurine', '冒险币获取提升100%'], ['Triple Chance to Find Adventure Boxes', '冒险箱掉率三倍'], ['Triple Chance To Find Talismans', '护符掉率三倍']]],
  ['#c33b31', ['Dragon Day', '龙币日'], [['2x Dragon Coins from Challenges', '挑战获得龙币翻倍'], ['2x Lesser Dragon Caches from Challenges', '挑战获得小龙箱翻倍'], ['2x Chance Of Finding Dragon Fragments', '龙碎片掉率翻倍']], [['3x Dragon Coins from Challenges', '挑战获得龙币三倍'], ['3x Lesser Dragon Caches from Challenges', '挑战获得小龙箱三倍'], ['3x Chance Of Finding Dragon Fragments', '龙碎片掉率三倍']]],
  ['#16a34a', ['XP Day', '经验日'], [['50% More Adventure Experience', '冒险经验提升50%'], ['50% More Club Experience', '公会经验提升50%'], ['50% More Arena Win Experience', '竞技场获胜经验提升50%']], [['100% More Adventure Experience', '冒险经验提升100%'], ['100% More Club Experience', '公会经验提升100%'], ['100% More Arena Win Experience', '竞技场获胜经验提升100%']]],
  ['#d4a106', ['Loot Day', '掉宝日'], [['+100 Magic Find', '魔寻值 +100'], ['Double Chance To Find Flux Artifacts', '原晶神器掉率翻倍'], ['Increased Chaos Chest Drop Chance', '混沌箱掉率提升']], [['+400 Magic Find', '魔寻值 +400'], ['Triple Chance To Find Flux Artifacts', '原晶神器掉率三倍'], ['Increased Chaos Chest Drop Chance', '混沌箱掉率提升']]],
]

const WEEKLY: Buff[] = [
  ['#6c4fd8', ['Double Star Bar', '双倍星条'], [['Double Cubits and Flux from Star Bar completion!', '星条完成时获得双倍金币和原晶!']]],
  ['#c26423', ['Bonus XP', '经验加成'], [['+100% Base Experience!', '+100% 基础经验!']]],
  ['#2e5bd7', ['Second Stat Reroll', '第二词条重铸'], [['Chaos Forge can reroll the second stat on equipment!', '混沌熔炉可以重铸装备第二属性!']]],
  ['#8b5b2b', ['Fast Invasions', '快速入侵'], [['Increased rate of Shadow Invasions!', '暗影入侵出现频率提升!']]],
]

const D15 = [
  ['Sundered Uplands', 'Cerise Sandsea', 'Deep Forest', 'Alkali Flats', 'Dead of Winter', 'Sundered Uplands', 'Firefly Party', 'Desert of Secrets', 'Weathered Wastelands', 'Frozen Wastes', "Frigga's Fjord", 'Abandoned Boneyard'],
  ['Cursed Vale', 'Hollow Dunes', 'Bewitching Wood', 'Primal Preserve', 'Hollow Dunes', 'Ancient Heights', 'Viking Burial Grounds', 'Spellbound Thicket', 'Saurian Swamp', 'Restless Range', 'Uncanny Valley'],
  ['Sugar Steppes', 'Volcanic Fields', 'The Lost Isles', 'Luminopolis', 'The Lost Isles', 'Blazing Emberlands', 'Cocoa Craters', 'Data Spires', 'The Lost Isles', 'Cupcake Canyon', "Dragon's Teeth", 'Luminopolis', 'The Lost Isles', 'Data Spires'],
]

const FINAL: Record<string, string> = {
  'Data Spires': 'Neon City', Luminopolis: 'Luminopolis', 'The Lost Isles': 'The Lost Isles', 'Sundered Uplands': 'Sundered Uplands',
  "Dragon's Teeth": 'Dragonfire Peaks', 'Volcanic Fields': 'Dragonfire Peaks', 'Blazing Emberlands': 'Dragonfire Peaks',
  'Sugar Steppes': 'Candoria', 'Cupcake Canyon': 'Candoria', 'Cocoa Craters': 'Candoria',
  'Deep Forest': 'Medieval Highlands', 'Firefly Party': 'Medieval Highlands', "Frigga's Fjord": 'Medieval Highlands',
  'Cursed Vale': 'Cursed Vale', 'Bewitching Wood': 'Fae Forest', 'Spellbound Thicket': 'Fae Forest', 'Uncanny Valley': 'Fae Forest',
  'Abandoned Boneyard': 'Desert Frontier', 'Alkali Flats': 'Desert Frontier', 'Desert of Secrets': 'Desert Frontier',
  'Frozen Wastes': 'Permafrost', 'Dead of Winter': 'Permafrost', 'Primal Preserve': 'Jurassic Jungle', 'Saurian Swamp': 'Jurassic Jungle',
  'Viking Burial Grounds': 'Cursed Vale', 'Ancient Heights': 'Forbidden Spires', 'Restless Range': 'Forbidden Spires',
  'Hollow Dunes': 'Geode Topside', 'Weathered Wastelands': 'Geode Topside', 'Cerise Sandsea': 'Geode Topside',
}

const ZH: Record<string, string> = {
  'Neon City': '霓虹城', Luminopolis: '光明之城', 'The Lost Isles': '遗失群岛', 'Sundered Uplands': '破碎高地',
  'Dragonfire Peaks': '龙火山峰', Candoria: '糖果国', 'Medieval Highlands': '中世纪高原', 'Cursed Vale': '诅咒峡谷',
  'Fae Forest': '妖精森林', 'Desert Frontier': '沙漠边境', Permafrost: '永冻界', 'Jurassic Jungle': '侏罗纪丛林',
  'Forbidden Spires': '禁忌尖塔', 'Geode Topside': '晶洞地表',
}

const STAMPY = ['Desert Frontier', 'The Lost Isles', 'Geode Topside', 'Neon City', 'Dragonfire Peaks', 'Permafrost', 'Candoria', 'Cursed Vale', 'Forbidden Spires', 'Fae Forest', 'Medieval Highlands', 'Jurassic Jungle', 'Sundered Uplands']
const MANA = ['Neon City', 'Jurassic Jungle', 'Dragonfire Peaks', 'Forbidden Spires', 'Sundered Uplands', 'Medieval Highlands', 'Permafrost', 'Cursed Vale', 'Desert Frontier', 'Fae Forest', 'Candoria']
const NAMES: Record<ScheduleId, Pair> = {
  luxion: ['Luxion', '\u5962\u9f99'],
  corruxion: ['Corruxion', '\u6df7\u6c8c\u9f99'],
  fluxion: ['Fluxion', '\u5c0f\u5962\u9f99'],
  stampy: ['Stampy', 'Stampy'],
  d15: ['D15 Biomes', 'D15 \u751f\u7269\u7fa4\u7cfb'],
  mana: ['Wild Trovian Mana', '\u72c2\u91ce\u5b9d\u85cf\u9b54\u529b'],
}

export function getTroveActivitySnapshot(now = new Date(), locale: Locale = 'zh'): TroveActivitySnapshot {
  const ms = now.getTime()
  const trove = new Date(ms - 11 * HOUR)
  const daily = DAILY[(trove.getUTCDay() + 6) % 7]
  const weekly = WEEKLY[mod(Math.floor((trove.getTime() - Date.UTC(2020, 2, 23)) / WEEK), WEEKLY.length)]
  return {
    serverTime: dateLabel(trove, locale),
    daily: buff(daily, nextTroveDay(trove).getTime() + 11 * HOUR - ms, locale, true),
    weekly: buff(weekly, nextTroveWeek(trove).getTime() + 11 * HOUR - ms, locale, false),
    schedule: [
      cycle('luxion', Date.UTC(2024, 2, 15, 11), 14 * DAY, 3 * DAY, '#d98b00', ms, locale),
      cycle('corruxion', Date.UTC(2024, 2, 8, 11), 14 * DAY, 3 * DAY, '#8b3db7', ms, locale),
      fluxion(ms, locale),
      rotatingBiomes('stampy', Date.UTC(2023, 8, 30, 11), WEEK, 48 * HOUR, '#f59e0b', ms, locale, (slot) => [STAMPY[mod(slot, STAMPY.length)]]),
      d15(ms, locale),
      rotatingBiomes('mana', Date.UTC(2023, 10, 20, 11), WEEK, WEEK, '#0891b2', ms, locale, (slot) => [MANA[mod(slot, MANA.length)], MANA[mod(slot - 1, MANA.length)], MANA[mod(slot - 2, MANA.length)]]),
    ],
  }
}

function buff([color, name, normal, patron]: Buff, resetMs: number, locale: Locale, hasPatron: boolean): TroveBuff {
  return hasPatron
    ? { name: tr(name, locale), color, resetLabel: countdownMinutes(resetMs, locale), normalBuffs: normal.map((v) => tr(v, locale)), premiumBuffs: (patron ?? []).map((v) => tr(v, locale)) }
    : { name: tr(name, locale), color, resetLabel: countdownMinutes(resetMs, locale), buffs: normal.map((v) => tr(v, locale)) }
}

function cycle(id: ScheduleId, base: number, interval: number, duration: number, color: string, now: number, locale: Locale) {
  let start = base + Math.floor((now - base) / interval) * interval
  if (start + duration <= now) start += interval
  return schedule(id, start, start + duration, color, now, locale)
}

function fluxion(now: number, locale: Locale) {
  let slot = Math.floor((now - Date.UTC(2023, 6, 18, 11)) / WEEK)
  let start = Date.UTC(2023, 6, 18, 11) + slot * WEEK
  if (start + 3 * DAY <= now) {
    slot += 1
    start += WEEK
  }
  const item = schedule('fluxion', start, start + 3 * DAY, '#0284c7', now, locale)
  const state = mod(slot, 2) === 0 ? tr(['Voting', '投票'], locale) : tr(['Selling', '售卖'], locale)
  return { ...item, name: item.active ? `${item.name} (${state})` : item.name }
}

function rotatingBiomes(id: ScheduleId, base: number, interval: number, duration: number, color: string, now: number, locale: Locale, names: (slot: number) => string[]) {
  let slot = Math.floor((now - base) / interval)
  let start = base + slot * interval
  if (start + duration <= now) {
    slot += 1
    start += interval
  }
  return { ...schedule(id, start, start + duration, color, now, locale), biomes: names(slot).map((name) => biome(name, locale)) }
}

function d15(now: number, locale: Locale) {
  const elapsed = now - 1718708400 * 1000
  const consumed = Math.floor(elapsed / (3 * HOUR))
  const start = now - mod(elapsed, 3 * HOUR)
  const names = D15.map((group) => group[mod(consumed, group.length)])
  return { ...schedule('d15', start, start + 3 * HOUR, '#16a34a', now, locale), biomes: names.map((name) => biome(FINAL[name] ?? name, locale)) }
}

function schedule(id: ScheduleId, start: number, end: number, color: string, now: number, locale: Locale): TroveScheduleItem {
  const active = now >= start && now < end
  return {
    id,
    name: tr(NAMES[id], locale),
    active,
    color,
    status: active ? tr(['Active', '\u6b63\u5728\u8fdb\u884c'], locale) : tr(['Away', '\u5df2\u79bb\u5f00'], locale),
    timeLabel: active ? tr(['Ends in', '结束还有'], locale) : tr(['Starts in', '开始还有'], locale),
    timeValue: countdown((active ? end : start) - now, locale),
  }
}

function nextTroveDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate() + 1))
}

function nextTroveWeek(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate() + 7 - ((value.getUTCDay() + 6) % 7)))
}

function biome(name: string, locale: Locale) {
  return locale === 'zh' ? ZH[name] ?? name : name
}

function tr(value: Pair, locale: Locale) {
  return locale === 'zh' ? value[1] : value[0]
}

function countdown(ms: number, locale: Locale) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  if (locale === 'zh') {
    if (days) return `${days}\u5929 ${hours}\u5c0f\u65f6 ${minutes}\u5206 ${seconds}\u79d2`
    if (hours) return `${hours}\u5c0f\u65f6 ${minutes}\u5206 ${seconds}\u79d2`
    if (minutes) return `${minutes}\u5206 ${seconds}\u79d2`
    return `${seconds}\u79d2`
  }
  if (days) return `${days}d ${hours}h ${minutes}m ${seconds}s`
  if (hours) return `${hours}h ${minutes}m ${seconds}s`
  if (minutes) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

function countdownMinutes(ms: number, locale: Locale) {
  const total = Math.max(0, Math.floor(ms / 60000))
  const days = Math.floor(total / 1440)
  const hours = Math.floor((total % 1440) / 60)
  const minutes = total % 60
  if (locale === 'zh') {
    if (days) return `${days}\u5929 ${hours}\u5c0f\u65f6 ${minutes}\u5206`
    if (hours) return `${hours}\u5c0f\u65f6 ${minutes}\u5206`
    return `${minutes}\u5206`
  }
  if (days) return `${days}d ${hours}h ${minutes}m`
  if (hours) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

function dateLabel(value: Date, locale: Locale) {
  return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'UTC' }).format(value)
}

function mod(value: number, size: number) {
  return ((value % size) + size) % size
}
