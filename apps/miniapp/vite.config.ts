import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Читаем нужные переменные из корневого .env вручную.
 * loadEnv() здесь не подходит: он подхватывает NODE_ENV из .env и продакшен-сборка
 * начинает включать development-версию React.
 */
function readRootEnv(keys: string[]): Record<string, string> {
  const file = path.resolve(process.cwd(), '../../.env');
  const out: Record<string, string> = {};
  if (!fs.existsSync(file)) return out;

  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (!keys.includes(key)) continue;
    out[key] = rawValue.trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

export default defineConfig(({ mode }) => {
  const env = readRootEnv(['API_PUBLIC_URL', 'API_PORT', 'VITE_APP_NAME']);
  const apiTarget = env.API_PUBLIC_URL || `http://localhost:${env.API_PORT || 3000}`;

  const appName = env.VITE_APP_NAME || 'Бюджет';

  return {
    plugins: [
      react(),
      {
        // Подставляем название в <title>: в репозитории лежит плейсхолдер,
        // конкретное имя приходит из VITE_APP_NAME при сборке.
        name: 'app-name-html',
        transformIndexHtml: (html) => html.replace(/%VITE_APP_NAME%/g, appName),
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(process.cwd(), 'src'),
        '@budget/shared': path.resolve(process.cwd(), '../../packages/shared/src/index.ts'),
      },
    },
    server: {
      port: 5173,
      host: true,
      // Разрешаем открывать dev-сервер через ngrok/cloudflare-туннель.
      allowedHosts: true,
      proxy: {
        '/api': { target: apiTarget, changeOrigin: true },
        '/uploads': { target: apiTarget, changeOrigin: true },
      },
    },
    define: {
      // Название доступно и в коде — через import.meta.env.VITE_APP_NAME.
      'import.meta.env.VITE_APP_NAME': JSON.stringify(appName),
    },
    build: {
      outDir: 'dist',
      sourcemap: mode !== 'production',
      rollupOptions: {
        output: {
          // Вендорные библиотеки отдельными чанками — кэшируются между релизами.
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            motion: ['framer-motion'],
            query: ['@tanstack/react-query'],
            icons: ['lucide-react'],
          },
        },
      },
    },
  };
});
