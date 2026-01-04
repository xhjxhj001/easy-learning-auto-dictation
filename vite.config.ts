import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 从环境变量读取端口号，默认3000
const port = parseInt(process.env.VITE_PORT || process.env.PORT || '3000', 10);

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: port,
    // 允许所有域名访问
    allowedHosts: [
      'all'
    ],
    // 或者使用严格模式，允许所有主机
    strictPort: false,
  }
})

