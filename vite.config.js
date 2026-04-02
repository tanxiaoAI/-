import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '0.0.0.0', // 监听所有 IP
    port: 8080,      // 固定端口为 8080
    strictPort: true, // 如果端口被占用，直接退出而不尝试下一个可用端口
  },
  preview: {
    host: '0.0.0.0', // 部署预览时也监听所有 IP
    port: 8080,
    strictPort: true,
  }
});
