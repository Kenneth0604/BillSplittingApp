import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import * as store from './lib/store.js'
import { AppProvider } from './lib/app.jsx'
import { ThemeProvider } from './lib/theme.jsx'
import { ToastProvider } from './lib/toast.jsx'
import { SheetProvider } from './components/Sheet.jsx'
import { installViewportFix } from './lib/viewportFix.js'
import './index.css'

// 1) 載入本機資料(必須在任何元件讀取 proj() 之前)
const corrupted = store.load()
installViewportFix()

// 2) Service Worker(離線殼 + 資源快取)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .then((reg) => reg.update().catch(() => {}))
      .catch((err) => console.warn('Service Worker 註冊失敗', err))
  })
}

function Root() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AppProvider>
          <SheetProvider>
            <App />
          </SheetProvider>
        </AppProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)

if (corrupted) {
  setTimeout(() => alert('⚠ 偵測到本機資料損毀,已重置為預設資料'), 300)
}
