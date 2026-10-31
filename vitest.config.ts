import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs'],
    restoreMocks: true,
    unstubGlobals: true,
    setupFiles: ['src/test/setup.ts'],
    css: { include: [/.+/] }, // keep real CSS so design tests can read it via ?raw
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'scripts/check-licenses.mjs'],
      exclude: ['src/**/*.test.ts', 'src/**/test-fixtures.ts', 'src/test/**', 'src/main.ts', 'src/**/*.d.ts'],
      reporter: ['text', 'html'],
      // Standard: see docs/TESTING.md. Do not lower these.
      thresholds: { lines: 95, branches: 95, functions: 95, statements: 95 },
    },
  },
});
