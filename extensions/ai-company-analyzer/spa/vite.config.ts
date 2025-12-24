import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// trailing slash 없이 접속 시 자동 리다이렉트
function trailingSlashRedirect(): PluginOption {
  return {
    name: 'trailing-slash-redirect',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/ai-company-analyzer') {
          res.writeHead(301, { Location: '/ai-company-analyzer/' });
          res.end();
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), trailingSlashRedirect()],
  base: '/chrome-extensions/ai-company-analyzer/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../shared'),
      '@shared/types': path.resolve(__dirname, '../shared/types'),
      '@shared/constants': path.resolve(__dirname, '../shared/constants'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          query: ['@tanstack/react-query'],
        },
      },
    },
  },
});
