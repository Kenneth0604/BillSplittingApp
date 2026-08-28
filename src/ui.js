// UI 層：渲染、表單、事件處理（依賴 store / calc / cloud）
import {
  data, proj, save, getCats, projKey, CATS, TYPE_INFO, CAT_COLORS,
} from './store.js?v=23';
import {
  fmt, memberById, colorOf, initials, today, todayISO, esc, dateToISO,
  balances, settlements, ledgerStats,
  expenseBreakdown, toItems, memberPaidBreakdown, memberShareBreakdown, depositBreakdown,
  OP_LABEL, dispExpr, evalAmt, editAmt, losersOf, isValidAmount,
} from './calc.js?v=23';
import {
  sb, cloudOn, authUser, isAdmin, setAuthUser, pullAll, syncMyProjects,
  genCode, projPayload, ADMIN_EMAILS, refreshAdminFlag,
} from './cloud.js?v=23';

let currentPage = 'expenses';

// 讀取表單日期欄（沒填就用今天），存成 M/D
function dateFromInput() {
  const v = document.getElementById('inDate')?.value;
  if (!v) return today();
  const parts = v.split('-');
  return `${+parts[1]}/${+parts[2]}`;
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 1800);
}

/* ---------- 分類與圓餅圖 ---------- */
function catChipsHTML(kind) {
  return getCats(kind).map((c, i) =>
    `<div class="chip ${i === 0 ? 'on' : ''}" data-c="${esc(c)}" onclick="app.selectCat(this)">${esc(c)}</div>`).join('');
}
function selectCat(el) {
  document.querySelectorAll('#catChips .chip').forEach(c => c.classList.remove('on'));
  el.classList.add('on');
}
function pieChartHTML(items, title) {
  if (!items.length) return '';
  const total = items.reduce((s, x) => s + x.value, 0);
  let acc = 0;
  const stops = items.map((x, i) => {
    const from = acc / total * 360; acc += x.value;
    const to = acc / total * 360;
    return `${CAT_COLORS[i % CAT_COLORS.length]} ${from}deg ${to}deg`;
  }).join(', ');
  const legend = items.map((x, i) =>
    `<div class="lg-row"><span class="dot" style="background:${CAT_COLORS[i % CAT_COLORS.length]}"></span>
  <span class="lg-label">${x.label}</span>
  <span class="lg-val">${fmt(x.value)} · ${Math.round(x.value / total * 100)}%</span></div>`).join('');
  return `<div class="section-title">${title || '支出分類'}</div><div class="card">
<div class="pie-wrap"><div class="pie" style="background:conic-gradient(${stops})"></div>
<div class="legend">${legend}</div></div></div>`;
}

/* ---------- 頁面 ---------- */
function switchTab(page) {
  currentPage = page;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.page === page));
  render();
}

function pageTitles() {
  const t = proj().type;
  return {
    expenses: '記記', members: '自訂',
    settle: t === 'fund' ? '基金狀況' : t === 'personal' ? '統計' : '結算',
  };
}

// 雙人模式：多人分帳且剛好兩位成員
function isDuoMode() {
  return proj().type === 'split' && proj().members.length === 2;
}
function render() {
  const p = proj(), type = p.type;
  const duo = isDuoMode();
  const tabSettle = document.getElementById('tabSettle');
  if (tabSettle) tabSettle.style.display = duo ? 'none' : 'flex';
  if (duo && currentPage === 'settle') { switchTab('expenses'); return; }
  const titles = pageTitles();
  document.getElementById('tabLbl-expenses').textContent = titles.expenses;
  document.getElementById('tabLbl-settle').textContent = titles.settle;
  document.getElementById('navTitle').textContent = titles[currentPage];
  document.getElementById('projectName').textContent = p.name;
  // 自訂頁與結算頁用頁內按鈕，不顯示 FAB
  document.getElementById('fab').style.display = (currentPage === 'settle' || currentPage === 'members') ? 'none' : 'flex';

  const c = document.getElementById('content');
  if (currentPage === 'expenses') c.innerHTML = renderExpensesPage(type) + chatHTML();
  if (currentPage === 'members') c.innerHTML = renderMembersPage(type);
  if (currentPage === 'settle') c.innerHTML = renderSettlePage(type);
}

function renderExpensesPage(type) {
  let html = '';
  if (type === 'split') {
    const total = proj().expenses.reduce((s, e) => s + (e.settle ? 0 : e.amount), 0);
    if (isDuoMode()) {
      const [m1, m2] = proj().members;
      const bal = balances();
      const meName = chatName();
      const me = proj().members.find(m => m.name === meName) || null;
      const other = me ? proj().members.find(m => m.id !== me.id) : null;
      const net = bal[m1.id];
      const amt = Math.abs(net);
      let line, debtor = null, creditor = null;
      if (amt < 0.01) {
        line = '目前互不相欠 🎉';
      } else {
        debtor = net < -0.01 ? m1 : m2;
        creditor = net < -0.01 ? m2 : m1;
        if (me && debtor.id === me.id) line = `你欠 ${esc(creditor.name)}<br>${fmt(amt)}`;
        else if (me && creditor.id === me.id) line = `${esc(debtor.name)} 欠你<br>${fmt(amt)}`;
        else line = `${esc(debtor.name)} 欠 ${esc(creditor.name)}<br>${fmt(amt)}`;
      }
      document.getElementById('navSub').textContent =
        `👥 雙人模式${other ? '｜與 ' + other.name : ''} · ${proj().expenses.length} 筆`;
      html += `<div class="stat-card"><div class="label">👥 雙人模式 · ${esc(m1.name)} & ${esc(m2.name)}</div>
    <div class="big" style="font-size:26px;line-height:1.35">${line}</div>
    <div class="meta">總支出 ${fmt(total)}</div></div>`;
      if (debtor) {
        html += `<button class="btn gray" onclick="app.settleTransfer(${debtor.id}, ${creditor.id}, ${amt})">✓ 標記已結清（${esc(debtor.name)} 已付款）</button><div style="height:12px"></div>`;
      }
      if (!proj().expenses.length) return html + `<div class="empty"><div class="icon">🧾</div><p>還沒有任何支出<br>點右下角 ＋ 新增第一筆</p></div>`;
      html += `<div class="card">`;
      [...proj().expenses].reverse().forEach(e => { html += duoRow(e); });
      return html + `</div>`;
    }
    document.getElementById('navSub').textContent = `${proj().expenses.length} 筆支出`;
    html += `<div class="stat-card"><div class="label">總支出</div><div class="big">${fmt(total)}</div><div class="meta">${proj().members.length} 位成員 · ${proj().expenses.length} 筆帳目</div></div>`;
    if (!proj().expenses.length) return html + `<div class="empty"><div class="icon">🧾</div><p>還沒有任何支出<br>點右下角 ＋ 新增第一筆</p></div>`;
    html += `<div class="card">`;
    [...proj().expenses].reverse().forEach(e => { html += duoRow(e); });
    return html + `</div>`;
  }
  return renderLedgerPage(type);
}
// 多人/雙人共用的支出列
function duoRow(e) {
      let avatarId, payText, splitText;
      if (e.mode === 'random') {
        avatarId = e.payer;
        payText = esc(memberById(e.payer)?.name || '?') + ' 先付';
        splitText = e.revealed ? `🎲 ${esc(losersOf(e).map(id => memberById(id)?.name || '?').join('、'))} 買單` : '🎲 未開獎';
      } else if (e.mode === 'exact') {
        const pids = Object.keys(e.paid || {}).map(Number);
        avatarId = pids[0] || 0;
        payText = esc(pids.map(id => memberById(id)?.name || '?').join('、')) + ' 先付';
        if (e.duo) {
          const otherId = Object.keys(e.spent || {}).map(Number)[0];
          splitText = `${esc(memberById(otherId)?.name || '對方')} 欠全額`;
        } else {
          splitText = e.settle ? '💸 清償' : '特定分帳';
        }
      } else {
        avatarId = e.payer;
        payText = esc(memberById(e.payer)?.name || '?') + ' 先付';
        splitText = `${e.splitters.length} 人分攤`;
      }
      return `<div class="row">
    ${memberAvatar(memberById(avatarId))}
    <div class="grow">
      <div class="title">${esc(e.desc || e.cat || '未命名支出')}</div>
      <div class="detail">${e.desc && e.cat ? esc(e.cat) + ' · ' : ''}${payText} · ${splitText} · ${e.date}${e.by ? ` · ${esc(e.by)} 記` : ''}</div>
    </div>
    <div class="amount">${fmt(e.amount)}</div>
    ${e.mode === 'random' && !e.revealed ? `<button class="del-btn" style="color:var(--warning)" onclick="app.revealRandom(${e.id})">🎲</button>` : ''}
    <button class="del-btn" style="color:var(--primary)" onclick="app.openEditSheet(${e.id})">✎</button>
  <button class="del-btn" onclick="app.delExpense(${e.id})">✕</button>
  </div>`;
}

// fund / personal 單筆紀錄列（renderLedgerPage 與「查看特定日期」共用）
function ledgerRowHTML(e, isFund) {
  const isIn = e.kind === 'in';
  let detail = e.date;
  let avatar = `<div class="avatar" style="background:${isIn ? 'var(--success)' : 'var(--danger)'}">${isIn ? '＋' : '－'}</div>`;
  if (isFund && isIn) {
    const m = memberById(e.payer);
    avatar = `<div class="avatar" style="background:${colorOf(e.payer)}">${esc(initials(m?.name || '?'))}</div>`;
    detail = `${esc(m?.name || '?')} 存入 · ${e.date}`;
  }
  const title = esc(e.desc || e.cat || (isIn ? '收入' : '支出'));
  if (e.desc && e.cat) detail = `${esc(e.cat)} · ${detail}`;
  if (e.by) detail += ` · ${esc(e.by)} 記`;
  return `<div class="row">
  ${avatar}
  <div class="grow"><div class="title">${title}</div><div class="detail">${detail}</div></div>
  <div class="amount ${isIn ? 'pos' : 'neg'}">${isIn ? '+' : '−'}${fmt(e.amount)}</div>
  <button class="del-btn" style="color:var(--primary)" onclick="app.openEditSheet(${e.id})">✎</button>
  <button class="del-btn" onclick="app.delExpense(${e.id})">✕</button>
</div>`;
}
// fund / personal 明細
function renderLedgerPage(type) {
  let html = '';
  const s = ledgerStats();
  const isFund = type === 'fund';
  document.getElementById('navSub').textContent = `${proj().expenses.length} 筆紀錄`;
  html += `<div class="stat-card ${isFund ? 'green' : 'purple'}">
<div class="label">${isFund ? '基金餘額' : '結餘'}</div>
<div class="big">${fmt(s.bal)}</div>
<div class="meta">${isFund ? '總存入' : '總收入'} ${fmt(s.tin)} · 總支出 ${fmt(s.tout)}</div></div>`;
  if (!proj().expenses.length) return html + `<div class="empty"><div class="icon">${isFund ? '🏦' : '📒'}</div><p>還沒有任何紀錄<br>點右下角 ＋ 新增第一筆</p></div>`;
  html += `<div class="card">`;
  [...proj().expenses].reverse().forEach(e => { html += ledgerRowHTML(e, isFund); });
  return html + `</div>`;
}

/* ---------- 依日期查看 ---------- */
// 把 <input type="date"> 的 ISO 值換成紀錄裡儲存的 "M/D" 格式（不含年份）
function isoToMD(v) {
  if (!v) return null;
  const p = String(v).split('-');
  if (p.length !== 3) return null;
  return `${+p[1]}/${+p[2]}`;
}
function openDateSheet() {
  document.getElementById('sheetTitle').textContent = '📅 查看特定日期';
  document.getElementById('sheetBody').innerHTML = `
  <div class="field"><label>選擇日期</label><input id="inViewDate" type="date" value="${todayISO()}" onchange="app.renderDateResults()"></div>
  <div id="dateResults"></div>`;
  document.getElementById('mask').classList.add('open');
  document.getElementById('sheet').classList.add('open');
  renderDateResults();
}
function renderDateResults() {
  const el = document.getElementById('dateResults');
  if (!el) return;
  const md = isoToMD(document.getElementById('inViewDate')?.value);
  const type = proj().type;
  const isFund = type === 'fund';
  const list = proj().expenses.filter(e => e.date === md);
  if (!list.length) {
    el.innerHTML = `<div class="empty"><div class="icon">📅</div><p>${esc(md || '')} 這天沒有紀錄</p></div>`;
    return;
  }
  let tin = 0, tout = 0;
  list.forEach(e => {
    if (type === 'split') { if (!e.settle) tout += e.amount; }
    else if (e.kind === 'in') tin += e.amount; else tout += e.amount;
  });
  const summary = type === 'split'
    ? `<div class="stat-card"><div class="label">${esc(md)} 支出合計</div><div class="big">${fmt(tout)}</div></div>`
    : `<div class="stat-card ${isFund ? 'green' : 'purple'}"><div class="label">${esc(md)} 收支</div><div class="big">${fmt(tin - tout)}</div><div class="meta">${isFund ? '總存入' : '總收入'} ${fmt(tin)} · 總支出 ${fmt(tout)}</div></div>`;
  let rows = '';
  [...list].reverse().forEach(e => { rows += type === 'split' ? duoRow(e) : ledgerRowHTML(e, isFund); });
  el.innerHTML = summary + `<div class="card">${rows}</div>`;
}

function renderMembersPage(type) {
  document.getElementById('navSub').textContent = type === 'personal' ? '管理分類' : `${proj().members.length} 位成員 · 分類管理`;
  let html = '';

  // --- 成員（個人記帳不需要） ---
  if (type !== 'personal') {
    html += `<div class="section-title">${type === 'fund' ? '成員與存入金額' : '成員與餘額'}</div><div class="card">`;
    if (!proj().members.length) {
      html += `<div class="empty" style="padding:30px"><div class="icon">👥</div><p>還沒有成員</p></div>`;
    } else if (type === 'fund') {
      const s = ledgerStats();
      proj().members.forEach(m => {
        html += `<div class="row">
      ${memberAvatar(m)}
      <div class="grow"><div class="title">${esc(m.name)}</div><div class="detail">已存入</div></div>
      <div class="amount pos">${fmt(s.dep[m.id])}</div>
      <button class="del-btn" style="color:var(--primary)" onclick="app.openMemberEditSheet(${m.id})">✎</button>
      <button class="del-btn" onclick="app.delMember(${m.id})">✕</button>
    </div>`;
      });
    } else {
      const bal = balances();
      proj().members.forEach(m => {
        const b = bal[m.id];
        const cls = b > 0.01 ? 'pos' : b < -0.01 ? 'neg' : '';
        const txt = b > 0.01 ? `+${fmt(b)}` : b < -0.01 ? `−${fmt(-b)}` : '已結清';
        html += `<div class="row">
      ${memberAvatar(m)}
      <div class="grow"><div class="title">${esc(m.name)}</div>
        <div class="detail">${b > 0.01 ? '應收回' : b < -0.01 ? '應支付' : '無欠款'}</div></div>
      <div class="amount ${cls}">${txt}</div>
      <button class="del-btn" style="color:var(--primary)" onclick="app.openMemberEditSheet(${m.id})">✎</button>
      <button class="del-btn" onclick="app.delMember(${m.id})">✕</button>
    </div>`;
      });
    }
    html += `</div><button class="btn gray" onclick="app.openMemberSheet()">＋ 新增成員</button>`;
  }

  // --- 分類管理 ---
  const groups = [{ kind: 'out', label: '支出分類' }];
  if (type === 'fund') groups.push({ kind: 'in', label: '存入分類' });
  if (type === 'personal') groups.push({ kind: 'in', label: '收入分類' });
  groups.forEach(g => {
    html += `<div class="section-title">${g.label}（點 ✕ 刪除）</div>
  <div class="card"><div style="padding:14px"><div class="chips">`;
    getCats(g.kind).forEach((c, i) => {
      html += `<div class="chip" onclick="app.openCatEditSheet('${g.kind}',${i})" style="cursor:pointer">${esc(c)}<span class="x" onclick="event.stopPropagation();app.delCat('${g.kind}',${i})">✕</span></div>`;
    });
    html += `</div></div></div>
  <button class="btn gray" onclick="app.openCatSheet('${g.kind}','${g.label}')">＋ 新增${g.label}</button>`;
  });
  return html;
}

function renderSettlePage(type) {
  let html = '';
  if (type === 'split') {
    // 🎲 未開獎的隨機付款
    const pending = proj().expenses.filter(e => e.mode === 'random' && !e.revealed);
    if (pending.length) {
      html += `<div class="section-title">🎲 未開獎（尚未列入結算）</div><div class="card">`;
      pending.forEach(e => {
        html += `<div class="row">
      <div class="avatar" style="background:var(--warning)">🎲</div>
      <div class="grow"><div class="title">${esc(e.desc || e.cat || '神秘支出')}</div>
        <div class="detail">${esc(memberById(e.payer)?.name || '?')} 先付 · ${e.date}</div></div>
      <div class="amount">${fmt(e.amount)}</div>
      <button class="del-btn" style="color:var(--warning);font-size:14px;font-weight:700" onclick="app.revealRandom(${e.id})">開獎</button>
    </div>`;
      });
      html += `</div>`;
    }

    const plan = settlements();
    const pies = pieChartHTML(memberPaidBreakdown(), '💳 誰先付多少') +
      pieChartHTML(memberShareBreakdown(), '🍽️ 誰花得多（分攤）') +
      pieChartHTML(expenseBreakdown(), '📊 支出分類');
    document.getElementById('navSub').textContent = plan.length ? `最少 ${plan.length} 筆轉帳即可結清` : '';
    html += `<div class="section-title">最佳結算方案</div>`;
    if (!plan.length) return html + `<div class="empty"><div class="icon">🎉</div><p>大家都結清了！<br>沒有需要轉帳的款項</p></div>` + pies;
    html += `<div class="card">`;
    plan.forEach(t => {
      const f = memberById(t.from), to = memberById(t.to);
      html += `<div class="transfer">
    <div class="who">${memberAvatar(f)}<div class="who-name">${esc(f?.name || '?')}</div></div>
    <div class="arrow-wrap">
      <div class="arrow-amt">${fmt(t.amt)}</div>
      <div class="arrow-line"></div>
    </div>
    <div class="who">${memberAvatar(to)}<div class="who-name">${esc(to?.name || '?')}</div></div>
    <button class="settle-btn" onclick="app.settleTransfer(${t.from}, ${t.to}, ${t.amt})">✓ 已付</button>
  </div>`;
    });
    return html + `</div>
  <button class="btn gray" onclick="app.copySettlement()">📋 複製結算結果</button>` + pies +
      `<div style="height:14px"></div><button class="btn gray" onclick="app.markSettled()">✓ 標記全部已結清</button>`;
  }

  const s = ledgerStats();
  if (type === 'fund') {
    document.getElementById('navSub').textContent = `基金餘額 ${fmt(s.bal)}`;
    html += `<div class="stat-card green"><div class="label">基金餘額</div><div class="big">${fmt(s.bal)}</div>
  <div class="meta">總存入 ${fmt(s.tin)} · 總支出 ${fmt(s.tout)}</div></div>`;
    if (!proj().members.length) return html + `<div class="empty"><div class="icon">👥</div><p>先到「自訂」新增成員</p></div>`;
    const share = s.tout / proj().members.length;
    html += `<div class="section-title">分攤狀況（支出均攤，每人 ${fmt(share)}）</div><div class="card">`;
    proj().members.forEach(m => {
      const diff = s.dep[m.id] - share;
      const cls = diff > 0.01 ? 'pos' : diff < -0.01 ? 'neg' : '';
      const txt = diff > 0.01 ? `可退回 ${fmt(diff)}` : diff < -0.01 ? `應補繳 ${fmt(-diff)}` : '剛好打平';
      html += `<div class="row">
    ${memberAvatar(m)}
    <div class="grow"><div class="title">${esc(m.name)}</div><div class="detail">已存入 ${fmt(s.dep[m.id])}</div></div>
    <div class="amount ${cls}" style="font-size:14px">${txt}</div>
  </div>`;
    });
    return html + `</div>` + pieChartHTML(depositBreakdown(), '💰 誰存最多') + pieChartHTML(expenseBreakdown(), '📊 支出分類');
  }

  // personal 統計
  document.getElementById('navSub').textContent = '';
  const mNow = new Date().getMonth() + 1;
  let mIn = 0, mOut = 0;
  proj().expenses.forEach(e => {
    if (+String(e.date).split('/')[0] === mNow) { e.kind === 'in' ? mIn += e.amount : mOut += e.amount; }
  });
  html += `<div class="stat-card purple"><div class="label">目前結餘</div><div class="big">${fmt(s.bal)}</div>
<div class="meta">總收入 ${fmt(s.tin)} · 總支出 ${fmt(s.tout)}</div></div>`;
  html += `<div class="section-title">本月（${mNow} 月）</div><div class="card">
<div class="row"><div class="grow"><div class="title">收入</div></div><div class="amount pos">+${fmt(mIn)}</div></div>
<div class="row"><div class="grow"><div class="title">支出</div></div><div class="amount neg">−${fmt(mOut)}</div></div>
<div class="row"><div class="grow"><div class="title">本月結餘</div></div><div class="amount">${fmt(mIn - mOut)}</div></div>
  </div>`;
  return html + pieChartHTML(expenseBreakdown());
}

/* ---------- 操作 ---------- */
/* ---------- 留言區 ---------- */
function chatName() {
  let n = '';
  try { n = localStorage.getItem('nick_' + projKey()) || ''; } catch (e) { }
  if (!n && authUser) n = authUser.nickname;
  if (!n) { try { n = localStorage.getItem('chatName') || ''; } catch (e) { } }
  return n;
}
// 只在「第一次加入雲端專案」時詢問顯示名稱（切換/建立不再詢問；想改名直接改留言區的名字欄）
function ensureProjNick() {
  const p = proj();
  if (p.type === 'personal') return;
  let existing = '';
  try { existing = localStorage.getItem('nick_' + projKey()) || ''; } catch (e) { }
  if (existing) return;
  const def = (authUser && authUser.nickname) || chatName() || '';
  const n = prompt(`你在「${p.name}」要顯示的名稱？（留言時使用，之後可在留言區改）`, def);
  const val = (n && n.trim()) || def;
  if (val) {
    try { localStorage.setItem('nick_' + projKey(), val); } catch (e) { }
    render();
  }
}
// 加入專案時，自動把自己（以此專案的顯示名稱）加入成員名單
function autoAddSelfAsMember() {
  const p = proj();
  if (p.type === 'personal') return;
  const name = chatName();
  if (!name) return;
  const myAvatar = (authUser && authUser.avatar) || '';
  const exist = p.members.find(m => m.name === name);
  if (exist) {
    // 已在名單：沒頭貼就補上帳號頭貼
    if (!exist.avatar && myAvatar) { exist.avatar = myAvatar; save(); render(); }
    return;
  }
  p.members.push({ id: p.nextMemberId++, name, avatar: myAvatar });
  save(); render();
  toast(`已自動將「${name}」加入成員`);
}
// 成員頭貼：有照片用照片，沒有用色塊字首
function memberAvatar(m, cls = '') {
  if (m && m.avatar) return `<img class="avatar-img ${cls}" src="${esc(m.avatar)}" alt="">`;
  return `<div class="avatar ${cls}" style="background:${colorOf(m ? m.id : 0)}">${esc(initials((m && m.name) || '?'))}</div>`;
}
function chatHTML() {
  const chats = proj().chats || [];
  let html = `<div class="section-title">💬 留言區</div><div class="card chat-card">`;
  if (!chats.length) {
    html += `<div class="chat-empty">還沒有留言，說點什麼吧</div>`;
  } else {
    const me = chatName();
    chats.forEach(c => {
      const mine = me && c.name === me;
      html += `<div class="chat-row ${mine ? 'mine' : ''}">
        <div class="chat-bubble">
          ${mine ? '' : `<div class="chat-name">${esc(c.name)}</div>`}
          <div>${esc(c.text)}</div>
          <div class="chat-time">${esc(c.time)}</div>
        </div>
      </div>`;
    });
  }
  html += `</div>
    <div class="chat-input">
      <input id="chatWho" placeholder="此專案暱稱" maxlength="8" value="${esc(chatName())}">
      <input id="chatText" placeholder="留言⋯" maxlength="200" onkeydown="if(event.key==='Enter')app.addChat()">
      <button class="chat-send" onclick="app.addChat()">送出</button>
    </div>`;
  return html;
}
function addChat() {
  const name = document.getElementById('chatWho').value.trim();
  const text = document.getElementById('chatText').value.trim();
  if (!name) { toast('請填暱稱'); return; }
  if (!text) { toast('請輸入留言'); return; }
  // 記住「這個專案」用的暱稱（每個專案可以不同）
  try { localStorage.setItem('nick_' + projKey(), name); localStorage.setItem('chatName', name); } catch (e) { }
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0'), mm = String(d.getMinutes()).padStart(2, '0');
  if (!proj().chats) proj().chats = [];
  proj().chats.push({ name, text, time: `${today()} ${hh}:${mm}` });
  if (proj().chats.length > 200) proj().chats = proj().chats.slice(-200); // 最多留 200 則
  save(); render();
  // 捲到留言區底部
  setTimeout(() => { const c = document.getElementById('content'); if (c) c.scrollTop = c.scrollHeight; }, 50);
}

/* ---------- 編輯紀錄 ---------- */
let editingId = null;
// 新增或更新一筆紀錄（editingId 有值時原地更新、保留 id 與未指定欄位）
function commitRecord(rec) {
  if (editingId != null) {
    const i = proj().expenses.findIndex(x => x.id === editingId);
    if (i >= 0) proj().expenses[i] = Object.assign({}, proj().expenses[i], rec, { id: proj().expenses[i].id });
    editingId = null;
    save(); closeSheet(); toast('已更新 ✓'); render();
  } else {
    rec.id = proj().nextExpenseId++;
    const who = chatName();
    if (who) rec.by = who; // 記錄是誰新增的
    proj().expenses.push(rec);
    save(); closeSheet(); toast('已記帳 ✓'); render();
  }
}
function markCatChip(cat) {
  const chips = [...document.querySelectorAll('#catChips .chip')];
  if (!chips.length) return;
  chips.forEach(c => c.classList.remove('on'));
  const hit = chips.find(c => c.dataset.c === cat);
  (hit || chips[0]).classList.add('on');
}
function setAmtDisplay(v) {
  amtStr = String(v);
  const el = document.getElementById('amtInput');
  if (el) el.value = String(v);
}
function openEditSheet(id) {
  const e = proj().expenses.find(x => x.id === id);
  if (!e) return;
  const type = proj().type;
  const duoSimple = type === 'split' && isDuoMode() && !!e.duo; // 雙人直記欠帳紀錄
  openSheet(type === 'split' && isDuoMode() && !e.duo); // 其他紀錄（均分/特定/隨機）用完整表單
  editingId = id;
  const submitBtn = document.getElementById('submitBtn');
  if (submitBtn) submitBtn.textContent = '更新';
  if (duoSimple) {
    // 雙人簡化表單：只回填分類/說明/日期/付款人/金額
    document.getElementById('sheetTitle').textContent = '✎ 編輯支出';
    const d1 = document.getElementById('inDesc'); if (d1) d1.value = e.desc || '';
    const d2 = document.getElementById('inDate'); if (d2) d2.value = dateToISO(e.date);
    const sel = document.getElementById('inPayer'); if (sel) sel.value = String(e.payer);
    setAmtDisplay(e.amount);
    markCatChip(e.cat);
    return;
  }
  const isSplit = type === 'split';
  document.getElementById('sheetTitle').textContent = isSplit ? '✎ 編輯支出' : '✎ 編輯紀錄';
  const inDesc = document.getElementById('inDesc'); if (inDesc) inDesc.value = e.desc || '';
  const inDate = document.getElementById('inDate'); if (inDate) inDate.value = dateToISO(e.date);
  if (isSplit) {
    const mode = e.mode || 'equal';
    const mc = document.getElementById('modeChips');
    if (mc && mc.parentElement) mc.parentElement.style.display = 'none'; // 編輯時鎖定分帳方式
    const area = document.getElementById('modeArea');
    if (mode === 'equal') {
      area.innerHTML = equalFormHTML();
      setAmtDisplay(e.amount);
      const sel = document.getElementById('inPayer'); if (sel) sel.value = String(e.payer);
      [...document.querySelectorAll('#chips .chip')].forEach(c =>
        c.classList.toggle('on', (e.splitters || []).includes(+c.dataset.id)));
    } else if (mode === 'exact') {
      proj().members.forEach(m => {
        const pv = (e.paid || {})[m.id], sv = (e.spent || {})[m.id];
        if (pv) {
          cellStr['pay_' + m.id] = String(pv);
          const el = document.getElementById('cell_pay_' + m.id);
          if (el) el.value = String(pv);
        }
        if (sv) {
          cellStr['spend_' + m.id] = String(sv);
          const el = document.getElementById('cell_spend_' + m.id);
          if (el) el.value = String(sv);
        }
      });
      updateExactSum();
    } else {
      // random：顯示開獎結果；只能改金額/分類/說明/日期，不重抽
      const ls = losersOf(e);
      const names = ls.map(x => memberById(x)?.name || '?').join('、');
      const candNames = (e.candidates || []).map(x => memberById(x)?.name || '?').join('、');
      const resultLine = e.revealed
        ? `🎲 開獎結果：<b>${esc(names)}</b> 要付${ls.length > 1 ? `（每人 ${fmt(e.amount / ls.length)}）` : ` ${fmt(e.amount)}`}`
        : `🎲 尚未開獎｜參加抽籤：${esc(candNames)}`;
      area.innerHTML = `
  <div class="card"><div style="padding:14px;font-size:14px;line-height:1.8">
    ${resultLine}<br>
    <span style="color:#8e8e93">${esc(memberById(e.payer)?.name || '?')} 先付 ${fmt(e.amount)} · ${esc(e.date)}</span>
  </div></div>
  ${e.revealed ? '' : `<button class="btn gray" onclick="app.closeSheet();app.revealRandom(${e.id})">🎲 立刻開獎</button><div style="height:10px"></div>`}
  <div class="field"><label>金額 (NT$)</label>${keypadHTML()}</div>
  <div class="exact-sum">名單與結果不會因編輯改變（要重抽請刪除後重記）</div>`;
      setAmtDisplay(e.amount);
    }
  } else {
    const kind = e.kind === 'in' ? 'in' : 'out';
    [...document.querySelectorAll('#kindChips .chip')].forEach(c => {
      c.classList.remove('on', 'green');
      if (c.dataset.k === kind) { c.classList.add('on'); if (kind === 'in') c.classList.add('green'); }
    });
    const pf = document.getElementById('payerField');
    if (pf) pf.style.display = kind === 'in' ? 'block' : 'none';
    const cc = document.getElementById('catChips');
    if (cc) cc.innerHTML = catChipsHTML(kind);
    const sel = document.getElementById('inPayer'); if (sel && e.payer) sel.value = String(e.payer);
    setAmtDisplay(e.amount);
  }
  markCatChip(e.cat);
}

function delExpense(id) {
  const e = proj().expenses.find(x => x.id === id);
  if (!confirm(`確定刪除「${e?.desc || e?.cat || '這筆紀錄'}」（${fmt(e?.amount || 0)}）？`)) return;
  proj().expenses = proj().expenses.filter(x => x.id !== id); save(); toast('已刪除紀錄'); render();
}
function delMember(id) {
  const involved = proj().expenses.some(e => e.payer === id || (e.splitters || []).includes(id)
    || (e.paid && e.paid[id]) || (e.spent && e.spent[id])
    || (e.candidates || []).includes(id) || e.loser === id || (e.losers || []).includes(id));
  if (involved) { toast('此成員已有帳目，無法刪除'); return; }
  const m = memberById(id);
  if (!confirm(`確定刪除成員「${m?.name || '?'}」？`)) return;
  proj().members = proj().members.filter(x => x.id !== id); save(); toast('已刪除成員'); render();
}
// 標記單筆轉帳已付清：記一筆「清償」抵銷（可在記記列表刪除反悔）
function settleTransfer(from, to, amt) {
  const f = memberById(from), b = memberById(to);
  if (!f || !b) return;
  if (!confirm(`確認 ${f.name} 已把 ${fmt(amt)} 付給 ${b.name}？\n（會記一筆清償紀錄，反悔可到記記刪除）`)) return;
  proj().expenses.push({
    id: proj().nextExpenseId++,
    cat: '💸 清償', desc: `${f.name} 付給 ${b.name}`,
    amount: amt, mode: 'exact', settle: true,
    paid: { [from]: amt }, spent: { [to]: amt },
    payer: 0, splitters: [], date: today(),
  });
  save(); toast(`✓ ${f.name} 已結清這筆`); render();
}
function copySettlement() {
  const plan = settlements();
  if (!plan.length) { toast('目前沒有需要轉帳的款項'); return; }
  const lines = [`💸 ${proj().name}｜結算結果`];
  plan.forEach(t => {
    lines.push(`${memberById(t.from)?.name || '?'} → ${memberById(t.to)?.name || '?'}  ${fmt(t.amt)}`);
  });
  lines.push(`（共 ${plan.length} 筆轉帳就能結清）`);
  const text = lines.join('\n');
  const done = () => toast('已複製，貼給大家吧 📋');
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
  } else {
    fallbackCopy(text, done);
  }
}
function fallbackCopy(text, done) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    done();
  } catch (e) { toast('複製失敗，請截圖分享'); }
}
function markSettled() {
  if (!confirm('確定標記全部已結清？所有帳目將被清空，此動作無法復原')) return;
  proj().expenses = []; save(); toast('已全部結清 🎉'); render();
}

/* ---------- 新增 sheet ---------- */
function openSheet(forceFull = false) {
  editingId = null; // 預設為「新增」，openEditSheet 會在之後設回編輯目標
  const type = proj().type;
  const sheet = document.getElementById('sheet'), body = document.getElementById('sheetBody');
  if (currentPage === 'members') {
    document.getElementById('sheetTitle').textContent = '新增成員';
    body.innerHTML = `
  <div class="field"><label>名字</label><input id="inName" placeholder="例如：小美" maxlength="10"></div>
  <button class="btn" onclick="app.addMember()">加入</button>`;
  } else if (type === 'split' && isDuoMode() && forceFull !== true) {
    // 👥 雙人模式：只需選分類、誰先付、金額（自動兩人均分）
    document.getElementById('sheetTitle').textContent = '新增支出';
    const body2 = document.getElementById('sheetBody');
    body2.innerHTML = `
  <div class="field"><label>分類</label><div class="chips" id="catChips">${catChipsHTML('out')}</div></div>
  <div class="field"><label>詳細說明（選填）</label><input id="inDesc" placeholder="例如：鐵板燒"></div>
  <div class="field"><label>日期</label><input id="inDate" type="date" value="${todayISO()}"></div>
  <div class="field"><label>誰先付的？</label><select id="inPayer">${proj().members.map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join('')}</select></div>
  <div class="field"><label>金額 (NT$)＝對方欠的錢</label>${keypadHTML()}</div>
  <button class="btn" id="submitBtn" onclick="app.addExpense()">記一筆</button>`;
    document.getElementById('mask').classList.add('open');
    document.getElementById('sheet').classList.add('open');
    return;
  } else if (type === 'split') {
    if (proj().members.length < 2) { toast('請先新增至少 2 位成員'); switchTab('members'); return; }
    document.getElementById('sheetTitle').textContent = '新增支出';
    body.innerHTML = `
  <div class="field"><label>分類</label><div class="chips" id="catChips">${catChipsHTML('out')}</div></div>
  <div class="field"><label>詳細說明（選填）</label><input id="inDesc" placeholder="例如：鐵板燒"></div>
  <div class="field"><label>日期</label><input id="inDate" type="date" value="${todayISO()}"></div>
  <div class="field"><label>分帳方式</label>
    <div class="chips" id="modeChips">
      <div class="chip on" data-m="exact" onclick="app.selectMode(this)">特定付款</div>
      <div class="chip" data-m="equal" onclick="app.selectMode(this)">均分</div>
      <div class="chip" data-m="random" onclick="app.selectMode(this)">🎲 隨機付款</div>
    </div></div>
  <div id="modeArea">${exactFormHTML()}</div>
  <button class="btn" id="submitBtn" onclick="app.addExpense()">記一筆</button>`;
  } else {
    // fund / personal 紀錄
    const isFund = type === 'fund';
    if (isFund && !proj().members.length) { toast('請先新增成員'); switchTab('members'); return; }
    document.getElementById('sheetTitle').textContent = '新增紀錄';
    body.innerHTML = `
  <div class="field"><label>類型</label>
    <div class="chips" id="kindChips">
      <div class="chip on green" data-k="in" onclick="app.selectKind(this)">${isFund ? '存入' : '收入'}</div>
      <div class="chip" data-k="out" onclick="app.selectKind(this)">支出</div>
    </div></div>
  ${isFund ? `<div class="field" id="payerField"><label>誰存入？</label><select id="inPayer">${proj().members.map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join('')}</select></div>` : ''}
  <div class="field"><label>分類</label><div class="chips" id="catChips">${catChipsHTML('in')}</div></div>
  <div class="field"><label>詳細說明（選填）</label><input id="inDesc" placeholder="例如：鐵板燒、七月月費"></div>
  <div class="field"><label>日期</label><input id="inDate" type="date" value="${todayISO()}"></div>
  <div class="field"><label>金額 (NT$)</label>${keypadHTML()}</div>
  <button class="btn" id="submitBtn" onclick="app.addLedgerRecord()">記一筆</button>`;
  }
  document.getElementById('mask').classList.add('open');
  sheet.classList.add('open');
  // 只有新增成員時自動聚焦輸入框（記帳表單避免跳出系統鍵盤蓋住數字鍵盤）
  if (currentPage === 'members') setTimeout(() => body.querySelector('input')?.focus(), 300);
}

/* ---------- 數字鍵盤 ---------- */
let amtStr = '';
let cellStr = {};      // 特定付款各格金額（key: 'pay_成員id' / 'spend_成員id'）
let activeKey = null;  // 目前輸入中的格子
// 0..n-1 的均勻整數亂數（crypto 等級、以拒絕取樣消除模數偏差）
export function randInt(n) {
  if (n <= 1) return 0;
  const g = (typeof crypto !== 'undefined' && crypto.getRandomValues) ? crypto : null;
  if (!g) return Math.floor(Math.random() * n);
  const limit = Math.floor(4294967296 / n) * n;
  const buf = new Uint32Array(1);
  let x;
  do { g.getRandomValues(buf); x = buf[0]; } while (x >= limit);
  return x % n;
}
// 金額輸入：手機跳原生數字鍵盤（inputmode=decimal）；桌面可直接打算式如 670/3
function keypadHTML(withDisplay = true) {
  amtStr = ''; activeKey = null;
  if (!withDisplay) return '';
  return `<input class="amt-input" id="amtInput" type="text" inputmode="decimal" placeholder="0" autocomplete="off" onkeydown="if(event.key==='Enter')event.target.blur()">`;
}
// 讀取金額欄（相容測試直接操作 amtStr 的路徑）
function amtVal() {
  const el = document.getElementById('amtInput');
  return (el && el.value !== undefined && el.value !== '') ? el.value : amtStr;
}
function cellVal(key) {
  const el = document.getElementById('cell_' + key);
  return (el && el.value !== undefined && el.value !== '') ? el.value : (cellStr[key] || '');
}
function amtText(s) {
  if (!s) return '0';
  const hasOp = /[+\-*/]/.test(s);
  const v = evalAmt(s);
  return dispExpr(s) + (hasOp && !isNaN(v) ? ` ＝ ${Math.round(v)}` : '');
}
function kp(k) {
  if (activeKey) {
    // 特定付款：輸入到選中的格子
    cellStr[activeKey] = editAmt(cellStr[activeKey] || '', k);
    const el = document.getElementById('cell_' + activeKey);
    if (el) {
      el.textContent = amtText(cellStr[activeKey]);
      el.classList.toggle('zero', !cellStr[activeKey]);
    }
    updateExactSum();
  } else {
    amtStr = editAmt(amtStr, k);
    const d = document.getElementById('amtDisplay');
    if (d) { d.textContent = amtText(amtStr); d.classList.toggle('zero', !amtStr); }
  }
}

/* ---------- 分帳方式表單 ---------- */
function exactFormHTML() {
  cellStr = {}; activeKey = null;
  const rows = proj().members.map(m => `
<div class="row exact-row">
  <div class="grow" style="font-weight:600">${esc(m.name)}</div>
  <input class="amt-cell" type="text" inputmode="decimal" placeholder="0" id="cell_pay_${m.id}" oninput="app.updateExactSum()">
  <input class="amt-cell" type="text" inputmode="decimal" placeholder="0" id="cell_spend_${m.id}" oninput="app.updateExactSum()">
</div>`).join('');
  return `
<div class="field"><label>輸入各自的先付與支出</label>
  <div class="card">
    <div class="row exact-row" style="color:var(--text-secondary);font-size:13px;font-weight:600">
      <div class="grow">成員</div><div class="exact-h">先付</div><div class="exact-h">支出</div>
    </div>
    ${rows}
  </div>
  <div class="exact-sum" id="exactSum">先付合計 NT$ 0｜支出合計 NT$ 0</div>
</div>
<div class="field"><label>或：選擇誰要均分支出，一鍵填入</label>
  <div class="chips" id="eqChips">${proj().members.map(m => `<div class="chip on" data-id="${m.id}" onclick="this.classList.toggle('on')">${esc(m.name)}</div>`).join('')}</div>
  <div style="height:8px"></div>
  <button class="btn gray" onclick="app.fillEqualSpend()">⚖️ 把先付合計均分到支出</button>
</div>
`;
}
// 特定分帳：把先付合計均分到選取成員的支出格（整數，餘數由前面的人多攤 1 元）
function fillEqualSpend() {
  const { tp } = exactTotals();
  if (tp <= 0) { toast('請先填先付金額'); return; }
  const sel = [...document.querySelectorAll('#eqChips .chip.on')].map(c => +c.dataset.id);
  if (!sel.length) { toast('至少選一位'); return; }
  proj().members.forEach(m => { cellStr['spend_' + m.id] = ''; });
  const base = Math.floor(tp / sel.length);
  let rem = Math.round(tp - base * sel.length);
  sel.forEach((id, i) => { cellStr['spend_' + id] = String(base + (i < rem ? 1 : 0)); });
  proj().members.forEach(m => {
    const el = document.getElementById('cell_spend_' + m.id);
    if (el) el.value = cellStr['spend_' + m.id] || '';
  });
  updateExactSum();
  toast('已均分支出 ✓');
}
function equalFormHTML() {
  cellStr = {}; activeKey = null;
  return `
<div class="field"><label>金額 (NT$)</label>${keypadHTML()}</div>
<div class="field"><label>誰先付的？</label><select id="inPayer">${proj().members.map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join('')}</select></div>
<div class="field"><label>誰要分攤？（均分）</label>
  <div class="chips" id="chips">${proj().members.map(m => `<div class="chip on" data-id="${m.id}" onclick="this.classList.toggle('on')">${esc(m.name)}</div>`).join('')}</div>
</div>`;
}
function randomFormHTML() {
  cellStr = {}; activeKey = null;
  return `
<div class="field"><label>金額 (NT$)</label>${keypadHTML()}</div>
<div class="field"><label>誰先付的？</label><select id="inPayer">${proj().members.map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join('')}</select></div>
<div class="field"><label>誰參加抽籤？（抽中的人買單）</label>
  <div class="chips" id="candChips">${proj().members.map(m => `<div class="chip on" data-id="${m.id}" onclick="this.classList.toggle('on')">${esc(m.name)}</div>`).join('')}</div>
</div>
<div class="field"><label>抽幾個人一起買單？（均攤）</label>
  <select id="inDrawN">${proj().members.slice(0, Math.max(1, proj().members.length - 1)).map((_, i) => `<option value="${i + 1}">${i + 1} 人</option>`).join('')}</select>
</div>
<div class="field"><label>公布時機</label>
  <div class="chips" id="revealChips">
    <div class="chip on" data-r="now" onclick="app.selectReveal(this)">🎉 立刻公布</div>
    <div class="chip" data-r="later" onclick="app.selectReveal(this)">🕵️ 結帳時公布</div>
  </div></div>`;
}
function selectMode(el) {
  document.querySelectorAll('#modeChips .chip').forEach(c => c.classList.remove('on'));
  el.classList.add('on');
  const m = el.dataset.m;
  document.getElementById('modeArea').innerHTML =
    m === 'exact' ? exactFormHTML() : m === 'random' ? randomFormHTML() : equalFormHTML();
}
function selectReveal(el) {
  document.querySelectorAll('#revealChips .chip').forEach(c => c.classList.remove('on'));
  el.classList.add('on');
}
function revealRandom(id) {
  const e = proj().expenses.find(x => x.id === id);
  if (!e || e.revealed) return;
  e.revealed = true;
  save(); render();
  const ls = losersOf(e);
  const names = ls.map(id => memberById(id)?.name || '?').join('、');
  toast(`🎲 開獎：${names} 買單 ${fmt(e.amount)}${ls.length > 1 ? `（每人 ${fmt(e.amount / ls.length)}）` : ''}！`);
}
function focusCell(key) {
  activeKey = key;
  document.querySelectorAll('.amt-cell').forEach(c => c.classList.remove('active'));
  document.getElementById('cell_' + key)?.classList.add('active');
}
function exactTotals() {
  let tp = 0, ts = 0;
  proj().members.forEach(m => {
    tp += evalAmt(cellVal('pay_' + m.id)) || 0;
    ts += evalAmt(cellVal('spend_' + m.id)) || 0;
  });
  return { tp, ts };
}
function updateExactSum() {
  const el = document.getElementById('exactSum');
  if (!el) return;
  const { tp, ts } = exactTotals();
  el.textContent = `先付合計 ${fmt(tp)}｜支出合計 ${fmt(ts)}`;
  el.className = 'exact-sum ' + (tp > 0 && Math.abs(tp - ts) < 0.01 ? 'ok' : (tp || ts) ? 'bad' : '');
}

/* ---------- 自訂：成員與分類 ---------- */
function openMemberSheet() { openSheet(); }
function openCatSheet(kind, label) {
  document.getElementById('sheetTitle').textContent = `新增${label}`;
  document.getElementById('sheetBody').innerHTML = `
<div class="field"><label>分類名稱（可加 emoji）</label>
  <input id="inCat" placeholder="例如：🍿 宵夜、🐱 寵物" maxlength="12"></div>
<button class="btn" onclick="app.addCat('${kind}')">加入</button>`;
  document.getElementById('mask').classList.add('open');
  document.getElementById('sheet').classList.add('open');
  setTimeout(() => document.getElementById('inCat')?.focus(), 300);
}
function addCat(kind) {
  const name = document.getElementById('inCat').value.trim();
  if (!name) { toast('請輸入分類名稱'); return; }
  if (getCats(kind).includes(name)) { toast('分類已存在'); return; }
  getCats(kind).push(name);
  save(); closeSheet(); toast(`已加入「${name}」`); render();
}
// 編輯既有分類：改名並同步更新用到的帳目
function openCatEditSheet(kind, i) {
  const cats = getCats(kind);
  const cur = cats[i];
  if (cur === undefined) return;
  document.getElementById('sheetTitle').textContent = '✎ 編輯分類';
  document.getElementById('sheetBody').innerHTML = `
<div class="field"><label>分類名稱（改名會同步更新既有帳目）</label>
  <input id="inCatEdit" maxlength="12" value="${esc(cur)}"></div>
<button class="btn" onclick="app.saveCatEdit('${kind}',${i})">儲存</button>`;
  document.getElementById('mask').classList.add('open');
  document.getElementById('sheet').classList.add('open');
}
function saveCatEdit(kind, i) {
  const cats = getCats(kind);
  const cur = cats[i];
  const name = document.getElementById('inCatEdit').value.trim();
  if (!name) { toast('請輸入分類名稱'); return; }
  if (name === cur) { closeSheet(); return; }
  if (cats.includes(name)) { toast('分類已存在'); return; }
  cats[i] = name;
  let touched = 0;
  proj().expenses.forEach(e => { if (e.cat === cur) { e.cat = name; touched++; } });
  save(); closeSheet(); render();
  toast(`已改名「${name}」${touched ? `，更新了 ${touched} 筆帳目` : ''}`);
}
function delCat(kind, i) {
  const cats = getCats(kind);
  if (cats.length <= 1) { toast('至少要保留一個分類'); return; }
  const name = cats[i];
  if (!confirm(`確定刪除分類「${name}」？（既有帳目不受影響）`)) return;
  cats.splice(i, 1);
  save(); toast(`已刪除「${name}」`); render();
}

function selectKind(el) {
  document.querySelectorAll('#kindChips .chip').forEach(c => c.classList.remove('on', 'green'));
  el.classList.add('on');
  if (el.dataset.k === 'in') el.classList.add('green');
  const pf = document.getElementById('payerField');
  if (pf) pf.style.display = el.dataset.k === 'in' ? 'block' : 'none';
  // 依收支切換分類選項
  const cc = document.getElementById('catChips');
  if (cc) cc.innerHTML = catChipsHTML(el.dataset.k);
}
// 表單視窗下滑關閉（在頂端往下滑約 90px 即收合）
function initSheetGestures() {
  const sheet = document.getElementById('sheet');
  if (!sheet || !sheet.addEventListener) return;
  let startY = null, startScroll = 0;
  sheet.addEventListener('touchstart', (e) => {
    startY = e.touches[0].clientY;
    startScroll = sheet.scrollTop;
  }, { passive: true });
  sheet.addEventListener('touchend', (e) => {
    if (startY == null) return;
    const dy = e.changedTouches[0].clientY - startY;
    if (dy > 90 && startScroll <= 0 && sheet.scrollTop <= 0) closeSheet();
    startY = null;
  }, { passive: true });
}
function closeSheet() {
  document.getElementById('mask').classList.remove('open');
  document.getElementById('sheet').classList.remove('open');
  editingId = null;
}
function addMember() {
  const name = document.getElementById('inName').value.trim();
  if (!name) { toast('請輸入名字'); return; }
  if (proj().members.some(m => m.name === name)) { toast('名字重複了'); return; }
  proj().members.push({ id: proj().nextMemberId++, name });
  save(); closeSheet(); toast(`已加入 ${name}`); render();
}
function addExpense() {
  const cat = document.querySelector('#catChips .chip.on')?.dataset.c || '📦 其他';
  const desc = document.getElementById('inDesc').value.trim();
  const editingRec = editingId != null ? proj().expenses.find(x => x.id === editingId) : null;
  const mode = editingRec ? (editingRec.mode || 'equal')
    : (document.querySelector('#modeChips .chip.on')?.dataset.m || 'equal');

  // 👥 雙人模式直記欠帳：金額＝對方欠付款人的錢（不均分）
  const duoNew = isDuoMode() && !editingRec && !document.querySelector('#modeChips .chip.on');
  const duoEdit = !!(editingRec && editingRec.duo);
  if (duoNew || duoEdit) {
    const amt = Math.round(evalAmt(amtVal()));
    const payer = +document.getElementById('inPayer').value;
    const other = proj().members.find(m => m.id !== payer);
    if (!isValidAmount(amt)) { toast('請輸入有效金額'); return; }
    if (!other) { toast('找不到對方成員'); return; }
    commitRecord({
      cat, desc, amount: amt, mode: 'exact', duo: true,
      paid: { [payer]: amt }, spent: { [other.id]: amt },
      payer, splitters: [], date: dateFromInput(),
    });
    return;
  }

  if (mode === 'exact') {
    // 特定付款：逐人先付／支出
    const paid = {}, spent = {};
    let tp = 0, ts = 0; // 以「取整後」的數字驗證與入帳
    proj().members.forEach(m => {
      const p = Math.round(evalAmt(cellVal('pay_' + m.id)) || 0);
      const s = Math.round(evalAmt(cellVal('spend_' + m.id)) || 0);
      if (p > 0) { paid[m.id] = p; tp += p; }
      if (s > 0) { spent[m.id] = s; ts += s; }
    });
    if (tp <= 0) { toast('請輸入先付金額'); return; }
    if (Math.abs(tp - ts) > 0.01) { toast(`先付合計 ${fmt(tp)} ≠ 支出合計 ${fmt(ts)}`); return; }
    commitRecord({ cat, desc, amount: tp, mode: 'exact', paid, spent, payer: 0, splitters: [], date: dateFromInput() });
    return;
  } else if (mode === 'random') {
    // 🎲 隨機抽 N 個人一起買單（均攤）
    const amt = Math.round(evalAmt(amtVal()));
    if (editingRec) {
      // 編輯隨機付款：不重抽，只更新金額/分類/說明/日期
      if (!isValidAmount(amt)) { toast('請輸入有效金額'); return; }
      commitRecord({ cat, desc, amount: amt, date: dateFromInput() });
      return;
    }
    const payer = +document.getElementById('inPayer').value;
    const cands = [...document.querySelectorAll('#candChips .chip.on')].map(c => +c.dataset.id);
    const drawN = +(document.getElementById('inDrawN')?.value || 1);
    const revealNow = document.querySelector('#revealChips .chip.on')?.dataset.r !== 'later';
    if (!isValidAmount(amt)) { toast('請輸入有效金額'); return; }
    if (cands.length < 2) { toast('至少選 2 位參加抽籤'); return; }
    if (drawN >= cands.length) { toast('抽的人數要少於參加人數'); return; }
    // Fisher–Yates 洗牌後取前 N 個（用密碼學等級亂數，避免任何可預測性）
    const pool = [...cands];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = randInt(i + 1);
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const losers = pool.slice(0, drawN);
    proj().expenses.push({ id: proj().nextExpenseId++, cat, desc, amount: amt, mode: 'random', payer, candidates: cands, losers, loser: losers[0], revealed: revealNow, splitters: [], date: dateFromInput() });
    save(); closeSheet(); render();
    const names = losers.map(id => memberById(id)?.name || '?').join('、');
    toast(revealNow ? `🎲 抽中 ${names} 買單！` : '🎲 已抽籤，到結算頁開獎');
    return;
  } else {
    const amt = Math.round(evalAmt(amtVal()));
    const payer = +document.getElementById('inPayer').value;
    let splitters = [...document.querySelectorAll('#chips .chip.on')].map(c => +c.dataset.id);
    if (!splitters.length && isDuoMode()) splitters = proj().members.map(m => m.id); // 👥 雙人模式自動均分
    if (!isValidAmount(amt)) { toast('請輸入有效金額'); return; }
    if (!splitters.length) { toast('至少選一位分攤者'); return; }
    commitRecord({ cat, desc, amount: amt, payer, splitters, date: dateFromInput() });
  }
}
function addLedgerRecord() {
  const isFund = proj().type === 'fund';
  const kind = document.querySelector('#kindChips .chip.on').dataset.k;
  const cat = document.querySelector('#catChips .chip.on')?.dataset.c || '📦 其他';
  const desc = document.getElementById('inDesc').value.trim();
  const amt = Math.round(evalAmt(amtVal()));
  if (!isValidAmount(amt)) { toast('請輸入有效金額'); return; }
  const payer = (isFund && kind === 'in') ? +document.getElementById('inPayer').value : 0;
  commitRecord({ cat, desc, amount: amt, kind, payer, splitters: [], date: dateFromInput() });
}

/* ---------- 專案管理 ---------- */
let newProjType = 'split';
function openProjectSheet() {
  newProjType = 'split';
  const body = document.getElementById('sheetBody');
  document.getElementById('sheetTitle').textContent = '我的專案';
  let html = `<div class="card">`;
  data.projects.forEach(p => {
    const cur = p.id === data.currentProjectId;
    const ti = TYPE_INFO[p.type] || TYPE_INFO.split;
    html += `<div class="row proj-row ${cur ? 'current' : ''}" onclick="app.switchProject(${p.id})" style="cursor:pointer">
  <div class="avatar" style="background:${colorOf(p.id)}">${esc(initials(p.name))}</div>
  <div class="grow">
    <div class="title">${esc(p.name)}<span class="type-tag ${ti.tag}">${ti.name}</span></div>
    <div class="detail">${p.type === 'personal' ? '' : p.members.length + ' 位成員 · '}${p.expenses.length} 筆紀錄${p.cloud ? ' · ☁ ' + p.cloud.code : ''}</div>
  </div>
  ${cur ? '<span class="badge">目前</span>' : ''}
  <button class="del-btn" onclick="event.stopPropagation();app.cloudAction(${p.id})" style="color:${p.cloud ? 'var(--success)' : 'var(--text-secondary)'}">☁</button>
  <button class="del-btn" onclick="event.stopPropagation();app.renameProject(${p.id})" style="color:var(--primary)">✎</button>
  <button class="del-btn" onclick="event.stopPropagation();app.delProject(${p.id})">✕</button>
</div>`;
  });
  html += `</div>
<div class="section-title">新增專案</div>
<div class="field"><label>類型</label>
  <div class="chips" id="typeChips">
    <div class="chip on" data-t="split" onclick="app.selectProjType(this)">多人分帳</div>
    <div class="chip" data-t="fund" onclick="app.selectProjType(this)">共同基金</div>
    <div class="chip" data-t="personal" onclick="app.selectProjType(this)">個人記帳</div>
  </div></div>
<div class="field"><label>名稱</label>
  <input id="inProject" placeholder="例如：日本旅遊、班費、我的帳本" maxlength="20"></div>
<button class="btn" onclick="app.addProject()">＋ 建立專案</button>
<div class="section-title">加入雲端專案</div>
<div class="field">
  <input id="inJoin" placeholder="輸入朋友給的 6 碼分享代碼" maxlength="6" style="text-transform:uppercase"></div>
<button class="btn gray" onclick="app.joinByCode()">☁ 用代碼加入</button>

<div class="exact-sum" style="text-align:center">${cloudOn() ? (authUser ? '☁ 雲端同步已啟用' : '☁ 雲端已設定 — 登入後即可上雲／加入專案') : '尚未設定雲端 — 見部署指南'}</div>`;
  body.innerHTML = html;
  document.getElementById('mask').classList.add('open');
  document.getElementById('sheet').classList.add('open');
}
function selectProjType(el) {
  document.querySelectorAll('#typeChips .chip').forEach(c => c.classList.remove('on'));
  el.classList.add('on');
  newProjType = el.dataset.t;
}
function switchProject(id) {
  data.currentProjectId = id; save(); closeSheet();
  switchTab(currentPage);
  toast(`已切換到「${proj().name}」`);
}
function addProject() {
  const name = document.getElementById('inProject').value.trim();
  if (!name) { toast('請輸入專案名稱'); return; }
  if (data.projects.some(p => p.name === name)) { toast('專案名稱重複了'); return; }
  const p = { id: data.nextProjectId++, name, type: newProjType, members: [], expenses: [], nextMemberId: 1, nextExpenseId: 1, cats: { out: [...CATS.out], in: [...CATS.in] } };
  data.projects.push(p);
  data.currentProjectId = p.id;
  save(); closeSheet();
  if (newProjType === 'personal') { toast(`已建立「${name}」`); switchTab('expenses'); }
  else { toast(`已建立「${name}」`); switchTab('members'); autoAddSelfAsMember(); }
}
function renameProject(id) {
  const p = data.projects.find(x => x.id === id);
  const name = prompt('修改專案名稱', p.name);
  if (!name || !name.trim()) return;
  p.name = name.trim(); save(); openProjectSheet(); render();
}
// ✕＝從我的清單移除（雲端專案＝退出成員，專案本身與其他成員不受影響）
async function delProject(id) {
  if (data.projects.length <= 1) { toast('至少要保留一個專案'); return; }
  const p = data.projects.find(x => x.id === id);
  if (!p) return;
  if (p.cloud) {
    if (!confirm(`確定退出「${p.name}」？\n專案仍在雲端、其他成員不受影響；之後可用代碼 ${p.cloud.code} 重新加入`)) return;
    // 雲端退出成員資格（不退出的話，下次登入同步又會加回來）
    if (cloudOn() && authUser) {
      try {
        const { data: row } = await sb.from('shared_projects').select('id').eq('code', p.cloud.code).single();
        if (row) await sb.from('project_members').delete().eq('project_id', row.id).eq('user_id', authUser.id);
      } catch (e) { /* 離線也照樣本機移除 */ }
    }
  } else {
    if (!confirm(`「${p.name}」只存在這台裝置，移除即永久刪除且無法復原。確定？`)) return;
  }
  data.projects = data.projects.filter(x => x.id !== id);
  if (data.currentProjectId === id) data.currentProjectId = data.projects[0].id;
  save(); openProjectSheet(); render();
  toast(p.cloud ? `已退出「${p.name}」` : '已移除專案');
}

async function uploadProject(id) {
  if (!cloudOn()) { toast('尚未設定雲端（見部署指南）'); return; }
  if (!authUser) { toast('請先登入才能上雲'); openAuthSheet(); return; }
  const p = data.projects.find(x => x.id === id);
  const code = genCode();
  const { data: row, error } = await sb.from('shared_projects')
    .insert({ code, name: p.name, data: projPayload(p) }).select().single();
  if (error) { toast('上傳失敗：' + error.message); return; }
  p.cloud = { code, ts: row.updated_at };
  save(); openProjectSheet();
  prompt('已上雲！把這個分享代碼給朋友：', code);
}
function cloudAction(id) {
  const p = data.projects.find(x => x.id === id);
  if (p.cloud) { prompt('分享代碼（複製給朋友）：', p.cloud.code); return; }
  uploadProject(id);
}
async function joinProject(code) {
  if (!cloudOn()) { toast('尚未設定雲端（見部署指南）'); return; }
  if (!authUser) { toast('請先登入才能加入雲端專案'); openAuthSheet(); return; }
  if (!code) { toast('請輸入分享代碼'); return; }
  const exist = data.projects.find(p => p.cloud && p.cloud.code === code);
  if (exist) {
    data.currentProjectId = exist.id;
    save(); closeSheet(); switchTab('expenses');
    toast(`已切換到「${exist.name}」`); return;
  }
  // 透過後端函式驗證代碼並登記成員（RLS：非成員讀不到專案）
  const { data: rows, error } = await sb.rpc('join_project', { p_code: code });
  const row = rows && rows[0];
  if (error || !row) { toast('加入失敗：' + (error ? error.message : '找不到此代碼')); return; }
  const p = row.data;
  p.id = data.nextProjectId++;
  p.cloud = { code, ts: row.updated_at };
  data.projects.push(p);
  data.currentProjectId = p.id;
  save(); closeSheet(); switchTab('expenses');
  toast(`已加入「${p.name}」`);
  ensureProjNick();
  autoAddSelfAsMember();
}
async function joinByCode() {
  const code = document.getElementById('inJoin').value.trim().toUpperCase();
  await joinProject(code);
}

async function openAdminUsersSheet() {
  if (!isAdmin()) { toast('沒有管理員權限'); return; }
  document.getElementById('sheetTitle').textContent = '🛡️ 帳號管理';
  const body = document.getElementById('sheetBody');
  body.innerHTML = `<div class="empty" style="padding:30px">載入中⋯</div>`;
  document.getElementById('mask').classList.add('open');
  document.getElementById('sheet').classList.add('open');
  const { data: rows, error } = await sb.rpc('admin_list_users');
  if (error) { body.innerHTML = `<div class="empty">載入失敗：${esc(error.message)}<br><small>（請確認已執行 README 第五章的帳號管理 SQL）</small></div>`; return; }
  if (!rows || !rows.length) { body.innerHTML = `<div class="empty"><div class="icon">👤</div><p>還沒有任何帳號</p></div>`; return; }
  let html = `<div class="section-title">共 ${rows.length} 個帳號</div><div class="card">`;
  rows.forEach(u => {
    const me = authUser && u.id === authUser.id;
    const founder = (u.email || '').toLowerCase() === ADMIN_EMAILS[0];
    const day = String(u.created_at || '').slice(0, 10);
    html += `<div class="row">
      <div class="avatar" style="background:${me ? 'var(--primary)' : 'var(--text-secondary)'}">${esc(initials(u.nickname || '?'))}</div>
      <div class="grow">
        <div class="title">${esc(u.nickname)}${u.is_admin ? '<span class="badge admin">admin</span>' : ''}${me ? '<span class="badge" style="margin-left:6px">我</span>' : ''}</div>
        <div class="detail">${esc(u.email)} · ${u.projects} 個專案 · 註冊 ${esc(day)}</div>
      </div>
      ${(me || founder) ? '' : `<button class="del-btn" style="color:${u.is_admin ? 'var(--text-secondary)' : 'var(--warning)'};font-size:13px;font-weight:700" onclick="app.adminToggleAdmin('${esc(u.id)}', ${u.is_admin ? 'false' : 'true'}, '${esc(u.nickname)}')">${u.is_admin ? '移除admin' : '設為admin'}</button>`}
      ${(me || founder) ? '' : `<button class="del-btn" onclick="app.adminDeleteUser('${esc(u.id)}','${esc(u.nickname)}')">✕</button>`}
    </div>`;
  });
  body.innerHTML = html + `</div>`;
}
async function adminToggleAdmin(id, grant, name) {
  const msg = grant
    ? `確定把「${name}」設為管理員？他將能看到所有專案並管理帳號`
    : `確定移除「${name}」的管理員權限？`;
  if (!confirm(msg)) return;
  const { error } = await sb.rpc('admin_set_admin', { p_user: id, p_grant: grant });
  if (error) { toast('操作失敗：' + error.message); return; }
  toast(grant ? `🛡️ ${name} 已成為管理員` : `已移除 ${name} 的管理員權限`);
  refreshAdminFlag();
  openAdminUsersSheet();
}
// 管理員：直接改雲端專案名稱（不需加入）
async function adminRenameProject(code) {
  const { data: row, error } = await sb.from('shared_projects').select('*').eq('code', code).single();
  if (error || !row) { toast('讀取失敗'); return; }
  const name = prompt('修改專案名稱', row.name);
  if (!name || !name.trim() || name.trim() === row.name) return;
  const d = row.data || {};
  d.name = name.trim();
  const { error: e2 } = await sb.from('shared_projects').update({ name: name.trim(), data: d }).eq('code', code);
  if (e2) { toast('更新失敗：' + e2.message); return; }
  const local = data.projects.find(p => p.cloud && p.cloud.code === code);
  if (local) { local.name = name.trim(); save(); render(); }
  toast('已改名 ✓');
  openAdminSheet();
}
// 管理員：從雲端刪除專案（所有成員失去同步；本機副本轉為純本機保留）
async function adminDeleteCloudProject(code, name) {
  if (!confirm(`確定從雲端刪除「${name}」？\n所有成員都會失去同步，此動作無法復原`)) return;
  const { error } = await sb.from('shared_projects').delete().eq('code', code);
  if (error) { toast('刪除失敗：' + error.message); return; }
  const local = data.projects.find(p => p.cloud && p.cloud.code === code);
  if (local) { delete local.cloud; save(); render(); }
  toast(`已從雲端刪除「${name}」`);
  openAdminSheet();
}
async function adminDeleteUser(id, name) {
  if (!confirm(`確定刪除帳號「${name}」？該帳號將無法再登入，其成員資格一併移除（帳目與專案內容保留）`)) return;
  const { error } = await sb.rpc('admin_delete_user', { p_user: id });
  if (error) { toast('刪除失敗：' + error.message); return; }
  toast(`已刪除帳號「${name}」`);
  openAdminUsersSheet();
}
async function openAdminSheet() {
  if (!isAdmin()) { toast('沒有管理員權限'); return; }
  document.getElementById('sheetTitle').textContent = '🛡️ 所有雲端專案';
  const body = document.getElementById('sheetBody');
  body.innerHTML = `<div class="empty" style="padding:30px">載入中⋯</div>`;
  document.getElementById('mask').classList.add('open');
  document.getElementById('sheet').classList.add('open');
  const { data: rows, error } = await sb.from('shared_projects')
    .select('code,name,updated_at,data').order('updated_at', { ascending: false });
  if (error) { body.innerHTML = `<div class="empty">載入失敗：${esc(error.message)}</div>`; return; }
  if (!rows || !rows.length) { body.innerHTML = `<div class="empty"><div class="icon">☁</div><p>雲端上還沒有任何專案</p></div>`; return; }
  let html = `<div class="section-title">共 ${rows.length} 個專案（點一下加入；✎ 改名 ✕ 從雲端刪除）</div><div class="card">`;
  rows.forEach(r => {
    const d = r.data || {};
    const ti = TYPE_INFO[d.type] || TYPE_INFO.split;
    const t = String(r.updated_at || '').replace('T', ' ').slice(5, 16);
    html += `<div class="row" style="cursor:pointer" onclick="app.joinProject('${esc(r.code)}')">
      <div class="avatar" style="background:var(--primary-2)">${esc(initials(r.name || '?'))}</div>
      <div class="grow">
        <div class="title">${esc(r.name)}<span class="type-tag ${ti.tag}">${ti.name}</span></div>
        <div class="detail">☁ ${esc(r.code)} · ${(d.members || []).length} 位成員 · ${(d.expenses || []).length} 筆 · 更新 ${esc(t)}</div>
      </div>
      <button class="del-btn" style="color:var(--primary)" onclick="event.stopPropagation();app.adminRenameProject('${esc(r.code)}')">✎</button>
      <button class="del-btn" onclick="event.stopPropagation();app.adminDeleteCloudProject('${esc(r.code)}','${esc(r.name)}')">✕</button>
    </div>`;
  });
  body.innerHTML = html + `</div>`;
}
function openAuthSheet() {
  if (!cloudOn()) { toast('登入功能需要先設定 Supabase 雲端'); return; }
  const body = document.getElementById('sheetBody');
  if (authUser) {
    document.getElementById('sheetTitle').textContent = '我的帳號';
    const ava = authUser.avatar
      ? `<img class="avatar-img" src="${esc(authUser.avatar)}" alt="">`
      : `<div class="avatar" style="background:var(--primary)">${esc(initials(authUser.nickname))}</div>`;
    body.innerHTML = `
      <div class="card"><div class="row">
        ${ava}
        <div class="grow">
          <div class="title">${esc(authUser.nickname)}${isAdmin() ? '<span class="badge admin">admin</span>' : ''}</div>
          <div class="detail">${esc(authUser.email)}</div></div>
      </div></div>
      <button class="btn gray" onclick="app.openProfileSheet()">✎ 編輯個人資料</button>
      ${isAdmin() ? `
      <div class="section-title">🛡️ 管理員</div>
      <button class="btn gray" onclick="app.openAdminSheet()">檢視所有雲端專案</button>
      <div style="height:10px"></div>
      <button class="btn gray" onclick="app.openAdminUsersSheet()">管理帳號</button>` : ''}
      <div style="height:10px"></div>
      <button class="btn gray" onclick="app.doLogout()">登出</button>`;
  } else {
    document.getElementById('sheetTitle').textContent = '登入／註冊';
    body.innerHTML = `
      <div class="field"><label>Email</label><input id="authEmail" type="email" placeholder="you@example.com"></div>
      <div class="field"><label>密碼（至少 6 碼）</label><input id="authPw" type="password" placeholder="••••••"></div>
      <div class="field"><label>暱稱（註冊時使用，留言會顯示這個名字）</label><input id="authNick" maxlength="8" placeholder="例如：67哥"></div>
      <button class="btn" onclick="app.doLogin()">登入</button>
      <div style="height:10px"></div>
      <button class="btn gray" onclick="app.doSignup()">還沒有帳號？註冊</button>`;
  }
  document.getElementById('mask').classList.add('open');
  document.getElementById('sheet').classList.add('open');
}
async function doLogin() {
  const email = document.getElementById('authEmail').value.trim();
  const pw = document.getElementById('authPw').value;
  if (!email || !pw) { toast('請填 Email 和密碼'); return; }
  const { error } = await sb.auth.signInWithPassword({ email, password: pw });
  if (error) { toast('登入失敗：' + error.message); return; }
  closeSheet(); toast('歡迎回來！');
}
async function doSignup() {
  const email = document.getElementById('authEmail').value.trim();
  const pw = document.getElementById('authPw').value;
  const nickname = document.getElementById('authNick').value.trim();
  if (!email || !pw) { toast('請填 Email 和密碼'); return; }
  if (pw.length < 6) { toast('密碼至少 6 碼'); return; }
  if (!nickname) { toast('請填暱稱'); return; }
  const { data: d, error } = await sb.auth.signUp({ email, password: pw, options: { data: { nickname } } });
  if (error) { toast('註冊失敗：' + error.message); return; }
  if (d && d.user && !d.session) { closeSheet(); toast('請到信箱點確認信後再登入'); return; }
  closeSheet(); toast(`註冊成功，嗨 ${nickname}！`);
}
/* ---------- 成員編輯（名稱＋頭貼） ---------- */
let editingMemberId = null;
let pendingMemberAvatar = null; // dataURL；'REMOVE' 表示要移除
function openMemberEditSheet(id) {
  const m = proj().members.find(x => x.id === id);
  if (!m) return;
  editingMemberId = id;
  pendingMemberAvatar = null;
  document.getElementById('sheetTitle').textContent = '✎ 編輯成員';
  document.getElementById('sheetBody').innerHTML = `
    <div class="field" style="text-align:center">
      <div id="mAvatarPreview" style="display:flex;justify-content:center;margin-bottom:10px">${memberAvatar(m, 'big')}</div>
      <label class="btn gray" style="display:block;margin-bottom:8px">
        📷 更換頭貼
        <input type="file" accept="image/*" style="display:none" onchange="app.pickMemberAvatar(event)">
      </label>
      ${m.avatar ? `<button class="btn gray" onclick="app.clearMemberAvatar()">移除頭貼</button>` : ''}
    </div>
    <div class="field"><label>成員名稱</label>
      <input id="mNick" maxlength="8" value="${esc(m.name)}"></div>
    <button class="btn" onclick="app.saveMemberEdit()">儲存</button>`;
  document.getElementById('mask').classList.add('open');
  document.getElementById('sheet').classList.add('open');
}
function pickMemberAvatar(ev) {
  const file = ev.target.files && ev.target.files[0];
  if (!file) return;
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = 96; c.height = 96;
    const ctx = c.getContext('2d');
    const side = Math.min(img.width, img.height);
    ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 96, 96);
    pendingMemberAvatar = c.toDataURL('image/jpeg', 0.8);
    const pv = document.getElementById('mAvatarPreview');
    if (pv) pv.innerHTML = `<img class="avatar-img big" src="${pendingMemberAvatar}" alt="">`;
    URL.revokeObjectURL(img.src);
  };
  img.src = URL.createObjectURL(file);
}
function clearMemberAvatar() {
  pendingMemberAvatar = 'REMOVE';
  const m = proj().members.find(x => x.id === editingMemberId);
  const pv = document.getElementById('mAvatarPreview');
  if (pv && m) pv.innerHTML = `<div class="avatar big" style="background:${colorOf(m.id)}">${esc(initials(m.name))}</div>`;
}
function saveMemberEdit() {
  const m = proj().members.find(x => x.id === editingMemberId);
  if (!m) return;
  const name = document.getElementById('mNick').value.trim();
  if (!name) { toast('請填成員名稱'); return; }
  if (proj().members.some(x => x.id !== m.id && x.name === name)) { toast('名字重複了'); return; }
  m.name = name;
  if (pendingMemberAvatar === 'REMOVE') m.avatar = '';
  else if (pendingMemberAvatar) m.avatar = pendingMemberAvatar;
  editingMemberId = null;
  save(); closeSheet(); toast('成員資料已更新 ✓'); render();
}

let pendingAvatar = null; // 尚未儲存的新頭貼
function openProfileSheet() {
  if (!authUser) { toast('請先登入'); return; }
  pendingAvatar = null;
  document.getElementById('sheetTitle').textContent = '✎ 編輯個人資料';
  const cur = authUser.avatar
    ? `<img class="avatar-img big" src="${esc(authUser.avatar)}" alt="">`
    : `<div class="avatar big" style="background:var(--primary)">${esc(initials(authUser.nickname))}</div>`;
  document.getElementById('sheetBody').innerHTML = `
    <div class="field" style="text-align:center">
      <div id="avatarPreview" style="display:flex;justify-content:center;margin-bottom:10px">${cur}</div>
      <label class="btn gray" style="display:block">
        📷 更換大頭貼
        <input type="file" accept="image/*" style="display:none" onchange="app.pickAvatar(event)">
      </label>
    </div>
    <div class="field"><label>使用者名稱</label>
      <input id="profNick" maxlength="8" value="${esc(authUser.nickname)}"></div>
    <button class="btn" onclick="app.saveProfile()">儲存</button>`;
  document.getElementById('mask').classList.add('open');
  document.getElementById('sheet').classList.add('open');
}
function pickAvatar(ev) {
  const file = ev.target.files && ev.target.files[0];
  if (!file) return;
  const img = new Image();
  img.onload = () => {
    // 裁成正方形並縮到 96×96，存成小型 JPEG（放在帳號 metadata，不需另開儲存空間）
    const c = document.createElement('canvas');
    c.width = 96; c.height = 96;
    const ctx = c.getContext('2d');
    const side = Math.min(img.width, img.height);
    ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 96, 96);
    pendingAvatar = c.toDataURL('image/jpeg', 0.8);
    const pv = document.getElementById('avatarPreview');
    if (pv) pv.innerHTML = `<img class="avatar-img big" src="${pendingAvatar}" alt="">`;
    URL.revokeObjectURL(img.src);
  };
  img.src = URL.createObjectURL(file);
}
async function saveProfile() {
  const nick = document.getElementById('profNick').value.trim();
  if (!nick) { toast('請填使用者名稱'); return; }
  const meta = { nickname: nick };
  if (pendingAvatar) meta.avatar = pendingAvatar;
  const { data: d, error } = await sb.auth.updateUser({ data: meta });
  if (error) { toast('儲存失敗：' + error.message); return; }
  if (d && d.user) setAuthUser(d.user);
  closeSheet(); toast('個人資料已更新 ✓');
}
async function changeNick() {
  const n = prompt('新的使用者名稱（各專案未另外自訂時的預設名稱）', authUser ? authUser.nickname : '');
  if (!n || !n.trim()) return;
  const { data: d, error } = await sb.auth.updateUser({ data: { nickname: n.trim() } });
  if (error) { toast('修改失敗：' + error.message); return; }
  if (d && d.user) setAuthUser(d.user);
  closeSheet(); toast(`使用者名稱已改為 ${n.trim()}`);
}
async function doLogout() {
  try { await sb.auth.signOut(); } catch (e) { }
  closeSheet(); toast('已登出');
}

/* ---------- 手動重新整理 ---------- */
let refreshing = false;
async function manualRefresh() {
  if (refreshing) return;
  refreshing = true;
  const btn = document.getElementById('refreshBtn');
  if (btn) btn.style.opacity = '.4';
  try {
    if (cloudOn()) {
      await pullAll();
      await syncMyProjects();
      toast('☁ 已重新整理');
    } else {
      toast('已重新整理（未設定雲端）');
    }
    render();
  } finally {
    refreshing = false;
    if (btn) btn.style.opacity = '';
  }
}

export {
  toast, render, openAdminUsersSheet, adminDeleteUser, copySettlement, settleTransfer,
  adminRenameProject, adminDeleteCloudProject, initSheetGestures,
  isDuoMode, openCatEditSheet, saveCatEdit, updateExactSum,
  openProfileSheet, pickAvatar, saveProfile, adminToggleAdmin,
  openMemberEditSheet, pickMemberAvatar, clearMemberAvatar, saveMemberEdit,
  switchTab, selectProjType, selectMode, selectReveal, selectKind, revealRandom, openEditSheet, focusCell, delMember, delExpense, closeSheet, switchProject, selectCat, renameProject, openSheet, openProjectSheet, openMemberSheet, openCatSheet, openAuthSheet, openAdminSheet, markSettled, manualRefresh, kp, joinProject, joinByCode, fillEqualSpend, doSignup, doLogout, doLogin, delProject, delCat, cloudAction, changeNick, addProject, addMember, addLedgerRecord, addExpense, addChat, addCat,
  openDateSheet, renderDateResults,
};
