import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, existsSync } from 'fs';

// 정적 파일 복사 플러그인
function copyStaticFiles(): Plugin {
  return {
    name: 'copy-static-files',
    writeBundle() {
      // pdf.worker.min.js 복사 (모노레포 루트의 node_modules에서)
      const pdfWorkerSrc = resolve(__dirname, '../../node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
      const pdfWorkerDest = resolve(__dirname, 'dist/pdf.worker.min.js');
      if (existsSync(pdfWorkerSrc)) {
        copyFileSync(pdfWorkerSrc, pdfWorkerDest);
      } else {
        console.warn('Warning: pdf.worker.min.mjs not found at', pdfWorkerSrc);
      }

      // lindera-wasm-ko-dic WASM 파일 복사
      const linderaWasmSrc = resolve(__dirname, '../../node_modules/lindera-wasm-ko-dic/lindera_wasm_bg.wasm');
      const linderaWasmDest = resolve(__dirname, 'dist/lindera_wasm_bg.wasm');
      if (existsSync(linderaWasmSrc)) {
        copyFileSync(linderaWasmSrc, linderaWasmDest);
        console.log('lindera_wasm_bg.wasm copied to dist/');
      } else {
        console.warn('Warning: lindera_wasm_bg.wasm not found at', linderaWasmSrc);
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), copyStaticFiles()],
  base: '',
  optimizeDeps: {
    exclude: ['lindera-wasm-ko-dic'],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'esnext',
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/popup.html'),
        list: resolve(__dirname, 'src/pages/list/list.html'),
        detail: resolve(__dirname, 'src/pages/detail/detail.html'),
        settings: resolve(__dirname, 'src/pages/settings/settings.html'),
        background: resolve(__dirname, 'src/background/index.ts'),
        // content는 esbuild로 별도 번들링 (IIFE 형식 필요)
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
