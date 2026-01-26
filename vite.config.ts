import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
  },
  base: './',
  define: {
    // Replace import.meta.url with empty string for content scripts
    // This fixes jsPDF's internal dynamic imports
    'import.meta.url': '""',
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'esnext',
    modulePreload: false,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/ui/popup.html'),
        content: resolve(__dirname, 'src/content/index.ts'),
        'service-worker': resolve(__dirname, 'src/background/service-worker.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
