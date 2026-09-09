import { useEffect, useState } from 'react'
import { useApp } from '../lib/app.jsx'
import { useSheet } from '../components/Sheet.jsx'
import { Avatar, Card, Empty, IconBtn, Row, SectionTitle, TypeTag } from '../components/ui.jsx'
import { sb, ADMIN_EMAILS, refreshAdminFlag } from '../lib/cloud.js'
import { initials } from '../lib/calc.js'
import { CATS } from '../lib/store.js'
import { autoAddSelfAsMember, ensureProjNick } from '../lib/nick.js'

/** 🛡️ 所有雲端專案(點一下加入;✎ 改名;✕ 從雲端刪除) */
export function AdminProjectsSheet() {
  const { data, act, toast, isAdmin, setPage } = useApp()
  const sheet = useSheet()
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')

  async function load() {
    const { data: r, error: e } = await sb.from('shared_projects').select('code,name,updated_at,data').order('updated_at', { ascending: false })
    if (e) setError(e.message)
    else setRows(r || [])
  }
  useEffect(() => { if (isAdmin) load() }, [isAdmin])

  if (!isAdmin) return <p className="empty">沒有管理員權限</p>
  if (error) return <p className="empty">載入失敗:{error}</p>
  if (!rows) return <p className="empty">載入中…</p>
  if (!rows.length) return <Empty icon="☁">雲端上還沒有任何專案</Empty>

  async function join(code) {
    const exist = data.projects.find((x) => x.cloud && x.cloud.code === code)
    if (exist) { act((d) => { d.currentProjectId = exist.id }); sheet.close(); setPage('expenses'); return toast.info(`已切換到「${exist.name}」`) }
    const { data: rs, error: e } = await sb.rpc('join_project', { p_code: code })
    const row = rs && rs[0]
    if (e || !row) return toast.error('加入失敗:' + (e ? e.message : '找不到此代碼'))
    act((d) => {
      const pr = row.data
      pr.id = d.nextProjectId++
      pr.cloud = { code, ts: row.updated_at }
      if (!pr.cats) pr.cats = { out: [...CATS.out], in: [...CATS.in] }
      if (!pr.chats) pr.chats = []
      d.projects.push(pr)
      d.currentProjectId = pr.id
    })
    sheet.close()
    setPage('expenses')
    toast.success(`已加入「${row.data.name}」`)
    ensureProjNick()
    const msg = autoAddSelfAsMember()
    if (msg) toast.info(msg)
  }

  async function rename(r) {
    const name = prompt('修改專案名稱', r.name)
    if (!name || !name.trim() || name.trim() === r.name) return
    const d = r.data || {}
    d.name = name.trim()
    const { error: e2 } = await sb.from('shared_projects').update({ name: name.trim(), data: d }).eq('code', r.code)
    if (e2) return toast.error('更新失敗:' + e2.message)
    const local = data.projects.find((p) => p.cloud && p.cloud.code === r.code)
    if (local) act(() => { local.name = name.trim() })
    toast.success('已改名 ✓')
    load()
  }

  async function removeCloud(r) {
    if (!confirm(`確定從雲端刪除「${r.name}」?\n所有成員都會失去同步,此動作無法復原`)) return
    const { error: e } = await sb.from('shared_projects').delete().eq('code', r.code)
    if (e) return toast.error('刪除失敗:' + e.message)
    const local = data.projects.find((p) => p.cloud && p.cloud.code === r.code)
    if (local) act(() => { delete local.cloud })
    toast.info(`已從雲端刪除「${r.name}」`)
    load()
  }

  return (
    <div>
      <SectionTitle className="mt-0">共 {rows.length} 個專案(點一下加入;✎ 改名 ✕ 從雲端刪除)</SectionTitle>
      <Card>
        {rows.map((r) => {
          const d = r.data || {}
          const t = String(r.updated_at || '').replace('T', ' ').slice(5, 16)
          return (
            <Row
              key={r.code}
              onClick={() => join(r.code)}
              avatar={<Avatar color="var(--t-accent)" text={initials(r.name || '?')} />}
              title={<>{r.name}<TypeTag type={d.type} /></>}
              detail={`☁ ${r.code} · ${(d.members || []).length} 位成員 · ${(d.expenses || []).length} 筆 · 更新 ${t}`}
              actions={<><IconBtn tone="primary" onClick={() => rename(r)}>✎</IconBtn><IconBtn tone="danger" onClick={() => removeCloud(r)}>✕</IconBtn></>}
            />
          )
        })}
      </Card>
    </div>
  )
}

/** 🛡️ 帳號管理 */
export function AdminUsersSheet() {
  const { authUser, toast, isAdmin } = useApp()
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')

  async function load() {
    const { data: r, error: e } = await sb.rpc('admin_list_users')
    if (e) setError(e.message)
    else setRows(r || [])
  }
  useEffect(() => { if (isAdmin) load() }, [isAdmin])

  if (!isAdmin) return <p className="empty">沒有管理員權限</p>
  if (error) return <p className="empty">載入失敗:{error}<br /><small>(請確認已執行 README 的帳號管理 SQL)</small></p>
  if (!rows) return <p className="empty">載入中…</p>
  if (!rows.length) return <Empty icon="👤">還沒有任何帳號</Empty>

  async function toggleAdmin(u, grant) {
    const msg = grant ? `確定把「${u.nickname}」設為管理員?他將能看到所有專案並管理帳號` : `確定移除「${u.nickname}」的管理員權限?`
    if (!confirm(msg)) return
    const { error: e } = await sb.rpc('admin_set_admin', { p_user: u.id, p_grant: grant })
    if (e) return toast.error('操作失敗:' + e.message)
    toast.success(grant ? `🛡️ ${u.nickname} 已成為管理員` : `已移除 ${u.nickname} 的管理員權限`)
    refreshAdminFlag()
    load()
  }
  async function removeUser(u) {
    if (!confirm(`確定刪除帳號「${u.nickname}」?該帳號將無法再登入,其成員資格一併移除(帳目與專案內容保留)`)) return
    const { error: e } = await sb.rpc('admin_delete_user', { p_user: u.id })
    if (e) return toast.error('刪除失敗:' + e.message)
    toast.info(`已刪除帳號「${u.nickname}」`)
    load()
  }

  return (
    <div>
      <SectionTitle className="mt-0">共 {rows.length} 個帳號</SectionTitle>
      <Card>
        {rows.map((u) => {
          const me = authUser && u.id === authUser.id
          const founder = (u.email || '').toLowerCase() === ADMIN_EMAILS[0]
          const day = String(u.created_at || '').slice(0, 10)
          return (
            <Row
              key={u.id}
              avatar={<Avatar color={me ? 'var(--t-primary)' : 'var(--t-muted)'} text={initials(u.nickname || '?')} />}
              title={
                <>
                  {u.nickname}
                  {u.is_admin && <span className="ml-1.5 rounded-full bg-warning-soft px-2 py-0.5 text-[10px] font-bold text-warning">admin</span>}
                  {me && <span className="ml-1.5 rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-bold text-primary">我</span>}
                </>
              }
              detail={`${u.email} · ${u.projects} 個專案 · 註冊 ${day}`}
              actions={
                !(me || founder) && (
                  <>
                    <button onClick={() => toggleAdmin(u, !u.is_admin)} className={`chip py-1 text-[11px] ${u.is_admin ? 'text-muted' : 'text-warning'}`}>
                      {u.is_admin ? '移除admin' : '設為admin'}
                    </button>
                    <IconBtn tone="danger" onClick={() => removeUser(u)}>✕</IconBtn>
                  </>
                )
              }
            />
          )
        })}
      </Card>
    </div>
  )
}
