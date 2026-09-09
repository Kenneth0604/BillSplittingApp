import { useState } from 'react'
import { useApp } from '../lib/app.jsx'
import { useSheet } from '../components/Sheet.jsx'
import { Avatar, Card, Chips, Field, IconBtn, Row, SectionTitle, TypeTag } from '../components/ui.jsx'
import { CATS } from '../lib/store.js'
import { colorOf, initials } from '../lib/calc.js'
import { sb, cloudOn, authUser, genCode, projPayload } from '../lib/cloud.js'
import { autoAddSelfAsMember, ensureProjNick } from '../lib/nick.js'
import AuthSheet from './AuthSheet.jsx'
import ShareCodeSheet from './ShareCodeSheet.jsx'

/** 我的專案:切換、上雲 / 分享代碼、改名、移除;新增專案;用代碼加入 */
export default function ProjectSheet() {
  const { data, p: current, act, toast, setPage, authUser: me } = useApp()
  const sheet = useSheet()
  const [newType, setNewType] = useState('split')
  const [newName, setNewName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [busy, setBusy] = useState(false)

  function switchProject(id) {
    act((d) => { d.currentProjectId = id })
    sheet.close()
    toast.info(`已切換到「${data.projects.find((x) => x.id === id)?.name}」`)
  }

  function rename(pr) {
    const name = prompt('修改專案名稱', pr.name)
    if (!name || !name.trim()) return
    act(() => { pr.name = name.trim() })
  }

  async function remove(pr) {
    if (data.projects.length <= 1) return toast.error('至少要保留一個專案')
    if (pr.cloud) {
      if (!confirm(`確定退出「${pr.name}」?\n專案仍在雲端、其他成員不受影響;之後可用代碡 ${pr.cloud.code} 重新加入`)) return
      if (cloudOn() && authUser) {
        try {
          const { data: row } = await sb.from('shared_projects').select('id').eq('code', pr.cloud.code).single()
          if (row) await sb.from('project_members').delete().eq('project_id', row.id).eq('user_id', authUser.id)
        } catch { /* 離線也照樣本機移除 */ }
      }
    } else if (!confirm(`「${pr.name}」只存在這台裝置,移除即永久刪除且無法復原。確定?`)) return
    act((d) => {
      d.projects = d.projects.filter((x) => x.id !== pr.id)
      if (d.currentProjectId === pr.id) d.currentProjectId = d.projects[0].id
    })
    toast.info(pr.cloud ? `已退出「${pr.name}」` : '已移除專案')
  }

  async function cloudAction(pr) {
    if (pr.cloud) return sheet.open('☁ 分享代碼', <ShareCodeSheet code={pr.cloud.code} name={pr.name} />)
    if (!cloudOn()) return toast.error('尚未設定雲端')
    if (!authUser) { toast.error('請先登入才能上雲'); return sheet.open('登入 / 設定', <AuthSheet />) }
    setBusy(true)
    try {
      const code = genCode()
      const { data: row, error } = await sb.from('shared_projects').insert({ code, name: pr.name, data: projPayload(pr) }).select().single()
      if (error) return toast.error('上傳失敗:' + error.message)
      act(() => { pr.cloud = { code, ts: row.updated_at } })
      sheet.open('☁ 已上雲!', <ShareCodeSheet code={code} name={pr.name} fresh />)
    } finally { setBusy(false) }
  }

  function addProject(e) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return toast.error('請輸入專案名稱')
    if (data.projects.some((x) => x.name === name)) return toast.error('專案名稱重複了')
    act((d) => {
      const pr = { id: d.nextProjectId++, name, type: newType, members: [], expenses: [], chats: [], nextMemberId: 1, nextExpenseId: 1, cats: { out: [...CATS.out], in: [...CATS.in] } }
      d.projects.push(pr)
      d.currentProjectId = pr.id
    })
    sheet.close()
    toast.success(`已建立「${name}」`)
    if (newType === 'personal') setPage('expenses')
    else {
      setPage('members')
      const msg = autoAddSelfAsMember()
      if (msg) toast.info(msg)
    }
  }

  async function joinByCode(e) {
    e.preventDefault()
    const code = joinCode.trim().toUpperCase()
    if (!cloudOn()) return toast.error('尚未設定雲端')
    if (!authUser) { toast.error('請先登入才能加入雲端專案'); return sheet.open('登入 / 設定', <AuthSheet />) }
    if (!code) return toast.error('請輸入分享代碼')
    const exist = data.projects.find((x) => x.cloud && x.cloud.code === code)
    if (exist) { switchProject(exist.id); setPage('expenses'); return }
    setBusy(true)
    try {
      const { data: rows, error } = await sb.rpc('join_project', { p_code: code })
      const row = rows && rows[0]
      if (error || !row) return toast.error('加入失敗:' + (error ? error.message : '找不到此代碼'))
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
    } finally { setBusy(false) }
  }

  return (
    <div>
      <Card>
        {data.projects.map((pr) => {
          const cur = pr.id === current.id
          return (
            <Row
              key={pr.id}
              onClick={() => switchProject(pr.id)}
              className={cur ? 'bg-primary-soft/60' : ''}
              avatar={<Avatar color={colorOf(pr.id)} text={initials(pr.name)} />}
              title={<>{pr.name}<TypeTag type={pr.type} /></>}
              detail={`${pr.type === 'personal' ? '' : pr.members.length + ' 位成員 · '}${pr.expenses.length} 筆紀錄${pr.cloud ? ' · ☁ ' + pr.cloud.code : ''}`}
              actions={
                <>
                  {cur && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-fg">目前</span>}
                  <IconBtn tone={pr.cloud ? 'primary' : 'muted'} onClick={() => !busy && cloudAction(pr)} title={pr.cloud ? '分享代碼' : '上雲'}>☁</IconBtn>
                  <IconBtn tone="primary" onClick={() => rename(pr)} title="改名">✎</IconBtn>
                  <IconBtn tone="danger" onClick={() => remove(pr)} title="移除">✕</IconBtn>
                </>
              }
            />
          )
        })}
      </Card>

      <SectionTitle>新增專案</SectionTitle>
      <form onSubmit={addProject}>
        <Field label="類型">
          <Chips options={[{ value: 'split', label: '多人分帳' }, { value: 'fund', label: '共同基金' }, { value: 'personal', label: '個人記帳' }]} value={newType} onChange={setNewType} />
        </Field>
        <Field label="名稱">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="例如:日本旅遊、班費、我的帳本" maxLength={20} className="input" />
        </Field>
        <button type="submit" className="btn-primary w-full">＋ 建立專案</button>
      </form>

      <SectionTitle>加入雲端專案</SectionTitle>
      <form onSubmit={joinByCode} className="flex gap-2">
        <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="朋友給的 6 碼分享代碼" maxLength={6} className="input flex-1 uppercase tracking-widest" />
        <button type="submit" disabled={busy} className="btn-secondary shrink-0">☁ 加入</button>
      </form>
      <p className="mt-3 text-center text-xs text-muted">
        {cloudOn() ? (me ? '☁ 雲端同步已啟用' : '☁ 雲端已設定,登入後即可上雲 / 加入專案') : '尚未設定雲端'}
      </p>
    </div>
  )
}
