import { useApp } from '../lib/app.jsx'
import {
  depositBreakdown, expenseBreakdown, fmt, ledgerStats, memberById, memberPaidBreakdown,
  memberShareBreakdown, settlements, today,
} from '../lib/calc.js'
import { Avatar, Card, Empty, Row, SectionTitle, StatCard } from '../components/ui.jsx'
import PieChart from '../components/PieChart.jsx'
import { useExpenseActions } from '../components/ExpenseRows.jsx'

/** 結算相關操作(記記頁的雙人模式也會用到) */
export function useSettleActions() {
  const { act, toast } = useApp()

  // 標記單筆轉帳已付清:記一筆「清償」抵銷(可在記記列表刪除反悔)
  function settleTransfer(from, to, amt) {
    const f = memberById(from), b = memberById(to)
    if (!f || !b) return
    if (!confirm(`確認 ${f.name} 已把 ${fmt(amt)} 付給 ${b.name}?\n(會記一筆清償紀錄,反悔可到記記刪除)`)) return
    act((_, p) => {
      p.expenses.push({
        id: p.nextExpenseId++,
        cat: '💸 清償', desc: `${f.name} 付給 ${b.name}`,
        amount: amt, mode: 'exact', settle: true,
        paid: { [from]: amt }, spent: { [to]: amt },
        payer: 0, splitters: [], date: today(),
      })
    })
    toast.success(`✓ ${f.name} 已結清這筆`)
  }

  function copySettlement(p) {
    const plan = settlements()
    if (!plan.length) return toast.info('目前沒有需要轉帳的款項')
    const lines = [`💸 ${p.name}｜結算結果`]
    plan.forEach((t) => lines.push(`${memberById(t.from)?.name || '?'} → ${memberById(t.to)?.name || '?'}  ${fmt(t.amt)}`))
    lines.push(`(共 ${plan.length} 筆轉帳就能結清)`)
    const text = lines.join('\n')
    const done = () => toast.success('已複製,貼給大家吧 📋')
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done, toast))
    else fallbackCopy(text, done, toast)
  }

  function markSettled() {
    if (!confirm('確定標記全部已結清?所有帳目將被清空,此動作無法復原')) return
    act((_, p) => { p.expenses = [] })
    toast.success('已全部結清 🎉')
  }

  return { settleTransfer, copySettlement, markSettled }
}

function fallbackCopy(text, done, toast) {
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    done()
  } catch { toast.error('複製失敗,請截圖分享') }
}

export default function Settle() {
  const { p } = useApp()
  if (p.type === 'split') return <SplitSettle />
  if (p.type === 'fund') return <FundStatus />
  return <PersonalStats />
}

function SplitSettle() {
  const { p } = useApp()
  const { settleTransfer, copySettlement, markSettled } = useSettleActions()
  const { reveal } = useExpenseActions()
  const pending = p.expenses.filter((e) => e.mode === 'random' && !e.revealed)
  const plan = settlements()
  const pies = (
    <>
      <PieChart items={memberPaidBreakdown()} title="💳 誰先付多少" />
      <PieChart items={memberShareBreakdown()} title="🍽️ 誰花得多(分攤)" />
      <PieChart items={expenseBreakdown()} title="📊 支出分類" />
    </>
  )
  return (
    <div className="space-y-2">
      {pending.length > 0 && (
        <>
          <SectionTitle className="mt-0">🎲 未開獎(尚未列入結算)</SectionTitle>
          <Card>
            {pending.map((e) => (
              <Row
                key={e.id}
                avatar={<Avatar color="var(--t-warning)" text="🎲" />}
                title={e.desc || e.cat || '神秘支出'}
                detail={`${memberById(e.payer)?.name || '?'} 先付 · ${e.date}`}
                amount={fmt(e.amount)}
                actions={<button onClick={() => reveal(e.id)} className="chip py-1 text-xs font-bold text-warning">開獎</button>}
              />
            ))}
          </Card>
        </>
      )}

      <SectionTitle className={pending.length ? '' : 'mt-0'}>最佳結算方案</SectionTitle>
      {plan.length === 0 ? (
        <>
          <Empty icon="🎉">大家都結清了!<br />沒有需要轉帳的款項</Empty>
          {pies}
        </>
      ) : (
        <>
          <Card>
            {plan.map((t, i) => {
              const f = memberById(t.from), to = memberById(t.to)
              return (
                <div key={i} className="flex items-center gap-2 border-b border-line px-4 py-3 last:border-b-0">
                  <div className="flex w-14 flex-col items-center gap-1">
                    <Avatar member={f} />
                    <span className="w-full truncate text-center text-[11px] text-ink">{f?.name || '?'}</span>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col items-center">
                    <span className="font-bold tabular-nums text-primary">{fmt(t.amt)}</span>
                    <div className="relative mt-1 h-0.5 w-full rounded bg-primary/60">
                      <span className="absolute -right-0.5 -top-[5px] border-y-[6px] border-l-[9px] border-y-transparent border-l-primary" />
                    </div>
                  </div>
                  <div className="flex w-14 flex-col items-center gap-1">
                    <Avatar member={to} />
                    <span className="w-full truncate text-center text-[11px] text-ink">{to?.name || '?'}</span>
                  </div>
                  <button onClick={() => settleTransfer(t.from, t.to, t.amt)} className="chip shrink-0 py-1 text-xs text-success">✓ 已付</button>
                </div>
              )
            })}
          </Card>
          <button onClick={() => copySettlement(p)} className="btn-secondary mt-2 w-full">📋 複製結算結果</button>
          {pies}
          <button onClick={markSettled} className="btn-secondary mt-4 w-full">✓ 標記全部已結清</button>
        </>
      )}
    </div>
  )
}

function FundStatus() {
  const { p } = useApp()
  const s = ledgerStats()
  const share = p.members.length ? s.tout / p.members.length : 0
  return (
    <div className="space-y-2">
      <StatCard tone="green" label="基金餘額" big={fmt(s.bal)} meta={`總存入 ${fmt(s.tin)} · 總支出 ${fmt(s.tout)}`} />
      {p.members.length === 0 ? (
        <Empty icon="👥">先到「自訂」新增成員</Empty>
      ) : (
        <>
          <SectionTitle>分攤狀況(支出均攤,每人 {fmt(share)})</SectionTitle>
          <Card>
            {p.members.map((m) => {
              const diff = s.dep[m.id] - share
              const cls = diff > 0.01 ? 'amount-pos' : diff < -0.01 ? 'amount-neg' : ''
              const txt = diff > 0.01 ? `可退回 ${fmt(diff)}` : diff < -0.01 ? `應補繳 ${fmt(-diff)}` : '剛好打平'
              return <Row key={m.id} avatar={<Avatar member={m} />} title={m.name} detail={`已存入 ${fmt(s.dep[m.id])}`} amount={<span className="text-sm">{txt}</span>} amountClass={cls} />
            })}
          </Card>
          <PieChart items={depositBreakdown()} title="💰 誰存最多" />
          <PieChart items={expenseBreakdown()} title="📊 支出分類" />
        </>
      )}
    </div>
  )
}

function PersonalStats() {
  const { p } = useApp()
  const s = ledgerStats()
  const mNow = new Date().getMonth() + 1
  let mIn = 0, mOut = 0
  p.expenses.forEach((e) => {
    if (+String(e.date).split('/')[0] === mNow) { if (e.kind === 'in') mIn += e.amount; else mOut += e.amount }
  })
  return (
    <div className="space-y-2">
      <StatCard tone="purple" label="目前結餘" big={fmt(s.bal)} meta={`總收入 ${fmt(s.tin)} · 總支出 ${fmt(s.tout)}`} />
      <SectionTitle>本月({mNow} 月)</SectionTitle>
      <Card>
        <Row title="收入" amount={`+${fmt(mIn)}`} amountClass="amount-pos" />
        <Row title="支出" amount={`−${fmt(mOut)}`} amountClass="amount-neg" />
        <Row title="本月結餘" amount={fmt(mIn - mOut)} />
      </Card>
      <PieChart items={expenseBreakdown()} title="📊 支出分類" />
    </div>
  )
}
