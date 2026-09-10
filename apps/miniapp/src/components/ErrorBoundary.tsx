import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Ловит ошибки рендера.
 *
 * Без неё любое исключение внутри дерева оставляло пустой чёрный экран
 * без единой подсказки — именно так выглядел «интерфейс пропал».
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ui] ошибка рендера:', error, info.componentStack);
  }

  private reset = () => {
    this.setState({ error: null });
  };

  private reload = () => {
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-3 px-8 py-16 text-center">
        <div className="text-[40px]">😵‍💫</div>
        <div className="text-[17px] font-semibold">Что-то сломалось</div>
        <div className="max-w-xs text-[13px] leading-snug text-muted">
          {error.message || 'Неизвестная ошибка интерфейса'}
        </div>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={this.reset}
            className="pressable rounded-full bg-elevated px-5 py-2.5 text-[14px] font-medium"
          >
            Вернуться
          </button>
          <button
            type="button"
            onClick={this.reload}
            className="pressable rounded-full bg-content px-5 py-2.5 text-[14px] font-semibold text-ink"
          >
            Перезагрузить
          </button>
        </div>
      </div>
    );
  }
}
