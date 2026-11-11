/** Build a framework-independent ESM library with restricted reference-file access. */
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      formats: ['es'],
      fileName: 'folio',
    },
    sourcemap: true,
    target: 'es2022',
  },
  server: {
    fs: {
      deny: ['.env', '.env.*', '**/.git/**', '**/epub.js/**', '*.pem', '*.crt'],
    },
  },
});
