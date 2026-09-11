import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, BellOff, CalendarClock, Plus, Trash2 } from 'lucide-react';
import { currencySymbol } from '@budget/shared';
import type { RecurringDto } from '../lib/queries';
import {
  useAccounts,
  useCategories,
  useRecurring,
  useRecurringMutations,
  useSession,
  useUpdateSettings,
} from '../lib/queries';
import { AccountIcon } from '../components/AccountIcon';
import { Sheet } from '../components/Sheet';
import { EmptyState, Skeleton } from '../components/ui';
import { CategoryPickerSheet } from '../components/pickers';
import { formatMoney } from '../lib/format';
import { tg } from '../lib/telegram';

/**
 * Напоминания.
 *
 * Два независимых механизма: ежедневное «внесите траты» и напоминания
 * о конкретных платежах. Второе настраивается здесь и никак не связано
 * с отметкой «повтор» на операции — та лишь помечает саму запись.
 */
export function RemindersScreen() {
  const navigate = useNavigate();
  const { data: session } = useSession();
  const { data: items = [], isLoading } = useRecurring();
  const [editing, setEditing] = useState<RecurringDto | 'new' | null>(null);

  const settings = session?.settings;

  return (
    <div className="pb-28">
      <header className="flex items-center gap-3 px-4 pb-3 pt-[calc(10px+var(--safe-top))]">
        <button
          type="button"
          onClick={() => {
            tg.haptic.light();
            navigate(-1);
          }}
          className="pressable flex h-10 w-10 items-center justify-center rounded-full bg-card"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-[20px] font-bold">Напоминания</h1>
      </header>

      <div className="space-y-5 px-4">
        {/* ---------- Ежедневное ---------- */}
        <section>
          <h2 className="mb-1.5 px-1 text-[13px] font-medium uppercase tracking-wide text-muted">
            Каждый день
          </h2>
          <DailyReminder
            enabled={settings?.dailyReminder ?? false}
            time={settings?.dailyReminderTime ?? '21:00'}
            always={settings?.dailyAlways ?? false}
          />
        </section>

        {/* ---------- Регулярные платежи ---------- */}
        <section>
          <div className="mb-1.5 flex items-center justify-between px-1">
            <h2 className="text-[13px] font-medium uppercase tracking-wide text-muted">
              Регулярные платежи
            </h2>
            <button
              type="button"
              onClick={() => {
                tg.haptic.light();
                setEditing('new');
              }}
              className="pressable flex items-center gap-1 text-[14px] text-accent"
            >
              <Plus size={15} />
              Добавить
            </button>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full rounded-2xl" />
              <Skeleton className="h-16 w-full rounded-2xl" />
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-3xl bg-card">
              <EmptyState
                icon="🔔"
                title="Напоминаний нет"
                hint="Добавьте квартплату, подписки или страховку — бот напомнит в нужный день, чтобы вы не забыли записать платёж."
                action={
                  <button
                    type="button"
                    onClick={() => setEditing('new')}
                    className="pressable mt-1 rounded-full bg-accent px-5 py-2.5 text-[14px] font-semibold text-black"
                  >
                    Добавить напоминание
                  </button>
                }
              />
            </div>
          ) : (
            <div className="divide-y divide-line/50 overflow-hidden rounded-3xl bg-card">
              {items.map((item) => (
                <ReminderRow key={item.id} item={item} onEdit={() => setEditing(item)} />
              ))}
            </div>
          )}

          <p className="mt-2 px-1 text-[12px] leading-snug text-muted">
            Напоминания живут отдельно от операций: значок «Повтор» при вводе только помечает
            запись, а список ниже вы задаёте сами.
          </p>
        </section>
      </div>

      <ReminderSheet
        item={editing}
        onClose={() => setEditing(null)}
        defaultCurrency={settings?.baseCurrency ?? 'RUB'}
      />
    </div>
  );
}

function DailyReminder({
  enabled,
  time,
  always,
}: {
  enabled: boolean;
  time: string;
  always: boolean;
}) {
  const update = useUpdateSettings();
  const [localTime, setLocalTime] = useState(time);

  useEffect(() => setLocalTime(time), [time]);

  // Часовой пояс устройства, чтобы 21:00 означало ваши 21:00.
  const tzOffsetMinutes = -new Date().getTimezoneOffset();

  const save = (patch: {
    dailyReminder?: boolean;
    dailyReminderTime?: string;
    dailyAlways?: boolean;
  }) => {
    tg.haptic.select();
    update.mutate({
      dailyReminder: enabled,
      dailyReminderTime: localTime,
      dailyAlways: always,
      tzOffsetMinutes,
      ...patch,
    });
  };

  return (
    <div className="overflow-hidden rounded-3xl bg-card">
      <button
        type="button"
        onClick={() => save({ dailyReminder: !enabled })}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-elevated text-muted">
          {enabled ? <Bell size={18} /> : <BellOff size={18} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium">Напоминать о тратах</span>
          <span className="block text-[13px] text-muted">
            {always ? 'Каждый день в выбранное время' : 'Только если за день ничего не записали'}
          </span>
        </span>
        <span
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
            enabled ? 'bg-accent' : 'bg-muted/30'
          }`}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${
              enabled ? 'left-6' : 'left-1'
            }`}
          />
        </span>
      </button>

      {enabled && (
        <div className="border-t border-line/50 px-4 py-3.5">
          <div className="flex items-center gap-3">
            <input
              type="time"
              value={localTime}
              onChange={(e) => {
                setLocalTime(e.target.value);
                save({ dailyReminderTime: e.target.value });
              }}
              className="tabular rounded-xl bg-elevated px-3 py-2 text-[17px] font-semibold outline-none"
            />
            <span className="text-[13px] text-muted">по вашему времени</span>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {['12:00', '18:00', '20:00', '21:00', '22:00'].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setLocalTime(preset);
                  save({ dailyReminderTime: preset });
                }}
                className={`pressable rounded-full px-3 py-1.5 text-[13px] ${
                  localTime === preset ? 'bg-content text-ink' : 'bg-elevated text-muted'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>

          {/* Кому-то нужно напоминание как ритуал, даже если траты уже записаны. */}
          <button
            type="button"
            onClick={() => save({ dailyAlways: !always })}
            className="mt-3 flex w-full items-center gap-3 rounded-2xl bg-elevated/60 px-3 py-2.5 text-left"
          >
            <span className="min-w-0 flex-1 text-[13px] leading-snug">
              Напоминать, даже если операции уже записаны
            </span>
            <span
              className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${
                always ? 'bg-accent' : 'bg-muted/30'
              }`}
            >
              <span
                className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${
                  always ? 'left-5' : 'left-1'
                }`}
              />
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

function ReminderRow({ item, onEdit }: { item: RecurringDto; onEdit: () => void }) {
  const { update } = useRecurringMutations();

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <button type="button" onClick={onEdit} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[18px]"
          style={{ backgroundColor: item.category ? `${item.category.color}26` : 'rgb(var(--c-elevated))' }}
        >
          {item.category?.icon ?? '🔁'}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-[15px] font-medium ${item.isActive ? '' : 'text-muted line-through'}`}>
            {item.title}
          </span>
          <span className="flex items-center gap-1 truncate text-[13px] text-muted">
            <CalendarClock size={12} />
            {item.dayOfMonth}-го в {item.notifyTime} · {formatMoney(item.amount, item.currency)}
          </span>
        </span>
      </button>

      <button
        type="button"
        onClick={() => {
          tg.haptic.select();
          update.mutate({ id: item.id, isActive: !item.isActive });
        }}
        className={`pressable relative h-7 w-12 shrink-0 rounded-full transition-colors ${
          item.isActive ? 'bg-accent' : 'bg-muted/30'
        }`}
        aria-label={item.isActive ? 'Выключить' : 'Включить'}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${
            item.isActive ? 'left-6' : 'left-1'
          }`}
        />
      </button>
    </div>
  );
}

function ReminderSheet({
  item,
  onClose,
  defaultCurrency,
}: {
  item: RecurringDto | 'new' | null;
  onClose: () => void;
  defaultCurrency: string;
}) {
  const isNew = item === 'new';
  const existing = item && item !== 'new' ? item : null;

  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories('expense');
  const { create, update, remove } = useRecurringMutations();

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [day, setDay] = useState(10);
  const [time, setTime] = useState('10:00');
  const [accountId, setAccountId] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState('');

  // Заполняем форму при открытии.
  useEffect(() => {
    if (!item) return;
    setError('');
    if (existing) {
      setTitle(existing.title);
      setAmount(String(existing.amount));
      setDay(existing.dayOfMonth);
      setTime(existing.notifyTime);
      setAccountId(existing.accountId);
      setCategoryId(existing.categoryId);
    } else {
      setTitle('');
      setAmount('');
      setDay(10);
      setTime('10:00');
      setAccountId(accounts[0]?.id ?? null);
      setCategoryId(categories[0]?.id ?? null);
    }
  }, [item, existing, accounts, categories]);

  const category = categories.find((c) => c.id === categoryId);
  const account = accounts.find((a) => a.id === accountId);
  const currency = account?.currency ?? defaultCurrency;

  const submit = () => {
    const value = Number(amount.replace(',', '.').replace(/\s/g, ''));
    if (!title.trim()) return setError('Укажите название');
    if (!Number.isFinite(value) || value <= 0) return setError('Укажите сумму больше нуля');
    if (!accountId) return setError('Выберите счёт');

    const payload = {
      title: title.trim(),
      accountId,
      categoryId,
      amount: value,
      currency,
      dayOfMonth: day,
      notifyTime: time,
    };

    const onDone = () => {
      tg.haptic.success();
      onClose();
    };
    const onFail = (err: unknown) => {
      tg.haptic.error();
      setError((err as Error).message);
    };

    if (existing) {
      update.mutate({ id: existing.id, ...payload }, { onSuccess: onDone, onError: onFail });
    } else {
      create.mutate(payload, { onSuccess: onDone, onError: onFail });
    }
  };

  const busy = create.isPending || update.isPending || remove.isPending;

  return (
    <>
      <Sheet
        open={item !== null}
        onClose={onClose}
        title={isNew ? 'Новое напоминание' : 'Напоминание'}
        tall
      >
        <div className="space-y-3 pt-1">
          <Field label="Название">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Квартплата"
              className="w-full rounded-2xl bg-elevated px-4 py-3 text-[16px] outline-none placeholder:text-muted"
            />
          </Field>

          <Field label="Сумма">
            <div className="flex items-center gap-2 rounded-2xl bg-elevated px-4 py-3">
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                placeholder="12000"
                className="tabular min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted"
              />
              <span className="text-[15px] text-muted">{currencySymbol(currency)}</span>
            </div>
          </Field>

          <Field label="Когда напоминать">
            <div className="flex items-center gap-2">
              <div className="flex flex-1 items-center gap-2 rounded-2xl bg-elevated px-4 py-3">
                <input
                  type="number"
                  min={1}
                  max={28}
                  value={day}
                  onChange={(e) => setDay(Math.min(Math.max(Number(e.target.value) || 1, 1), 28))}
                  className="tabular w-12 bg-transparent text-[16px] outline-none"
                />
                <span className="text-[14px] text-muted">числа</span>
              </div>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="tabular rounded-2xl bg-elevated px-3 py-3 text-[16px] font-medium outline-none"
              />
            </div>
            <p className="mt-1.5 px-1 text-[12px] text-muted">
              Дни с 1 по 28 — чтобы напоминание приходило в любом месяце.
            </p>
          </Field>

          <Field label="Счёт">
            <div className="scroll-x flex gap-1.5">
              {accounts.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAccountId(a.id)}
                  className={`pressable shrink-0 rounded-full px-3.5 py-2 text-[14px] ${
                    a.id === accountId ? 'bg-content text-ink' : 'bg-elevated text-muted'
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <AccountIcon
                      icon={a.icon}
                      color={a.color}
                      className="h-5 w-5"
                      emojiClassName="text-[12px]"
                    />
                    {a.name}
                  </span>
                </button>
              ))}
            </div>
          </Field>

          <Field label="Категория">
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="pressable flex w-full items-center gap-2.5 rounded-2xl bg-elevated px-3 py-2.5 text-left"
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[17px]"
                style={{ backgroundColor: category ? category.color : 'rgb(var(--c-card))' }}
              >
                {category?.icon ?? '🏷'}
              </span>
              <span className="truncate text-[15px]">{category?.name ?? 'Выбрать'}</span>
            </button>
          </Field>

          {error && (
            <div className="rounded-2xl bg-negative/15 px-4 py-3 text-center text-[14px] text-negative">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="pressable w-full rounded-2xl bg-content px-5 py-3.5 text-[16px] font-semibold text-ink disabled:opacity-50"
          >
            {busy ? 'Сохраняю…' : isNew ? 'Добавить' : 'Сохранить'}
          </button>

          {existing && (
            <button
              type="button"
              onClick={() => {
                tg.haptic.warning();
                remove.mutate(existing.id, { onSuccess: onClose });
              }}
              disabled={busy}
              className="pressable flex w-full items-center justify-center gap-2 rounded-2xl bg-negative/10 px-5 py-3.5 text-[15px] font-medium text-negative disabled:opacity-50"
            >
              <Trash2 size={17} />
              Удалить напоминание
            </button>
          )}
        </div>
      </Sheet>

      <CategoryPickerSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        categories={categories}
        selectedId={categoryId}
        onSelect={(c) => setCategoryId(c.id)}
      />
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 px-1 text-[13px] text-muted">{label}</div>
      {children}
    </div>
  );
}
