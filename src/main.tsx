import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import VConsole from 'vconsole'

// 性能监控
if ((window as any).logPerf) {
  (window as any).logPerf('4. JS Bundle 开始执行');
}

// 通过环境变量控制 vConsole 的启用
if (import.meta.env.VITE_ENABLE_VCONSOLE === 'true') {
  new VConsole();
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

