/**
 * postinstall: собирает @budget/shared, если это возможно.
 *
 * На сервере ставится `npm ci --omit=dev`, где нет TypeScript, а сам dist
 * приезжает готовым при выкладке. Поэтому здесь мягкая логика:
 * есть готовая сборка — ничего не делаем, нет компилятора — предупреждаем и выходим с нулём.
 */
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'packages/shared/dist/index.js');
const tsc = path.join(root, 'node_modules/.bin/tsc');

if (existsSync(dist)) process.exit(0);

if (!existsSync(tsc)) {
  console.warn('[postinstall] TypeScript не установлен и сборки @budget/shared нет — пропускаю.');
  console.warn('[postinstall] Если это прод, выложите packages/shared/dist вместе с приложением.');
  process.exit(0);
}

const result = spawnSync(tsc, ['-p', 'tsconfig.build.json'], {
  cwd: path.join(root, 'packages/shared'),
  stdio: 'inherit',
});
process.exit(result.status ?? 0);
