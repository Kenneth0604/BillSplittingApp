import { colorOf, initials } from '../lib/calc.js'

export function Card({ children, className = '' }) {
  return <div className={`card ${className}`}>{children}</div>
}

export function SectionTitle({ children, className = '' }) {
  return <h2 className={`section-title ${className}`}>{children}</h2>
}

export function Row({ avatar, title, detail, amount, amountClass = '', actions, onClick, className = '' }) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3.5 card-separator last:border-b-0 ${onClick ? 'cursor-pointer active:opacity-60 transition-opacity duration-150' : ''} ${className}`}
    >
      {avatar}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold text-ink" style={{ letterSpacing: '-0.01em' }}>{title}</div>
        {detail && <div className="mt-0.5 truncate text-[13px] text-muted">{detail}</div>}
      </div>
      {amount !== undefined && <div className={`shrink-0 text-right font-semibold tabular-nums text-[15px] text-ink ${amountClass}`}>{amount}</div>}
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </div>
  )
}

export function IconBtn({ children, onClick, tone = 'muted', title }) {
  const cls = { muted: 'text-muted', primary: 'text-primary', danger: 'text-danger', warning: 'text-warning' }[tone]
  return (
    <button
      type="button"
      title={title}
      onClick={(e) => { e.stopPropagation(); onClick?.(e) }}
      className={`flex h-9 w-9 items-center justify-center rounded-full text-base active:bg-black/5 dark:active:bg-white/10 transition-all duration-150 ${cls}`}
    >
      {children}
    </button>
  )
}

export function StatCard({ label, big, meta, tone = 'hero', children }) {
  const cls = { hero: 'stat-hero', green: 'stat-green', purple: 'stat-purple' }[tone]
  return (
    <section className={`${cls} rounded-3xl p-6 text-white shadow-lg`} style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
      <p className="text-[13px] font-medium text-white/80 tracking-tight">{label}</p>
      <div className="mt-1.5 text-[34px] font-bold tabular-nums leading-tight" style={{ letterSpacing: '-0.02em' }}>{big}</div>
      {meta && <p className="mt-1.5 text-[13px] text-white/70">{meta}</p>}
      {children}
    </section>
  )
}

export function Empty({ icon, children }) {
  return (
    <div className="empty">
      {icon && <div className="mb-3 text-4xl">{icon}</div>}
      <div className="leading-relaxed">{children}</div>
    </div>
  )
}

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
    <div className="mb-5">
      {label && <span className="label">{label}</span>}
      {children}
      {hint && <p className="mt-1.5 text-[13px] text-muted">{hint}</p>}
    </div>
  )
}

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