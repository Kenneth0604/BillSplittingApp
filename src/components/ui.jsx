// 共用的小元件:卡片、列、統計卡、空狀態、chips、頭貼、欄位
import { colorOf, initials } from '../lib/calc.js'

export function Card({ children, className = '' }) {
  return <div className={`card overflow-hidden ${className}`}>{children}</div>
}

export function SectionTitle({ children, className = '' }) {
  return <h2 className={`section-title mt-4 px-1 ${className}`}>{children}</h2>
}

/** 列表列:左側頭貼、中間標題與說明、右側金額與動作按鈕 */
export function Row({ avatar, title, detail, amount, amountClass = '', actions, onClick, className = '' }) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0 ${onClick ? 'cursor-pointer active:bg-surface-2' : ''} ${className}`}
    >
      {avatar}
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold text-ink">{title}</div>
        {detail && <div className="mt-0.5 truncate text-xs text-muted">{detail}</div>}
      </div>
      {amount !== undefined && <div className={`shrink-0 text-right font-bold tabular-nums text-ink ${amountClass}`}>{amount}</div>}
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </div>
  )
}

/** 列右側的小圖示按鈕 */
export function IconBtn({ children, onClick, tone = 'muted', title }) {
  const cls = { muted: 'text-muted', primary: 'text-primary', danger: 'text-danger', warning: 'text-warning' }[tone]
  return (
    <button
      type="button"
      title={title}
      onClick={(e) => { e.stopPropagation(); onClick?.(e) }}
      className={`flex h-9 w-9 items-center justify-center rounded-full text-base active:bg-surface-2 ${cls}`}
    >
      {children}
    </button>
  )
}

export function StatCard({ label, big, meta, tone = 'hero', children }) {
  const cls = { hero: 'stat-hero', green: 'stat-green', purple: 'stat-purple' }[tone]
  return (
    <section className={`${cls} rounded-3xl p-5 text-white shadow-lg`}>
      <p className="text-sm text-white/80">{label}</p>
      <div className="mt-1 text-4xl font-bold tabular-nums leading-tight">{big}</div>
      {meta && <p className="mt-1 text-xs text-white/75">{meta}</p>}
      {children}
    </section>
  )
}

export function Empty({ icon, children }) {
  return (
    <div className="empty py-8">
      {icon && <div className="mb-2 text-4xl">{icon}</div>}
      <div className="leading-relaxed">{children}</div>
    </div>
  )
}

/** 單選 / 多選 chips */
export function Chips({ options, value, onChange, multi = false, className = '' }) {
  const isOn = (v) => (multi ? (value || []).includes(v) : value === v)
  const toggle = (v) => {
    if (!multi) return onChange(v)
    const cur = value || []
    onChange(cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v])
  }
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {options.map((o) => {
        const opt = typeof o === 'object' ? o : { value: o, label: o }
        return (
          <button
            type="button"
            key={String(opt.value)}
            onClick={() => toggle(opt.value)}
            className={`chip ${isOn(opt.value) ? (opt.tone === 'success' ? 'bg-success text-white ring-success' : 'chip-active') : ''}`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export function Field({ label, children, hint }) {
  return (
    <div className="mb-4">
      {label && <span className="label">{label}</span>}
      {children}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  )
}

/** 成員頭貼:有照片用照片,沒有用色塊字首 */
export function Avatar({ member, size = 'md', color, text }) {
  const dim = size === 'lg' ? 'h-20 w-20 text-2xl' : size === 'sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-base'
  if (member?.avatar) {
    return <img src={member.avatar} alt="" className={`${dim} shrink-0 rounded-full object-cover ring-2 ring-white/60`} />
  }
  const bg = color || colorOf(member ? member.id : 0)
  return (
    <div className={`${dim} flex shrink-0 items-center justify-center rounded-full font-bold text-white shadow-sm`} style={{ background: bg }}>
      {text ?? initials(member?.name || '?')}
    </div>
  )
}

export function Select({ value, onChange, options, className = '' }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={`input ${className}`}>
      {options.map((o) => (
        <option key={String(o.value)} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

export function TypeTag({ type }) {
  const map = {
    split: ['多人分帳', 'bg-primary-soft text-primary'],
    fund: ['共同基金', 'bg-success-soft text-success'],
    personal: ['個人記帳', 'bg-accent-soft text-info'],
  }
  const [label, cls] = map[type] || map.split
  return <span className={`ml-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{label}</span>
}
