// 資料層:狀態、儲存、遷移(無相依、不碰 DOM)
// 與舊版完全相同的 localStorage key(splitapp)與資料結構,既有資料直接沿用。
const COLORS = ['#d99a1b', '#0f9d63', '#6d4aff', '#e5477a', '#a855f7', '#0d9488', '#dc2626', '#2563eb']
const TYPE_INFO = {
  split: { name: '多人分帳', tag: 'type-split' },
  fund: { name: '共同基金', tag: 'type-fund' },
  personal: { name: '個人記帳', tag: 'type-personal' },
}
// 預設分類(必須在 load() 之前宣告,load() 的資料搬移會用到)
const CATS = {
  out: ['🍳 早餐', '🍱 午餐', '🍽️ 晚餐', '🧋 飲料', '🚕 交通', '🎮 娛樂'],
  in: ['💰 薪水', '🎁 獎金', '🏦 存入', '↩️ 退款', '📦 其他'],
}
const CAT_COLORS = ['#d99a1b', '#0f9d63', '#6d4aff', '#e5477a', '#a855f7', '#0d9488', '#dc2626', '#2563eb', '#eab308', '#64748b']

const STORAGE_KEY = 'splitapp'

/* ---------- 資料儲存(localStorage,多專案) ---------- */
function defaultData() {
  const demoLoser = [1, 2, 3][Math.floor(Math.random() * 3)]
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
        { id: 1, cat: '🧋 飲料', desc: '請全員喝 67 嵐(大杯全糖去冰)', amount: 670, payer: 1, splitters: [1, 2, 3], date: '7/15' },
        { id: 2, cat: '🐸 智商稅', desc: '會發光的青蛙帽(戴一次就壞)', amount: 67, payer: 2, splitters: [2], date: '7/15' },
        {
          id: 3, cat: '🍽️ 晚餐', desc: '深夜雞排懺悔餐', amount: 667, mode: 'exact',
          paid: { 2: 667 }, spent: { 1: 500, 2: 67, 3: 100 }, payer: 0, splitters: [], date: '7/16',
        },
        {
          id: 4, cat: '🎮 娛樂', desc: '夾娃娃機夾到懷疑人生', amount: 676, mode: 'random',
          payer: 3, candidates: [1, 2, 3], loser: 2, revealed: true, splitters: [], date: '7/16',
        },
        {
          id: 5, cat: '📦 其他', desc: '神秘的 6767 元支出(不要問)', amount: 6767, mode: 'random',
          payer: 1, candidates: [1, 2, 3], losers: [demoLoser], loser: demoLoser, revealed: false, splitters: [], date: '7/17',
        },
      ],
      chats: [
        { name: '阿肥', text: '誰吃了我 500 的雞排?自首從寬', time: '7/16 21:06' },
        { name: '67哥', text: '我只出 67,多一塊都是對我的侮辱', time: '7/16 21:07' },
        { name: '胖虎', text: '那筆 6767 先說好,開獎抽中我就退出小組', time: '7/17 09:41' },
      ],
      nextMemberId: 4, nextExpenseId: 6,
    }],
    currentProjectId: 1, nextProjectId: 2,
  }
}

export let data

function isValidStoreData(d) {
  if (!d || !Array.isArray(d.projects) || !d.projects.length) return false
  return d.projects.every((p) => p && typeof p === 'object' && Array.isArray(p.members) && Array.isArray(p.expenses))
}

/** 載入本機資料;回傳 true 表示偵測到損毀並已重置 */
function load() {
  let raw = null
  let corrupted = false
  try { raw = localStorage.getItem(STORAGE_KEY) } catch { raw = null }
  let d = null
  if (raw != null) {
    try { d = JSON.parse(raw) } catch { corrupted = true; d = null }
  }
  if (d && d.members) {
    // 舊版單一帳本 → 搬移成專案
    if (!Array.isArray(d.members) || !Array.isArray(d.expenses)) {
      corrupted = true; d = null
    } else {
      d = {
        projects: [{
          id: 1, name: '我的帳本', type: 'split', members: d.members, expenses: d.expenses,
          nextMemberId: d.nextMemberId, nextExpenseId: d.nextExpenseId,
        }],
        currentProjectId: 1, nextProjectId: 2,
      }
    }
  }
  if (raw != null && d && !isValidStoreData(d)) { corrupted = true; d = null }
  data = d && isValidStoreData(d) ? d : defaultData()
  data.projects.forEach((p) => {
    if (!p.type) p.type = 'split'
    if (!p.cats) p.cats = { out: [...CATS.out], in: [...CATS.in] }
    if (!p.chats) p.chats = []
  })
  if (!data.projects.length) data = defaultData()
  if (!data.projects.some((p) => p.id === data.currentProjectId)) data.currentProjectId = data.projects[0].id
  return corrupted
}

/* ---------- 儲存與訂閱 ---------- */
let onSave = null
let onSaveError = null
const listeners = new Set()
export function setOnSave(fn) { onSave = fn }
export function setOnSaveError(fn) { onSaveError = fn }
/** React 層訂閱資料變動(save() 或 notify() 時觸發) */
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) }
export function notify() { listeners.forEach((fn) => fn()) }

/** 寫回 localStorage 並通知訂閱者;失敗回 false */
function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (e) {
    if (onSaveError) onSaveError(e)
    notify()
    return false
  }
  if (onSave) onSave() // 有設定雲端時,自動同步上雲(由 main 接上)
  notify()
  return true
}
/** 只寫 localStorage、不觸發上雲(雲端拉回資料時使用) */
function persistQuiet() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) } catch { /* ignore */ }
}

function proj() { return data.projects.find((p) => p.id === data.currentProjectId) }

function getCats(kind) {
  const p = proj()
  if (!p.cats) p.cats = { out: [...CATS.out], in: [...CATS.in] }
  return p.cats[kind]
}

// 每個專案可以用不同暱稱:key 以雲端代碼或本機 id 區分
function projKey() { const p = proj(); return p.cloud ? p.cloud.code : 'local_' + p.id }

export { load, save, persistQuiet, proj, getCats, projKey, defaultData, COLORS, TYPE_INFO, CATS, CAT_COLORS, STORAGE_KEY }
