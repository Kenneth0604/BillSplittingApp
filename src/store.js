// 資料層：狀態、儲存、遷移（無相依）
const COLORS = ['#ff9500', '#34c759', '#5856d6', '#ff2d55', '#af52de', '#00c7be', '#ff3b30', '#007aff'];
const TYPE_INFO = {
  split: { name: '多人分帳', tag: 'type-split' },
  fund: { name: '共同基金', tag: 'type-fund' },
  personal: { name: '個人記帳', tag: 'type-personal' },
};
// 預設分類（必須在 load() 之前宣告，load() 的資料搬移會用到）
const CATS = {
  out: ['🍳 早餐', '🍱 午餐', '🍽️ 晚餐', '🧋 飲料', '🚕 交通', '🎮 娛樂'],
  in: ['💰 薪水', '🎁 獎金', '🏦 存入', '↩️ 退款', '📦 其他'],
};
const CAT_COLORS = ['#ff9500', '#34c759', '#5856d6', '#ff2d55', '#af52de', '#00c7be', '#ff3b30', '#007aff', '#ffcc00', '#8e8e93'];

/* ---------- 資料儲存（localStorage，多專案） ---------- */
function defaultData() {
  return {
    projects: [{
      id: 1, name: '67元快樂研究小組', type: 'split',
      members: [
        { id: 1, name: '阿肥' },
        { id: 2, name: '67哥' },
        { id: 3, name: '胖虎' },
      ],
      cats: { out: [...CATS.out, '🐸 智商稅'], in: [...CATS.in] },
      expenses: [
        // 均分示範
        { id: 1, cat: '🧋 飲料', desc: '請全員喝 67 嵐（大杯全糖去冰）', amount: 670, payer: 1, splitters: [1, 2, 3], date: '7/15' },
        // 自訂分類示範（自己付自己分，純紀念）
        { id: 2, cat: '🐸 智商稅', desc: '會發光的青蛙帽（戴一次就壞）', amount: 67, payer: 2, splitters: [2], date: '7/15' },
        // 特定付款示範：67哥堅持只吃 67 元
        {
          id: 3, cat: '🍽️ 晚餐', desc: '深夜雞排懺悔餐', amount: 667, mode: 'exact',
          paid: { 2: 667 }, spent: { 1: 500, 2: 67, 3: 100 }, payer: 0, splitters: [], date: '7/16'
        },
        // 隨機付款（已開獎）示範
        {
          id: 4, cat: '🎮 娛樂', desc: '夾娃娃機夾到懷疑人生', amount: 676, mode: 'random',
          payer: 3, candidates: [1, 2, 3], loser: 2, revealed: true, splitters: [], date: '7/16'
        },
        // 隨機付款（未開獎）示範：去結算頁按「開獎」
        (() => {
          // 範例的未開獎紀錄：中獎者隨機決定（不能寫死，不然每次示範都同一人）
          const demoLoser = [1, 2, 3][Math.floor(Math.random() * 3)];
          return {
            id: 5, cat: '📦 其他', desc: '神秘的 6767 元支出（不要問）', amount: 6767, mode: 'random',
            payer: 1, candidates: [1, 2, 3], losers: [demoLoser], loser: demoLoser, revealed: false, splitters: [], date: '7/17'
          };
        })(),
      ],
      chats: [
        { name: '阿肥', text: '誰吃了我 500 的雞排？自首從寬', time: '7/16 21:06' },
        { name: '67哥', text: '我只出 67，多一塊都是對我的侮辱', time: '7/16 21:07' },
        { name: '胖虎', text: '那筆 6767 先說好，開獎抽中我就退出小組', time: '7/17 09:41' },
      ],
      nextMemberId: 4, nextExpenseId: 6,
    }],
    currentProjectId: 1, nextProjectId: 2,
  };
}
export let data;
function load() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem('splitapp') || 'null'); } catch (e) { }
  if (d && d.members) {
    // 舊版單一帳本 → 搬移成專案
    d = {
      projects: [{
        id: 1, name: '我的帳本', type: 'split', members: d.members, expenses: d.expenses,
        nextMemberId: d.nextMemberId, nextExpenseId: d.nextExpenseId
      }],
      currentProjectId: 1, nextProjectId: 2,
    };
  }
  data = (d && d.projects && d.projects.length) ? d : defaultData();
  data.projects.forEach(p => {
    if (!p.type) p.type = 'split';
    if (!p.cats) p.cats = { out: [...CATS.out], in: [...CATS.in] };
    if (!p.chats) p.chats = [];
  });
  if (!data.projects.some(p => p.id === data.currentProjectId)) data.currentProjectId = data.projects[0].id;
}
let onSave = null;
export function setOnSave(fn) { onSave = fn; }
function save() {
  try { localStorage.setItem('splitapp', JSON.stringify(data)); } catch (e) { }
  if (onSave) onSave(); // 有設定雲端時，自動同步上雲（由 main.js 接上）
}
function proj() { return data.projects.find(p => p.id === data.currentProjectId); }

function getCats(kind) {
  const p = proj();
  if (!p.cats) p.cats = { out: [...CATS.out], in: [...CATS.in] };
  return p.cats[kind];
}

// 每個專案可以用不同暱稱：優先用「此專案設定過的暱稱」→ 帳號暱稱 → 上次用過的名字
function projKey() { const p = proj(); return p.cloud ? p.cloud.code : 'local_' + p.id; }

export { load, save, proj, getCats, projKey, defaultData, COLORS, TYPE_INFO, CATS, CAT_COLORS };
