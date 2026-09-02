import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    server: {
      deps: {
        inline: [
          '@firebase/auth',
          'firebase/auth',
          '@firebase/functions',
          'firebase/functions',
          '@firebase/app',
          'firebase/app',
        ],
      },
    },
    deps: {
      optimizer: {
        web: {
          enabled: false,
        },
        ssr: {
          enabled: false,
        },
      },
    },
    coverage: {
      thresholds: {
        statements: 95,
        lines: 95,
        functions: 95,
        branches: 95,
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
