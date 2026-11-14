import { configDefaults, defineConfig } from 'vitest/config';

const integrationTests = '**/*.integration.test.ts';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          exclude: [...configDefaults.exclude, integrationTests],
          name: 'unit',
        },
      },
      {
        test: {
          include: [integrationTests],
          name: 'integration',
        },
      },
    ],
  },
});
