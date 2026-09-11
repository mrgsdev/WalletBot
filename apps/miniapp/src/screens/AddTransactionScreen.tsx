import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  CalendarDays,
  Delete,
  MoreHorizontal,
  Repeat,
  X,
} from 'lucide-react';
import type { CategoryDto, TransactionDto } from '@budget/shared';
import {
  CURRENCY_BY_CODE,
  currencySymbol,
  evaluateExpression,
  formatExpression,
  hasOperator,
  MAX_AMOUNT,
  pushToken,
} from '@budget/shared';
import { useAccounts, useCategories, useDeleteTransaction, useRates, useSaveTransaction } from '../lib/queries';
import { fontSizeForLength, formatMoney, formatMoneyFit, formatNumber, formatDateLabel, toDateInputValue } from '../lib/format';
import { tg } from '../lib/telegram';
import { emitTourEvent } from '../lib/tourBus';
import { AccountIcon } from '../components/AccountIcon';
import { CATEGORY_ICON_IMAGES, CategoryIcon } from '../components/CategoryIcon';
import { TourTarget } from '../components/Tour';
import { Sheet } from '../components/Sheet';
import { AccountPickerSheet, CategoryPickerSheet, CurrencyPickerSheet } from '../components/pickers';
import { Skeleton } from '../components/ui';

type TxType = 'expense' | 'income' | 'transfer';

const TYPES: { value: TxType; label: string; Icon: typeof ArrowUpRight }[] = [
  { value: 'expense', label: 'Расход', Icon: ArrowUpRight },
  { value: 'income', label: 'Доход', Icon: ArrowDownLeft },
  { value: 'transfer', label: 'Перевод', Icon: ArrowLeftRight },
];

interface Props {
  open: boolean;
  onClose: () => void;
  /** Передаётся при редактировании существующей операции. */
  editing?: TransactionDto | null;
  /** Тип, выбранный на полосе быстрых действий главного экрана. */
  initialType?: TxType;
}

/**
 * Полноэкранный модальный экран быстрого ввода операции.
 * Сумма набирается калькулятором: над итогом показывается выражение («75 + 50»),
 * под итогом — конвертация, если валюта операции отличается от валюты счёта.
 */
export function AddTransactionScreen({ open, onClose, editing = null, initialType = 'expense' }: Props) {
  const { data: accounts = [], isLoading: accountsLoading } = useAccounts();
  const [type, setType] = useState<TxType>(initialType);
  const { data: categories = [] } = useCategories(type === 'income' ? 'income' : 'expense');

  const [expression, setExpression] = useState('');
  const [accountId, setAccountId] = useState<number | null>(null);
  const [toAccountId, setToAccountId] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [currency, setCurrency] = useState('RUB');
  const [date, setDate] = useState(() => new Date());
  const [comment, setComment] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [picker, setPicker] = useState<'account' | 'toAccount' | 'currency' | 'category' | 'extra' | null>(null);

  const save = useSaveTransaction();
  const remove = useDeleteTransaction();

  const account = accounts.find((a) => a.id === accountId) ?? null;
  const toAccount = accounts.find((a) => a.id === toAccountId) ?? null;
  const category = categories.find((c) => c.id === categoryId) ?? null;

  const { data: rates } = useRates(currency);
  const amount = evaluateExpression(expression) ?? 0;

  // Инициализация при открытии: либо редактируем операцию, либо начинаем с чистого листа.
  useEffect(() => {
    if (!open) return;
    setError(null);

    if (editing) {
      setType(editing.type);
      setExpression(String(editing.amount).replace('.', ','));
      setAccountId(editing.accountId);
      setToAccountId(editing.toAccountId);
      setCategoryId(editing.categoryId);
      setCurrency(editing.currency);
      setDate(new Date(editing.date));
      setComment(editing.comment ?? '');
      setIsRecurring(editing.isRecurring);
      return;
    }

    setType(initialType);
    setExpression('');
    setToAccountId(null);
    setCategoryId(null);
    setDate(new Date());
    setComment('');
    setIsRecurring(false);
  }, [open, editing, initialType]);

  // Первый счёт выбирается автоматически, валюта подтягивается из него.
  useEffect(() => {
    if (!open || accounts.length === 0) return;
    if (accountId === null) {
      setAccountId(accounts[0].id);
      if (!editing) setCurrency(accounts[0].currency);
    }
  }, [open, accounts, accountId, editing]);

  // Категория по умолчанию — первая подходящая по типу операции.
  useEffect(() => {
    if (type === 'transfer' || categories.length === 0) return;
    if (categoryId === null || !categories.some((c) => c.id === categoryId)) {
      setCategoryId(categories[0].id);
    }
  }, [type, categories, categoryId]);

  useEffect(() => {
    if (!open) return;
    return tg.pushBackHandler(onClose);
  }, [open, onClose]);

  // Закрытый экран не должен оставлять за собой открытые листы.
  useEffect(() => {
    if (!open) setPicker(null);
  }, [open]);

  // Сообщаем обучению о ключевых действиях пользователя.
  useEffect(() => {
    emitTourEvent(open ? 'add-opened' : 'add-closed');
  }, [open]);



  const converted = useMemo(() => {
    if (!account || account.currency === currency || !rates) return null;
    const rate = rates.rates[account.currency];
    if (!rate) return null;
    return { amount: amount * rate, rate };
  }, [account, currency, rates, amount]);

  const press = (token: string) => {
    tg.haptic.light();
    setExpression((prev) => {
      const next = pushToken(prev, token);
      // Обучение ждёт именно ввода пользователя, а не остаточного значения.
      if (next && next !== prev) emitTourEvent('amount-entered');
      return next;
    });
  };

  const backspace = () => {
    tg.haptic.light();
    setExpression((prev) => prev.slice(0, -1));
  };

  const clearAll = () => {
    tg.haptic.rigid();
    setExpression('');
  };

  const overLimit = amount > MAX_AMOUNT;

  const canSave =
    amount > 0 &&
    !overLimit &&
    accountId !== null &&
    (type === 'transfer' ? toAccountId !== null && toAccountId !== accountId : categoryId !== null);

  const handleSave = async () => {
    if (!canSave || save.isPending) return;
    setError(null);
    try {
      await save.mutateAsync({
        id: editing?.id,
        type,
        accountId: accountId!,
        toAccountId: type === 'transfer' ? toAccountId : null,
        categoryId: type === 'transfer' ? null : categoryId,
        amount,
        currency,
        date: date.toISOString(),
        comment: comment.trim() || null,
      });
      tg.haptic.success();
      emitTourEvent('transaction-saved');
      onClose();
    } catch (err) {
      tg.haptic.error();
      setError(err instanceof Error ? err.message : 'Не удалось сохранить операцию');
    }
  };

  const handleDelete = async () => {
    if (!editing) return;
    try {
      await remove.mutateAsync(editing.id);
      tg.haptic.success();

      setPicker(null);
      onClose();
    } catch (err) {
      tg.haptic.error();
      setError(err instanceof Error ? err.message : 'Не удалось удалить операцию');
    }
  };

  const symbol = currencySymbol(currency);
  const displayAmount = formatEntry(expression, amount);

  return (
    /*
     * Селекторы вынесены за AnimatePresence экрана.
     * Раньше они жили внутри уходящего поддерева: при закрытии экрана
     * анимация «замораживала» его вместе с открытым листом, и лист
     * оставался висеть поверх приложения — например, после удаления операции.
     */
    <>
      <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-40 flex flex-col bg-ink"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 32 }}
          style={{ height: 'var(--tg-viewport-height)' }}
        >
          {/* ---------- Шапка: закрыть / тип операции / доп. меню ---------- */}
          <div className="flex items-center justify-between gap-2 px-4 pb-3 pt-[calc(12px+var(--safe-top))]">
            <button
              type="button"
              onClick={() => {
                tg.haptic.light();
                onClose();
              }}
              className="pressable flex h-11 w-11 items-center justify-center rounded-full bg-card"
              aria-label="Закрыть"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-1 rounded-full bg-card p-1">
              {TYPES.map(({ value, label, Icon }) => {
                const active = value === type;
                return (
                  <button
                    key={value}
                  type="button"
                  onClick={() => {
                      tg.haptic.select();
                      setType(value);
                  }}
                    className={`pressable relative flex items-center gap-1.5 rounded-full px-3 py-2 text-[14px] font-medium ${
                      active ? 'text-content' : 'text-muted'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="tx-type"
                        className="absolute inset-0 rounded-full bg-elevated"
                        transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                      />
                    )}
                    <Icon size={16} className="relative z-10" />
                    {active && <span className="relative z-10">{label}</span>}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => {
                tg.haptic.light();
                setPicker('extra');
              }}
              className="pressable flex h-11 w-11 items-center justify-center rounded-full bg-card"
              aria-label="Ещё"
            >
              <MoreHorizontal size={20} />
            </button>
          </div>

          {/* ---------- Основная карточка ---------- */}
          <div className="mx-3 flex min-h-0 flex-1 flex-col rounded-4xl bg-card/70 p-3">
            {/* Счёт и валюта */}
            <div className="flex items-start justify-between gap-2">
              {accountsLoading ? (
                <Skeleton className="h-12 w-40 rounded-full" />
              ) : (
                <TourTarget id="walk-account">
                <button
                  type="button"
                  onClick={() => {
                    tg.haptic.light();
                    setPicker('account');
                  }}
                  className="pressable flex max-w-full items-center gap-2.5 rounded-full bg-elevated/80 py-2 pl-2 pr-4"
                >
                  <AccountIcon
                    icon={account?.icon ?? '💳'}
                    color={account?.color}
                    className="h-9 w-9"
                    emojiClassName="text-[16px]"
                  />
                  {/* min-w-0 + truncate: длинное имя счёта иначе распирает чип. */}
                  <span className="min-w-0 text-left">
                    <span className="block truncate text-[14px] font-semibold leading-tight">
                      {account?.name ?? 'Счёт'}
                    </span>
                    <span className="block truncate text-[12px] leading-tight text-muted">
                      {account ? formatMoneyFit(account.balance, account.currency, 16) : '—'}
                    </span>
                  </span>
                </button>
                </TourTarget>
              )}

              <button
                type="button"
                onClick={() => {
                  tg.haptic.light();
                  setPicker('currency');
                }}
                className="pressable flex items-center gap-1.5 rounded-full bg-elevated/80 px-3 py-2.5"
              >
                <span className="text-[16px]">{flagOf(currency)}</span>
                <span className="text-[14px] font-semibold">{symbol}</span>
              </button>
            </div>

            {/* Сумма */}
            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-4">
              <AnimatePresence>
                {hasOperator(expression) && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="tabular rounded-full bg-elevated/70 px-3 py-1 text-[14px] text-muted"
                  >
                    {formatExpression(expression)}
                  </motion.div>
                )}
              </AnimatePresence>

              <div
                className="tabular flex items-baseline justify-center"
                /*
                 * Даже разрешённый максимум «999 999 999,99» не влезает
                 * на табло в 56px, поэтому кегль зависит от длины.
                 */
                style={{ fontSize: fontSizeForLength(displayAmount, 56, 10, 30) }}
              >
                <span className="font-semibold leading-none text-muted" style={{ fontSize: '0.78em' }}>
                  {symbol}
                </span>
                <motion.span
                  key={displayAmount}
                  initial={{ scale: 0.96, opacity: 0.6 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.12 }}
                  className="font-semibold leading-none tracking-tight"
                >
                  {displayAmount}
                </motion.span>
              </div>

              {overLimit && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="tabular rounded-full bg-negative/10 px-3 py-1 text-[13px] font-medium text-negative"
                >
                  Максимум {formatMoney(MAX_AMOUNT, currency, true)}
                </motion.div>
              )}

              <AnimatePresence>
                {converted && (
                  <motion.button
                  type="button"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setPicker('currency')}
                    className="tabular flex items-center gap-1.5 rounded-full bg-elevated/60 px-3 py-1.5 text-[13px] text-muted"
                  >
                    <Repeat size={13} />
                    {formatMoney(converted.amount, account!.currency, true)}
                    <span className="opacity-70">
                      ({symbol}1 = {formatMoney(converted.rate, account!.currency, false)})
                    </span>
                  </motion.button>
                )}
              </AnimatePresence>

              {type === 'transfer' && (
                <button
                  type="button"
                  onClick={() => {
                  tg.haptic.light();
                    setPicker('toAccount');
                  }}
                  className="pressable mt-1 flex items-center gap-2 rounded-full bg-elevated/70 px-3.5 py-2 text-[14px]"
                >
                  <ArrowLeftRight size={14} className="text-muted" />
                  {toAccount ? (
                    <>
                      <AccountIcon
                        icon={toAccount.icon}
                        color={toAccount.color}
                        className="h-5 w-5"
                        emojiClassName="text-[13px]"
                      />
                      <span className="font-medium">{toAccount.name}</span>
                    </>
                  ) : (
                    <span className="text-muted">Куда переводим?</span>
                  )}
                </button>
              )}
            </div>

            {/* Дата / повтор / вложение */}
            <div className="flex items-center justify-between px-1 pb-3">
              <div className="flex items-center gap-2">
                <label className="pressable relative flex items-center gap-2 rounded-full bg-elevated/80 px-3.5 py-2.5 text-[14px] font-medium">
                  <CalendarDays size={16} />
                  {formatDateLabel(date)}
                  <input
                    type="date"
                    value={toDateInputValue(date)}
                    max={toDateInputValue(new Date())}
                    onChange={(e) => {
                      const next = e.target.valueAsDate ?? new Date(e.target.value);
                      if (!Number.isNaN(next.getTime())) {
                        tg.haptic.select();
                        setDate(next);
                      }
                  }}
                    className="absolute inset-0 opacity-0"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => {
                      tg.haptic.light();
                      setIsRecurring((v) => !v);
                  }}
                  className={`pressable flex items-center gap-1.5 rounded-full py-2.5 pl-3 pr-3.5 text-[13px] font-medium transition-colors ${
                      isRecurring ? 'bg-accent text-black' : 'bg-elevated/80 text-muted'
                    }`}
                  aria-label="Повторяющийся платёж"
                  aria-pressed={isRecurring}
                  >
                  <Repeat size={16} />
                  {isRecurring ? 'Каждый месяц' : 'Повтор'}
                </button>
              </div>

            </div>

            {/* Клавиатура */}
            <TourTarget id="walk-keypad">
              <Keypad onDigit={press} onBackspace={backspace} onClear={clearAll} />
            </TourTarget>
          </div>

          {/* ---------- Нижняя панель: категория и сохранение ---------- */}
          <div className="flex items-center gap-3 px-4 pb-[calc(12px+var(--safe-bottom))] pt-3">
            {type === 'transfer' ? (
              <div className="flex-1 text-[14px] text-muted">Перевод между счетами</div>
            ) : (
              <TourTarget id="walk-category" className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => {
                  tg.haptic.light();
                  setPicker('category');
                }}
                className="pressable flex w-full min-w-0 items-center gap-2.5 rounded-full bg-card py-2 pl-2 pr-4"
              >
                {/* У картинки свой цвет — заливку кружка оставляем только эмодзи. */}
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                  style={{
                    backgroundColor:
                      category && !CATEGORY_ICON_IMAGES[category.icon]
                        ? category.color
                        : undefined,
                  }}
                >
                  <CategoryIcon
                    icon={category?.icon ?? '🏷'}
                    className="h-9 w-9"
                    emojiClassName="text-[17px]"
                    bare
                  />
                </span>
                <span className="truncate text-[15px] font-medium">
                  {category?.name ?? 'Категория'}
                </span>
              </button>
              </TourTarget>
            )}

            <TourTarget id="walk-save">
              <button
                type="button"
                disabled={!canSave || save.isPending}
                onClick={handleSave}
                className="pressable flex h-[52px] items-center justify-center rounded-full bg-content px-7 text-[16px] font-semibold text-ink transition-opacity disabled:opacity-30"
              >
                {save.isPending ? '…' : editing ? 'Готово' : 'Сохранить'}
              </button>
            </TourTarget>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="pointer-events-none absolute inset-x-4 bottom-24 rounded-2xl bg-negative/90 px-4 py-3 text-center text-[14px] font-medium text-white"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

        </motion.div>
      )}
      </AnimatePresence>

          {/* ---------- Селекторы ---------- */}
      <AccountPickerSheet
        open={picker === 'account'}
        onClose={() => setPicker(null)}
        accounts={accounts}
        selectedId={accountId}
        onSelect={(a) => {
          setAccountId(a.id);
          if (!editing) setCurrency(a.currency);
          if (a.id === toAccountId) setToAccountId(null);
        }}
      />
      <AccountPickerSheet
        open={picker === 'toAccount'}
        onClose={() => setPicker(null)}
        accounts={accounts}
        selectedId={toAccountId}
        excludeId={accountId}
        title="Счёт получателя"
        onSelect={(a) => setToAccountId(a.id)}
      />
      <CurrencyPickerSheet
        open={picker === 'currency'}
        onClose={() => setPicker(null)}
        selected={currency}
        onSelect={setCurrency}
      />
      <CategoryPickerSheet
        open={picker === 'category'}
        onClose={() => setPicker(null)}
        categories={categories}
        selectedId={categoryId}
        onSelect={(c: CategoryDto) => {
          setCategoryId(c.id);
          emitTourEvent('category-picked');
        }}
      />

      <ExtraSheet
        open={picker === 'extra'}
        onClose={() => setPicker(null)}
        comment={comment}
        onComment={setComment}
        onDelete={editing ? handleDelete : undefined}
      />
    </>
  );
}

const KEYS = [
  ['7', '8', '9', '÷'],
  ['4', '5', '6', '×'],
  ['1', '2', '3', '−'],
  [',', '0', 'backspace', '+'],
];

/** Калькуляторная клавиатура: цифры, запятая, ⌫ и четыре операции. */
function Keypad({
  onDigit,
  onBackspace,
  onClear,
}: {
  onDigit: (token: string) => void;
  onBackspace: () => void;
  onClear: () => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {KEYS.flat().map((key) => {
        const isOperator = ['÷', '×', '−', '+'].includes(key);
        const isBackspace = key === 'backspace';

        return (
          <button
            key={key}
            type="button"
            onClick={() => (isBackspace ? onBackspace() : onDigit(key))}
            onContextMenu={(e) => {
              if (!isBackspace) return;
              e.preventDefault();
              onClear();
            }}
            className={`pressable flex h-[52px] items-center justify-center rounded-2xl text-[22px] font-medium shadow-key ${
              isOperator ? 'bg-elevated/50 text-muted' : 'bg-elevated/80'
            }`}
          >
            {isBackspace ? <Delete size={22} /> : key}
          </button>
        );
      })}
    </div>
  );
}

function ExtraSheet({
  open,
  onClose,
  comment,
  onComment,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  comment: string;
  onComment: (value: string) => void;
  onDelete?: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Детали операции">
      <label className="mb-4 block">
        <span className="mb-1.5 block text-[13px] text-muted">Комментарий</span>
        <textarea
          value={comment}
          onChange={(e) => onComment(e.target.value)}
          rows={3}
          placeholder="Например: обед с командой"
          className="w-full resize-none rounded-2xl bg-elevated px-4 py-3 text-[15px] outline-none placeholder:text-muted"
        />
      </label>


      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="pressable w-full rounded-2xl bg-negative/15 px-4 py-3.5 text-[15px] font-semibold text-negative"
        >
          Удалить операцию
        </button>
      )}
    </Sheet>
  );
}

function flagOf(code: string): string {
  return CURRENCY_BY_CODE[code]?.flag ?? '🏳️';
}

/**
 * Сумма на экране ввода.
 *
 * Пока набирается дробная часть, показываем её так, как её печатают:
 * иначе запятая и нули после неё теряются при форматировании — человек
 * жмёт «,» и видит прежнее число, будто кнопка не сработала.
 * Как только в выражении появляется оператор, показываем результат.
 */
function formatEntry(expression: string, amount: number): string {
  if (expression === '') return '0';
  if (hasOperator(expression)) return formatNumber(amount);

  const dot = expression.indexOf('.');
  if (dot === -1) return formatNumber(amount);

  const whole = Number(expression.slice(0, dot));
  if (!Number.isFinite(whole)) return formatNumber(amount);

  return `${formatNumber(whole)},${expression.slice(dot + 1)}`;
}
