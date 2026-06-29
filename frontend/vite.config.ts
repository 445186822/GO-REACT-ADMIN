import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const devPort = Number(process.env.VITE_DEV_PORT ?? 5173);
const apiProxyTarget = process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:8080';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['write-excel-file/browser'],
  },
  server: {
    host: '127.0.0.1',
    port: devPort,
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }
          if (id.includes('node_modules/antd/') || id.includes('node_modules/@ant-design/icons')) {
            return 'vendor-antd';
          }
          if (id.includes('node_modules/@ant-design/pro-')) {
            return 'vendor-ant-design-pro';
          }
          if (id.includes('node_modules/@xyflow/')) {
            return 'vendor-xyflow';
          }
          if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/write-excel-file')) {
            return 'vendor-excel';
          }
          return undefined;
        },
      },
    },
  },
});
