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
  const sheetRef = useRef(null)
  const bodyRef = useRef(null)
  const start = useRef(null)
  const translateY = useRef(0)

  const onTouchStart = (e) => {
    const scrollTop = bodyRef.current?.scrollTop ?? 0
    start.current = {
      y: e.touches[0].clientY,
      scroll: scrollTop,
      t: e.timeStamp,
    }
  }

  const onTouchMove = (e) => {
    if (!start.current) return
    const dy = e.touches[0].clientY - start.current.y
    const scrollTop = bodyRef.current?.scrollTop ?? 0
    if (scrollTop > 0 && dy < 0) {
      start.current = null
      return
    }
    const resistance = dy > 0 ? 1 - Math.min(dy / 600, 0.5) : 1
    const move = dy * resistance
    translateY.current = move
    if (sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${move}px)`
      sheetRef.current.style.transition = 'none'
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
      if (sheetRef.current) {
        sheetRef.current.style.transform = 'translateY(0)'
        sheetRef.current.style.transition = 'transform 0.4s cubic-bezier(0.32, 0.72, 0, 1)'
      }
    }
    start.current = null
  }

  useEffect(() => {
    if (!closing && sheetRef.current) {
      sheetRef.current.style.transform = 'translateY(0)'
      sheetRef.current.style.transition = 'transform 0.5s cubic-bezier(0.32, 0.72, 0, 1)'
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
        ref={sheetRef}
        className="pb-safe absolute inset-x-0 bottom-0 mx-auto flex max-h-[88%] max-w-md flex-col rounded-t-3xl shadow-2xl"
        style={{
          background: 'var(--t-bg)',
          transform: closing ? 'translateY(100%)' : 'translateY(0)',
          transition: closing
            ? 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)'
            : 'transform 0.5s cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        <div className="shrink-0 pt-3 pb-2" style={{
          background: 'var(--t-bg)',
          WebkitBackdropFilter: 'blur(20px)',
          backdropFilter: 'blur(20px)',
        }}>
          <div
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            className="mx-auto mb-2 h-1 w-9 rounded-full active:opacity-60"
            style={{ background: 'var(--t-muted)' }}
          />
          {title && <h2 className="px-5 text-[17px] font-semibold tracking-tight text-ink">{title}</h2>}
        </div>
        <div ref={bodyRef} className="flex-1 overflow-y-auto overflow-x-hidden px-5 pb-8">
          {children}
        </div>
      </div>
    </div>
  )
}