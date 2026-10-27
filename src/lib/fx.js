// 多幣別:出國記帳時用當地幣別輸入,存檔時換算成新台幣(所有分帳計算仍以 NT$ 為準)。
// 紀錄會另外保留 fx = { cur, rate, orig },列表上顯示原幣金額,編輯時也能用原幣改。
export const BASE = 'TWD'

export const CURRENCIES = [
  { code: 'TWD', flag: '🇹🇼', symbol: 'NT$', name: '新台幣', digits: 0 },
  { code: 'JPY', flag: '🇯🇵', symbol: '¥', name: '日圓', digits: 0 },
  { code: 'KRW', flag: '🇰🇷', symbol: '₩', name: '韓元', digits: 0 },
  { code: 'USD', flag: '🇺🇸', symbol: 'US$', name: '美元', digits: 2 },
  { code: 'EUR', flag: '🇪🇺', symbol: '€', name: '歐元', digits: 2 },
  { code: 'HKD', flag: '🇭🇰', symbol: 'HK$', name: '港幣', digits: 2 },
  { code: 'CNY', flag: '🇨🇳', symbol: 'CN¥', name: '人民幣', digits: 2 },
  { code: 'THB', flag: '🇹🇭', symbol: '฿', name: '泰銖', digits: 2 },
  { code: 'VND', flag: '🇻🇳', symbol: '₫', name: '越南盾', digits: 0 },
  { code: 'SGD', flag: '🇸🇬', symbol: 'S$', name: '新加坡幣', digits: 2 },
  { code: 'MYR', flag: '🇲🇾', symbol: 'RM', name: '馬幣', digits: 2 },
  { code: 'GBP', flag: '🇬🇧', symbol: '£', name: '英鎊', digits: 2 },
  { code: 'AUD', flag: '🇦🇺', symbol: 'A$', name: '澳幣', digits: 2 },
]
export const CUR_BY_CODE = Object.fromEntries(CURRENCIES.map((c) => [c.code, c]))

// 離線或抓不到時用的概略匯率(1 單位外幣 = ? 新台幣)
export const FALLBACK_RATES = {
  TWD: 1, JPY: 0.21, KRW: 0.023, USD: 32, EUR: 35, HKD: 4.1, CNY: 4.45, THB: 0.95, VND: 0.0013, SGD: 24.5, MYR: 7.2, GBP: 41, AUD: 21,
}

/** 外幣金額 → 新台幣(整數) */
export function toBase(amount, rate) {
  const a = Number(amount), r = Number(rate)
  if (!Number.isFinite(a) || !Number.isFinite(r) || r <= 0) return NaN
  return Math.round(a * r)
}

/** 原幣顯示:'¥3,000'、'US$12.50' */
export function fmtCur(amount, code) {
  const c = CUR_BY_CODE[code] || { symbol: code + ' ', digits: 2 }
  const n = Number(amount)
  if (!Number.isFinite(n)) return ''
  const digits = Number.isInteger(n) ? 0 : c.digits
  return c.symbol + n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

/** 匯率顯示:小匯率多留幾位(VND 0.0013、JPY 0.2134、USD 32.15) */
export function fmtRate(rate) {
  const r = Number(rate)
  if (!Number.isFinite(r) || r <= 0) return ''
  const d = r < 0.01 ? 5 : r < 1 ? 4 : 2
  return String(Number(r.toFixed(d)))
}

/** 從 API 回應(以 TWD 為基準:1 TWD = x 外幣)轉成「1 外幣 = ? TWD」 */
export function invertRates(apiRates) {
  const out = { TWD: 1 }
  for (const c of CURRENCIES) {
    const v = Number(apiRates?.[c.code])
    if (c.code !== BASE && Number.isFinite(v) && v > 0) out[c.code] = 1 / v
  }
  return out
}

// ---------- 匯率快取(localStorage,6 小時內不重抓) ----------
const KEY = 'splitapp.fx'
const TTL = 6 * 3600e3

export function cachedRates() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (v && v.rates) return v
  } catch { /* 無痕模式等 */ }
  return null
}

export async function fetchRates({ force = false } = {}) {
  const cache = cachedRates()
  if (!force && cache && Date.now() - cache.at < TTL) return cache
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/TWD')
    const json = await res.json()
    if (json?.result !== 'success') throw new Error('bad response')
    const out = { at: Date.now(), rates: invertRates(json.rates), live: true }
    try { localStorage.setItem(KEY, JSON.stringify(out)) } catch { /* ignore */ }
    return out
  } catch {
    return cache || { at: 0, rates: { ...FALLBACK_RATES }, live: false }
  }
}

export function rateOf(code, store) {
  return store?.rates?.[code] ?? FALLBACK_RATES[code] ?? 1
}
