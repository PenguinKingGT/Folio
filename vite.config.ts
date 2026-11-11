/** Build a framework-independent ESM library with restricted reference-file access. */
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  optimizeDeps: {
    entries: ['examples/basic/index.html'],
    include: [
      'fflate',
      '@xmldom/xmldom',
      'css-tree/parser',
      'css-tree/generator',
      'css-tree/walker',
    ],
  },
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
