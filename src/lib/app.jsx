// React 資料層:把 store / cloud 包成 context,資料變動時整體重繪
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import * as store from './store.js'
import * as cloud from './cloud.js'
import { useToast } from './toast.jsx'

const AppCtx = createContext(null)

export function AppProvider({ children }) {
  const toast = useToast()
  const [version, setVersion] = useState(0)
  const [page, setPageState] = useState('expenses')
  const [authUser, setAuthUser] = useState(cloud.authUser)
  const [admin, setAdmin] = useState(false)

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
      const poll = setInterval(cloud.pullAll, 20000)
      const onVisible = () => document.visibilityState === 'visible' && cloud.pullAll()
      window.addEventListener('focus', cloud.pullAll)
      document.addEventListener('visibilitychange', onVisible)
      return () => {
        unsub()
        clearInterval(poll)
        window.removeEventListener('focus', cloud.pullAll)
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

  const setPage = useCallback((pg) => setPageState(pg), [])

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
