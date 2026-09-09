// 純計算與工具函式（只依賴 store）
import { proj, COLORS } from './store.js?v=25';

const fmt = n => 'NT$ ' + Math.round(n).toLocaleString('zh-Hant'); // 金額一律取整數顯示
const memberById = id => proj().members.find(m => m.id === id);
const colorOf = id => COLORS[((id % COLORS.length) + COLORS.length) % COLORS.length];
const initials = name => name.trim().slice(0, 1).toUpperCase();
const today = () => { const d = new Date(); return `${d.getMonth() + 1}/${d.getDate()}`; };
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/* ---------- 計算：多人分帳 ---------- */
function balances() {
  const bal = {};
  proj().members.forEach(m => bal[m.id] = 0);
  proj().expenses.forEach(e => {
    if (e.mode === 'random') {
      if (!e.revealed) return; // 未開獎不列入，避免被反推出結果
      const ls = losersOf(e);
      if (!ls.length) return; // 無中獎者資訊的異常資料：整筆跳過，避免付款人收全額卻無人被扣款
      if (bal[e.payer] !== undefined) bal[e.payer] += e.amount;
      ls.forEach(id => { if (bal[id] !== undefined) bal[id] -= e.amount / ls.length; });
    } else if (e.mode === 'exact') {
      // 特定付款：逐人記先付與支出
      Object.entries(e.paid || {}).forEach(([id, a]) => { if (bal[id] !== undefined) bal[id] += a; });
      Object.entries(e.spent || {}).forEach(([id, a]) => { if (bal[id] !== undefined) bal[id] -= a; });
    } else {
      const share = e.amount / e.splitters.length;
      if (bal[e.payer] !== undefined) bal[e.payer] += e.amount;
      e.splitters.forEach(s => { if (bal[s] !== undefined) bal[s] -= share; });
    }
  });
  return bal; // 正數 = 該收錢，負數 = 該付錢
}
function settlements() {
  const bal = balances();
  const debtors = [], creditors = [];
  Object.entries(bal).forEach(([id, v]) => {
    if (v < -0.01) debtors.push({ id: +id, amt: -v });
    else if (v > 0.01) creditors.push({ id: +id, amt: v });
  });
  debtors.sort((a, b) => b.amt - a.amt); creditors.sort((a, b) => b.amt - a.amt);
  const out = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amt, creditors[j].amt);
    out.push({ from: debtors[i].id, to: creditors[j].id, amt: pay });
    debtors[i].amt -= pay; creditors[j].amt -= pay;
    if (debtors[i].amt < 0.01) i++;
    if (creditors[j].amt < 0.01) j++;
  }
  return out;
}

/* ---------- 計算：基金／個人（存入 in、支出 out） ---------- */
function ledgerStats() {
  let tin = 0, tout = 0;
  const dep = {};
  proj().members.forEach(m => dep[m.id] = 0);
  proj().expenses.forEach(e => {
    if (e.kind === 'in') { tin += e.amount; if (dep[e.payer] !== undefined) dep[e.payer] += e.amount; }
    else tout += e.amount;
  });
  return { tin, tout, bal: tin - tout, dep };
}


function expenseBreakdown() {
  const isSplit = proj().type === 'split';
  const sums = {};
  proj().expenses.forEach(e => {
    if (e.settle) return; // 清償紀錄不是消費，不進分類統計
    if (isSplit || e.kind === 'out') {
      const c = e.cat || '📦 其他';
      sums[c] = (sums[c] || 0) + e.amount;
    }
  });
  return Object.entries(sums).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}
function toItems(sums) {
  return Object.entries(sums).map(([label, value]) => ({ label, value }))
    .filter(x => x.value > 0.01).sort((a, b) => b.value - a.value);
}
// 誰先付多少（付款占比）
function memberPaidBreakdown() {
  const sums = {};
  proj().expenses.forEach(e => {
    if (e.settle) return; // 清償不是代墊
    if (e.mode === 'random') {
      if (!e.revealed) return;
      const n = memberById(e.payer)?.name || '?';
      sums[n] = (sums[n] || 0) + e.amount;
    } else if (e.mode === 'exact') {
      Object.entries(e.paid || {}).forEach(([id, a]) => {
        const n = memberById(+id)?.name || '?';
        sums[n] = (sums[n] || 0) + a;
      });
    } else {
      const n = memberById(e.payer)?.name || '?';
      sums[n] = (sums[n] || 0) + e.amount;
    }
  });
  return toItems(sums);
}
// 誰花得多（分攤占比）
function memberShareBreakdown() {
  const sums = {};
  proj().expenses.forEach(e => {
    if (e.settle) return; // 清償不是消費
    if (e.mode === 'random') {
      if (!e.revealed) return;
      const ls = losersOf(e);
      ls.forEach(id => {
        const n = memberById(id)?.name || '?';
        sums[n] = (sums[n] || 0) + e.amount / ls.length;
      });
    } else if (e.mode === 'exact') {
      Object.entries(e.spent || {}).forEach(([id, a]) => {
        const n = memberById(+id)?.name || '?';
        sums[n] = (sums[n] || 0) + a;
      });
    } else {
      const share = e.amount / e.splitters.length;
      e.splitters.forEach(s => {
        const n = memberById(s)?.name || '?';
        sums[n] = (sums[n] || 0) + share;
      });
    }
  });
  return toItems(sums);
}
// 誰存最多（基金）
function depositBreakdown() {
  const s = ledgerStats();
  const sums = {};
  proj().members.forEach(m => sums[m.name] = s.dep[m.id]);
  return toItems(sums);
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function dateToISO(md) {
  const p = String(md || '').split('/');
  if (p.length !== 2) return todayISO();
  const mo = +p[0], da = +p[1];
  if (!Number.isFinite(mo) || !Number.isFinite(da)) return todayISO();
  const y = new Date().getFullYear();
  return `${y}-${String(mo).padStart(2, '0')}-${String(da).padStart(2, '0')}`;
}

const OP_LABEL = { '/': '÷', '*': '×', '-': '−', '+': '＋' };

// 運算式顯示（ASCII 運算子換成好看的符號）
const dispExpr = s => s.replace(/\//g, '÷').replace(/\*/g, '×').replace(/-/g, '−').replace(/\+/g, '＋');
// 安全計算運算式（只允許數字與 + - * / .），失敗或非有限值（如除以零產生 Infinity）回 NaN
function evalAmt(s) {
  if (!s) return NaN;
  let x = String(s);
  while (x && '+-*/.'.includes(x[x.length - 1])) x = x.slice(0, -1); // 去掉結尾未完成的運算子
  if (!x || !/^[\d+\-*/.]+$/.test(x)) return NaN;
  try {
    const r = Function('"use strict";return (' + x + ')')();
    return Number.isFinite(r) ? r : NaN; // 擋下 Infinity/-Infinity（例如 1/0）與 NaN
  } catch (e) { return NaN; }
}

// 統一的金額有效性檢查：非零、非負、且為有限數（擋下 NaN/Infinity）
const isValidAmount = amt => Number.isFinite(amt) && amt > 0;

function editAmt(s, k) {
  if (k === '⌫') return s.slice(0, -1);
  const isOp = '+-*/'.includes(k);
  const last = s[s.length - 1] || '';
  if (isOp) {
    if (!s) return '';                          // 開頭不能是運算子
    if ('+-*/'.includes(last)) return s.slice(0, -1) + k; // 連按運算子＝換運算子
    if (last === '.') return s;
    return s.length < 18 ? s + k : s;
  }
  if (k === '.') {
    const seg = s.split(/[+\-*/]/).pop();      // 只看目前這一段數字
    return seg.includes('.') ? s : (s || '0') + '.';
  }
  if (s === '0') return k;
  return s.length < 18 ? s + k : s;
}

// losers 為空陣列時視為「無中獎者資訊」，不可直接回傳空陣列（否則會造成
// 付款人收全額但無人被扣款的資金不平衡），需 fallback 到舊格式 loser 或回傳空陣列
// 且呼叫端（如 balances()）已對空陣列做防禦，但這裡先修正語意本身。
const losersOf = e => (e.losers && e.losers.length ? e.losers : (e.loser != null ? [e.loser] : []));

export {
  fmt, memberById, colorOf, initials, today, todayISO, esc, dateToISO,
  balances, settlements, ledgerStats,
  expenseBreakdown, toItems, memberPaidBreakdown, memberShareBreakdown, depositBreakdown,
  OP_LABEL, dispExpr, evalAmt, editAmt, losersOf, isValidAmount,
};
