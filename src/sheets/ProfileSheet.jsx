import { useState } from 'react'
import { useApp } from '../lib/app.jsx'
import { useSheet } from '../components/Sheet.jsx'
import { Avatar, Field } from '../components/ui.jsx'
import { sb, setAuthUser } from '../lib/cloud.js'
import { initials } from '../lib/calc.js'
import { readAvatar } from '../lib/avatar.js'

export default function ProfileSheet() {
  const { authUser, toast } = useApp()
  const { close } = useSheet()
  const [nick, setNick] = useState(authUser?.nickname ?? '')
  const [avatar, setAvatar] = useState(authUser?.avatar ?? '')
  const [busy, setBusy] = useState(false)
  if (!authUser) return <p className="text-muted">請先登入</p>

  async function pick(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    try { setAvatar(await readAvatar(f)) } catch (err) { toast.error(err) }
  }

  async function saveIt(e) {
    e.preventDefault()
    const n = nick.trim()
    if (!n) return toast.error('請填使用者名稱')
    const meta = { nickname: n }
    if (avatar && avatar !== authUser.avatar) meta.avatar = avatar
    setBusy(true)
    const { data: d, error } = await sb.auth.updateUser({ data: meta })
    setBusy(false)
    if (error) return toast.error('儲存失敗:' + error.message)
    if (d && d.user) setAuthUser(d.user)
    close()
    toast.success('個人資料已更新 ✓')
  }

  return (
    <form onSubmit={saveIt}>
      <div className="mb-4 flex flex-col items-center gap-3">
        <Avatar member={{ id: 0, name: nick, avatar }} size="lg" color="var(--t-primary)" text={initials(nick || '?')} />
        <label className="btn-secondary cursor-pointer py-2 text-sm">
          📷 更換大頭貼
          <input type="file" accept="image/*" hidden onChange={pick} />
        </label>
      </div>
      <Field label="使用者名稱"><input value={nick} onChange={(e) => setNick(e.target.value)} maxLength={8} className="input" /></Field>
      <button type="submit" disabled={busy} className="btn-primary w-full">{busy ? '儲存中…' : '儲存'}</button>
    </form>
  )
}
