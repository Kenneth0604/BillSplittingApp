import { useEffect, useRef, useState } from 'react'
import { fmt, memberById } from '../lib/calc.js'
import { createSpring, prefersReducedMotion } from '../lib/spring.js'
import { Avatar } from './ui.jsx'

// 結算方案的一筆轉帳:頭貼之間有金幣沿著箭頭流動;按「已付」確認後,
// 金額用彈簧滾到 0、箭頭變綠、打勾畫出來、手機輕震,接著整列收起來才真的記帳。
export default function TransferRow({ t, index, onSettle }) {
  const f = memberById(t.from), to = memberById(t.to)
  const [phase, setPhase] = useState('idle') // idle → paid → collapse
  const amountRef = useRef(null)
  const rowRef = useRef(null)
  const timers = useRef([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  function pay() {
    onSettle(t.from, t.to, t.amt, (commit) => {
      const reduced = prefersReducedMotion()
      setPhase('paid')
      navigator.vibrate?.([10, 40, 16])
      if (!reduced) {
        const s = createSpring({ value: t.amt, damping: 1, response: 0.55, onUpdate: (v) => { if (amountRef.current) amountRef.current.textContent = fmt(Math.max(0, v)) } })
        s.to(0)
      } else if (amountRef.current) amountRef.current.textContent = fmt(0)
      timers.current.push(setTimeout(() => {
        if (rowRef.current) rowRef.current.style.height = rowRef.current.offsetHeight + 'px'
        requestAnimationFrame(() => setPhase('collapse'))
      }, reduced ? 500 : 1050))
      timers.current.push(setTimeout(commit, reduced ? 650 : 1400))
    })
  }

  const paid = phase !== 'idle'
  return (
    <div
      ref={rowRef}
      className={`transfer-row overflow-hidden border-b border-line last:border-b-0 ${phase === 'collapse' ? 'is-collapsing' : ''}`}
      style={{ animationDelay: `${Math.min(index, 8) * 55}ms` }}
    >
      <div className="flex items-center gap-2 px-4 py-3">
        <div className="flex w-14 flex-col items-center gap-1">
          <Avatar member={f} />
          <span className="w-full truncate text-center text-[11px] text-ink">{f?.name || '?'}</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col items-center">
          <span ref={amountRef} className={`font-bold tabular-nums transition-colors duration-300 ${paid ? 'text-success' : 'text-primary'}`}>{fmt(t.amt)}</span>
          <div className={`flow-track mt-1.5 ${paid ? 'is-paid' : ''}`}>
            <span className="flow-line" />
            <span className="flow-coin" />
            <span className="flow-coin" style={{ animationDelay: '-0.6s' }} />
            <span className="flow-coin" style={{ animationDelay: '-1.2s' }} />
            <span className="flow-head" />
          </div>
        </div>
        <div className="flex w-14 flex-col items-center gap-1">
          <Avatar member={to} />
          <span className="w-full truncate text-center text-[11px] text-ink">{to?.name || '?'}</span>
        </div>
        {paid ? (
          <svg className="paid-check shrink-0" viewBox="0 0 32 32" width="32" height="32" aria-label="已付">
            <circle cx="16" cy="16" r="14" />
            <path d="M9.5 16.5l4.2 4.2 8.8-9.2" />
          </svg>
        ) : (
          <button onClick={pay} className="chip shrink-0 py-1 text-xs text-success active:scale-95 transition-transform">✓ 已付</button>
        )}
      </div>
    </div>
  )
}
