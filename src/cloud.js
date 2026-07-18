// 雲端層：Supabase 連線、同步、身分（依賴 store；UI 透過 hooks 注入）
import { data, proj } from './store.js?v=9';

// UI 掛勾（main.js 接上 toast/render，避免循環相依）
export const hooks = { toast: () => { }, render: () => { } };

/* ==================== 雲端同步（Supabase） ====================
   使用方式：到 supabase.com 建立免費專案後，把下面兩行填上
   你的 Project URL 與 Publishable key（詳見部署指南）。
   留空 = 純本機模式，app 一樣可以正常使用。            */
const SUPABASE_URL = 'https://bklyaejmluevxqufbkma.supabase.co';   // 例如 'https://abcdefgh.supabase.co'
const SUPABASE_KEY = 'sb_publishable_2ykyBPqmtCcY0hj8yxIySw_VFVhglh_';   // Publishable key（sb_publishable_...）或舊版 anon key

export let sb = null;
try {
  if (SUPABASE_URL && SUPABASE_KEY && window.supabase) {
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  }
} catch (e) { sb = null; }
const cloudOn = () => !!sb;

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
// 上傳時去掉本機專屬欄位（cloud 狀態不進雲端）
function projPayload(p) { const { cloud, ...rest } = p; return rest; }


const lastPushed = {}; // code -> last successfully pushed JSON (skip identical pushes)
async function pushProject(p) {
  if (!cloudOn() || !p.cloud) return;
  const payload = projPayload(p);
  const body = JSON.stringify(payload);
  if (lastPushed[p.cloud.code] === body) return; // unchanged since last push, skip
  const { data: row, error } = await sb.from('shared_projects')
    .update({ name: p.name, data: payload })
    .eq('code', p.cloud.code).select().single();
  if (error) { hooks.toast('☁ 同步失敗，稍後會自動重試'); return; }
  if (row) { p.cloud.ts = row.updated_at; lastPushed[p.cloud.code] = body; }
}
let pushTimer = null;
function schedulePush() {
  if (!cloudOn()) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    data.projects.filter(p => p.cloud).forEach(p => pushProject(p));
  }, 800);
}

/* ---------- 管理員 ---------- */
const ADMIN_EMAILS = ['piuuuuu20069564@gmail.com'];
function isAdmin() {
  if (!authUser) return false;
  return adminFlag || ADMIN_EMAILS.includes((authUser.email || '').toLowerCase());
}

let pulling = false;
async function pullAll() {
  if (!cloudOn() || pulling) return;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return; // skip polling in background tabs
  pulling = true;
  try {
    for (const p of data.projects.filter(x => x.cloud)) {
      // Lightweight check first (tens of bytes); fetch full payload only when changed
      const { data: meta } = await sb.from('shared_projects').select('updated_at').eq('code', p.cloud.code).single();
      if (!meta || meta.updated_at === p.cloud.ts) continue;
      const { data: row } = await sb.from('shared_projects').select('*').eq('code', p.cloud.code).single();
      if (row && row.updated_at !== p.cloud.ts) {
        const keepId = p.id;
        Object.assign(p, row.data, { id: keepId, cloud: { code: p.cloud.code, ts: row.updated_at } });
        lastPushed[p.cloud.code] = JSON.stringify(projPayload(p)); // avoid echoing pulled data back
        try { localStorage.setItem('splitapp', JSON.stringify(data)); } catch (e) { }
        if (proj().id === keepId) { hooks.render(); hooks.toast('☁ 已同步最新資料'); }
      }
    }
  } finally { pulling = false; }
}

/* ---------- 帳號系統（Supabase Auth，Email＋密碼） ---------- */
export let authUser = null; // { id, email, nickname }
function setAuthUser(u) {
  authUser = u ? {
    id: u.id, email: u.email,
    nickname: (u.user_metadata && u.user_metadata.nickname) || (u.email || '').split('@')[0],
    avatar: (u.user_metadata && u.user_metadata.avatar) || '',
  } : null;
  updateUserPill();
  hooks.render();
  if (authUser) { refreshAdminFlag(); syncMyProjects(); } // 登入後：確認管理員身分＋抓回專案
  else { adminFlag = false; }
}
function updateUserPill() {
  const el = document.getElementById('userPill');
  if (!el) return;
  if (!authUser) { el.textContent = '👤 登入'; return; }
  const nickEsc = String(authUser.nickname).replace(/</g, '&lt;');
  const ava = authUser.avatar
    ? `<img class="pill-avatar" src="${authUser.avatar}" alt="">`
    : '👤';
  el.innerHTML = `${ava} ${nickEsc}${isAdmin() ? ' 🛡️' : ''}`;
}
// 管理員身分以資料庫為準（is_admin RPC），前端只拿來決定按鈕顯示
export let adminFlag = false;
async function refreshAdminFlag() {
  if (!cloudOn() || !authUser) { adminFlag = false; return; }
  try {
    const { data: flag } = await sb.rpc('is_admin');
    adminFlag = !!flag;
  } catch (e) { adminFlag = false; }
  updateUserPill();
  hooks.render();
}
// 把帳號在雲端的所有專案抓回本機清單（換裝置登入也看得到）
let syncingMine = false;
async function syncMyProjects() {
  if (!cloudOn() || !authUser || syncingMine) return;
  syncingMine = true;
  try {
    const { data: mems } = await sb.from('project_members')
      .select('project_id').eq('user_id', authUser.id);
    if (!mems || !mems.length) return;
    const ids = mems.map(m => m.project_id);
    const { data: rows } = await sb.from('shared_projects').select('*').in('id', ids);
    let added = 0;
    (rows || []).forEach(row => {
      if (!data.projects.some(p => p.cloud && p.cloud.code === row.code)) {
        const p = row.data;
        p.id = data.nextProjectId++;
        p.cloud = { code: row.code, ts: row.updated_at };
        data.projects.push(p);
        added++;
      }
    });
    if (added) {
      try { localStorage.setItem('splitapp', JSON.stringify(data)); } catch (e) { }
      hooks.render();
      hooks.toast(`☁ 已同步 ${added} 個專案`);
    }
  } finally { syncingMine = false; }
}
async function initAuth() {
  try {
    const { data: { session } } = await sb.auth.getSession();
    setAuthUser(session && session.user);
    sb.auth.onAuthStateChange((_e, s) => setAuthUser(s && s.user));
  } catch (e) { }
}

export { cloudOn, genCode, projPayload, pushProject, schedulePush, pullAll, isAdmin, ADMIN_EMAILS, setAuthUser, syncMyProjects, initAuth, refreshAdminFlag, updateUserPill };
