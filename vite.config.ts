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
        sidepanel: resolve(__dirname, 'src/ui/sidepanel.html'),
        // content script is built separately by esbuild (scripts/build-content.mjs)
        // to ensure it's a single IIFE bundle without ES module imports
        'service-worker': resolve(__dirname, 'src/background/service-worker.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
        // Prevent code splitting for content scripts - they must be self-contained
        manualChunks(id) {
          // Don't create shared chunks - inline everything
          return undefined;
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
