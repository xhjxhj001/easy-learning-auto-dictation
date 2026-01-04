import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// 从环境变量读取端口号，默认3000
const port = parseInt(process.env.VITE_PORT || process.env.PORT || '3000', 10);

console.log(`[Vite Config] 使用端口: ${port}`);

// 自定义插件允许所有域名访问
const allowAllHostsPlugin = (): Plugin => {
  return {
    name: 'allow-all-hosts',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // 允许所有域名访问
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        next();
      });
    },
  };
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    allowAllHostsPlugin(),
  ],
  server: {
    host: '0.0.0.0',
    port: port,
    strictPort: false,
    // 允许所有域名访问（解决 "Blocked request" 错误）
    allowedHosts: true,
    hmr: {
      clientPort: port,
    },
    // 允许所有主机访问
    cors: true,
    // 配置代理，将前端 /api 请求转发到后端 server.js
    proxy: {
      '/api': {
        target: `http://localhost:${port + 1}`,
        changeOrigin: true,
      }
    }
  },
  // 生产环境优化
  build: {
    // 禁用 CSS 代码分割可以减少一些构建开销
    cssCodeSplit: false,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        // 简化分块策略，只把 node_modules 里的东西打成一个大包
        // 这样可以减少渲染 Chunk 时的计算量
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        }
      },
    },
  },
  // 依赖预构建优化 (开发模式)
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'antd',
      'axios',
      '@ant-design/icons',
      'vconsole',
      'dayjs'
    ],
  },
})
