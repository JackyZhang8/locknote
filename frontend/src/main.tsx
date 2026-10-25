import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './theme'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// index.html 里的静态启动页负责"第一帧"，等 React 真正画出内容后再把它摘掉。
// 只认 #root 里已经有元素：如果 React 挂了，宁可留着启动页也不要露出一片空白。
const removeBootSplashWhenReady = (deadline: number) => {
  const splash = document.getElementById('boot-splash')
  if (!splash) return

  const root = document.getElementById('root')
  const rendered = (root?.childElementCount ?? 0) > 0
  if (rendered || Date.now() > deadline) {
    splash.remove()
    return
  }
  window.setTimeout(() => removeBootSplashWhenReady(deadline), 50)
}

removeBootSplashWhenReady(Date.now() + 3000)
