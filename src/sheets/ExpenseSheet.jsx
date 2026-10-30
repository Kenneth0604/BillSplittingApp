import { useEffect, useState } from 'react'
import { useApp } from '../lib/app.jsx'
import { useSheet } from '../components/Sheet.jsx'
import { Card, Chips, Field, Select } from '../components/ui.jsx'
import AmountInput from '../components/AmountInput.jsx'
import { dateToISO, evalAmt, fmt, isValidAmount, isoToMD, losersOf, memberById, randInt, today, todayISO } from '../lib/calc.js'
import { getCats } from '../lib/store.js'
import { chatName } from '../lib/nick.js'
import { useExpenseActions } from '../components/ExpenseRows.jsx'
import CurrencyField from '../components/CurrencyField.jsx'
import InvoiceScanner from '../components/InvoiceScanner.jsx'
import { invoiceDesc } from '../lib/invoice.js'
import { BASE, CUR_BY_CODE, cachedRates, fmtCur, fmtRate, rateOf, toBase } from '../lib/fx.js'

/**
 * 新增 / 編輯一筆紀錄
 * - split 雙人模式:精簡表單(分類、說明、日期、誰先付、金額 = 對方欠的錢)
 * - split 多人:特定付款 / 均分 / 🎲 隨機付款
 * - fund / personal:存入(收入)/ 支出
 * 編輯時鎖定分帳方式;隨機付款只能改金額、分類、說明、日期,不重抽。
 */
export default function ExpenseSheet({ editId = null }) {
  const { p, duo, act, toast, setPage } = useApp()
  const { close, setTitle } = useSheet()
  const { reveal } = useExpenseActions()
  const editing = editId != null ? p.expenses.find((x) => x.id === editId) : null
  const type = p.type
  const isSplit = type === 'split'
  const isFund = type === 'fund'

  // 雙人精簡表單:新增時預設;編輯 duo 紀錄時也用
  const duoSimple = isSplit && duo && (editing ? !!editing.duo : true)
  const lockedMode = editing ? editing.mode || 'equal' : null

  const [cat, setCat] = useState(() => editing?.cat ?? '')
  const [desc, setDesc] = useState(editing?.desc ?? '')
  const [date, setDate] = useState(() => (editing ? dateToISO(editing.date) : todayISO()))
  const [mode, setMode] = useState(lockedMode ?? 'exact')
  const [kind, setKind] = useState(editing?.kind === 'out' ? 'out' : 'in')
  // 多幣別:外幣時輸入的都是原幣,存檔才換算成 NT$;原幣金額另存在 fx
  const fx0 = editing?.fx
  // 新增時沿用這個帳本上一筆新增用的幣別(出國記帳不用每筆重選),從沒選過就是新台幣;
  // 編輯時用該筆紀錄自己的幣別
  const [cur, setCur] = useState(() => fx0?.cur || (!editing && CUR_BY_CODE[p.lastCur] ? p.lastCur : BASE))
  const [rate, setRate] = useState(() => (fx0 ? String(fx0.rate) : cur !== BASE ? fmtRate(rateOf(cur, cachedRates())) : null))
  const foreign = cur !== BASE
  const [amount, setAmount] = useState(editing ? String(fx0 ? fx0.orig : editing.amount) : '')
  const [payer, setPayer] = useState(() => String(editing?.payer || p.members[0]?.id || ''))
  const [splitters, setSplitters] = useState(() => (editing?.splitters?.length ? editing.splitters : p.members.map((m) => m.id)))
  const [cells, setCells] = useState(() => {
    const c = {}
    if (editing?.mode === 'exact') {
      const paid = fx0?.paid || editing.paid, spent = fx0?.spent || editing.spent
      p.members.forEach((m) => {
        if (paid?.[m.id]) c['pay_' + m.id] = String(paid[m.id])
        if (spent?.[m.id]) c['spend_' + m.id] = String(spent[m.id])
      })
    }
    return c
  })
  const [eqSel, setEqSel] = useState(() => p.members.map((m) => m.id))
  const [cands, setCands] = useState(() => p.members.map((m) => m.id))
  const [drawN, setDrawN] = useState('1')
  const [revealNow, setRevealNow] = useState('now')
  const [scan, setScan] = useState(false)
  const [inv, setInv] = useState(editing?.inv ?? null) // 發票號碼,避免同一張重複記

  // 標題
  const title = editing
    ? (isSplit ? '✎ 編輯支出' : '✎ 編輯紀錄')
    : isSplit ? '新增支出' : '新增紀錄'
  useEffect(() => { setTitle(title) }, [title, setTitle])

  // 分類清單(依收支類型)
  const catKind = isSplit ? 'out' : kind
  const cats = getCats(catKind)
  const effectiveCat = cats.includes(cat) ? cat : cats[0] || '📦 其他'

  // 多人分帳需要至少兩位成員
  if (isSplit && !duo && p.members.length < 2 && !editing) {
    return (
      <div className="text-center">
        <p className="mb-3 text-sm text-muted">請先新增至少 2 位成員</p>
        <button onClick={() => { close(); setPage('members') }} className="btn-primary w-full">前往「自訂」新增成員</button>
      </div>
    )
  }
  if (isFund && !p.members.length && !editing) {
    return (
      <div className="text-center">
        <p className="mb-3 text-sm text-muted">請先新增成員</p>
        <button onClick={() => { close(); setPage('members') }} className="btn-primary w-full">前往「自訂」新增成員</button>
      </div>
    )
  }

  const memberOpts = p.members.map((m) => ({ value: String(m.id), label: m.name }))
  const dateMD = () => isoToMD(date) || today()

  const curInfo = CUR_BY_CODE[cur] || CUR_BY_CODE[BASE]
  const amtLabel = (extra = '') => `金額 (${curInfo.symbol})${extra}`
  const show = (n) => (foreign ? fmtCur(n, cur) : fmt(n))
  const rateNum = Number(rate)
  // 原幣 → NT$(整數);NT$ 時就是四捨五入
  const conv = (v) => (foreign ? toBase(v, rateNum) : Math.round(v))
  const previewNT = foreign ? conv(evalAmt(amount)) : null

  /** 新增或更新一筆紀錄 */
  function commit(rec) {
    act((_, pr) => {
      if (editing) {
        const i = pr.expenses.findIndex((x) => x.id === editing.id)
        if (i >= 0) pr.expenses[i] = { ...pr.expenses[i], ...rec, id: pr.expenses[i].id }
      } else {
        rec.id = pr.nextExpenseId++
        pr.lastCur = cur
        const who = chatName()
        if (who) rec.by = who
        pr.expenses.push(rec)
      }
    })
    close()
    toast.success(editing ? '已更新 ✓' : '已記帳 ✓')
  }

  function exactTotals() {
    let tp = 0, ts = 0
    p.members.forEach((m) => {
      tp += evalAmt(cells['pay_' + m.id]) || 0
      ts += evalAmt(cells['spend_' + m.id]) || 0
    })
    return { tp, ts }
  }

  function fillEqualSpend() {
    const { tp } = exactTotals()
    if (tp <= 0) return toast.error('請先填先付金額')
    if (!eqSel.length) return toast.error('至少選一位')
    const next = { ...cells }
    p.members.forEach((m) => { next['spend_' + m.id] = '' })
    const base = Math.floor(tp / eqSel.length)
    const rem = Math.round(tp - base * eqSel.length)
    eqSel.forEach((id, i) => { next['spend_' + id] = String(base + (i < rem ? 1 : 0)) })
    setCells(next)
    toast.info('已均分支出 ✓')
  }

  function submit(e) {
    e?.preventDefault()
    const common = { cat: effectiveCat, desc: desc.trim(), date: dateMD() }
    if (foreign && !(rateNum > 0)) return toast.error('請輸入有效匯率')
    const origAmt = evalAmt(amount)
    if (inv && !editing && p.expenses.some((x) => x.inv === inv)) return toast.error(`發票 ${inv} 已經記過了`)
    if (inv) common.inv = inv
    const fx = foreign ? { cur, rate: rateNum, orig: Math.round(origAmt * 100) / 100 } : undefined

    // 👥 雙人直記欠帳
    if (duoSimple) {
      const amt = conv(origAmt)
      const pid = +payer
      const other = p.members.find((m) => m.id !== pid)
      if (!isValidAmount(amt)) return toast.error('請輸入有效金額')
      if (!other) return toast.error('找不到對方成員')
      return commit({ ...common, fx, amount: amt, mode: 'exact', duo: true, paid: { [pid]: amt }, spent: { [other.id]: amt }, payer: pid, splitters: [] })
    }

    if (!isSplit) {
      const amt = conv(origAmt)
      if (!isValidAmount(amt)) return toast.error('請輸入有效金額')
      const pid = isFund && kind === 'in' ? +payer : 0
      return commit({ ...common, fx, amount: amt, kind, payer: pid, splitters: [] })
    }

    if (mode === 'exact') {
      // 先用原幣檢查合計,再換算;換算的四捨五入差額補到支出最多的人身上,確保兩邊相等
      const oPaid = {}, oSpent = {}
      let otp = 0, ots = 0
      p.members.forEach((m) => {
        const pv = foreign ? evalAmt(cells['pay_' + m.id]) || 0 : Math.round(evalAmt(cells['pay_' + m.id]) || 0)
        const sv = foreign ? evalAmt(cells['spend_' + m.id]) || 0 : Math.round(evalAmt(cells['spend_' + m.id]) || 0)
        if (pv > 0) { oPaid[m.id] = pv; otp += pv }
        if (sv > 0) { oSpent[m.id] = sv; ots += sv }
      })
      if (otp <= 0) return toast.error('請輸入先付金額')
      if (Math.abs(otp - ots) > 0.01) return toast.error(`先付合計 ${show(otp)} ≠ 支出合計 ${show(ots)}`)
      const paid = {}, spent = {}
      let tp = 0, ts = 0
      for (const [id, v] of Object.entries(oPaid)) { paid[id] = conv(v); tp += paid[id] }
      for (const [id, v] of Object.entries(oSpent)) { spent[id] = conv(v); ts += spent[id] }
      if (tp !== ts) {
        const top = Object.keys(spent).sort((a, b) => spent[b] - spent[a])[0]
        spent[top] += tp - ts
      }
      const efx = foreign ? { ...fx, orig: Math.round(otp * 100) / 100, paid: oPaid, spent: oSpent } : undefined
      return commit({ ...common, fx: efx, amount: tp, mode: 'exact', paid, spent, payer: 0, splitters: [] })
    }

    if (mode === 'random') {
      const amt = conv(origAmt)
      if (!isValidAmount(amt)) return toast.error('請輸入有效金額')
      if (editing) return commit({ ...common, fx, amount: amt }) // 不重抽
      const n = +drawN || 1
      if (cands.length < 2) return toast.error('至少選 2 位參加抽籤')
      if (n >= cands.length) return toast.error('抽的人數要少於參加人數')
      const pool = [...cands]
      for (let i = pool.length - 1; i > 0; i--) { const j = randInt(i + 1); [pool[i], pool[j]] = [pool[j], pool[i]] }
      const losers = pool.slice(0, n)
      const now = revealNow === 'now'
      act((_, pr) => {
        pr.lastCur = cur
        pr.expenses.push({ id: pr.nextExpenseId++, ...common, fx, amount: amt, mode: 'random', payer: +payer, candidates: cands, losers, loser: losers[0], revealed: now, splitters: [], by: chatName() || undefined })
      })
      close()
      const names = losers.map((id) => memberById(id)?.name || '?').join('、')
      return toast.success(now ? `🎲 抽中 ${names} 買單!` : '🎲 已抽籤,到結算頁開獎')
    }

    // equal
    const amt = conv(origAmt)
    let sp = splitters
    if (!sp.length && duo) sp = p.members.map((m) => m.id)
    if (!isValidAmount(amt)) return toast.error('請輸入有效金額')
    if (!sp.length) return toast.error('至少選一位分攤者')
    commit({ ...common, fx, amount: amt, payer: +payer, splitters: sp })
  }

  const CatField = (
    <Field label="分類">
      <Chips options={cats} value={effectiveCat} onChange={setCat} />
    </Field>
  )
  const DescField = <Field label="詳細說明(選填)"><input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="例如:鐵板燒" className="input" /></Field>
  const DateField = <Field label="日期"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" /></Field>
  // 掃發票:帶入金額、日期、說明(說明有填就不蓋掉),幣別切回台幣
  function applyInvoice(r) {
    setScan(false)
    if (!editing && p.expenses.some((x) => x.inv === r.number)) toast.error(`發票 ${r.number} 已經記過了`)
    setInv(r.number)
    setCur(BASE); setRate(null)
    setAmount(String(r.total))
    setDate(r.date)
    if (!desc.trim()) setDesc(invoiceDesc(r))
    toast.success(`已帶入 ${fmt(r.total)} ✓`)
  }
  const ScanBtn = (
    <>
      <button type="button" className="scan-btn" onClick={() => setScan(true)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" /><path d="M8 9h2v2H8zM14 9h2v2h-2zM8 14h2v1M13 13h3v3h-3z" /></svg>
        {inv ? `已帶入發票 ${inv} · 重新掃描` : '掃電子發票,自動帶入金額'}
      </button>
      {scan && <InvoiceScanner onResult={applyInvoice} onClose={() => setScan(false)} />}
    </>
  )
  const CurField = <CurrencyField keepRate={Boolean(fx0)} cur={cur} rate={rate} preview={previewNT != null && Number.isFinite(previewNT) ? previewNT : null} onChange={(c, r) => { setCur(c); setRate(r) }} />
  const PayerField = (label = '誰先付的?') => <Field label={label}><Select value={payer} onChange={setPayer} options={memberOpts} /></Field>

  // ---------- 雙人精簡 ----------
  if (duoSimple) {
    return (
      <form onSubmit={submit}>
        {CatField}{DescField}{DateField}{PayerField()}
        {ScanBtn}{CurField}
        <Field label={amtLabel('= 對方欠的錢')}><AmountInput value={amount} onChange={setAmount} /></Field>
        <button type="submit" className="btn-primary w-full">{editing ? '更新' : '記一筆'}</button>
      </form>
    )
  }

  // ---------- 基金 / 個人 ----------
  if (!isSplit) {
    return (
      <form onSubmit={submit}>
        <Field label="類型">
          <Chips
            options={[{ value: 'in', label: isFund ? '存入' : '收入', tone: 'success' }, { value: 'out', label: '支出' }]}
            value={kind}
            onChange={(k) => { setKind(k); setCat('') }}
          />
        </Field>
        {isFund && kind === 'in' && PayerField('誰存入?')}
        {CatField}{DescField}{DateField}
        {ScanBtn}{CurField}
        <Field label={amtLabel()}><AmountInput value={amount} onChange={setAmount} /></Field>
        <button type="submit" className="btn-primary w-full">{editing ? '更新' : '記一筆'}</button>
      </form>
    )
  }

  // ---------- 多人分帳 ----------
  const { tp, ts } = exactTotals()
  const sumOk = tp > 0 && Math.abs(tp - ts) < 0.01
  const sumCls = sumOk ? 'text-success' : tp || ts ? 'text-danger' : 'text-muted'

  return (
    <form onSubmit={submit}>
      {CatField}{DescField}{DateField}
      {!editing && (
        <Field label="分帳方式">
          <Chips options={[{ value: 'exact', label: '特定付款' }, { value: 'equal', label: '均分' }, { value: 'random', label: '🎲 隨機付款' }]} value={mode} onChange={setMode} />
        </Field>
      )}

      {mode === 'exact' && (
        <>
          {CurField}
          <Field label="輸入各自的先付與支出">
            <Card>
              <div className="grid grid-cols-[1fr_5rem_5rem] items-center gap-2 border-b border-line px-3 py-2 text-xs font-semibold text-muted">
                <span>成員</span><span className="text-right">先付</span><span className="text-right">支出</span>
              </div>
              {p.members.map((m) => (
                <div key={m.id} className="grid grid-cols-[1fr_5rem_5rem] items-center gap-2 border-b border-line px-3 py-2 last:border-b-0">
                  <span className="truncate text-sm font-semibold text-ink">{m.name}</span>
                  <AmountInput compact value={cells['pay_' + m.id] || ''} onChange={(v) => setCells((c) => ({ ...c, ['pay_' + m.id]: v }))} />
                  <AmountInput compact value={cells['spend_' + m.id] || ''} onChange={(v) => setCells((c) => ({ ...c, ['spend_' + m.id]: v }))} />
                </div>
              ))}
            </Card>
            <p className={`mt-1.5 text-xs font-medium ${sumCls}`}>先付合計 {show(tp)}｜支出合計 {show(ts)}{foreign && tp > 0 ? `(≈ ${fmt(conv(tp))})` : ''}</p>
          </Field>
          <Field label="或:選擇誰要均分支出,一鍵填入">
            <Chips multi options={memberOpts.map((o) => ({ value: +o.value, label: o.label }))} value={eqSel} onChange={setEqSel} />
            <button type="button" onClick={fillEqualSpend} className="btn-secondary mt-2 w-full">⚖️ 把先付合計均分到支出</button>
          </Field>
        </>
      )}

      {mode === 'equal' && (
        <>
          {ScanBtn}{CurField}
          <Field label={amtLabel()}><AmountInput value={amount} onChange={setAmount} /></Field>
          {PayerField()}
          <Field label="誰要分攤?(均分)">
            <Chips multi options={memberOpts.map((o) => ({ value: +o.value, label: o.label }))} value={splitters} onChange={setSplitters} />
          </Field>
        </>
      )}

      {mode === 'random' && (editing ? (
        <>
          <Card className="mb-4 p-4 text-sm leading-relaxed text-ink">
            {editing.revealed ? (
              <>🎲 開獎結果:<b>{losersOf(editing).map((x) => memberById(x)?.name || '?').join('、')}</b> 要付{losersOf(editing).length > 1 ? `(每人 ${fmt(editing.amount / losersOf(editing).length)})` : ` ${fmt(editing.amount)}`}</>
            ) : (
              <>🎲 尚未開獎｜參加抽籤:{(editing.candidates || []).map((x) => memberById(x)?.name || '?').join('、')}</>
            )}
            <div className="mt-1 text-muted">{memberById(editing.payer)?.name || '?'} 先付 {fmt(editing.amount)} · {editing.date}</div>
          </Card>
          {!editing.revealed && <button type="button" onClick={() => { close(); reveal(editing.id) }} className="btn-secondary mb-4 w-full">🎲 立刻開獎</button>}
          {CurField}
          <Field label={amtLabel()} hint="名單與結果不會因編輯改變(要重抽請刪除後重記)"><AmountInput value={amount} onChange={setAmount} /></Field>
        </>
      ) : (
        <>
          {ScanBtn}{CurField}
          <Field label={amtLabel()}><AmountInput value={amount} onChange={setAmount} /></Field>
          {PayerField()}
          <Field label="誰參加抽籤?(抽中的人買單)">
            <Chips multi options={memberOpts.map((o) => ({ value: +o.value, label: o.label }))} value={cands} onChange={setCands} />
          </Field>
          <Field label="抽幾個人一起買單?(均攤)">
            <Select value={drawN} onChange={setDrawN} options={Array.from({ length: Math.max(1, p.members.length - 1) }, (_, i) => ({ value: String(i + 1), label: `${i + 1} 人` }))} />
          </Field>
          <Field label="公布時機">
            <Chips options={[{ value: 'now', label: '🎉 立刻公布' }, { value: 'later', label: '🕵️ 結帳時公布' }]} value={revealNow} onChange={setRevealNow} />
          </Field>
        </>
      ))}

      <button type="submit" className="btn-primary w-full">{editing ? '更新' : '記一筆'}</button>
    </form>
  )
}
