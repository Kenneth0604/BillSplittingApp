import { dispExpr, evalAmt } from '../lib/calc.js'

/**
 * 金額輸入:手機跳原生數字鍵盤(inputmode=decimal),可直接打算式如 670/3
 * 點入時游標放在最後(欄位靠右對齊,避免瀏覽器把游標放到最前面)
 */
export default function AmountInput({ value, onChange, placeholder = '0', className = '', compact = false, autoFocus = false }) {
  const v = String(value ?? '')
  const hasOp = /[+\-*/]/.test(v)
  const result = evalAmt(v)
  return (
    <div className={className}>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        autoFocus={autoFocus}
        value={v}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value.replace(/[^\d+\-*/.]/g, ''))}
        onFocus={(e) => { const n = e.target.value.length; requestAnimationFrame(() => e.target.setSelectionRange(n, n)) }}
        onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
        className={`input text-right font-semibold tabular-nums ${compact ? 'px-2 py-1.5 text-sm' : 'text-xl'}`}
      />
      {!compact && hasOp && (
        <p className="mt-1 text-right text-xs text-muted">
          {dispExpr(v)} {Number.isNaN(result) ? '' : `＝ ${Math.round(result)}`}
        </p>
      )}
    </div>
  )
}
