import { CAT_COLORS } from '../lib/store.js'
import { fmt } from '../lib/calc.js'
import { Card, SectionTitle } from './ui.jsx'

/** 圓餅圖(conic-gradient)+ 圖例 */
export default function PieChart({ items, title }) {
  if (!items || !items.length) return null
  const total = items.reduce((s, x) => s + x.value, 0)
  let acc = 0
  const stops = items.map((x, i) => {
    const from = (acc / total) * 360
    acc += x.value
    const to = (acc / total) * 360
    return `${CAT_COLORS[i % CAT_COLORS.length]} ${from}deg ${to}deg`
  }).join(', ')
  return (
    <>
      <SectionTitle>{title}</SectionTitle>
      <Card className="flex items-center gap-4 p-4">
        <div className="h-28 w-28 shrink-0 rounded-full shadow-inner" style={{ background: `conic-gradient(${stops})` }} />
        <ul className="min-w-0 flex-1 space-y-1.5 text-xs">
          {items.map((x, i) => (
            <li key={x.label} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CAT_COLORS[i % CAT_COLORS.length] }} />
              <span className="min-w-0 flex-1 truncate text-ink">{x.label}</span>
              <span className="shrink-0 tabular-nums text-muted">{fmt(x.value)} · {Math.round((x.value / total) * 100)}%</span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  )
}
