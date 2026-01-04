import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// 从环境变量读取端口号，默认3000
const port = parseInt(process.env.VITE_PORT || process.env.PORT || '3000', 10);

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
    hmr: {
      clientPort: port,
    },
    // 允许所有主机访问
    cors: true,
  },
})
