import { useEffect } from 'react';
import type { ThemeMode } from '@budget/shared';
import { tg } from '../lib/telegram';

export function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;

  const effective =
    mode === 'system' ? (tg.available ? tg.colorScheme : preferredScheme()) : mode;

  if (effective === 'dark') root.dataset.appTheme = 'dark';
  else delete root.dataset.appTheme;
}

function preferredScheme(): 'light' | 'dark' {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function useTheme(mode: ThemeMode) {
  useEffect(() => {
    applyTheme(mode);
    if (mode !== 'system') return;

    const sync = () => applyTheme('system');

    let media: MediaQueryList | null = null;
    try {
      media = window.matchMedia('(prefers-color-scheme: dark)');
      media.addEventListener('change', sync);
    } catch {
      media = null;
    }

    try {
      tg.raw.onEvent('themeChanged', sync);
    } catch {
    }

    return () => {
      media?.removeEventListener('change', sync);
      try {
        tg.raw.offEvent('themeChanged', sync);
      } catch {
      }
    };
  }, [mode]);
}
