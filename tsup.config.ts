import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm', 'iife'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false,
  outExtension({ format }) {
    return {
      js: format === 'cjs' ? '.js' : format === 'iife' ? '.umd.js' : '.mjs',
    };
  },
  globalName: 'ZenWebDAVFS',
  target: 'es2020',
  platform: 'neutral',
  esbuildOptions(options) {
    options.banner = {
      js: '// zen-fs-webdav - https://github.com/weijia/zen-fs-webdav',
    };
  },
});