import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/functions/**',
      '**/cypress/**',
      '**/.angular/**',
      '**/out-tsc/**'
    ],
    coverage: {
      thresholds: {
        statements: 85,
        branches: 85,
        functions: 85,
        lines: 85
      }
    }
  }
});
