import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    fileParallelism: false,
    root: './',
    include: ['test/**/*.integration-spec.ts'],
  },
});
