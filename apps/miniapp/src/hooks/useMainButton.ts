import { useEffect, useRef } from 'react';
import { tg } from '../lib/telegram';

/**
 * Показывает нативную MainButton Telegram, пока условие истинно.
 * Обработчик держим в ref, чтобы не переподписываться на каждый рендер.
 */
export function useMainButton(visible: boolean, text: string, onClick: () => void, loading = false) {
  const handler = useRef(onClick);
  handler.current = onClick;

  useEffect(() => {
    if (!visible) return;
    return tg.showMainButton(text, () => handler.current());
  }, [visible, text]);

  useEffect(() => {
    if (!visible) return;
    tg.setMainButtonProgress(loading);
  }, [visible, loading]);
}
