import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

/**
 * 底部表單(Bottom Sheet)
 * useSheet().open(title, <Content/>) / close()
 * 在頂端往下滑約 90px 可收合。
 */
const SheetCtx = createContext(null)

export function SheetProvider({ children }) {
  const [sheet, setSheet] = useState(null) // { title, node }
  const [closing, setClosing] = useState(false)

  const open = useCallback((title, node) => {
    setClosing(false)
    setSheet({ title, node })
  }, [])
  const close = useCallback(() => {
    setClosing(true)
    setTimeout(() => { setSheet(null); setClosing(false) }, 220)
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

  const onTouchStart = (e) => {
    start.current = { y: e.touches[0].clientY, scroll: ref.current?.scrollTop ?? 0 }
  }
  const onTouchEnd = (e) => {
    if (!start.current) return
    const dy = e.changedTouches[0].clientY - start.current.y
    if (dy > 90 && start.current.scroll <= 0 && (ref.current?.scrollTop ?? 0) <= 0) onClose()
    start.current = null
  }

  return (
    <div className="fixed inset-0 z-40">
      <div
        className={`absolute inset-0 bg-black/45 backdrop-blur-[2px] transition-opacity duration-200 ${closing ? 'opacity-0' : 'opacity-100 animate-[fadeIn_.2s_ease]'}`}
        onClick={onClose}
      />
      <div
        ref={ref}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className={`pb-safe absolute inset-x-0 bottom-0 mx-auto max-h-[88%] max-w-md overflow-y-auto overflow-x-hidden rounded-t-3xl bg-bg px-5 pt-2 shadow-2xl transition-transform duration-200 ease-out ${closing ? 'translate-y-full' : 'translate-y-0 animate-[slideUp_.25s_cubic-bezier(.32,.72,.35,1)]'}`}
      >
        <div className="mx-auto mb-3 mt-1 h-1.5 w-10 rounded-full bg-muted/40" />
        {title && <h2 className="mb-4 text-lg font-bold text-ink">{title}</h2>}
        <div className="pb-6">{children}</div>
      </div>
      <style>{`@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}@keyframes fadeIn{from{opacity:0}to{opacity:1}}`}</style>
    </div>
  )
}
