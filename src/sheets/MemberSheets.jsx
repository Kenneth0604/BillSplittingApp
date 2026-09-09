import { useState } from 'react'
import { useApp } from '../lib/app.jsx'
import { useSheet } from '../components/Sheet.jsx'
import { Avatar, Field } from '../components/ui.jsx'
import { readAvatar } from '../lib/avatar.js'

export function MemberAddSheet() {
  const { act, toast } = useApp()
  const { close } = useSheet()
  const [name, setName] = useState('')

  function add() {
    const n = name.trim()
    if (!n) return toast.error('請輸入名字')
    let dup = false
    act((_, p) => {
      if (p.members.some((m) => m.name === n)) { dup = true; return }
      p.members.push({ id: p.nextMemberId++, name: n })
    })
    if (dup) return toast.error('名字重複了')
    close()
    toast.success(`已加入 ${n}`)
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); add() }}>
      <Field label="名字">
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="例如:小美" maxLength={10} className="input" />
      </Field>
      <button type="submit" className="btn-primary w-full">加入</button>
    </form>
  )
}

export function MemberEditSheet({ id }) {
  const { p, act, toast } = useApp()
  const { close } = useSheet()
  const m = p.members.find((x) => x.id === id)
  const [name, setName] = useState(m?.name ?? '')
  const [avatar, setAvatar] = useState(m?.avatar ?? '') // '' = 無;'REMOVE' 不需要,直接設空字串
  if (!m) return <p className="text-muted">找不到成員</p>

  async function pick(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    try { setAvatar(await readAvatar(f)) } catch (err) { toast.error(err) }
  }

  function saveIt() {
    const n = name.trim()
    if (!n) return toast.error('請填成員名稱')
    if (p.members.some((x) => x.id !== m.id && x.name === n)) return toast.error('名字重複了')
    act(() => { m.name = n; m.avatar = avatar || '' })
    close()
    toast.success('成員資料已更新 ✓')
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); saveIt() }}>
      <div className="mb-4 flex flex-col items-center gap-3">
        <Avatar member={{ ...m, name, avatar }} size="lg" />
        <div className="flex gap-2">
          <label className="btn-secondary cursor-pointer py-2 text-sm">
            📷 更換頭貼
            <input type="file" accept="image/*" hidden onChange={pick} />
          </label>
          {avatar && <button type="button" onClick={() => setAvatar('')} className="btn-secondary py-2 text-sm">移除頭貼</button>}
        </div>
      </div>
      <Field label="成員名稱">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={8} className="input" />
      </Field>
      <button type="submit" className="btn-primary w-full">儲存</button>
    </form>
  )
}
