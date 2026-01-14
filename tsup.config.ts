import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/bin.ts', 'src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'node18',
  shims: true,
  banner: {
    js: `import 'dotenv/config';`,
  },
});
