// 純計算與工具函式(只依賴 store,不碰 DOM)
import { proj, COLORS } from './store.js'

const fmt = (n) => 'NT$ ' + Math.round(n).toLocaleString('zh-Hant') // 金額一律取整數顯示
const memberById = (id) => proj().members.find((m) => m.id === id)
const colorOf = (id) => COLORS[((id % COLORS.length) + COLORS.length) % COLORS.length]
const initials = (name) => String(name ?? '').trim().slice(0, 1).toUpperCase()
const today = () => { const d = new Date(); return `${d.getMonth() + 1}/${d.getDate()}` }
const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/* ---------- 計算:多人分帳 ---------- */
function balances() {
  const bal = {}
  proj().members.forEach((m) => (bal[m.id] = 0))
  proj().expenses.forEach((e) => {
    if (e.mode === 'random') {
      if (!e.revealed) return // 未開獎不列入
      const ls = losersOf(e)
      if (!ls.length) return
      if (bal[e.payer] !== undefined) bal[e.payer] += e.amount
      ls.forEach((id) => { if (bal[id] !== undefined) bal[id] -= e.amount / ls.length })
    } else if (e.mode === 'exact') {
      Object.entries(e.paid || {}).forEach(([id, a]) => { if (bal[id] !== undefined) bal[id] += a })
      Object.entries(e.spent || {}).forEach(([id, a]) => { if (bal[id] !== undefined) bal[id] -= a })
    } else {
      const share = e.amount / e.splitters.length
      if (bal[e.payer] !== undefined) bal[e.payer] += e.amount
      e.splitters.forEach((s) => { if (bal[s] !== undefined) bal[s] -= share })
    }
  })
  return bal // 正數 = 該收錢,負數 = 該付錢
}
function settlements() {
  const bal = balances()
  const debtors = [], creditors = []
  Object.entries(bal).forEach(([id, v]) => {
    if (v < -0.01) debtors.push({ id: +id, amt: -v })
    else if (v > 0.01) creditors.push({ id: +id, amt: v })
  })
  debtors.sort((a, b) => b.amt - a.amt); creditors.sort((a, b) => b.amt - a.amt)
  const out = []
  let i = 0, j = 0
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amt, creditors[j].amt)
    out.push({ from: debtors[i].id, to: creditors[j].id, amt: pay })
    debtors[i].amt -= pay; creditors[j].amt -= pay
    if (debtors[i].amt < 0.01) i++
    if (creditors[j].amt < 0.01) j++
  }
  return out
}

/* ---------- 計算:基金 / 個人(存入 in、支出 out) ---------- */
function ledgerStats() {
  let tin = 0, tout = 0
  const dep = {}
  proj().members.forEach((m) => (dep[m.id] = 0))
  proj().expenses.forEach((e) => {
    if (e.kind === 'in') { tin += e.amount; if (dep[e.payer] !== undefined) dep[e.payer] += e.amount }
    else tout += e.amount
  })
  return { tin, tout, bal: tin - tout, dep }
}

function expenseBreakdown() {
  const isSplit = proj().type === 'split'
  const sums = {}
  proj().expenses.forEach((e) => {
    if (e.settle) return
    if (isSplit || e.kind === 'out') {
      const c = e.cat || '📦 其他'
      sums[c] = (sums[c] || 0) + e.amount
    }
  })
  return Object.entries(sums).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
}
function toItems(sums) {
  return Object.entries(sums).map(([label, value]) => ({ label, value }))
    .filter((x) => x.value > 0.01).sort((a, b) => b.value - a.value)
}
// 誰先付多少(付款占比)
function memberPaidBreakdown() {
  const sums = {}
  proj().expenses.forEach((e) => {
    if (e.settle) return
    if (e.mode === 'random') {
      if (!e.revealed) return
      const n = memberById(e.payer)?.name || '?'
      sums[n] = (sums[n] || 0) + e.amount
    } else if (e.mode === 'exact') {
      Object.entries(e.paid || {}).forEach(([id, a]) => {
        const n = memberById(+id)?.name || '?'
        sums[n] = (sums[n] || 0) + a
      })
    } else {
      const n = memberById(e.payer)?.name || '?'
      sums[n] = (sums[n] || 0) + e.amount
    }
  })
  return toItems(sums)
}
// 誰花得多(分攤占比)
function memberShareBreakdown() {
  const sums = {}
  proj().expenses.forEach((e) => {
    if (e.settle) return
    if (e.mode === 'random') {
      if (!e.revealed) return
      const ls = losersOf(e)
      ls.forEach((id) => {
        const n = memberById(id)?.name || '?'
        sums[n] = (sums[n] || 0) + e.amount / ls.length
      })
    } else if (e.mode === 'exact') {
      Object.entries(e.spent || {}).forEach(([id, a]) => {
        const n = memberById(+id)?.name || '?'
        sums[n] = (sums[n] || 0) + a
      })
    } else {
      const share = e.amount / e.splitters.length
      e.splitters.forEach((s) => {
        const n = memberById(s)?.name || '?'
        sums[n] = (sums[n] || 0) + share
      })
    }
  })
  return toItems(sums)
}
// 誰存最多(基金)
function depositBreakdown() {
  const s = ledgerStats()
  const sums = {}
  proj().members.forEach((m) => (sums[m.name] = s.dep[m.id]))
  return toItems(sums)
}

function dateToISO(md) {
  const p = String(md || '').split('/')
  if (p.length !== 2) return todayISO()
  const mo = +p[0], da = +p[1]
  if (!Number.isFinite(mo) || !Number.isFinite(da)) return todayISO()
  const y = new Date().getFullYear()
  return `${y}-${String(mo).padStart(2, '0')}-${String(da).padStart(2, '0')}`
}
// <input type="date"> 的 ISO 值 → 紀錄用的 "M/D"
function isoToMD(v) {
  if (!v) return null
  const p = String(v).split('-')
  if (p.length !== 3) return null
  return `${+p[1]}/${+p[2]}`
}

const OP_LABEL = { '/': '÷', '*': '×', '-': '−', '+': '＋' }

// 運算式顯示(ASCII 運算子換成好看的符號)
const dispExpr = (s) => String(s).replace(/\//g, '÷').replace(/\*/g, '×').replace(/-/g, '−').replace(/\+/g, '＋')
// 安全計算運算式(只允許數字與 + - * / .),失敗或非有限值回 NaN
function evalAmt(s) {
  if (!s) return NaN
  let x = String(s)
  while (x && '+-*/.'.includes(x[x.length - 1])) x = x.slice(0, -1)
  if (!x || !/^[\d+\-*/.]+$/.test(x)) return NaN
  try {
    const r = Function('"use strict";return (' + x + ')')()
    return Number.isFinite(r) ? r : NaN
  } catch { return NaN }
}

// 統一的金額有效性檢查:非零、非負、且為有限數
const isValidAmount = (amt) => Number.isFinite(amt) && amt > 0

function editAmt(s, k) {
  if (k === '⌫') return s.slice(0, -1)
  const isOp = '+-*/'.includes(k)
  const last = s[s.length - 1] || ''
  if (isOp) {
    if (!s) return ''
    if ('+-*/'.includes(last)) return s.slice(0, -1) + k
    if (last === '.') return s
    return s.length < 18 ? s + k : s
  }
  if (k === '.') {
    const seg = s.split(/[+\-*/]/).pop()
    return seg.includes('.') ? s : (s || '0') + '.'
  }
  if (s === '0') return k
  return s.length < 18 ? s + k : s
}

// losers 為空時 fallback 到舊格式 loser
const losersOf = (e) => (e.losers && e.losers.length ? e.losers : (e.loser != null ? [e.loser] : []))

// 0..n-1 的均勻整數亂數(crypto 等級、拒絕取樣消除模數偏差)
function randInt(n) {
  if (n <= 1) return 0
  const g = typeof crypto !== 'undefined' && crypto.getRandomValues ? crypto : null
  if (!g) return Math.floor(Math.random() * n)
  const limit = Math.floor(4294967296 / n) * n
  const buf = new Uint32Array(1)
  let x
  do { g.getRandomValues(buf); x = buf[0] } while (x >= limit)
  return x % n
}

export {
  fmt, memberById, colorOf, initials, today, todayISO, dateToISO, isoToMD,
  balances, settlements, ledgerStats,
  expenseBreakdown, toItems, memberPaidBreakdown, memberShareBreakdown, depositBreakdown,
  OP_LABEL, dispExpr, evalAmt, editAmt, losersOf, isValidAmount, randInt,
}
