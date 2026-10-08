import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

const SheetCtx = createContext(null)

export function SheetProvider({ children }) {
  const [sheet, setSheet] = useState(null)
  const [closing, setClosing] = useState(false)

  const open = useCallback((title, node) => {
    setClosing(false)
    setSheet({ title, node })
  }, [])
  const close = useCallback(() => {
    setClosing(true)
    setTimeout(() => { setSheet(null); setClosing(false) }, 350)
  }, [])
  const setTitle = useCallback((title) => setSheet((s) => (s ? { ...s, title } : s)), [])

  const api = useMemo(() => ({ open, close, setTitle, isOpen: Boolean(sheet) }), [open, close, setTitle, sheet])

  return (
    <SheetCtx.Provider value={api}>
      {children}
      {sheet && <SheetView title={sheet.title} closing={closing} onClose={close}>{sheet.node}</SheetView>}
    </SheetCtx.Provider>
  )
}

export function useSheet() {
  return useContext(SheetCtx)
}

function SheetView({ title, closing, onClose, children }) {
  const ref = useRef(null)
  const start = useRef(null)
  const translateY = useRef(0)

  const onTouchStart = (e) => {
    start.current = {
      y: e.touches[0].clientY,
      scroll: ref.current?.scrollTop ?? 0,
      t: e.timeStamp,
      translateY: translateY.current,
    }
  }

  const onTouchMove = (e) => {
    if (!start.current) return
    const dy = e.touches[0].clientY - start.current.y
    const scrollTop = ref.current?.scrollTop ?? 0
    if (scrollTop > 0 && dy < 0) {
      start.current = null
      return
    }
    const resistance = dy > 0 ? 1 - Math.min(dy / 600, 0.5) : 1
    const move = dy * resistance
    translateY.current = move
    if (ref.current) {
      ref.current.style.transform = `translateY(${move}px)`
      ref.current.style.transition = 'none'
    }
  }

  const onTouchEnd = (e) => {
    if (!start.current) return
    const dy = e.changedTouches[0].clientY - start.current.y
    const dt = e.timeStamp - start.current.t
    const velocity = dt > 0 ? dy / dt * 1000 : 0
    if (dy > 80 || velocity > 300) {
      onClose()
    } else {
      translateY.current = 0
      if (ref.current) {
        ref.current.style.transform = 'translateY(0)'
        ref.current.style.transition = 'transform 0.4s cubic-bezier(0.32, 0.72, 0, 1)'
      }
    }
    start.current = null
  }

  useEffect(() => {
    if (!closing && ref.current) {
      ref.current.style.transform = 'translateY(0)'
      ref.current.style.transition = 'transform 0.5s cubic-bezier(0.32, 0.72, 0, 1)'
    }
  }, [closing])

  return (
    <div className="fixed inset-0 z-40">
      <div
        className={`absolute inset-0 transition-opacity duration-300 ease-out ${closing ? 'opacity-0' : 'opacity-100'}`}
        style={{ background: 'rgba(0,0,0,0.4)' }}
        onClick={onClose}
      />
      <div
        ref={ref}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="pb-safe absolute inset-x-0 bottom-0 mx-auto max-h-[88%] max-w-md overflow-y-auto overflow-x-hidden rounded-t-3xl shadow-2xl"
        style={{
          background: 'var(--t-bg)',
          transform: closing ? 'translateY(100%)' : 'translateY(0)',
          transition: closing
            ? 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)'
            : 'transform 0.5s cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        <div className="sticky top-0 z-10 pt-3 pb-2" style={{
          background: 'var(--t-bg)',
          WebkitBackdropFilter: 'blur(20px)',
          backdropFilter: 'blur(20px)',
        }}>
          <div className="mx-auto mb-2 h-1 w-9 rounded-full" style={{ background: 'var(--t-muted)' }} />
          {title && <h2 className="px-5 text-[17px] font-semibold tracking-tight text-ink">{title}</h2>}
        </div>
        <div className="px-5 pb-8">{children}</div>
      </div>
    </div>
  )
}