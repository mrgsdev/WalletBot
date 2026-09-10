import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, X } from 'lucide-react';
import { useDemo, useMarkTipSeen, useResetTips, useSession } from '../lib/queries';
import { tg } from '../lib/telegram';
import { onTourEvent, type TourEvent } from '../lib/tourBus';

/**
 * Пошаговое обучение в духе TipKit.
 *
 * Тур ведёт пользователя по всему приложению: сам переходит на нужный экран,
 * подсвечивает элемент и объясняет, зачем он. Проходится один раз —
 * отметка хранится на сервере, — но его можно запустить заново из настроек.
 */

/** Идентификатор пройденного тура. Смените суффикс, если шаги сильно изменились. */
export const TOUR_ID = 'tour-v1';

export interface TourStep {
  id: string;
  /** Экран, на котором живёт элемент. Тур перейдёт туда сам. */
  route: string;
  title: string;
  text: string;
}

/**
 * Сценарий обучения: от главного экрана к статистике, счетам и настройкам.
 * Порядок здесь — это порядок показа.
 */
export const TOUR: TourStep[] = [
  // ---------- Главная ----------
  {
    id: 'budget-switch',
    route: '/',
    title: 'Выбор бюджета',
    text: 'Здесь переключаются бюджеты: личный, семейный или любой другой. Всё, что вы видите ниже, относится к выбранному бюджету.',
  },
  {
    id: 'total-balance',
    route: '/',
    title: 'Общий баланс',
    text: 'Сумма всех счетов, приведённая к валюте отчётов. Валюта меняется в настройках.',
  },
  {
    id: 'month-budget',
    route: '/',
    title: 'Сколько можно тратить в день',
    text: 'Задайте лимит на месяц — он поделится на дни. После каждой траты дневная норма пересчитывается на оставшиеся дни. Нажмите на карточку, чтобы увидеть разбор.',
  },
  {
    id: 'accounts-strip',
    route: '/',
    title: 'Ваши счета',
    text: 'Карты, наличные, счета в разных валютах. Листайте вбок, нажмите на любой — откроется кошелёк.',
  },
  {
    id: 'month-summary',
    route: '/',
    title: 'Итоги месяца',
    text: 'Доходы и расходы за текущий месяц. Полоска показывает соотношение. Нажмите, чтобы перейти к подробной статистике.',
  },
  {
    id: 'recent-transactions',
    route: '/',
    title: 'Последние операции',
    text: 'Свежие записи. Нажмите на любую, чтобы отредактировать или удалить, а «Все» откроет историю с фильтрами.',
  },
  {
    id: 'add-button',
    route: '/',
    title: 'Добавить операцию',
    text: 'Главная кнопка приложения. Открывает калькулятор: можно вводить выражения вроде 75+50, выбирать счёт, валюту, дату и категорию.',
  },

  // ---------- Статистика ----------
  {
    id: 'stats-type',
    route: '/stats',
    title: 'Расходы или доходы',
    text: 'Переключает, что показывает диаграмма. Рядом выбирается счёт — можно смотреть по одному или по всем сразу.',
  },
  {
    id: 'stats-period',
    route: '/stats',
    title: 'Период',
    text: 'Неделя, месяц или квартал. Ниже — лента месяцев: пролистайте, чтобы посмотреть прошлые периоды.',
  },
  {
    id: 'stats-donut',
    route: '/stats',
    title: 'Разбивка по категориям',
    text: 'Каждый сегмент — категория. В центре общая сумма за период. Нажмите на сегмент, чтобы выделить категорию.',
  },
  {
    id: 'stats-list',
    route: '/stats',
    title: 'Список категорий',
    text: 'Те же данные цифрами, от большего к меньшему. Кнопка «История» ниже покажет операции за этот период.',
  },

  // ---------- Кошелёк ----------
  {
    id: 'wallet-total',
    route: '/wallet',
    title: 'Кошелёк',
    text: 'Все счета бюджета и общая сумма. В семейном бюджете счёт можно сделать общим или оставить личным.',
  },
  {
    id: 'wallet-transfer',
    route: '/wallet',
    title: 'Перевод между счетами',
    text: 'Переложить деньги с карты в наличные или между валютами. Конвертация считается по актуальному курсу.',
  },
  {
    id: 'wallet-add',
    route: '/wallet',
    title: 'Новый счёт',
    text: 'Добавьте карту, наличные или счёт в другой валюте. Стартовый остаток можно указать сразу.',
  },

  // ---------- Настройки ----------
  {
    id: 'more-budgets',
    route: '/more',
    title: 'Бюджеты и участники',
    text: 'Создать ещё один личный бюджет или семейный, пригласить близких по ссылке, исключить участника или удалить бюджет целиком.',
  },
  {
    id: 'more-theme',
    route: '/more',
    title: 'Тема оформления',
    text: 'Светлая, тёмная или как в системе. Применяется сразу.',
  },
  {
    id: 'more-reminder',
    route: '/more',
    title: 'Напоминания',
    text: 'Два вида: ежедневное «внесите траты» и напоминания о конкретных платежах — квартплате, подписках. Для каждого свои день и время.',
  },
  {
    id: 'more-export',
    route: '/more',
    title: 'Выгрузка в Excel',
    text: 'План и факт по категориям плюс полный список операций. Файл приходит сообщением от бота.',
  },
  {
    id: 'more-replay',
    route: '/more',
    title: 'Это всё',
    text: 'Обучение можно пройти заново в любой момент — кнопка «Сбросить» здесь. Приятного учёта!',
  },
];

/** Шаг интерактивного сценария: пользователь действует сам. */
export interface ActStep {
  id: string;
  route: string;
  title: string;
  text: string;
  /**
   * Событие, которого ждём от приложения. Пока его нет, кнопки «Далее»
   * не будет — шаг завершает сам пользователь.
   */
  awaits?: TourEvent;
  /** Подсказка под карточкой, пока действие не выполнено. */
  hint?: string;
}

/**
 * Интерактивный сценарий: записать первую операцию от начала до конца.
 * В отличие от обзора, здесь оверлей пропускает нажатия к подсвеченному
 * элементу — пользователь делает всё своими руками.
 */
export const WALKTHROUGH: ActStep[] = [
  {
    id: 'add-button',
    route: '/',
    title: 'Шаг 1. Откройте ввод',
    text: 'Нажмите оранжевую кнопку внизу — откроется калькулятор для новой операции.',
    awaits: 'add-opened',
    hint: 'Ждём нажатия на «+»',
  },
  {
    id: 'walk-keypad',
    route: '/',
    title: 'Шаг 2. Введите сумму',
    text: 'Наберите любую сумму — например, 250. Можно считать прямо здесь: 75+50 тоже сработает.',
    awaits: 'amount-entered',
    hint: 'Ждём, пока появится сумма',
  },
  {
    id: 'walk-category',
    route: '/',
    title: 'Шаг 3. Выберите категорию',
    text: 'Нажмите на категорию слева внизу и выберите подходящую из сетки — например, «Продукты».',
    awaits: 'category-picked',
    hint: 'Ждём выбора категории',
  },
  {
    id: 'walk-account',
    route: '/',
    title: 'Шаг 4. Проверьте счёт и дату',
    text: 'Сверху — счёт, с которого уходят деньги, и валюта. Ниже — дата: по умолчанию сегодня, но можно выбрать любую.',
  },
  {
    id: 'walk-save',
    route: '/',
    title: 'Шаг 5. Сохраните',
    text: 'Нажмите «Сохранить» — операция попадёт в историю, а баланс счёта и бюджет на месяц пересчитаются.',
    awaits: 'transaction-saved',
    hint: 'Ждём сохранения',
  },
  {
    id: 'recent-transactions',
    route: '/',
    title: 'Готово!',
    text: 'Ваша операция уже в списке. Так записывается любая трата или доход — весь путь занимает несколько секунд.',
  },
];

interface TourActions {
  register: (id: string, element: HTMLElement) => () => void;
  start: () => void;
}

const TourContext = createContext<TourActions | null>(null);

/** Сколько ждём появления элемента, прежде чем пропустить шаг. */
const TARGET_TIMEOUT_MS = 2500;

/**
 * Этапы обучения.
 *
 * Порядок такой: демо-данные → обзор приложения → вопрос про демо →
 * предложение пройти сценарий руками → интерактив.
 */
type Phase =
  | { kind: 'idle' }
  | { kind: 'overview'; index: number }
  | { kind: 'ask-demo' }
  | { kind: 'ask-walkthrough' }
  | { kind: 'walkthrough'; index: number }
  /** Подтверждение выхода. Помним, куда вернуться, если человек передумал. */
  | { kind: 'confirm-skip'; from: Phase }

export function TourProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const markSeen = useMarkTipSeen();
  const resetTips = useResetTips();
  const demo = useDemo();

  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [targets, setTargets] = useState<Map<string, HTMLElement>>(new Map());
  const [demoCreated, setDemoCreated] = useState(0);

  // Мутации пересоздаются каждый рендер, а колбэки должны быть стабильными.
  const refs = useRef({ markSeen, resetTips, demo });
  refs.current = { markSeen, resetTips, demo };

  const completed = session?.settings.seenTips.includes(TOUR_ID) ?? true;

  const register = useCallback((id: string, element: HTMLElement) => {
    setTargets((prev) => {
      // Без этой проверки каждая регистрация давала бы новое состояние
      // и бесконечный цикл рендеров.
      if (prev.get(id) === element) return prev;
      const next = new Map(prev);
      next.set(id, element);
      return next;
    });

    return () => {
      setTargets((prev) => {
        if (prev.get(id) !== element) return prev;
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    };
  }, []);

  /** Завершение всего обучения. */
  const finish = useCallback(() => {
    setPhase({ kind: 'idle' });
    refs.current.markSeen.mutate(TOUR_ID);
  }, []);

  /** Запуск с нуля: наполняем демо и открываем обзор. */
  const start = useCallback(() => {
    refs.current.resetTips.mutate();
    refs.current.demo.seed.mutate(undefined, {
      onSuccess: (status) => setDemoCreated(status.count),
    });
    setPhase({ kind: 'overview', index: 0 });
  }, []);

  // Автозапуск для новичка. Ref не даёт стартовать дважды.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!session || completed || autoStarted.current) return;
    autoStarted.current = true;
    const timer = window.setTimeout(start, 900);
    return () => window.clearTimeout(timer);
  }, [session, completed, start]);

  // Во время подтверждения продолжаем показывать тот шаг, на котором остановились.
  const visible = phase.kind === 'confirm-skip' ? phase.from : phase;
  const overviewStep = visible.kind === 'overview' ? TOUR[visible.index] : null;
  const walkStep = visible.kind === 'walkthrough' ? WALKTHROUGH[visible.index] : null;
  const step = overviewStep ?? walkStep;

  // Переводим пользователя на экран текущего шага.
  useEffect(() => {
    if (!step) return;
    if (location.pathname !== step.route) navigate(step.route);
  }, [step, location.pathname, navigate]);

  const next = useCallback(() => {
    tg.haptic.light();
    setPhase((prev) => {
      if (prev.kind === 'overview') {
        if (prev.index + 1 < TOUR.length) return { kind: 'overview', index: prev.index + 1 };
        return { kind: 'ask-demo' };
      }
      if (prev.kind === 'walkthrough') {
        if (prev.index + 1 < WALKTHROUGH.length) {
          return { kind: 'walkthrough', index: prev.index + 1 };
        }
        // Сценарий пройден до конца — обучение закончено.
        refs.current.markSeen.mutate(TOUR_ID);
        return { kind: 'idle' };
      }
      return prev;
    });
  }, []);

  const back = useCallback(() => {
    tg.haptic.light();
    setPhase((prev) => {
      if (prev.kind === 'overview' && prev.index > 0) {
        return { kind: 'overview', index: prev.index - 1 };
      }
      if (prev.kind === 'walkthrough' && prev.index > 0) {
        return { kind: 'walkthrough', index: prev.index - 1 };
      }
      return prev;
    });
  }, []);

  /** Крестик и «Пропустить» сначала спрашивают подтверждение. */
  const requestSkip = useCallback(() => {
    tg.haptic.warning();
    setPhase((prev) =>
      prev.kind === 'confirm-skip' ? prev : { kind: 'confirm-skip', from: prev },
    );
  }, []);

  // Интерактивный шаг ждёт реального действия пользователя.
  useEffect(() => {
    if (!walkStep?.awaits) return;
    return onTourEvent((event) => {
      if (event !== walkStep.awaits) return;
      tg.haptic.success();
      // Небольшая пауза: пользователь должен увидеть результат своего действия.
      window.setTimeout(() => {
        setPhase((prev) => {
          if (prev.kind !== 'walkthrough' || WALKTHROUGH[prev.index]?.id !== walkStep.id) {
            return prev;
          }
          if (prev.index + 1 < WALKTHROUGH.length) {
            return { kind: 'walkthrough', index: prev.index + 1 };
          }
          refs.current.markSeen.mutate(TOUR_ID);
          return { kind: 'idle' };
        });
      }, 450);
    });
  }, [walkStep]);

  const actions = useMemo<TourActions>(() => ({ register, start }), [register, start]);

  const onRightScreen = step ? location.pathname === step.route : false;
  const element = step ? targets.get(step.id) : undefined;
  const interactive = visible.kind === 'walkthrough';


  return (
    <TourContext.Provider value={actions}>
      {children}

      {step && (
        <TourOverlay
          key={step.id}
          // Во время подтверждения карточка шага не должна принимать нажатия.
          muted={phase.kind === 'confirm-skip'}
          title={step.title}
          text={step.text}
          hint={walkStep?.hint}
          waiting={Boolean(walkStep?.awaits)}
          interactive={interactive}
          index={(visible as { index: number }).index}
          total={interactive ? WALKTHROUGH.length : TOUR.length}
          element={onRightScreen ? element : undefined}
          onNext={next}
          onBack={back}
          onSkip={requestSkip}
        />
      )}

      {phase.kind === 'confirm-skip' && (
        <TourDialog
          emoji="🤔"
          title="Точно пропустить?"
          text={
            phase.from.kind === 'walkthrough'
              ? 'Остановимся на середине — записать операцию можно и самостоятельно. Запустить обучение заново получится в любой момент: «Ещё» → «Пройти обучение заново».'
              : 'Обучение занимает пару минут и показывает, где что находится. Вернуться к нему можно в любой момент: «Ещё» → «Пройти обучение заново».'
          }
          primary="Продолжить обучение"
          secondary="Всё равно пропустить"
          onPrimary={() => {
            tg.haptic.light();
            setPhase(phase.from);
          }}
          onSecondary={() => {
            tg.haptic.light();
            // Из обзора идём к вопросам про демо, из интерактива — сразу к выходу.
            if (phase.from.kind === 'overview') setPhase({ kind: 'ask-demo' });
            else finish();
          }}
        />
      )}

      {phase.kind === 'ask-demo' && (
        <TourDialog
          emoji="🧹"
          title="Удалить демо-данные?"
          text={
            demoCreated > 0
              ? `Для обучения я добавил ${demoCreated} операций за три месяца — чтобы графики и история были не пустыми. Их можно удалить: ваши собственные записи останутся.`
              : 'Демо-операции добавлялись для наглядности. Их можно удалить — ваши собственные записи останутся.'
          }
          primary="Удалить"
          secondary="Оставить"
          busy={demo.clear.isPending}
          onPrimary={() => {
            tg.haptic.success();
            demo.clear.mutate(undefined, {
              onSettled: () => setPhase({ kind: 'ask-walkthrough' }),
            });
          }}
          onSecondary={() => {
            tg.haptic.light();
            setPhase({ kind: 'ask-walkthrough' });
          }}
        />
      )}

      {phase.kind === 'ask-walkthrough' && (
        <TourDialog
          emoji="🎯"
          title="Пройти по шагам?"
          text="Запишем первую операцию вместе: я буду подсказывать, а нажимать будете вы. Пять коротких шагов."
          primary="Давайте"
          secondary="Не сейчас"
          onPrimary={() => {
            tg.haptic.medium();
            navigate('/');
            setPhase({ kind: 'walkthrough', index: 0 });
          }}
          onSecondary={() => {
            tg.haptic.light();
            finish();
          }}
        />
      )}
    </TourContext.Provider>
  );
}

/** Модальный вопрос между этапами обучения. */
function TourDialog({
  emoji, title, text, primary, secondary, onPrimary, onSecondary, busy,
}: {
  emoji: string;
  title: string;
  text: string;
  primary: string;
  secondary: string;
  onPrimary: () => void;
  onSecondary: () => void;
  busy?: boolean;
}) {
  return createPortal(
    <motion.div
      className="fixed inset-0 z-[60] flex items-center justify-center p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/70" />
      <motion.div
        className="relative w-full max-w-sm rounded-3xl bg-surface p-5 text-center shadow-sheet"
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 24 }}
      >
        <div className="text-[34px]">{emoji}</div>
        <div className="mt-1 text-[17px] font-semibold">{title}</div>
        <p className="mt-2 text-[13px] leading-snug text-muted">{text}</p>

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={onPrimary}
            disabled={busy}
            className="pressable w-full rounded-2xl bg-content px-5 py-3.5 text-[15px] font-semibold text-ink disabled:opacity-50"
          >
            {busy ? 'Минутку…' : primary}
          </button>
          <button
            type="button"
            onClick={onSecondary}
            disabled={busy}
            className="pressable w-full rounded-2xl bg-elevated px-5 py-3.5 text-[15px] font-medium disabled:opacity-50"
          >
            {secondary}
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}

export function useTour() {
  return useContext(TourContext);
}

/** Оборачивает элемент, к которому относится шаг тура. */
export function TourTarget({
  id,
  children,
  className,
}: {
  id: string;
  children: ReactNode;
  className?: string;
}) {
  const tour = useTour();
  const ref = useRef<HTMLDivElement>(null);
  const register = tour?.register;

  useEffect(() => {
    if (!register || !ref.current) return;
    return register(id, ref.current);
  }, [register, id]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

function TourOverlay({
  title,
  text,
  hint,
  waiting,
  interactive,
  muted,
  index,
  total,
  element,
  onNext,
  onBack,
  onSkip,
}: {
  title: string;
  text: string;
  hint?: string;
  /** Шаг ждёт действия пользователя — кнопки «Далее» не будет. */
  waiting: boolean;
  /** Пропускать нажатия к подсвеченному элементу. */
  interactive: boolean;
  /** Поверх открыт диалог — шаг только фон. */
  muted?: boolean;
  index: number;
  total: number;
  element?: HTMLElement;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    setRect(null);
    setGaveUp(false);

    if (!element) {
      // Элемента нет — либо экран ещё не отрисовался, либо шаг неактуален.
      const timer = window.setTimeout(() => setGaveUp(true), TARGET_TIMEOUT_MS);
      return () => window.clearTimeout(timer);
    }

    element.scrollIntoView({ block: 'center', behavior: 'smooth' });

    const measure = () => setRect(element.getBoundingClientRect());
    // Ждём, пока доедет плавная прокрутка и анимация появления экрана.
    const timer = window.setTimeout(measure, 420);
    // Элемент может двигаться: открылся лист, подъехала клавиатура.
    const ticker = window.setInterval(measure, 500);

    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(ticker);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [element]);

  // Элемент так и не появился — не держим пользователя, идём дальше.
  useEffect(() => {
    if (gaveUp && !waiting) onNext();
  }, [gaveUp, waiting, onNext]);

  const buzzed = useRef(false);
  useEffect(() => {
    if (rect && !buzzed.current) {
      buzzed.current = true;
      tg.haptic.light();
    }
  }, [rect]);

  const isLast = index === total - 1;

  const padding = 8;
  const spot = rect
    ? {
        top: rect.top - padding,
        left: rect.left - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
      }
    : null;

  // Карточку ставим с той стороны, где больше места.
  const below = spot ? spot.top + spot.height / 2 < window.innerHeight / 2 : true;

  const card = (
    <motion.div
      className="absolute left-4 right-4 rounded-3xl bg-surface p-4 shadow-sheet"
      // Карточка кликабельна всегда, даже когда фон пропускает нажатия.
      style={{
        pointerEvents: muted ? 'none' : 'auto',
        ...(spot
          ? below
            ? { top: Math.min(spot.top + spot.height + 12, window.innerHeight - 200) }
            : { bottom: Math.min(window.innerHeight - spot.top + 12, window.innerHeight - 200) }
          : { top: '50%', transform: 'translateY(-50%)' }),
      }}
      initial={{ opacity: 0, y: below ? -10 : 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[18px]">
          {interactive ? '🎯' : '💡'}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold">{title}</div>
          <div className="mt-1 text-[13px] leading-snug text-muted">{text}</div>
        </div>
        <button
          type="button"
          onClick={onSkip}
          className="pressable -mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted"
          aria-label="Завершить обучение"
        >
          <X size={18} />
        </button>
      </div>

      {/* Полоса прогресса вместо точек: шагов много. */}
      <div className="mt-3.5 flex items-center gap-3">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted/25">
          <motion.div
            className="h-full rounded-full bg-accent"
            initial={false}
            animate={{ width: `${((index + 1) / total) * 100}%` }}
            transition={{ type: 'spring', stiffness: 200, damping: 26 }}
          />
        </div>
        <span className="tabular shrink-0 text-[12px] text-muted">
          {index + 1} из {total}
        </span>
      </div>

      {waiting ? (
        // Шаг завершает сам пользователь — показываем, чего ждём.
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-[13px] text-accent">
            <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
            {hint ?? 'Ждём вашего действия'}
          </span>
          <button
            type="button"
            onClick={onSkip}
            className="pressable rounded-2xl px-3 py-2 text-[13px] font-medium text-muted"
          >
            Прервать
          </button>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2">
          {index > 0 && (
            <button
              type="button"
              onClick={onBack}
              className="pressable flex h-11 w-11 items-center justify-center rounded-2xl bg-elevated"
              aria-label="Назад"
            >
              <ChevronLeft size={20} />
            </button>
          )}
          <button
            type="button"
            onClick={onSkip}
            className="pressable rounded-2xl px-4 py-3 text-[14px] font-medium text-muted"
          >
            {interactive ? 'Прервать' : 'Пропустить'}
          </button>
          <button
            type="button"
            onClick={onNext}
            className="pressable flex-1 rounded-2xl bg-content px-5 py-3 text-[15px] font-semibold text-ink"
          >
            {isLast ? 'Готово' : 'Далее'}
          </button>
        </div>
      )}
    </motion.div>
  );

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[60]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        // В интерактиве слой не должен перехватывать нажатия: их получает
        // подсвеченный элемент. Карточка возвращает себе кликабельность сама.
        style={{ pointerEvents: interactive || muted ? 'none' : 'auto' }}
      >
        {spot ? (
          interactive ? (
            // Затемнение четырьмя полосами вокруг цели — центр остаётся живым.
            <>
              <Shade style={{ top: 0, left: 0, right: 0, height: Math.max(spot.top, 0) }} />
              <Shade style={{ top: spot.top + spot.height, left: 0, right: 0, bottom: 0 }} />
              <Shade style={{ top: spot.top, left: 0, width: Math.max(spot.left, 0), height: spot.height }} />
              <Shade style={{ top: spot.top, left: spot.left + spot.width, right: 0, height: spot.height }} />
              <motion.div
                className="absolute rounded-2xl"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{
                  ...spot,
                  pointerEvents: 'none',
                  outline: '2px solid rgb(var(--c-accent))',
                  outlineOffset: 2,
                }}
              />
            </>
          ) : (
            <motion.div
              className="absolute rounded-2xl"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.25 }}
              style={{
                ...spot,
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.74)',
                outline: '2px solid rgb(var(--c-accent))',
                outlineOffset: 2,
              }}
            />
          )
        ) : (
          <div className="absolute inset-0 bg-black/70" style={{ pointerEvents: 'auto' }} />
        )}

        {card}
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}

/** Полупрозрачная полоса затемнения вокруг подсвеченной области. */
function Shade({ style }: { style: React.CSSProperties }) {
  return <div className="absolute bg-black/74" style={{ ...style, pointerEvents: 'auto' }} />;
}
