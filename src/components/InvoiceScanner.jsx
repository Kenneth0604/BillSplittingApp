import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import jsQR from 'jsqr'
import { invoiceDesc, isRightQR, parseInvoiceQR } from '../lib/invoice.js'
import { createSpring, prefersReducedMotion } from '../lib/spring.js'

/**
 * 全螢幕掃描電子發票左邊的 QR code。
 * 相機畫面上挖一個圓角取景框,四角括號會「呼吸」、掃描線上下掃;
 * 掃到時框框用彈簧收緊變綠、手機輕震,下方彈出結果卡(金額滾動到位)。
 * 有 BarcodeDetector 就用原生的(快、省電),沒有就用 jsQR;沒有相機權限時可以改選照片。
 */
export default function InvoiceScanner({ onResult, onClose }) {
  const videoRef = useRef(null)
  const frameRef = useRef(null)
  const [status, setStatus] = useState('starting') // starting | scanning | denied | found
  const [hint, setHint] = useState('')
  const [inv, setInv] = useState(null)
  const scanning = useRef(true)
  const streamRef = useRef(null)

  function found(result) {
    scanning.current = false
    setInv(result)
    setStatus('found')
    navigator.vibrate?.([10, 40, 18])
  }

  function handleText(text) {
    if (!text) return false
    if (isRightQR(text)) { flashHint('這是右邊的 QR code,請對準左邊那一個'); return false }
    const r = parseInvoiceQR(text)
    if (!r) { flashHint('這不是電子發票的 QR code'); return false }
    found(r)
    return true
  }

  const hintTimer = useRef(0)
  function flashHint(t) {
    setHint(t)
    clearTimeout(hintTimer.current)
    hintTimer.current = setTimeout(() => setHint(''), 1800)
  }

  // 開相機 + 掃描迴圈
  useEffect(() => {
    let alive = true
    let raf = 0
    let last = 0
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    const detector = 'BarcodeDetector' in window ? new window.BarcodeDetector({ formats: ['qr_code'] }) : null
    let busy = false

    async function tick(ts) {
      if (!alive) return
      raf = requestAnimationFrame(tick)
      const v = videoRef.current
      if (!scanning.current || busy || !v || v.readyState < 2 || ts - last < 120) return
      last = ts
      busy = true
      try {
        if (detector) {
          const codes = await detector.detect(v)
          for (const c of codes) if (handleText(c.rawValue)) break
        } else {
          // 只取畫面中央的正方形,縮到 640 以內再交給 jsQR
          const s = Math.min(v.videoWidth, v.videoHeight) * 0.8
          const size = Math.min(640, Math.round(s))
          canvas.width = canvas.height = size
          ctx.drawImage(v, (v.videoWidth - s) / 2, (v.videoHeight - s) / 2, s, s, 0, 0, size, size)
          const img = ctx.getImageData(0, 0, size, size)
          const code = jsQR(img.data, size, size, { inversionAttempts: 'dontInvert' })
          if (code) handleText(code.data)
        }
      } catch { /* 單一影格失敗就略過 */ }
      busy = false
    }

    ;(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false })
        if (!alive) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        const v = videoRef.current
        v.srcObject = stream
        await v.play().catch(() => {})
        setStatus('scanning')
        raf = requestAnimationFrame(tick)
      } catch {
        if (alive) setStatus('denied')
      }
    })()

    return () => {
      alive = false
      cancelAnimationFrame(raf)
      clearTimeout(hintTimer.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 取景框:掃到時用彈簧收緊(帶一點回彈)
  useEffect(() => {
    const el = frameRef.current
    if (!el || status !== 'found' || prefersReducedMotion()) return
    const s = createSpring({ value: 1, onUpdate: (k) => { el.style.transform = `scale(${k})` } })
    s.to(0.9, { damping: 0.5, response: 0.35 })
    return () => s.stop()
  }, [status])

  // 從照片解碼
  async function fromPhoto(file) {
    if (!file) return
    try {
      const bmp = await createImageBitmap(file)
      const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height))
      const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale)
      const c = document.createElement('canvas')
      c.width = w; c.height = h
      const ctx = c.getContext('2d')
      ctx.drawImage(bmp, 0, 0, w, h)
      const code = jsQR(ctx.getImageData(0, 0, w, h).data, w, h)
      if (!code || !handleText(code.data)) flashHint(code ? '' : '照片裡找不到 QR code')
    } catch {
      flashHint('讀不到這張照片')
    }
  }

  function rescan() {
    setInv(null)
    setStatus(streamRef.current ? 'scanning' : 'denied')
    if (frameRef.current) frameRef.current.style.transform = ''
    scanning.current = true
  }

  return createPortal(
    <div className="scan-root" role="dialog" aria-label="掃描電子發票">
      <video ref={videoRef} className="scan-video" playsInline muted />
      <div className="scan-shade" />

      <div ref={frameRef} className="scan-frame" data-state={status}>
        <i /><i /><i /><i />
        {status === 'scanning' && <span className="scan-line" />}
      </div>

      <div className="scan-top pt-safe">
        <button type="button" className="scan-close" onClick={onClose} aria-label="關閉">
          <svg width="16" height="16" viewBox="0 0 16 16"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        </button>
        <p className="scan-title">掃描電子發票</p>
        <span className="w-9" />
      </div>

      {status !== 'found' && (
        <p className="scan-tip" data-hint={hint ? '' : undefined}>
          {hint || (status === 'denied' ? '無法使用相機,可以改選一張發票照片' : status === 'starting' ? '正在開啟相機…' : '對準發票左邊的 QR code')}
        </p>
      )}

      {status !== 'found' && (
        <label className="scan-photo">
          <input type="file" accept="image/*" className="hidden" onChange={(e) => fromPhoto(e.target.files?.[0])} />
          🖼️ 從照片選擇
        </label>
      )}

      {inv && <ResultCard inv={inv} onUse={() => onResult(inv)} onRescan={rescan} />}
    </div>,
    document.body,
  )
}

function ResultCard({ inv, onUse, onRescan }) {
  const ref = useRef(null)
  const numRef = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (prefersReducedMotion()) { if (numRef.current) numRef.current.textContent = inv.total.toLocaleString('zh-Hant'); return }
    const y = createSpring({ value: 260, onUpdate: (v) => { el.style.transform = `translate3d(0, ${v}px, 0)` } })
    y.to(0, { damping: 0.82, response: 0.42 })
    const n = createSpring({ value: 0, onUpdate: (v) => { if (numRef.current) numRef.current.textContent = Math.round(v).toLocaleString('zh-Hant') } })
    n.to(inv.total, { damping: 1, response: 0.55 })
    return () => { y.stop(); n.stop() }
  }, [inv])
  return (
    <div ref={ref} className="scan-result pb-safe" style={{ transform: 'translate3d(0, 260px, 0)' }}>
      <div className="mb-1 flex items-center justify-between text-xs text-muted">
        <span>✓ {inv.number}</span>
        <span>{inv.date.replace(/-/g, '/')}</span>
      </div>
      <p className="text-[13px] font-semibold text-muted">總計</p>
      <p className="text-4xl font-bold tabular-nums text-ink" style={{ letterSpacing: '-0.02em' }}>NT$ <span ref={numRef}>0</span></p>
      <p className="mt-1 truncate text-sm text-ink">{invoiceDesc(inv)}</p>
      {inv.items.length > 0 && (
        <ul className="scan-items">
          {inv.items.slice(0, 4).map((it, i) => (
            <li key={i} style={{ '--i': i }}>
              <span className="truncate">{it.name}{it.qty > 1 ? ` ×${it.qty}` : ''}</span>
              <span className="tabular-nums text-muted">{Math.round(it.qty * it.price)}</span>
            </li>
          ))}
          {inv.items.length > 4 && <li className="text-muted">還有 {inv.items.length - 4} 項…</li>}
        </ul>
      )}
      <div className="mt-4 grid grid-cols-[1fr_2fr] gap-2">
        <button type="button" className="btn-secondary" onClick={onRescan}>重掃</button>
        <button type="button" className="btn-primary" onClick={onUse}>帶入這張發票</button>
      </div>
    </div>
  )
}
