import { useState } from 'react'
import { useApp } from '../lib/app.jsx'
import { useSheet } from './Sheet.jsx'
import { balances, fmt, ledgerStats, settlements } from '../lib/calc.js'
import { pullAll, syncMyProjects } from '../lib/cloud.js'
import { chatName } from '../lib/nick.js'
import ProjectSheet from '../sheets/ProjectSheet.jsx'
import DateSheet from '../sheets/DateSheet.jsx'
import AuthSheet from '../sheets/AuthSheet.jsx'
import ExpenseSheet from '../sheets/ExpenseSheet.jsx'
import Expenses from '../pages/Expenses.jsx'
import Members from '../pages/Members.jsx'
import Settle from '../pages/Settle.jsx'

function titles(p) {
  return {
    expenses: '記記',
    members: '自訂',
    settle: p.type === 'fund' ? '基金狀況' : p.type === 'personal' ? '統計' : '結算',
  }
}

function subtitle(page, p, duo) {
  if (page === 'expenses') {
    if (p.type !== 'split') return `${p.expenses.length} 筆紀錄`
    if (duo) {
      const me = p.members.find((m) => m.name === chatName())
      const other = me ? p.members.find((m) => m.id !== me.id) : null
      return `👥 雙人模式${other ? '｜與 ' + other.name : ''} · ${p.expenses.length} 筆`
    }
    return `${p.expenses.length} 筆支出`
  }
  if (page === 'members') return p.type === 'personal' ? '管理分類' : `${p.members.length} 位成員 · 分類管理`
  if (p.type === 'split') { const n = settlements().length; return n ? `最少 ${n} 筆轉帳即可結清` : '' }
  if (p.type === 'fund') return `基金餘額 ${fmt(ledgerStats().bal)}`
  return ''
}

export default function Layout() {
  const app = useApp()
  const { p, page, setPage, duo, authUser, isAdmin, cloudOn, toast } = app
  const sheet = useSheet()
  const [refreshing, setRefreshing] = useState(false)

  // 雙人模式沒有結算頁
  const effectivePage = duo && page === 'settle' ? 'expenses' : page
  const t = titles(p)

  async function refresh() {
    if (refreshing) return
    setRefreshing(true)
    try {
      if (cloudOn) { await pullAll(); await syncMyProjects(); toast.info('☁ 已重新整理') }
      else toast.info('已重新整理(未設定雲端)')
    } finally { setRefreshing(false) }
  }

  const tabs = [
    { key: 'expenses', label: t.expenses, icon: ReceiptIcon },
    { key: 'members', label: t.members, icon: PeopleIcon },
    ...(duo ? [] : [{ key: 'settle', label: t.settle, icon: SettleIcon }]),
  ]

  // 避免 balances() 在沒成員時噴錯:只在 split 用到
  void balances

  return (
    <div className="mx-auto flex h-full max-w-md flex-col bg-bg">
      <header className="pt-safe hero shrink-0 text-white shadow">
        <div className="flex items-center justify-between gap-2 px-4 pt-3">
          <button onClick={() => sheet.open('我的專案', <ProjectSheet />)} className="flex min-w-0 items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-sm font-semibold active:bg-white/30">
            <span aria-hidden>📁</span>
            <span className="truncate">{p.name}</span>
            <span className="text-white/70">▾</span>
          </button>
          <div className="flex shrink-0 items-center gap-1.5">
            <HeaderIcon onClick={refresh} title="重新整理" dim={refreshing}>
              <svg {...svgProps}><path d="M4 12a8 8 0 1 1 3 6.24" /><path d="M4 18v-5h5" /></svg>
            </HeaderIcon>
            <HeaderIcon onClick={() => sheet.open('📅 查看特定日期', <DateSheet />)} title="依日期查看">
              <svg {...svgProps}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
            </HeaderIcon>
            <button onClick={() => sheet.open(authUser ? '我的帳號' : '登入 / 設定', <AuthSheet />)} className="flex h-9 items-center gap-1.5 rounded-full bg-white/20 px-2.5 text-sm font-semibold active:bg-white/30">
              {authUser?.avatar ? <img src={authUser.avatar} alt="" className="h-6 w-6 rounded-full object-cover" /> : <span aria-hidden>👤</span>}
              <span className="max-w-[72px] truncate">{authUser ? authUser.nickname : '登入'}</span>
              {isAdmin && <span aria-hidden>🛡️</span>}
            </button>
          </div>
        </div>
        <div className="px-4 pb-3 pt-2">
          <h1 className="text-3xl font-bold tracking-tight">{t[effectivePage]}</h1>
          <p className="mt-0.5 min-h-[1rem] text-xs text-white/80">{subtitle(effectivePage, p, duo)}</p>
        </div>
      </header>

      <main className="relative flex-1 overflow-x-hidden overflow-y-auto px-4 pb-6 pt-4">
        {effectivePage === 'expenses' && <Expenses />}
        {effectivePage === 'members' && <Members />}
        {effectivePage === 'settle' && <Settle />}
      </main>

      {effectivePage === 'expenses' && (
        <button
          aria-label="新增"
          onClick={() => sheet.open(null, <ExpenseSheet />)}
          className="fixed right-5 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-20 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-3xl leading-none text-primary-fg shadow-lg active:scale-95"
        >
          ＋
        </button>
      )}

      <nav className="pb-safe z-10 shrink-0 border-t border-line bg-surface">
        <div className={`mx-auto grid max-w-md ${tabs.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setPage(key)}
              className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${effectivePage === key ? 'text-primary' : 'text-muted'}`}
            >
              <Icon className="h-6 w-6" />
              {label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}

function HeaderIcon({ children, onClick, title, dim }) {
  return (
    <button onClick={onClick} title={title} className={`flex h-9 w-9 items-center justify-center rounded-full bg-white/20 active:bg-white/30 ${dim ? 'opacity-40' : ''}`}>
      {children}
    </button>
  )
}

const svgProps = { className: 'h-5 w-5', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' }
const navSvg = { fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }

function ReceiptIcon({ className }) {
  return <svg className={className} {...navSvg}><rect x="3" y="5" width="18" height="15" rx="2" /><path d="M3 10h18M7 15h4" /></svg>
}
function PeopleIcon({ className }) {
  return <svg className={className} {...navSvg}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6" /><circle cx="17" cy="9" r="2.5" /><path d="M16.5 14.5c2.8.3 5 2.4 5 5.5" /></svg>
}
function SettleIcon({ className }) {
  return <svg className={className} {...navSvg}><path d="M7 10l-4 4 4 4M3 14h13M17 4l4 4-4 4M21 8H8" /></svg>
}
