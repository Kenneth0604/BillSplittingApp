import { useApp } from '../lib/app.jsx'
import { balances, fmt, isoToMD, ledgerStats } from '../lib/calc.js'
import { chatName } from '../lib/nick.js'
import { Card, Empty, StatCard } from '../components/ui.jsx'
import { ExpenseRow, LedgerRow } from '../components/ExpenseRows.jsx'
import Chat from '../components/Chat.jsx'
import { useSettleActions } from './Settle.jsx'
import DayStrip from '../components/DayStrip.jsx'

/** 日期區 + 選中那天的紀錄(含當日小計) */
function DayList({ renderRow, emptyIcon }) {
  const { p, day, view, setView } = useApp()
  const tabs = (
    <div className="grid grid-cols-2 gap-1 rounded-full bg-surface-2 p-1">
      {[['all', '全部'], ['day', '📅 依日期']].map(([v, label]) => (
        <button key={v} type="button" onClick={() => setView(v)} className={`rounded-full py-1.5 text-sm font-semibold transition-colors duration-150 ${view === v ? 'bg-surface text-ink shadow-sm' : 'text-muted'}`}>{label}</button>
      ))}
    </div>
  )
  // 全部:原本的列表(新到舊,每列顯示日期)
  if (view !== 'day') {
    return (
      <>
        {tabs}
        {p.expenses.length === 0 ? (
          <Empty icon={emptyIcon}>還沒有任何紀錄<br />點右下角 ＋ 新增第一筆</Empty>
        ) : (
          <Card>{[...p.expenses].reverse().map((e) => renderRow(e, true))}</Card>
        )}
      </>
    )
  }
  const md = isoToMD(day)
  const list = p.expenses.filter((e) => e.date === md)
  let tin = 0, tout = 0
  list.forEach((e) => {
    if (e.settle) return
    if (p.type !== 'split' && e.kind === 'in') tin += e.amount
    else tout += e.amount
  })
  const sum = p.type === 'split' ? `支出 ${fmt(tout)}` : `收入 ${fmt(tin)} · 支出 ${fmt(tout)}`
  return (
    <>
      {tabs}
      <DayStrip />
      {list.length === 0 ? (
        <Empty icon={emptyIcon}>這天沒有紀錄<br />點右下角 ＋ 記在這天</Empty>
      ) : (
        <>
          <p className="px-1 text-[13px] text-muted">這天 {list.length} 筆 · {sum}</p>
          <Card>{[...list].reverse().map((e) => renderRow(e, false))}</Card>
        </>
      )}
    </>
  )
}

export default function Expenses() {
  const { p, duo } = useApp()
  return (
    <div className="space-y-4">
      {p.type === 'split' ? (duo ? <DuoSummary /> : <SplitList />) : <LedgerList />}
      <Chat />
    </div>
  )
}

function SplitList() {
  const { p } = useApp()
  const total = p.expenses.reduce((s, e) => s + (e.settle ? 0 : e.amount), 0)
  return (
    <>
      <StatCard label="總支出" big={fmt(total)} meta={`${p.members.length} 位成員 · ${p.expenses.length} 筆帳目`} />
      <DayList emptyIcon="🧾" renderRow={(e, d) => <ExpenseRow key={e.id} e={e} showDate={d} />} />
    </>
  )
}

/** 👥 雙人模式:直接顯示誰欠誰 */
function DuoSummary() {
  const { p } = useApp()
  const { settleTransfer } = useSettleActions()
  const [m1, m2] = p.members
  const bal = balances()
  const total = p.expenses.reduce((s, e) => s + (e.settle ? 0 : e.amount), 0)
  const me = p.members.find((m) => m.name === chatName()) || null
  const net = bal[m1.id]
  const amt = Math.abs(net)
  let line, debtor = null, creditor = null
  if (amt < 0.01) line = '目前互不相欠 🎉'
  else {
    debtor = net < -0.01 ? m1 : m2
    creditor = net < -0.01 ? m2 : m1
    if (me && debtor.id === me.id) line = <>你欠 {creditor.name}<br />{fmt(amt)}</>
    else if (me && creditor.id === me.id) line = <>{debtor.name} 欠你<br />{fmt(amt)}</>
    else line = <>{debtor.name} 欠 {creditor.name}<br />{fmt(amt)}</>
  }
  return (
    <>
      <StatCard label={`👥 雙人模式 · ${m1.name} & ${m2.name}`} big={<span className="text-2xl leading-snug">{line}</span>} meta={`總支出 ${fmt(total)}`} />
      {debtor && (
        <button onClick={() => settleTransfer(debtor.id, creditor.id, amt)} className="btn-secondary w-full">
          ✓ 標記已結清({debtor.name} 已付款)
        </button>
      )}
      <DayList emptyIcon="🧾" renderRow={(e, d) => <ExpenseRow key={e.id} e={e} showDate={d} />} />
    </>
  )
}

/** 基金 / 個人記帳明細 */
function LedgerList() {
  const { p } = useApp()
  const s = ledgerStats()
  const isFund = p.type === 'fund'
  return (
    <>
      <StatCard
        tone={isFund ? 'green' : 'purple'}
        label={isFund ? '基金餘額' : '結餘'}
        big={fmt(s.bal)}
        meta={`${isFund ? '總存入' : '總收入'} ${fmt(s.tin)} · 總支出 ${fmt(s.tout)}`}
      />
      <DayList emptyIcon={isFund ? '🏦' : '📒'} renderRow={(e, d) => <LedgerRow key={e.id} e={e} isFund={isFund} showDate={d} />} />
    </>
  )
}
