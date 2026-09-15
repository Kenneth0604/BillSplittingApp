// React 資料層:把 store / cloud 包成 context,資料變動時整體重繪
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import * as store from './store.js'
import * as cloud from './cloud.js'
import { useToast } from './toast.jsx'

const AppCtx = createContext(null)

export function AppProvider({ children }) {
  const toast = useToast()
  const [version, setVersion] = useState(0)
  const [authUser, setAuthUser] = useState(cloud.authUser)
  const [admin, setAdmin] = useState(false)

  // 頁面由 hash 路由決定(#/expenses、#/members、#/settle);對外仍提供 page / setPage 讓各 sheet 沿用
  const location = useLocation()
  const navigate = useNavigate()
  const page = location.pathname.replace(/^\//, '') || 'expenses'
  const setPage = useCallback((pg) => navigate(`/${pg}`), [navigate])

  // 接線:store 變動 → 重繪;雲端事件 → toast / 重繪 / 登入狀態
  useEffect(() => {
    const unsub = store.subscribe(() => setVersion((v) => v + 1))
    cloud.hooks.toast = (m) => toast.info(m)
    cloud.hooks.render = () => store.notify()
    cloud.hooks.onAuth = (u) => setAuthUser(u)
    cloud.hooks.onAdmin = (f) => setAdmin(f)
    store.setOnSave(cloud.schedulePush)
    store.setOnSaveError(() => toast.error('⚠ 儲存失敗,請檢查瀏覽器空間或隱私模式設定'))

    if (cloud.cloudOn()) {
      cloud.initAuth()
      cloud.pullAll()
      // Realtime 即時推送為主;每 60 秒輪詢 + 聚焦 / 回前景 / 恢復連線為備援
      const unsubRt = cloud.subscribeRealtime()
      const poll = setInterval(cloud.pullAll, 60000)
      const onVisible = () => document.visibilityState === 'visible' && cloud.pullAll()
      window.addEventListener('focus', cloud.pullAll)
      window.addEventListener('online', cloud.pullAll)
      document.addEventListener('visibilitychange', onVisible)
      return () => {
        unsub()
        unsubRt()
        clearInterval(poll)
        window.removeEventListener('focus', cloud.pullAll)
        window.removeEventListener('online', cloud.pullAll)
        document.removeEventListener('visibilitychange', onVisible)
      }
    }
    return unsub
  }, [toast])

  /** 執行一段修改資料的程式並存檔(自動上雲、重繪) */
  const act = useCallback((fn) => {
    const r = fn(store.data, store.proj())
    store.save()
    return r
  }, [])

  const value = useMemo(() => {
    const p = store.proj()
    return {
      version,
      data: store.data,
      p,
      duo: p.type === 'split' && p.members.length === 2,
      page,
      setPage,
      act,
      authUser,
      isAdmin: admin || cloud.isAdmin(),
      cloudOn: cloud.cloudOn(),
      toast,
    }
  }, [version, page, setPage, act, authUser, admin, toast])

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}

export function useApp() {
  const ctx = useContext(AppCtx)
  if (!ctx) throw new Error('useApp 必須在 AppProvider 內使用')
  return ctx
}
