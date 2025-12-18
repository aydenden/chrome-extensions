import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'fs';

// Plugin to copy static files and move popup.html
function copyStaticFiles() {
  return {
    name: 'copy-static-files',
    closeBundle() {
      const outDir = resolve(__dirname, 'dist');

      // Copy manifest.json
      copyFileSync(
        resolve(__dirname, 'manifest.json'),
        resolve(outDir, 'manifest.json')
      );

      // Copy icons directory
      const iconsDir = resolve(outDir, 'icons');
      mkdirSync(iconsDir, { recursive: true });

      const iconSizes = ['16', '48', '128'];
      iconSizes.forEach(size => {
        copyFileSync(
          resolve(__dirname, `icons/icon-${size}.png`),
          resolve(iconsDir, `icon-${size}.png`)
        );
      });

      // Copy popup.css to dist root
      const popupCssPath = resolve(__dirname, 'src/popup/popup.css');
      copyFileSync(popupCssPath, resolve(outDir, 'popup.css'));

      // Move popup.html to dist root and update script/css paths
      const popupHtmlPath = resolve(outDir, 'src/popup/index.html');
      let popupHtmlContent = readFileSync(popupHtmlPath, 'utf-8');

      // Update script path
      popupHtmlContent = popupHtmlContent.replace('src="/popup.js"', 'src="./popup.js"');

      // Remove all crossorigin attributes
      popupHtmlContent = popupHtmlContent.replace(/\s*crossorigin\s*/g, '');

      // Remove vite-generated CSS link and modulepreload links
      popupHtmlContent = popupHtmlContent.replace(/<link rel="modulepreload"[^>]*>/g, '');
      popupHtmlContent = popupHtmlContent.replace(/<link rel="stylesheet"[^>]*>/g, '');

      // Add our custom CSS link
      popupHtmlContent = popupHtmlContent.replace(
        '</title>',
        '</title>\n    <link rel="stylesheet" href="./popup.css" />'
      );

      writeFileSync(resolve(outDir, 'popup.html'), popupHtmlContent);
    },
  };
}

export default defineConfig({
  plugins: [react(), copyStaticFiles()],
  build: {
    outDir: 'dist',
    emptyOutDirOnBuild: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/index.html'),
        background: resolve(__dirname, 'src/background/index.ts'),
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
      '@': resolve(__dirname, './src'),
      '@shared': resolve(__dirname, '../shared'),
    },
  },
});
