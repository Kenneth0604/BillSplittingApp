// 雲端層:Supabase 連線、同步、身分(依賴 store;UI 透過 hooks 注入)
// 資料表與 RPC 與舊版完全相同:shared_projects / project_members / admins、join_project、is_admin、admin_*
import { createClient } from '@supabase/supabase-js'
import { data, proj, persistQuiet } from './store.js'

// UI 掛勾(由 React 層接上,避免循環相依)
export const hooks = {
  toast: () => {},
  render: () => {},      // 資料被雲端更新後要求重繪
  onAuth: () => {},      // 登入狀態改變
  onAdmin: () => {},     // 管理員旗標改變
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://bklyaejmluevxqufbkma.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_2ykyBPqmtCcY0hj8yxIySw_VFVhglh_'

export let sb = null
try {
  if (SUPABASE_URL && SUPABASE_KEY) {
    sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'billsplit-auth' },
    })
  }
} catch (e) { sb = null; console.error('[cloud] Supabase 初始化失敗:', e) }
const cloudOn = () => !!sb

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}
// 上傳時去掉本機專屬欄位(cloud 狀態不進雲端)
function projPayload(p) { const { cloud, ...rest } = p; return rest }

const lastPushed = {} // code -> 上次成功推送的 JSON(相同就略過)
async function pushProject(p) {
  if (!cloudOn() || !p.cloud) return
  const payload = projPayload(p)
  const body = JSON.stringify(payload)
  if (lastPushed[p.cloud.code] === body) return
  const { data: row, error } = await sb.from('shared_projects')
    .update({ name: p.name, data: payload })
    .eq('code', p.cloud.code).select().single()
  if (error) { hooks.toast('☁ 同步失敗,稍後會自動重試'); return }
  if (row) { p.cloud.ts = row.updated_at; lastPushed[p.cloud.code] = body }
}
let pushTimer = null
function schedulePush() {
  if (!cloudOn()) return
  clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    data.projects.filter((p) => p.cloud).forEach((p) => pushProject(p))
  }, 800)
}

/* ---------- 管理員 ---------- */
const ADMIN_EMAILS = ['piuuuuu20069564@gmail.com']
export let adminFlag = false
function isAdmin() {
  if (!authUser) return false
  return adminFlag || ADMIN_EMAILS.includes((authUser.email || '').toLowerCase())
}

let pulling = false
async function pullAll() {
  if (!cloudOn() || pulling) return
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
  pulling = true
  try {
    for (const p of data.projects.filter((x) => x.cloud)) {
      const { data: meta } = await sb.from('shared_projects').select('updated_at').eq('code', p.cloud.code).single()
      if (!meta || meta.updated_at === p.cloud.ts) continue
      const { data: row } = await sb.from('shared_projects').select('*').eq('code', p.cloud.code).single()
      if (row && row.updated_at !== p.cloud.ts) {
        const keepId = p.id
        Object.assign(p, row.data, { id: keepId, cloud: { code: p.cloud.code, ts: row.updated_at } })
        lastPushed[p.cloud.code] = JSON.stringify(projPayload(p))
        persistQuiet()
        hooks.render()
        if (proj().id === keepId) hooks.toast('☁ 已同步最新資料')
      }
    }
  } finally { pulling = false }
}

/* ---------- 帳號系統(Supabase Auth,Email + 密碼) ---------- */
export let authUser = null // { id, email, nickname, avatar }
function setAuthUser(u) {
  authUser = u ? {
    id: u.id, email: u.email,
    nickname: (u.user_metadata && u.user_metadata.nickname) || (u.email || '').split('@')[0],
    avatar: (u.user_metadata && u.user_metadata.avatar) || '',
  } : null
  hooks.onAuth(authUser)
  if (authUser) { refreshAdminFlag(); syncMyProjects() }
  else { adminFlag = false; hooks.onAdmin(false) }
}
async function refreshAdminFlag() {
  if (!cloudOn() || !authUser) { adminFlag = false; hooks.onAdmin(false); return }
  try {
    const { data: flag } = await sb.rpc('is_admin')
    adminFlag = !!flag
  } catch (e) { adminFlag = false; console.error('[cloud] refreshAdminFlag 失敗:', e) }
  hooks.onAdmin(isAdmin())
}
// 把帳號在雲端的所有專案抓回本機清單(換裝置登入也看得到)
let syncingMine = false
async function syncMyProjects() {
  if (!cloudOn() || !authUser || syncingMine) return
  syncingMine = true
  try {
    const { data: mems } = await sb.from('project_members').select('project_id').eq('user_id', authUser.id)
    if (!mems || !mems.length) return
    const ids = mems.map((m) => m.project_id)
    const { data: rows } = await sb.from('shared_projects').select('*').in('id', ids)
    let added = 0
    ;(rows || []).forEach((row) => {
      if (!data.projects.some((p) => p.cloud && p.cloud.code === row.code)) {
        const p = row.data
        p.id = data.nextProjectId++
        p.cloud = { code: row.code, ts: row.updated_at }
        if (!p.cats) p.cats = { out: [], in: [] }
        if (!p.chats) p.chats = []
        data.projects.push(p)
        added++
      }
    })
    if (added) {
      persistQuiet()
      hooks.render()
      hooks.toast(`☁ 已同步 ${added} 個專案`)
    }
  } finally { syncingMine = false }
}
async function initAuth() {
  if (!cloudOn()) return
  try {
    const { data: { session } } = await sb.auth.getSession()
    setAuthUser(session && session.user)
    sb.auth.onAuthStateChange((_e, s) => setAuthUser(s && s.user))
  } catch (e) { console.error('[cloud] initAuth 失敗:', e) }
}

export {
  cloudOn, genCode, projPayload, pushProject, schedulePush, pullAll,
  isAdmin, ADMIN_EMAILS, setAuthUser, syncMyProjects, initAuth, refreshAdminFlag,
}
