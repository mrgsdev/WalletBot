import { execFileSync } from 'node:child_process';

const url =
  process.env.TEST_DATABASE_URL ??
  `postgresql://${process.env.USER ?? 'postgres'}@localhost:5432/budget_test?schema=public`;

/** Накатывает схему на тестовую базу перед прогоном. */
export async function setup() {
  execFileSync(
    'npx',
    ['prisma', 'db', 'push', '--force-reset', '--skip-generate', '--accept-data-loss'],
    {
      cwd: process.cwd(),
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: url },
    },
  );
}
