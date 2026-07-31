import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

/** Static hosts (GitHub Pages, S3) serve 404.html for unknown paths; make it the SPA entry. */
function spaFallback404(): Plugin {
  return {
    name: 'spa-fallback-404',
    closeBundle() {
      const indexHtml = path.join(rootDir, 'dist', 'index.html');
      if (fs.existsSync(indexHtml)) {
        fs.copyFileSync(indexHtml, path.join(rootDir, 'dist', '404.html'));
      }
    },
  };
}

/** The Zama SDK runs FHE in a worker; SharedArrayBuffer needs cross-origin isolation. */
const crossOriginIsolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

export default defineConfig({
  plugins: [react(), tailwindcss(), spaFallback404()],
  resolve: {
    alias: { '@': path.resolve(rootDir, './src') },
  },
  server: { headers: crossOriginIsolation },
  preview: { headers: crossOriginIsolation },
});
