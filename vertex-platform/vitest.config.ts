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
