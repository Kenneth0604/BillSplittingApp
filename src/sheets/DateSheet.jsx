import { useState } from 'react'
import { useApp } from '../lib/app.jsx'
import { fmt, isoToMD, todayISO } from '../lib/calc.js'
import { Card, Empty, Field, StatCard } from '../components/ui.jsx'
import { ExpenseRow, LedgerRow } from '../components/ExpenseRows.jsx'

/** 📅 查看特定日期的紀錄 */
export default function DateSheet() {
  const { p } = useApp()
  const [iso, setIso] = useState(todayISO)
  const md = isoToMD(iso)
  const type = p.type
  const isFund = type === 'fund'
  const list = p.expenses.filter((e) => e.date === md)

  let tin = 0, tout = 0
  list.forEach((e) => {
    if (type === 'split') { if (!e.settle) tout += e.amount }
    else if (e.kind === 'in') tin += e.amount
    else tout += e.amount
  })

  return (
    <div>
      <Field label="選擇日期">
        <input type="date" value={iso} onChange={(e) => setIso(e.target.value)} className="input" />
      </Field>
      {list.length === 0 ? (
        <Empty icon="📅">{md} 這天沒有紀錄</Empty>
      ) : (
        <div className="space-y-3">
          {type === 'split' ? (
            <StatCard label={`${md} 支出合計`} big={fmt(tout)} />
          ) : (
            <StatCard tone={isFund ? 'green' : 'purple'} label={`${md} 收支`} big={fmt(tin - tout)} meta={`${isFund ? '總存入' : '總收入'} ${fmt(tin)} · 總支出 ${fmt(tout)}`} />
          )}
          <Card>
            {[...list].reverse().map((e) => (type === 'split' ? <ExpenseRow key={e.id} e={e} /> : <LedgerRow key={e.id} e={e} isFund={isFund} />))}
          </Card>
        </div>
      )}
    </div>
  )
}
