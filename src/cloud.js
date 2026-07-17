// 雲端層：Supabase 連線、同步、身分（依賴 store；UI 透過 hooks 注入）
import { data, proj } from './store.js';

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


async function pushProject(p) {
  if (!cloudOn() || !p.cloud) return;
  const { data: row, error } = await sb.from('shared_projects')
    .update({ name: p.name, data: projPayload(p) })
    .eq('code', p.cloud.code).select().single();
  if (!error && row) p.cloud.ts = row.updated_at;
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
  return !!(authUser && ADMIN_EMAILS.includes((authUser.email || '').toLowerCase()));
}

let pulling = false;
async function pullAll() {
  if (!cloudOn() || pulling) return;
  pulling = true;
  try {
    for (const p of data.projects.filter(x => x.cloud)) {
      const { data: row } = await sb.from('shared_projects').select('*').eq('code', p.cloud.code).single();
      if (row && row.updated_at !== p.cloud.ts) {
        const keepId = p.id;
        Object.assign(p, row.data, { id: keepId, cloud: { code: p.cloud.code, ts: row.updated_at } });
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
  } : null;
  const el = document.getElementById('userPill');
  if (el) el.textContent = authUser ? `👤 ${authUser.nickname}` : '👤 登入';
  hooks.render();
  if (authUser) syncMyProjects(); // 登入後自動抓回我是成員的所有專案
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

export { cloudOn, genCode, projPayload, pushProject, schedulePush, pullAll, isAdmin, ADMIN_EMAILS, setAuthUser, syncMyProjects, initAuth };
