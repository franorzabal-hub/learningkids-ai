import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  root: 'widget-src',
  build: {
    outDir: '../web-component/dist',
    emptyOutDir: true,
    // Generate a single JS file with inlined CSS
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        // Single JS bundle
        entryFileNames: 'widget.js',
        chunkFileNames: 'widget.js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'widget.css';
          }
          return '[name][extname]';
        },
      },
    },
    // Minify for production
    minify: 'esbuild',
    // Target modern browsers
    target: 'es2020',
  },
  server: {
    port: 4444,
  },
});
