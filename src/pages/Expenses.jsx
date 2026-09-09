import { useApp } from '../lib/app.jsx'
import { balances, fmt, ledgerStats } from '../lib/calc.js'
import { chatName } from '../lib/nick.js'
import { Card, Empty, StatCard } from '../components/ui.jsx'
import { ExpenseRow, LedgerRow } from '../components/ExpenseRows.jsx'
import Chat from '../components/Chat.jsx'
import { useSettleActions } from './Settle.jsx'

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
      {p.expenses.length === 0 ? (
        <Empty icon="🧾">還沒有任何支出<br />點右下角 ＋ 新增第一筆</Empty>
      ) : (
        <Card>{[...p.expenses].reverse().map((e) => <ExpenseRow key={e.id} e={e} />)}</Card>
      )}
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
      {p.expenses.length === 0 ? (
        <Empty icon="🧾">還沒有任何支出<br />點右下角 ＋ 新增第一筆</Empty>
      ) : (
        <Card>{[...p.expenses].reverse().map((e) => <ExpenseRow key={e.id} e={e} />)}</Card>
      )}
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
      {p.expenses.length === 0 ? (
        <Empty icon={isFund ? '🏦' : '📒'}>還沒有任何紀錄<br />點右下角 ＋ 新增第一筆</Empty>
      ) : (
        <Card>{[...p.expenses].reverse().map((e) => <LedgerRow key={e.id} e={e} isFund={isFund} />)}</Card>
      )}
    </>
  )
}
