import { useEffect, useRef, useState } from 'react'
import { useApp } from '../lib/app.jsx'
import { chatName, rememberNick } from '../lib/nick.js'
import { today } from '../lib/calc.js'
import { Card, SectionTitle } from './ui.jsx'

/** 留言區(每個專案獨立,最多保留 200 則) */
export default function Chat() {
  const { p, act, toast, version } = useApp()
  const chats = p.chats || []
  const [who, setWho] = useState(chatName)
  const [text, setText] = useState('')
  const endRef = useRef(null)

  // 切換專案時帶入該專案暱稱
  useEffect(() => { setWho(chatName()) }, [p.id, version === 0])

  function send() {
    const name = who.trim()
    const t = text.trim()
    if (!name) return toast.error('請填暱稱')
    if (!t) return toast.error('請輸入留言')
    rememberNick(name)
    const d = new Date()
    const hh = String(d.getHours()).padStart(2, '0'), mm = String(d.getMinutes()).padStart(2, '0')
    act((_, pr) => {
      if (!pr.chats) pr.chats = []
      pr.chats.push({ name, text: t, time: `${today()} ${hh}:${mm}` })
      if (pr.chats.length > 200) pr.chats = pr.chats.slice(-200)
    })
    setText('')
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 50)
  }

  const me = chatName()
  return (
    <>
      <SectionTitle>💬 留言區</SectionTitle>
      <Card className="p-3">
        {chats.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted">還沒有留言,說點什麼吧</p>
        ) : (
          <div className="space-y-2">
            {chats.map((c, i) => {
              const mine = me && c.name === me
              return (
                <div key={i} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? 'bg-primary text-primary-fg' : 'bg-surface-2 text-ink'}`}>
                    {!mine && <div className="mb-0.5 text-[11px] font-semibold opacity-70">{c.name}</div>}
                    <div className="whitespace-pre-wrap break-words" data-selectable>{c.text}</div>
                    <div className={`mt-0.5 text-[10px] ${mine ? 'text-primary-fg/70' : 'text-muted'}`}>{c.time}</div>
                  </div>
                </div>
              )
            })}
            <div ref={endRef} />
          </div>
        )}
        <div className="mt-3 flex gap-2">
          <input value={who} onChange={(e) => setWho(e.target.value)} placeholder="此專案暱稱" maxLength={8} className="input w-24 px-2 py-2 text-sm" />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="留言…"
            maxLength={200}
            className="input flex-1 py-2 text-sm"
          />
          <button onClick={send} className="btn-primary px-3 py-2 text-sm">送出</button>
        </div>
      </Card>
    </>
  )
}
