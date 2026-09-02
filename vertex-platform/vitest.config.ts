import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    deps: {
      optimizer: {
        web: {
          enabled: false,
        },
        ssr: {
          enabled: false,
        },
      },
      inline: [
        '@firebase/auth',
        'firebase/auth',
        '@firebase/functions',
        'firebase/functions',
        '@firebase/app',
        'firebase/app',
      ],
    },
    coverage: {
      thresholds: {
        statements: 85,
        lines: 85,
        functions: 85,
        branches: 85,
      },
    },
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/functions/**',
      '**/cypress/**',
      '**/.angular/**',
      '**/out-tsc/**',
    ],
  },
});
