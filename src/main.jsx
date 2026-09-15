import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.jsx'
import * as store from './lib/store.js'
import { AppProvider } from './lib/app.jsx'
import { ThemeProvider } from './lib/theme.jsx'
import { ToastProvider } from './lib/toast.jsx'
import { SheetProvider } from './components/Sheet.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { registerServiceWorker } from './lib/sw-register.js'
import { installViewportFix } from './lib/viewportFix.js'
import './index.css'

// 1) 載入本機資料(必須在任何元件讀取 proj() 之前)
const corrupted = store.load()
installViewportFix()

// 2) Service Worker(離線殼 + 資源快取;新版接手時由 Layout 顯示「重新載入」提示)
registerServiceWorker()

// HashRouter:GitHub Pages 為靜態站台,用 hash 路由避免重新整理時 404
function Root() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <HashRouter>
            <AppProvider>
              <SheetProvider>
                <App />
              </SheetProvider>
            </AppProvider>
          </HashRouter>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
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
