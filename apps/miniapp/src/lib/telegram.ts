import WebApp from '@twa-dev/sdk';

/**
 * Тонкая обёртка над Telegram WebApp SDK.
 * Все вызовы безопасны вне Telegram — в обычном браузере превращаются в no-op,
 * чтобы приложение можно было разрабатывать в Chrome.
 */

/**
 * Признак запуска внутри Telegram: наличие подписанного пользователя в initData.
 * Именно он, а не platform, надёжно отличает Telegram от обычного браузера.
 */
const isTelegram = (): boolean => {
  try {
    return Boolean(WebApp?.initDataUnsafe?.user?.id);
  } catch {
    return false;
  }
};

export const tg = {
  get raw() {
    return WebApp;
  },

  get available() {
    return isTelegram();
  },

  /** Подписанные данные пользователя — уходят в заголовке каждого запроса. */
  get initData(): string {
    try {
      return WebApp.initData ?? '';
    } catch {
      return '';
    }
  },

  get startParam(): string | undefined {
    try {
      return WebApp.initDataUnsafe?.start_param;
    } catch {
      return undefined;
    }
  },

  get colorScheme(): 'light' | 'dark' {
    // Вне Telegram (локальная разработка) всегда тёмная тема — она базовая для дизайна.
    if (!isTelegram()) return 'dark';
    try {
      return WebApp.colorScheme ?? 'dark';
    } catch {
      return 'dark';
    }
  },

  init() {
    try {
      WebApp.ready();
      WebApp.expand();
      // Свайп вниз не должен закрывать приложение во время ввода суммы.
      WebApp.disableVerticalSwipes?.();
      WebApp.setHeaderColor?.('#000000');
      WebApp.setBackgroundColor?.('#000000');
    } catch {
      /* обычный браузер */
    }
    applyViewportHeight();
    try {
      WebApp.onEvent('viewportChanged', applyViewportHeight);
    } catch {
      /* обычный браузер */
    }
  },

  haptic: {
    light() {
      try { WebApp.HapticFeedback.impactOccurred('light'); } catch { /* no-op */ }
    },
    medium() {
      try { WebApp.HapticFeedback.impactOccurred('medium'); } catch { /* no-op */ }
    },
    rigid() {
      try { WebApp.HapticFeedback.impactOccurred('rigid'); } catch { /* no-op */ }
    },
    success() {
      try { WebApp.HapticFeedback.notificationOccurred('success'); } catch { /* no-op */ }
    },
    warning() {
      try { WebApp.HapticFeedback.notificationOccurred('warning'); } catch { /* no-op */ }
    },
    error() {
      try { WebApp.HapticFeedback.notificationOccurred('error'); } catch { /* no-op */ }
    },
    select() {
      try { WebApp.HapticFeedback.selectionChanged(); } catch { /* no-op */ }
    },
  },

  /**
   * Кнопка «Назад» с поддержкой вложенности.
   *
   * Экранов, которые её просят, может быть несколько (лист поверх листа).
   * Раньше каждый снимал кнопку за собой и прятал её, хотя нижний экран был
   * ещё открыт — после этого «Назад» переставала работать. Теперь обработчики
   * лежат в стеке, а активен всегда только верхний.
   */
  pushBackHandler(handler: () => void) {
    backStack.push(handler);
    syncBackButton();

    let released = false;
    return () => {
      if (released) return;
      released = true;
      const index = backStack.lastIndexOf(handler);
      if (index !== -1) backStack.splice(index, 1);
      syncBackButton();
    };
  },

  showMainButton(text: string, handler: () => void, options?: { color?: string; textColor?: string }) {
    try {
      WebApp.MainButton.setParams({
        text,
        color: options?.color ?? '#FFFFFF',
        text_color: options?.textColor ?? '#000000',
        is_active: true,
        is_visible: true,
      });
      WebApp.MainButton.onClick(handler);
      return () => {
        WebApp.MainButton.offClick(handler);
        WebApp.MainButton.hide();
      };
    } catch {
      return () => {};
    }
  },

  setMainButtonProgress(active: boolean) {
    try {
      if (active) WebApp.MainButton.showProgress(false);
      else WebApp.MainButton.hideProgress();
    } catch { /* no-op */ }
  },

  openLink(url: string) {
    try {
      WebApp.openTelegramLink(url);
    } catch {
      window.open(url, '_blank');
    }
  },

  shareLink(url: string, text: string) {
    const share = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
    try {
      WebApp.openTelegramLink(share);
    } catch {
      window.open(share, '_blank');
    }
  },

  close() {
    try { WebApp.close(); } catch { /* no-op */ }
  },
};

// ---------- Кнопка «Назад» ----------

const backStack: Array<() => void> = [];
let activeBackHandler: (() => void) | null = null;

/** Держит на кнопке ровно один обработчик — верхний из стека. */
function syncBackButton() {
  try {
    if (activeBackHandler) {
      WebApp.BackButton.offClick(activeBackHandler);
      activeBackHandler = null;
    }

    const top = backStack[backStack.length - 1];
    if (top) {
      activeBackHandler = top;
      WebApp.BackButton.onClick(top);
      WebApp.BackButton.show();
    } else {
      WebApp.BackButton.hide();
    }
  } catch {
    /* обычный браузер */
  }
}

/** Высота стабильного вьюпорта Telegram — учитывает клавиатуру и шапку. */
function applyViewportHeight() {
  try {
    const height = WebApp.viewportStableHeight || WebApp.viewportHeight;
    if (height) {
      document.documentElement.style.setProperty('--tg-viewport-height', `${height}px`);
      return;
    }
  } catch { /* обычный браузер */ }
  document.documentElement.style.setProperty('--tg-viewport-height', '100dvh');
}
