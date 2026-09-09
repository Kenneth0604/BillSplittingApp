import { useState } from 'react'
import { useApp } from '../lib/app.jsx'
import { useSheet } from '../components/Sheet.jsx'
import { Avatar, Card, Field, Row, SectionTitle } from '../components/ui.jsx'
import { THEMES, useTheme } from '../lib/theme.jsx'
import { sb, cloudOn } from '../lib/cloud.js'
import { initials } from '../lib/calc.js'
import ProfileSheet from './ProfileSheet.jsx'
import { AdminProjectsSheet, AdminUsersSheet } from './AdminSheets.jsx'

/** 帳號 + 外觀設定 */
export default function AuthSheet() {
  const { authUser, isAdmin, toast } = useApp()
  const sheet = useSheet()
  const { theme, setTheme } = useTheme()
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [nick, setNick] = useState('')
  const [busy, setBusy] = useState(false)

  async function login(e) {
    e.preventDefault()
    if (!email.trim() || !pw) return toast.error('請填 Email 和密碼')
    setBusy(true)
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: pw })
    setBusy(false)
    if (error) return toast.error('登入失敗:' + error.message)
    sheet.close()
    toast.success('歡迎回來!')
  }
  async function signup() {
    if (!email.trim() || !pw) return toast.error('請填 Email 和密碼')
    if (pw.length < 6) return toast.error('密碼至少 6 碼')
    if (!nick.trim()) return toast.error('請填暱稱')
    setBusy(true)
    const { data: d, error } = await sb.auth.signUp({ email: email.trim(), password: pw, options: { data: { nickname: nick.trim() } } })
    setBusy(false)
    if (error) return toast.error('註冊失敗:' + error.message)
    sheet.close()
    if (d && d.user && !d.session) return toast.info('請到信箱點確認信後再登入')
    toast.success(`註冊成功,嗨 ${nick.trim()}!`)
  }
  async function logout() {
    try { await sb.auth.signOut() } catch { /* ignore */ }
    sheet.close()
    toast.info('已登出')
  }

  return (
    <div>
      <SectionTitle className="mt-0">外觀主題</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        {THEMES.map((t) => (
          <button key={t.id} onClick={() => setTheme(t.id)} className={`card p-3 text-left ${theme === t.id ? 'ring-2 ring-primary' : ''}`}>
            <div className="flex gap-1">{t.swatch.map((c) => <span key={c} className="h-5 w-5 rounded-full ring-1 ring-black/10" style={{ background: c }} />)}</div>
            <p className="mt-1.5 text-sm font-semibold text-ink">{t.name}</p>
            <p className="text-[11px] text-muted">{t.desc}</p>
          </button>
        ))}
      </div>

      <SectionTitle>帳號</SectionTitle>
      {!cloudOn() ? (
        <p className="empty">登入功能需要先設定 Supabase 雲端</p>
      ) : authUser ? (
        <>
          <Card>
            <Row
              avatar={<Avatar member={{ id: 0, name: authUser.nickname, avatar: authUser.avatar }} color="var(--t-primary)" text={initials(authUser.nickname)} />}
              title={<>{authUser.nickname}{isAdmin && <span className="ml-1.5 rounded-full bg-warning-soft px-2 py-0.5 text-[10px] font-bold text-warning">admin</span>}</>}
              detail={authUser.email}
            />
          </Card>
          <div className="mt-3 space-y-2">
            <button onClick={() => sheet.open('✎ 編輯個人資料', <ProfileSheet />)} className="btn-secondary w-full">✎ 編輯個人資料</button>
            {isAdmin && (
              <>
                <SectionTitle>🛡️ 管理員</SectionTitle>
                <button onClick={() => sheet.open('🛡️ 所有雲端專案', <AdminProjectsSheet />)} className="btn-secondary w-full">檢視所有雲端專案</button>
                <button onClick={() => sheet.open('🛡️ 帳號管理', <AdminUsersSheet />)} className="btn-secondary w-full">管理帳號</button>
              </>
            )}
            <button onClick={logout} className="btn-danger-outline w-full">登出</button>
          </div>
        </>
      ) : (
        <form onSubmit={login}>
          <Field label="Email"><input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="input" /></Field>
          <Field label="密碼(至少 6 碼)"><input type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••" className="input" /></Field>
          <Field label="暱稱(註冊時使用,留言會顯示這個名字)"><input value={nick} onChange={(e) => setNick(e.target.value)} maxLength={8} placeholder="例如:67哥" className="input" /></Field>
          <button type="submit" disabled={busy} className="btn-primary w-full">登入</button>
          <button type="button" disabled={busy} onClick={signup} className="btn-secondary mt-2 w-full">還沒有帳號?註冊</button>
        </form>
      )}
    </div>
  )
}
