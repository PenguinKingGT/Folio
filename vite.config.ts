/** 生成无 UI 框架依赖的 ESM 库，开发服务仅允许访问示例与新库文件。 */
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
