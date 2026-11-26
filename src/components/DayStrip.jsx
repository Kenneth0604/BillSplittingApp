import { useRef } from 'react'
import { useApp } from '../lib/app.jsx'
import { isoToMD, todayISO } from '../lib/calc.js'

const WD = ['日', '一', '二', '三', '四', '五', '六']
const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const fromISO = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d) }
const addDays = (iso, n) => { const d = fromISO(iso); d.setDate(d.getDate() + n); return toISO(d) }

/** 📅 記記頁的日期區:一週七天,有紀錄的日子下面有小點;點標題可跳到任一天 */
export default function DayStrip() {
  const { p, day, setDay } = useApp()
  const pick = useRef(null)
  const today = todayISO()
  const sel = fromISO(day)
  const start = addDays(day, -sel.getDay()) // 這週的星期日
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  const has = new Set(p.expenses.map((e) => e.date))

  function openPicker() {
    const el = pick.current
    if (!el) return
    try { el.showPicker() } catch { el.focus(); el.click() }
  }

  return (
    <section className="card px-2 pb-2 pt-1.5">
      <div className="flex items-center justify-between px-1">
        <button type="button" onClick={() => setDay(addDays(day, -7))} className="flex h-9 w-9 items-center justify-center rounded-full text-lg text-muted active:bg-black/5" aria-label="上一週">‹</button>
        <div className="relative flex items-center gap-2">
          <button type="button" onClick={openPicker} className="rounded-full px-3 py-1 text-[15px] font-semibold text-ink active:bg-black/5">
            {sel.getFullYear() !== new Date().getFullYear() ? `${sel.getFullYear()}年` : ''}{sel.getMonth() + 1}月{sel.getDate()}日 週{WD[sel.getDay()]} ▾
          </button>
          {day !== today && <button type="button" onClick={() => setDay(today)} className="chip py-0.5 text-xs font-semibold text-primary">今天</button>}
          <input ref={pick} type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} className="pointer-events-none absolute inset-0 opacity-0" tabIndex={-1} aria-hidden />
        </div>
        <button type="button" onClick={() => setDay(addDays(day, 7))} className="flex h-9 w-9 items-center justify-center rounded-full text-lg text-muted active:bg-black/5" aria-label="下一週">›</button>
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {days.map((iso) => {
          const on = iso === day
          const d = fromISO(iso)
          return (
            <button
              key={iso}
              type="button"
              onClick={() => setDay(iso)}
              className={`flex flex-col items-center rounded-2xl py-1.5 transition-colors duration-150 ${on ? 'bg-primary text-primary-fg' : 'text-ink active:bg-black/5'}`}
            >
              <span className={`text-[11px] ${on ? 'text-primary-fg/80' : 'text-muted'}`}>{WD[d.getDay()]}</span>
              <span className={`text-[17px] font-semibold tabular-nums ${!on && iso === today ? 'text-primary' : ''}`}>{d.getDate()}</span>
              <span className={`mt-0.5 h-1.5 w-1.5 rounded-full ${has.has(isoToMD(iso)) ? (on ? 'bg-primary-fg' : 'bg-primary') : 'bg-transparent'}`} />
            </button>
          )
        })}
      </div>
    </section>
  )
}
