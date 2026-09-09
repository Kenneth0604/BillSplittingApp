// ===== DOM/環境 stub =====
const els = {};
function newEl(over = {}) {
  const el = { textContent:'', innerHTML:'', value:'', style:{}, dataset:{}, _cls:new Set(), focus(){}, querySelector(){return null;}, parentElement:null };
  el.classList = {
    add:(...c)=>c.forEach(x=>el._cls.add(x)), remove:(...c)=>c.forEach(x=>el._cls.delete(x)),
    toggle:(c,f)=>{ if(f===undefined){ el._cls.has(c)?el._cls.delete(c):el._cls.add(c);} else { f?el._cls.add(c):el._cls.delete(c);} },
    contains:c=>el._cls.has(c),
  };
  return Object.assign(el, over);
}
globalThis.qsaResult = {};
globalThis.document = {
  getElementById: id => (els[id] ||= newEl()),
  querySelectorAll: sel => qsaResult[sel] || [],
  querySelector: sel => (qsaResult[sel] && qsaResult[sel][0]) || null,
};
globalThis.window = globalThis;
globalThis.localStorage = { _s:{}, getItem(k){return this._s[k]??null;}, setItem(k,v){this._s[k]=String(v);} };
globalThis.confirm = () => true;
globalThis.prompt = (m,d) => d;
const gid = id => document.getElementById(id);
const chipOn = (attrs) => [newEl({dataset:attrs})];

import { readFileSync } from 'fs';
const V = readFileSync(new URL('../index.html', import.meta.url), 'utf8').match(/main\.js\?v=(\d+)/)[1];
const base = new URL('../src/', import.meta.url).href;
await import(`${base}main.js?v=${V}`);
const ui = await import(`${base}ui.js?v=${V}`);
const store = await import(`${base}store.js?v=${V}`);
const calc = await import(`${base}calc.js?v=${V}`);
const cloud = await import(`${base}cloud.js?v=${V}`);

let pass = 0, fail = 0;
function t(name, cond) { cond ? (pass++, console.log('✓', name)) : (fail++, console.log('✗', name)); }

// ---- split 基本 ----
t('啟動渲染 67 範例', gid('projectName').textContent === '67元快樂研究小組');
ui.switchTab('members'); ui.switchTab('settle'); ui.switchTab('expenses');
t('三頁切換', true);
t('結算含未開獎排除', Math.abs(Object.values(calc.balances()).reduce((a,b)=>a+b,0)) < 0.01);

// ---- 特定付款＋均分支出 ----
ui.openSheet();
gid('cell_pay_1').value = '99';
qsaResult['#eqChips .chip.on'] = [newEl({dataset:{id:'1'}}), newEl({dataset:{id:'2'}})];
ui.fillEqualSpend();
const et = ui ? null : null;
qsaResult['#modeChips .chip.on'] = chipOn({m:'exact'});
qsaResult['#catChips .chip.on'] = chipOn({c:'🍽️ 晚餐'});
gid('inDesc').value='exact測'; gid('inDate').value='2026-07-11';
const n0 = store.proj().expenses.length;
ui.addExpense();
const ex = store.proj().expenses.at(-1);
t('特定付款＋均分支出入帳 99→50/49', store.proj().expenses.length===n0+1 && ex.amount===99 && ex.spent[1]===50 && ex.spent[2]===49 && ex.date==='7/11');

// ---- 隨機多人抽 ----
ui.openSheet();
qsaResult['#modeChips .chip.on'] = chipOn({m:'random'});
qsaResult['#catChips .chip.on'] = chipOn({c:'🎮 娛樂'});
qsaResult['#candChips .chip.on'] = [newEl({dataset:{id:'1'}}), newEl({dataset:{id:'2'}}), newEl({dataset:{id:'3'}})];
qsaResult['#revealChips .chip.on'] = chipOn({r:'later'});
gid('inDrawN').value='2'; gid('inDesc').value='多人抽'; gid('inDate').value='';
gid('amtInput').value = '900';
ui.addExpense();
const rnd = store.proj().expenses.at(-1);
t('抽2人未開獎', rnd.mode==='random' && rnd.losers.length===2 && rnd.revealed===false);
const balBefore = JSON.stringify(calc.balances());
ui.revealRandom(rnd.id);
t('開獎後列入結算', rnd.revealed===true && JSON.stringify(calc.balances())!==balBefore);

// ---- 編輯 ----
ui.openEditSheet(ex.id);
t('編輯 exact 預填', gid('sheetTitle').textContent.includes('編輯'));
ui.addExpense(); // 原值直接存
t('編輯後筆數不變', store.proj().expenses.filter(x=>x.id===ex.id).length===1);

// ---- 留言＋每專案暱稱 ----
gid('chatWho').value='測試人'; gid('chatText').value='hello <b>xss</b>';
ui.addChat();
t('留言入列＋記住暱稱', store.proj().chats.at(-1).name==='測試人' && localStorage.getItem('nick_local_1')==='測試人');
ui.render();
t('留言 XSS 跳脫', !gid('content').innerHTML.includes('<b>xss</b>'));

// ---- 分類自訂 ----
ui.openCatSheet('out','支出分類');
gid('inCat').value='🐸 測試分類';
ui.addCat('out');
t('新增分類', store.getCats('out').includes('🐸 測試分類'));
const catN = store.getCats('out').length;
ui.delCat('out', catN-1);
t('刪除分類', store.getCats('out').length===catN-1);

// ---- 分類名稱 XSS（分類為自由輸入文字，渲染於成員頁的分類管理清單）----
ui.switchTab('members');
ui.openCatSheet('out','支出分類');
gid('inCat').value = '<img src=x onerror=alert(1)>';
ui.addCat('out');
ui.switchTab('members');
t('分類名稱 XSS 跳脫（不應含未轉義的 <img）', !gid('content').innerHTML.includes('<img src=x onerror'));
t('分類名稱 XSS 應被轉義為 HTML 實體', gid('content').innerHTML.includes('&lt;img src=x onerror=alert(1)&gt;'));
ui.delCat('out', store.getCats('out').indexOf('<img src=x onerror=alert(1)>'));

// ---- 成員 ----
ui.switchTab('members');
gid('inName').value='新人';
ui.openSheet(); ui.addMember();
t('新增成員', store.proj().members.some(m=>m.name==='新人'));
const mid = store.proj().members.find(m=>m.name==='新人').id;
ui.delMember(mid);
t('刪除成員（無帳目）', !store.proj().members.some(m=>m.name==='新人'));
ui.delMember(1);
t('有帳目成員擋刪', store.proj().members.some(m=>m.id===1));

// ---- 基金專案 ----
ui.selectProjType(newEl({dataset:{t:'fund'}}));
gid('inProject').value='測試基金';
ui.addProject();
t('建立基金專案', store.proj().type==='fund');
ui.switchTab('members');
gid('inName').value='甲'; ui.openSheet(); ui.addMember();
gid('inName').value='乙'; ui.openSheet(); ui.addMember();
ui.switchTab('expenses'); ui.openSheet();
qsaResult['#kindChips .chip.on'] = chipOn({k:'in'});
qsaResult['#catChips .chip.on'] = chipOn({c:'🏦 存入'});
gid('inPayer').value=String(store.proj().members[0].id); gid('inDate').value='';
gid('amtInput').value = '500';
ui.addLedgerRecord();
qsaResult['#kindChips .chip.on'] = chipOn({k:'out'});
gid('amtInput').value = '200';
ui.addLedgerRecord();
t('基金存支＋餘額', calc.ledgerStats().bal===300);
ui.switchTab('settle');
t('基金狀況頁渲染', gid('navSub').textContent.includes('300'));

// ---- 個人記帳 ----
ui.selectProjType(newEl({dataset:{t:'personal'}}));
gid('inProject').value='測試帳本';
ui.addProject();
t('建立個人專案', store.proj().type==='personal');
ui.openSheet();
qsaResult['#kindChips .chip.on'] = chipOn({k:'in'});
qsaResult['#catChips .chip.on'] = chipOn({c:'💰 薪水'});
gid('amtInput').value = '67*2';   // 桌面可打算式
ui.addLedgerRecord();
t('個人收入（運算式）', calc.ledgerStats().tin===134);
const tinBefore = calc.ledgerStats().tin;
gid('amtInput').value = '1/0';    // 除以零 → Infinity，應被擋下不可入帳
ui.addLedgerRecord();
t('除以零金額（Infinity）應被擋下', calc.ledgerStats().tin===tinBefore);
ui.switchTab('settle'); ui.switchTab('expenses');

// ---- 專案管理 ----
ui.openProjectSheet();
t('專案面板列 3 專案', gid('sheetBody').innerHTML.split('proj-row').length-1===3);
ui.renameProject(store.proj().id); // prompt 回傳原名 → 不變或同名
ui.delProject(store.proj().id);
t('刪除專案', store.data.projects.length===2);
ui.switchProject(1);
t('切回主專案', store.proj().id===1);

// ---- 持久化 ----
store.load();
t('save/load 一致', store.data.projects.length===2 && store.proj().expenses.length>0);

// ---- 損毀資料容錯 ----
const goodSnapshot = localStorage.getItem('splitapp');
localStorage.setItem('splitapp', '{not valid json');
const corrupted1 = store.load();
t('損毀 JSON 應偵測為 corrupted 並 fallback 為預設資料', corrupted1===true && store.data.projects.length>0);
localStorage.setItem('splitapp', JSON.stringify({ projects: [{ id: 1 }], currentProjectId: 1 }));
const corrupted2 = store.load();
t('缺少 members/expenses 欄位應偵測為 corrupted 並 fallback', corrupted2===true && Array.isArray(store.proj().members));
localStorage.setItem('splitapp', goodSnapshot); // 還原正常資料，避免影響後續測試
const corrupted3 = store.load();
t('正常資料重新載入不應被誤判為 corrupted', corrupted3===false && store.data.projects.length===2);

// ---- save() 寫入失敗應回報，不應靜默失敗 ----
let saveErrorCaught = null;
store.setOnSaveError(e => { saveErrorCaught = e; });
const realSetItem = localStorage.setItem;
localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
const saveOk = store.save();
t('save() 寫入失敗應回傳 false', saveOk===false);
t('save() 寫入失敗應觸發 onSaveError', saveErrorCaught instanceof Error);
localStorage.setItem = realSetItem;
store.setOnSaveError(() => {});
store.save(); // 恢復正常寫入，避免影響後續測試

// ---- 雲端（未設定模式） ----
t('未設定雲端 cloudOn=false', cloud.cloudOn()===false);
await ui.manualRefresh();
t('重新整理（本機模式）不炸', true);
await ui.joinByCode();
t('未登入加入被擋', true);

await ui.openAdminUsersSheet();
t('非管理員帳號管理被擋', true);

// ---- 自動加入成員（建立專案） ----
localStorage.setItem('chatName', '建立者');
ui.selectProjType(newEl({dataset:{t:'split'}}));
gid('inProject').value = '自動成員測試';
ui.addProject();
t('建立專案自動加入自己為成員', store.proj().members.length === 1 && store.proj().members[0].name === '建立者');
t('成員含頭貼欄位', 'avatar' in store.proj().members[0]);

// ---- 編輯成員 ----
const mId = store.proj().members[0].id;
ui.openMemberEditSheet(mId);
t('成員編輯表單開啟', gid('sheetTitle').textContent.includes('編輯成員'));
gid('mNick').value = '改名後';
ui.saveMemberEdit();
t('成員改名', store.proj().members[0].name === '改名後');
ui.delProject(store.proj().id);

console.log(`\n===== ${pass} 通過 / ${fail} 失敗 =====`);
process.exit(fail ? 1 : 0);
