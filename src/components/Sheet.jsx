import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createSpring, createVelocityTracker, prefersReducedMotion, project, rubberband } from '../lib/spring'

const SheetCtx = createContext(null)

export function SheetProvider({ children }) {
  const [sheet, setSheet] = useState(null)
  const [closing, setClosing] = useState(false)

  const open = useCallback((title, node) => {
    setClosing(false)
    setSheet({ title, node })
  }, [])
  // 只是「請求關閉」:等彈簧動畫停下來才真的卸載,途中可以被手指接住取消
  const close = useCallback(() => setClosing(true), [])
  const onClosed = useCallback(() => { setSheet(null); setClosing(false) }, [])
  const cancelClose = useCallback(() => setClosing(false), [])
  const setTitle = useCallback((title) => setSheet((s) => (s ? { ...s, title } : s)), [])

  const api = useMemo(() => ({ open, close, setTitle, isOpen: Boolean(sheet) }), [open, close, setTitle, sheet])

  return (
    <SheetCtx.Provider value={api}>
      {children}
      {sheet && (
        <SheetView title={sheet.title} closing={closing} onClose={close} onClosed={onClosed} onCancelClose={cancelClose}>
          {sheet.node}
        </SheetView>
      )}
    </SheetCtx.Provider>
  )
}

export function useSheet() {
  return useContext(SheetCtx)
}

// 開:臨界阻尼彈簧滑上來(不回彈)。拖:1:1 跟手,往上超出有橡皮筋阻力。
// 放手:用速度投射決定關或回,並把手指速度交給彈簧;回彈時帶一點 bounce。
const OPEN = { damping: 1, response: 0.38 }
const SETTLE = { damping: 0.8, response: 0.3 }
const DISMISS = { damping: 1, response: 0.3 }

function SheetView({ title, closing, onClose, onClosed, onCancelClose, children }) {
  const sheetRef = useRef(null)
  const scrimRef = useRef(null)
  const bodyRef = useRef(null)
  const headerRef = useRef(null)
  const height = useRef(1)
  const dragging = useRef(false)
  const releaseVelocity = useRef(0)
  const reduced = useRef(prefersReducedMotion())
  const spring = useRef(null)
  const cb = useRef({})
  cb.current = { onClose, onClosed, onCancelClose, closing }

  if (!spring.current) {
    spring.current = createSpring({
      onUpdate: (y) => {
        if (sheetRef.current) sheetRef.current.style.transform = `translate3d(0, ${y}px, 0)`
        if (scrimRef.current) {
          const k = 1 - Math.min(1, Math.max(0, y / height.current))
          scrimRef.current.style.opacity = String(k)
        }
      },
    })
  }

  useLayoutEffect(() => {
    const s = spring.current
    height.current = sheetRef.current?.offsetHeight || window.innerHeight
    if (reduced.current) {
      s.set(0)
      return () => s.stop()
    }
    s.set(height.current)
    s.to(0, OPEN)
    return () => s.stop()
  }, [])

  const mounted = useRef(false)
  useEffect(() => {
    const s = spring.current
    if (!mounted.current) { mounted.current = true; return }
    if (closing) {
      if (reduced.current) {
        // 減少動態效果:淡出取代滑動
        for (const el of [sheetRef.current, scrimRef.current]) {
          if (el) { el.style.transition = 'opacity 160ms ease'; el.style.opacity = '0' }
        }
        const t = setTimeout(() => cb.current.onClosed(), 160)
        return () => clearTimeout(t)
      }
      height.current = sheetRef.current?.offsetHeight || height.current
      const v = releaseVelocity.current
      releaseVelocity.current = 0
      s.to(height.current, { ...DISMISS, velocity: Math.max(v, 0), onRest: () => cb.current.onClosed() })
    } else if (s.value !== 0 && !dragging.current && !reduced.current) {
      // 關到一半又被打開(或取消關閉):從目前位置彈回來
      s.to(0, { ...SETTLE, onRest: () => {} })
    }
  }, [closing])

  // 原生 touch 監聽:拖曳時要 preventDefault 擋住頁面捲動(React 的 touch 事件是 passive)
  useEffect(() => {
    const el = sheetRef.current
    if (!el) return
    const tracker = createVelocityTracker()
    let g = null

    const onStart = (e) => {
      const t = e.touches[0]
      g = {
        startY: t.clientY,
        fromHeader: headerRef.current?.contains(e.target),
        scrollTop: bodyRef.current?.scrollTop ?? 0,
        decided: false,
      }
      tracker.reset()
      tracker.add(t.clientY, e.timeStamp)
    }

    const onMove = (e) => {
      if (!g) return
      const y = e.touches[0].clientY
      if (!g.decided) {
        const dy = y - g.startY
        if (Math.abs(dy) < 6) return
        g.decided = true
        // 從頂部拉、內容已在最上面時往下拉、或表單還在動 → 拖表單;其他情況交給內容捲動
        const grab = g.fromHeader || (g.scrollTop <= 0 && dy > 0) || spring.current.animating
        if (!grab) { g = null; return }
        dragging.current = true
        spring.current.stop()
        g.origin = spring.current.value
        g.startY = y
        if (cb.current.closing) cb.current.onCancelClose()
      }
      e.preventDefault()
      tracker.add(y, e.timeStamp)
      const raw = g.origin + (y - g.startY)
      spring.current.set(raw < 0 ? rubberband(raw, height.current) : raw)
    }

    const onEnd = () => {
      if (!g) return
      const wasDragging = dragging.current
      g = null
      dragging.current = false
      if (!wasDragging) return
      const v = tracker.velocity()
      const landing = spring.current.value + project(v)
      if (landing > height.current * 0.5 && v > -100) {
        releaseVelocity.current = v
        cb.current.onClose()
      } else {
        spring.current.to(0, { ...SETTLE, velocity: v, onRest: () => {} })
      }
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd)
    el.addEventListener('touchcancel', onEnd)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [])

  return (
    <div className="fixed inset-0 z-40">
      <div
        ref={scrimRef}
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.4)', opacity: reduced.current ? 1 : 0, animation: reduced.current ? 'fade-in 160ms ease-out' : undefined }}
        onClick={onClose}
      />
      <div
        ref={sheetRef}
        className="pb-safe absolute inset-x-0 bottom-0 mx-auto flex max-h-[88%] max-w-md flex-col rounded-t-3xl"
        style={{
          background: 'var(--t-bg)',
          transform: reduced.current ? 'none' : 'translate3d(0, 100%, 0)',
          willChange: 'transform',
          boxShadow: '0 -8px 30px rgba(0,0,0,0.12)',
          animation: reduced.current ? 'fade-in 160ms ease-out' : undefined,
        }}
      >
        <div ref={headerRef} className="shrink-0 rounded-t-3xl pt-3 pb-2" style={{
          background: 'var(--t-bg)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          backdropFilter: 'blur(40px) saturate(180%)',
        }}>
          <div className="mx-auto mb-2 h-1 w-9 rounded-full" style={{ background: 'var(--t-muted)' }} />
          {title && <h2 className="px-5 text-[17px] font-semibold tracking-tight text-ink">{title}</h2>}
        </div>
        <div ref={bodyRef} className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-5 pb-8">
          {children}
        </div>
      </div>
    </div>
  )
}
