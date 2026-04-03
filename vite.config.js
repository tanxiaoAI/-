import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import viteCompression from 'vite-plugin-compression';

export default defineConfig({
  plugins: [
    react(),
    // Gzip 压缩
    viteCompression({
      verbose: true,
      disable: false,
      threshold: 10240, // 大于 10kb 的文件进行压缩
      algorithm: 'gzip',
      ext: '.gz',
    }),
    // Brotli 压缩 (如果服务器支持的话，压缩率更高)
    viteCompression({
      verbose: true,
      disable: false,
      threshold: 10240,
      algorithm: 'brotliCompress',
      ext: '.br',
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 8080,
    strictPort: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 8080,
    strictPort: true,
  },
  // 生产环境去除 console 和 debugger
  build: {
    target: 'es2015',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    cssCodeSplit: true, // 启用 CSS 代码拆分
    chunkSizeWarningLimit: 500, // chunk 大小警告限制 (kb)
    rollupOptions: {
      output: {
        // 静态资源分类和打包规则
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
        // 手动分包
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // 将 React 核心库单独打包
            if (id.includes('react') || id.includes('react-dom')) {
              return 'react-vendor';
            }
            // 将图标库单独打包
            if (id.includes('lucide-react')) {
              return 'lucide-vendor';
            }
            // 其他第三方依赖打包到一个 chunk
            return 'vendor';
          }
        }
      }
    }
  }
});
