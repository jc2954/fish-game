import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // Ensures relative asset paths for GitHub Pages subfolder hosting
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
});
