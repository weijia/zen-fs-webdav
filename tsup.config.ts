import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false,
  outExtension({ format }) {
    return {
      js: format === 'cjs' ? '.js' : '.mjs',
    };
  },
  target: 'es2020',
  platform: 'neutral',
  esbuildOptions(options) {
    options.banner = {
      js: '// zen-fs-webdav - https://github.com/username/zen-fs-webdav',
    };
  },
});