import { useEffect } from 'react';
import type { ThemeMode } from '@budget/shared';
import { tg } from '../lib/telegram';

/** Применяет тему к документу. «Системная» следует за темой Telegram. */
export function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;

  const effective =
    mode === 'system' ? (tg.available ? tg.colorScheme : preferredScheme()) : mode;

  if (effective === 'light') root.dataset.appTheme = 'light';
  else delete root.dataset.appTheme;
}

function preferredScheme(): 'light' | 'dark' {
  try {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

/**
 * Держит тему в актуальном состоянии.
 * В системном режиме подписываемся и на Telegram, и на системную настройку —
 * приложение открывают и внутри клиента, и в обычном браузере.
 */
export function useTheme(mode: ThemeMode) {
  useEffect(() => {
    applyTheme(mode);
    if (mode !== 'system') return;

    const sync = () => applyTheme('system');

    let media: MediaQueryList | null = null;
    try {
      media = window.matchMedia('(prefers-color-scheme: light)');
      media.addEventListener('change', sync);
    } catch {
      media = null;
    }

    try {
      tg.raw.onEvent('themeChanged', sync);
    } catch {
      /* обычный браузер */
    }

    return () => {
      media?.removeEventListener('change', sync);
      try {
        tg.raw.offEvent('themeChanged', sync);
      } catch {
        /* обычный браузер */
      }
    };
  }, [mode]);
}
