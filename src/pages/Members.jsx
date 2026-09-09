import { useApp } from '../lib/app.jsx'
import { useSheet } from '../components/Sheet.jsx'
import { balances, fmt, ledgerStats, memberById } from '../lib/calc.js'
import { getCats } from '../lib/store.js'
import { Avatar, Card, Empty, IconBtn, Row, SectionTitle } from '../components/ui.jsx'
import { MemberAddSheet, MemberEditSheet } from '../sheets/MemberSheets.jsx'
import { CatAddSheet, CatEditSheet } from '../sheets/CatSheets.jsx'

export default function Members() {
  const { p, act, toast } = useApp()
  const sheet = useSheet()
  const type = p.type

  function delMember(id) {
    const involved = p.expenses.some((e) =>
      e.payer === id || (e.splitters || []).includes(id) || (e.paid && e.paid[id]) || (e.spent && e.spent[id]) ||
      (e.candidates || []).includes(id) || e.loser === id || (e.losers || []).includes(id))
    if (involved) return toast.error('此成員已有帳目,無法刪除')
    const m = memberById(id)
    if (!confirm(`確定刪除成員「${m?.name || '?'}」?`)) return
    act((_, pr) => { pr.members = pr.members.filter((x) => x.id !== id) })
    toast.info('已刪除成員')
  }

  function delCat(kind, i) {
    const cats = getCats(kind)
    if (cats.length <= 1) return toast.error('至少要保留一個分類')
    const name = cats[i]
    if (!confirm(`確定刪除分類「${name}」?(既有帳目不受影響)`)) return
    act(() => cats.splice(i, 1))
    toast.info(`已刪除「${name}」`)
  }

  const groups = [{ kind: 'out', label: '支出分類' }]
  if (type === 'fund') groups.push({ kind: 'in', label: '存入分類' })
  if (type === 'personal') groups.push({ kind: 'in', label: '收入分類' })

  return (
    <div className="space-y-2">
      {type !== 'personal' && (
        <>
          <SectionTitle className="mt-0">{type === 'fund' ? '成員與存入金額' : '成員與餘額'}</SectionTitle>
          <Card>
            {p.members.length === 0 ? (
              <Empty icon="👥">還沒有成員</Empty>
            ) : type === 'fund' ? (
              <FundMembers onEdit={(m) => sheet.open('✎ 編輯成員', <MemberEditSheet id={m.id} />)} onDel={delMember} />
            ) : (
              <SplitMembers onEdit={(m) => sheet.open('✎ 編輯成員', <MemberEditSheet id={m.id} />)} onDel={delMember} />
            )}
          </Card>
          <button onClick={() => sheet.open('新增成員', <MemberAddSheet />)} className="btn-secondary mt-2 w-full">＋ 新增成員</button>
        </>
      )}

      {groups.map((g) => (
        <div key={g.kind}>
          <SectionTitle>{g.label}(點一下改名,✕ 刪除)</SectionTitle>
          <Card className="p-3">
            <div className="flex flex-wrap gap-2">
              {getCats(g.kind).map((c, i) => (
                <span key={c} className="chip gap-1 pr-1.5">
                  <button type="button" onClick={() => sheet.open('✎ 編輯分類', <CatEditSheet kind={g.kind} index={i} />)}>{c}</button>
                  <button type="button" aria-label="刪除" onClick={() => delCat(g.kind, i)} className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-surface-2 text-[10px] text-muted">✕</button>
                </span>
              ))}
            </div>
          </Card>
          <button onClick={() => sheet.open(`新增${g.label}`, <CatAddSheet kind={g.kind} />)} className="btn-secondary mt-2 w-full">＋ 新增{g.label}</button>
        </div>
      ))}
    </div>
  )
}

function SplitMembers({ onEdit, onDel }) {
  const { p } = useApp()
  const bal = balances()
  return p.members.map((m) => {
    const b = bal[m.id]
    const cls = b > 0.01 ? 'amount-pos' : b < -0.01 ? 'amount-neg' : ''
    const txt = b > 0.01 ? `+${fmt(b)}` : b < -0.01 ? `−${fmt(-b)}` : '已結清'
    return (
      <Row
        key={m.id}
        avatar={<Avatar member={m} />}
        title={m.name}
        detail={b > 0.01 ? '應收回' : b < -0.01 ? '應支付' : '無欠款'}
        amount={txt}
        amountClass={cls}
        actions={<><IconBtn tone="primary" onClick={() => onEdit(m)}>✎</IconBtn><IconBtn tone="danger" onClick={() => onDel(m.id)}>✕</IconBtn></>}
      />
    )
  })
}

function FundMembers({ onEdit, onDel }) {
  const { p } = useApp()
  const s = ledgerStats()
  return p.members.map((m) => (
    <Row
      key={m.id}
      avatar={<Avatar member={m} />}
      title={m.name}
      detail="已存入"
      amount={fmt(s.dep[m.id])}
      amountClass="amount-pos"
      actions={<><IconBtn tone="primary" onClick={() => onEdit(m)}>✎</IconBtn><IconBtn tone="danger" onClick={() => onDel(m.id)}>✕</IconBtn></>}
    />
  ))
}
