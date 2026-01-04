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
    rollupOptions: {
      output: {
        // 依然进行代码分割，将大型库分块以利用浏览器缓存
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'antd-vendor': ['antd', '@ant-design/icons'],
          'axios-vendor': ['axios'],
        },
      },
    },
    cssCodeSplit: true,
    chunkSizeWarningLimit: 1000,
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
