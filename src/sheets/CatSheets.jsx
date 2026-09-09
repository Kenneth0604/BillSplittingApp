import { useState } from 'react'
import { useApp } from '../lib/app.jsx'
import { useSheet } from '../components/Sheet.jsx'
import { Field } from '../components/ui.jsx'
import { getCats } from '../lib/store.js'

export function CatAddSheet({ kind }) {
  const { act, toast } = useApp()
  const { close } = useSheet()
  const [name, setName] = useState('')

  function add() {
    const n = name.trim()
    if (!n) return toast.error('請輸入分類名稱')
    if (getCats(kind).includes(n)) return toast.error('分類已存在')
    act(() => getCats(kind).push(n))
    close()
    toast.success(`已加入「${n}」`)
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); add() }}>
      <Field label="分類名稱(可加 emoji)">
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="例如:🍿 宵夜、🐱 寵物" maxLength={12} className="input" />
      </Field>
      <button type="submit" className="btn-primary w-full">加入</button>
    </form>
  )
}

/** 改名會同步更新用到的帳目 */
export function CatEditSheet({ kind, index }) {
  const { act, toast } = useApp()
  const { close } = useSheet()
  const cur = getCats(kind)[index]
  const [name, setName] = useState(cur ?? '')
  if (cur === undefined) return <p className="text-muted">找不到分類</p>

  function saveIt() {
    const n = name.trim()
    if (!n) return toast.error('請輸入分類名稱')
    if (n === cur) return close()
    if (getCats(kind).includes(n)) return toast.error('分類已存在')
    let touched = 0
    act((_, p) => {
      getCats(kind)[index] = n
      p.expenses.forEach((e) => { if (e.cat === cur) { e.cat = n; touched++ } })
    })
    close()
    toast.success(`已改名「${n}」${touched ? `,更新了 ${touched} 筆帳目` : ''}`)
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); saveIt() }}>
      <Field label="分類名稱(改名會同步更新既有帳目)">
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={12} className="input" />
      </Field>
      <button type="submit" className="btn-primary w-full">儲存</button>
    </form>
  )
}
