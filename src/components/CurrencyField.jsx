import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { BASE, CURRENCIES, CUR_BY_CODE, cachedRates, fetchRates, fmtRate, rateOf } from '../lib/fx.js'
import { createSpring, prefersReducedMotion } from '../lib/spring.js'

/**
 * 幣別選擇 + 匯率列。
 * 收合時是一顆「🇯🇵 JPY ▾」膠囊;點開後國旗列用彈簧展開(高度 + 每顆國旗依序浮現),選好自動收合。
 * 外幣時下方出現匯率卡:可手動改匯率,或按 ↻ 抓即時匯率(轉圈動畫)。
 */
export default function CurrencyField({ cur, rate, onChange, preview, keepRate = false }) {
  const [open, setOpen] = useState(false)
  const [store, setStore] = useState(() => cachedRates())
  const [loading, setLoading] = useState(false)
  const info = CUR_BY_CODE[cur] || CUR_BY_CODE[BASE]
  // 使用者手動改過匯率(或編輯舊紀錄)就不要被背景抓到的匯率蓋掉
  const manual = useRef(keepRate)

  // 第一次切到外幣時背景抓匯率(有快取就先用快取)
  useEffect(() => {
    if (cur === BASE) return
    let alive = true
    fetchRates().then((s) => {
      if (!alive) return
      setStore(s)
      if (!manual.current) onChange(cur, fmtRate(rateOf(cur, s)))
    })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur])

  function pick(code) {
    setOpen(false)
    navigator.vibrate?.(6)
    if (code === cur) return
    manual.current = false
    onChange(code, code === BASE ? null : fmtRate(rateOf(code, store)))
  }

  async function refresh() {
    setLoading(true)
    manual.current = false
    const s = await fetchRates({ force: true })
    setStore(s)
    onChange(cur, fmtRate(rateOf(cur, s)))
    setTimeout(() => setLoading(false), 350)
  }

  const when = store?.at ? new Date(store.at).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''

  return (
    <div className="mb-5">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="label mb-0">幣別</span>
        <button type="button" className="cur-pill" data-open={open || undefined} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <span className="text-lg leading-none">{info.flag}</span>
          <span className="font-semibold">{info.code}</span>
          <span className="text-muted">{info.name}</span>
          <svg className="cur-chevron" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>

      <Expand open={open}>
        <div className="cur-grid">
          {CURRENCIES.map((c, i) => (
            <button key={c.code} type="button" onClick={() => pick(c.code)} className="cur-opt" data-on={c.code === cur || undefined} style={{ '--i': i }}>
              <span className="text-2xl leading-none">{c.flag}</span>
              <span className="text-[11px] font-semibold">{c.code}</span>
            </button>
          ))}
        </div>
      </Expand>

      {cur !== BASE && (
        <div className="cur-rate card">
          <div className="flex items-center gap-2 text-sm text-ink">
            <span className="shrink-0 tabular-nums">1 {info.code} =</span>
            <input
              className="input w-24 px-2 py-1.5 text-right text-sm font-semibold tabular-nums"
              inputMode="decimal"
              value={rate ?? ''}
              onChange={(e) => { manual.current = true; onChange(cur, e.target.value.replace(/[^\d.]/g, '')) }}
              aria-label="匯率"
            />
            <span className="shrink-0">TWD</span>
            <button type="button" onClick={refresh} className="cur-refresh ml-auto" data-loading={loading || undefined} aria-label="更新匯率">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" /></svg>
            </button>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-xs text-muted">
            <span>{store?.live || store?.at ? `匯率更新於 ${when}` : '離線中,使用概略匯率,可自行修改'}</span>
            {preview != null && <span className="font-semibold text-ink">≈ <Rolling value={preview} /></span>}
          </div>
        </div>
      )}
    </div>
  )
}

// 高度彈簧展開:量內容高度,用 damping 1 的彈簧(不回彈)開合,可中斷
function Expand({ open, children }) {
  const outer = useRef(null)
  const inner = useRef(null)
  const spring = useRef(null)
  const [render, setRender] = useState(open)
  if (open && !render) setRender(true)

  useLayoutEffect(() => {
    const el = outer.current
    if (!el || !inner.current) return
    if (!spring.current) {
      spring.current = createSpring({ value: 0, onUpdate: (h) => { el.style.height = `${Math.max(0, h)}px`; el.style.opacity = String(Math.min(1, h / 40)) } })
    }
    const h = inner.current.offsetHeight
    if (prefersReducedMotion()) {
      spring.current.set(open ? h : 0)
      if (!open) setRender(false)
      return
    }
    spring.current.to(open ? h : 0, { damping: open ? 0.86 : 1, response: open ? 0.42 : 0.3, onRest: () => { if (!open) setRender(false) } })
  }, [open, render])

  useEffect(() => () => spring.current?.stop(), [])

  if (!render) return null
  return (
    <div ref={outer} className="overflow-hidden" style={{ height: 0 }} data-open={open || undefined}>
      <div ref={inner} className="cur-expand pb-3" data-open={open || undefined}>{children}</div>
    </div>
  )
}

// 換算後金額用彈簧滾動
function Rolling({ value }) {
  const ref = useRef(null)
  const spring = useRef(null)
  if (!spring.current) {
    spring.current = createSpring({ value, damping: 1, response: 0.45, onUpdate: (v) => { if (ref.current) ref.current.textContent = 'NT$ ' + Math.round(v).toLocaleString('zh-Hant') } })
  }
  useLayoutEffect(() => {
    if (ref.current && !ref.current.textContent) ref.current.textContent = 'NT$ ' + Math.round(value).toLocaleString('zh-Hant')
    if (prefersReducedMotion()) spring.current.set(value)
    else spring.current.to(value)
  }, [value])
  useEffect(() => () => spring.current.stop(), [])
  return <span ref={ref} className="tabular-nums" />
}
