import { useApp } from '../lib/app.jsx'
import { useSheet } from './Sheet.jsx'
import { Avatar, IconBtn, Row } from './ui.jsx'
import { colorOf, fmt, initials, losersOf, memberById } from '../lib/calc.js'
import ExpenseSheet from '../sheets/ExpenseSheet.jsx'

/** 共用操作:開獎、編輯、刪除 */
export function useExpenseActions() {
  const { act, toast } = useApp()
  const sheet = useSheet()

  function reveal(id) {
    let msg = ''
    act((_, p) => {
      const e = p.expenses.find((x) => x.id === id)
      if (!e || e.revealed) return
      e.revealed = true
      const ls = losersOf(e)
      const names = ls.map((i) => memberById(i)?.name || '?').join('、')
      msg = `🎲 開獎:${names} 買單 ${fmt(e.amount)}${ls.length > 1 ? `(每人 ${fmt(e.amount / ls.length)})` : ''}!`
    })
    if (msg) toast.info(msg)
  }
  function edit(id) { sheet.open(null, <ExpenseSheet editId={id} />) }
  function remove(id) {
    let ok = false
    act((_, p) => {
      const e = p.expenses.find((x) => x.id === id)
      if (!confirm(`確定刪除「${e?.desc || e?.cat || '這筆紀錄'}」(${fmt(e?.amount || 0)})?`)) return
      p.expenses = p.expenses.filter((x) => x.id !== id)
      ok = true
    })
    if (ok) toast.info('已刪除紀錄')
  }
  return { reveal, edit, remove }
}

/** 多人 / 雙人分帳的支出列 */
export function ExpenseRow({ e }) {
  const { reveal, edit, remove } = useExpenseActions()
  let avatarId, payText, splitText
  if (e.mode === 'random') {
    avatarId = e.payer
    payText = `${memberById(e.payer)?.name || '?'} 先付`
    splitText = e.revealed ? `🎲 ${losersOf(e).map((id) => memberById(id)?.name || '?').join('、')} 買單` : '🎲 未開獎'
  } else if (e.mode === 'exact') {
    const pids = Object.keys(e.paid || {}).map(Number)
    avatarId = pids[0] || 0
    payText = `${pids.map((id) => memberById(id)?.name || '?').join('、')} 先付`
    if (e.duo) {
      const otherId = Object.keys(e.spent || {}).map(Number)[0]
      splitText = `${memberById(otherId)?.name || '對方'} 欠全額`
    } else splitText = e.settle ? '💸 清償' : '特定分帳'
  } else {
    avatarId = e.payer
    payText = `${memberById(e.payer)?.name || '?'} 先付`
    splitText = `${e.splitters.length} 人分攤`
  }
  return (
    <Row
      avatar={<Avatar member={memberById(avatarId)} />}
      title={e.desc || e.cat || '未命名支出'}
      detail={`${e.desc && e.cat ? e.cat + ' · ' : ''}${payText} · ${splitText} · ${e.date}${e.by ? ` · ${e.by} 記` : ''}`}
      amount={fmt(e.amount)}
      actions={
        <>
          {e.mode === 'random' && !e.revealed && <IconBtn tone="warning" onClick={() => reveal(e.id)} title="開獎">🎲</IconBtn>}
          <IconBtn tone="primary" onClick={() => edit(e.id)} title="編輯">✎</IconBtn>
          <IconBtn tone="danger" onClick={() => remove(e.id)} title="刪除">✕</IconBtn>
        </>
      }
    />
  )
}

/** 基金 / 個人記帳的紀錄列 */
export function LedgerRow({ e, isFund }) {
  const { edit, remove } = useExpenseActions()
  const isIn = e.kind === 'in'
  let detail = e.date
  let avatar = <Avatar color={isIn ? 'var(--t-success)' : 'var(--t-danger)'} text={isIn ? '＋' : '－'} />
  if (isFund && isIn) {
    const m = memberById(e.payer)
    avatar = <Avatar member={m} color={colorOf(e.payer)} text={initials(m?.name || '?')} />
    detail = `${m?.name || '?'} 存入 · ${e.date}`
  }
  if (e.desc && e.cat) detail = `${e.cat} · ${detail}`
  if (e.by) detail += ` · ${e.by} 記`
  return (
    <Row
      avatar={avatar}
      title={e.desc || e.cat || (isIn ? '收入' : '支出')}
      detail={detail}
      amount={`${isIn ? '+' : '−'}${fmt(e.amount)}`}
      amountClass={isIn ? 'amount-pos' : 'amount-neg'}
      actions={
        <>
          <IconBtn tone="primary" onClick={() => edit(e.id)} title="編輯">✎</IconBtn>
          <IconBtn tone="danger" onClick={() => remove(e.id)} title="刪除">✕</IconBtn>
        </>
      }
    />
  )
}
