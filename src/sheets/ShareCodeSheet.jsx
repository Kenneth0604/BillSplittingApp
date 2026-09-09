import { useApp } from '../lib/app.jsx'

export default function ShareCodeSheet({ code, name, fresh = false }) {
  const { toast } = useApp()
  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      toast.success('已複製代碼')
    } catch {
      toast.error('無法自動複製,請手動長按選取')
    }
  }
  return (
    <div className="text-center">
      {fresh && <p className="mb-2 text-sm text-muted">「{name}」已上雲,把代碼給朋友即可一起記帳。</p>}
      <div className="card mx-auto my-3 inline-block px-8 py-4 text-3xl font-black tracking-[0.3em] text-primary" data-selectable>{code}</div>
      <p className="mb-4 text-xs text-muted">朋友在「我的專案 → 加入雲端專案」輸入這 6 碼即可加入。</p>
      <button onClick={copy} className="btn-primary w-full">📋 複製代碼</button>
    </div>
  )
}
