import WebApp from '@twa-dev/sdk';

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
    if (!isTelegram()) return 'light';
    try {
      return WebApp.colorScheme ?? 'light';
    } catch {
      return 'light';
    }
  },

  init() {
    try {
      WebApp.ready();
      WebApp.expand();

      WebApp.disableVerticalSwipes?.();
      WebApp.setHeaderColor?.('#000000');
      WebApp.setBackgroundColor?.('#000000');
    } catch {
    }
    applyViewportHeight();
    try {
      WebApp.onEvent('viewportChanged', applyViewportHeight);
    } catch {
    }
  },

  haptic: {
    light() {
      try { WebApp.HapticFeedback.impactOccurred('light'); } catch {  }
    },
    medium() {
      try { WebApp.HapticFeedback.impactOccurred('medium'); } catch {  }
    },
    rigid() {
      try { WebApp.HapticFeedback.impactOccurred('rigid'); } catch {  }
    },
    success() {
      try { WebApp.HapticFeedback.notificationOccurred('success'); } catch {  }
    },
    warning() {
      try { WebApp.HapticFeedback.notificationOccurred('warning'); } catch {  }
    },
    error() {
      try { WebApp.HapticFeedback.notificationOccurred('error'); } catch {  }
    },
    select() {
      try { WebApp.HapticFeedback.selectionChanged(); } catch {  }
    },
  },

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
    } catch {  }
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
    try { WebApp.close(); } catch {  }
  },
};

const backStack: Array<() => void> = [];
let activeBackHandler: (() => void) | null = null;

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
  }
}

function applyViewportHeight() {
  try {
    const height = WebApp.viewportStableHeight || WebApp.viewportHeight;
    if (height) {
      document.documentElement.style.setProperty('--tg-viewport-height', `${height}px`);
      return;
    }
  } catch {  }
  document.documentElement.style.setProperty('--tg-viewport-height', '100dvh');
}
